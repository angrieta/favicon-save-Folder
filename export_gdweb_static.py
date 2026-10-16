"""Export the reference catalog for GitHub Pages; no runtime image proxy required."""
import argparse
import hashlib
import io
import json
import shutil
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from PIL import Image
from serve_references import CACHE, ROOT, read_json, reference_preview, write_json


def export_blob(info, directory, stem=None, optimize=False):
    source = CACHE / 'blobs' / info['sha256']
    extension = {'JPEG': 'jpg', 'PNG': 'png', 'WEBP': 'webp', 'SVG': 'svg', 'GIF': 'gif', 'ICO': 'ico'}[info['format']]
    data = source.read_bytes()
    result = dict(info)
    if optimize and info['format'] == 'PNG':
        with Image.open(io.BytesIO(data)) as original:
            original = original.convert('RGBA')
            buffer = io.BytesIO()
            original.save(buffer, 'WEBP', lossless=True, exact=True, method=6)
            candidate = buffer.getvalue()
            with Image.open(io.BytesIO(candidate)) as check:
                assert original.tobytes() == check.convert('RGBA').tobytes()
            if len(candidate) < len(data):
                result['source_sha256'] = info['sha256']
                data, extension = candidate, 'webp'
                result.update(format='WEBP', sha256=hashlib.sha256(data).hexdigest(), bytes=len(data))
    path = Path(directory) / f'{stem or result["sha256"]}.{extension}'
    (ROOT / path).parent.mkdir(parents=True, exist_ok=True)
    (ROOT / path).write_bytes(data)
    result['path'] = path.as_posix()
    return result


def export(year):
    rows = read_json(ROOT / 'gdweb.json')
    requested = [r for r in rows if r.get('featured_date', '').startswith(year)
                 and any(a['path'].startswith('/api/') for a in r.get('assets', []))]
    failures = []
    with ThreadPoolExecutor(max_workers=4) as pool:
        futures = {pool.submit(reference_preview, row['slug'].split('-')[-1]): row['slug'] for row in requested}
        for count, future in enumerate(as_completed(futures), 1):
            try:
                future.result()
            except Exception as error:
                failures.append({'slug': futures[future], 'error': str(error)[:160]})
            if count % 25 == 0 or count == len(futures):
                print(f'Previews {count}/{len(futures)}, unavailable {len(failures)}', flush=True)

    previews = 0
    extra_assets = 0
    for row in rows:
        ident = row['slug'].split('-')[-1]
        detail = read_json(CACHE / 'details' / f'{ident}.json', {})
        if detail:
            row.update(detail)
        cached = read_json(CACHE / 'materials' / f'{ident}.json', {})
        if cached:
            row.update({k: v for k, v in cached.items() if k != 'assets'})
            known = {a.get('source_sha256') or a.get('sha256') for a in row['assets']}
            for asset in cached.get('assets', []):
                if asset['sha256'] not in known and (CACHE / 'blobs' / asset['sha256']).exists():
                    row['assets'].append(export_blob(asset, 'gdweb-extra', optimize=True))
                    extra_assets += 1
        row['static_archive'] = True
        for asset in row.get('assets', []):
            if not asset['path'].startswith('/api/'):
                continue
            asset['key'] = asset['path']  # Retain saved-board identities from the local archive.
            asset['path'] = asset['source_url']
            asset.pop('preview_path', None)
            preview = read_json(CACHE / 'previews' / f'{ident}.json')
            if preview and (CACHE / 'blobs' / preview['sha256']).exists():
                asset['preview_path'] = export_blob(preview, 'gdweb-previews', ident)['path']
                previews += 1
            url_key = hashlib.sha256(asset['source_url'].encode()).hexdigest()
            original = read_json(CACHE / 'urls' / f'{url_key}.json')
            if original:
                for key in ('width', 'height', 'format', 'bytes'):
                    asset[key] = original[key]
    write_json(ROOT / 'gdweb-static.json', rows)
    report = {'sites': len(rows), 'local_previews': previews, 'extra_assets': extra_assets,
              'preview_bytes': sum(p.stat().st_size for p in (ROOT / 'gdweb-previews').glob('*')),
              'preview_failures': failures,
              'original_policy': 'Existing collected assets are local. Indexed originals load unchanged from GDWEB on demand.'}
    write_json(ROOT / 'gdweb-static-report.json', report)
    print(json.dumps(report, ensure_ascii=False), flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--year', default='2026')
    export(parser.parse_args().year)
