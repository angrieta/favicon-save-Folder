/* Discovery controls shared by the brand and GDWEB catalogs. */
const RECENT_REFERENCES_KEY = "brand-library-recent-v1";
let recentReferences = [];
try { const saved = JSON.parse(localStorage.getItem(RECENT_REFERENCES_KEY) || "[]"); if (Array.isArray(saved)) recentReferences = saved.slice(0,24); } catch {}

function rememberReference(row, item) {
  const record = {slug: row.slug, key: item?.key || "", at: Date.now()};
  if (recentReferences[0]?.slug === record.slug && recentReferences[0]?.key === record.key) return;
  recentReferences = [record, ...recentReferences.filter(previous => previous.slug !== record.slug || previous.key !== record.key)].slice(0,24);
  try { localStorage.setItem(RECENT_REFERENCES_KEY, JSON.stringify(recentReferences)); } catch {}
}

function openRecentReferences() {
  const content = $("#recent-content");
  const entries = recentReferences.filter(record => state.rowBySlug.has(record.slug));
  content.replaceChildren();
  if (!entries.length) content.append(make("p", "recent-empty", "살펴본 사이트와 이미지가 여기에 모입니다. 마음에 드는 자료를 열어보세요."));
  entries.forEach(record => {
    const row = state.rowBySlug.get(record.slug);
    const item = state.itemByKey.get(record.key);
    const cover = item || row.items.find(i => i.kind === "showcase") || row.items.find(i => i.kind === "layout") || row.items[0];
    const entry = button("recent-entry", "", () => {
      $("#recent-dialog").close();
      if (item) openViewer([item], 0); else openBrand(row);
    });
    if (cover) { const image = make("img"); image.src = tileSrc(cover); image.alt = ""; image.loading = "lazy"; entry.append(image); }
    const label = make("span");
    label.append(make("strong", "", row.company), make("small", "", item ? itemCaption(item) : "사이트 자료"));
    entry.append(label, icon("arrow-up-right"));
    content.append(entry);
  });
  $("#recent-dialog").showModal();
}

function referencePresets() {
  const gdweb = state.collection === "gdweb";
  return [
    {label: "전체 화면", icon: "browsers", patch: {kind:gdweb ? "showcase" : "layout", parts:gdweb ? [] : ["page"], view:"wall"}},
    {label: "버튼·CTA", icon: "cursor-click", patch: {kind:"button", view:"wall"}},
    {label: "로고", icon: "seal", patch: {kind:"logo", view:"wall"}},
    {label: "아이콘", icon: "circles-four", patch: {kind:"icon", view:"wall"}},
    {label: "모바일", icon: "device-mobile", patch: {kind:gdweb ? "showcase" : "layout", devices:["mobile"], view:"wall"}},
    gdweb
      ? {label: "세부 소재 보유", icon: "stack", patch: {materialOnly:true, view:"brands"}}
      : {label: "컬러 찾기", icon: "palette", patch: {view:"colors"}}
  ];
}

function renderReferenceTools() {
  const isGdweb = state.collection === "gdweb";
  const isSaved = state.view === "saved";
  document.body.classList.toggle("gdweb-active", isGdweb);
  document.querySelectorAll("[data-collection]").forEach(control => control.setAttribute("aria-pressed", String(control.dataset.collection === state.collection)));
  $("#intro-title").textContent = isSaved ? "아이디어를 모아둔 곳." : isGdweb ? "좋은 웹의 디테일을 모으다." : "다음 디자인의 시작점.";
  $("#intro-description").textContent = isSaved ? "마음에 든 이미지를 프로젝트별 보드에 정리하고, 나란히 비교해보세요." : isGdweb ? "GDWEB이 소개한 사이트를 둘러보고, 필요한 화면과 소재를 찾아보세요." : "웹사이트의 전체 화면부터 작은 버튼까지. 필요한 레퍼런스를 찾고, 모으고, 비교하세요.";
  const scoped = state.rows.filter(row => state.collection === "all" || row.collection === state.collection);
  $("#intro-count").textContent = numberFormat(isSaved ? boardItems().length : scoped.length);
  $("#intro-unit").textContent = isSaved ? "저장한 이미지" : isGdweb ? "GDWEB 선정 기록" : "사이트 레퍼런스";
  $("#quick-presets").hidden = isSaved;
  const presets = referencePresets();
  $("#quick-presets").replaceChildren(...presets.map(preset => {
    const active = state.view === preset.patch.view && Object.entries(preset.patch).every(([key,value]) => JSON.stringify(state[key]) === JSON.stringify(value));
    return withIcon(button("preset", preset.label, () => setFilter({...structuredClone(DEFAULT_FILTERS), collection:state.collection, ...preset.patch}), {"aria-pressed":String(active)}), preset.icon);
  }));
  const archive = $("#archive-filters");
  archive.hidden = !isGdweb || isSaved;
  if (!archive.hidden) {
    $("#collection-groups").replaceChildren(...["all","국내 웹","해외 웹","일본 웹","모바일"].map(group => button("archive-group", group === "all" ? "모든 지역" : group, () => setFilter({featuredGroup:group}), {"aria-pressed":String(state.featuredGroup === group)})));
    const select = $("#collection-year");
    if (select.options.length < 2 && scoped.length) {
      [...new Set(scoped.map(row => row.featuredDate.slice(0,4)))].filter(Boolean).sort().reverse().forEach(year => { const option = make("option","",`${year}년`); option.value=year; select.append(option); });
    }
    select.value = state.featuredYear;
    $("#collection-region").value = state.featuredGroup;
  }
  $("#search-clear").hidden = !state.q;
  $("#scope-note").hidden = !isSaved;
  $("#library-intro").hidden = Boolean(state.brand);
  const gdwebCount = state.rows.filter(row => row.collection === "gdweb").length;
  $("#gdweb-nav-count").textContent = numberFormat(gdwebCount);
}

function setupReferenceTools() {
  const mobileFilters = matchMedia("(max-width: 980px)");
  const updateFilterAccess = () => {
    if (!mobileFilters.matches && document.body.classList.contains("filters-open")) document.body.classList.remove("filters-open");
    const open = mobileFilters.matches && document.body.classList.contains("filters-open");
    elements.filterPanel.inert = mobileFilters.matches && !open;
    elements.filterOpen.setAttribute("aria-expanded", String(open));
    $("#filter-scrim").hidden = !open;
    if (open) { elements.filterPanel.setAttribute("role", "dialog"); elements.filterPanel.setAttribute("aria-modal", "true"); }
    else { elements.filterPanel.removeAttribute("role"); elements.filterPanel.removeAttribute("aria-modal"); }
  };
  new MutationObserver(updateFilterAccess).observe(document.body, {attributes:true, attributeFilter:["class"]});
  mobileFilters.addEventListener("change", updateFilterAccess);
  updateFilterAccess();
  elements.filterOpen.addEventListener("click", () => requestAnimationFrame(() => elements.filterClose.focus()));
  elements.filterClose.addEventListener("click", () => elements.filterOpen.focus());
  $("#filter-scrim").addEventListener("click", () => { document.body.classList.remove("filters-open"); elements.filterOpen.focus(); });
  document.addEventListener("keydown", event => {
    if (!mobileFilters.matches || !document.body.classList.contains("filters-open")) return;
    if (event.key === "Escape") { document.body.classList.remove("filters-open"); elements.filterOpen.focus(); return; }
    if (event.key !== "Tab") return;
    const controls = [...elements.filterPanel.querySelectorAll("button, input, select, summary, a[href]")].filter(el => !el.disabled && el.getClientRects().length);
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  });
  $("#collection-nav").addEventListener("click", event => {
    const target = event.target.closest("[data-collection]");
    if (!target) return;
    setFilter({...structuredClone(DEFAULT_FILTERS), collection:target.dataset.collection, view:target.dataset.collection === "gdweb" ? "brands" : "wall"});
  });
  $("#collection-year").addEventListener("change", event => setFilter({featuredYear:event.target.value}));
  $("#collection-region").addEventListener("change", event => setFilter({featuredGroup:event.target.value}));
  $("#recent-open").addEventListener("click", openRecentReferences);
  $("#recent-close").addEventListener("click", () => $("#recent-dialog").close());
  closeOnBackdrop($("#recent-dialog"));
  $("#share-view").addEventListener("click", () => { writeUrl(); copyText(location.href, "현재 보기 링크를 복사했습니다. 검색과 필터도 함께 전달됩니다."); });
  $("#reset-visible").addEventListener("click", resetFilters);
  $("#search-clear").addEventListener("click", () => { setFilter({q:""}); elements.search.focus(); });
  $("#retry-library").addEventListener("click", () => location.reload());
}
