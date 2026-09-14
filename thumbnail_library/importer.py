"""Import raster images from explicitly configured public portfolio pages."""
import hashlib
import http.client
import io
import ipaddress
import json
import re
import socket
import ssl
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from html import unescape
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlsplit, urlunsplit

from PIL import Image, UnidentifiedImageError

MAX_BYTES = 25 * 1024 * 1024
Image.MAX_IMAGE_PIXELS = 40_000_000
FORMATS = {'JPEG': '.jpg', 'PNG': '.png', 'WEBP': '.webp', 'GIF': '.gif', 'AVIF': '.avif'}


def validate_url(url, resolve=True):
    parsed = urlsplit(url)
    if (parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.password
            or parsed.port not in (None, 443)):
        raise ValueError('Only public HTTPS URLs on port 443 are supported.')
    host = parsed.hostname
    try:
        literal = ipaddress.ip_address(host)
    except ValueError:
        literal = None
    if host.lower() == 'localhost' or (literal and not literal.is_global):
        raise ValueError('Private network addresses are not supported.')
    if resolve:
        addresses = socket.getaddrinfo(host, 443, type=socket.SOCK_STREAM)
        if not addresses or any(not ipaddress.ip_address(item[4][0]).is_global for item in addresses):
            raise ValueError('Private network addresses are not supported.')
        return addresses[0][4][0]
    return host


def fetch_bytes(url, limit=MAX_BYTES):
    # Pin each connection to the validated IP, preserving TLS hostname verification.
    for _ in range(6):
        ip = validate_url(url)
        parsed = urlsplit(url)
        connection = http.client.HTTPSConnection(parsed.hostname, timeout=25, context=ssl.create_default_context())
        connection._create_connection = lambda address, timeout, source_address=None, **kwargs: socket.create_connection((ip, 443), timeout)
        try:
            path = urlunsplit(('', '', parsed.path or '/', parsed.query, ''))
            connection.request('GET', path, headers={'User-Agent': 'ThumbnailLibrary/0.1 (local portfolio collection)', 'Accept-Encoding': 'identity'})
            response = connection.getresponse()
            if response.status in (301, 302, 303, 307, 308):
                location = response.getheader('Location')
                if not location:
                    raise ValueError('Redirect has no destination.')
                url = urljoin(url, location)
                continue
            if response.status != 200:
                raise ValueError(f'HTTP {response.status}')
            if int(response.getheader('Content-Length') or 0) > limit:
                raise ValueError('File exceeds download size limit.')
            chunks, size = [], 0
            deadline = time.monotonic() + 45
            while True:
                chunk = response.read(min(65536, limit + 1 - size))
                if not chunk:
                    break
                size += len(chunk)
                if size > limit or time.monotonic() > deadline:
                    raise ValueError('Download exceeded size or time limit.')
                chunks.append(chunk)
            return b''.join(chunks)
        finally:
            connection.close()
    raise ValueError('Too many redirects.')


def best_srcset(value):
    choices = []
    for part in value.split(','):
        fields = part.strip().split()
        if fields:
            try:
                weight = float(fields[1][:-1]) if len(fields) > 1 else 1
            except ValueError:
                weight = 1
            choices.append((weight, fields[0]))
    return max(choices)[1] if choices else ''


def normalize_image_url(url, base):
    url = urljoin(base, unescape(url.strip()))
    parsed = urlsplit(url)
    if parsed.scheme != 'https' or not parsed.hostname:
        return None
    if parsed.path.lower().endswith(('.svg', '.ico', '.mp4', '.webm', '.mov', '.mp3', '.woff', '.woff2')):
        return None
    return urlunsplit((parsed.scheme, parsed.netloc, parsed.path, parsed.query, ''))


class ImageParser(HTMLParser):
    def __init__(self, base):
        super().__init__()
        self.base, self.images = base, {}

    def add(self, value, alt=''):
        url = normalize_image_url(value, self.base)
        if url:
            self.images[url] = {'url': url, 'alt': alt[:500]}

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag in ('img', 'source'):
            candidates = [attrs.get('data-src'), attrs.get('data-lazy-src')]
            responsive = attrs.get('data-srcset') or attrs.get('srcset')
            candidates.append(best_srcset(responsive) if responsive else attrs.get('src'))
            for candidate in filter(None, candidates):
                self.add(candidate, attrs.get('alt', ''))
        if tag == 'meta' and attrs.get('property') in ('og:image', 'twitter:image'):
            self.add(attrs.get('content', ''))
        for match in re.finditer(r'''url\(\s*['"]?([^'"\)]+)['"]?\s*\)''', attrs.get('style', '')):
            self.add(match.group(1))


def extract_images(html, base):
    parser = ImageParser(base)
    parser.feed(html)
    return list(parser.images.values())


def store_image(content, candidate, source, root, manifest):
    try:
        with Image.open(io.BytesIO(content)) as original:
            original.verify()
        with Image.open(io.BytesIO(content)) as original:
            width, height = original.size
            if width * height > Image.MAX_IMAGE_PIXELS:
                raise ValueError('Image exceeds pixel limit.')
            if original.format not in FORMATS or min(width, height) < 32:
                raise ValueError('Unsupported image or tiny tracking/icon asset.')
            extension = FORMATS[original.format]
            preview = original.convert('RGBA').convert('RGB')
            preview.thumbnail((640, 400))
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError, Image.DecompressionBombWarning) as error:
        raise ValueError('Invalid or oversized raster image.') from error
    digest = hashlib.sha256(content).hexdigest()
    origin = {'name': source['name'], 'page': source['url'], 'image': candidate['url']}
    existing = next((item for item in manifest['images'] if item['id'] == digest), None)
    if existing:
        if origin not in existing['sources']:
            existing['sources'].append(origin)
        original_file = root / existing['file']
        preview_file = root / existing['preview']
        original_file.parent.mkdir(parents=True, exist_ok=True)
        preview_file.parent.mkdir(parents=True, exist_ok=True)
        if not original_file.exists():
            original_file.write_bytes(content)
        if not preview_file.exists():
            preview.save(preview_file, 'JPEG', quality=85)
        return False
    original_path = Path('images') / (digest + extension)
    preview_path = Path('previews') / (digest + '.jpg')
    (root / original_path).parent.mkdir(parents=True, exist_ok=True)
    (root / preview_path).parent.mkdir(parents=True, exist_ok=True)
    (root / original_path).write_bytes(content)
    preview.save(root / preview_path, 'JPEG', quality=85)
    manifest['images'].append({
        'id': digest, 'file': original_path.as_posix(), 'preview': preview_path.as_posix(),
        'width': width, 'height': height, 'bytes': len(content), 'alt': candidate.get('alt', ''),
        'kind': 'thumbnail' if width >= 400 and 1.45 <= width / height <= 2.1 else 'other',
        'sources': [origin], 'importedAt': datetime.now(timezone.utc).isoformat(),
    })
    return True


def save_manifest(root, manifest):
    root.mkdir(parents=True, exist_ok=True)
    temporary = root / 'manifest.tmp'
    temporary.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
    temporary.replace(root / 'manifest.json')


def import_sources(project):
    root = project / 'data'
    sources = json.loads((project / 'sources.json').read_text(encoding='utf-8'))
    path = root / 'manifest.json'
    manifest = json.loads(path.read_text(encoding='utf-8')) if path.exists() else {'images': [], 'sources': []}
    reports = []
    for source in sources:
        print(f"Importing {source['name']}...", flush=True)
        report = {**source, 'discovered': 0, 'added': 0, 'existing': 0, 'skipped': 0, 'errors': [], 'checkedAt': datetime.now(timezone.utc).isoformat()}
        candidates = {}
        try:
            validate_url(source['url'])
            capture = root / 'captures' / (urlsplit(source['url']).hostname + '.json')
            html = None
            if capture.exists():
                data = json.loads(capture.read_text(encoding='utf-8'))
                if data['source']['url'] == source['url']:
                    html = data['html']
                    for candidate in data['images'] + extract_images(data['html'], source['url']):
                        url = normalize_image_url(candidate['url'], source['url'])
                        if url:
                            candidates[url] = {**candidate, 'url': url}
            if html is None:
                html = fetch_bytes(source['url'], 8 * 1024 * 1024).decode('utf-8', errors='replace')
            for candidate in extract_images(html, source['url']):
                candidates[candidate['url']] = candidate
        except Exception as error:
            report['errors'].append({'url': source['url'], 'reason': str(error)[:300]})
        # Collapse Webflow/Framer responsive size variants, retaining originals where discovered.
        grouped = {}
        for url, candidate in candidates.items():
            key = re.sub(r'-p-\d+(?=\.[a-z]+(?:\?|$))', '', url, flags=re.I)
            parsed = urlsplit(key)
            if parsed.hostname and 'framerusercontent.com' in parsed.hostname:
                key = urlunsplit((parsed.scheme, parsed.netloc, parsed.path, '', ''))
            old = grouped.get(key)
            if old is None or url == key:
                grouped[key] = candidate
        report['discovered'] = len(grouped)
        known = {origin['image'] for item in manifest['images']
                 if (root / item['file']).exists() and (root / item['preview']).exists()
                 for origin in item['sources'] if origin['page'] == source['url']}

        def download(candidate):
            if candidate['url'] in known:
                return candidate, None, None
            try:
                cache_key = hashlib.sha256(candidate['url'].encode()).hexdigest()
                cached = root / 'captures' / 'media' / (cache_key + '.bin')
                if cached.is_file() and cached.stat().st_size <= MAX_BYTES:
                    return candidate, cached.read_bytes(), None
                return candidate, fetch_bytes(candidate['url']), None
            except Exception as error:
                return candidate, None, str(error)[:300]

        with ThreadPoolExecutor(max_workers=4) as pool:
            for index, (candidate, content, error) in enumerate(pool.map(download, grouped.values())):
                if error:
                    report['errors'].append({'url': candidate['url'], 'reason': error})
                elif content is None:
                    report['existing'] += 1
                else:
                    try:
                        added = store_image(content, candidate, source, root, manifest)
                        report['added' if added else 'existing'] += 1
                    except ValueError as error:
                        report['skipped'] += 1
                        report['errors'].append({'url': candidate['url'], 'reason': str(error)})
                if index % 25 == 0:
                    save_manifest(root, manifest)
        reports.append(report)
        manifest['sources'] = reports
        save_manifest(root, manifest)
        print(f"  {report['discovered']} found; {report['added']} added; {report['existing']} existing; {len(report['errors'])} skipped/failed", flush=True)
    return manifest
