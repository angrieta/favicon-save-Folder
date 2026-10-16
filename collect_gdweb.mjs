// Collect public reference material from GDWEB's linked websites, not GDWEB itself.
// node collect_gdweb.mjs [--limit 3] [--workers 3] [--retry] [--slug gdweb-27945]
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Browser, sleep, trackNetwork, webpSize, withTimeout } from './cdp.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const option = (key, fallback) => args.includes(key) ? args[args.indexOf(key) + 1] : fallback;
const workers = Number(option('--workers', 3));
const stamp = new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const sha = b => createHash('sha256').update(b).digest('hex');
const file = name => path.join(ROOT,name);

function inspectPage() {
  const clean = value => String(value || '').replace(/\s+/g,' ').trim();
  const visible = e => {
    const r=e.getBoundingClientRect(), s=getComputedStyle(e);
    return r.width>0 && r.height>0 && s.display!=='none' && s.visibility!=='hidden' && Number(s.opacity)>0.05 && e.checkVisibility({checkOpacity:true,checkVisibilityCSS:true});
  };
  const background = e => {
    for(let p=e;p;p=p.parentElement) { const c=getComputedStyle(p).backgroundColor; if(c!=='rgba(0, 0, 0, 0)' && c!=='transparent') return c; }
    return '#ffffff';
  };
  const label = e => clean(e.getAttribute('aria-label') || e.getAttribute('alt') || e.getAttribute('title') || e.innerText || e.closest('a,button')?.innerText || e.id || e.getAttribute('class')).slice(0,90);
  const candidates=[], seen=new Set();
  const add=(url,type,context='',w=0,h=0) => {
    try { url=new URL(url,location.href).href; } catch { return; }
    if(!/^https?:/.test(url) || seen.has(url)) return;
    seen.add(url); candidates.push({url,type,label:clean(context).slice(0,90),width:w,height:h});
  };
  const classify=(identity,w,h) => /logo|wordmark|symbol/i.test(identity)?'logo':/icon|ico_|arrow|chevron/i.test(identity)?'graphic':/banner|visual|hero|keyvisual|main_bg/i.test(identity) || (w>700&&w/h>2)?'banner':'reference';
  document.querySelectorAll('link[rel*=icon]').forEach(e=>add(e.href,/apple-touch/.test(e.rel)?'appicon':'favicon',e.rel));
  add('/favicon.ico','favicon','favicon fallback');
  document.querySelectorAll('meta[property="og:image"],meta[name="twitter:image"]').forEach(e=>add(e.content,'social','소셜 공유 이미지'));
  document.querySelectorAll('img').forEach(e=>{
    const identity=[e.src,e.alt,e.className,e.parentElement?.className].join(' ');
    if(e.naturalWidth>=90 || e.naturalHeight>=90 || /logo|icon|ico_|symbol/.test(identity)) add(e.currentSrc||e.src,classify(identity,e.naturalWidth,e.naturalHeight),e.alt,e.naturalWidth,e.naturalHeight);
    for(const a of ['data-src','data-original','data-lazy-src']) if(e.getAttribute(a)) add(e.getAttribute(a),classify(identity,0,0),e.alt);
  });
  [...document.querySelectorAll('body *')].slice(0,3500).forEach(e=>{
    if(['SCRIPT','STYLE','LINK','META'].includes(e.tagName))return;
    const s=getComputedStyle(e),r=e.getBoundingClientRect();
    if(r.width<24 || r.height<24)return;
    for(const m of s.backgroundImage.matchAll(/url\(["']?(.*?)["']?\)/g)) add(m[1],classify(`${m[1]} ${e.className}`,r.width,r.height),'CSS 배경');
  });
  document.querySelectorAll('video[poster]').forEach(e=>add(e.poster,'banner','영상 포스터'));
  const components=[], elements=[], counts={}, signatures=new Set();
  const component=(e,type,max) => {
    if(!e || !visible(e) || (counts[type]||0)>=max)return;
    const r=e.getBoundingClientRect(),s=getComputedStyle(e);
    if(r.width<10||r.height<10||r.width>innerWidth+2||r.height>1800)return;
    const text=label(e), signature=type+'|'+text+'|'+Math.round(r.width)+'|'+Math.round(r.height)+'|'+s.backgroundColor;
    if(signatures.has(signature))return;
    signatures.add(signature); counts[type]=(counts[type]||0)+1;
    components.push({index:elements.length,type,label:text||({header:'헤더·내비게이션',footer:'푸터',icon:'인터페이스 아이콘',logo:'로고'}[type]||type),background:background(e),styles:{font:s.fontFamily,fontSize:s.fontSize,color:s.color,background:s.backgroundColor,borderRadius:s.borderRadius,border:s.border,padding:s.padding}});
    elements.push(e);
  };
  component(document.querySelector('header,[role=banner],#header,.header'),'header',1);
  component(document.querySelector('footer,[role=contentinfo],#footer,.footer'),'footer',1);
  document.querySelectorAll('button,a,[role=button],input[type=submit]').forEach(e=>{
    const r=e.getBoundingClientRect(),s=getComputedStyle(e),t=clean(e.innerText||e.value||e.getAttribute('aria-label'));
    const styled=e.tagName==='BUTTON'||/btn|button|cta/i.test(e.className)||s.backgroundColor!=='rgba(0, 0, 0, 0)'||parseFloat(s.borderTopWidth)>0;
    if(styled && r.width>=32&&r.width<=480&&r.height>=24&&r.height<=140&&t.length<100)component(e,'button',12);
  });
  document.querySelectorAll('svg,img,i,[class*=icon],[class*=ico_]').forEach(e=>{
    const r=e.getBoundingClientRect(),identity=`${e.getAttribute('class')} ${e.getAttribute('src')} ${e.getAttribute('alt')}`;
    if(/logo|wordmark|symbol/i.test(identity) && r.width<=500 && r.height<=250)component(e,'logo',3);
    else if(r.width<=86&&r.height<=86&&!e.querySelector('svg,img')&&e.closest('a,button,nav,header,footer'))component(e,'icon',18);
  });
  window.__gdwebComponents=elements;
  const fonts=[...new Set([...document.querySelectorAll('h1,h2,p,button,a')].filter(visible).map(e=>getComputedStyle(e).fontFamily))].slice(0,6);
  return {title:document.title,url:location.href,text:clean(document.body.innerText).slice(0,400),candidates:candidates.slice(0,110),components,fonts,description:document.querySelector('meta[name=description]')?.content||'',height:Math.max(document.body.scrollHeight,document.documentElement.scrollHeight)};
}

async function download(candidate,row,dir) {
  try {
    const response=await fetch(candidate.url,{signal:AbortSignal.timeout(16000),headers:{'User-Agent':'Mozilla/5.0','Referer':row.page_url}});
    if(!response.ok)return null;
    const mime=response.headers.get('content-type')||'';
    if(!mime.startsWith('image/'))return null;
    if(Number(response.headers.get('content-length'))>15*1024*1024)return null;
    const buffer=Buffer.from(await response.arrayBuffer());
    if(buffer.length<80||buffer.length>15*1024*1024)return null;
    let ext=({'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/svg+xml':'svg','image/gif':'gif','image/x-icon':'ico','image/vnd.microsoft.icon':'ico','image/avif':'avif'})[mime.split(';')[0]];
    if(!ext)return null;
    if(ext==='svg' && /<script|<foreignObject|onload\s*=/i.test(buffer.toString())) return null;
    const hash=sha(buffer), relative=`${dir}/${candidate.type}-${hash.slice(0,12)}.${ext}`;
    await writeFile(file(relative),buffer);
    return {type:candidate.type,path:relative,source_url:candidate.url,source_pages:[row.page_url],source_tag:candidate.label,bytes:buffer.length,sha256:hash,width:candidate.width,height:candidate.height,variant:'shared',label:candidate.label};
  } catch {return null;}
}

async function collect(browser,seed) {
  const row={...seed,assets:[],layouts:[],errors:[],captured_at:new Date().toISOString()};
  const dir=`gdweb/${seed.slug}`;
  await mkdir(file(dir),{recursive:true});
  for(const device of ['desktop','mobile']) {
    const width=device==='desktop'?1440:390,height=device==='desktop'?900:844;
    const {targetId}=await browser.send('Target.createTarget',{url:'about:blank'});
    const {sessionId}=await browser.send('Target.attachToTarget',{targetId,flatten:true});
    const send=(m,p)=>withTimeout(browser.send(m,p,sessionId),35000,m);
    const evaluate=async(expression)=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.text);return r.result?.value;};
    const network=trackNetwork(browser,sessionId);
    const screenshot=async(type,label,clip,extra={})=>{
      const component=['button','icon','logo','header','footer'].includes(type);
      // Capture losslessly; optimize decoded-identical images after collection.
      const format='png';
      const shot=await send('Page.captureScreenshot',{format,...(format==='webp'?{quality:83}:{}),captureBeyondViewport:!component,clip:{...clip,scale:['button','icon','logo'].includes(type)?2:1}});
      const buffer=Buffer.from(shot.data,'base64'),[w,h]=format==='png'?[buffer.readUInt32BE(16),buffer.readUInt32BE(20)]:webpSize(buffer),hash=sha(buffer);
      const relative=`${dir}/${stamp}-${device}-${type}-${hash.slice(0,10)}.${format}`;
      await writeFile(file(relative),buffer);
      const asset={type,path:relative,width:w,height:h,bytes:buffer.length,sha256:hash,variant:device,label,source_url:row.page_url,source_pages:[row.page_url],captured_at:new Date().toISOString(),...extra};
      row.assets.push(asset);return asset;
    };
    try {
      await send('Page.enable');await send('Network.enable');
      await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:device==='mobile'});
      if(device==='mobile')await send('Emulation.setUserAgentOverride',{userAgent:'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36'});
      const loaded=browser.waitFor('Page.loadEventFired',sessionId,20000);
      const nav=await send('Page.navigate',{url:seed.requested_url});if(nav.errorText)throw Error(nav.errorText);
      await loaded; await network.idle(800,7000);await sleep(4000);
      // Let animated loading overlays finish before measuring the document.
      for(let attempt=0;attempt<8;attempt++) {
        const loading=await evaluate(`(()=>{return [...document.querySelectorAll('[class*=loading],[class*=loader],[id*=loading],[id*=loader]')].some(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>innerWidth*.7&&r.height>innerHeight*.7&&s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity)>.2;});})()`);
        if(!loading)break;
        await sleep(1500);
      }
      await evaluate(`(()=>{const style=document.createElement('style');style.textContent='html,body,*{scroll-behavior:auto!important}';document.head.append(style);return true;})()`);
      await evaluate(`new Promise(async resolve=>{const delay=ms=>new Promise(r=>setTimeout(r,ms));for(let y=0;y<Math.min(Math.max(document.body.scrollHeight,document.documentElement.scrollHeight),30000);y+=innerHeight*.75){window.scrollTo(0,y);await delay(150);}window.scrollTo(0,0);await delay(800);resolve(true);})`);
      await network.idle(600,5000);
      const info=await evaluate(`(${inspectPage.toString()})()`);
      if(!info || /^(Access Denied|Just a moment|403 Forbidden|Error|사이트에 연결할 수 없음)/i.test(info.title) || info.url.startsWith('chrome-error:'))throw Error('Site unavailable: '+info?.title);
      row.page_url=info.url;row.page_title=info.title;
      if(device==='desktop'){row.description=info.description;row.fonts=info.fonts;row.candidates=info.candidates;}
      const contentHeight=Math.max(height,info.height),captureHeight=Math.min(contentHeight,30000);
      await screenshot('hero',device==='desktop'?'PC 첫 화면':'모바일 첫 화면',{x:0,y:0,width,height});
      try { await screenshot('layout',device==='desktop'?'PC 전체 페이지':'모바일 전체 페이지',{x:0,y:0,width,height:captureHeight},{content_height:contentHeight,truncated:contentHeight>30000}); }
      catch(e) { row.errors.push(`${device} layout: ${e.message}`); }
      if(device==='desktop') {
        for(const c of info.components) {
          try {
            const box=await evaluate(`(()=>{const e=window.__gdwebComponents[${c.index}];e.scrollIntoView({block:'center',inline:'center'});return true;})()`);
            await sleep(750);
            const rect=await evaluate(`(()=>{const r=window.__gdwebComponents[${c.index}].getBoundingClientRect();return {x:Math.max(0,r.left+scrollX),y:Math.max(0,r.top+scrollY),width:Math.min(r.width,innerWidth),height:r.height};})()`);
            if(rect?.width>0&&rect?.height>0)await screenshot(c.type,c.label,rect,{background:c.background,styles:c.styles,source_type:'element-capture'});
          }catch(e){row.errors.push(`${c.type}: ${e.message}`);if(/timed out|closed/i.test(e.message))break;}
        }
        // Three viewport-sized section references, with lazy content rendered at each position.
        for(let n=1;n<=3;n++){
          const y=Math.round((Math.min(info.height,20000)-height)*n/4);
          if(y<height*.6)continue;
          await evaluate(`window.scrollTo(0,${y})`);await sleep(500);
          await screenshot('section',`콘텐츠 섹션 ${n}`,{x:0,y,width,height});
        }
      }
    } catch(error) { row.errors.push(`${device}: ${error.message}`); }
    finally {network.stop();await withTimeout(browser.send('Target.closeTarget',{targetId}),8000,'close tab').catch(()=>{});}
  }
  const candidates=(row.candidates||[]).slice(0,90);
  let i=0;const downloaded=[];
  await Promise.all(Array.from({length:4},async()=>{while(i<candidates.length){const a=await download(candidates[i++],row,dir);if(a)downloaded.push(a);}}));
  const hashes=new Set(row.assets.map(a=>a.sha256));
  for(const a of downloaded){if(!hashes.has(a.sha256)){row.assets.push(a);hashes.add(a.sha256);}}
  delete row.candidates;
  row.collection_status=row.assets.some(a=>a.type==='layout')?'collected':'unavailable';
  await writeFile(file(`${dir}/source.json`),JSON.stringify(row,null,2));
  return row;
}

async function main(){
  const seeds=JSON.parse(await readFile(file('gdweb-seeds.json'),'utf8'));
  let rows=[];try{rows=JSON.parse(await readFile(file('gdweb.json'),'utf8'));}catch{}
  let targets=seeds.filter(s=>!rows.some(r=>r.slug===s.slug&&r.collection_status==='collected')||args.includes('--retry'));
  if(option('--slug',''))targets=targets.filter(s=>s.slug===option('--slug',''));
  if(option('--slugs',''))targets=targets.filter(s=>option('--slugs','').split(',').includes(s.slug));
  if(option('--limit',0))targets=targets.slice(0,Number(option('--limit',0)));
  const browser=await Browser.launch();let cursor=0,chain=Promise.resolve();
  try{await Promise.all(Array.from({length:workers},async()=>{
    while(cursor<targets.length){const seed=targets[cursor++];console.log('START',seed.company);
      let row;try{row=await collect(browser,seed);}catch(e){row={...seed,collection_status:'unavailable',errors:[e.message],assets:[]};}
      rows=rows.filter(r=>r.slug!==row.slug);rows.push(row);rows.sort((a,b)=>seeds.findIndex(s=>s.slug===a.slug)-seeds.findIndex(s=>s.slug===b.slug));
      const snapshot=JSON.stringify(rows,null,2);chain=chain.then(()=>writeFile(file('gdweb.json'),snapshot));await chain;
      console.log('DONE',seed.company,row.assets.length,'assets',row.errors?.filter(e=>e.startsWith('desktop:')||e.startsWith('mobile:')).join(';')||'');
    }
  }));}finally{await chain;await browser.close();}
  console.log('COMPLETE',rows.length,'sites',rows.reduce((n,r)=>n+r.assets.length,0),'assets');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
