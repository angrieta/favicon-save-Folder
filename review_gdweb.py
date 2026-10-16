"""Apply visual QA decisions and reduce preview transfer size. Full images are untouched."""
import io
import json
import hashlib
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from PIL import Image, ImageChops, ImageStat

ROOT=Path(__file__).resolve().parent
load=lambda n:json.loads((ROOT/n).read_text(encoding='utf-8'))

def preview_job(relative):
    p=ROOT/relative;data=p.read_bytes()
    if len(data)<35_000:return 0
    with Image.open(io.BytesIO(data)) as source:
        source.load();ref=source.convert('RGBA')
        display=ref.copy();display.thumbnail((480,600),Image.Resampling.LANCZOS)
        for quality in (90,94,97,100):
            output=io.BytesIO()
            ref.save(output,'WEBP',quality=quality,method=6,**{k:source.info[k] for k in ('icc_profile',) if k in source.info})
            candidate=output.getvalue()
            if len(candidate)>=len(data):continue
            with Image.open(io.BytesIO(candidate)) as check:
                decoded=check.convert('RGBA');decoded.thumbnail((480,600),Image.Resampling.LANCZOS)
                rms=max(ImageStat.Stat(ImageChops.difference(display,decoded)).rms)
                # Strict screen-size error budget; icons and original images stay lossless.
                if rms<=1.5:
                    p.write_bytes(candidate)
                    return len(data)-len(candidate)
    return 0

def main():
    rows=load('gdweb.json');report=load('gdweb-optimization.json')
    rejected={a['sha256'] for a in load('gdweb-rejected.json')}
    removed=[]
    for row in rows:
        kept=[]
        for a in row['assets']:
            if a.get('source_sha256',a['sha256']) in rejected:
                removed.append({'slug':row['slug'],'path':a['path'],'reason':'Visual review: incomplete or misaligned capture'})
            else:kept.append(a)
        row['assets']=kept
    previews={a['preview_path'] for row in rows for a in row['assets'] if a.get('preview_path')}
    with ThreadPoolExecutor(max_workers=4) as pool:saved=sum(pool.map(preview_job,previews))
    # Exact file duplicates are stored once, with independent attribution per website.
    canonical={};dedup_saved=0
    for row in rows:
        for a in row['assets']:
            key=a['sha256']
            if key in canonical and a['path']!=canonical[key]:
                dedup_saved+=(ROOT/a['path']).stat().st_size;a['path']=canonical[key]
            else:canonical[key]=a['path']
            if a.get('preview_path'):a['preview_bytes']=(ROOT/a['preview_path']).stat().st_size
        unique={}
        for a in row['assets']:
            unique.setdefault((a['type'],a['path']),a)
        row['assets']=list(unique.values())
    referenced={a['path'] for r in rows for a in r['assets']}|{a['preview_path'] for r in rows for a in r['assets'] if a.get('preview_path')}
    root=(ROOT/'gdweb').resolve()
    for p in root.rglob('*'):
        if p.is_file() and p.suffix.lower() in ('.png','.jpg','.jpeg','.gif','.ico','.svg','.avif','.webp') and p.relative_to(ROOT).as_posix() not in referenced:
            assert p.resolve().is_relative_to(root)
            p.unlink()
    (ROOT/'gdweb.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding='utf-8')
    for row in rows:(ROOT/'gdweb'/row['slug']/'source.json').write_text(json.dumps(row,ensure_ascii=False,indent=2),encoding='utf-8')
    (ROOT/'gdweb-showcases.json').write_text(json.dumps([{'slug':r['slug'],'asset':a} for r in rows for a in r['assets'] if a['type']=='showcase'],ensure_ascii=False,indent=2),encoding='utf-8')
    report.update(assets=sum(len(r['assets']) for r in rows),source_bytes_after=sum((ROOT/p).stat().st_size for p in {a['path'] for r in rows for a in r['assets']}),preview_bytes=sum((ROOT/p).stat().st_size for p in previews),preview_bytes_saved=saved,deduplication_bytes_saved=dedup_saved,original_lossy_reencoding_applied=False,preview_encoding='Adaptive WebP 90/94/97/100; display-scale RMS <= 1.5/255; otherwise retain lossless')
    report.pop('lossy_reencoding_applied',None)
    report['removed_blank_or_invalid'].extend(removed)
    (ROOT/'gdweb-optimization.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({k:v for k,v in report.items() if k!='removed_blank_or_invalid'}),flush=True)

if __name__=='__main__':main()
