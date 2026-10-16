// Compile existing source catalogs into cached, collection/year-specific browse packs.
// The original catalogs remain the source of truth and retain every saved-item key.
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
const read = name => JSON.parse(fs.readFileSync(name, 'utf8'));
const context = vm.createContext({console, URL, URLSearchParams, structuredClone,
  document:{querySelector:()=>({}),querySelectorAll:()=>[],documentElement:{}},
  window:{}, localStorage:{getItem:()=>null}, setTimeout, clearTimeout});
vm.runInContext(fs.readFileSync('reference-upgrades.js','utf8'),context);
vm.runInContext(fs.readFileSync('app.js','utf8').split('\nloadSavedState();')[0],context);
context.input = {site:read('site.json'),gdweb:read('gdweb-static.json'),history:read('history.json'),icons:read('icons.json'),analysis:{...read('analysis.json'),...read('gdweb-analysis.json')}};
vm.runInContext('state.analysis=input.analysis;buildItems([...input.site.rows,...input.gdweb],input.site.layouts,input.history,input.icons,input.site.entries);',context);
const rows = vm.runInContext('state.rows',context);
const rowFields=['slug','company','category','sub','region','page_title','official_url','status','collection','gdweb_url','featuredGroup','featuredDate','description','tags','fonts','captureNote','mark','logo'];
const itemFields=['key','kind','part','path','thumb','width','height','format','variant','date','archived','label','weight','rank','sha','style','area','background','truncated','tones'];
const detailFields=['sourceUrl','sourcePage','capturedStyles','region','bytes','sourceType','dhash','dateLabel','type','analysis'];
const groups=new Map();
for(const row of rows){
  const id=row.collection==='gdweb'?`gdweb-${row.featuredDate.slice(0,4)||'unknown'}`:`brands-${crypto.createHash('sha1').update(row.category).digest('hex').slice(0,8)}`;
  if(!groups.has(id)) groups.set(id,[]);
  groups.get(id).push(row);
}
fs.mkdirSync('catalog',{recursive:true});
const write=(stem,data)=>{
  const raw=JSON.stringify(data);
  const hash=crypto.createHash('sha256').update(raw).digest('hex').slice(0,12);
  const path=`catalog/${stem}-${hash}.json`;
  fs.writeFileSync(path,raw);
  return {path,bytes:Buffer.byteLength(raw),gzipBytes:zlib.gzipSync(raw).length};
};
const colors={...read('brand_colors.json'),...(fs.existsSync('gdweb-brand-colors.json')?read('gdweb-brand-colors.json'):{})};
const manifest={version:1,generatedAt:new Date().toISOString(),rowFields,itemFields,detailFields,groups:[],totals:{},colors:write('colors',colors)};
const blank=v=>v===undefined?null:v;
for(const [id,entries] of groups){
  const items=[],details=[];
  const packedRows=entries.map((r,index)=>{
    for(const item of r.items){context.toneItem=item;item.tones=vm.runInContext('toneItem.analysis?TONE_OPTIONS.filter(o=>o.test(toneItem.analysis)).map(o=>o.id):[]',context);items.push([index,...itemFields.map(k=>blank(item[k]))]);details.push(detailFields.map(k=>blank(item[k])));}
    return rowFields.map(k=>blank(r[k]));
  });
  const collection=entries[0].collection;
  const stats={rows:entries.length,images:items.length,captures:entries.filter(r=>r.items.some(i=>i.kind==='layout'&&['page','hero'].includes(i.part))).length,materials:entries.filter(r=>r.items.some(i=>i.kind!=='showcase'&&i.kind!=='layout')).length,layout:entries.flatMap(r=>r.items).filter(i=>i.kind==='layout').length,button:entries.flatMap(r=>r.items).filter(i=>i.kind==='button').length};
  const pack=write(`${id}-browse`,{rows:packedRows,items});
  const detail=write(`${id}-detail`,details);
  manifest.groups.push({id,collection,year:collection==='gdweb'?entries[0].featuredDate.slice(0,4):null,category:entries[0].category,...stats,browse:pack,detail});
  manifest.totals[collection]??={rows:0,images:0,captures:0,materials:0,layout:0,button:0};
  for(const k of Object.keys(stats))manifest.totals[collection][k]+=stats[k];
}
fs.writeFileSync('catalog/manifest.json',JSON.stringify(manifest));
// Remove only obsolete generated hash packs in this exact output directory.
const referenced=new Set([manifest.colors.path,...manifest.groups.flatMap(g=>[g.browse.path,g.detail.path])]);
for(const name of fs.readdirSync('catalog'))if(/-[a-f0-9]{12}\.json$/.test(name)&&!referenced.has(`catalog/${name}`))fs.unlinkSync(`catalog/${name}`);
const report={groups:manifest.groups.length,totals:manifest.totals,browseBytes:manifest.groups.reduce((n,g)=>n+g.browse.bytes,0),browseGzipBytes:manifest.groups.reduce((n,g)=>n+g.browse.gzipBytes,0),gdweb2026:manifest.groups.find(g=>g.id==='gdweb-2026')?.browse};
fs.writeFileSync('catalog/build-report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
