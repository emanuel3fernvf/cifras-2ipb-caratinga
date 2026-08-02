#!/usr/bin/env python3
"""Servidor HTTP local e seguro para o editor de cifras.

O servidor usa apenas a biblioteca padrão. Ele serve os arquivos estáticos do
repositório e expõe uma API pequena para ler e substituir o texto do único
elemento ``<pre>`` de uma página HTML.
"""

from __future__ import annotations

import argparse
import hashlib
import html
import json
import os
import re
import stat
import sys
import tempfile
import threading
from dataclasses import dataclass
from html.parser import HTMLParser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path, PurePosixPath
from typing import Any, Callable
from urllib.parse import parse_qs, urlsplit


LOOPBACK_HOST = "127.0.0.1"
DEFAULT_PORT = 8000
MAX_REQUEST_BYTES = 4 * 1024 * 1024
API_PREFIX = "/__chord_editor__/"
HEALTH_ENDPOINT = f"{API_PREFIX}health"
DOCUMENT_ENDPOINT = f"{API_PREFIX}document"
SAVE_ENDPOINT = f"{API_PREFIX}save"
REVISION_RE = re.compile(r"[0-9a-fA-F]{64}\Z")


class EditorError(Exception):
    """Erro esperado, próprio para ser devolvido pela API."""

    def __init__(self, status: int, code: str, message: str) -> None:
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message


@dataclass(frozen=True)
class Document:
    path: str
    pre_text: str
    revision: str


@dataclass(frozen=True)
class SaveResult:
    revision: str


@dataclass(frozen=True)
class ApiResponse:
    status: int
    body: dict[str, Any]


@dataclass(frozen=True)
class _LoadedDocument:
    target: Path
    source: str
    pre_start: int
    pre_end: int
    pre_text: str
    revision: str


class _PreLocator(HTMLParser):
    """Localiza semanticamente tags PRE sem reformatar o HTML."""

    def __init__(self, source: str) -> None:
        super().__init__(convert_charrefs=False)
        self.source = source
        self.starts: list[tuple[int, int]] = []
        self.ends: list[int] = []
        self.self_closing_pre = False
        self._line_starts = [0]
        self._line_starts.extend(
            index + 1 for index, character in enumerate(source) if character == "\n"
        )

    def _offset(self) -> int:
        line, column = self.getpos()
        return self._line_starts[line - 1] + column

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        del attrs
        if tag.lower() == "pre":
            raw_tag = self.get_starttag_text()
            start = self._offset()
            self.starts.append((start, start + len(raw_tag)))

    def handle_startendtag(
        self, tag: str, attrs: list[tuple[str, str | None]]
    ) -> None:
        del attrs
        if tag.lower() == "pre":
            self.self_closing_pre = True
            raw_tag = self.get_starttag_text()
            start = self._offset()
            self.starts.append((start, start + len(raw_tag)))

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "pre":
            self.ends.append(self._offset())


class _TextExtractor(HTMLParser):
    """Obtém o equivalente útil de textContent para o interior do PRE."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []

    def handle_data(self, data: str) -> None:
        self.parts.append(data)


def _sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _locate_pre(source: str) -> tuple[int, int, str]:
    locator = _PreLocator(source)
    try:
        locator.feed(source)
        locator.close()
    except (AssertionError, ValueError) as exc:
        raise EditorError(
            422, "invalid_html", "O arquivo não contém HTML válido para edição."
        ) from exc

    if (
        locator.self_closing_pre
        or len(locator.starts) != 1
        or len(locator.ends) != 1
    ):
        raise EditorError(
            422,
            "invalid_html",
            "A página deve conter exatamente um elemento <pre> completo.",
        )

    _, content_start = locator.starts[0]
    content_end = locator.ends[0]
    if content_end < content_start:
        raise EditorError(
            422,
            "invalid_html",
            "A página deve conter exatamente um elemento <pre> completo.",
        )

    raw_content = source[content_start:content_end]
    extractor = _TextExtractor()
    try:
        extractor.feed(raw_content)
        extractor.close()
    except (AssertionError, ValueError) as exc:
        raise EditorError(
            422, "invalid_html", "O conteúdo do elemento <pre> é inválido."
        ) from exc
    return content_start, content_end, "".join(extractor.parts)


class EditorService:
    """Camada de persistência, independente do transporte HTTP."""

    def __init__(self, root: str | os.PathLike[str]) -> None:
        resolved_root = Path(root).resolve(strict=True)
        if not resolved_root.is_dir():
            raise ValueError("A raiz do servidor precisa ser um diretório.")
        self.root = resolved_root
        self._write_lock = threading.RLock()

    def _resolve_html(self, requested_path: str) -> tuple[Path, str]:
        if not isinstance(requested_path, str) or not requested_path:
            raise EditorError(400, "invalid_request", "O campo path é obrigatório.")
        if "\x00" in requested_path or "\\" in requested_path:
            raise EditorError(403, "path_forbidden", "O caminho solicitado não é permitido.")

        relative = PurePosixPath(requested_path)
        if (
            relative.is_absolute()
            or any(part == ".." for part in relative.parts)
            or relative.suffix.lower() != ".html"
        ):
            raise EditorError(403, "path_forbidden", "O caminho solicitado não é permitido.")

        normalized_path = relative.as_posix()
        try:
            target = (self.root / Path(*relative.parts)).resolve(strict=True)
        except FileNotFoundError as exc:
            raise EditorError(404, "file_not_found", "O arquivo HTML não foi encontrado.") from exc
        except (OSError, RuntimeError) as exc:
            raise EditorError(403, "path_forbidden", "O caminho solicitado não é permitido.") from exc

        try:
            target.relative_to(self.root)
        except ValueError as exc:
            raise EditorError(403, "path_forbidden", "O caminho solicitado não é permitido.") from exc

        if target.suffix.lower() != ".html":
            raise EditorError(403, "path_forbidden", "O caminho solicitado não é permitido.")
        if not target.is_file():
            raise EditorError(404, "file_not_found", "O arquivo HTML não foi encontrado.")
        return target, normalized_path

    def _load(self, requested_path: str) -> _LoadedDocument:
        target, _ = self._resolve_html(requested_path)
        try:
            raw = target.read_bytes()
        except FileNotFoundError as exc:
            raise EditorError(404, "file_not_found", "O arquivo HTML não foi encontrado.") from exc
        except OSError as exc:
            raise EditorError(500, "read_failed", "Não foi possível ler o arquivo HTML.") from exc

        try:
            source = raw.decode("utf-8")
        except UnicodeDecodeError as exc:
            raise EditorError(
                422, "invalid_encoding", "O arquivo HTML precisa estar em UTF-8."
            ) from exc

        pre_start, pre_end, pre_text = _locate_pre(source)
        return _LoadedDocument(
            target=target,
            source=source,
            pre_start=pre_start,
            pre_end=pre_end,
            pre_text=pre_text,
            revision=_sha256(raw),
        )

    def load_document(self, requested_path: str) -> Document:
        loaded = self._load(requested_path)
        _, normalized_path = self._resolve_html(requested_path)
        return Document(
            path=normalized_path,
            pre_text=loaded.pre_text,
            revision=loaded.revision,
        )

    def _atomic_replace(
        self, target: Path, new_data: bytes, expected_revision: str
    ) -> None:
        temporary_path: Path | None = None
        try:
            original_mode = stat.S_IMODE(target.stat().st_mode)
            with tempfile.NamedTemporaryFile(
                mode="wb",
                dir=target.parent,
                prefix=f".{target.name}.",
                suffix=".tmp",
                delete=False,
            ) as temporary:
                temporary_path = Path(temporary.name)
                temporary.write(new_data)
                temporary.flush()
                os.fsync(temporary.fileno())

            os.chmod(temporary_path, original_mode)

            # Uma segunda leitura reduz a janela entre a verificação otimista e
            # a troca atômica. A trava também serializa todas as gravações deste
            # processo.
            try:
                current_revision = _sha256(target.read_bytes())
            except OSError as exc:
                raise EditorError(
                    409,
                    "revision_conflict",
                    "O arquivo mudou durante a gravação; recarregue a página.",
                ) from exc
            if current_revision != expected_revision:
                raise EditorError(
                    409,
                    "revision_conflict",
                    "O arquivo foi alterado; recarregue antes de salvar novamente.",
                )

            os.replace(temporary_path, target)
            temporary_path = None

            if hasattr(os, "O_DIRECTORY"):
                try:
                    directory_fd = os.open(target.parent, os.O_RDONLY | os.O_DIRECTORY)
                    try:
                        os.fsync(directory_fd)
                    finally:
                        os.close(directory_fd)
                except OSError:
                    # A troca já ocorreu atomicamente. Alguns sistemas de
                    # arquivos não aceitam fsync no diretório.
                    pass
        except EditorError:
            raise
        except OSError as exc:
            raise EditorError(
                500, "write_failed", "Não foi possível gravar o arquivo HTML."
            ) from exc
        finally:
            if temporary_path is not None:
                try:
                    temporary_path.unlink(missing_ok=True)
                except OSError:
                    pass

    def save_document(
        self, requested_path: str, pre_text: str, expected_revision: str
    ) -> SaveResult:
        if not isinstance(pre_text, str):
            raise EditorError(400, "invalid_request", "O campo preText deve ser texto.")
        if not isinstance(expected_revision, str) or not REVISION_RE.fullmatch(
            expected_revision
        ):
            raise EditorError(
                400,
                "invalid_request",
                "O campo expectedRevision deve ser uma revisão SHA-256 válida.",
            )

        with self._write_lock:
            loaded = self._load(requested_path)
            expected_revision = expected_revision.lower()
            if loaded.revision != expected_revision:
                raise EditorError(
                    409,
                    "revision_conflict",
                    "O arquivo foi alterado; recarregue antes de salvar novamente.",
                )

            escaped_pre = html.escape(pre_text, quote=False)
            new_source = (
                loaded.source[: loaded.pre_start]
                + escaped_pre
                + loaded.source[loaded.pre_end :]
            )
            new_data = new_source.encode("utf-8")
            new_revision = _sha256(new_data)
            if new_revision != loaded.revision:
                self._atomic_replace(loaded.target, new_data, loaded.revision)
            return SaveResult(revision=new_revision)


def _error_response(error: EditorError) -> ApiResponse:
    return ApiResponse(
        error.status,
        {
            "ok": False,
            "error": {"code": error.code, "message": error.message},
        },
    )


class EditorAPI:
    """Roteamento da API em uma forma testável sem abrir sockets."""

    def __init__(self, service: EditorService) -> None:
        self.service = service

    def get(self, request_target: str) -> ApiResponse | None:
        parsed = urlsplit(request_target)
        if parsed.path == HEALTH_ENDPOINT:
            if parsed.query:
                return _error_response(
                    EditorError(400, "invalid_request", "O endpoint health não aceita parâmetros.")
                )
            return ApiResponse(200, {"ok": True})

        if parsed.path == DOCUMENT_ENDPOINT:
            query = parse_qs(parsed.query, keep_blank_values=True)
            if set(query) != {"path"} or len(query["path"]) != 1:
                return _error_response(
                    EditorError(400, "invalid_request", "Informe um único parâmetro path.")
                )
            try:
                document = self.service.load_document(query["path"][0])
            except EditorError as error:
                return _error_response(error)
            return ApiResponse(
                200,
                {
                    "ok": True,
                    "path": document.path,
                    "preText": document.pre_text,
                    "revision": document.revision,
                },
            )

        if parsed.path.startswith(API_PREFIX):
            return _error_response(
                EditorError(404, "endpoint_not_found", "Endpoint da API não encontrado.")
            )
        return None

    def post(self, request_target: str, payload: Any) -> ApiResponse:
        parsed = urlsplit(request_target)
        if parsed.path != SAVE_ENDPOINT or parsed.query:
            return _error_response(
                EditorError(404, "endpoint_not_found", "Endpoint da API não encontrado.")
            )
        if not isinstance(payload, dict):
            return _error_response(
                EditorError(400, "invalid_request", "O corpo JSON deve ser um objeto.")
            )

        required = ("path", "preText", "expectedRevision")
        if any(field not in payload for field in required):
            return _error_response(
                EditorError(
                    400,
                    "invalid_request",
                    "Os campos path, preText e expectedRevision são obrigatórios.",
                )
            )
        try:
            result = self.service.save_document(
                payload["path"], payload["preText"], payload["expectedRevision"]
            )
        except EditorError as error:
            return _error_response(error)
        return ApiResponse(200, {"ok": True, "revision": result.revision})


def _allowed_host(host_header: str | None) -> bool:
    if not host_header:
        return False
    try:
        hostname = urlsplit(f"//{host_header}").hostname
    except ValueError:
        return False
    return hostname in {LOOPBACK_HOST, "localhost"}


def make_handler(
    root: str | os.PathLike[str],
) -> type[SimpleHTTPRequestHandler]:
    resolved_root = Path(root).resolve(strict=True)
    service = EditorService(resolved_root)
    api = EditorAPI(service)

    class ChordEditorRequestHandler(SimpleHTTPRequestHandler):
        server_version = "ChordEditor/1.0"
        sys_version = ""

        def __init__(self, *args: Any, **kwargs: Any) -> None:
            super().__init__(*args, directory=str(resolved_root), **kwargs)

        def _send_api(self, response: ApiResponse, *, include_body: bool = True) -> None:
            encoded = json.dumps(
                response.body, ensure_ascii=False, separators=(",", ":")
            ).encode("utf-8")
            self.send_response(response.status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(encoded)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.end_headers()
            if include_body:
                self.wfile.write(encoded)

        def _reject_nonlocal_host(self) -> bool:
            if _allowed_host(self.headers.get("Host")):
                return False
            self._send_api(
                _error_response(
                    EditorError(
                        403,
                        "host_forbidden",
                        "Abra o editor por http://127.0.0.1 para usar este servidor.",
                    )
                )
            )
            return True

        def do_GET(self) -> None:
            if self._reject_nonlocal_host():
                return
            response = api.get(self.path)
            if response is None:
                super().do_GET()
                return
            self._send_api(response)

        def do_HEAD(self) -> None:
            if self._reject_nonlocal_host():
                return
            response = api.get(self.path)
            if response is None:
                super().do_HEAD()
                return
            self._send_api(response, include_body=False)

        def _read_json(self) -> Any:
            if self.headers.get("Transfer-Encoding"):
                raise EditorError(
                    400,
                    "invalid_request",
                    "Transfer-Encoding não é aceito neste endpoint.",
                )
            if self.headers.get_content_type() != "application/json":
                raise EditorError(
                    415,
                    "unsupported_media_type",
                    "Envie o corpo com Content-Type: application/json.",
                )

            raw_length = self.headers.get("Content-Length")
            try:
                content_length = int(raw_length) if raw_length is not None else -1
            except ValueError as exc:
                raise EditorError(
                    400, "invalid_request", "Content-Length inválido."
                ) from exc
            if content_length < 0:
                raise EditorError(
                    411, "length_required", "O cabeçalho Content-Length é obrigatório."
                )
            if content_length > MAX_REQUEST_BYTES:
                raise EditorError(
                    413,
                    "request_too_large",
                    "O conteúdo enviado ultrapassa o limite de 4 MiB.",
                )

            raw_body = self.rfile.read(content_length)
            if len(raw_body) != content_length:
                raise EditorError(400, "invalid_request", "O corpo da requisição está incompleto.")
            try:
                return json.loads(raw_body.decode("utf-8"))
            except (UnicodeDecodeError, json.JSONDecodeError) as exc:
                raise EditorError(400, "invalid_json", "O corpo não contém JSON UTF-8 válido.") from exc

        def do_POST(self) -> None:
            if self._reject_nonlocal_host():
                return
            parsed = urlsplit(self.path)
            if parsed.path != SAVE_ENDPOINT or parsed.query:
                self._send_api(api.post(self.path, {}))
                return
            try:
                payload = self._read_json()
            except EditorError as error:
                self._send_api(_error_response(error))
                return
            self._send_api(api.post(self.path, payload))

        def do_OPTIONS(self) -> None:
            # Não habilitar CORS impede páginas de outras origens de gravarem
            # arquivos por meio do servidor local.
            self._send_api(
                _error_response(
                    EditorError(405, "method_not_allowed", "Método HTTP não permitido.")
                )
            )

    return ChordEditorRequestHandler


def create_server(
    root: str | os.PathLike[str], port: int = DEFAULT_PORT
) -> ThreadingHTTPServer:
    """Cria o servidor sempre vinculado exclusivamente ao IPv4 de loopback."""

    if not 0 <= port <= 65535:
        raise ValueError("A porta deve estar entre 0 e 65535.")
    server = ThreadingHTTPServer((LOOPBACK_HOST, port), make_handler(root))
    server.daemon_threads = True
    return server


def _cli_port(value: str) -> int:
    try:
        port = int(value)
    except ValueError as exc:
        raise argparse.ArgumentTypeError("a porta precisa ser um número") from exc
    if not 1 <= port <= 65535:
        raise argparse.ArgumentTypeError("a porta precisa estar entre 1 e 65535")
    return port


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Serve e salva cifras HTML localmente.")
    parser.add_argument(
        "--root",
        type=Path,
        default=Path(__file__).resolve().parent,
        help="diretório raiz servido (padrão: diretório deste script)",
    )
    parser.add_argument(
        "--port",
        type=_cli_port,
        default=DEFAULT_PORT,
        help=f"porta HTTP local (padrão: {DEFAULT_PORT})",
    )
    args = parser.parse_args(argv)
    repository_root = args.root.expanduser().resolve()

    try:
        server = create_server(repository_root, args.port)
    except OSError as exc:
        print(f"Não foi possível iniciar o servidor: {exc}", file=sys.stderr)
        return 1

    print(f"Editor local disponível em http://{LOOPBACK_HOST}:{args.port}/2026_08_02/")
    print("Pressione Ctrl+C para encerrar.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor encerrado.")
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
