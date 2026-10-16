"""Validate enriched exports against source hashes and decoded original pixels."""
import hashlib
import json
from pathlib import Path
from urllib.parse import urlparse

from PIL import Image
from serve_references import CACHE, ROOT, read_json, write_json


def main():
    rows = read_json(ROOT / 'gdweb-static.json')
    assets = {a['path']: a for r in rows for a in r['assets']
              if a.get('source_type') in ('original-image', 'app-store-image')}
    failures, lossless, original, previews = [], 0, 0, set()
    for path, asset in assets.items():
        file = ROOT / path
        if not file.exists():
            failures.append({'path': path, 'error': 'missing-file'})
            continue
        data = file.read_bytes()
        if hashlib.sha256(data).hexdigest() != asset['sha256'] or len(data) != asset['bytes']:
            failures.append({'path': path, 'error': 'stored-hash-or-size'})
        if asset.get('optimization') == 'original-bytes':
            original += 1
            if asset['sha256'] != asset['source_sha256'] or asset['bytes'] != asset['source_bytes']:
                failures.append({'path': path, 'error': 'original-bytes-changed'})
        elif asset.get('optimization') == 'lossless-verified':
            source = CACHE / 'blobs' / asset['source_sha256']
            if source.exists():
                with Image.open(source) as before, Image.open(file) as after:
                    if before.size != after.size or before.convert('RGBA').tobytes() != after.convert('RGBA').tobytes():
                        failures.append({'path': path, 'error': 'lossless-pixel-mismatch'})
                    elif before.info.get('icc_profile', b'') != after.info.get('icc_profile', b''):
                        failures.append({'path': path, 'error': 'color-profile-mismatch'})
                    else:
                        lossless += 1
        if asset.get('preview_path'):
            preview = ROOT / asset['preview_path']
            previews.add(asset['preview_path'])
            if not preview.exists() or preview.stat().st_size != asset['preview_bytes']:
                failures.append({'path': path, 'error': 'missing-preview-or-size'})
            elif asset.get('preview_rms_440px', 99) > 1.5:
                failures.append({'path': path, 'error': 'preview-error-bound'})
            else:
                with Image.open(preview) as image:
                    if image.width > asset['width'] or image.height > asset['height']:
                        failures.append({'path': path, 'error': 'preview-upscaled'})
    for row in rows:
        host = urlparse(row.get('official_resolved_url', '')).hostname or ''
        if host in ('play.google.com', 'apps.apple.com', 'itunes.apple.com'):
            for asset in row['assets']:
                if asset.get('source_type') == 'original-image':
                    failures.append({'path': asset['path'], 'error': 'generic-app-store-asset'})
    palettes = read_json(ROOT / 'gdweb-brand-colors.json', {})
    for slug, palette in palettes.items():
        if not palette.get('source_assets') or not all((ROOT / path).exists() for path in palette['source_assets']):
            failures.append({'slug': slug, 'error': 'palette-source-missing'})
    report = {'unique_source_files': len(assets), 'unchanged_originals': original,
              'lossless_pixel_comparisons': lossless, 'preview_files': len(previews),
              'palettes_with_evidence': len(palettes), 'failures': failures}
    write_json(ROOT / 'gdweb-enrichment-verification.json', report)
    print(json.dumps(report, ensure_ascii=False))
    raise SystemExit(1 if failures else 0)


if __name__ == '__main__':
    main()
