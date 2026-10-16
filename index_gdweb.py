"""Index every public GDWEB list page. Images stay full resolution and load on demand."""
import json
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parent
CACHE = ROOT / '.gdweb-cache' / 'lists'
GROUPS = {5: '국내 웹', 6: '해외 웹', 23: '일본 웹', 7: '모바일'}


def listing(group, page):
    cache = CACHE / f'{group}-{page}.html'
    if cache.exists() and '--refresh' not in sys.argv:
        html = cache.read_text(encoding='utf-8')
    else:
        for attempt in range(3):
            try:
                r = requests.get('https://www.gdweb.co.kr/sub/list.asp', params={'Txt_fgbn': group, 'Page': page, 'displayrow': 60}, timeout=35)
                r.raise_for_status()
                html = r.content.decode('utf-8')
                if 'thumnail-box' not in html:
                    raise ValueError('No listing found')
                CACHE.mkdir(parents=True, exist_ok=True)
                cache.write_text(html, encoding='utf-8')
                break
            except Exception:
                if attempt == 2:
                    raise
                time.sleep(attempt + 1)
    soup = BeautifulSoup(html, 'html.parser')
    rows = []
    for card in soup.select('.thumnail-box'):
        name = card.select_one('.subject')
        anchor = card.select_one('a[href*="view.asp"]')
        date = card.select_one('.date')
        if not name or not anchor or not date:
            continue
        ident = parse_qs(urlparse(anchor['href']).query)['str_no'][0]
        featured = '20' + date.get_text(strip=True).replace('.', '-')
        rows.append({
            'slug': 'gdweb-' + ident, 'company': name.get_text(' ', strip=True),
            'collection': 'gdweb', 'category': 'GDWEB_선정사이트',
            'gdweb_url': f'https://www.gdweb.co.kr/sub/view.asp?Txt_fgbn={group}&str_no={ident}',
            'featured_group': GROUPS[group], 'region': GROUPS[group], 'featured_date': featured,
            'collection_status': 'indexed',
            'assets': [{'type': 'showcase', 'path': f'/api/gdweb/{ident}/original',
                        'preview_path': f'/api/gdweb/{ident}/thumbnail', 'format': '원본',
                        'source_url': f'https://www.gdweb.co.kr/sub/filedata.asp?str_no={ident}&sgbn=1',
                        'source_pages': [f'https://www.gdweb.co.kr/sub/view.asp?Txt_fgbn={group}&str_no={ident}'],
                        'featured_date': featured, 'variant': 'mobile' if group == 7 else 'desktop',
                        'label': 'GDWEB 선정 당시 사이트 전체 이미지'}],
        })
    pages = [int(parse_qs(urlparse(a['href']).query)['Page'][0]) for a in soup.select('a[href*="list.asp"][href*="Page="]')]
    return rows, max(pages or [page])


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    indexed, tasks, counts, failures = {}, [], {}, []
    for group in GROUPS:
        first, last = listing(group, 1)
        counts[GROUPS[group]] = {'pages': last, 'indexed_pages': 1}
        indexed.update({r['slug']: r for r in first})
        tasks.extend((group, page) for page in range(2, last + 1))
        print(GROUPS[group], last, 'pages', flush=True)
    with ThreadPoolExecutor(max_workers=4) as pool:
        pending = {pool.submit(listing, g, p): (g, p) for g, p in tasks}
        for n, future in enumerate(as_completed(pending), 1):
            group, page = pending[future]
            try:
                rows, _ = future.result()
                indexed.update({r['slug']: r for r in rows})
                counts[GROUPS[group]]['indexed_pages'] += 1
            except Exception as exc:
                failures.append({'group': group, 'page': page, 'error': str(exc)})
            if n % 20 == 0:
                print(f'{n}/{len(tasks)} pages; {len(indexed)} entries', flush=True)
    # Deep collections keep every existing asset, favorite key and hand-reviewed design note.
    existing = json.loads((ROOT / 'gdweb.json').read_text(encoding='utf-8'))
    for old in existing:
        base = indexed.get(old['slug'], {})
        indexed[old['slug']] = {**base, **old, 'region': base.get('region', old.get('region', '국내 웹'))}
    rows = sorted(indexed.values(), key=lambda r: (r['featured_date'], r['slug']), reverse=True)
    (ROOT / 'gdweb.json').write_text(json.dumps(rows, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    for region in counts:
        counts[region]['sites'] = sum(r['region'] == region for r in rows)
    report = {'indexed_at': datetime.now(timezone.utc).isoformat(), 'sites': len(rows), 'groups': counts,
              'years': sorted({r['featured_date'][:4] for r in rows}, reverse=True), 'failures': failures,
              'image_policy': 'Original bytes on demand; cached locally; no lossy re-encoding.'}
    (ROOT / 'gdweb-index-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(report, ensure_ascii=False), flush=True)
    if failures:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
