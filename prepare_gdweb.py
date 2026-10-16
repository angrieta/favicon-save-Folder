"""Merge attribution and curation, remove empty captures, optimize without pixel changes.

New GDWEB files only. Decoded RGBA pixels, dimensions and ICC/EXIF are preserved
for original-image conversions. Dedicated previews are resized for browsing;
viewer and downloads always retain the full resolution image.
"""
from __future__ import annotations
import hashlib
import io
import json
import re
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from PIL import Image, ImageOps, ImageStat
from analyze_assets import analyze

ROOT=Path(__file__).resolve().parent
DATA=ROOT/'gdweb.json'
sys.stdout.reconfigure(encoding='utf-8')

def read(name):return json.loads((ROOT/name).read_text(encoding='utf-8'))
def digest(data):return hashlib.sha256(data).hexdigest()

def process_file(relative):
    p=ROOT/relative
    original=p.read_bytes()
    result={'path':relative,'bytes':len(original),'sha256':digest(original),'before':len(original),'verified':False}
    if p.suffix.lower()=='.svg':
        text=original.decode('utf-8',errors='replace')
        view=re.search(r'viewBox\s*=\s*[\"\']([^\"\']+)',text)
        if view:
            try:
                dims=[float(v) for v in re.split(r'[\s,]+',view[1].strip())]
                result.update(width=round(dims[2]),height=round(dims[3]))
            except (ValueError,IndexError):pass
        return result
    try:
        with Image.open(io.BytesIO(original)) as src:
            src.load()
            result.update(width=src.width,height=src.height)
            if getattr(src,'is_animated',False) or src.mode not in ('RGB','RGBA','L','LA','P'):
                return result
            reference=src.convert('RGBA')
            thumb=reference.copy();thumb.thumbnail((160,160))
            stats=ImageStat.Stat(thumb.convert('RGB'))
            result['blank']=max(stats.stddev)<2.2
            # WebP has a hard 16,383px limit. Very long captures remain PNG/JPEG.
            if p.suffix.lower() in ('.png','.bmp','.tiff') and max(src.size)<=16383:
                buffer=io.BytesIO()
                options={k:src.info[k] for k in ('icc_profile','exif') if k in src.info}
                reference.save(buffer,'WEBP',lossless=True,exact=True,method=5,**options)
                candidate=buffer.getvalue()
                if len(candidate)<len(original):
                    with Image.open(io.BytesIO(candidate)) as check:
                        same=check.size==src.size and check.convert('RGBA').tobytes()==reference.tobytes()
                        same= same and all(check.info.get(k)==src.info.get(k) for k in ('icc_profile','exif'))
                    if same:
                        target=p.with_name(p.stem+'-lossless.webp')
                        target.write_bytes(candidate)
                        result.update(path=target.relative_to(ROOT).as_posix(),bytes=len(candidate),sha256=digest(candidate),verified=True)
            elif p.suffix.lower()=='.png' and max(src.size)>16383:
                buffer=io.BytesIO();src.save(buffer,'PNG',optimize=True,compress_level=9,**{k:src.info[k] for k in ('icc_profile','exif') if k in src.info})
                candidate=buffer.getvalue()
                if len(candidate)<len(original):
                    with Image.open(io.BytesIO(candidate)) as check:
                        same=check.size==src.size and check.convert('RGBA').tobytes()==reference.tobytes()
                    if same:
                        # Separate filename makes interrupted runs recoverable.
                        target=p.with_name(p.stem+'-lossless.png');target.write_bytes(candidate)
                        result.update(path=target.relative_to(ROOT).as_posix(),bytes=len(candidate),sha256=digest(candidate),verified=True)
            if max(src.size)>1200 or len(original)>200_000:
                preview=ImageOps.exif_transpose(src).convert('RGBA')
                if 'layout-' in p.name or 'featured-original' in p.name:
                    ratio=1.75 if '-mobile-' in p.name else .9
                    preview=preview.crop((0,0,preview.width,min(preview.height,round(preview.width*ratio))))
                preview.thumbnail((960,1200),Image.Resampling.LANCZOS)
                buffer=io.BytesIO();preview.save(buffer,'WEBP',lossless=True,exact=True,method=4,**{k:src.info[k] for k in ('icc_profile',) if k in src.info})
                data=buffer.getvalue()
                if len(data)<result['bytes']*.85:
                    target=p.with_name(p.stem+'-preview.webp');target.write_bytes(data)
                    result['preview_path']=target.relative_to(ROOT).as_posix();result['preview_bytes']=len(data)
    except Exception as exc:
        result['error']=str(exc)
    return result

def main():
    rows=read('gdweb.json');curation=read('gdweb-curation.json')
    rejected={x['sha256'] for x in read('gdweb-rejected.json')} if (ROOT/'gdweb-rejected.json').exists() else set()
    showcases={x['slug']:x['asset'] for x in read('gdweb-showcases.json') if x.get('asset')}
    for row in rows:
        row.update(curation.get(row['slug'],{}))
        row['assets']=[a for a in row['assets'] if a['type']!='showcase' and a.get('source_sha256',a['sha256']) not in rejected]
        if row['slug'] in showcases:row['assets'].append(showcases[row['slug']])
        if row['slug']=='gdweb-27828':
            row['assets']=[a for a in row['assets'] if a['type'] in ('showcase','favicon','appicon','logo','social')]
        if row['slug']=='gdweb-27799':
            row['assets']=[a for a in row['assets'] if a['type'] not in ('hero','layout','section','button','icon','header','footer')]
        if row['slug']=='gdweb-27872':
            row['assets']=[a for a in row['assets'] if a['type']!='hero']
    paths=list(dict.fromkeys(a['path'] for r in rows for a in r['assets']))
    results={}
    with ThreadPoolExecutor(max_workers=3) as pool:
        futures={pool.submit(process_file,p):p for p in paths}
        for n,f in enumerate(as_completed(futures),1):
            results[futures[f]]=f.result()
            if n%100==0:print(f'Optimized {n}/{len(paths)}',flush=True)
    removed=[]
    for row in rows:
        keep=[]
        for asset in row['assets']:
            result=results[asset['path']]
            if result.get('blank') and asset['type'] in ('button','icon','header','footer','section','hero','layout'):
                removed.append({'slug':row['slug'],'path':asset['path'],'reason':'near-empty capture'});continue
            if result.get('error'):
                removed.append({'slug':row['slug'],'path':asset['path'],'reason':result['error']});continue
            if result['sha256']!=asset['sha256']:
                asset.setdefault('source_sha256',asset['sha256'])
                asset['lossless_verified']=True
            for k in ('path','bytes','sha256','width','height','preview_path','preview_bytes'):
                if k in result:asset[k]=result[k]
            keep.append(asset)
        row['assets']=keep
        captures=[a for a in keep if a['type']=='layout']
        if row['slug']!='gdweb-27828':
            missing=[label for variant,label in [('desktop','PC'),('mobile','모바일')] if not any(a.get('variant')==variant for a in captures)]
            notes=[]
            if missing:notes.append('·'.join(missing)+' 현재 전체 캡처 제한 — 선정 당시 화면을 함께 제공합니다.')
            if any(a.get('truncated') for a in captures):notes.append('긴 현재 페이지는 최대 30,000px까지 캡처했습니다.')
            row['capture_note']=' '.join(notes)
        row['collection_status']='collected' if captures else 'showcase-only'
    analysis={}
    jobs={a['sha256']:a['path'] for r in rows for a in r['assets']}
    with ThreadPoolExecutor(max_workers=4) as pool:
        for key,result in pool.map(analyze,jobs.items()):
            if result:analysis[key]=result
    DATA.write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding='utf-8')
    (ROOT/'gdweb-showcases.json').write_text(json.dumps([{'slug':row['slug'],'asset':a} for row in rows for a in row['assets'] if a['type']=='showcase'],ensure_ascii=False,indent=2),encoding='utf-8')
    for row in rows:
        (ROOT/'gdweb'/row['slug']/'source.json').write_text(json.dumps(row,ensure_ascii=False,indent=2),encoding='utf-8')
    (ROOT/'gdweb-analysis.json').write_text(json.dumps(analysis,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    referenced={a['path'] for r in rows for a in r['assets']}|{a['preview_path'] for r in rows for a in r['assets'] if a.get('preview_path')}
    # Only remove newly generated, superseded files inside this task's GDWEB folder.
    base=(ROOT/'gdweb').resolve()
    cleanup=0
    for p in base.rglob('*'):
        if p.is_file() and p.suffix.lower() in ('.png','.jpg','.jpeg','.gif','.ico','.svg','.avif','.webp') and p.relative_to(ROOT).as_posix() not in referenced:
            if not p.resolve().is_relative_to(base):raise ValueError('Unsafe cleanup path')
            cleanup+=p.stat().st_size;p.unlink()
    before=sum(r['before'] for r in results.values())
    after=sum((ROOT/p).stat().st_size for p in {a['path'] for r in rows for a in r['assets']})
    previews=sum((ROOT/p).stat().st_size for p in {a['preview_path'] for r in rows for a in r['assets'] if a.get('preview_path')})
    report={'sites':len(rows),'assets':sum(len(r['assets']) for r in rows),'source_bytes_before':before,'source_bytes_after':after,'preview_bytes':previews,'verified_lossless_conversions':sum(r['verified'] for r in results.values()),'removed_blank_or_invalid':removed,'superseded_files_removed_bytes':cleanup,'all_kept_original_dimensions':True,'lossy_reencoding_applied':False}
    (ROOT/'gdweb-optimization.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({k:v for k,v in report.items() if k!='removed_blank_or_invalid'},ensure_ascii=False),flush=True)

if __name__=='__main__':main()
