"""Resumeable, bounded enrichment from GDWEB and featured sites' public HTML.

This does not capture a browser or claim that a source asset is a page capture.
Run: python enrich_gdweb_http.py --metadata-years 2026,2025 --materials-limit 180
Only source-provided tags and descriptions are included; no visual tags inferred.
"""
import argparse
import hashlib
import io
import json
import re
import sys
import xml.etree.ElementTree as ET
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup
from PIL import Image, ImageChops, ImageStat
from serve_references import CACHE, ROOT, MIMES, cache_image, get_bytes, image_info, read_json, write_json

MIMES.setdefault('AVIF', 'image/avif')

STORE = CACHE / 'enrichment-http'
LABELS = {'favicon': '사이트 파비콘', 'appicon': '앱·홈 화면 아이콘',
          'social': '링크 공유 이미지', 'logo': '브랜드 로고',
          'banner': '메인·배너 소재', 'icon': '인터페이스 아이콘', 'reference': '사이트 이미지 소재'}


def now():
    return datetime.now(timezone.utc).isoformat()


def text(value, limit=400):
    return re.sub(r'\s+', ' ', value or '').strip()[:limit]


def detail(row, retry=False):
    path = STORE / 'details' / (row['slug'] + '.json')
    saved = read_json(path)
    if saved and (saved.get('status') == 'available' or not retry):
        return saved
    result = {'checked_at': now(), 'source_url': row['gdweb_url']}
    try:
        data, _, final = get_bytes(row['gdweb_url'], 3 * 1024 * 1024)
        soup = BeautifulSoup(data, 'html.parser')
        anchor = soup.select_one('.url a[href]')
        url = anchor.get('href', '').strip() if anchor else ''
        tags, evidence = [], {}
        for tr in soup.select('tr'):
            heading, value = tr.select_one('th'), tr.select_one('td')
            if not heading or not value:
                continue
            heading, value = heading.get_text(strip=True), value.get_text(' ', strip=True)
            if heading in ('디자인 컨셉', '표현방법', '주색상', '타겟층') and value:
                evidence[heading] = value
                if heading != '타겟층':
                    tags.extend(t.strip() for t in re.split(r'[,/\n]', value) if t.strip())
        result.update(status='available', source_tags=list(dict.fromkeys(tags)),
                      source_metadata=evidence, resolved_url=final)
        if url.startswith(('https://', 'http://')):
            result['page_url'] = url
        else:
            result['url_status'] = 'not_provided'
    except Exception as exc:
        result.update(status='unavailable', error=text(str(exc), 200))
    write_json(path, result)
    return result


def export_asset(info, kind, page_url, label=''):
    """Preserve originals; use PNG -> WebP only if decoded RGBA is identical."""
    data = (CACHE / 'blobs' / info['sha256']).read_bytes()
    detected = image_info(data)
    if detected['format'] != info['format']:
        info = {**info, **detected, 'mime': MIMES[detected['format']]}
        cache_key = hashlib.sha256(info['source_url'].encode()).hexdigest()
        write_json(CACHE / 'urls' / (cache_key + '.json'), info)
    validate_image(data, info['format'])
    extension = {'JPEG': 'jpg', 'PNG': 'png', 'WEBP': 'webp', 'SVG': 'svg', 'GIF': 'gif', 'ICO': 'ico', 'AVIF': 'avif'}[info['format']]
    asset = {**info, 'type': kind, 'variant': 'shared', 'label': label or LABELS[kind],
             'source_pages': [page_url], 'source_type': 'original-image',
             'captured_at': now(), 'source_sha256': info['sha256'],
             'source_bytes': info['bytes'], 'optimization': 'original-bytes'}
    if info['format'] == 'SVG' and (not asset['width'] or not asset['height']):
        root = re.search(r'<svg\b[^>]*>', data.decode('utf-8', errors='replace'), re.I)
        if root:
            for dimension in ('width', 'height'):
                match = re.search(r'\b' + dimension + r'=[\"\']([\d.]+)(?:px)?[\"\']', root.group())
                if match:
                    asset[dimension] = round(float(match.group(1)))
    if info['format'] == 'PNG':
        with Image.open(io.BytesIO(data)) as image:
            if not getattr(image, 'is_animated', False):
                rgba = image.convert('RGBA')
                profile = image.info.get('icc_profile', b'')
                output = io.BytesIO()
                rgba.save(output, 'WEBP', lossless=True, exact=True, method=6, icc_profile=profile)
                candidate = output.getvalue()
                if len(candidate) < len(data):
                    with Image.open(io.BytesIO(candidate)) as check:
                        if rgba.tobytes() != check.convert('RGBA').tobytes():
                            raise ValueError('Lossless pixel verification failed')
                    data, extension = candidate, 'webp'
                    asset.update(format='WEBP', mime='image/webp', optimization='lossless-verified')
    sha = hashlib.sha256(data).hexdigest()
    path = Path('gdweb-extra') / (sha + '.' + extension)
    (ROOT / path).parent.mkdir(parents=True, exist_ok=True)
    if not (ROOT / path).exists():
        (ROOT / path).write_bytes(data)
    asset.update(path=path.as_posix(), sha256=sha, bytes=len(data))
    add_preview(asset)
    return asset


def validate_image(data, image_format):
    if image_format == 'SVG':
        root = ET.fromstring(data)
        if root.tag.split('}')[-1].lower() != 'svg':
            raise ValueError('Source is not an SVG document')
    else:
        with Image.open(io.BytesIO(data)) as image:
            image.load()  # Header-only detection does not catch truncated JPEGs.


def add_preview(asset):
    """Small card previews, with a measured visual-error bound; originals stay."""
    if asset.get('preview_checked') and (not asset.get('preview_path') or (ROOT / asset['preview_path']).exists()):
        return
    asset['preview_checked'] = True
    if asset.get('format') == 'SVG' and (not asset.get('width') or not asset.get('height')):
        data = (ROOT / asset['path']).read_text(encoding='utf-8', errors='replace')
        root = re.search(r'<svg\b[^>]*>', data, re.I)
        if root:
            for dimension in ('width', 'height'):
                match = re.search(r'\b' + dimension + r'=[\"\']([\d.]+)(?:px)?[\"\']', root.group())
                if match:
                    asset[dimension] = round(float(match.group(1)))
    if asset.get('format') in ('SVG', 'ICO', 'GIF') or (asset.get('width', 0) <= 640 and asset.get('height', 0) <= 1280):
        return
    source = ROOT / asset['path']
    with Image.open(source) as image:
        profile = image.info.get('icc_profile', b'')
        preview = image.convert('RGBA')
        preview.thumbnail((960, 960), Image.Resampling.LANCZOS)
        display = preview.copy()
        display.thumbnail((440, 440), Image.Resampling.LANCZOS)
        output = io.BytesIO()
        preview.save(output, 'WEBP', lossless=True, exact=True, method=4, icc_profile=profile)
        best, rms = output.getvalue(), 0.0
        for quality in (92, 96, 100):
            output = io.BytesIO()
            preview.save(output, 'WEBP', quality=quality, method=4, icc_profile=profile)
            candidate = output.getvalue()
            with Image.open(io.BytesIO(candidate)) as check:
                compared = check.convert('RGBA').resize(display.size, Image.Resampling.LANCZOS)
                error = max(ImageStat.Stat(ImageChops.difference(compared, display)).rms)
            if error <= 1.5 and len(candidate) < len(best):
                best, rms = candidate, error
                break
        if len(best) >= asset['bytes']:
            return
        sha = hashlib.sha256(best).hexdigest()
        path = Path('gdweb-extra') / 'previews' / (sha + '.webp')
        (ROOT / path).parent.mkdir(parents=True, exist_ok=True)
        if not (ROOT / path).exists():
            (ROOT / path).write_bytes(best)
        asset.update(preview_path=path.as_posix(), preview_bytes=len(best),
                     preview_width=preview.width, preview_height=preview.height,
                     preview_rms_440px=round(rms, 4))


def materials(row, max_assets=10, retry=False):
    path = STORE / 'materials' / (row['slug'] + '.json')
    saved = read_json(path)
    if saved and (saved.get('status') == 'available' or not retry):
        normalize_store_materials(saved)
        valid = []
        for asset in saved.get('assets', []):
            try:
                if not (ROOT / asset['path']).exists():
                    # Deduplication can reuse an older catalog path and discard
                    # this intermediate export; original cache bytes allow resume.
                    asset.update(export_asset(cache_image(asset['source_url']), asset['type'],
                                              saved.get('resolved_url') or saved['source_url'], asset.get('label', '')))
                validate_image((ROOT / asset['path']).read_bytes(), asset['format'])
                add_preview(asset)
                valid.append(asset)
            except Exception as exc:
                saved.setdefault('failed_assets', []).append({'source_url': asset['source_url'], 'error': text(str(exc), 180), 'rejected_path': asset['path']})
        saved['assets'] = valid
        for failure in saved.get('failed_assets', []):
            if not failure.get('rejected_path', '').endswith('.svg') or failure.get('recovered'):
                continue
            try:
                info = cache_image(failure['source_url'])
                data = (CACHE / 'blobs' / info['sha256']).read_bytes()
                if image_info(data)['format'] == 'SVG':
                    continue
                url = failure['source_url'].lower()
                kind = 'favicon' if 'favi' in url else 'social' if re.search(r'og[_-]|opengraph', url) else 'reference'
                asset = export_asset(info, kind, saved.get('resolved_url') or saved['source_url'])
                if not any(a['source_sha256'] == asset['source_sha256'] for a in saved['assets']):
                    saved['assets'].append(asset)
                failure['recovered'] = True
            except Exception:
                continue
        write_json(path, saved)
        return saved
    result = {'checked_at': now(), 'source_url': row['page_url'], 'assets': [], 'failed_assets': []}
    try:
        data, _, page_url = get_bytes(row['page_url'], 5 * 1024 * 1024)
        soup = BeautifulSoup(data, 'html.parser')
        result.update(status='available', resolved_url=page_url)
        description = soup.select_one('meta[name="description"],meta[property="og:description"]')
        if description:
            result['site_description'] = text(description.get('content'), 400)
        if soup.title:
            result['site_title'] = text(soup.title.get_text(' ', strip=True), 160)
        candidates = []
        for tag in soup.select('link[href]'):
            rel = ' '.join(tag.get('rel', [])).lower()
            if 'icon' in rel:
                candidates.append(('appicon' if 'apple' in rel else 'favicon', urljoin(page_url, tag['href']), ''))
        for tag in soup.select('meta[property="og:image"],meta[name="twitter:image"]'):
            if tag.get('content'):
                candidates.append(('social', urljoin(page_url, tag['content']), ''))
        for tag in soup.select('img[src],img[data-src],img[data-lazy-src]'):
            src = tag.get('data-src') or tag.get('data-lazy-src') or tag.get('src', '')
            context = ' '.join([src, str(tag.get('class', '')), tag.get('alt', '')]).lower()
            if re.search(r'captcha|pixel|tracking|spacer|blank|loading|spinner', context):
                continue
            kind = ('logo' if re.search(r'logo|brandmark|워드마크', context) else
                    'icon' if re.search(r'icon|ico[_-]|btn[_-]', context) else
                    'banner' if re.search(r'banner|visual|hero|slide|kv[_-]', context) else 'reference')
            if src and not src.startswith('data:'):
                candidates.append((kind, urljoin(page_url, src), text(tag.get('alt', ''), 100)))
        if not any(kind == 'favicon' for kind, _, _ in candidates):
            candidates.append(('favicon', urljoin(page_url, '/favicon.ico'), ''))
        unique = {}
        for kind, url, label in candidates:
            if url.startswith(('https://', 'http://')):
                unique.setdefault(url, (kind, label))
        priority = ['logo', 'favicon', 'appicon', 'social', 'banner', 'icon', 'reference']
        ordered = sorted(unique.items(), key=lambda x: (priority.index(x[1][0]), not urlparse(x[0]).path.lower().endswith('.svg')))
        counts = Counter()
        for url, (kind, label) in ordered[:max_assets * 3]:
            if len(result['assets']) >= max_assets:
                break
            if counts[kind] >= {'logo': 3, 'favicon': 3, 'appicon': 2, 'social': 2, 'banner': 4, 'icon': 4, 'reference': 3}[kind]:
                continue
            try:
                info = cache_image(url, limit=4 * 1024 * 1024)
                if kind in ('reference', 'banner') and (info['width'] < 160 or info['height'] < 80):
                    continue
                if any(a['source_sha256'] == info['sha256'] for a in result['assets']):
                    continue
                result['assets'].append(export_asset(info, kind, page_url, label))
                counts[kind] += 1
            except Exception as exc:
                result['failed_assets'].append({'source_url': url, 'error': text(str(exc), 180)})
    except Exception as exc:
        result.update(status='unavailable', error=text(str(exc), 200))
    normalize_store_materials(result)
    write_json(path, result)
    return result


def normalize_store_materials(result):
    """A featured mobile app is not the Google/Apple storefront brand."""
    host = urlparse(result.get('resolved_url') or result.get('source_url', '')).hostname or ''
    if host not in ('play.google.com', 'apps.apple.com', 'itunes.apple.com'):
        return
    kept = []
    for asset in result.get('assets', []):
        url = asset.get('source_url', '')
        asset_host = urlparse(url).hostname or ''
        actual_app_asset = ('googleusercontent.com' in asset_host if host == 'play.google.com'
                            else 'mzstatic.com' in asset_host)
        if not actual_app_asset:
            continue
        square = asset.get('width') and abs(asset['width'] - asset.get('height', 0)) / asset['width'] < .03
        if square:
            asset.update(type='appicon', label='앱 스토어에 공개된 앱 아이콘')
        else:
            asset.update(type='reference', label='앱 스토어에 공개된 소개 이미지')
        asset['source_type'] = 'app-store-image'
        kept.append(asset)
    result['assets'] = kept


def apply_details(row, result):
    if result['status'] != 'available':
        return
    if result.get('page_url'):
        row['page_url'] = result['page_url']
    row['detail_loaded'] = True
    row['source_checked_at'] = result['checked_at']
    row['design_tags'] = list(dict.fromkeys(row.get('design_tags', []) + result.get('source_tags', [])))
    row['tag_source'] = row['gdweb_url']
    row['source_design_tags'] = result.get('source_tags', [])
    row['source_metadata'] = result.get('source_metadata', {})


def apply_materials(row, result):
    row['materials_checked'] = True
    row['materials_checked_at'] = result['checked_at']
    row['material_status'] = result['status']
    if result['status'] != 'available':
        row['material_error'] = result.get('error', '')
        return
    row.pop('material_error', None)
    row['official_resolved_url'] = result['resolved_url']
    if result.get('site_description'):
        row['site_description'] = result['site_description']
        row['description_source'] = result['resolved_url']
    rejected = {failure['rejected_path'] for failure in result.get('failed_assets', []) if failure.get('rejected_path')}
    if rejected:
        row['assets'] = [asset for asset in row['assets'] if asset['path'] not in rejected]
    host = urlparse(result['resolved_url']).hostname or ''
    if host in ('play.google.com', 'apps.apple.com', 'itunes.apple.com'):
        # Remove a storefront's generic marks from older cached runs, while
        # retaining page captures and original assets for the featured app.
        check = {'resolved_url': result['resolved_url'],
                 'assets': [a for a in row['assets'] if a.get('source_type') in ('original-image', 'app-store-image')]}
        normalize_store_materials(check)
        allowed = {a['path'] for a in check['assets']}
        row['assets'] = [a for a in row['assets'] if a.get('source_type') not in ('original-image', 'app-store-image') or a['path'] in allowed]
    known = {a.get('source_sha256') or a.get('sha256') or a.get('path') for a in row['assets']}
    for asset in result['assets']:
        if asset['source_sha256'] not in known:
            row['assets'].append(asset)
            known.add(asset['source_sha256'])
        else:
            existing = next((a for a in row['assets'] if (a.get('source_sha256') or a.get('sha256')) == asset['source_sha256']), None)
            if existing:
                existing.update({k: v for k, v in asset.items() if k.startswith('preview_')})
                if asset.get('format') == 'SVG':
                    existing.update(width=asset['width'], height=asset['height'])
                if asset.get('source_type') == 'app-store-image':
                    existing.update({k: asset[k] for k in ('type', 'label', 'source_type')})


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--metadata-years', default='2026,2025')
    parser.add_argument('--materials-limit', type=int, default=180)
    parser.add_argument('--max-assets', type=int, default=10)
    parser.add_argument('--workers', type=int, default=4)
    parser.add_argument('--retry-failures', action='store_true')
    args = parser.parse_args()
    sys.stdout.reconfigure(encoding='utf-8')
    catalogs = {name: read_json(ROOT / name) for name in ['gdweb.json', 'gdweb-static.json']}
    rows = catalogs['gdweb.json']
    before = {'linked_sites': sum(bool(r.get('page_url')) for r in rows),
              'tagged_sites': sum(bool(r.get('design_tags')) for r in rows),
              'assets': sum(len(r['assets']) for r in rows)}
    previous = read_json(ROOT / 'gdweb-enrichment-report.json', {})
    baseline = previous.get('baseline') or previous.get('before') or before
    years = set(args.metadata_years.split(','))
    targets = [r for r in rows if r.get('featured_date', '')[:4] in years]
    # Existing curated records already have source links and tags; preserve them.
    targets = [r for r in targets if not r.get('page_url') or not r.get('design_tags')]
    details = {r['slug']: value for r in rows if r.get('featured_date', '')[:4] in years
               if (value := read_json(STORE / 'details' / (r['slug'] + '.json')))}
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {pool.submit(detail, r, args.retry_failures): r['slug'] for r in targets}
        for count, future in enumerate(as_completed(futures), 1):
            details[futures[future]] = future.result()
            if count % 50 == 0 or count == len(futures):
                print(f'Metadata {count}/{len(futures)}', flush=True)
    for catalog in catalogs.values():
        for row in catalog:
            if row['slug'] in details:
                apply_details(row, details[row['slug']])
    targets = sorted((r for r in rows if r.get('page_url') and r.get('featured_date', '')[:4] in years),
                     key=lambda r: (r.get('featured_date', ''), int(r['slug'].split('-')[-1])), reverse=True)[:args.materials_limit]
    outputs = {}
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {pool.submit(materials, r, args.max_assets, args.retry_failures): r['slug'] for r in targets}
        for count, future in enumerate(as_completed(futures), 1):
            outputs[futures[future]] = future.result()
            if count % 10 == 0 or count == len(futures):
                print(f'Sites {count}/{len(futures)}; verified source images {sum(len(x["assets"]) for x in outputs.values())}', flush=True)
    for name, catalog in catalogs.items():
        for row in catalog:
            if row['slug'] in outputs:
                apply_materials(row, outputs[row['slug']])
        write_json(ROOT / name, catalog)
    referenced = {a[k] for catalog in catalogs.values() for row in catalog for a in row['assets']
                  for k in ('path', 'preview_path') if a.get(k, '').startswith('gdweb-extra/')}
    exported_paths = {a[k] for output in outputs.values() for a in output['assets']
                      for k in ('path', 'preview_path') if a.get(k, '').startswith('gdweb-extra/')}
    export_root = (ROOT / 'gdweb-extra').resolve()
    for relative in exported_paths - referenced:
        path = (ROOT / relative).resolve()
        if path.is_relative_to(export_root) and path.is_file():
            path.unlink()
    assets = [a for value in outputs.values() for a in value['assets']]
    unique = {a['path']: a for a in assets}
    report = {'checked_at': now(), 'metadata_years': sorted(years), 'metadata_attempted': len(details),
              'material_sites_attempted': len(outputs), 'material_sites_available': sum(x['status'] == 'available' for x in outputs.values()),
              'sites_with_source_assets': sum(bool(x['assets']) for x in outputs.values()),
              'verified_source_assets': len(assets), 'unique_source_files': len(unique),
              'source_bytes': sum(a['source_bytes'] for a in unique.values()), 'stored_bytes': sum(a['bytes'] for a in unique.values()),
              'lossless_optimized_files': sum(a['optimization'] == 'lossless-verified' for a in unique.values()),
              'preview_files': len({a['preview_path'] for a in assets if a.get('preview_path')}),
              'preview_bytes': sum(a['preview_bytes'] for a in {a['preview_path']: a for a in assets if a.get('preview_path')}.values()),
              'published_files': len(referenced),
              'published_bytes': sum((ROOT / p).stat().st_size for p in referenced if (ROOT / p).exists()),
              'unique_site_hosts': len({urlparse(v.get('resolved_url') or v['source_url']).hostname for v in outputs.values()}),
              'asset_types': dict(Counter(a['type'] for a in assets)), 'baseline': baseline, 'before': before,
              'after': {'linked_sites': sum(bool(r.get('page_url')) for r in rows), 'tagged_sites': sum(bool(r.get('design_tags')) for r in rows), 'assets': sum(len(r['assets']) for r in rows)},
              'metadata_failures': [{'slug': s, 'error': r.get('error', r.get('url_status'))} for s,r in details.items() if r['status'] != 'available' or not r.get('page_url')],
              'material_failures': [{'slug': s, 'error': r.get('error', 'No eligible public HTML images')} for s,r in outputs.items() if not r['assets']],
              'policy': 'Authentic public source assets; never synthesized page captures. Original dimensions retained. PNG converted only when pixel-identical and smaller; other bytes preserved.'}
    write_json(ROOT / 'gdweb-enrichment-report.json', report)
    print(json.dumps(report, ensure_ascii=False), flush=True)


if __name__ == '__main__':
    main()
