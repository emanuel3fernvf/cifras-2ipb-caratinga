from __future__ import annotations

import json
import re
import unittest
from pathlib import Path
from urllib.parse import urlsplit

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
                self.assertIn('src="../assets/index.js?v=', source)
                self.assertIn('href="../assets/index.css?v=', source)
                self.assertIn("v=20261118-3", source)
                self.assertNotRegex(source, r"""(?:src|href)=["']index\.(?:js|css)""")
                self.assertFalse((page.parent / "index.js").exists())
                self.assertFalse((page.parent / "index.css").exists())
                asset_urls = re.findall(r"""(?:src|href)=["']([^"']*assets/[^"']+)["']""", source)
                for asset_url in asset_urls:
                    asset_path = (page.parent / urlsplit(asset_url).path).resolve()
                    self.assertTrue(asset_path.is_file(), f"{page}: {asset_url}")

        scripts = sorted((ROOT / "assets").glob("index-variant-*.js"))
        self.assertGreaterEqual(len(scripts), 1)
        for script in scripts:
            with self.subTest(script=script.name):
                source = script.read_text(encoding="utf-8")
                self.assertIn("window.location.hostname === '127.0.0.1'", source)
                self.assertIn("window.location.hostname === 'localhost'", source)
                self.assertIn("'../configuracoes.html' : '../catalogo.html'", source)
                self.assertEqual(source.count("createHomeButton();"), 1)

    def test_indexes_have_shared_export_and_conditional_review_markup(self) -> None:
        for folder in self.folders:
            page = ROOT / folder["directory"] / "index.html"
            source = page.read_text(encoding="utf-8")
            with self.subTest(folder=folder["directory"]):
                self.assertIn('href="../assets/index-layout-', source)
                self.assertIn('class="index-actions"', source)
                self.assertIn('id="holyrics-export-btn"', source)
                self.assertIn('id="holyrics-review-modal"', source)
                self.assertIn('src="../assets/index.js?v=', source)
                inline_styles = re.findall(r"""<style\b[^>]*>(.*?)</style\s*>""", source, re.I | re.S)
                if folder["directory"] == "2026_09_20":
                    self.assertEqual(len(inline_styles), 1)
                    self.assertRegex(inline_styles[0], r"""\.service-item|\.hymn-item|\.section-title""")
                    self.assertNotRegex(inline_styles[0], r"""\.holyrics-|holyrics-review""")
                else:
                    self.assertEqual(inline_styles, [])

    def test_reading_controls_are_shared_by_song_pages_only(self) -> None:
        loader = (ROOT / "assets" / "index.js").read_text(encoding="utf-8")
        controls = (ROOT / "assets" / "reading-controls.js").read_text(encoding="utf-8")
        shared_styles = (ROOT / "assets" / "index.css").read_text(encoding="utf-8")
        musical_variant = (ROOT / "assets" / "index-variant-9.js").read_text(encoding="utf-8")

        self.assertIn("loadScript('pad.js', function () {", loader)
        self.assertIn("if (!isIndex) loadScript('reading-controls.js');", loader)
        self.assertIn("event.key === 'ArrowDown'", controls)
        self.assertIn("event.key !== 'ArrowUp'", controls)
        self.assertIn("event.key === 'Escape'", controls)
        self.assertIn("var minFontSizePercent = 75;", controls)
        self.assertIn("var maxFontSizePercent = 200;", controls)
        self.assertIn("var fontSizeStep = 5;", controls)
        self.assertIn("window.localStorage.setItem(fontSizeStorageKey", controls)
        self.assertIn(".strophe.is-keyboard-selected", shared_styles)
        self.assertNotIn("handleStropheNavigationKeyDown", musical_variant)
        self.assertNotIn("createFontSizeControls", musical_variant)

    def test_full_editors_offer_find_and_replace(self) -> None:
        editor_scripts = [
            script for script in (ROOT / "assets").glob("index-variant-*.js")
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
