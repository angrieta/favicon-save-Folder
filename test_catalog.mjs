// Regression checks for catalog splitting, saved-key continuity and real filters.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const notice={hidden:true,querySelector:()=>({textContent:''})};
const context=vm.createContext({console,URL,URLSearchParams,structuredClone,setTimeout,clearTimeout,Blob,TextEncoder,
  document:{querySelector:()=>notice,querySelectorAll:()=>[],documentElement:{}},window:{},localStorage:{getItem:()=>null}});
vm.runInContext(fs.readFileSync('reference-upgrades.js','utf8'),context);
vm.runInContext(fs.readFileSync('app.js','utf8').split('\nloadSavedState();')[0],context);
const run=code=>vm.runInContext(code,context);
context.input={site:read('site.json'),gdweb:read('gdweb-static.json'),history:read('history.json'),icons:read('icons.json'),analysis:{...read('analysis.json'),...read('gdweb-analysis.json')}};
run('state.analysis=input.analysis;buildItems([...input.site.rows,...input.gdweb],input.site.layouts,input.history,input.icons,input.site.entries);');
const original=run('state.items');
const keys=new Set(original.map(i=>i.key));
const styles=original.filter(i=>i.row.collection==='gdweb'&&i.kind==='button');
assert.equal(styles.length,102);
assert(styles.every(i=>i.style?.variant&&i.style?.shape));
assert(styles.some(i=>i.style.variant==='outline'));
assert(styles.some(i=>i.style.variant==='filled'));
context.manifest=read('catalog/manifest.json');
run('state.rows=[];state.items=[];state.rowBySlug=new Map();state.itemByKey=new Map();catalogRuntime.manifest=manifest;');
for(const group of context.manifest.groups){context.group=group;context.pack=read(group.browse.path);run('hydrateCatalog(group,pack)');}
assert.equal(run('state.items.length'),original.length);
assert.deepEqual(new Set(run('state.items').map(i=>i.key)),keys);
for(const group of context.manifest.groups){
  const pack=read(group.browse.path),detail=read(group.detail.path);
  assert.equal(pack.items.length,detail.length);
  for(const values of pack.items)assert(values[0]>=0&&values[0]<pack.rows.length);
}
context.fetchPack=async path=>read(path);
run('fetchJson=fetchPack');
await run('ensureCatalogDetails(manifest.groups.map(g=>g.id))');
const after=run('state.items');
const beforeMap=new Map(original.map(i=>[`${i.row.slug}|${i.key}|${i.path}|${i.kind}|${i.part}|${i.archived}`,i]));
for(const item of after){
  const old=beforeMap.get(`${item.row.slug}|${item.key}|${item.path}|${item.kind}|${item.part}|${item.archived}`);
  assert(old,`Lost source item ${item.key}`);
  for(const field of ['path','thumb','sourceUrl','sourcePage','width','height','format','bytes','archived'])assert.equal(item[field],old[field],`${item.key}:${field}`);
  assert.equal(JSON.stringify(item.region),JSON.stringify(old.region));
}
run(`Object.assign(state,structuredClone(DEFAULT_FILTERS),{collection:'gdweb',kind:'button',bvariants:['outline']});state.activeDimensions=DIMENSIONS.filter(d=>d.active());`);
assert(run('state.items.filter(i=>matchesItem(i)&&itemPasses(i)).length')>0);
run(`Object.assign(state,{q:'button',collection:'gdweb',brand:''});`);
assert.equal(run(`matchesItem({row:{collection:'brands',slug:'test',featuredDate:'',featuredGroup:'',items:[]},label:'button'})`),false);
context.backup={application:'brand-reference',version:1,boards:{one:{name:'보드',updatedAt:'2026-10-16T00:00:00.000Z'}},favorites:{a:{selected:true,boards:['one'],updatedAt:'2026-10-16T00:00:00.000Z'}}};
assert.equal(run('validateBackup(backup).favorites.a.selected'),true);
delete context.backup.favorites.a.boards;
assert.equal(run('validateBackup(backup).favorites.a.boards.length'),0);
const legacyItem=after.find(i=>i.path==='assets/장기렌트_리스/lease-cf09d63a2c/banner-001.webp');
assert(legacyItem);
context.legacyItem=legacyItem;
run('persistSavedState=()=>{};state.favorites={[legacyItem.path]:{selected:true,updatedAt:"2026-09-02"}};restoreSavedKeys();');
assert.equal(run('state.favorites[legacyItem.key].selected'),true);
assert.equal(run('Object.keys(state.favorites).length'),1);
assert.throws(()=>run('validateBackup({application:"wrong",version:1})'));
assert.equal(run(`mergeByUpdatedAt({a:{updatedAt:'2026-10-16',selected:true}},{a:{updatedAt:'2026-10-15',selected:false}}).a.selected`),true);
// A single unavailable browse pack must leave successful collections available.
context.goodGroup=context.manifest.groups[0];
context.badGroup={id:'test-unavailable',collection:'gdweb',year:'2026',browse:{path:'unavailable.json'}};
run(`catalogRuntime.manifest={groups:[goodGroup,badGroup]};Object.assign(state,structuredClone(DEFAULT_FILTERS));`);
await run('ensureCatalogScope()');
assert.equal(notice.hidden,false);
assert(run('state.items.length')>0);
console.log(JSON.stringify({passed:true,preservedItems:after.length,preservedKeys:keys.size,gdwebButtons:styles.length,checks:['pack round trip','saved keys','source/crop fidelity','button filters','collection isolation','backup validation/merge','partial failure resilience']},null,2));
