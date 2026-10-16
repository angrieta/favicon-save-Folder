"""Save the featured website's original presentation image with explicit GDWEB attribution."""
import io
import json
import hashlib
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import requests
from PIL import Image

ROOT = Path(__file__).resolve().parent

def collect(row):
    ident = row['slug'].split('-')[-1]
    url = f'https://www.gdweb.co.kr/sub/filedata.asp?str_no={ident}&sgbn=1'
    try:
        r = requests.get(url, timeout=45)
        r.raise_for_status()
        if len(r.content)>25*1024*1024:
            raise ValueError('Image exceeds 25MB')
        im = Image.open(io.BytesIO(r.content))
        im.load()
        ext = {'JPEG':'jpg','PNG':'png','WEBP':'webp','GIF':'gif'}[im.format]
        folder = ROOT/'gdweb'/row['slug']
        folder.mkdir(parents=True,exist_ok=True)
        relative = f'gdweb/{row["slug"]}/gdweb-featured-original.{ext}'
        (ROOT/relative).write_bytes(r.content)
        preview = im.convert('RGB').crop((0,0,im.width,min(im.height,round(im.width*0.625))))
        preview.thumbnail((1000,625))
        thumb = f'gdweb/{row["slug"]}/gdweb-featured-preview.webp'
        preview.save(ROOT/thumb,'WEBP',quality=86)
        asset = {'type':'showcase','path':relative,'preview_path':thumb,'width':im.width,'height':im.height,'bytes':len(r.content),'sha256':hashlib.sha256(r.content).hexdigest(),'source_url':url,'source_pages':[row['gdweb_url']],'variant':'desktop','label':'GDWEB 소개 당시 사이트 이미지','featured_date':row['featured_date'],'downloaded_at':datetime.now(timezone.utc).isoformat()}
        print(row['slug'],im.size,flush=True)
        return {'slug':row['slug'],'asset':asset}
    except Exception as e:
        print(row['slug'],'FAILED',str(e),flush=True)
        return {'slug':row['slug'],'error':str(e)}

if __name__ == '__main__':
    seeds = json.loads((ROOT/'gdweb-seeds.json').read_text(encoding='utf-8'))
    with ThreadPoolExecutor(max_workers=3) as pool:
        result=list(pool.map(collect,seeds))
    (ROOT/'gdweb-showcases.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
