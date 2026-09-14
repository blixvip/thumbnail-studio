import io
import tempfile
import unittest
from pathlib import Path
from PIL import Image
from thumbnail_library.importer import extract_images, store_image, validate_url


class LibraryTests(unittest.TestCase):
    def test_extracts_originals_lazy_images_and_backgrounds(self):
        html = '''<img src="/photo.jpg" srcset="/photo-p-500.jpg 500w, /photo.jpg 1280w" alt="Example">
          <img data-src="/lazy.webp"><div style="background-image:url('/background.png')"></div>
          <picture><source srcset="/another.webp 1x, /another-large.webp 2x"></picture>'''
        items = extract_images(html, 'https://example.com/work')
        urls = {item['url'] for item in items}
        self.assertEqual(urls, {'https://example.com/photo.jpg', 'https://example.com/lazy.webp',
                               'https://example.com/background.png', 'https://example.com/another-large.webp'})

    def test_rejects_private_addresses_and_non_https(self):
        for url in ['file:///etc/passwd', 'http://example.com/a', 'https://127.0.0.1/a',
                    'https://[::1]/a', 'https://169.254.169.254/', 'https://user:pass@example.com/a',
                    'https://example.com:444/a']:
            with self.subTest(url=url), self.assertRaises(ValueError):
                validate_url(url, resolve=False)

    def test_does_not_import_video_sources_as_photos(self):
        html = '<video><source src="/movie.mp4"><source src="/movie.webm"></video><img src="/still.jpg">'
        self.assertEqual(extract_images(html, 'https://example.com/'),
                         [{'url': 'https://example.com/still.jpg', 'alt': ''}])

    def test_store_deduplicates_bytes_but_preserves_sources(self):
        buffer = io.BytesIO()
        Image.new('RGB', (1280, 720), 'red').save(buffer, format='PNG')
        with tempfile.TemporaryDirectory() as folder:
            manifest = {'images': []}
            first = store_image(buffer.getvalue(), {'url':'https://a.com/one.png','alt':'First'},
                                {'name':'A','url':'https://a.com/'}, Path(folder), manifest)
            second = store_image(buffer.getvalue(), {'url':'https://b.com/two.png','alt':'Second'},
                                 {'name':'B','url':'https://b.com/'}, Path(folder), manifest)
            self.assertTrue(first)
            self.assertFalse(second)
            self.assertEqual(len(manifest['images']), 1)
            record = manifest['images'][0]
            self.assertEqual(len(record['sources']), 2)
            self.assertEqual(record['kind'], 'thumbnail')
            self.assertTrue((Path(folder) / record['file']).is_file())
            self.assertTrue((Path(folder) / record['preview']).is_file())

    def test_reimport_repairs_missing_media(self):
        buffer = io.BytesIO()
        Image.new('RGB', (1280, 720), 'blue').save(buffer, format='PNG')
        candidate = {'url': 'https://a.com/one.png'}
        source = {'name': 'A', 'url': 'https://a.com/'}
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            manifest = {'images': []}
            store_image(buffer.getvalue(), candidate, source, root, manifest)
            item = manifest['images'][0]
            (root / item['file']).unlink()
            (root / item['preview']).unlink()
            store_image(buffer.getvalue(), candidate, source, root, manifest)
            self.assertTrue((root / item['file']).exists())
            self.assertTrue((root / item['preview']).exists())

    def test_rejects_html_disguised_as_image(self):
        with tempfile.TemporaryDirectory() as folder, self.assertRaises(ValueError):
            store_image(b'<html>not an image</html>', {'url':'https://a.com/fake.png'},
                        {'name':'A','url':'https://a.com/'}, Path(folder), {'images': []})


if __name__ == '__main__':
    unittest.main()
