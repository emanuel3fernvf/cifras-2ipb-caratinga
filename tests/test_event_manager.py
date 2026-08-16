from __future__ import annotations

import json
import shutil
import tempfile
import unittest
from pathlib import Path

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

    def test_api_management_contract(self) -> None:
        api = server.EditorAPI(server.EditorService(self.root))
        created = api.post(server.EVENTS_ENDPOINT, {"mode": "name", "name": "API Local"})
        self.assertEqual(created.status, 201)
        deleted = api.delete(server.EVENTS_ENDPOINT, {"folder": "api-local"})
        self.assertEqual(deleted.status, 200)

    def test_management_ui_is_guarded_by_local_hostname_and_health(self) -> None:
        source = (ROOT / "configuracoes.js").read_text(encoding="utf-8")
        markup = (ROOT / "configuracoes.html").read_text(encoding="utf-8")
        self.assertIn("location.hostname==='127.0.0.1'||location.hostname==='localhost'", source)
        self.assertIn("await jsonRequest('health')", source)
        self.assertIn("songs:Array.isArray(event.songs)?event.songs:[]", source)
        self.assertIn('class="dropdown management-only" hidden', markup)
        self.assertNotIn("configuracoes.js", (ROOT / "catalogo.html").read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
