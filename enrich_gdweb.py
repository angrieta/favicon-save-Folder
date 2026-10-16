"""Resolve real site links and source-provided tags for every latest-year selection."""
import json
import sys
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed
from serve_references import ROOT, source_detail, write_json

if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    rows = json.loads((ROOT / 'gdweb.json').read_text(encoding='utf-8'))
    year = max(row['featured_date'][:4] for row in rows)
    targets = [row for row in rows if row['featured_date'].startswith(year) and not row.get('page_url')]
    failures = []
    with ThreadPoolExecutor(max_workers=4) as pool:
        futures = {pool.submit(source_detail, row): row for row in targets}
        for n, future in enumerate(as_completed(futures), 1):
            row = futures[future]
            try:
                details = future.result()
                row.update(details)
            except Exception as exc:
                failures.append({'slug': row['slug'], 'error': type(exc).__name__})
            if n % 50 == 0:
                print(n, '/', len(targets), 'source links resolved', flush=True)
    write_json(ROOT / 'gdweb.json', rows)
    write_json(ROOT / 'gdweb-detail-report.json', {'year': year, 'attempted': len(targets), 'resolved': len(targets) - len(failures), 'failures': failures})
    print('Resolved', len(targets) - len(failures), 'failures', len(failures), flush=True)
