"""Local reference library with bounded, deduplicated, original-byte image caching.

Only catalog IDs are accepted by the API; there is no arbitrary URL proxy.
Run: python serve_references.py --port 4173
"""
import argparse
import hashlib
import io
import ipaddress
import json
import mimetypes
import re
import socket
import threading
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup
from PIL import Image, ImageChops, ImageStat

ROOT = Path(__file__).resolve().parent
CACHE = ROOT / '.gdweb-cache'
LOCKS = [threading.Lock() for _ in range(127)]
NETWORK = threading.BoundedSemaphore(6)
MIMES = {'JPEG': 'image/jpeg', 'PNG': 'image/png', 'WEBP': 'image/webp', 'GIF': 'image/gif', 'ICO': 'image/x-icon', 'SVG': 'image/svg+xml'}


def read_json(path, default=None):
    return json.loads(path.read_text(encoding='utf-8')) if path.exists() else default


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix('.' + uuid.uuid4().hex + '.tmp')
    temp.write_text(json.dumps(value, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    temp.replace(path)


def public_url(url):
    parsed = urlparse(url)
    if parsed.scheme not in ('https', 'http') or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError('Unsupported public URL')
    if parsed.port not in (None, 80, 443):
        raise ValueError('Unsupported port')
    for address in socket.getaddrinfo(parsed.hostname, parsed.port or 443, type=socket.SOCK_STREAM):
        if not ipaddress.ip_address(address[4][0]).is_global:
            raise ValueError('Private network addresses are not allowed')
    return url


def get_bytes(url, limit=12 * 1024 * 1024):
    with NETWORK:
        for _ in range(6):
            public_url(url)
            with requests.get(url, timeout=(6, 16), stream=True, allow_redirects=False,
                              headers={'User-Agent': 'Mozilla/5.0 (compatible; DesignReferenceLibrary/1.0)'}) as response:
                if response.is_redirect:
                    url = urljoin(url, response.headers['Location'])
                    continue
                response.raise_for_status()
                chunks, size = [], 0
                for chunk in response.iter_content(65536):
                    size += len(chunk)
                    if size > limit:
                        raise ValueError('Image exceeds cache size limit')
                    chunks.append(chunk)
                return b''.join(chunks), response.headers.get('Content-Type', ''), url
        raise ValueError('Too many redirects')


def image_info(data):
    # Some PNGs contain embedded SVG in XMP metadata. Binary image headers must
    # never be mistaken for the SVG text document stored inside that metadata.
    if data.lstrip(b'\xef\xbb\xbf \t\r\n').startswith(b'<') and b'<svg' in data[:1500].lower():
        # SVG is served only as an image, with a restrictive response CSP.
        text = data.decode('utf-8', errors='replace')
        view = re.search(r'viewBox=["\']\s*([\d.\s,-]+)', text)
        values = re.findall(r'[\d.]+', view.group(1)) if view else []
        return {'format': 'SVG', 'width': round(float(values[2])) if len(values) == 4 else 0,
                'height': round(float(values[3])) if len(values) == 4 else 0}
    with Image.open(io.BytesIO(data)) as im:
        if im.format not in MIMES:
            raise ValueError('Unsupported image format')
        return {'format': im.format, 'width': im.width, 'height': im.height}


def cache_image(url, limit=12 * 1024 * 1024):
    key = hashlib.sha256(url.encode()).hexdigest()
    record = CACHE / 'urls' / (key + '.json')
    with LOCKS[int(key[:8], 16) % len(LOCKS)]:
        known = read_json(record)
        if known and (CACHE / 'blobs' / known['sha256']).exists():
            return known
        data, _, final_url = get_bytes(url, limit)
        info = image_info(data)
        sha = hashlib.sha256(data).hexdigest()
        blob = CACHE / 'blobs' / sha
        blob.parent.mkdir(parents=True, exist_ok=True)
        if not blob.exists():
            temp = blob.with_suffix('.' + uuid.uuid4().hex + '.tmp')
            temp.write_bytes(data)
            temp.replace(blob)
        info.update({'sha256': sha, 'bytes': len(data), 'source_url': url, 'resolved_url': final_url,
                     'mime': MIMES[info['format']]})
        write_json(record, info)
        return info


def reference_preview(ident):
    saved = CACHE / 'previews' / (ident + '.json')
    existing = read_json(saved)
    if existing and (CACHE / 'blobs' / existing['sha256']).exists():
        return existing
    # GDWEB list thumbnails can be only 158px. Derive a crisp card from the real image.
    original = cache_image(f'https://www.gdweb.co.kr/sub/filedata.asp?str_no={ident}&sgbn=1', 50 * 1024 * 1024)
    with Image.open(CACHE / 'blobs' / original['sha256']) as im:
        preview = im.convert('RGB').crop((0, 0, im.width, min(im.height, round(im.width * .75))))
        preview.thumbnail((960, 720), Image.Resampling.LANCZOS)
        display = preview.copy()
        display.thumbnail((440, 330), Image.Resampling.LANCZOS)
        output = io.BytesIO()
        preview.save(output, 'WEBP', lossless=True, method=4)
        best = output.getvalue()
        for quality in (92, 96, 100):
            output = io.BytesIO()
            preview.save(output, 'WEBP', quality=quality, method=4)
            encoded = output.getvalue()
            with Image.open(io.BytesIO(encoded)) as check:
                check = check.convert('RGB').resize(display.size, Image.Resampling.LANCZOS)
                error = max(ImageStat.Stat(ImageChops.difference(check, display)).rms)
            if error <= 1.5 and len(encoded) < len(best):
                best = encoded
                break
    info = image_info(best)
    sha = hashlib.sha256(best).hexdigest()
    (CACHE / 'blobs' / sha).write_bytes(best)
    info.update({'sha256': sha, 'bytes': len(best), 'mime': 'image/webp', 'original_sha256': original['sha256']})
    write_json(saved, info)
    return info


def source_detail(row):
    ident = row['slug'].split('-')[-1]
    saved = CACHE / 'details' / (ident + '.json')
    existing = read_json(saved)
    if existing:
        return existing
    data, _, _ = get_bytes(row['gdweb_url'], 3 * 1024 * 1024)
    soup = BeautifulSoup(data.decode('utf-8'), 'html.parser')
    anchor = soup.select_one('.url a[href]')
    if not anchor or not anchor['href'].strip().startswith(('https://', 'http://')):
        raise ValueError('The source does not provide a live site URL')
    tags = []
    for tr in soup.select('tr'):
        heading, value = tr.select_one('th'), tr.select_one('td')
        if heading and value and heading.get_text(strip=True) in ('디자인 컨셉', '표현방법', '주색상'):
            tags.extend(t.strip() for t in re.split(r'[,/\n]', value.get_text(' ', strip=True)) if t.strip())
    result = {'page_url': anchor['href'].strip(), 'design_tags': tags,
              'detail_loaded': True, 'source_checked_at': datetime.now(timezone.utc).isoformat()}
    write_json(saved, result)
    return result


def collect_materials(row):
    """Read the actual featured site, validate each image, and retain its source URL."""
    ident = row['slug'].split('-')[-1]
    saved = CACHE / 'materials' / (ident + '.json')
    existing = read_json(saved)
    if existing:
        return existing
    detail = source_detail(row)
    result = {**detail, 'assets': [], 'materials_checked': True}
    try:
        data, _, page_url = get_bytes(detail['page_url'], 4 * 1024 * 1024)
        soup = BeautifulSoup(data, 'html.parser')
        candidates = []
        for tag in soup.select('link[href]'):
            rel = ' '.join(tag.get('rel', []))
            if 'icon' in rel:
                candidates.append(('appicon' if 'apple' in rel else 'favicon', urljoin(page_url, tag['href'])))
        for tag in soup.select('meta[property="og:image"],meta[name="twitter:image"]'):
            if tag.get('content'):
                candidates.append(('social', urljoin(page_url, tag['content'])))
        if not any(kind == 'favicon' for kind, _ in candidates):
            candidates.append(('favicon', urljoin(page_url, '/favicon.ico')))
        for tag in soup.select('img[src],img[data-src]'):
            src = tag.get('data-src') or tag.get('src', '')
            context = (src + ' ' + str(tag.get('class', '')) + ' ' + tag.get('alt', '')).lower()
            if re.search(r'captcha|pixel|tracking|spacer|blank|loading|spinner', context):
                continue
            kind = 'logo' if re.search(r'logo|brandmark|워드마크', context) else 'icon' if re.search(r'icon|ico[_-]|btn[_-]', context) else 'banner' if re.search(r'banner|visual|hero|slide|kv[_-]', context) else 'reference'
            if src and not src.startswith('data:'):
                candidates.append((kind, urljoin(page_url, src)))
        unique = {}
        for kind, url in candidates:
            if url.startswith(('https://', 'http://')):
                unique.setdefault(url, kind)
        # Material lists remain useful rather than collecting every product/catalog photo.
        ordered = sorted(unique.items(), key=lambda x: ['favicon','appicon','social','logo','banner','icon','reference'].index(x[1]))[:18]
        for url, kind in ordered:
            try:
                info = cache_image(url)
                if kind in ('reference', 'banner') and (info['width'] < 160 or info['height'] < 80):
                    continue
                if any(a['sha256'] == info['sha256'] for a in result['assets']):
                    continue
                result['assets'].append({**info, 'type': kind, 'path': f'/api/gdweb/{ident}/asset/{len(result["assets"])}',
                                         'source_pages': [page_url], 'variant': 'shared',
                                         'captured_at': datetime.now(timezone.utc).isoformat()})
            except (requests.RequestException, ValueError, OSError):
                continue
        result['page_url'] = page_url
    except (requests.RequestException, ValueError, OSError) as exc:
        result['material_error'] = str(exc)[:240]
    write_json(saved, result)
    return result


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, fmt, *args):
        if args and str(args[0]).startswith('GET /api/'):
            return
        super().log_message(fmt, *args)

    def do_HEAD(self):
        if urlparse(self.path).path.startswith('/api/gdweb/'):
            self.head_only = True
            return self.do_GET()
        return super().do_HEAD()

    def do_GET(self):
        path = urlparse(self.path).path
        if path == '/api/gdweb/cache':
            records = []
            for cached in (CACHE / 'materials').glob('*.json'):
                records.append({'slug': 'gdweb-' + cached.stem, **read_json(cached, {})})
            content = json.dumps(records, ensure_ascii=False).encode()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(content)))
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            if not getattr(self, 'head_only', False):
                self.wfile.write(content)
            return
        if not path.startswith('/api/gdweb/'):
            if path.startswith('/.gdweb-cache/'):
                self.send_error(404)
                return
            return super().do_GET()
        match = re.fullmatch(r'/api/gdweb/(\d+)/(thumbnail|original|detail|materials|asset/\d+)', path)
        if not match:
            self.send_error(404)
            return
        ident, action = match.groups()
        row = self.server.catalog.get('gdweb-' + ident)
        if not row:
            self.send_error(404)
            return
        try:
            if action in ('detail', 'materials'):
                result = source_detail(row) if action == 'detail' else collect_materials(row)
                content = json.dumps(result, ensure_ascii=False).encode()
                mime, etag = 'application/json; charset=utf-8', None
            else:
                if action.startswith('asset/'):
                    assets = read_json(CACHE / 'materials' / (ident + '.json'), {}).get('assets', [])
                    index = int(action.split('/')[1])
                    if index >= len(assets):
                        self.send_error(404)
                        return
                    info = assets[index]
                elif action == 'thumbnail':
                    info = reference_preview(ident)
                else:
                    info = cache_image(f'https://www.gdweb.co.kr/sub/filedata.asp?str_no={ident}&sgbn=1', 50 * 1024 * 1024)
                etag = '"' + info['sha256'] + '"'
                if self.headers.get('If-None-Match') == etag:
                    self.send_response(304)
                    self.end_headers()
                    return
                content = (CACHE / 'blobs' / info['sha256']).read_bytes()
                mime = info['mime']
            self.send_response(200)
            self.send_header('Content-Type', mime)
            self.send_header('Content-Length', str(len(content)))
            self.send_header('Cache-Control', 'public, max-age=604800' if etag else 'no-cache')
            self.send_header('X-Content-Type-Options', 'nosniff')
            self.send_header('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox")
            if etag:
                self.send_header('ETag', etag)
                self.send_header('X-Image-Width', str(info['width']))
                self.send_header('X-Image-Height', str(info['height']))
            self.end_headers()
            if not getattr(self, 'head_only', False):
                self.wfile.write(content)
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            pass
        except Exception as exc:
            self.send_error(502, 'The source image or website is temporarily unavailable')
            print(f'GDWEB {ident} {action}: {type(exc).__name__}', flush=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=4173)
    args = parser.parse_args()
    server = ThreadingHTTPServer(('127.0.0.1', args.port), Handler)
    server.catalog = {r['slug']: r for r in read_json(ROOT / 'gdweb.json', [])}
    print(f'http://127.0.0.1:{args.port}/?collection=gdweb&view=brands - {len(server.catalog)} sites', flush=True)
    server.serve_forever()


if __name__ == '__main__':
    main()
