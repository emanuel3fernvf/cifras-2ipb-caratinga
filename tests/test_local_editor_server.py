from __future__ import annotations

import hashlib
import io
import json
import os
import stat
import tempfile
import unittest
from contextlib import redirect_stdout
from email.message import Message
from pathlib import Path
from unittest import mock
from urllib.parse import urlencode

import local_editor_server as server


class EditorServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary_directory.cleanup)
        self.root = Path(self.temporary_directory.name)
        (self.root / "culto").mkdir()
        self.relative_path = "culto/Música & Teste.html"
        self.page_path = self.root / self.relative_path
        self.original_source = (
            '<!DOCTYPE html>\n<html><head><title>Fora</title></head><body>\n'
            '<pre class="cifra">F &amp; G\nAm</pre>\n'
            '<aside data-value="&amp;">Não alterar</aside>\n</body></html>\n'
        )
        self.page_path.write_text(self.original_source, encoding="utf-8")
        self.service = server.EditorService(self.root)

    def assert_error(self, code: str, callback) -> server.EditorError:
        with self.assertRaises(server.EditorError) as context:
            callback()
        self.assertEqual(context.exception.code, code)
        return context.exception

    def test_load_returns_plain_pre_text_and_sha256_revision(self) -> None:
        document = self.service.load_document(self.relative_path)

        self.assertEqual(document.path, self.relative_path)
        self.assertEqual(document.pre_text, "F & G\nAm")
        self.assertEqual(
            document.revision,
            hashlib.sha256(self.original_source.encode("utf-8")).hexdigest(),
        )

    def test_save_escapes_text_and_preserves_everything_outside_pre(self) -> None:
        os.chmod(self.page_path, 0o640)
        document = self.service.load_document(self.relative_path)
        replacement = 'F# < G & "D"\nC > B'

        result = self.service.save_document(
            self.relative_path, replacement, document.revision
        )

        expected_source = self.original_source.replace(
            "F &amp; G\nAm", 'F# &lt; G &amp; "D"\nC &gt; B'
        )
        self.assertEqual(self.page_path.read_text(encoding="utf-8"), expected_source)
        self.assertEqual(
            result.revision,
            hashlib.sha256(expected_source.encode("utf-8")).hexdigest(),
        )
        self.assertEqual(stat.S_IMODE(self.page_path.stat().st_mode), 0o640)
        self.assertEqual(
            self.service.load_document(self.relative_path).pre_text, replacement
        )

    def test_same_content_does_not_replace_file(self) -> None:
        document = self.service.load_document(self.relative_path)
        with mock.patch.object(self.service, "_atomic_replace") as atomic_replace:
            result = self.service.save_document(
                self.relative_path, document.pre_text, document.revision
            )

        atomic_replace.assert_not_called()
        self.assertEqual(result.revision, document.revision)

    def test_stale_revision_is_rejected_without_overwriting_external_change(self) -> None:
        document = self.service.load_document(self.relative_path)
        external_source = self.original_source.replace("<title>Fora", "<title>Externo")
        self.page_path.write_text(external_source, encoding="utf-8")

        error = self.assert_error(
            "revision_conflict",
            lambda: self.service.save_document(
                self.relative_path, "C", document.revision
            ),
        )

        self.assertEqual(error.status, 409)
        self.assertEqual(self.page_path.read_text(encoding="utf-8"), external_source)

    def test_change_during_atomic_save_is_rechecked(self) -> None:
        document = self.service.load_document(self.relative_path)
        original_atomic_replace = self.service._atomic_replace
        external_source = self.original_source.replace("F &amp; G", "ALTERAÇÃO EXTERNA")

        def race(target: Path, data: bytes, expected_revision: str) -> None:
            target.write_text(external_source, encoding="utf-8")
            original_atomic_replace(target, data, expected_revision)

        with mock.patch.object(
            self.service, "_atomic_replace", side_effect=race
        ):
            self.assert_error(
                "revision_conflict",
                lambda: self.service.save_document(
                    self.relative_path, "C D E", document.revision
                ),
            )

        self.assertEqual(self.page_path.read_text(encoding="utf-8"), external_source)
        self.assertEqual(list(self.page_path.parent.glob(".*.tmp")), [])

    def test_write_failure_keeps_original_and_removes_temporary_file(self) -> None:
        document = self.service.load_document(self.relative_path)

        with mock.patch("local_editor_server.os.replace", side_effect=OSError("falha")):
            error = self.assert_error(
                "write_failed",
                lambda: self.service.save_document(
                    self.relative_path, "C D E", document.revision
                ),
            )

        self.assertEqual(error.status, 500)
        self.assertEqual(self.page_path.read_text(encoding="utf-8"), self.original_source)
        self.assertEqual(list(self.page_path.parent.glob(".*.tmp")), [])

    def test_forbidden_and_missing_paths_have_specific_errors(self) -> None:
        forbidden = (
            "../fora.html",
            "/tmp/fora.html",
            "culto\\Música & Teste.html",
            "culto/../culto/Música & Teste.html",
            "culto/notas.txt",
        )
        for requested_path in forbidden:
            with self.subTest(path=requested_path):
                error = self.assert_error(
                    "path_forbidden",
                    lambda requested_path=requested_path: self.service.load_document(
                        requested_path
                    ),
                )
                self.assertEqual(error.status, 403)

        error = self.assert_error(
            "file_not_found", lambda: self.service.load_document("culto/ausente.html")
        )
        self.assertEqual(error.status, 404)

    def test_symlink_cannot_escape_root(self) -> None:
        with tempfile.TemporaryDirectory() as outside_directory:
            outside_page = Path(outside_directory) / "outside.html"
            outside_page.write_text("<pre>C</pre>", encoding="utf-8")
            link = self.root / "culto" / "link.html"
            try:
                link.symlink_to(outside_page)
            except (OSError, NotImplementedError):
                self.skipTest("links simbólicos não são suportados neste sistema")

            error = self.assert_error(
                "path_forbidden",
                lambda: self.service.load_document("culto/link.html"),
            )
            self.assertEqual(error.status, 403)

    def test_invalid_html_and_encoding_are_rejected(self) -> None:
        invalid_pages = {
            "none.html": "<html><body>sem cifra</body></html>",
            "two.html": "<pre>C</pre><pre>D</pre>",
            "open.html": "<html><pre>C</html>",
            "self-closing.html": "<html><pre /></html>",
        }
        for name, source in invalid_pages.items():
            page = self.root / name
            page.write_text(source, encoding="utf-8")
            with self.subTest(name=name):
                error = self.assert_error(
                    "invalid_html", lambda name=name: self.service.load_document(name)
                )
                self.assertEqual(error.status, 422)

        invalid_utf8 = self.root / "invalid-utf8.html"
        invalid_utf8.write_bytes(b"<pre>\xff</pre>")
        error = self.assert_error(
            "invalid_encoding",
            lambda: self.service.load_document("invalid-utf8.html"),
        )
        self.assertEqual(error.status, 422)

    def test_pre_like_text_in_script_and_comment_is_not_counted(self) -> None:
        page = self.root / "semantic.html"
        page.write_text(
            '<!-- <pre>comentário</pre> --><script>const x = "<pre>fake</pre>";</script>'
            "<PRE>C &amp; D</PRE>",
            encoding="utf-8",
        )

        document = self.service.load_document("semantic.html")

        self.assertEqual(document.pre_text, "C & D")

    def test_invalid_revision_and_pre_text_types_are_rejected(self) -> None:
        document = self.service.load_document(self.relative_path)
        for revision in ("", "abc", None, 10):
            with self.subTest(revision=revision):
                self.assert_error(
                    "invalid_request",
                    lambda revision=revision: self.service.save_document(
                        self.relative_path, "C", revision
                    ),
                )
        self.assert_error(
            "invalid_request",
            lambda: self.service.save_document(
                self.relative_path, 123, document.revision
            ),
        )


class EditorApiTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary_directory.cleanup)
        self.root = Path(self.temporary_directory.name)
        self.relative_path = "pasta/Cântico.html"
        (self.root / "pasta").mkdir()
        (self.root / self.relative_path).write_text(
            "<html><pre>Em  C  D</pre><footer>fora</footer></html>",
            encoding="utf-8",
        )
        self.service = server.EditorService(self.root)
        self.api = server.EditorAPI(self.service)

    def test_health_contract_is_exact_and_static_get_is_delegated(self) -> None:
        response = self.api.get(server.HEALTH_ENDPOINT)

        self.assertEqual(response, server.ApiResponse(200, {"ok": True}))
        self.assertIsNone(self.api.get("/pasta/C%C3%A2ntico.html"))

    def test_document_and_save_contract(self) -> None:
        target = server.DOCUMENT_ENDPOINT + "?" + urlencode(
            {"path": self.relative_path}
        )
        loaded = self.api.get(target)
        assert loaded is not None

        self.assertEqual(loaded.status, 200)
        self.assertEqual(loaded.body["ok"], True)
        self.assertEqual(loaded.body["path"], self.relative_path)
        self.assertEqual(loaded.body["preText"], "Em  C  D")
        self.assertRegex(loaded.body["revision"], r"^[0-9a-f]{64}$")

        saved = self.api.post(
            server.SAVE_ENDPOINT,
            {
                "path": self.relative_path,
                "preText": "Em  C G D",
                "expectedRevision": loaded.body["revision"],
            },
        )

        self.assertEqual(saved.status, 200)
        self.assertEqual(set(saved.body), {"ok", "revision"})
        self.assertEqual(saved.body["ok"], True)
        self.assertEqual(
            self.service.load_document(self.relative_path).pre_text, "Em  C G D"
        )

    def test_conflict_and_validation_error_shapes(self) -> None:
        document = self.service.load_document(self.relative_path)
        (self.root / self.relative_path).write_text("<pre>externo</pre>", encoding="utf-8")

        conflict = self.api.post(
            server.SAVE_ENDPOINT,
            {
                "path": self.relative_path,
                "preText": "novo",
                "expectedRevision": document.revision,
            },
        )

        self.assertEqual(conflict.status, 409)
        self.assertEqual(conflict.body["ok"], False)
        self.assertEqual(conflict.body["error"]["code"], "revision_conflict")

        malformed_requests = (
            None,
            [],
            {},
            {"path": self.relative_path},
        )
        for payload in malformed_requests:
            with self.subTest(payload=payload):
                response = self.api.post(server.SAVE_ENDPOINT, payload)
                self.assertEqual(response.status, 400)
                self.assertEqual(response.body["error"]["code"], "invalid_request")

    def test_unknown_endpoints_and_bad_document_query(self) -> None:
        unknown_get = self.api.get(server.API_PREFIX + "unknown")
        assert unknown_get is not None
        self.assertEqual(unknown_get.status, 404)
        self.assertEqual(unknown_get.body["error"]["code"], "endpoint_not_found")

        unknown_post = self.api.post("/qualquer", {})
        self.assertEqual(unknown_post.status, 404)

        for target in (
            server.DOCUMENT_ENDPOINT,
            server.DOCUMENT_ENDPOINT + "?path=a.html&path=b.html",
            server.DOCUMENT_ENDPOINT + "?other=a.html",
            server.HEALTH_ENDPOINT + "?path=a.html",
        ):
            with self.subTest(target=target):
                response = self.api.get(target)
                assert response is not None
                self.assertEqual(response.status, 400)
                self.assertEqual(response.body["error"]["code"], "invalid_request")


class HttpAdapterTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary_directory.cleanup)
        self.root = Path(self.temporary_directory.name)
        (self.root / "song.html").write_text("<pre>C</pre>", encoding="utf-8")
        self.handler_type = server.make_handler(self.root)

    def make_uninitialized_handler(
        self, body: bytes, content_type: str = "application/json"
    ):
        handler = object.__new__(self.handler_type)
        headers = Message()
        headers["Content-Type"] = content_type
        headers["Content-Length"] = str(len(body))
        handler.headers = headers
        handler.rfile = io.BytesIO(body)
        return handler

    def test_json_body_reader_without_socket(self) -> None:
        body = json.dumps({"preText": "á"}, ensure_ascii=False).encode("utf-8")
        handler = self.make_uninitialized_handler(
            body, "application/json; charset=utf-8"
        )

        self.assertEqual(handler._read_json(), {"preText": "á"})

    def test_json_body_reader_rejects_bad_media_and_json(self) -> None:
        handler = self.make_uninitialized_handler(b"{}", "text/plain")
        with self.assertRaises(server.EditorError) as context:
            handler._read_json()
        self.assertEqual(context.exception.status, 415)
        self.assertEqual(context.exception.code, "unsupported_media_type")

        handler = self.make_uninitialized_handler(b"{")
        with self.assertRaises(server.EditorError) as context:
            handler._read_json()
        self.assertEqual(context.exception.status, 400)
        self.assertEqual(context.exception.code, "invalid_json")

    def test_server_factory_is_fixed_to_ipv4_loopback_without_opening_socket(self) -> None:
        fake_server = mock.Mock()
        with mock.patch(
            "local_editor_server.ThreadingHTTPServer", return_value=fake_server
        ) as constructor:
            result = server.create_server(self.root, 8123)

        self.assertIs(result, fake_server)
        address, handler = constructor.call_args.args
        self.assertEqual(address, ("127.0.0.1", 8123))
        self.assertTrue(issubclass(handler, server.SimpleHTTPRequestHandler))
        self.assertEqual(fake_server.daemon_threads, True)

    def test_allowed_hosts_are_restricted_to_loopback_names(self) -> None:
        self.assertTrue(server._allowed_host("127.0.0.1:8000"))
        self.assertTrue(server._allowed_host("localhost:8000"))
        self.assertFalse(server._allowed_host("example.com"))
        self.assertFalse(server._allowed_host(None))

    def test_cli_accepts_root_and_optional_port(self) -> None:
        fake_server = mock.Mock()
        fake_server.serve_forever.side_effect = KeyboardInterrupt
        output = io.StringIO()
        with mock.patch(
            "local_editor_server.create_server", return_value=fake_server
        ) as create_server, redirect_stdout(output):
            result = server.main(
                ["--root", str(self.root), "--port", "8765"]
            )

        self.assertEqual(result, 0)
        create_server.assert_called_once_with(self.root.resolve(), 8765)
        fake_server.server_close.assert_called_once_with()
        self.assertIn("http://127.0.0.1:8765/2026_08_02/", output.getvalue())


if __name__ == "__main__":
    unittest.main()
