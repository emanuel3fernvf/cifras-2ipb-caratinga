from __future__ import annotations

import json
import unittest
from pathlib import Path

import gerar_catalogo


ROOT = Path(__file__).resolve().parents[1]


class CatalogTests(unittest.TestCase):
    def setUp(self) -> None:
        self.catalog = gerar_catalogo.build_catalog(ROOT)
        self.folders = self.catalog["folders"]

    def test_manifest_is_current_and_has_every_song_once(self) -> None:
        saved = json.loads((ROOT / "catalogo.json").read_text(encoding="utf-8"))
        self.assertEqual(saved, self.catalog)
        self.assertGreaterEqual(len(self.folders), 11)
        paths = [song["path"] for folder in self.folders for song in folder["songs"]]
        expected = [
            str(page.relative_to(ROOT))
            for index in ROOT.glob("*/index.html")
            if index.parent.name not in gerar_catalogo.IGNORED_DIRECTORIES
            for page in index.parent.glob("*.html")
            if page.name != "index.html"
        ]
        self.assertEqual(len(paths), len(set(paths)))
        self.assertEqual(set(paths), set(expected))
        self.assertTrue(all((ROOT / path).is_file() for path in paths))

    def test_folder_order_and_unlinked_songs(self) -> None:
        directories = [folder["directory"] for folder in self.folders]
        self.assertEqual(directories, sorted(directories, key=str.casefold, reverse=True))
        by_directory = {folder["directory"]: folder for folder in self.folders}
        expected_tails = {
            "2026_06_27": ["Hosana - folha"],
            "2026_08_16": ["130 - Projeto Sola", "Glória e Honra - Projeto Sola"],
            "musical_pascoa_UMP_2026": ["Autor da Vida - Aline Barros"],
        }
        for directory, titles in expected_tails.items():
            actual = [song["title"] for song in by_directory[directory]["songs"][-len(titles):]]
            self.assertEqual(actual, titles)

    def test_all_music_pages_load_home_navigation(self) -> None:
        scoped_pages = [
            page
            for index in ROOT.glob("*/index.html")
            if index.parent.name not in gerar_catalogo.IGNORED_DIRECTORIES
            for page in index.parent.glob("*.html")
        ]
        song_count = sum(len(folder["songs"]) for folder in self.folders)
        self.assertEqual(len(scoped_pages), len(self.folders) + song_count)
        for page in scoped_pages:
            with self.subTest(page=page.relative_to(ROOT)):
                source = page.read_text(encoding="utf-8")
                self.assertIn('src="index.js', source)

        scripts = [index.parent / "index.js" for index in ROOT.glob("*/index.html") if index.parent.name not in gerar_catalogo.IGNORED_DIRECTORIES]
        self.assertEqual(len(scripts), len(self.folders))
        for script in scripts:
            with self.subTest(script=script.relative_to(ROOT)):
                source = script.read_text(encoding="utf-8")
                self.assertIn("window.location.hostname === '127.0.0.1'", source)
                self.assertIn("window.location.hostname === 'localhost'", source)
                self.assertIn("'../configuracoes.html' : '../catalogo.html'", source)
                self.assertEqual(source.count("createHomeButton();"), 1)

    def test_full_editors_offer_find_and_replace(self) -> None:
        editor_scripts = [
            script for script in ROOT.glob("*/index.js")
            if "function openFullEditorModal" in script.read_text(encoding="utf-8")
        ]
        self.assertGreaterEqual(len(editor_scripts), 3)
        for script in editor_scripts:
            with self.subTest(script=script.relative_to(ROOT)):
                source = script.read_text(encoding="utf-8")
                self.assertIn("editor-find-replace", source)
                self.assertIn("Substituir todas as ocorrências", source)
                self.assertIn("event.key.toLowerCase() === 'f'", source)
                self.assertIn("scrollMatchIntoView", source)
                self.assertIn("Existem alterações não salvas", source)
                self.assertIn("editor-modal-close", source)


if __name__ == "__main__":
    unittest.main()
