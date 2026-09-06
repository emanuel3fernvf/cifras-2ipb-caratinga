"""Testes reais opcionais: CIFRACLUB_BROWSER_TESTS=1 python -m unittest discover -s tests."""
import io
import os
import unittest
from pathlib import Path

from extrator_cifraclub.extractor import recognize, calibration_image

ROOT = Path(__file__).resolve().parents[1]


@unittest.skipUnless(os.environ.get('CIFRACLUB_BROWSER_TESTS') == '1', 'requer Chromium e Tesseract instalados')
class BrowserTests(unittest.TestCase):
    def setUp(self):
        from playwright.sync_api import sync_playwright
        self.runtime = sync_playwright().start()
        self.addCleanup(self.runtime.stop)
        self.browser = self.runtime.chromium.launch()
        self.page = self.browser.new_page(device_scale_factor=2)
        self.addCleanup(self.browser.close)

    def test_real_pixels_global_alignment_across_stripes(self):
        lines = ['  C#m7       G/B', '  Canção de amor', '', '     F#       Bb',
                 'e|--0---2--|', 'B|--1---3--|', 'D|' + '-' * 38 + '|', 'A|' + '-' * 38 + '|']
        lines += [''] * 24
        lines += ['  Am         D7', '  Final da canção']
        expected = '\n'.join(lines)
        self.page.set_content('<pre style="font:24px/32px monospace;font-family:DejaVu Sans Mono,Liberation Mono,monospace;margin:0;padding:0;width:max-content"></pre>')
        self.page.locator('pre').evaluate('(el, text) => el.textContent = text', expected)
        pitch = self.page.evaluate("() => {let c=document.createElement('canvas').getContext('2d'); c.font='24px DejaVu Sans Mono, Liberation Mono, monospace'; return c.measureText('M').width*2;}")
        png = self.page.locator('pre').screenshot()
        actual, warnings = recognize(png, pitch, 64, calibration_image(self.page))
        self.assertEqual(actual, expected, repr(warnings))

    def mount(self):
        self.page.set_content('<div id="overlay"><header></header><textarea>Original</textarea><button id="save">Salvar</button><button id="close">Fechar</button><button id="cancel">Cancelar</button></div>')
        self.page.add_script_tag(path=str(ROOT / 'extrator_cifraclub/editor.js'))
        self.page.evaluate('''() => {
          window.events = 0;
          const ta = document.querySelector('textarea');
          ta.addEventListener('input', () => events++);
          const editor = {overlay:document.querySelector('#overlay'), header:document.querySelector('header'),
            primaryButton:document.querySelector('#save'), closeButton:document.querySelector('#close'),
            cancelButton:document.querySelector('#cancel')};
          window.mountCifraClubImport(editor, ta);
          window.fetch = () => new Promise(resolve => window.finishImport = resolve);
        }''')
        self.page.get_by_placeholder('Link do Cifra Club').fill('https://www.cifraclub.com.br/a/b/')
        self.page.get_by_role('button', name='Importar por imagem', exact=True).click()

    def finish(self, ok=True):
        self.page.evaluate('''ok => finishImport({ok, json:async () => ok ?
            {preText:'  C        G\\n  Letra', image:'data:image/png;base64,AA==', warnings:[], message:'Confira'} :
            {error:{message:'Falha de teste'}}})''', ok)
        self.page.wait_for_timeout(50)

    def test_import_undo_and_late_response(self):
        self.mount()
        self.assertTrue(self.page.locator('textarea').is_disabled())
        self.assertTrue(self.page.locator('#save').is_disabled())
        self.assertTrue(self.page.locator('#close').is_enabled())
        self.finish()
        self.assertEqual(self.page.locator('textarea').input_value(), '  C        G\n  Letra')
        self.assertTrue(self.page.locator('#save').is_enabled())
        self.page.get_by_role('button', name='Desfazer importação').click()
        self.assertEqual(self.page.locator('textarea').input_value(), 'Original')
        self.mount()
        self.page.evaluate("document.querySelector('#overlay').remove()")
        self.finish()
        self.assertEqual(self.page.evaluate('events'), 0)

    def test_failure_preserves_editor(self):
        self.mount()
        self.finish(False)
        self.assertEqual(self.page.locator('textarea').input_value(), 'Original')
        self.assertTrue(self.page.locator('#save').is_enabled())
        self.assertEqual(self.page.get_by_role('status').inner_text(), 'Falha de teste')
