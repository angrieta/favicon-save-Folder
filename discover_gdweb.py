"""Discover current GDWEB featured websites; retain attribution, not GDWEB imagery."""
import json
import re
import sys
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import urljoin, urlparse, parse_qs
import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parent
BASE = 'https://www.gdweb.co.kr'
sys.stdout.reconfigure(encoding='utf-8')

def soup(url):
    response = requests.get(url, timeout=35)
    response.raise_for_status()
    return BeautifulSoup(response.content, 'html.parser')

def detail(entry):
    try:
        s = soup(entry['gdweb_url'])
        if '--inspect' in sys.argv:
            print(s.get_text(' ', strip=True)[-9000:])
            print([(a.get_text(' ',strip=True),a.get('href'),a.get('onclick')) for a in s.select('a') if 'http' in str(a.get('href','')) or a.get('onclick')][-30:])
            (ROOT/'gdweb-detail.html').write_text(str(s),encoding='utf-8')
            return entry
        # The live site URL is explicitly labelled in GDWEB's project details.
        external = []
        for a in s.select('a[href]'):
            href = a['href'].strip()
            if href.startswith(('http://', 'https://')) and 'gdweb.co.kr' not in urlparse(href).netloc:
                if a.get_text(strip=True).startswith(('http://','https://','www.')):
                    external.append(href)
        if not external:
            raise ValueError('No explicitly labelled website URL')
        entry['page_url'] = external[0]
        entry['requested_url'] = external[0]
        entry['category'] = 'GDWEB_선정사이트'
        entry['collection'] = 'gdweb'
        entry['assets'] = []
        entry['collection_status'] = 'pending'
        print(entry['company'],entry['page_url'],flush=True)
        return entry
    except Exception as exc:
        print('DISCOVERY FAILED', entry['company'],str(exc),flush=True)
        return None

def main():
    s = soup(BASE+'/main/')
    links = [a for a in s.select('a[href]') if a['href'].startswith('/sub/view.asp') and 'Txt_fgbn=5' in a['href']]
    # Homepage order: latest 24, finalists 10, BEST 10, GOOD 10.
    selected = [(a,'신규 선정') for a in links[:24]] + [(a,'BEST') for a in links[34:40]] + [(a,'GOOD') for a in links[44:50]]
    entries = []
    for a,group in selected:
        ident = parse_qs(urlparse(a['href']).query)['str_no'][0]
        parent = a.find_parent('li') or a.parent
        if '--inspect' in sys.argv:
            print(str(parent)[:2200])
        text = parent.get_text(' ',strip=True)
        match = re.search(r'\b(\d{2}\.\d{2}\.\d{2})\b',text)
        name = text[:match.start()].strip() if match else text
        entries.append({'slug':'gdweb-'+ident,'company':name,'gdweb_url':BASE+'/sub/view.asp?Txt_fgbn=5&str_no='+ident,'featured_group':group,'featured_date':'20'+match.group(1).replace('.','-') if match else ''})
    if '--inspect' in sys.argv:
        detail(entries[0])
        return
    with ThreadPoolExecutor(max_workers=3) as pool:
        rows = [r for r in pool.map(detail,entries) if r]
    (ROOT/'gdweb-seeds.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding='utf-8')
    print('Discovered',len(rows))

if __name__ == '__main__':
    main()
