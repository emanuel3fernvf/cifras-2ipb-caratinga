"""Contrato de importação e grade de caracteres, sem depender da rede."""
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from extrator_cifraclub.extractor import ImportFailure, reconstruct, validate_url, public_host
import local_editor_server as server


class ImportTests(unittest.TestCase):
    def test_url_and_private_addresses(self):
        for url in ('http://www.cifraclub.com.br/a/b/', 'https://localhost/a',
                    'https://www.cifraclub.com.br.evil.org/',
                    'https://u@www.cifraclub.com.br/', 'https://www.cifraclub.com.br:444/a'):
            with self.subTest(url=url), self.assertRaises(ImportFailure):
                validate_url(url)
        self.assertEqual(validate_url('https://www.cifraclub.com.br/a/b/'), 'https://www.cifraclub.com.br/a/b/')
        with patch('socket.getaddrinfo', return_value=[(2, 1, 6, '', ('127.0.0.1', 443))]):
            self.assertFalse(public_host('www.cifraclub.com.br'))

    def test_global_columns_and_blank_rows(self):
        boxes = 'C 22 85 28 95 0\n# 32 85 38 95 0\nG 122 85 128 95 0\ná 2 45 8 55 0'
        rows, uncertain = reconstruct(boxes, 200, 100, 10, 20)
        self.assertEqual(rows, {0: {2:'C', 3:'#', 12:'G'}, 2:{0:'á'}})
        self.assertFalse(uncertain)
        later, _ = reconstruct('F 22 5 28 15 0', 200, 20, 10, 20, row_offset=32)
        self.assertEqual(later, {32:{2:'F'}})

    def test_collision_does_not_shift_later_chord(self):
        rows, uncertain = reconstruct('A 2 5 8 15 0\nB 3 5 9 15 0\nG 42 5 48 15 0', 100, 20, 10, 20)
        self.assertTrue(uncertain)
        self.assertEqual(rows[0], {0:'�', 4:'G'})

    def test_api_import_does_not_save_and_save_roundtrip_keeps_spaces(self):
        with tempfile.TemporaryDirectory() as directory:
            page = Path(directory) / 'song.html'
            page.write_text('<pre>Original</pre>')
            service = server.EditorService(directory)
            api = server.EditorAPI(service)
            text = '  C#m7       G/B\n  Canção de amor\n\ne|--0---2--|'
            result = {'preText':text, 'image':'data:image/png;base64,AA==', 'warnings':[]}
            with patch('extrator_cifraclub.extractor.import_cifra', return_value=result):
                response = api.post(server.IMPORT_ENDPOINT, {'url':'https://www.cifraclub.com.br/a/b/'})
            self.assertEqual(response.status, 200)
            self.assertEqual(page.read_text(), '<pre>Original</pre>')
            document = service.load_document('song.html')
            response = api.post(server.SAVE_ENDPOINT, {'path':'song.html', 'preText':text, 'expectedRevision':document.revision})
            self.assertEqual(response.status, 200)
            self.assertEqual(service.load_document('song.html').pre_text, text)

    def test_api_errors(self):
        with tempfile.TemporaryDirectory() as directory:
            api = server.EditorAPI(server.EditorService(directory))
            self.assertEqual(api.post(server.IMPORT_ENDPOINT, {}).status, 400)
            for code, status in [('missing_dependencies', 503), ('capture_timeout', 504), ('import_failed', 422)]:
                with patch('extrator_cifraclub.extractor.import_cifra', side_effect=ImportFailure('teste', code, status)):
                    response = api.post(server.IMPORT_ENDPOINT, {'url':'https://www.cifraclub.com.br/a/b/'})
                self.assertEqual(response.status, status)
                self.assertEqual(response.body['error']['code'], code)


if __name__ == '__main__':
    unittest.main()
