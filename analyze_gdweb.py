"""Analyze newly collected local GDWEB images for color and tone filters."""
import json
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from analyze_assets import analyze

ROOT = Path(__file__).resolve().parent

def main():
    output = ROOT / 'gdweb-analysis.json'
    results = json.loads(output.read_text(encoding='utf-8')) if output.exists() else {}
    rows = json.loads((ROOT / 'gdweb-static.json').read_text(encoding='utf-8'))
    jobs = {}
    for row in rows:
        for asset in row.get('assets', []):
            sha, path = asset.get('sha256'), asset.get('path', '')
            if sha and path and not path.startswith(('http:', 'https:', '/api/')) and (ROOT / path).is_file():
                jobs[sha] = path
    pending = [(sha, path) for sha, path in jobs.items() if sha not in results]
    failed = []
    with ThreadPoolExecutor(max_workers=6) as pool:
        for sha, result in pool.map(analyze, pending):
            if result is not None:
                results[sha] = result
            else:
                failed.append(sha)
    output.write_text(json.dumps(results, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print(json.dumps({'new': len(pending)-len(failed), 'failed': failed, 'total': len(results)}))

if __name__ == '__main__':
    main()
