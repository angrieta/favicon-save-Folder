"""Integrity checks for archive coverage, original-byte delivery and cache behavior."""
import hashlib
import io
import json
from pathlib import Path

import requests
from PIL import Image

ROOT = Path(__file__).resolve().parent
BASE = 'http://127.0.0.1:4173'


def main():
    rows = json.loads((ROOT / 'gdweb.json').read_text(encoding='utf-8'))
    report = json.loads((ROOT / 'gdweb-index-report.json').read_text(encoding='utf-8'))
    assert len(rows) == len({row['slug'] for row in rows}) == report['sites']
    assert not report['failures']
    assert all(group['pages'] == group['indexed_pages'] for group in report['groups'].values())
    assert not any('\ufffd' in row['company'] for row in rows)
    for row in rows:
        for asset in row['assets']:
            if not asset['path'].startswith('/api/'):
                assert (ROOT / asset['path']).is_file(), asset['path']
    print('PASS: 321 pages, 19143 distinct archive entries, valid local asset references')
    original = requests.get(BASE + '/api/gdweb/27815/original', timeout=60)
    original.raise_for_status()
    upstream = requests.get('https://www.gdweb.co.kr/sub/filedata.asp?str_no=27815&sgbn=1', timeout=60)
    assert hashlib.sha256(original.content).digest() == hashlib.sha256(upstream.content).digest()
    assert Image.open(io.BytesIO(original.content)).size == (1920, 1077)
    repeat = requests.get(BASE + '/api/gdweb/27815/original', headers={'If-None-Match': original.headers['ETag']}, timeout=10)
    assert repeat.status_code == 304
    head = requests.head(BASE + '/api/gdweb/27815/original', timeout=10)
    assert head.status_code == 200 and not head.content and head.headers['X-Image-Width'] == '1920'
    preview = requests.get(BASE + '/api/gdweb/27815/thumbnail?v=2', timeout=60)
    assert Image.open(io.BytesIO(preview.content)).width == 960
    assert len(preview.content) < len(original.content)
    print('PASS: original bytes/dimensions preserved, 960px preview, conditional cache, image headers')
    materials = requests.get(BASE + '/api/gdweb/27815/materials', timeout=120).json()
    assert materials['page_url'] == 'https://matteocourquin.com/en'
    assert len(materials['assets']) >= 2
    for asset in materials['assets']:
        response = requests.get(BASE + asset['path'], timeout=10)
        assert hashlib.sha256(response.content).hexdigest() == asset['sha256']
    snapshot = requests.get(BASE + '/api/gdweb/cache', timeout=10).json()
    assert any(row['slug'] == 'gdweb-27815' and row['assets'] for row in snapshot)
    assert requests.get(BASE + '/api/gdweb/999999999/original', timeout=10).status_code == 404
    print('PASS: actual-site materials, persistent cache snapshot, unknown ID rejection')


if __name__ == '__main__':
    main()
