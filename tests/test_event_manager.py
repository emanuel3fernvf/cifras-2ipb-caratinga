from __future__ import annotations

import json
import shutil
import tempfile
import unittest
from pathlib import Path
from unittest import mock

import event_manager
import local_editor_server as server


ROOT = Path(__file__).resolve().parents[1]


class EventManagerTests(unittest.TestCase):
    def setUp(self) -> None:
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        shutil.copytree(ROOT / "_referencia_evento", self.root / "_referencia_evento")
        (self.root / "catalogo.json").write_text('{"folders": []}\n', encoding="utf-8")

    def test_create_named_and_dated_events_from_reference(self) -> None:
        named = event_manager.create_event(self.root, {"mode": "name", "name": "Culto de Ação de Graças"})
        dated = event_manager.create_event(self.root, {"mode": "date", "date": "2027-01-09"})
        self.assertEqual(named["name"], "culto-de-acao-de-gracas")
        self.assertEqual(dated["name"], "2027_01_09")
        self.assertIn("Culto de Ação de Graças", (self.root / named["path"]).read_text(encoding="utf-8"))
        self.assertIn("09/01/2027", (self.root / dated["path"]).read_text(encoding="utf-8"))
        self.assertTrue((self.root / named["name"] / "index.js").is_file())
        with self.assertRaises(event_manager.ManagerError):
            event_manager.create_event(self.root, {"mode": "name", "name": "x" * 31})

    def test_song_capos_and_trash_flow(self) -> None:
        event = event_manager.create_event(self.root, {"mode": "name", "name": "Evento Teste"})
        song = event_manager.create_song(self.root, {"folder": event["name"], "title": "Canção Ágil", "artist": "Artista"})
        page = self.root / event["name"] / song["filename"]
        self.assertIn('<pre>Canção Ágil — Artista', page.read_text(encoding="utf-8"))
        event_manager.add_capo(self.root, {"folder": event["name"], "filename": song["filename"], "fret": 2})
        event_manager.add_capo(self.root, {"folder": event["name"], "filename": song["filename"], "fret": 4})
        listed = event_manager.list_events(self.root)[0]["songs"][0]
        self.assertEqual(listed["capos"], [2, 4])
        with self.assertRaises(event_manager.ManagerError):
            event_manager.add_capo(self.root, {"folder": event["name"], "filename": song["filename"], "fret": 4})
        event_manager.delete_capo(self.root, {"folder": event["name"], "filename": song["filename"], "fret": 2})
        event_manager.delete_song(self.root, {"folder": event["name"], "filename": song["filename"]})
        self.assertFalse(page.exists())
        self.assertTrue(any((self.root / "_lixeira").rglob(song["filename"])))
        event_manager.delete_event(self.root, {"folder": event["name"]})
        self.assertFalse((self.root / event["name"]).exists())
        catalog = json.loads((self.root / "catalogo.json").read_text(encoding="utf-8"))
        self.assertEqual(catalog["folders"], [])

    def test_create_and_update_song_with_youtube_and_rename(self) -> None:
        event = event_manager.create_event(self.root, {"mode": "name", "name": "Evento Teste"})
        song = event_manager.create_song(self.root, {
            "folder": event["name"], "title": "Canção", "artist": "Artista",
            "youtube": "https://youtu.be/dQw4w9WgXcQ",
        })
        event_manager.add_capo(self.root, {"folder": event["name"], "filename": song["filename"], "fret": 3})
        source = (self.root / event["name"] / song["filename"]).read_text(encoding="utf-8")
        self.assertIn('src="https://www.youtube.com/embed/dQw4w9WgXcQ"', source)

        updated = event_manager.update_song(self.root, {
            "folder": event["name"], "filename": song["filename"], "title": "Nova Canção",
            "artist": "Novo Artista", "youtube": "https://www.youtube.com/shorts/aqz-KE-bpKQ",
        })
        page = self.root / event["name"] / updated["filename"]
        self.assertFalse((self.root / event["name"] / song["filename"]).exists())
        self.assertIn("Nova Canção — Novo Artista", page.read_text(encoding="utf-8"))
        self.assertIn('src="https://www.youtube.com/embed/aqz-KE-bpKQ"', page.read_text(encoding="utf-8"))
        index = (self.root / event["name"] / "index.html").read_text(encoding="utf-8")
        self.assertIn("Nova%20Can%C3%A7%C3%A3o%20-%20Novo%20Artista.html?tr=-3", index)
        listed = event_manager.list_events(self.root)[0]["songs"][0]
        self.assertEqual(listed["youtube"], "https://www.youtube.com/watch?v=aqz-KE-bpKQ")

        event_manager.update_song(self.root, {
            "folder": event["name"], "filename": updated["filename"], "title": "Nova Canção",
            "artist": "Novo Artista", "youtube": "",
        })
        self.assertNotIn("sticky-top", page.read_text(encoding="utf-8"))

    def test_rejects_invalid_youtube_and_song_rename_collision(self) -> None:
        event = event_manager.create_event(self.root, {"mode": "name", "name": "Evento Teste"})
        first = event_manager.create_song(self.root, {"folder": event["name"], "title": "Uma", "artist": "Banda"})
        event_manager.create_song(self.root, {"folder": event["name"], "title": "Outra", "artist": "Banda"})
        with self.assertRaises(event_manager.ManagerError) as invalid:
            event_manager.update_song(self.root, {"folder": event["name"], "filename": first["filename"], "title": "Uma", "artist": "Banda", "youtube": "https://example.com/video"})
        self.assertEqual(invalid.exception.code, "invalid_youtube")
        with self.assertRaises(event_manager.ManagerError) as collision:
            event_manager.update_song(self.root, {"folder": event["name"], "filename": first["filename"], "title": "Outra", "artist": "Banda", "youtube": ""})
        self.assertEqual(collision.exception.code, "song_exists")

    def test_accepts_supported_youtube_url_formats(self) -> None:
        urls = (
            "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            "https://youtu.be/dQw4w9WgXcQ",
            "https://www.youtube.com/shorts/dQw4w9WgXcQ",
            "https://www.youtube.com/live/dQw4w9WgXcQ",
            "https://www.youtube.com/embed/dQw4w9WgXcQ",
        )
        for url in urls:
            with self.subTest(url=url):
                self.assertEqual(event_manager._youtube_embed_url(url), "https://www.youtube.com/embed/dQw4w9WgXcQ")

    def test_update_event_title_subtitle_and_folder(self) -> None:
        event = event_manager.create_event(self.root, {"mode": "date", "date": "2027-01-09"})
        updated = event_manager.update_event(self.root, {
            "folder": event["name"], "title": "Culto Especial", "subtitle": "Noite",
            "newFolder": "culto_especial-2027",
        })
        self.assertEqual(updated["name"], "culto_especial-2027")
        self.assertFalse((self.root / event["name"]).exists())
        source = (self.root / updated["name"] / "index.html").read_text(encoding="utf-8")
        self.assertIn("<h1>Culto Especial</h1>", source)
        self.assertIn("<p>Noite</p>", source)
        listed = event_manager.list_events(self.root)[0]
        self.assertEqual((listed["title"], listed["subtitle"]), ("Culto Especial", "Noite"))

    def test_song_and_event_updates_roll_back_when_catalog_fails(self) -> None:
        event = event_manager.create_event(self.root, {"mode": "name", "name": "Evento Teste"})
        song = event_manager.create_song(self.root, {"folder": event["name"], "title": "Canção", "artist": "Artista"})
        with mock.patch("event_manager.update_catalog", side_effect=OSError("falha")):
            with self.assertRaises(event_manager.ManagerError):
                event_manager.update_song(self.root, {"folder": event["name"], "filename": song["filename"], "title": "Nova", "artist": "Banda", "youtube": ""})
        self.assertTrue((self.root / event["name"] / song["filename"]).exists())
        self.assertFalse((self.root / event["name"] / "Nova - Banda.html").exists())

        with mock.patch("event_manager.update_catalog", side_effect=OSError("falha")):
            with self.assertRaises(event_manager.ManagerError):
                event_manager.update_event(self.root, {"folder": event["name"], "title": "Novo", "subtitle": "Teste", "newFolder": "novo-evento"})
        self.assertTrue((self.root / event["name"]).exists())
        self.assertFalse((self.root / "novo-evento").exists())

    def test_api_management_contract(self) -> None:
        api = server.EditorAPI(server.EditorService(self.root))
        created = api.post(server.EVENTS_ENDPOINT, {"mode": "name", "name": "API Local"})
        self.assertEqual(created.status, 201)
        updated = api.put(server.EVENTS_ENDPOINT, {"folder": "api-local", "title": "API Editada", "subtitle": "Teste", "newFolder": "api-editada"})
        self.assertEqual(updated.status, 200)
        deleted = api.delete(server.EVENTS_ENDPOINT, {"folder": "api-editada"})
        self.assertEqual(deleted.status, 200)

    def test_management_ui_is_guarded_by_local_hostname_and_health(self) -> None:
        source = (ROOT / "configuracoes.js").read_text(encoding="utf-8")
        markup = (ROOT / "configuracoes.html").read_text(encoding="utf-8")
        self.assertIn("location.hostname==='127.0.0.1'||location.hostname==='localhost'", source)
        self.assertIn("await jsonRequest('health')", source)
        self.assertIn("O servidor está desatualizado", source)
        self.assertIn("Array.isArray(event.songs)?event.songs:[]", source)
        self.assertIn("method:'PUT'", source)
        self.assertIn("Link do YouTube (opcional)", source)
        self.assertIn("Editar cifra", source)
        self.assertIn("Editar evento", source)
        self.assertIn('class="dropdown management-only" hidden', markup)
        self.assertNotIn("configuracoes.js", (ROOT / "catalogo.html").read_text(encoding="utf-8"))

    def test_editor_buttons_live_inside_movable_chord_palette(self) -> None:
        for folder in ("_referencia_evento", "2026_08_02", "2026_08_16", "2026_08_30"):
            with self.subTest(folder=folder):
                source = (ROOT / folder / "index.js").read_text(encoding="utf-8")
                styles = (ROOT / folder / "index.css").read_text(encoding="utf-8")
                self.assertIn("actions.className = 'chord-palette-actions'", source)
                self.assertIn("createLocalEditorToolbarButtons(actions)", source)
                self.assertNotIn("createLocalEditorToolbarButtons(row);", source)
                self.assertIn(".chord-palette-actions", styles)


if __name__ == "__main__":
    unittest.main()
