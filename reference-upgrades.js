/* Catalog loading, honest coverage, portable boards, and export previews. */
const catalogRuntime = {manifest:null, loaded:new Set(), details:new Set(), pending:new Map(), items:new Map(), colors:false, ticket:0};

function normalizeCapturedButton(asset) {
  const s=asset.styles;
  if (!s) return null;
  const bg=s.background || 'transparent';
  const transparent=bg==='transparent' || /rgba\([^)]*,\s*0(?:\.0+)?\s*\)/.test(bg);
  const radius=parseFloat(s.borderRadius)||0, height=Number(asset.height)||0;
  const border=s.border && !/^(?:0px|none)|\bnone\b/.test(s.border) ? s.border : '';
  return {variant:transparent ? (border?'outline':'text') : 'filled', shape:radius>=height/2 && radius>0?'pill':radius>0?'rounded':'square',radius,height,font_size:parseFloat(s.fontSize)||0,font_weight:400,bg,fg:s.color||'',border};
}

function friendlyReferenceLabel(label, kind, part='') {
  const text=String(label||'').trim();
  if (!text) return '';
  const known={ 'Previous slide':'이전 슬라이드', 'Next slide':'다음 슬라이드', 'cursor-pointer':'클릭 버튼', 'Sound off':'소리 끄기', 'Sound':'소리 설정' };
  if (known[text]) return known[text];
  if (/lucide|fa[sbr]?\s+fa-|(?:bg|text|border|flex|items|justify|w|h|px|py)-|__[\w-]+|\[[^\]]+\]/.test(text)) {
    if (/ticket/.test(text)) return '티켓 아이콘';
    if (/arrow|chevron/.test(text)) return '이동 화살표';
    if (/menu|hamburger/.test(text)) return '메뉴 아이콘';
    if (/search/.test(text)) return '검색 아이콘';
    if (/close|icon-x/.test(text)) return '닫기 아이콘';
    return kind==='button'?'아이콘 버튼':kind==='icon'?'인터페이스 아이콘':(PART_LABELS[part]||'화면 구성 요소');
  }
  return text;
}

function catalogTotals(collection=state.collection) {
  const totals=Object.entries(catalogRuntime.manifest?.totals||{}).filter(([key])=>collection==='all'||key===collection).map(([,v])=>v);
  return totals.reduce((sum,row)=>{ for(const key in row)sum[key]=(sum[key]||0)+row[key]; return sum; },{});
}

async function cachedCatalogFile(file) {
  if(!catalogRuntime.pending.has(file)) catalogRuntime.pending.set(file,fetchJson(file).catch(error=>{catalogRuntime.pending.delete(file);throw error;}));
  return catalogRuntime.pending.get(file);
}

function hydrateCatalog(group, pack) {
  if(catalogRuntime.loaded.has(group.id)) return;
  const fields=catalogRuntime.manifest;
  const rows=pack.rows.map(values=>{
    const row=Object.fromEntries(fields.rowFields.map((key,i)=>[key,values[i]]));
    row.items=[]; row.colors=state.brandColors[row.slug]||null;
    row.search=`${row.company} ${row.slug.replaceAll('-',' ')} ${categoryLabel(row.category)} ${row.sub} ${row.page_title} ${row.description} ${(row.tags||[]).join(' ')}`.toLocaleLowerCase('ko');
    row.initials=choseong(row.company.replace(/\s+/g,''));
    state.rows.push(row); state.rowBySlug.set(row.slug,row); return row;
  });
  const items=pack.items.map(values=>{
    const item=Object.fromEntries(fields.itemFields.map((key,i)=>[key,values[i+1]]));
    item.row=rows[values[0]]; item.ratio=item.width&&item.height?item.width/item.height:1;
    item.formatGroup=formatGroup(item.format); item.jitter=hashString(item.key)%1000;
    item.analysis=null; item.sourceUrl=''; item.sourcePage=''; item.bytes=0; item.dhash=''; item.region=null;
    item.dateLabel=item.kind==='showcase'?'GDWEB 선정일':'수집 날짜'; item._catalogGroup=group.id;
    item.row.items.push(item); state.items.push(item);
    if(!state.itemByKey.has(item.key)||state.itemByKey.get(item.key).archived)state.itemByKey.set(item.key,item);
    if(!state.itemByKey.has(item.path))state.itemByKey.set(item.path,item);
    return item;
  });
  catalogRuntime.items.set(group.id,items); catalogRuntime.loaded.add(group.id);
}

async function ensureCatalogDetails(ids) {
  await Promise.all([...new Set(ids)].filter(id=>id&&!catalogRuntime.details.has(id)).map(async id=>{
    const group=catalogRuntime.manifest.groups.find(g=>g.id===id);
    const values=await cachedCatalogFile(group.detail.path);
    const items=catalogRuntime.items.get(id)||[];
    values.forEach((data,index)=>{
      const item=items[index]; if(!item)return;
      catalogRuntime.manifest.detailFields.forEach((key,i)=>item[key]=data[i]);
      if(item.analysis&&item.sha)state.analysis[item.sha]=item.analysis;
      delete item.labs;
    });
    catalogRuntime.details.add(id);
  }));
}

async function ensureCatalogColors() {
  if(catalogRuntime.colors)return;
  state.brandColors=await cachedCatalogFile(catalogRuntime.manifest.colors.path);
  state.rows.forEach(row=>row.colors=state.brandColors[row.slug]||null);
  catalogRuntime.colors=true;
}

async function ensureCatalogScope() {
  if(!catalogRuntime.manifest) return;
  const groups=catalogRuntime.manifest.groups.filter(g=>(state.collection==='all'||g.collection===state.collection)&&(g.collection!=='gdweb'||state.featuredYear==='all'||g.year===state.featuredYear));
  const results=await Promise.allSettled(groups.filter(g=>!catalogRuntime.loaded.has(g.id)).map(async group=>hydrateCatalog(group,await cachedCatalogFile(group.browse.path))));
  const failed=results.filter(r=>r.status==='rejected');
  const notice=$('#catalog-notice');
  notice.hidden=!failed.length;
  if(failed.length)notice.querySelector('span').textContent=`일부 목록 ${failed.length}개를 불러오지 못했습니다. 확인된 자료부터 보여드립니다.`;
  if(groups.length&&!groups.some(g=>catalogRuntime.loaded.has(g.id)))throw new Error('목록 연결 실패');
  if(state.color&&state.view!=='colors')await ensureCatalogDetails(groups.map(g=>g.id));
  if(state.view==='colors')await ensureCatalogColors();
}

async function refreshCatalogView({push=false,keepScroll=false}={}) {
  const ticket=++catalogRuntime.ticket;
  $('#library').setAttribute('aria-busy','true');
  try {
    await ensureCatalogScope();
    if(ticket!==catalogRuntime.ticket)return;
    elements.error.hidden=true; elements.loading.hidden=true;
    if(push)writeUrl(true);
    render({keepScroll});
  } catch(error) {
    if(ticket!==catalogRuntime.ticket)return;
    elements.loading.hidden=true;
    $('#catalog-notice').hidden=false;
    $('#catalog-notice span').textContent='선택한 자료를 불러오지 못했습니다. 다시 시도해 주세요.';
    if(!state.items.length)elements.error.hidden=false;
  } finally { if(ticket===catalogRuntime.ticket)$('#library').removeAttribute('aria-busy'); }
}

async function loadPackedLibrary() {
  catalogRuntime.restoring=true;
  try {
    catalogRuntime.manifest=await fetchJson('catalog/manifest.json?v=13');
    const itemKey=readUrl();
    await refreshCatalogView();
    updateSyncDialog();
    if(itemKey&&state.itemByKey.has(itemKey)) await openViewer([state.itemByKey.get(itemKey)],0);
    else if(state.profile&&state.rowBySlug.has(state.profile))await openBrand(state.rowBySlug.get(state.profile));
    if(state.syncId)syncNow({quiet:true});
  } catch(error) { elements.loading.hidden=true;elements.error.hidden=false;elements.resultCount.textContent='자료를 불러오지 못했습니다.';console.error(error); }
  finally {catalogRuntime.restoring=false;writeUrl();}
}

function coverageOf(row) {
  const captures=row.items.some(item=>item.kind==='layout'&&['page','hero'].includes(item.part));
  const materials=row.items.some(item=>item.kind!=='showcase'&&item.kind!=='layout');
  return {captures,materials,label:captures?'현재 화면 보유':materials?'원본 소재 보유':'선정 화면만 보유'};
}

function renderCoverage(row) {
  const status=coverageOf(row),wrap=make('div','coverage-labels');
  const badge=make('span',status.captures?'coverage-capture':status.materials?'coverage-material':'coverage-archive',status.label);
  badge.prepend(icon(status.captures?'monitor':status.materials?'stack':'clock-counter-clockwise'));wrap.append(badge);
  if(status.captures&&status.materials)wrap.append(make('span','coverage-material','소재 보유'));
  if(!row.official_url)wrap.append(make('span','coverage-missing','원사이트 주소 미확인'));
  return wrap;
}

function renderCollectionSummary() {
  // Browser comment 1: scoped counts, stronger hierarchy, and honest coverage.
  const rows=state.rows.filter(row=>inCollection(row)&&(!state.brand||row.slug===state.brand));
  const live=rows.flatMap(row=>row.items).filter(item=>!item.archived);
  const stats=[['선정 기록',rows.length,'buildings'],['이미지',live.length,'images'],['현재 화면',rows.filter(r=>coverageOf(r).captures).length,'monitor'],['버튼',live.filter(i=>i.kind==='button').length,'cursor-click']];
  if(state.collection!=='gdweb')stats[0][0]='사이트';
  elements.summary.replaceChildren(...stats.map(([name,value,glyph])=>{
    const cell=make('div','summary-cell');const dt=make('dt');dt.append(icon(glyph),name);cell.append(dt,make('dd','',numberFormat(value)));return cell;
  }));
  $('#summary-scope').textContent=state.brand?(state.rowBySlug.get(state.brand)?.company||'선택한 사이트'):state.collection==='gdweb'?'GDWEB 컬렉션':state.collection==='brands'?'브랜드 컬렉션':'전체 라이브러리';
  $('#summary-filter-note').textContent=state.brand?'선택한 사이트 기준':[state.materialOnly?'소재 보유 사이트':'',state.featuredYear!=='all'?`${state.featuredYear}년`:'',state.featuredGroup!=='all'?state.featuredGroup:''].filter(Boolean).join(' · ')||'전체 기록 기준';
  const materialCount=rows.filter(r=>coverageOf(r).materials).length;
  $('#summary-footnote').textContent=`${numberFormat(materialCount)}곳에서 개별 소재를 볼 수 있어요`;
  $('#summary-materials').setAttribute('aria-pressed',String(state.materialOnly));
  state.archivedCount=rows.flatMap(r=>r.items).filter(i=>i.archived).length;
}

let exportRequest=null;
async function copySources(items) {
  try{await ensureCatalogDetails(items.map(item=>item._catalogGroup));await copyText(items.map(sourceLine).join('\n'),'출처 목록을 복사했습니다.');}
  catch{toast('출처 정보를 불러오지 못했습니다. 다시 시도해 주세요.','error');}
}
function exportZip(items,name) {
  if(!items.length){toast('저장할 이미지가 없습니다.','error');return;}
  exportRequest={items:[...items],name};
  const local=items.filter(i=>!isRemoteImage(i)),remote=items.length-local.length;
  $('#export-summary').textContent=`이미지 ${numberFormat(local.length)}개 · 외부 원본 링크 ${numberFormat(remote)}개`;
  $('#export-explanation').textContent=remote?'외부 원본은 이 ZIP에 이미지로 포함되지 않습니다. 바로 열 수 있는 링크 목록과 출처 CSV를 함께 저장합니다.':'이미지 원본과 출처 CSV를 함께 저장합니다.';
  $('#export-start').textContent=local.length?'이미지와 출처 저장':'출처 링크 모음 저장';
  $('#export-progress').textContent=''; $('#export-start').disabled=false;
  $('#export-dialog').showModal();
}

function backupPayload(){return {application:'brand-reference',version:1,exportedAt:new Date().toISOString(),favorites:state.favorites,boards:state.boards};}
function restoreSavedKeys() {
  let changed=false; const restored={};
  for(const [key,record] of Object.entries(state.favorites)){
    const item=state.itemByKey.get(key)||state.itemByKey.get(record?.asset?.path);
    const canonical=item?.key||key;
    const normalized={...record,boards:Array.isArray(record?.boards)?record.boards:[]};
    if(canonical!==key||!Array.isArray(record?.boards))changed=true;
    if(!restored[canonical]||String(normalized.updatedAt||'')>String(restored[canonical].updatedAt||''))restored[canonical]=normalized;
  }
  if(changed){state.favorites=restored;persistSavedState();}
}
function validateBackup(payload) {
  if(payload?.application!=='brand-reference'||payload.version!==1||!payload.favorites||typeof payload.favorites!=='object'||Array.isArray(payload.favorites)||!payload.boards||typeof payload.boards!=='object'||Array.isArray(payload.boards))throw new Error('브랜드 레퍼런스 백업 파일을 선택해 주세요.');
  if(Object.keys(payload.favorites).length>200000||Object.keys(payload.boards).length>10000)throw new Error('백업 항목 수가 너무 많습니다.');
  const safeKey=k=>!['__proto__','prototype','constructor'].includes(k);
  const boards=Object.fromEntries(Object.entries(payload.boards).filter(([k])=>safeKey(k)).map(([k,v])=>{
    if(!v||typeof v.name!=='string'||!Number.isFinite(Date.parse(v.updatedAt)))throw new Error('보드 정보가 올바르지 않습니다.');
    return[k,{name:cleanText(v.name).slice(0,40),createdAt:v.createdAt||v.updatedAt,updatedAt:v.updatedAt,deleted:!!v.deleted}];
  }));
  const favorites=Object.fromEntries(Object.entries(payload.favorites).filter(([k])=>safeKey(k)).map(([k,v])=>{
    if(!v||typeof v.selected!=='boolean'||(v.boards!==undefined&&!Array.isArray(v.boards))||!Number.isFinite(Date.parse(v.updatedAt)))throw new Error('저장한 자료 정보가 올바르지 않습니다.');
    return[k,{...v,boards:(v.boards||[]).filter(b=>typeof b==='string'&&safeKey(b)),selected:v.selected}];
  }));
  return {favorites,boards};
}

let pendingBackup=null;
function setupReferenceUpgrades() {
  $('#catalog-retry').addEventListener('click',()=>refreshCatalogView());
  $('#summary-materials').addEventListener('click',()=>setFilter({brand:'',kind:'all',parts:[],bvariants:[],bshapes:[],areas:[],materialOnly:!state.materialOnly,view:'brands'}));
  $('#browse-more').addEventListener('click',()=>{const open=$('#browse-more').getAttribute('aria-expanded')!=='true';$('#browse-more').setAttribute('aria-expanded',String(open));document.body.classList.toggle('browse-expanded',open);});
  $('#backup-export').addEventListener('click',()=>saveBlob(new Blob([JSON.stringify(backupPayload(),null,2)],{type:'application/json'}),`레퍼런스-보관함-${new Date().toISOString().slice(0,10)}.json`));
  $('#backup-import').addEventListener('click',()=>$('#backup-file').click());
  $('#backup-file').addEventListener('change',async event=>{
    const file=event.target.files[0]; event.target.value=''; if(!file)return;
    try { if(file.size>20*1024*1024)throw new Error('20MB 이하의 백업 파일을 선택해 주세요.');pendingBackup=validateBackup(JSON.parse(await file.text()));$('#backup-summary').textContent=`저장한 자료 ${Object.values(pendingBackup.favorites).filter(r=>r.selected||r.boards.length).length}개 · 보드 ${Object.values(pendingBackup.boards).filter(b=>!b.deleted).length}개`;$('#backup-dialog').showModal(); }
    catch(error){toast(error.message||'백업 파일을 읽을 수 없습니다.','error');}
  });
  $('#backup-apply').addEventListener('click',()=>{
    if(!pendingBackup)return;
    state.favorites=mergeByUpdatedAt(state.favorites,pendingBackup.favorites);state.boards=mergeByUpdatedAt(state.boards,pendingBackup.boards);
    restoreSavedKeys();
    pendingBackup=null;$('#backup-dialog').close();savedChanged();toast('보관함을 가져왔습니다. 기존 자료와 병합했습니다.');
  });
  $('#export-start').addEventListener('click',async()=>{
    if(!exportRequest)return; const request=exportRequest;$('#export-start').disabled=true;
    try{await ensureCatalogDetails(request.items.map(i=>i._catalogGroup));await performZipExport(request.items,request.name);$('#export-dialog').close();document.body.append(elements.toast);}
    catch(error){$('#export-progress').textContent='저장하지 못했습니다. 다시 시도해 주세요.';}
    finally{$('#export-start').disabled=false;}
  });
  for(const name of ['export','backup']){$(`#${name}-close`).addEventListener('click',()=>$(`#${name}-dialog`).close());closeOnBackdrop($(`#${name}-dialog`));}
}
