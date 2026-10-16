/* Brand image reference library */

const KINDS = [
  { id: "all", label: "전체" },
  { id: "layout", label: "레이아웃", hint: "전체 페이지, 첫 화면, 헤더, 네비게이션, 섹션, 카드, 푸터, 플로팅, 팝업" },
  { id: "showcase", label: "선정 당시 화면", hint: "GDWEB에서 소개한 개별 웹사이트의 이미지" },
  { id: "button", label: "버튼", hint: "채움·라인 버튼을 스타일별로 하나씩" },
  { id: "banner", label: "배너", hint: "메인 비주얼, 프로모션, 캠페인 영역" },
  { id: "logo", label: "로고", hint: "헤더, 푸터, 구조화 데이터의 로고" },
  { id: "icon", label: "메뉴·버튼 아이콘", hint: "메뉴, 버튼, 링크에 쓰인 아이콘" },
  { id: "social", label: "소셜 공유", hint: "링크 공유 시 보이는 대표 이미지(OG)" },
  { id: "photo", label: "사진·콘텐츠", hint: "제품, 서비스, 콘텐츠 사진" },
  { id: "graphic", label: "그래픽·아이콘", hint: "일러스트, 아이콘, 단색 그래픽" },
  { id: "appicon", label: "앱 아이콘", hint: "홈 화면 추가용 큰 아이콘" },
  { id: "favicon", label: "파비콘", hint: "브라우저 탭 아이콘" },
];
const KIND_LABELS = Object.fromEntries(KINDS.map((kind) => [kind.id, kind.label]));
const KIND_ORDER = KINDS.slice(1).map((kind) => kind.id);
const CONTAINED_KINDS = new Set(["logo", "favicon", "appicon", "graphic", "icon", "button"]);

// Parts of a page. "page" is the full-page capture; the rest are cut from it or
// captured in their own state (popups, floating widgets, opened menus).
const PART_OPTIONS = [
  { id: "page", label: "전체 페이지", hint: "첫 화면부터 푸터까지 이어 붙인 캡처" },
  { id: "hero", label: "첫 화면", hint: "스크롤하기 전 보이는 화면 (히어로)" },
  { id: "header", label: "헤더", hint: "상단 헤더, 스크롤 시 고정 헤더" },
  { id: "nav", label: "네비게이션", hint: "GNB, 메가메뉴, 모바일 햄버거 메뉴, 전체 메뉴" },
  { id: "section", label: "섹션", hint: "본문을 이루는 가로 전체 영역" },
  { id: "card", label: "카드", hint: "같은 모양이 반복되는 카드 하나" },
  { id: "footer", label: "푸터", hint: "하단 회사 정보와 링크" },
  { id: "floating", label: "플로팅", hint: "퀵메뉴, TOP 버튼, 챗봇, 하단 고정 바, 쿠키 배너" },
  { id: "popup", label: "팝업", hint: "처음 들어오면 뜨는 레이어 팝업·모달" },
  { id: "form", label: "검색·폼", hint: "검색창, 입력 폼" },
  { id: "tab", label: "탭", hint: "탭 메뉴, 슬라이드 인디케이터" },
];
const PART_LABELS = Object.fromEntries(PART_OPTIONS.map((part) => [part.id, part.label]));
const KIND_WEIGHT = { showcase: 2, layout: 0, banner: 0, button: 1, social: 1, photo: 1, logo: 1, icon: 2, graphic: 2, appicon: 3, favicon: 4 };
const PART_WEIGHT = { hero: 0, page: 0.5, section: 0.5, popup: 1, card: 1, nav: 1, header: 1.5, footer: 1.5, floating: 2, form: 2, tab: 2 };
const BUTTON_VARIANT_OPTIONS = [
  { id: "filled", label: "채움" },
  { id: "outline", label: "라인" },
  { id: "text", label: "텍스트" },
];
const BUTTON_SHAPE_OPTIONS = [
  { id: "pill", label: "알약형", hint: "양 끝이 완전히 둥근 버튼" },
  { id: "rounded", label: "둥근 모서리" },
  { id: "square", label: "각진 모서리" },
];
const REGION_OPTIONS = [
  { id: "KR", label: "국내" },
  { id: "GLOBAL", label: "해외" },
];

const CATEGORY_ORDER = [
  "장기렌트_리스", "렌터카_국내", "렌터카_글로벌", "자동차", "금융", "핀테크_결제", "테크_플랫폼", "글로벌_SaaS", "AI_서비스",
  "유통_커머스", "라이프스타일_리테일", "패션_의류", "뷰티_코스메틱", "식품_생활", "가전_디바이스", "게임_엔터", "미디어_콘텐츠",
  "항공_여행", "스포츠_레저", "교육_헬스케어", "부동산_공간", "문화_공공", "디자인_에이전시", "산업_건설_통신",
];

const DEVICE_OPTIONS = [
  { id: "desktop", label: "PC" },
  { id: "mobile", label: "모바일" },
  { id: "shared", label: "공통" },
];
const RATIO_OPTIONS = [
  { id: "wide", label: "초광폭", hint: "2.4:1 이상", test: (r) => r >= 2.4 },
  { id: "landscape", label: "가로형", test: (r) => r >= 1.15 && r < 2.4 },
  { id: "square", label: "정사각형", test: (r) => r >= 0.87 && r < 1.15 },
  { id: "portrait", label: "세로형", test: (r) => r < 0.87 },
];
const WIDTH_OPTIONS = [
  { id: 0, label: "전체" },
  { id: 600, label: "600px+" },
  { id: 1200, label: "1200px+" },
  { id: 1920, label: "1920px+" },
];
const TONE_OPTIONS = [
  { id: "light", label: "밝은 톤", test: (a) => a.l >= 0.7 },
  { id: "dark", label: "어두운 톤", test: (a) => a.l <= 0.32 },
  { id: "vivid", label: "선명한 컬러", test: (a) => a.c >= 0.33 },
  { id: "muted", label: "무채색·차분함", test: (a) => a.c <= 0.1 },
  { id: "transparent", label: "투명 배경", test: (a) => a.a === 1 },
];
const FORMAT_OPTIONS = ["SVG", "PNG", "WEBP", "JPEG", "ICO", "기타"];
const AREA_OPTIONS = [
  { id: "header", label: "헤더" },
  { id: "menu", label: "메뉴" },
  { id: "button", label: "버튼" },
  { id: "link", label: "링크" },
  { id: "footer", label: "푸터" },
];
const COLOR_SWATCHES = [
  { hex: "#e0322d", label: "빨강" },
  { hex: "#f08a24", label: "주황" },
  { hex: "#f3c316", label: "노랑" },
  { hex: "#2f9e4f", label: "초록" },
  { hex: "#17a2a2", label: "청록" },
  { hex: "#2563eb", label: "파랑" },
  { hex: "#1d2d6b", label: "남색" },
  { hex: "#7c3aed", label: "보라" },
  { hex: "#e84f9b", label: "분홍" },
  { hex: "#8a5a36", label: "갈색" },
  { hex: "#111111", label: "검정" },
  { hex: "#8c8c8c", label: "회색" },
  { hex: "#f7f7f5", label: "흰색" },
];
const COVERAGE_OPTIONS = [
  { id: "all", label: "전체" },
  { id: "complete", label: "배너·로고 보유" },
  { id: "missing-banner", label: "배너 없음" },
  { id: "missing-logo", label: "로고 없음" },
];
const DENSITY_WIDTH = { s: 180, m: 250, l: 340, xl: 480 };
const BATCH_SIZE = 90;
const CHOSEONG = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";

const FAVORITES_STORAGE_KEY = "brand-library-favorites-v2";
const BOARDS_STORAGE_KEY = "brand-library-boards-v1";
const SYNC_STORAGE_KEY = "brand-library-favorites-sync-id";
const PREFS_STORAGE_KEY = "brand-library-prefs-v1";
const SYNC_API = "https://mantledb.sh/v2";
const SYNC_PATH = "favorites";
const HEART_BOARD = "hearts";

const $ = (selector) => document.querySelector(selector);

const elements = {
  root: document.documentElement,
  themeToggle: $("#theme-toggle"),
  themeMeta: $('meta[name="theme-color"]'),
  search: $("#search"),
  viewButtons: document.querySelectorAll("[data-view]"),
  savedCount: $("#saved-count"),
  categoryChips: $("#category-chips"),
  kindTabs: $("#kind-tabs"),
  subRow: $("#sub-row"),
  subLabel: $("#sub-label"),
  subChips: $("#sub-chips"),
  colorGrid: $("#color-grid"),
  filterPanel: $("#filter-panel"),
  filterOpen: $("#filter-open"),
  filterClose: $("#filter-close"),
  filterBadge: $("#filter-badge"),
  summary: $("#summary"),
  facets: $("#facets"),
  savedBar: $("#saved-bar"),
  boardTabs: $("#board-tabs"),
  boardRename: $("#board-rename"),
  boardDelete: $("#board-delete"),
  boardSources: $("#board-sources"),
  boardZip: $("#board-zip"),
  resultCount: $("#result-count"),
  sort: $("#sort"),
  shuffle: $("#shuffle"),
  density: $("#density"),
  activeFilters: $("#active-filters"),
  loading: $("#loading-state"),
  error: $("#error-state"),
  empty: $("#empty-state"),
  emptyTitle: $("#empty-title"),
  emptyDescription: $("#empty-description"),
  emptyReset: $("#empty-reset"),
  wall: $("#wall"),
  grid: $("#brand-grid"),
  sentinel: $("#sentinel"),
  selectionBar: $("#selection-bar"),
  selectionCount: $("#selection-count"),
  viewer: $("#viewer"),
  viewerCanvas: $("#viewer-canvas"),
  viewerPosition: $("#viewer-position"),
  viewerPrev: $("#viewer-prev"),
  viewerNext: $("#viewer-next"),
  viewerBg: $("#viewer-bg"),
  viewerZoom: $("#viewer-zoom"),
  viewerClose: $("#viewer-close"),
  viewerCategory: $("#viewer-category"),
  viewerTitle: $("#viewer-title"),
  viewerKind: $("#viewer-kind"),
  viewerActions: $("#viewer-actions"),
  viewerFacts: $("#viewer-facts"),
  viewerPalette: $("#viewer-palette"),
  viewerLinks: $("#viewer-links"),
  viewerRelated: $("#viewer-related"),
  brandDialog: $("#brand-dialog"),
  brandCategory: $("#brand-category"),
  brandTitle: $("#brand-title"),
  brandDescription: $("#brand-description"),
  brandActions: $("#brand-actions"),
  brandContent: $("#brand-content"),
  brandClose: $("#brand-close"),
  compareDialog: $("#compare-dialog"),
  compareContent: $("#compare-content"),
  compareSync: $("#compare-sync"),
  compareClose: $("#compare-close"),
  boardDialog: $("#board-dialog"),
  boardDialogDescription: $("#board-dialog-description"),
  boardOptions: $("#board-options"),
  newBoardName: $("#new-board-name"),
  newBoardCreate: $("#new-board-create"),
  helpOpen: $("#help-open"),
  helpDialog: $("#help-dialog"),
  helpClose: $("#help-close"),
  syncSettings: $("#sync-settings"),
  syncStatus: $("#sync-status"),
  syncDialog: $("#sync-dialog"),
  syncClose: $("#sync-close"),
  syncDisconnected: $("#sync-disconnected"),
  syncConnected: $("#sync-connected"),
  syncCreate: $("#sync-create"),
  syncConnectForm: $("#sync-connect-form"),
  syncCodeInput: $("#sync-code-input"),
  syncCodeOutput: $("#sync-code-output"),
  syncCopy: $("#sync-copy"),
  syncNow: $("#sync-now"),
  syncDisconnect: $("#sync-disconnect"),
  syncMessage: $("#sync-message"),
  toast: $("#toast"),
};

const DEFAULT_FILTERS = {
  collection: "all", featuredGroup: "all", featuredYear: "all", materialOnly: false,
  view: "wall",
  q: "",
  brand: "", profile: "",
  cats: [],
  kind: "all",
  parts: [],
  bvariants: [],
  bshapes: [],
  regions: [],
  devices: [],
  ratios: [],
  minWidth: 0,
  tones: [],
  formats: [],
  areas: [],
  color: "",
  coverage: "all",
  archived: false,
  sort: "recommended",
  board: HEART_BOARD,
};

const state = {
  rows: [],
  rowBySlug: new Map(),
  items: [],
  itemByKey: new Map(),
  analysis: {},
  brandColors: {},
  counts: {},
  colorRows: [],
  colorCounts: {},
  colorFamilies: {},
  ...structuredClone(DEFAULT_FILTERS),
  density: "m",
  seed: Math.floor(Math.random() * 1e9),
  list: [],
  brandList: [],
  rendered: 0,
  columns: [],
  columnHeights: [],
  selection: new Set(),
  lastSelectedIndex: -1,
  favorites: {},
  boards: {},
  syncId: "",
  syncing: false,
  syncTimer: 0,
  viewer: { list: [], index: 0, bg: "checker", zoom: false },
  boardTargets: [],
};

/* ---------- helpers ---------- */

function cleanText(value) {
  return String(value ?? "").replace(/[—–]/g, "-").replace(/\s+/g, " ").trim();
}

function categoryLabel(value) {
  return cleanText(value).replaceAll("_", "·").replace("렌터카·국내", "렌터카 국내").replace("렌터카·글로벌", "렌터카 글로벌");
}

function safeHttpUrl(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function make(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function button(className, text, onClick, attributes = {}) {
  const element = make("button", className, text);
  element.type = "button";
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
  if (onClick) element.addEventListener("click", onClick);
  return element;
}

function link(text, href, className = "") {
  const element = make("a", className, text);
  element.href = href;
  element.target = "_blank";
  element.rel = "noopener";
  return element;
}

const numberFormat = (value) => Number(value || 0).toLocaleString("ko-KR");

function formatBytes(bytes) {
  if (!bytes) return "용량 미확인";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatOf(path) {
  const extension = (path.split("?")[0].split(".").pop() || "").toUpperCase();
  if (extension === "JPG" || extension === "JPEG") return "JPEG";
  return ["SVG", "PNG", "WEBP", "ICO"].includes(extension) ? extension : extension || "IMAGE";
}

function formatGroup(format) {
  return FORMAT_OPTIONS.includes(format) ? format : "기타";
}

function deviceLabel(variant) {
  return variant === "desktop" ? "PC" : variant === "mobile" ? "모바일" : "PC·모바일 공통";
}

function toast(message, tone = "") {
  const host = [...document.querySelectorAll('dialog[open]')].at(-1) || document.body;
  host.append(elements.toast);
  elements.toast.textContent = message;
  elements.toast.dataset.tone = tone;
  elements.toast.hidden = false;
  window.clearTimeout(toast.timer);
  toast.timer = window.setTimeout(() => {
    elements.toast.hidden = true;
  }, 2600);
}

function choseong(text) {
  return [...text].map((char) => {
    const code = char.charCodeAt(0) - 0xac00;
    return code >= 0 && code <= 11171 ? CHOSEONG[Math.floor(code / 588)] : char;
  }).join("");
}

function campaignDate(url) {
  const match = String(url || "").match(/(20[12]\d)[-_/.]?(0[1-9]|1[0-2])[-_/.]?(0[1-9]|[12]\d|3[01])(?!\d)/);
  if (!match) return "";
  const value = `${match[1]}-${match[2]}-${match[3]}`;
  return Date.parse(value) <= Date.now() + 1000 * 60 * 60 * 24 * 60 ? value : "";
}

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6d2b79f5) >>> 0;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return hash >>> 0;
}

function icon(name, className = "") {
  const element = make("i", `ph ph-${name}${className ? ` ${className}` : ""}`);
  element.setAttribute("aria-hidden", "true");
  return element;
}

// Large images have a small copy under thumbs/ for the wall (see build_library.py).
function needsThumb(path, width, height) {
  if (!path || /\.(svg|ico|gif)(\?|$)/i.test(path) || path.startsWith("thumbs/")) return false;
  return width > 640 || height > 1280;
}

function thumbFor(path) {
  return `thumbs/${path.replace(/\.[a-z0-9]+$/i, "")}.webp`;
}

function tileSrc(item) {
  // Keep vector previews vector; a raster thumbnail loses their sharp edges.
  if (!item.region && item.format === "SVG") return item.path;
  return item.thumb || item.path;
}

function isSmallRaster(item, width = item.width, height = item.height) {
  return item.format !== "SVG" && CONTAINED_KINDS.has(item.kind)
    && width > 0 && height > 0 && Math.max(width, height) <= 128;
}

// A small source must not be stretched just because its card is large.
function prepareReferenceImage(image, item, badgeHost = null) {
  if (!CONTAINED_KINDS.has(item.kind)) return;
  image.classList.add(item.format === "SVG" ? "is-vector-reference" : "is-raster-reference");
  if (!badgeHost || item.format === "SVG") return;
  const updateBadge = () => {
    const width = image.naturalWidth, height = image.naturalHeight;
    const existing = badgeHost.querySelector(".source-size");
    if (!isSmallRaster(item, width, height)) { existing?.remove(); return; }
    const badge = existing || make("span", "source-size");
    badge.textContent = `원본 ${width}×${height}`;
    badge.title = "작은 원본은 선명도를 위해 확대하지 않습니다.";
    if (!existing) badgeHost.append(badge);
  };
  image.addEventListener("load", updateBadge);
  if (image.complete && image.naturalWidth) updateBadge();
}

function renderResolutionNote(item) {
  const note = $("#viewer-resolution-note");
  note.hidden = !isSmallRaster(item);
  note.textContent = note.hidden ? "" : `원본이 ${item.width}×${item.height}px인 작은 이미지입니다. 원본 크기 이하로 표시합니다. 더 크게 쓰려면 SVG 또는 고해상도 원본이 필요합니다.`;
}

/* ---------- color ---------- */

function hexToRgb(hex) {
  const value = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16));
}

function rgbToLab([r, g, b]) {
  const linear = [r, g, b].map((channel) => {
    const c = channel / 255;
    return c > 0.04045 ? ((c + 0.055) / 1.055) ** 2.4 : c / 12.92;
  });
  const x = (linear[0] * 0.4124 + linear[1] * 0.3576 + linear[2] * 0.1805) / 0.95047;
  const y = linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
  const z = (linear[0] * 0.0193 + linear[1] * 0.1192 + linear[2] * 0.9505) / 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

function labDistance(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function itemLabs(item) {
  if (!item.labs) item.labs = (item.analysis?.p || []).map(([hex, weight]) => ({ lab: rgbToLab(hexToRgb(hex)), weight }));
  return item.labs;
}

function colorDistance(item, targetLab) {
  let best = Infinity;
  itemLabs(item).forEach(({ lab, weight }) => {
    if (weight < 0.06) return;
    best = Math.min(best, labDistance(lab, targetLab) - weight * 12);
  });
  return best;
}

/* ---------- data ---------- */

function kindOf(type, asset, analysis) {
  if (type === "reference") {
    const longest = Math.max(asset.width || 0, asset.height || 0);
    return analysis?.g === 1 || (longest && longest <= 400) ? "graphic" : "photo";
  }
  if (type === "favicon") {
    const shortest = Math.min(asset.width || 0, asset.height || 0);
    return /apple-touch/i.test(asset.source_tag || "") || shortest >= 120 ? "appicon" : "favicon";
  }
  return KIND_LABELS[type] ? type : "photo";
}

function legacyAssets(row) {
  const assets = [];
  if (row.favicon_path) assets.push({ type: "favicon", path: row.favicon_path, source_url: row.favicon_source_url, source_tag: row.favicon_source_tag, bytes: Number(row.favicon_bytes) || 0, sha256: row.favicon_sha256 });
  if (row.og_path) assets.push({ type: "social", path: row.og_path, source_url: row.og_source_url, source_tag: row.og_source_tag, bytes: Number(row.og_bytes) || 0, sha256: row.og_sha256 });
  return assets;
}

function regionOf(raw, company, category) {
  if (raw.collection === "gdweb") return ["국내 웹", "모바일"].includes(raw.region) ? "KR" : "GLOBAL";
  if (raw.region === "KR" || raw.region === "GLOBAL") return raw.region;
  if (category === "렌터카_글로벌") return "GLOBAL";
  if (/[가-힣]/.test(company) || /korea|코리아/i.test(company) || /\.(kr|co\.kr)(\/|$)/i.test(raw.requested_url || "")) return "KR";
  return "GLOBAL";
}

function normalizeRow(raw) {
  const company = cleanText(raw.company);
  const slug = cleanText(raw.slug) || company;
  const category = cleanText(raw.category);
  const pageTitle = cleanText(raw.page_title);
  const sub = cleanText(raw.sub);
  return {
    company,
    slug,
    category,
    sub,
    region: regionOf(raw, company, category),
    page_title: pageTitle,
    official_url: safeHttpUrl(raw.page_url || raw.requested_url),
    status: cleanText(raw.collection_status),
    collection: raw.collection || "brands",
    gdweb_url: safeHttpUrl(raw.gdweb_url),
    featuredGroup: cleanText(raw.region || raw.featured_group),
    featuredDate: cleanText(raw.featured_date),
    description: cleanText(raw.design_note || raw.description),
    tags: Array.isArray(raw.design_tags) ? raw.design_tags : [],
    fonts: Array.isArray(raw.fonts) ? raw.fonts : [],
    captureNote: cleanText(raw.capture_note),
    search: `${company} ${slug.replaceAll("-", " ")} ${categoryLabel(category)} ${sub} ${pageTitle} ${raw.design_note || ""} ${(raw.design_tags || []).join(" ")}`.toLocaleLowerCase("ko"),
    initials: choseong(company.replace(/\s+/g, "")),
    colors: state.brandColors[slug] || null,
    mark: "",
    items: [],
    rawAssets: Array.isArray(raw.assets) && raw.assets.length ? raw.assets : legacyAssets(raw),
  };
}

function makeItem(row, asset, extra = {}) {
  const path = cleanText(asset.path);
  const sha = cleanText(asset.sha256);
  const analysis = state.analysis[sha] || null;
  const type = extra.type || cleanText(asset.type);
  const width = Number(asset.width) || 0;
  const height = Number(asset.height) || 0;
  const format = asset.format || formatOf(extra.region ? extra.region.src : path);
  const thumb = extra.thumb || asset.preview_path || (row.collection !== "gdweb" && needsThumb(path, width, height) ? thumbFor(path) : "");
  const pagePart = ({layout:"page",hero:"hero",header:"header",section:"section",footer:"footer"})[type];
  return {
    key: cleanText(extra.key || asset.key || asset.source_sha256 || sha || path),
    row,
    type,
    kind: extra.kind || (pagePart ? "layout" : kindOf(type, asset, analysis)),
    part: extra.part || pagePart || "",
    region: extra.region || null,
    style: extra.style || (type === "button" ? normalizeCapturedButton(asset) : null),
    capturedStyles: asset.styles || null,
    thumb,
    path,
    sourceUrl: safeHttpUrl(asset.source_url),
    sourcePage: safeHttpUrl((asset.source_pages || [])[0] || extra.pageUrl || ""),
    width,
    height,
    ratio: width && height ? width / height : 1,
    bytes: Number(asset.bytes) || 0,
    format,
    formatGroup: formatGroup(format),
    variant: ["desktop", "mobile"].includes(asset.variant) ? asset.variant : "shared",
    sha,
    dhash: cleanText(asset.dhash),
    date: extra.date ?? (asset.featured_date || asset.captured_at?.slice(0,10) || campaignDate(asset.source_url)),
    dateLabel: extra.dateLabel || (asset.featured_date ? "GDWEB 선정일" : asset.captured_at ? "캡처 날짜" : "캠페인 날짜"),
    archived: Boolean(extra.archived),
    truncated: Boolean(extra.truncated || asset.truncated),
    label: friendlyReferenceLabel(cleanText(extra.label || asset.label || ""), extra.kind || type, extra.part || pagePart),
    area: extra.area || "",
    background: /^#[0-9a-f]{6}$/i.test(extra.background || "") ? extra.background : "",
    sourceType: extra.sourceType || "",
    analysis,
  };
}

function buildItems(manifest, layouts, history, iconSets, components) {
  state.rows = manifest.map(normalizeRow);
  state.rowBySlug = new Map(state.rows.map((row) => [row.slug, row]));
  const items = [];
  const seenPaths = new Set();
  // The same picture is shown once, under the first kind it was found as.
  const seenSha = new Set();
  const push = (item) => {
    const id = `${item.row.collection === "gdweb" ? item.row.slug : ""}:${item.kind}:${item.part}:${item.path}`;
    if (!item.path || seenPaths.has(id)) return;
    if (item.sha && !item.archived && item.row.collection !== "gdweb") {
      if (seenSha.has(item.sha)) return;
      seenSha.add(item.sha);
    }
    seenPaths.add(id);
    item.row.items.push(item);
    items.push(item);
  };

  const latest = new Map();
  layouts.forEach((entry) => {
    const id = `${entry.slug}:${entry.device}`;
    if (!latest.has(id) || String(entry.captured_at) > String(latest.get(id).captured_at)) latest.set(id, entry);
  });
  const layoutByPath = new Map(layouts.map((entry) => [entry.path, entry]));

  // Full-page captures and their parts come first: they are what most people browse for.
  layouts.forEach((entry) => {
    const row = state.rowBySlug.get(entry.slug);
    if (!row) return;
    const isLatest = latest.get(`${entry.slug}:${entry.device}`) === entry;
    push(makeItem(row, { ...entry, variant: entry.device === "pc" ? "desktop" : "mobile", source_url: entry.page_url }, {
      type: "layout",
      kind: "layout",
      part: "page",
      date: String(entry.captured_at || "").slice(0, 10),
      dateLabel: "캡처 날짜",
      archived: !isLatest,
      truncated: entry.truncated,
      pageUrl: entry.page_url,
    }));
  });

  components.forEach((entry) => {
    const row = state.rowBySlug.get(entry.slug);
    if (!row) return;
    const variant = entry.device === "pc" ? "desktop" : "mobile";
    const date = String(entry.collected_at || "").slice(0, 10);
    const source = layoutByPath.get(entry.layout);
    (entry.regions || []).forEach((region) => {
      if (!source || !region.thumb) return;
      const [x, y, w, h] = region.box;
      push(makeItem(row, { ...region, path: region.thumb, variant, source_url: entry.page_url, width: w, height: h }, {
        type: "layout",
        kind: "layout",
        part: region.kind,
        key: `${entry.layout}#${region.box.join(",")}`,
        thumb: region.thumb,
        region: { src: entry.layout, x, y, w, h, fullWidth: source.width, fullHeight: source.height, pixelRatio: entry.pixel_ratio || 1 },
        label: region.label,
        date,
        dateLabel: "캡처 날짜",
        pageUrl: entry.page_url,
      }));
    });
    (entry.items || []).forEach((part) => {
      if (part.kind === "icon") {
        push(makeItem(row, { ...part, variant: "desktop" }, {
          type: "icon",
          kind: "icon",
          date,
          dateLabel: "수집 날짜",
          pageUrl: entry.page_url,
          label: part.label,
          area: part.area,
          background: part.background,
          sourceType: part.source_type,
        }));
        return;
      }
      const isButton = part.kind === "button";
      push(makeItem(row, { ...part, variant, source_url: entry.page_url }, {
        type: isButton ? "button" : "layout",
        kind: isButton ? "button" : "layout",
        part: isButton ? "" : part.kind,
        thumb: part.thumb || "",
        style: part.style || null,
        label: part.label,
        date,
        dateLabel: "캡처 날짜",
        pageUrl: entry.page_url,
      }));
    });
  });

  state.rows.forEach((row) => {
    row.rawAssets.forEach((asset) => push(makeItem(row, asset)));
    delete row.rawAssets;
  });

  iconSets.forEach((company) => {
    const row = state.rowBySlug.get(company.slug);
    if (!row) return;
    (company.icons || []).forEach((entry) => {
      push(makeItem(row, { ...entry, variant: "desktop" }, {
        type: "icon",
        kind: "icon",
        date: String(company.collected_at || "").slice(0, 10),
        dateLabel: "수집 날짜",
        pageUrl: company.page_url,
        label: entry.label,
        area: entry.area,
        background: entry.background,
        sourceType: entry.source_type,
      }));
    });
  });

  history.forEach((company) => {
    const row = state.rowBySlug.get(company.slug);
    if (!row) return;
    (company.entries || []).forEach((entry) => {
      push(makeItem(row, entry, {
        date: String(entry.last_seen_at || entry.archived_at || "").slice(0, 10),
        dateLabel: "마지막 확인",
        archived: true,
      }));
    });
  });

  state.items = items;
  state.itemByKey = new Map();
  items.forEach((item) => {
    if (!state.itemByKey.has(item.key) || state.itemByKey.get(item.key).archived) state.itemByKey.set(item.key, item);
  });

  const rank = new Map();
  state.rows.forEach((row) => {
    const counters = {};
    row.items.forEach((item) => {
      const group = `${item.kind}:${item.part}`;
      counters[group] = (counters[group] || 0) + 1;
      rank.set(item, counters[group]);
    });
    const mark = row.items.find((item) => item.kind === "appicon") || row.items.find((item) => item.kind === "favicon") || row.items.find((item) => item.kind === "logo");
    row.mark = mark ? mark.path : "";
    row.logo = (row.items.find((item) => item.kind === "logo" && !item.archived) || mark || {}).path || "";
  });
  items.forEach((item) => {
    item.rank = rank.get(item) || 0;
    item.jitter = hashString(item.key) % 1000;
    // Recommended order: each company's richest material first, tiny icons last.
    const tiny = Math.max(item.width, item.height) > 0 && Math.max(item.width, item.height) < 64 ? 3 : 0;
    item.weight = item.rank + (KIND_WEIGHT[item.kind] ?? 1) + (PART_WEIGHT[item.part] ?? 0) + tiny;
  });
}

async function fetchJson(url, optional = false) {
  try {
    const response = await fetch(url, { cache: url.startsWith("catalog/") && !url.includes("manifest") ? "force-cache" : "default" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    if (optional) return null;
    throw error;
  }
}

/* ---------- URL state ---------- */

const LIST_PARAMS = { cats: "cat", parts: "part", bvariants: "bv", bshapes: "bs", regions: "region", devices: "device", ratios: "ratio", tones: "tone", formats: "fmt", areas: "area" };
const VIEWS = ["wall", "brands", "colors", "saved"];

function readUrl() {
  const params = new URLSearchParams(window.location.search);
  Object.assign(state, structuredClone(DEFAULT_FILTERS));
  state.view = VIEWS.includes(params.get("view")) ? params.get("view") : "wall";
  state.collection = ["all", "brands", "gdweb"].includes(params.get("collection")) ? params.get("collection") : "all";
  state.featuredGroup = ["국내 웹", "해외 웹", "일본 웹", "모바일"].includes(params.get("group")) ? params.get("group") : "all";
  state.featuredYear = /^20\d{2}$/.test(params.get("year") || "") ? params.get("year") : "all";
  state.materialOnly = params.get("materials") === "1";
  state.q = params.get("q") || "";
  state.brand = params.get("brand") || "";
  state.profile = params.get("profile") || "";
  state.kind = KIND_LABELS[params.get("kind")] ? params.get("kind") : "all";
  Object.entries(LIST_PARAMS).forEach(([key, param]) => {
    state[key] = (params.get(param) || "").split(",").filter(Boolean);
  });
  state.minWidth = Number(params.get("minw")) || 0;
  state.color = /^#[0-9a-f]{6}$/i.test(params.get("color") || "") ? params.get("color").toLowerCase() : "";
  state.coverage = COVERAGE_OPTIONS.some((option) => option.id === params.get("cov")) ? params.get("cov") : "all";
  state.archived = params.get("old") === "1";
  state.sort = [...elements.sort.options].some((option) => option.value === params.get("sort")) ? params.get("sort") : "recommended";
  state.board = params.get("board") || HEART_BOARD;
  if (params.get("seed")) state.seed = Number(params.get("seed")) || state.seed;
  return params.get("item") || "";
}

function writeUrl(push = false) {
  if (catalogRuntime.restoring) return;
  const params = new URLSearchParams();
  if (state.collection !== "all") params.set("collection", state.collection);
  if (state.featuredGroup !== "all") params.set("group", state.featuredGroup);
  if (state.featuredYear !== "all") params.set("year", state.featuredYear);
  if (state.materialOnly) params.set("materials", "1");
  if (state.view !== "wall") params.set("view", state.view);
  if (state.q) params.set("q", state.q);
  if (state.brand) params.set("brand", state.brand);
  if (state.profile) params.set("profile", state.profile);
  if (state.kind !== "all") params.set("kind", state.kind);
  Object.entries(LIST_PARAMS).forEach(([key, param]) => {
    if (state[key].length) params.set(param, state[key].join(","));
  });
  if (state.minWidth) params.set("minw", state.minWidth);
  if (state.color) params.set("color", state.color);
  if (state.coverage !== "all") params.set("cov", state.coverage);
  if (state.archived) params.set("old", "1");
  if (state.sort !== "recommended") params.set("sort", state.sort);
  if (state.sort === "random") params.set("seed", state.seed);
  if (state.view === "saved" && state.board !== HEART_BOARD) params.set("board", state.board);
  if (elements.viewer.open) {
    const item = state.viewer.list[state.viewer.index];
    if (item) params.set("item", item.key);
  }
  const query = params.toString();
  const next = `${window.location.pathname}${query ? `?${query}` : ""}`;
  if (next !== `${window.location.pathname}${window.location.search}`) window.history[push ? "pushState" : "replaceState"](null, "", next);
}

/* ---------- filtering ---------- */

function inCollection(row) {
  if (state.collection !== "all" && row.collection !== state.collection) return false;
  if (state.featuredGroup !== "all" && row.featuredGroup !== state.featuredGroup) return false;
  if (state.featuredYear !== "all" && !row.featuredDate.startsWith(state.featuredYear)) return false;
  if (state.materialOnly && !row.items.some(item => item.kind !== "showcase")) return false;
  return true;
}

function matchesQuery(row) {
  if (!inCollection(row)) return false;
  if (state.brand && row.slug !== state.brand) return false;
  const query = state.q.trim().toLocaleLowerCase("ko");
  if (!query) return true;
  if (row.search.includes(query)) return true;
  const compact = query.replace(/\s+/g, "");
  return /^[ㄱ-ㅎ]+$/.test(compact) && row.initials.includes(compact);
}

function matchesItem(item) {
  if (!inCollection(item.row)) return false;
  if (!inCollection(item.row)) return false;
  if (matchesQuery(item.row)) return true;
  if (state.brand && item.row.slug !== state.brand) return false;
  const query = state.q.trim().toLocaleLowerCase("ko");
  return Boolean(query && item.label && item.label.toLocaleLowerCase("ko").includes(query));
}

// Every filter is a dimension: whether an item passes it, and which options of
// it the item belongs to (for the counts shown next to each option).
const DIMENSIONS = [
  { key: "cats", active: () => state.cats.length, pass: (item) => state.cats.includes(item.row.category), values: (item) => [item.row.category] },
  { key: "regions", active: () => state.regions.length, pass: (item) => state.regions.includes(item.row.region), values: (item) => [item.row.region] },
  { key: "kind", active: () => state.kind !== "all", pass: (item) => item.kind === state.kind, values: (item) => [item.kind], ignores: ["parts", "bvariants", "bshapes", "areas"] },
  { key: "parts", active: () => state.parts.length, pass: (item) => state.parts.includes(item.part), values: (item) => (item.part ? [item.part] : []) },
  { key: "bvariants", active: () => state.bvariants.length, pass: (item) => Boolean(item.style) && state.bvariants.includes(item.style.variant), values: (item) => (item.style ? [item.style.variant] : []) },
  { key: "bshapes", active: () => state.bshapes.length, pass: (item) => Boolean(item.style) && state.bshapes.includes(item.style.shape), values: (item) => (item.style ? [item.style.shape] : []) },
  { key: "devices", active: () => state.devices.length, pass: (item) => state.devices.includes(item.variant), values: (item) => [item.variant] },
  { key: "ratios", active: () => state.ratios.length, pass: (item) => RATIO_OPTIONS.some((option) => state.ratios.includes(option.id) && item.width > 0 && option.test(item.ratio)), values: (item) => RATIO_OPTIONS.filter((option) => item.width > 0 && option.test(item.ratio)).map((option) => option.id) },
  { key: "minWidth", active: () => state.minWidth, pass: (item) => item.width >= state.minWidth, values: (item) => WIDTH_OPTIONS.filter((option) => option.id && item.width >= option.id).map((option) => option.id) },
  { key: "formats", active: () => state.formats.length, pass: (item) => state.formats.includes(item.formatGroup), values: (item) => [item.formatGroup] },
  { key: "areas", active: () => state.areas.length, pass: (item) => state.areas.includes(item.area), values: (item) => (item.area ? [item.area] : []) },
  { key: "tones", active: () => state.tones.length, pass: (item) => (item.tones || TONE_OPTIONS.filter(o=>item.analysis&&o.test(item.analysis)).map(o=>o.id)).some(tone=>state.tones.includes(tone)), values: (item) => item.tones || (item.analysis ? TONE_OPTIONS.filter((option) => option.test(item.analysis)).map((option) => option.id) : []) },
  { key: "color", active: () => state.color, pass: (item) => Boolean(item.analysis) && colorDistance(item, state.colorLab) <= 24, values: () => [] },
];

function visibleByHistory(item) {
  return state.archived || !item.archived || state.view === "saved";
}

function itemPasses(item) {
  if (!visibleByHistory(item)) return false;
  for (const dimension of state.activeDimensions) if (!dimension.pass(item)) return false;
  return true;
}

// One pass over the pool: an item counts toward the options of a dimension when
// it passes every other active filter.
function computeCounts() {
  const counts = Object.fromEntries(DIMENSIONS.map((dimension) => [dimension.key, { __total: 0 }]));
  const active = state.activeDimensions;
  const bump = (dimension, item) => {
    const bucket = counts[dimension.key];
    bucket.__total += 1;
    for (const value of dimension.values(item)) bucket[value] = (bucket[value] || 0) + 1;
  };
  for (const item of baseItems()) {
    if (!visibleByHistory(item) || !matchesItem(item)) continue;
    const failed = [];
    for (const dimension of active) {
      if (!dimension.pass(item)) {
        failed.push(dimension.key);
        if (failed.length > 5) break;
      }
    }
    if (!failed.length) {
      for (const dimension of DIMENSIONS) bump(dimension, item);
      continue;
    }
    for (const dimension of DIMENSIONS) {
      if (failed.every((key) => key === dimension.key || dimension.ignores?.includes(key))) bump(dimension, item);
    }
  }
  state.counts = counts;
}

function countOf(key, value) {
  const bucket = state.counts[key] || {};
  return value === undefined ? bucket.__total || 0 : bucket[value] || 0;
}

function coveragePasses(row) {
  if (state.coverage === "all") return true;
  const banner = row.items.some((item) => item.kind === "banner" && !item.archived);
  const logo = row.items.some((item) => item.kind === "logo" && !item.archived);
  return (state.coverage === "complete" && banner && logo) || (state.coverage === "missing-banner" && !banner) || (state.coverage === "missing-logo" && !logo);
}

function boardItems() {
  return Object.entries(state.favorites)
    .filter(([, record]) => (state.board === HEART_BOARD ? record?.selected : record?.boards?.includes(state.board)))
    .map(([key]) => state.itemByKey.get(key))
    .filter(Boolean);
}

function baseItems() {
  return state.view === "saved" ? boardItems() : state.items;
}

function sortItems(items) {
  const kindIndex = (item) => KIND_ORDER.indexOf(item.kind);
  const byName = (a, b) => a.row.company.localeCompare(b.row.company, "ko");
  if (state.color && state.sort === "recommended") {
    const distance = new Map(items.map((item) => [item, colorDistance(item, state.colorLab)]));
    return items.sort((a, b) => distance.get(a) - distance.get(b));
  }
  switch (state.sort) {
    case "recent":
      return items.sort((a, b) => (b.date || "0").localeCompare(a.date || "0") || kindIndex(a) - kindIndex(b) || byName(a, b));
    case "resolution":
      return items.sort((a, b) => b.width * b.height - a.width * a.height || byName(a, b));
    case "name":
      return items.sort((a, b) => byName(a, b) || kindIndex(a) - kindIndex(b) || a.rank - b.rank);
    case "random": {
      const random = seededRandom(state.seed);
      const keyed = items.map((item) => [random(), item]);
      return keyed.sort((a, b) => a[0] - b[0]).map(([, item]) => item);
    }
    default:
      return items.sort((a, b) => a.weight - b.weight || a.jitter - b.jitter);
  }
}

function computeList() {
  if (state.board !== HEART_BOARD && (!state.boards[state.board] || state.boards[state.board].deleted)) state.board = HEART_BOARD;
  state.colorLab = state.color ? rgbToLab(hexToRgb(state.color)) : null;
  state.activeDimensions = DIMENSIONS.filter((dimension) => dimension.active());
  computeCounts();
  if (state.view === "colors") {
    computeColorRows();
    state.list = [];
    return;
  }
  const items = baseItems().filter((item) => matchesItem(item) && itemPasses(item) && (state.view !== "brands" || coveragePasses(item.row)));
  state.list = sortItems(items);
  if (state.view === "brands") {
    const rows = new Map();
    state.list.forEach((item) => {
      if (!rows.has(item.row)) rows.set(item.row, []);
      rows.get(item.row).push(item);
    });
    const hasItemFilter = state.activeDimensions.some((dimension) => !["cats", "regions"].includes(dimension.key));
    if (!hasItemFilter) {
      state.rows.filter((row) => !rows.has(row) && matchesQuery(row) && (!state.cats.length || state.cats.includes(row.category)) && (!state.regions.length || state.regions.includes(row.region)) && coveragePasses(row)).forEach((row) => rows.set(row, []));
    }
    state.brandList = [...rows.entries()].sort(([a, itemsA], [b, itemsB]) => {
      if (state.sort === "name") return a.company.localeCompare(b.company, "ko");
      if (state.sort === "random") return hashString(a.slug + state.seed) - hashString(b.slug + state.seed);
      if (state.sort === "resolution") return Math.max(0, ...itemsB.map(item => item.width * item.height)) - Math.max(0, ...itemsA.map(item => item.width * item.height));
      if (state.sort === "recent" && state.collection !== "gdweb") return (itemsB.map(item => item.date).sort().at(-1) || "").localeCompare(itemsA.map(item => item.date).sort().at(-1) || "");
      if (state.collection === "gdweb") return b.featuredDate.localeCompare(a.featuredDate) || a.company.localeCompare(b.company, "ko");
      return itemsB.length - itemsA.length || a.company.localeCompare(b.company, "ko");
    });
  }
}

function activeFilterCount() {
  return state.cats.length + state.regions.length + state.devices.length + state.ratios.length + (state.minWidth ? 1 : 0) + state.tones.length + state.formats.length + (state.color ? 1 : 0) + (state.coverage !== "all" ? 1 : 0) + (state.archived ? 1 : 0);
}

/* ---------- chrome rendering ---------- */

const KIND_ICONS = {
  showcase: "browser", all: "squares-four", layout: "layout", button: "cursor-click", banner: "flag-banner", logo: "seal",
  icon: "circles-four", social: "share-network", photo: "image", graphic: "shapes", appicon: "app-window", favicon: "browser",
};
const PART_ICONS = {
  page: "article", hero: "monitor", header: "align-top", nav: "list", section: "rows", card: "cards",
  footer: "align-bottom", floating: "chat-circle-dots", popup: "browsers", form: "magnifying-glass", tab: "tabs",
};

function sortedCategories() {
  return [...new Set(state.rows.filter(inCollection).map((row) => row.category))].sort((a, b) => {
    const ia = CATEGORY_ORDER.indexOf(a);
    const ib = CATEGORY_ORDER.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b, "ko");
  });
}

function categoryCount(category) {
  if (state.view === "colors") return category === undefined ? state.colorCounts.__total || 0 : state.colorCounts[category] || 0;
  return countOf("cats", category);
}

function renderCategoryChips() {
  const fragment = document.createDocumentFragment();
  const row = (label, count, selected, onClick) => {
    const entry = button("cat-row", "", onClick, { "aria-pressed": String(selected) });
    entry.append(make("span", "cat-check"), make("span", "cat-label", label), make("small", "", numberFormat(count)));
    if (!count && !selected) entry.classList.add("is-empty");
    return entry;
  };
  fragment.append(row("전체 업종", categoryCount(), !state.cats.length, () => setFilter({ cats: [] })));
  sortedCategories().forEach((category) => {
    const selected = state.cats.includes(category);
    fragment.append(row(categoryLabel(category), categoryCount(category), selected, () => {
      setFilter({ cats: selected ? state.cats.filter((value) => value !== category) : [...state.cats, category] });
    }));
  });
  elements.categoryChips.replaceChildren(fragment);
}

function renderKindTabs() {
  const fragment = document.createDocumentFragment();
  KINDS.forEach((kind, index) => {
    const count = kind.id === "all" ? countOf("kind") : countOf("kind", kind.id);
    const shortcut = index < 10 ? ` (단축키 ${index})` : "";
    const tab = button("kind-tab", "", () => setFilter({ kind: kind.id, parts: [], bvariants: [], bshapes: [], areas: [] }), {
      "aria-pressed": String(state.kind === kind.id),
      title: `${kind.hint || "모든 유형"}${shortcut}`,
    });
    tab.dataset.kind = kind.id;
    tab.append(icon(KIND_ICONS[kind.id]), make("span", "", kind.label), make("small", "", numberFormat(count)));
    if (!count && state.kind !== kind.id) {tab.classList.add("is-empty");tab.disabled=true;}
    fragment.append(tab);
  });
  elements.kindTabs.replaceChildren(fragment);
  elements.kindTabs.hidden = state.view === "colors";
}

function subChip(key, option, iconName) {
  const selected = state[key].includes(option.id);
  const count = countOf(key, option.id);
  const chip = button("sub-chip", "", () => toggleList(key, option.id), { "aria-pressed": String(selected) });
  if (option.hint) chip.title = option.hint;
  if (iconName) chip.append(icon(iconName));
  chip.append(make("span", "", option.label), make("small", "", numberFormat(count)));
  if (!count && !selected) {chip.classList.add("is-empty");chip.disabled=true;}
  return chip;
}

function renderSubChips() {
  const fragment = document.createDocumentFragment();
  let label = "";
  if (state.view === "colors") {
    label = "색상 계열";
    const all = button("sub-chip", "", () => setFilter({ color: "" }), { "aria-pressed": String(!state.color) });
    all.append(make("span", "", "모두"), make("small", "", numberFormat(state.colorCounts.__total || 0)));
    fragment.append(all);
    COLOR_SWATCHES.forEach((swatch) => {
      const selected = state.color === swatch.hex;
      const count = state.colorFamilies[swatch.hex] || 0;
      const chip = button("sub-chip color-family", "", () => setFilter({ color: selected ? "" : swatch.hex }), { "aria-pressed": String(selected) });
      const dot = make("span", "family-dot");
      dot.style.background = swatch.hex;
      chip.append(dot, make("span", "", swatch.label), make("small", "", numberFormat(count)));
      if (!count && !selected) chip.classList.add("is-empty");
      fragment.append(chip);
    });
  } else if (state.kind === "layout" || state.parts.length) {
    label = "구성";
    const all = button("sub-chip", "", () => setFilter({ parts: [] }), { "aria-pressed": String(!state.parts.length) });
    all.append(make("span", "", "모두"), make("small", "", numberFormat(countOf("parts"))));
    fragment.append(all);
    PART_OPTIONS.forEach((option) => fragment.append(subChip("parts", option, PART_ICONS[option.id])));
  } else if (state.view !== "colors" && (state.kind === "button" || state.bvariants.length || state.bshapes.length)) {
    label = "스타일";
    BUTTON_VARIANT_OPTIONS.forEach((option) => fragment.append(subChip("bvariants", option)));
    fragment.append(make("span", "sub-divider"));
    BUTTON_SHAPE_OPTIONS.forEach((option) => fragment.append(subChip("bshapes", option)));
  } else if (state.view !== "colors" && (state.kind === "icon" || state.areas.length)) {
    label = "위치";
    AREA_OPTIONS.forEach((option) => fragment.append(subChip("areas", option)));
  }
  elements.subLabel.textContent = label;
  elements.subChips.replaceChildren(fragment);
  elements.subRow.hidden = !label;
}

function facetSection(title, content, note, { collapsible = false, open = true } = {}) {
  const section = make(collapsible ? "details" : "section", "facet");
  if (collapsible) {
    section.open = open;
    const summary = make("summary");
    summary.append(make("span", "", title), icon("caret-down", "facet-caret"));
    section.append(summary);
  } else {
    section.append(make("h3", "", title));
  }
  if (note) section.append(make("p", "facet-note", note));
  section.append(content);
  return section;
}

function toggleList(key, value) {
  const list = state[key].includes(value) ? state[key].filter((item) => item !== value) : [...state[key], value];
  setFilter({ [key]: list });
}

function optionChips(key, options) {
  const wrap = make("div", "facet-options");
  options.forEach((option) => {
    const id = option.id ?? option;
    const label = option.label ?? option;
    const count = key === "regions" && state.view === "colors" ? state.colorCounts[`region:${id}`] || 0 : countOf(key, id);
    const chip = button("facet-chip", "", () => toggleList(key, id), { "aria-pressed": String(state[key].includes(id)) });
    chip.append(label, make("small", "", numberFormat(count)));
    if (option.hint) chip.title = option.hint;
    if (!count && !state[key].includes(id)) chip.classList.add("is-empty");
    wrap.append(chip);
  });
  return wrap;
}

function colorSwatches(note) {
  const colors = make("div", "swatches");
  COLOR_SWATCHES.forEach((swatch) => {
    const selected = state.color === swatch.hex;
    const chip = button("swatch", "", () => setFilter({ color: selected ? "" : swatch.hex }), {
      "aria-pressed": String(selected),
      "aria-label": `${swatch.label} 계열`,
      title: swatch.label,
    });
    chip.style.setProperty("--swatch", swatch.hex);
    colors.append(chip);
  });
  const custom = make("label", "swatch custom-swatch");
  custom.title = "직접 색 고르기";
  const picker = make("input");
  picker.type = "color";
  picker.value = state.color || "#2563eb";
  picker.setAttribute("aria-label", "직접 색 고르기");
  picker.addEventListener("change", () => setFilter({ color: picker.value.toLowerCase() }));
  custom.append(icon("eyedropper"), picker);
  if (state.color && !COLOR_SWATCHES.some((swatch) => swatch.hex === state.color)) {
    custom.style.setProperty("--swatch", state.color);
    custom.setAttribute("aria-pressed", "true");
  }
  colors.append(custom);
  return facetSection("색상", colors, state.color ? `${state.color.toUpperCase()}와 가까운 색부터 보여 줍니다.` : note);
}

function renderFacets() {
  const fragment = document.createDocumentFragment();
  fragment.append(facetSection("지역", optionChips("regions", REGION_OPTIONS)));
  if (state.view === "colors") {
    fragment.append(colorSwatches("포인트 컬러가 비슷한 회사를 찾습니다."));
    elements.facets.replaceChildren(fragment);
    return;
  }
  fragment.append(facetSection("기기", optionChips("devices", DEVICE_OPTIONS)));
  fragment.append(colorSwatches("대표 색상이 비슷한 이미지를 찾습니다."));
  fragment.append(facetSection("톤", optionChips("tones", TONE_OPTIONS)));
  fragment.append(facetSection("비율", optionChips("ratios", RATIO_OPTIONS), "", { collapsible: true, open: state.ratios.length > 0 }));

  const widths = make("div", "facet-options");
  WIDTH_OPTIONS.forEach((option) => {
    const chip = button("facet-chip", option.label, () => setFilter({ minWidth: option.id }), { "aria-pressed": String(state.minWidth === option.id) });
    if (option.id) chip.append(make("small", "", numberFormat(countOf("minWidth", option.id))));
    widths.append(chip);
  });
  fragment.append(facetSection("최소 가로 해상도", widths, "", { collapsible: true, open: state.minWidth > 0 }));
  fragment.append(facetSection("파일 형식", optionChips("formats", FORMAT_OPTIONS.map((id) => ({ id, label: id }))), "", { collapsible: true, open: state.formats.length > 0 }));

  if (state.view === "brands") {
    const coverage = make("div", "facet-options");
    COVERAGE_OPTIONS.forEach((option) => {
      coverage.append(button("facet-chip", option.label, () => setFilter({ coverage: option.id }), { "aria-pressed": String(state.coverage === option.id) }));
    });
    fragment.append(facetSection("수집 상태", coverage));
  }

  const archive = make("label", "switch");
  const checkbox = make("input");
  checkbox.type = "checkbox";
  checkbox.checked = state.archived;
  checkbox.addEventListener("change", () => setFilter({ archived: checkbox.checked }));
  archive.append(checkbox, make("span", "switch-track"), make("span", "", `지난 버전 포함 (${numberFormat(state.archivedCount || 0)})`));
  fragment.append(facetSection("기록", archive, "이전에 캡처한 화면과 교체된 배너·로고를 함께 봅니다.", { collapsible: true, open: state.archived }));

  elements.facets.replaceChildren(fragment);
}

function renderSummary() {
  renderCollectionSummary();
}

function renderActiveFilters() {
  const chips = [];
  const add = (label, patch) => {
    const chip = button("active-chip", "", () => setFilter(patch), { "aria-label": `${label} 필터 해제` });
    chip.append(make("span", "", label), icon("x"));
    chips.push(chip);
  };
  const labelOf = (options, id) => options.find((option) => option.id === id)?.label || id;
  if (state.featuredGroup !== "all") add(state.featuredGroup, {featuredGroup:"all"});
  if (state.featuredYear !== "all") add(`${state.featuredYear}년`, {featuredYear:"all"});
  if (state.materialOnly) add("세부 소재가 있는 사이트", {materialOnly:false});
  if (state.brand) add(`회사: ${state.rowBySlug.get(state.brand)?.company || state.brand}`, { brand: "" });
  if (state.q) add(`검색: ${state.q}`, { q: "" });
  state.cats.forEach((cat) => add(categoryLabel(cat), { cats: state.cats.filter((value) => value !== cat) }));
  state.regions.forEach((id) => add(labelOf(REGION_OPTIONS, id), { regions: state.regions.filter((v) => v !== id) }));
  if (state.view !== "colors") {
    if (state.kind !== "all") add(KIND_LABELS[state.kind], { kind: "all", parts: [], bvariants: [], bshapes: [], areas: [] });
    state.parts.forEach((id) => add(labelOf(PART_OPTIONS, id), { parts: state.parts.filter((v) => v !== id) }));
    state.bvariants.forEach((id) => add(`버튼 ${labelOf(BUTTON_VARIANT_OPTIONS, id)}`, { bvariants: state.bvariants.filter((v) => v !== id) }));
    state.bshapes.forEach((id) => add(labelOf(BUTTON_SHAPE_OPTIONS, id), { bshapes: state.bshapes.filter((v) => v !== id) }));
    state.devices.forEach((id) => add(labelOf(DEVICE_OPTIONS, id), { devices: state.devices.filter((v) => v !== id) }));
    state.ratios.forEach((id) => add(labelOf(RATIO_OPTIONS, id), { ratios: state.ratios.filter((v) => v !== id) }));
    if (state.minWidth) add(`가로 ${state.minWidth}px+`, { minWidth: 0 });
    state.tones.forEach((id) => add(labelOf(TONE_OPTIONS, id), { tones: state.tones.filter((v) => v !== id) }));
    state.areas.forEach((id) => add(labelOf(AREA_OPTIONS, id), { areas: state.areas.filter((v) => v !== id) }));
    state.formats.forEach((id) => add(id, { formats: state.formats.filter((v) => v !== id) }));
    if (state.coverage !== "all") add(COVERAGE_OPTIONS.find((o) => o.id === state.coverage).label, { coverage: "all" });
    if (state.archived) add("지난 버전 포함", { archived: false });
  }
  if (state.color) add(`색상 ${state.color.toUpperCase()}`, { color: "" });
  if (chips.length > 1) chips.push(button("text-button", "모두 지우기", resetFilters));
  elements.activeFilters.replaceChildren(...chips);
  elements.activeFilters.hidden = chips.length === 0;
  const count = activeFilterCount();
  elements.filterBadge.textContent = String(count);
  elements.filterBadge.hidden = count === 0;
}

function renderChrome() {
  renderReferenceTools();
  renderSummary();
  elements.viewButtons.forEach((element) => element.setAttribute("aria-pressed", String(element.dataset.view === state.view)));
  elements.search.value = state.q;
  elements.sort.value = state.sort;
  elements.shuffle.hidden = state.sort !== "random" || state.view === "colors";
  elements.sort.closest(".sort-field").hidden = state.view === "colors";
  elements.density.querySelectorAll("button").forEach((element) => element.setAttribute("aria-pressed", String(element.dataset.density === state.density)));
  elements.density.hidden = state.view === "brands" || state.view === "colors";
  elements.savedBar.hidden = state.view !== "saved";
  document.body.dataset.view = state.view;
  renderCategoryChips();
  renderKindTabs();
  renderSubChips();
  renderFacets();
  renderActiveFilters();
  if (state.view === "saved") renderBoardTabs();
}

/* ---------- wall ---------- */

const WIDE_PARTS = new Set(["header", "nav", "footer", "form", "tab"]);

function displayAspect(item) {
  const inverse = item.height && item.width ? item.height / item.width : 0.75;
  if (item.kind === "layout" && item.part === "page") return Math.min(inverse, item.variant === "mobile" ? 1.7 : 1.1);
  if (item.kind === "layout" && WIDE_PARTS.has(item.part)) return Math.min(Math.max(inverse, 0.2), 1.4);
  if (item.kind === "layout") return Math.min(Math.max(inverse, 0.3), 1.9);
  if (item.kind === "button") return 0.46;
  if (item.kind === "favicon" || item.kind === "appicon" || item.kind === "icon") return 1;
  if (item.kind === "logo") return Math.min(Math.max(inverse, 0.5), 1);
  return Math.min(Math.max(inverse, 0.28), 2);
}

function itemCaption(item) {
  if (item.kind === "layout") {
    const part = PART_LABELS[item.part] || "레이아웃";
    const label = item.part === "page" || item.part === "hero" ? "" : item.label;
    return label && label !== part ? `${part} · ${label}` : part;
  }
  if ((item.kind === "icon" || item.kind === "button") && item.label) return item.label;
  return `${KIND_LABELS[item.kind]}${item.width ? ` ${item.width}×${item.height}` : ""}`;
}

function markImage(row, className = "mark") {
  if (!row.mark) return make("span", `${className} is-empty`, row.company.slice(0, 1));
  const image = make("img", className);
  image.src = row.mark;
  image.alt = "";
  image.loading = "lazy";
  image.decoding = "async";
  image.addEventListener("error", () => image.replaceWith(make("span", `${className} is-empty`, row.company.slice(0, 1))), { once: true });
  return image;
}

function createTile(item, index) {
  const tile = make("article", `tile kind-${item.kind}${item.part ? ` part-${item.part}` : ""}`);
  tile.dataset.index = String(index);
  tile.dataset.key = item.key;
  tile.style.setProperty("--enter-delay", `${(index % BATCH_SIZE) * 12}ms`);
  if (state.selection.has(item.key)) tile.classList.add("is-selected");

  const hit = button("tile-hit", "", null, { "aria-label": `${item.row.company} ${itemCaption(item)} 크게 보기` });
  hit.dataset.action = "open";
  const media = make("div", "tile-media");
  media.style.aspectRatio = `1 / ${displayAspect(item)}`;
  const dominant = item.analysis?.p?.[0]?.[0];
  if (dominant && !CONTAINED_KINDS.has(item.kind)) media.style.backgroundColor = dominant;
  if (CONTAINED_KINDS.has(item.kind)) media.classList.add("is-contained");
  if (item.kind === "layout" && WIDE_PARTS.has(item.part)) media.classList.add("is-wide");
  if (item.kind === "icon" && item.background) {
    media.classList.remove("is-contained");
    media.classList.add("is-icon");
    media.style.backgroundColor = item.background;
  }
  if (item.kind === "button") {
    media.classList.add("is-button");
    if (item.style?.surface) media.style.backgroundColor = item.style.surface;
  }
  const image = make("img");
  image.src = tileSrc(item);
  image.alt = "";
  image.loading = "lazy";
  image.decoding = "async";
  prepareReferenceImage(image, item, media);
  image.addEventListener("error", () => {
    if (item.thumb && image.src.includes("/thumbs/") && !item.region) image.src = item.path;
    else media.classList.add("is-broken");
  });
  media.append(image);
  if (item.kind === "layout" || item.kind === "button") {
    media.append(make("span", "tile-badge", item.variant === "mobile" ? "모바일" : "PC"));
  }
  if (item.archived) media.append(make("span", "tile-badge archived", item.date ? `지난 버전 ${item.date}` : "지난 버전"));
  hit.append(media);

  const check = button("tile-check", "", null, { "aria-label": `${item.row.company} 이미지 선택`, "aria-pressed": String(state.selection.has(item.key)) });
  check.dataset.action = "select";
  check.append(icon("check"));
  const favorite = isFavorite(item);
  const heart = button("tile-heart", "", null, { "aria-label": `${item.row.company} 이미지 찜하기`, "aria-pressed": String(favorite) });
  heart.dataset.action = "heart";
  heart.dataset.favoriteKey = item.key;
  heart.append(icon(favorite ? "heart-fill" : "heart"));

  const caption = make("div", "tile-caption");
  caption.append(markImage(item.row, "tile-mark"));
  const text = make("div", "tile-text");
  text.append(make("strong", "", item.row.company), make("span", "", itemCaption(item)));
  caption.append(text);

  tile.append(hit, check, heart, caption);
  return tile;
}

function setupColumns() {
  const width = elements.wall.clientWidth || elements.wall.parentElement.clientWidth;
  const gap = state.density === "s" ? 12 : state.density === "xl" ? 22 : 18;
  const compact = ['icon','favicon','appicon'].includes(state.kind);
  const page = state.kind === 'layout' || state.kind === 'showcase';
  const target = compact ? DENSITY_WIDTH[state.density] * .7 : page ? DENSITY_WIDTH[state.density] * 1.3 : DENSITY_WIDTH[state.density];
  const minimum = window.innerWidth <= 520 && !page ? 2 : 1;
  const count = Math.max(minimum, Math.floor((width + gap) / (target + gap)));
  elements.wall.style.setProperty("--gap", `${gap}px`);
  elements.wall.dataset.density = state.density;
  state.columns = Array.from({ length: count }, () => make("div", "wall-column"));
  state.columnHeights = new Array(count).fill(0);
  state.columnWidth = (width - gap * (count - 1)) / count;
  elements.wall.replaceChildren(...state.columns);
  state.rendered = 0;
}

function appendBatch() {
  if (state.view === "brands" || state.view === "colors") return;
  const end = Math.min(state.list.length, state.rendered + BATCH_SIZE);
  for (let index = state.rendered; index < end; index += 1) {
    const item = state.list[index];
    let target = 0;
    state.columnHeights.forEach((height, column) => {
      if (height < state.columnHeights[target] - 1) target = column;
    });
    state.columns[target].append(createTile(item, index));
    state.columnHeights[target] += state.columnWidth * displayAspect(item) + 52;
  }
  state.rendered = end;
  elements.sentinel.hidden = state.rendered >= state.list.length;
}

function renderWall() {
  elements.grid.hidden = true;
  elements.colorGrid.hidden = true;
  elements.wall.hidden = state.list.length === 0;
  setupColumns();
  appendBatch();
  window.requestAnimationFrame(fillViewport);
}

function fillViewport() {
  const total = state.view === "colors" ? state.colorRows.length : state.view === "brands" ? state.brandList.length : state.list.length;
  if (state.rendered >= total) return;
  if (elements.sentinel.getBoundingClientRect().top < window.innerHeight * 2.2) {
    if (state.view === "colors") appendColorBatch(); else if (state.view === "brands") appendBrandBatch(); else appendBatch();
    window.requestAnimationFrame(fillViewport);
  }
}

/* ---------- brand colors ---------- */

function brandSwatches(colors) {
  if (!colors) return [];
  const list = [];
  if (colors.primary) list.push({ ...colors.primary, role: "메인" });
  if (colors.secondary) list.push({ ...colors.secondary, role: "보조" });
  (colors.accents || []).forEach((accent) => list.push({ ...accent, role: "포인트" }));
  return list;
}

function copyHex(hex) {
  copyText(hex.toUpperCase(), `${hex.toUpperCase()} 복사됨`);
}

function readableOn(hex) {
  const [r, g, b] = hexToRgb(hex).map((value) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? "#18181b" : "#fafafa";
}

// Companies whose point colors match the filters, closest to the chosen color first.
const FAMILY_LABS = COLOR_SWATCHES.map((swatch) => [swatch.hex, rgbToLab(hexToRgb(swatch.hex))]);

function rowLabs(row) {
  if (!row.colorLabs) {
    const swatches = brandSwatches(row.colors).map((swatch) => rgbToLab(hexToRgb(swatch.hex)));
    // For a monochrome brand the main color is its darkest neutral, not a stray accent.
    const neutrals = (row.colors?.neutrals || []).filter((hex) => hex !== "#ffffff").slice(0, 2).map((hex) => rgbToLab(hexToRgb(hex)));
    row.colorLabs = row.colors?.monochrome || !swatches.length ? [...neutrals, ...swatches] : swatches;
  }
  return row.colorLabs;
}

function computeColorRows() {
  const target = state.colorLab;
  const counts = { __total: 0 };
  const families = {};
  const rows = [];
  state.rows.forEach((row) => {
    const swatches = brandSwatches(row.colors);
    if (!swatches.length && !(row.colors?.neutrals || []).length) return;
    if (!matchesQuery(row)) return;
    const labs = rowLabs(row);
    const regionOk = !state.regions.length || state.regions.includes(row.region);
    const categoryOk = !state.cats.length || state.cats.includes(row.category);
    if (regionOk && categoryOk) {
      // A company belongs to the family its main color is closest to.
      const main = labs[0];
      if (main) {
        let best = null;
        let bestDistance = Infinity;
        FAMILY_LABS.forEach(([hex, lab]) => {
          const distance = labDistance(main, lab);
          if (distance < bestDistance) {
            bestDistance = distance;
            best = hex;
          }
        });
        if (best) families[best] = (families[best] || 0) + 1;
      }
    }
    let distance = 0;
    if (target) {
      distance = labs.length ? Math.min(...labs.map((lab) => labDistance(lab, target))) : Infinity;
      const family = COLOR_SWATCHES.some((swatch) => swatch.hex === state.color);
      if (family ? nearestFamily(labs[0]) !== state.color : distance > 28) return;
    }
    if (regionOk) {
      counts.__total += 1;
      counts[row.category] = (counts[row.category] || 0) + 1;
    }
    if (categoryOk) counts[`region:${row.region}`] = (counts[`region:${row.region}`] || 0) + 1;
    if (regionOk && categoryOk) rows.push({ row, distance });
  });
  const hue = (row) => {
    const hex = row.colors?.monochrome ? null : row.colors?.primary?.hex;
    if (!hex) return 999;
    const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    if (max === min) return 998;
    let h = max === r ? ((g - b) / (max - min)) % 6 : max === g ? (b - r) / (max - min) + 2 : (r - g) / (max - min) + 4;
    h = (h * 60 + 360) % 360;
    return h;
  };
  if (target) rows.sort((a, b) => a.distance - b.distance);
  else if (state.sort === "name") rows.sort((a, b) => a.row.company.localeCompare(b.row.company, "ko"));
  else rows.sort((a, b) => hue(a.row) - hue(b.row) || a.row.company.localeCompare(b.row.company, "ko"));
  state.colorRows = rows.map((entry) => entry.row);
  state.colorCounts = counts;
  state.colorFamilies = families;
}

function nearestFamily(lab) {
  if (!lab) return "";
  let best = "";
  let bestDistance = Infinity;
  FAMILY_LABS.forEach(([hex, familyLab]) => {
    const distance = labDistance(lab, familyLab);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = hex;
    }
  });
  return best;
}

function createColorCard(row) {
  const card = make("article", "color-card");
  const swatches = brandSwatches(row.colors);
  const neutrals = (row.colors?.neutrals || []).slice(0, 5);
  const main = row.colors?.monochrome || !swatches.length ? { hex: neutrals.find((hex) => hex !== "#ffffff") || neutrals[0] || "#18181b", role: "무채색", sources: [] } : swatches[0];
  const rest = row.colors?.monochrome ? swatches.slice(0, 3) : swatches.slice(1, 5);

  const hero = button("color-hero", "", () => copyHex(main.hex), { title: `${main.hex.toUpperCase()} 복사${main.sources?.length ? ` · 근거: ${main.sources.join(", ")}` : ""}` });
  hero.style.setProperty("--swatch", main.hex);
  hero.style.color = readableOn(main.hex);
  hero.append(make("span", "color-role", main.role), make("strong", "color-hex", main.hex.toUpperCase()), icon("copy", "color-copy"));
  card.append(hero);

  if (rest.length) {
    const strip = make("div", "color-strip");
    rest.forEach((swatch) => {
      const chip = button("color-chip", "", () => copyHex(swatch.hex), { title: `${swatch.role} ${swatch.hex.toUpperCase()} 복사` });
      chip.style.setProperty("--swatch", swatch.hex);
      chip.style.color = readableOn(swatch.hex);
      chip.append(make("span", "", swatch.hex.toUpperCase()));
      strip.append(chip);
    });
    card.append(strip);
  }

  const body = make("div", "color-body");
  const line = make("div", "company-line");
  line.append(markImage(row, "company-mark"));
  const titles = make("div", "company-titles");
  titles.append(make("h2", "", row.company), make("span", "category-name", row.collection === "gdweb" ? `${row.featuredGroup} · ${row.featuredDate}` : [categoryLabel(row.category), row.sub].filter(Boolean).join(" · ")));
  line.append(titles);
  body.append(line);

  if (neutrals.length) {
    const neutralRow = make("div", "neutral-row");
    neutrals.forEach((hex) => {
      const dot = button("neutral-dot", "", () => copyHex(hex), { title: `${hex.toUpperCase()} 복사`, "aria-label": `${hex.toUpperCase()} 복사` });
      dot.style.setProperty("--swatch", hex);
      neutralRow.append(dot);
    });
    body.append(neutralRow);
  }

  const actions = make("div", "card-actions");
  const all = [main, ...rest].map((swatch) => swatch.hex.toUpperCase());
  actions.append(
    button("detail-button", "이미지 보기", () => setFilter({ view: "wall", brand: row.slug, q: "", kind: "all", color: "" })),
    button("detail-button", "이 색으로 찾기", () => setFilter({ view: "wall", color: main.hex, brand: "" })),
    button("detail-button", "모두 복사", () => copyText(all.join(", "), "색상 코드를 복사했습니다.")),
  );
  body.append(actions);
  card.append(body);
  return card;
}

function renderColors() {
  state.rendered = 0;
  elements.wall.hidden = true;
  elements.wall.replaceChildren();
  elements.grid.hidden = true;
  elements.colorGrid.hidden = state.colorRows.length === 0;
  elements.colorGrid.replaceChildren();
  state.rendered = 0;
  appendColorBatch();
  window.requestAnimationFrame(fillViewport);
}

function appendColorBatch() {
  if (state.view !== "colors") return;
  const end = Math.min(state.rendered + 36, state.colorRows.length);
  const fragment = document.createDocumentFragment();
  state.colorRows.slice(state.rendered, end).forEach(row => fragment.append(createColorCard(row)));
  elements.colorGrid.append(fragment);
  state.rendered = end;
  elements.sentinel.hidden = end >= state.colorRows.length;
}

/* ---------- brand cards ---------- */

function createBrandCard(row, items) {
  const card = make("article", "brand-card");
  const liveItems = items.length ? items : row.items.filter((item) => !item.archived);
  const cover = liveItems.find(item => item.kind === "showcase") || liveItems.find((item) => item.kind === "layout" && item.part === "hero" && item.variant === "desktop")
    || liveItems.find((item) => item.kind === "layout" && item.part === "page" && item.variant === "desktop")
    || ["layout", "banner", "social", "photo", "logo", "graphic", "appicon", "favicon"].map((kind) => liveItems.find((item) => item.kind === kind)).find(Boolean);

  const preview = button("card-preview", "", () => openBrand(row), { "aria-label": `${row.company} 이미지 전체 보기` });
  if (cover) {
    if (CONTAINED_KINDS.has(cover.kind)) preview.classList.add("is-contained");
    if (["layout", "showcase"].includes(cover.kind)) preview.classList.add("is-layout");
    const image = make("img");
    image.src = tileSrc(cover);
    image.alt = "";
    image.loading = "lazy";
    image.decoding = "async";
    prepareReferenceImage(image, cover, preview);
    image.addEventListener("error", () => { image.remove(); preview.append(make("span", "preview-fallback", "미리보기를 불러오지 못했습니다. 상세에서 출처를 확인하세요.")); }, {once:true});
    preview.append(image);
  } else {
    preview.append(make("span", "preview-fallback", "수집된 이미지가 없습니다."));
  }

  const body = make("div", "card-body");
  const heading = make("div", "company-line");
  heading.append(markImage(row, "company-mark"));
  const titles = make("div", "company-titles");
  titles.append(make("h2", "", row.company), make("span", "category-name", row.collection === "gdweb" ? `${row.featuredGroup} · ${row.featuredDate}` : [categoryLabel(row.category), row.sub].filter(Boolean).join(" · ")));
  heading.append(titles);

  const palette = make("div", "mini-palette");
  const swatches = brandSwatches(row.colors);
  const hexes = swatches.length ? swatches.map((swatch) => swatch.hex) : (row.colors?.neutrals || []).slice(0, 4);
  hexes.slice(0, 6).forEach((hex) => {
    const dot = button("", "", () => copyHex(hex), { title: `${hex.toUpperCase()} 복사`, "aria-label": `${hex.toUpperCase()} 복사` });
    dot.style.background = hex;
    palette.append(dot);
  });

  const counts = make("div", "asset-counts");
  KIND_ORDER.forEach((kind) => {
    const count = liveItems.filter((item) => item.kind === kind).length;
    if (count) counts.append(make("span", "", `${KIND_LABELS[kind]} ${numberFormat(count)}`));
  });

  const actions = make("div", "card-actions");
  if (row.official_url) actions.append(link("공식 사이트", row.official_url, "official-link"));
  actions.append(button("detail-button", "이미지 벽으로", () => setFilter({ view: "wall", brand: row.slug, q: "" })));
  actions.append(button("detail-button", "전체 보기", () => openBrand(row)));

  const save = button("card-save", "", () => { if (cover) toggleFavorite(cover); }, {"aria-label": `${row.company} 대표 이미지 찜하기`, "aria-pressed": String(cover && isFavorite(cover))});
  if (cover) { save.dataset.favoriteKey = cover.key; save.append(icon(isFavorite(cover) ? "heart-fill" : "heart")); heading.append(save); }
  if (row.collection === "gdweb") card.classList.add("gdweb-card");
  body.append(heading, renderCoverage(row));
  if (row.tags.length) {
    const tags = make("div", "design-tags");
    row.tags.slice(0,3).forEach(tag => tags.append(button("", tag, () => setFilter({q:tag, brand:""}))));
    body.append(tags);
  }
  body.append(palette, counts, actions);
  card.append(preview, body);
  return card;
}

function renderBrands() {
  state.rendered = 0;
  elements.wall.hidden = true;
  elements.wall.replaceChildren();
  elements.colorGrid.hidden = true;
  elements.grid.hidden = state.brandList.length === 0;
  elements.grid.replaceChildren();
  appendBrandBatch();
  window.requestAnimationFrame(fillViewport);
}

function appendBrandBatch() {
  if (state.view !== "brands") return;
  const end = Math.min(state.rendered + 36, state.brandList.length);
  const fragment = document.createDocumentFragment();
  state.brandList.slice(state.rendered, end).forEach(([row, items]) => fragment.append(createBrandCard(row, items)));
  elements.grid.append(fragment);
  state.rendered = end;
  elements.sentinel.hidden = end >= state.brandList.length;
}

/* ---------- main render ---------- */

function render({ keepScroll = false } = {}) {
  restoreSavedKeys();
  computeList();
  renderChrome();
  const isBrands = state.view === "brands";
  const isColors = state.view === "colors";
  const count = isColors ? state.colorRows.length : isBrands ? state.brandList.length : state.list.length;
  const companies = new Set(state.list.map((item) => item.row)).size;
  const partLabel = state.kind === "layout" && state.parts.length === 1 ? PART_LABELS[state.parts[0]] : "";
  const kindLabel = partLabel || (state.kind === "all" ? "이미지" : KIND_LABELS[state.kind]);
  if (isColors) {
    elements.resultCount.textContent = `${numberFormat(count)}개 회사의 포인트 컬러`;
  } else if (state.view === "saved") {
    elements.resultCount.textContent = `${boardName(state.board)} · ${numberFormat(state.list.length)}개`;
  } else if (isBrands) {
    elements.resultCount.textContent = `${numberFormat(count)}개 ${state.collection === "gdweb" ? "선정 기록" : "사이트"} · ${numberFormat(state.list.length)}개 ${kindLabel}`;
  } else {
    elements.resultCount.textContent = `${numberFormat(state.list.length)}개 ${kindLabel} · ${numberFormat(companies)}개 사이트`;
  }

  elements.empty.hidden = count > 0;
  if (!count) {
    if (state.view === "saved") {
      elements.emptyTitle.textContent = state.board === HEART_BOARD ? "아직 찜한 이미지가 없습니다." : "이 보드는 비어 있습니다.";
      elements.emptyDescription.textContent = "이미지의 하트를 누르거나, 선택한 뒤 보드에 추가해 보세요.";
    } else if (isColors) {
      elements.emptyTitle.textContent = "조건에 맞는 포인트 컬러가 없습니다.";
      elements.emptyDescription.textContent = "색상이나 업종 필터를 줄여 보세요.";
    } else {
      elements.emptyTitle.textContent = "선택한 조건에 맞는 이미지가 없습니다.";
      elements.emptyDescription.textContent = state.kind === "layout" && !state.items.some((item) => item.kind === "layout")
        ? "이 범위에는 현재 화면 캡처가 없습니다. 선정 당시 화면이나 다른 소재를 확인해 보세요."
        : "필터를 줄이거나 검색어를 바꿔 보세요.";
    }
  }
  elements.emptyReset.hidden = activeFilterCount() + (state.q ? 1 : 0) + (state.kind !== "all" ? 1 : 0) + (state.brand ? 1 : 0) === 0;

  if (isColors) renderColors();
  else if (isBrands) renderBrands();
  else renderWall();
  updateSelectionBar();
  updateFavoriteChrome();
  writeUrl();
  if (!keepScroll && window.scrollY > elements.wall.offsetTop) window.scrollTo({ top: 0 });
}

function setFilter(patch) {
  const viewChanged = patch.view && patch.view !== state.view;
  if (viewChanged && patch.view === "saved") Object.assign(state, structuredClone(DEFAULT_FILTERS));
  Object.assign(state, patch);
  state.profile = "";
  if (viewChanged && patch.view !== "saved") state.board = HEART_BOARD;
  refreshCatalogView({push: !Object.keys(patch).every(key => key === "q")});
}

function resetFilters() {
  const { view, board, collection } = state;
  Object.assign(state, structuredClone(DEFAULT_FILTERS), { view, board, collection });
  refreshCatalogView({push:true});
}

/* ---------- selection ---------- */

function toggleSelection(item, index, range = false) {
  if (range && state.lastSelectedIndex >= 0) {
    const [start, end] = [state.lastSelectedIndex, index].sort((a, b) => a - b);
    state.list.slice(start, end + 1).forEach((entry) => state.selection.add(entry.key));
  } else if (state.selection.has(item.key)) {
    state.selection.delete(item.key);
  } else {
    state.selection.add(item.key);
  }
  state.lastSelectedIndex = index;
  syncSelectionMarks();
}

function syncSelectionMarks() {
  document.querySelectorAll(".tile").forEach((tile) => {
    const selected = state.selection.has(tile.dataset.key);
    tile.classList.toggle("is-selected", selected);
    tile.querySelector(".tile-check")?.setAttribute("aria-pressed", String(selected));
  });
  updateSelectionBar();
}

function selectedItems() {
  return [...state.selection].map((key) => state.itemByKey.get(key) || state.list.find((item) => item.key === key)).filter(Boolean);
}

function updateSelectionBar() {
  const count = state.selection.size;
  elements.selectionBar.hidden = count === 0;
  elements.selectionCount.textContent = `${numberFormat(count)}개 선택`;
  document.body.classList.toggle("has-selection", count > 0);
}

function clearSelection() {
  state.selection.clear();
  state.lastSelectedIndex = -1;
  syncSelectionMarks();
}

/* ---------- favorites & boards ---------- */

function loadSavedState() {
  try {
    const favorites = JSON.parse(localStorage.getItem(FAVORITES_STORAGE_KEY) || "{}");
    state.favorites = favorites && typeof favorites === "object" && !Array.isArray(favorites) ? favorites : {};
    const boards = JSON.parse(localStorage.getItem(BOARDS_STORAGE_KEY) || "{}");
    state.boards = boards && typeof boards === "object" && !Array.isArray(boards) ? boards : {};
    state.syncId = localStorage.getItem(SYNC_STORAGE_KEY) || "";
    const prefs = JSON.parse(localStorage.getItem(PREFS_STORAGE_KEY) || "{}");
    if (DENSITY_WIDTH[prefs.density]) state.density = prefs.density;
    if (prefs.bg) state.viewer.bg = prefs.bg;
  } catch {
    state.favorites = {};
    state.boards = {};
    state.syncId = "";
  }
}

function persistSavedState() {
  try {
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(state.favorites));
    localStorage.setItem(BOARDS_STORAGE_KEY, JSON.stringify(state.boards));
    if (state.syncId) localStorage.setItem(SYNC_STORAGE_KEY, state.syncId);
    else localStorage.removeItem(SYNC_STORAGE_KEY);
  } catch {
    setSyncStatus("브라우저 저장을 사용할 수 없음", "error");
  }
}

function persistPrefs() {
  try {
    localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify({ density: state.density, bg: state.viewer.bg }));
  } catch {
    // Preferences are optional.
  }
}

function isFavorite(item) {
  return Boolean(state.favorites[item.key]?.selected);
}

function recordFor(item) {
  const previous = state.favorites[item.key] || {};
  return {
    selected: Boolean(previous.selected),
    boards: Array.isArray(previous.boards) ? [...previous.boards] : [],
    updatedAt: new Date().toISOString(),
    company: item.row.company,
    category: item.row.category,
    asset: { type: item.type, kind: item.kind, path: item.path, width: item.width, height: item.height, sha256: item.sha },
  };
}

function setFavorite(item, selected) {
  const record = recordFor(item);
  record.selected = selected;
  state.favorites[item.key] = record;
}

function toggleFavorite(item) {
  setFavorite(item, !isFavorite(item));
  savedChanged();
  toast(isFavorite(item) ? "찜 목록에 담았습니다." : "찜을 해제했습니다.");
}

function liveBoards() {
  return Object.entries(state.boards)
    .filter(([, board]) => board && !board.deleted)
    .sort((a, b) => String(a[1].createdAt).localeCompare(String(b[1].createdAt)));
}

function boardName(id) {
  if (id === HEART_BOARD) return "찜한 이미지";
  return state.boards[id]?.name || "보드";
}

function boardMemberCount(id) {
  return Object.values(state.favorites).filter((record) => (id === HEART_BOARD ? record?.selected : record?.boards?.includes(id))).length;
}

function createBoard(name) {
  const id = `b${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();
  state.boards[id] = { name: cleanText(name).slice(0, 40) || "새 보드", createdAt: now, updatedAt: now, deleted: false };
  return id;
}

function setBoardMembership(items, boardId, member) {
  items.forEach((item) => {
    const record = recordFor(item);
    record.boards = member ? [...new Set([...record.boards, boardId])] : record.boards.filter((id) => id !== boardId);
    state.favorites[item.key] = record;
  });
}

function savedChanged() {
  persistSavedState();
  updateFavoriteChrome();
  if (state.view === "saved") render({ keepScroll: true });
  if (elements.viewer.open) renderViewerActions();
  scheduleSync();
}

function updateFavoriteChrome() {
  const total = new Set(Object.entries(state.favorites).filter(([, record]) => record?.selected || record?.boards?.length).map(([key]) => key)).size;
  elements.savedCount.textContent = numberFormat(total);
  document.querySelectorAll("[data-favorite-key]").forEach((element) => {
    const selected = Boolean(state.favorites[element.dataset.favoriteKey]?.selected);
    element.setAttribute("aria-pressed", String(selected));
    if (element.classList.contains("tile-heart") || element.classList.contains("card-save")) element.replaceChildren(icon(selected ? "heart-fill" : "heart"));
  });
}

function renderBoardTabs() {
  const tabs = [[HEART_BOARD, boardName(HEART_BOARD)], ...liveBoards().map(([id, board]) => [id, board.name])];
  if (state.board !== HEART_BOARD && !state.boards[state.board]) state.board = HEART_BOARD;
  const fragment = document.createDocumentFragment();
  tabs.forEach(([id, name]) => {
    const tab = button("board-tab", "", () => setFilter({ board: id }), { role: "tab", "aria-selected": String(state.board === id) });
    tab.append(name, make("small", "", numberFormat(boardMemberCount(id))));
    fragment.append(tab);
  });
  fragment.append(withIcon(button("board-tab add", "새 보드", () => {
    const name = window.prompt("새 보드 이름", "");
    if (name === null) return;
    const id = createBoard(name);
    persistSavedState();
    scheduleSync();
    setFilter({ board: id });
  }), "plus"));
  elements.boardTabs.replaceChildren(fragment);
  const custom = state.board !== HEART_BOARD;
  elements.boardRename.hidden = !custom;
  elements.boardDelete.hidden = !custom;
}

function openBoardDialog(items) {
  if (!items.length) return;
  state.boardTargets = items;
  elements.boardDialogDescription.textContent = items.length === 1 ? `${items[0].row.company} ${KIND_LABELS[items[0].kind]}` : `${numberFormat(items.length)}개 이미지`;
  renderBoardOptions();
  elements.newBoardName.value = "";
  elements.boardDialog.showModal();
}

function renderBoardOptions() {
  const items = state.boardTargets;
  const options = [[HEART_BOARD, "찜한 이미지"], ...liveBoards().map(([id, board]) => [id, board.name])];
  const fragment = document.createDocumentFragment();
  options.forEach(([id, name]) => {
    const label = make("label", "board-option");
    const checkbox = make("input");
    checkbox.type = "checkbox";
    const members = items.filter((item) => (id === HEART_BOARD ? isFavorite(item) : state.favorites[item.key]?.boards?.includes(id))).length;
    checkbox.checked = members === items.length;
    checkbox.indeterminate = members > 0 && members < items.length;
    checkbox.addEventListener("change", () => {
      if (id === HEART_BOARD) items.forEach((item) => setFavorite(item, checkbox.checked));
      else setBoardMembership(items, id, checkbox.checked);
      savedChanged();
      renderBoardOptions();
    });
    label.append(checkbox, make("span", "", name), make("small", "", numberFormat(boardMemberCount(id))));
    fragment.append(label);
  });
  elements.boardOptions.replaceChildren(fragment);
}

/* ---------- viewer ---------- */

async function openViewer(list, index) {
  if (!list.length) return;
  try { await ensureCatalogDetails([list[index]?._catalogGroup]); } catch { toast("일부 상세 정보를 불러오지 못했습니다. 이미지는 확인할 수 있습니다.", "error"); }
  state.viewer.list = list;
  state.viewer.index = Math.max(0, Math.min(index, list.length - 1));
  state.viewer.zoom = false;
  if (!elements.viewer.open) elements.viewer.showModal();
  writeUrl(true);
  renderViewer();
}

function closeViewer() {
  if (elements.viewer.open) elements.viewer.close();
}

async function stepViewer(delta) {
  const { list } = state.viewer;
  if (!list.length) return;
  state.viewer.index = (state.viewer.index + delta + list.length) % list.length;
  try { await ensureCatalogDetails([list[state.viewer.index]?._catalogGroup]); } catch { toast("상세 정보를 불러오지 못했습니다.", "error"); }
  state.viewer.zoom = false;
  renderViewer();
}

function currentItem() {
  return state.viewer.list[state.viewer.index];
}

function renderViewer() {
  const item = currentItem();
  if (!item) return;
  rememberReference(item.row, item);
  const { list, index } = state.viewer;
  elements.viewerPosition.textContent = `${numberFormat(index + 1)} / ${numberFormat(list.length)}`;
  elements.viewerCanvas.dataset.bg = state.viewer.bg;
  elements.viewerCanvas.dataset.kind = item.kind;
  elements.viewerCanvas.classList.toggle("is-zoomed", state.viewer.zoom);
  elements.viewerZoom.setAttribute("aria-pressed", String(state.viewer.zoom));
  elements.viewerBg.querySelectorAll("button").forEach((element) => element.setAttribute("aria-pressed", String(element.dataset.bg === state.viewer.bg)));

  const media = viewerMedia(item);
  media.addEventListener("click", () => toggleZoom());
  elements.viewerCanvas.dataset.part = item.part || "";
  if (item.kind === "icon" && item.background) {
    const frame = make("div", "icon-frame");
    frame.style.background = item.background;
    frame.append(media);
    elements.viewerCanvas.replaceChildren(frame);
  } else if (item.kind === "button") {
    const frame = make("div", "button-frame");
    if (item.style?.surface) frame.style.background = item.style.surface;
    frame.append(media);
    elements.viewerCanvas.replaceChildren(frame);
  } else {
    elements.viewerCanvas.replaceChildren(media);
  }
  elements.viewerCanvas.scrollTo(0, 0);

  elements.viewerCategory.textContent = [categoryLabel(item.row.category), item.row.sub].filter(Boolean).join(" · ");
  elements.viewerTitle.replaceChildren(markImage(item.row, "viewer-mark"), make("span", "", item.row.company));
  const kindText = item.kind === "layout" ? `레이아웃 · ${PART_LABELS[item.part] || "전체 페이지"}` : KIND_LABELS[item.kind];
  elements.viewerKind.textContent = `${kindText}${item.archived ? " · 지난 버전" : ""}`;
  renderResolutionNote(item);
  renderViewerActions();

  const facts = [
    ["해상도", item.width ? `${numberFormat(item.width)} × ${numberFormat(item.height)}` : "미확인"],
    ["비율", item.width ? ratioLabel(item.ratio) : "미확인"],
    ["형식", item.format],
    ["기기", deviceLabel(item.variant)],
  ];
  if (!item.region) facts.splice(3, 0, ["용량", formatBytes(item.bytes)]);
  if (item.kind === "layout" && item.label && !["page", "hero"].includes(item.part)) facts.unshift(["내용", item.label]);
  if (item.kind === "button" && item.style) {
    const style = item.style;
    facts.unshift(["버튼 글자", item.label || "-"]);
    facts.push(["형태", `${BUTTON_VARIANT_OPTIONS.find((o) => o.id === style.variant)?.label || ""} · ${BUTTON_SHAPE_OPTIONS.find((o) => o.id === style.shape)?.label || ""}`]);
    if (style.bg) facts.push(["배경색", style.bg.toUpperCase()]);
    if (style.fg) facts.push(["글자색", style.fg.toUpperCase()]);
    if (style.border) facts.push(["테두리", style.border.toUpperCase()]);
    facts.push(["모서리", `${style.radius}px`], ["높이", `${style.height}px`], ["글자", `${style.font_size}px · ${style.font_weight}`]);
  }
  if (item.kind === "button" && item.capturedStyles) {
    const style = item.capturedStyles;
    facts.unshift(["버튼 글자", item.label || "-"]);
    [["글꼴",style.font], ["글자 크기",style.fontSize], ["글자색",style.color], ["배경",style.background], ["모서리",style.borderRadius], ["테두리",style.border], ["안쪽 여백",style.padding]].filter(([,value]) => value).forEach(fact => facts.push(fact));
  }
  if (item.kind === "icon") {
    if (item.label) facts.push(["쓰인 곳", item.label]);
    const area = AREA_OPTIONS.find((option) => option.id === item.area);
    if (area) facts.push(["위치", area.label]);
    const sourceTypes = { svg: "인라인 SVG", img: "이미지 파일", background: "CSS 배경", font: "아이콘 폰트" };
    if (sourceTypes[item.sourceType]) facts.push(["만든 방식", sourceTypes[item.sourceType]]);
  }
  if (item.kind === "showcase") facts.push(["화면 구분", "GDWEB 선정 당시 이미지"]);
  if (item.date) facts.push([item.dateLabel, item.date]);
  if (item.truncated) facts.push(["참고", "긴 페이지라 일부만 캡처"]);
  if (item.analysis) facts.push(["톤", toneLabel(item.analysis)]);
  elements.viewerFacts.replaceChildren(...facts.map(([label, value]) => {
    const wrap = make("div");
    wrap.append(make("dt", "", label), make("dd", "", value));
    return wrap;
  }));

  elements.viewerPalette.replaceChildren();
  if (item.analysis?.p?.length) {
    const heading = make("div", "palette-heading");
    heading.append(make("h3", "", "대표 색상"), button("text-button", "전체 복사", () => copyText(item.analysis.p.map(([hex]) => hex.toUpperCase()).join(", "), "색상 코드를 복사했습니다.")));
    const swatches = make("div", "palette");
    item.analysis.p.forEach(([hex, weight]) => {
      const swatch = button("palette-swatch", "", () => copyText(hex.toUpperCase(), `${hex.toUpperCase()} 복사됨`), { title: `${hex.toUpperCase()} · ${Math.round(weight * 100)}%` });
      swatch.style.setProperty("--swatch", hex);
      swatch.style.flexGrow = String(Math.max(weight, 0.08));
      swatch.append(make("span", "", hex.toUpperCase()));
      swatches.append(swatch);
    });
    const search = button("text-button", "이 색으로 이미지 찾기", () => {
      closeViewer();
      setFilter({ color: item.analysis.p[0][0], view: state.view === "saved" ? "wall" : state.view });
    });
    elements.viewerPalette.append(heading, swatches, search);
  }

  const brandColors = brandSwatches(item.row.colors);
  if (brandColors.length) {
    const block = make("div", "brand-palette");
    const heading = make("div", "palette-heading");
    heading.append(make("h3", "", "회사 포인트 컬러"), button("text-button", "컬러 보기", () => {
      closeViewer();
      setFilter({ view: "colors", brand: item.row.slug, q: "", color: "" });
    }));
    const row = make("div", "brand-palette-row");
    brandColors.slice(0, 5).forEach((swatch) => {
      const chip = button("brand-swatch", "", () => copyHex(swatch.hex), { title: `${swatch.role} ${swatch.hex.toUpperCase()} 복사` });
      chip.style.setProperty("--swatch", swatch.hex);
      chip.append(make("span", "brand-swatch-color"), make("strong", "", swatch.hex.toUpperCase()), make("small", "", swatch.role));
      row.append(chip);
    });
    block.append(heading, row);
    elements.viewerPalette.append(block);
  }

  const links = [];
  if (item.kind === "button" && (item.style || item.capturedStyles)) links.push(button("", "CSS 복사", () => copyText(buttonCss(item), "버튼 CSS를 복사했습니다.")));
  if (item.sourceUrl) links.push(link(item.kind === "layout" || item.kind === "button" ? "캡처한 페이지" : "원본 출처", item.sourceUrl));
  if (item.sourcePage && item.sourcePage !== item.sourceUrl) links.push(link("발견 페이지", item.sourcePage));
  if (item.row.official_url && item.row.official_url !== item.sourceUrl) links.push(link("공식 사이트", item.row.official_url));
  if (item.row.gdweb_url) links.push(link("GDWEB 소개", item.row.gdweb_url));
  links.push(button("", "출처 정보 복사", () => copyText(sourceLine(item), "출처 정보를 복사했습니다.")));
  links.push(button("", "이 회사 이미지 모두 보기", () => {
    closeViewer();
    setFilter({ view: "wall", brand: item.row.slug, q: "", kind: "all" });
  }));
  elements.viewerLinks.replaceChildren(...links);

  renderRelated(item);
  writeUrl();
  preloadNeighbors();
}

function renderViewerActions() {
  const item = currentItem();
  if (!item) return;
  const favorite = isFavorite(item);
  const selected = state.selection.has(item.key);
  const boards = state.favorites[item.key]?.boards?.length || 0;
  elements.viewerActions.replaceChildren(
    withIcon(button(`action-button heart${favorite ? " is-on" : ""}`, favorite ? "찜됨" : "찜하기", () => toggleFavorite(item), { "aria-pressed": String(favorite), title: "F" }), favorite ? "heart-fill" : "heart"),
    withIcon(button("action-button", boards ? `보드 ${boards}곳` : "보드에 추가", () => openBoardDialog([item]), { title: "B" }), "folder-simple-plus"),
    withIcon(button("action-button", isRemoteImage(item) ? "원본 링크 복사" : "이미지 복사", () => isRemoteImage(item) ? copyText(item.path, "원본 링크를 복사했습니다.") : copyImage(item), { title: "C · Figma에 바로 붙여넣기" }), "copy"),
    withIcon(button("action-button", isRemoteImage(item) ? "원본 열기" : "파일 저장", () => downloadItem(item), { title: "D" }), "download-simple"),
    withIcon(button(`action-button${selected ? " is-on" : ""}`, selected ? "선택됨" : "선택에 담기", () => {
      toggleSelection(item, state.list.indexOf(item));
      renderViewerActions();
    }, { title: "S · 비교와 ZIP 저장에 사용" }), selected ? "check-square" : "square"),
  );
}

function withIcon(element, name) {
  element.prepend(icon(name));
  return element;
}

// A crop of a full-page capture, drawn from the original so it stays sharp.
function regionView(item) {
  const { src, x, y, w, h, fullWidth, fullHeight, pixelRatio } = item.region;
  const view = make("div", "region-view");
  view.setAttribute("role", "img");
  view.setAttribute("aria-label", `${item.row.company} ${PART_LABELS[item.part] || "레이아웃"}`);
  view.style.setProperty("--w", String(w));
  view.style.setProperty("--css-w", String(Math.round(w / (pixelRatio || 1))));
  view.style.aspectRatio = `${w} / ${h}`;
  view.style.backgroundImage = `url("${src}")`;
  view.style.backgroundSize = `${(fullWidth / w) * 100}% auto`;
  const px = fullWidth > w ? (x / (fullWidth - w)) * 100 : 0;
  const py = fullHeight > h ? (y / (fullHeight - h)) * 100 : 0;
  view.style.backgroundPosition = `${px}% ${py}%`;
  return view;
}

function viewerMedia(item) {
  if (item.region) return regionView(item);
  const image = make("img", ["layout", "showcase"].includes(item.kind) ? "is-layout" : "");
  if (item.kind === "layout" && item.variant === "mobile") image.classList.add("is-mobile");
  image.src = item.path;
  image.alt = `${item.row.company} ${KIND_LABELS[item.kind]}${item.label ? ` ${item.label}` : ""}`;
  prepareReferenceImage(image, item);
  image.addEventListener("load", () => {
    item.width = image.naturalWidth; item.height = image.naturalHeight; item.ratio = item.width / item.height;
    if (currentItem() !== item) return;
    renderResolutionNote(item);
    const facts = elements.viewerFacts.querySelectorAll("div");
    facts.forEach(fact => { if (fact.querySelector("dt")?.textContent === "해상도") fact.querySelector("dd").textContent = `${numberFormat(item.width)} × ${numberFormat(item.height)}`; });
  });
  image.addEventListener("error", () => {
    if (currentItem() !== item) return;
    const error = make("div", "image-unavailable", "원본에 연결할 수 없습니다.");
    error.append(button("quiet-button", "다시 시도", renderViewer));
    if (item.row.gdweb_url || item.sourceUrl) error.append(link("출처에서 확인", item.row.gdweb_url || item.sourceUrl, "quiet-button"));
    elements.viewerCanvas.replaceChildren(error);
  });
  return image;
}

function buttonCss(item) {
  if (item.capturedStyles) {
    const names = {font:"font-family",fontSize:"font-size",color:"color",background:"background",borderRadius:"border-radius",border:"border",padding:"padding"};
    return Object.entries(names).filter(([key]) => item.capturedStyles[key]).map(([key,name]) => `${name}: ${item.capturedStyles[key]};`).join("\n");
  }
  const style = item.style || {};
  const lines = [
    style.bg ? `background: ${style.bg};` : "background: transparent;",
    style.fg ? `color: ${style.fg};` : "",
    style.border ? `border: 1px solid ${style.border};` : "border: 0;",
    `border-radius: ${style.shape === "pill" ? 999 : style.radius}px;`,
    `height: ${style.height}px;`,
    `font-size: ${style.font_size}px;`,
    `font-weight: ${style.font_weight};`,
  ];
  return [`/* ${item.row.company} 버튼: ${item.label} */`, ...lines.filter(Boolean)].join("\n");
}

// The image bytes of an item; crops are cut out of their full-page capture.
async function itemBlob(item, type = "") {
  if (!item.region && !type) {
    const response = await fetch(item.path);
    if (!response.ok) throw new Error(String(response.status));
    return response.blob();
  }
  const image = await new Promise((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = reject;
    element.src = item.region ? item.region.src : item.path;
  });
  const box = item.region || { x: 0, y: 0, w: image.naturalWidth || item.width || 512, h: image.naturalHeight || item.height || 512 };
  const scale = !item.region && item.format === "SVG" ? Math.max(1, 1200 / Math.max(box.w, 1)) : 1;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(box.w * scale));
  canvas.height = Math.max(1, Math.round(box.h * scale));
  canvas.getContext("2d").drawImage(image, box.x, box.y, box.w, box.h, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))), type || "image/webp", 0.92));
}

function ratioLabel(ratio) {
  const option = RATIO_OPTIONS.find((entry) => entry.test(ratio));
  return `${option?.label || ""} ${ratio >= 1 ? `${ratio.toFixed(2)}:1` : `1:${(1 / ratio).toFixed(2)}`}`;
}

function toneLabel(analysis) {
  const labels = TONE_OPTIONS.filter((option) => option.test(analysis)).map((option) => option.label);
  return labels.join(", ") || "중간 톤";
}

function hamming(a, b) {
  if (!a || !b || a.length !== b.length) return 99;
  let distance = 0;
  for (let i = 0; i < a.length; i += 1) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (x) {
      distance += x & 1;
      x >>= 1;
    }
  }
  return distance;
}

function similarItems(item, limit = 12) {
  const labs = itemLabs(item);
  const scored = [];
  state.items.forEach((other) => {
    if (other.kind !== item.kind || (item.part && other.part !== item.part)) return;
    if (other === item || other.sha === item.sha || other.archived || other.row === item.row) return;
    let score = Infinity;
    if (item.dhash && other.dhash) {
      const distance = hamming(item.dhash, other.dhash);
      if (distance <= 12) score = distance * 2;
    }
    if (labs.length && other.analysis) {
      const sameKind = other.kind === item.kind ? 0 : 14;
      const top = labs.slice(0, 3);
      const otherLabs = itemLabs(other).slice(0, 3);
      if (otherLabs.length) {
        const colorScore = top.reduce((sum, { lab, weight }) => sum + weight * Math.min(...otherLabs.map((entry) => labDistance(lab, entry.lab))), 0) / Math.max(0.01, top.reduce((sum, entry) => sum + entry.weight, 0));
        score = Math.min(score, colorScore + sameKind + Math.abs(Math.log(other.ratio / item.ratio)) * 8);
      }
    }
    if (score < 40) scored.push([score, other]);
  });
  return scored.sort((a, b) => a[0] - b[0]).slice(0, limit).map(([, other]) => other);
}

function relatedStrip(title, items, note = "") {
  if (!items.length) return null;
  const section = make("section", "related");
  const heading = make("div", "palette-heading");
  heading.append(make("h3", "", title));
  if (note) heading.append(make("span", "related-note", note));
  const strip = make("div", "related-strip");
  items.forEach((entry, index) => {
    const thumb = button(`related-thumb${CONTAINED_KINDS.has(entry.kind) ? " is-contained" : ""}`, "", () => openViewer(items, index), { "aria-label": `${entry.row.company} ${itemCaption(entry)}`, title: `${entry.row.company} · ${itemCaption(entry)}${entry.date ? ` · ${entry.date}` : ""}` });
    if (entry.kind === "button" && entry.style?.surface) thumb.style.background = entry.style.surface;
    const image = make("img");
    image.src = tileSrc(entry);
    image.alt = "";
    image.loading = "lazy";
    prepareReferenceImage(image, entry);
    thumb.append(image);
    if (entry.archived && entry.date) thumb.append(make("span", "", entry.date));
    strip.append(thumb);
  });
  section.append(heading, strip);
  return section;
}

function renderRelated(item) {
  const sections = [];
  const history = item.row.items
    .filter((entry) => entry.kind === item.kind && entry.part === item.part && (item.kind !== "layout" || entry.variant === item.variant) && (entry.archived || entry === item))
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  if (history.length > 1) sections.push(relatedStrip("변천사", history, `${history.length}개 버전`));
  const closeness = (entry) => (entry.kind === item.kind ? 0 : 2) + (entry.part === item.part ? 0 : 1);
  const sameBrand = item.row.items.filter((entry) => !entry.archived && entry !== item).sort((a, b) => closeness(a) - closeness(b)).slice(0, 18);
  sections.push(relatedStrip("같은 회사", sameBrand));
  sections.push(relatedStrip("비슷한 이미지", similarItems(item), "형태·색감 기준"));
  elements.viewerRelated.replaceChildren(...sections.filter(Boolean));
}

function preloadNeighbors() {
  [-1, 1].forEach((delta) => {
    const neighbor = state.viewer.list[(state.viewer.index + delta + state.viewer.list.length) % state.viewer.list.length];
    if (neighbor && neighbor.thumb) new Image().src = neighbor.thumb;
  });
}

function toggleZoom() {
  state.viewer.zoom = !state.viewer.zoom;
  elements.viewerCanvas.classList.toggle("is-zoomed", state.viewer.zoom);
  elements.viewerZoom.setAttribute("aria-pressed", String(state.viewer.zoom));
}

function cycleBackground() {
  const order = ["checker", "light", "dark"];
  setViewerBackground(order[(order.indexOf(state.viewer.bg) + 1) % order.length]);
}

function setViewerBackground(bg) {
  state.viewer.bg = bg;
  elements.viewerCanvas.dataset.bg = bg;
  elements.viewerBg.querySelectorAll("button").forEach((element) => element.setAttribute("aria-pressed", String(element.dataset.bg === bg)));
  persistPrefs();
}

/* ---------- brand dialog ---------- */

async function openBrand(row) {
  try { await Promise.all([ensureCatalogDetails(row.items.map(item=>item._catalogGroup)),ensureCatalogColors()]); } catch { toast("일부 상세 정보를 불러오지 못했습니다.","error"); }
  state.profile = row.slug;
  rememberReference(row);
  elements.brandCategory.textContent = [categoryLabel(row.category), row.sub, REGION_OPTIONS.find((o) => o.id === row.region)?.label].filter(Boolean).join(" · ");
  elements.brandTitle.replaceChildren(markImage(row, "viewer-mark"), make("span", "", row.company));
  elements.brandDescription.textContent = row.description || row.page_title || (row.collection === "gdweb" ? "GDWEB에서 소개한 사이트의 디자인 기록입니다." : "공식 사이트에서 수집한 이미지 자료입니다.");
  const actions = [];
  if (row.official_url) actions.push(withIcon(link("공식 사이트", row.official_url, "quiet-button"), "arrow-square-out"));
  actions.push(withIcon(button("quiet-button", "이미지 벽으로 보기", () => {
    elements.brandDialog.close();
    setFilter({ view: "wall", brand: row.slug, q: "", kind: "all" });
  }), "squares-four"));
  if (row.gdweb_url) actions.push(withIcon(link("GDWEB 소개", row.gdweb_url, "quiet-button"), "arrow-square-out"));
  actions.push(withIcon(button("quiet-button", "사이트 자료 ZIP", () => exportZip(row.items.filter(i => !i.archived), row.company)), "download-simple"));
  elements.brandActions.replaceChildren(...actions);
  elements.brandActions.append(renderCoverage(row));

  const fragment = document.createDocumentFragment();
  if (row.collection === "gdweb") {
    const brief = make("div", "site-design-brief");
    brief.append(make("p", "", `${row.featuredGroup} / ${row.featuredDate} 선정`));
    if (row.fonts.length) brief.append(make("p", "", `사용 글꼴: ${row.fonts.slice(0,3).join(", ")}`));
    if (row.captureNote) brief.append(make("p", "", row.captureNote));
    brief.append(make("p", "", "선정 당시 화면과 현재 캡처를 구분해 제공합니다. 모션은 공식 사이트에서 확인하세요."));
    brief.append(make("p", "", "수집된 파일은 ZIP으로, 외부 원본은 출처 링크로 저장됩니다. 이미지의 권리는 원저작자에게 있습니다."));
    fragment.append(brief);
  }
  const swatches = brandSwatches(row.colors);
  if (swatches.length || row.colors?.neutrals?.length) {
    const block = make("section", "asset-group brand-colors-group");
    const heading = make("div", "asset-group-heading");
    heading.append(make("h3", "", "포인트 컬러"), make("span", "", row.colors?.evidence_type === 'image-derived-reference' ? '로고·파비콘 원본에서 추출한 참고 색상' : row.colors?.monochrome ? "무채색 중심 브랜드" : "사이트의 버튼, 강조 글자, 로고에서 뽑은 색"));
    const strip = make("div", "brand-color-strip");
    [...swatches, ...(row.colors?.neutrals || []).slice(0, 4).map((hex) => ({ hex, role: "무채색", sources: [] }))].forEach((swatch) => {
      const chip = button("brand-color", "", () => copyHex(swatch.hex), { title: `${swatch.hex.toUpperCase()} 복사${swatch.sources?.length ? ` · 근거: ${swatch.sources.join(", ")}` : ""}` });
      chip.style.setProperty("--swatch", swatch.hex);
      chip.style.color = readableOn(swatch.hex);
      chip.append(make("small", "", swatch.role), make("strong", "", swatch.hex.toUpperCase()));
      strip.append(chip);
    });
    block.append(heading, strip);
    if(row.colors?.source_urls?.[0])block.append(link('색상 추출 원본',row.colors.source_urls[0],'color-evidence'));
    fragment.append(block);
  }
  const live = row.items.filter((item) => !item.archived);
  KIND_ORDER.forEach((kind) => {
    const items = live.filter((item) => item.kind === kind);
    if (!items.length) return;
    if (kind === "layout") {
      PART_OPTIONS.forEach((part) => {
        const group = items.filter((item) => item.part === part.id);
        if (group.length) fragment.append(brandGroup(`레이아웃 · ${part.label}`, group));
      });
    } else {
      fragment.append(brandGroup(KIND_LABELS[kind], items));
    }
  });
  const archived = row.items.filter((item) => item.archived).sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  if (archived.length) fragment.append(brandGroup("지난 버전", archived));
  if (!fragment.childNodes.length) fragment.append(make("div", "state-panel", "수집된 이미지가 없습니다."));
  elements.brandContent.replaceChildren(fragment);
  elements.brandDialog.showModal();
  writeUrl(true);
}

function brandGroup(title, items) {
  const group = make("section", "asset-group");
  if (items.every((item) => item.kind === "icon")) group.classList.add("icon-group");
  if (items.every((item) => item.kind === "button")) group.classList.add("button-group");
  const heading = make("div", "asset-group-heading");
  heading.append(make("h3", "", title), make("span", "", `${numberFormat(items.length)}개`));
  const grid = make("div", "asset-grid");
  items.forEach((item, index) => {
    const card = button(`asset-thumb kind-${item.kind}${item.part ? ` part-${item.part}` : ""}${CONTAINED_KINDS.has(item.kind) ? " is-contained" : ""}`, "", () => openViewer(items, index), { "aria-label": `${item.row.company} ${itemCaption(item)} ${index + 1} 크게 보기` });
    const media = make("span", "asset-thumb-media");
    if (item.kind === "icon" && item.background) media.style.background = item.background;
    if (item.kind === "button" && item.style?.surface) media.style.background = item.style.surface;
    const image = make("img");
    image.src = tileSrc(item);
    image.alt = "";
    image.loading = "lazy";
    prepareReferenceImage(image, item, media);
    media.append(image);
    const meta = make("span", "asset-thumb-meta", item.kind === "icon" || item.kind === "button" || (item.kind === "layout" && item.label && !["page", "hero"].includes(item.part))
      ? item.label
      : [item.width ? `${item.width}×${item.height}` : "", item.variant !== "shared" ? deviceLabel(item.variant) : "", item.format, item.date].filter(Boolean).join(" · "));
    card.append(media, meta);
    grid.append(card);
  });
  group.append(heading, grid);
  return group;
}

/* ---------- compare ---------- */

async function openCompare(items) {
  if (items.length < 2) {
    toast("비교하려면 이미지를 2개 이상 선택하세요.", "error");
    return;
  }
  try { await ensureCatalogDetails(items.map(item=>item._catalogGroup)); } catch { toast("일부 상세 정보를 불러오지 못했습니다.","error"); }
  const columns = items.slice(0, 6).map((item) => {
    const column = make("article", "compare-column");
    const head = make("header");
    head.append(make("strong", "", item.row.company), make("span", "", `${itemCaption(item)} · ${item.width}×${item.height} · ${deviceLabel(item.variant)}`));
    const scroller = make("div", `compare-media${CONTAINED_KINDS.has(item.kind) ? " is-contained" : ""}`);
    scroller.append(viewerMedia(item));
    scroller.addEventListener("scroll", () => {
      if (!elements.compareSync.checked || scroller.dataset.syncing) return;
      const ratio = scroller.scrollTop / Math.max(1, scroller.scrollHeight - scroller.clientHeight);
      elements.compareContent.querySelectorAll(".compare-media").forEach((other) => {
        if (other === scroller) return;
        other.dataset.syncing = "1";
        other.scrollTop = ratio * (other.scrollHeight - other.clientHeight);
        window.requestAnimationFrame(() => delete other.dataset.syncing);
      });
    });
    const palette = make("div", "mini-palette");
    (item.analysis?.p || []).forEach(([hex]) => {
      const dot = make("span");
      dot.style.background = hex;
      dot.title = hex;
      palette.append(dot);
    });
    column.append(head, scroller, palette);
    return column;
  });
  if (items.length > 6) toast("최대 6개까지 비교합니다.");
  elements.compareContent.style.setProperty("--compare-count", String(columns.length));
  elements.compareContent.replaceChildren(...columns);
  elements.compareDialog.showModal();
}

/* ---------- clipboard, download, zip ---------- */

async function copyText(text, message) {
  try {
    await navigator.clipboard.writeText(text);
    toast(message);
  } catch {
    toast("복사할 수 없습니다. 브라우저 권한을 확인해 주세요.", "error");
  }
}

function sourceLine(item) {
  return [item.row.company, categoryLabel(item.row.category), KIND_LABELS[item.kind], item.sourceUrl || item.row.official_url, item.row.gdweb_url ? `GDWEB ${item.row.gdweb_url}` : "", item.date ? `${item.dateLabel} ${item.date}` : ""].filter(Boolean).join(" · ");
}

function isRemoteImage(item) { return new URL(item.path, location.href).origin !== location.origin; }

async function copyImage(item) {
  if (isRemoteImage(item)) { toast("외부 원본은 원본 열기 후 우클릭하여 복사할 수 있습니다."); return; }
  if (!navigator.clipboard || typeof ClipboardItem === "undefined") {
    toast("이 브라우저는 이미지 복사를 지원하지 않습니다.", "error");
    return;
  }
  try {
    await navigator.clipboard.write([new ClipboardItem({ "image/png": itemBlob(item, "image/png") })]);
    toast("이미지를 복사했습니다. Figma나 문서에 붙여넣으세요.");
  } catch (error) {
    console.error(error);
    toast("이미지를 복사하지 못했습니다.", "error");
  }
}

function fileNameFor(item, index = 0) {
  const extension = item.region ? "webp" : ({JPEG:"jpg", PNG:"png", WEBP:"webp", SVG:"svg", ICO:"ico", GIF:"gif"})[item.format] || "img";
  const kind = item.kind === "layout" ? PART_LABELS[item.part] || KIND_LABELS[item.kind] : KIND_LABELS[item.kind];
  const base = [item.row.company, kind, item.variant !== "shared" ? deviceLabel(item.variant) : "", item.width ? `${item.width}x${item.height}` : "", item.date]
    .filter(Boolean).join("_").replace(/[\\/:*?"<>|·\s]+/g, "-");
  return `${index ? `${String(index).padStart(3, "0")}_` : ""}${base}.${extension}`;
}

function saveBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const anchor = make("a");
  anchor.href = url;
  anchor.download = name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

async function downloadItem(item) {
  if (isRemoteImage(item)) { window.open(item.path, "_blank", "noopener,noreferrer"); return; }
  try {
    saveBlob(await itemBlob(item), fileNameFor(item));
  } catch {
    toast("파일을 저장하지 못했습니다.", "error");
  }
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function buildZip(files) {
  const encoder = new TextEncoder();
  const chunks = [];
  const central = [];
  let offset = 0;
  const now = new Date();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  files.forEach(({ name, data }) => {
    const nameBytes = encoder.encode(name);
    const crc = crc32(data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true);
    local.setUint16(10, dosTime, true);
    local.setUint16(12, dosDate, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, data.length, true);
    local.setUint32(22, data.length, true);
    local.setUint16(26, nameBytes.length, true);
    chunks.push(local.buffer, nameBytes, data);

    const entry = new DataView(new ArrayBuffer(46));
    entry.setUint32(0, 0x02014b50, true);
    entry.setUint16(4, 20, true);
    entry.setUint16(6, 20, true);
    entry.setUint16(8, 0x0800, true);
    entry.setUint16(12, dosTime, true);
    entry.setUint16(14, dosDate, true);
    entry.setUint32(16, crc, true);
    entry.setUint32(20, data.length, true);
    entry.setUint32(24, data.length, true);
    entry.setUint16(28, nameBytes.length, true);
    entry.setUint32(42, offset, true);
    central.push(entry.buffer, nameBytes);
    offset += 30 + nameBytes.length + data.length;
  });
  const centralSize = central.reduce((sum, part) => sum + part.byteLength, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);
  return new Blob([...chunks, ...central, end.buffer], { type: "application/zip" });
}

function csvCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

async function performZipExport(items, name) {
  if (!items.length) { toast("저장할 이미지가 없습니다.", "error"); return; }
  const files = [];
  let skipped = 0;
  const rows = [["파일 / 상태", "회사", "유형", "기기", "가로", "세로", "형식", "날짜", "원본 URL", "공식 사이트", "GDWEB 소개"]];
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    $("#export-progress").textContent = `ZIP 준비 중 ${index + 1} / ${items.length}`;
    let fileName = "외부 원본: URL에서 직접 저장";
    if (!isRemoteImage(item)) {
      try {
        const blob = await itemBlob(item);
        fileName = fileNameFor(item, index + 1);
        files.push({ name: fileName, data: new Uint8Array(await blob.arrayBuffer()) });
      } catch { fileName = "파일을 불러오지 못함: 원본 URL 확인"; skipped += 1; }
    } else { skipped += 1; }
    rows.push([fileName, item.row.company, KIND_LABELS[item.kind], deviceLabel(item.variant), item.width, item.height, item.format, item.date, item.sourceUrl || new URL(item.path, location.href).href, item.row.official_url, item.row.gdweb_url]);
  }
  const csv = `﻿${rows.map(row => row.map(csvCell).join(",")).join("\r\n")}`;
  const imageCount = files.length;
  files.push({ name: "출처.csv", data: new TextEncoder().encode(csv) });
  const remote = items.filter(isRemoteImage);
  if (remote.length) {
    const links = make("div");
    links.append(make("h1", "", "외부 원본 링크"), make("p", "", "외부 원본은 이미지 파일로 포함되지 않습니다. 아래 링크에서 직접 확인하고 저장하세요."));
    remote.forEach(item => { const p=make("p"); p.append(link(`${item.row.company} · ${itemCaption(item)}`,item.path));links.append(p); });
    files.push({name:"외부-원본-링크.html",data:new TextEncoder().encode('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>외부 원본 링크</title>'+links.outerHTML)});
  }
  const stamp = new Date().toISOString().slice(0, 10);
  saveBlob(buildZip(files), `${name.replace(/[\\/:*?"<>|♥\s]+/g, "-") || "레퍼런스"}_${stamp}.zip`);
  toast(`${numberFormat(imageCount)}개 이미지 저장${skipped ? `, 외부·미포함 ${skipped}개는 출처.csv에서 확인` : ""}.`);
}

/* ---------- sync ---------- */

function validSyncId(value) {
  const parts = cleanText(value).split(".");
  return parts.length === 2 && /^brandref-[a-z0-9]{16,40}$/i.test(parts[0]) && /^[a-f0-9]{64}$/i.test(parts[1]);
}

function parseSyncId(value) {
  if (!validSyncId(value)) throw new Error("동기화 코드 형식을 확인해 주세요.");
  const [namespace, key] = cleanText(value).split(".");
  return { namespace, key };
}

function compactRecords(records) {
  const compact = {};
  const cutoff = Date.now() - 1000 * 60 * 60 * 24 * 120;
  Object.entries(records).forEach(([key, record]) => {
    const timestamp = Date.parse(record?.updatedAt || "") || Date.now();
    const boards = Array.isArray(record?.boards) ? record.boards : [];
    if (record?.selected || boards.length || timestamp >= cutoff) {
      compact[key] = { s: record?.selected ? 1 : 0, t: timestamp };
      if (boards.length) compact[key].b = boards;
    }
  });
  return compact;
}

function expandRecords(records) {
  const expanded = {};
  Object.entries(records || {}).forEach(([key, record]) => {
    const item = state.itemByKey.get(key);
    const base = item ? recordFor(item) : { asset: { path: key } };
    expanded[key] = {
      ...base,
      selected: Boolean(record?.s),
      boards: Array.isArray(record?.b) ? record.b.map(String) : [],
      updatedAt: new Date(Number(record?.t) || Date.now()).toISOString(),
    };
  });
  return expanded;
}

function compactBoards(boards) {
  return Object.fromEntries(Object.entries(boards).map(([id, board]) => [id, { n: board.name, c: board.createdAt, t: Date.parse(board.updatedAt) || 0, d: board.deleted ? 1 : 0 }]));
}

function expandBoards(boards) {
  return Object.fromEntries(Object.entries(boards || {}).map(([id, board]) => [id, {
    name: cleanText(board?.n) || "보드",
    createdAt: board?.c || new Date(0).toISOString(),
    updatedAt: new Date(Number(board?.t) || 0).toISOString(),
    deleted: Boolean(board?.d),
  }]));
}

function mergeByUpdatedAt(local, remote) {
  const merged = { ...remote };
  Object.entries(local).forEach(([key, value]) => {
    const other = merged[key];
    if (!other || String(value?.updatedAt || "") >= String(other?.updatedAt || "")) merged[key] = value;
  });
  return merged;
}

function setSyncStatus(message, tone = "") {
  elements.syncStatus.textContent = message;
  elements.syncStatus.dataset.tone = tone;
}

function setSyncMessage(message, tone = "") {
  elements.syncMessage.textContent = message;
  elements.syncMessage.dataset.tone = tone;
}

function updateSyncDialog() {
  const connected = Boolean(state.syncId);
  elements.syncDisconnected.hidden = connected;
  elements.syncConnected.hidden = !connected;
  elements.syncCodeOutput.textContent = connected ? state.syncId : "";
  setSyncStatus(connected ? "온라인 동기화 연결됨" : "이 기기에 저장 중", connected ? "ok" : "");
}

async function fetchRemote(syncId) {
  const { namespace, key } = parseSyncId(syncId);
  const response = await fetch(`${SYNC_API}/${encodeURIComponent(namespace)}/${SYNC_PATH}`, {
    headers: { Accept: "application/json", "X-Mantle-Key": key },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(response.status === 404 ? "동기화 코드를 찾을 수 없습니다." : `동기화 서버 오류 (${response.status})`);
  const payload = await response.json();
  return { records: expandRecords(payload?.records), boards: expandBoards(payload?.boards) };
}

async function putRemote(syncId) {
  const { namespace, key } = parseSyncId(syncId);
  const response = await fetch(`${SYNC_API}/${encodeURIComponent(namespace)}/${SYNC_PATH}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", "X-Mantle-Key": key },
    body: JSON.stringify({ version: 3, updatedAt: new Date().toISOString(), records: compactRecords(state.favorites), boards: compactBoards(state.boards) }),
  });
  if (!response.ok) throw new Error(`동기화 저장 오류 (${response.status})`);
}

async function mergeRemote(syncId) {
  const remote = await fetchRemote(syncId);
  state.favorites = mergeByUpdatedAt(state.favorites, remote.records);
  state.boards = mergeByUpdatedAt(state.boards, remote.boards);
  restoreSavedKeys();
  await putRemote(syncId);
}

async function syncNow({ quiet = false } = {}) {
  if (!state.syncId || state.syncing) return;
  state.syncing = true;
  setSyncStatus("동기화 중…");
  if (!quiet) setSyncMessage("최신 보관함을 확인하고 있습니다.");
  try {
    await mergeRemote(state.syncId);
    persistSavedState();
    updateFavoriteChrome();
    if (state.view === "saved") render({ keepScroll: true });
    setSyncStatus("온라인 동기화 완료", "ok");
    if (!quiet) setSyncMessage("다른 컴퓨터와 같은 목록으로 맞췄습니다.", "ok");
  } catch (error) {
    console.error(error);
    setSyncStatus("동기화 실패 · 이 기기에 보관", "error");
    if (!quiet) setSyncMessage(error.message || "동기화하지 못했습니다.", "error");
  } finally {
    state.syncing = false;
  }
}

function scheduleSync() {
  if (!state.syncId) return;
  window.clearTimeout(state.syncTimer);
  state.syncTimer = window.setTimeout(() => syncNow({ quiet: true }), 700);
}

async function createSyncSpace() {
  if (state.syncing) return;
  state.syncing = true;
  elements.syncCreate.disabled = true;
  setSyncMessage("새 동기화 보관함을 만들고 있습니다.");
  try {
    const namespace = `brandref-${crypto.randomUUID().replaceAll("-", "")}`;
    const claim = await fetch(`${SYNC_API}/claim/${namespace}`, { headers: { Accept: "application/json" } });
    if (!claim.ok) throw new Error(`동기화 보관함 생성 오류 (${claim.status})`);
    const payload = await claim.json();
    const id = `${payload.namespace || namespace}.${payload.key || ""}`;
    if (!validSyncId(id)) throw new Error("동기화 코드를 확인할 수 없습니다.");
    state.syncId = id;
    await putRemote(id);
    persistSavedState();
    updateSyncDialog();
    setSyncMessage("동기화가 연결되었습니다. 코드를 안전한 곳에 보관하세요.", "ok");
  } catch (error) {
    console.error(error);
    setSyncMessage(error.message || "동기화 보관함을 만들지 못했습니다.", "error");
  } finally {
    state.syncing = false;
    elements.syncCreate.disabled = false;
  }
}

async function connectSyncCode(rawCode) {
  const code = cleanText(rawCode);
  if (!validSyncId(code)) {
    setSyncMessage("동기화 코드 형식을 확인해 주세요.", "error");
    return;
  }
  setSyncMessage("동기화 코드를 확인하고 있습니다.");
  try {
    await mergeRemote(code);
    state.syncId = code;
    persistSavedState();
    updateSyncDialog();
    updateFavoriteChrome();
    if (state.view === "saved") render({ keepScroll: true });
    elements.syncCodeInput.value = "";
    setSyncMessage("이 컴퓨터가 같은 보관함에 연결되었습니다.", "ok");
  } catch (error) {
    console.error(error);
    setSyncMessage(error.message || "동기화 코드에 연결하지 못했습니다.", "error");
  }
}

/* ---------- theme ---------- */

function setTheme(theme, persist = true) {
  elements.root.dataset.theme = theme;
  elements.themeToggle.setAttribute("aria-label", theme === "dark" ? "라이트 모드로 전환" : "다크 모드로 전환");
  elements.themeToggle.replaceChildren(icon(theme === "dark" ? "sun" : "moon"));
  elements.themeMeta.setAttribute("content", theme === "dark" ? "#0f0f11" : "#f6f6f7");
  if (persist) {
    try {
      localStorage.setItem("brand-library-theme", theme);
    } catch {
      // Storage can be blocked.
    }
  }
}

function setupTheme() {
  let saved = "";
  try {
    saved = localStorage.getItem("brand-library-theme") || "";
  } catch {
    saved = "";
  }
  const preferred = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  setTheme(saved === "dark" || saved === "light" ? saved : preferred, false);
  elements.themeToggle.addEventListener("click", () => setTheme(elements.root.dataset.theme === "dark" ? "light" : "dark"));
}

/* ---------- events ---------- */

function anyDialogOpen() {
  return Boolean(document.querySelector('dialog[open]'));
}

function closeOnBackdrop(dialog) {
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
}

function setupEvents() {
  setupReferenceTools();
  setupReferenceUpgrades();
  const deck = document.querySelector(".deck");
  new ResizeObserver(() => elements.root.style.setProperty("--deck-height", `${deck.offsetHeight}px`)).observe(deck);

  let searchTimer = 0;
  elements.search.addEventListener("input", () => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => {
      const value = elements.search.value.trim();
      const hex = value.match(/^#?([0-9a-f]{6})$/i);
      if (hex) setFilter({ color: `#${hex[1].toLowerCase()}`, q: "" });
      else setFilter({ q: value ? elements.search.value : "" });
    }, 140);
  });
  elements.viewButtons.forEach((element) => element.addEventListener("click", () => setFilter({ view: element.dataset.view })));
  elements.sort.addEventListener("change", () => setFilter({ sort: elements.sort.value }));
  elements.shuffle.addEventListener("click", () => setFilter({ seed: Math.floor(Math.random() * 1e9) }));
  elements.density.addEventListener("click", (event) => {
    const target = event.target.closest("[data-density]");
    if (!target) return;
    state.density = target.dataset.density;
    persistPrefs();
    render({ keepScroll: true });
  });

  elements.emptyReset.addEventListener("click", () => {
    state.q = "";
    state.brand = "";
    resetFilters();
  });
  elements.filterOpen.addEventListener("click", () => document.body.classList.add("filters-open"));
  elements.filterClose.addEventListener("click", () => document.body.classList.remove("filters-open"));

  elements.wall.addEventListener("click", (event) => {
    const target = event.target.closest("[data-action]");
    const tile = event.target.closest(".tile");
    if (!target || !tile) return;
    const index = Number(tile.dataset.index);
    const item = state.list[index];
    if (!item) return;
    if (target.dataset.action === "heart") toggleFavorite(item);
    else if (target.dataset.action === "select") toggleSelection(item, index, event.shiftKey);
    else if (state.selection.size && (event.shiftKey || event.metaKey || event.ctrlKey)) toggleSelection(item, index, event.shiftKey);
    else openViewer(state.list, index);
  });

  new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting)) {
      if (state.view === "colors") appendColorBatch(); else if (state.view === "brands") appendBrandBatch(); else appendBatch();
      window.requestAnimationFrame(fillViewport);
    }
  }, { rootMargin: "1400px 0px" }).observe(elements.sentinel);

  let resizeTimer = 0;
  let lastWidth = window.innerWidth;
  window.addEventListener("resize", () => {
    if (window.innerWidth === lastWidth) return;
    lastWidth = window.innerWidth;
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      if (state.view !== "brands" && state.view !== "colors" && state.rows.length) {
        const shown = state.rendered;
        setupColumns();
        while (state.rendered < shown) appendBatch();
      }
    }, 180);
  });

  document.getElementById("sel-heart").addEventListener("click", () => {
    const items = selectedItems();
    const allOn = items.every(isFavorite);
    items.forEach((item) => setFavorite(item, !allOn));
    savedChanged();
    toast(allOn ? `${items.length}개 찜 해제` : `${items.length}개를 찜했습니다.`);
  });
  document.getElementById("sel-board").addEventListener("click", () => openBoardDialog(selectedItems()));
  document.getElementById("sel-compare").addEventListener("click", () => openCompare(selectedItems()));
  document.getElementById("sel-zip").addEventListener("click", () => exportZip(selectedItems(), "선택한-레퍼런스"));
  document.getElementById("sel-sources").addEventListener("click", () => copySources(selectedItems()));
  document.getElementById("sel-all").addEventListener("click", () => {
    state.list.forEach((item) => state.selection.add(item.key));
    syncSelectionMarks();
  });
  document.getElementById("sel-clear").addEventListener("click", clearSelection);

  elements.boardRename.addEventListener("click", () => {
    const board = state.boards[state.board];
    if (!board) return;
    const name = window.prompt("보드 이름", board.name);
    if (!name) return;
    board.name = cleanText(name).slice(0, 40);
    board.updatedAt = new Date().toISOString();
    persistSavedState();
    scheduleSync();
    render({ keepScroll: true });
  });
  elements.boardDelete.addEventListener("click", () => {
    const board = state.boards[state.board];
    if (!board || !window.confirm(`'${board.name}' 보드를 삭제할까요? 이미지는 찜 목록과 다른 보드에 그대로 남습니다.`)) return;
    board.deleted = true;
    board.updatedAt = new Date().toISOString();
    setBoardMembership(boardItems(), state.board, false);
    persistSavedState();
    scheduleSync();
    setFilter({ board: HEART_BOARD });
  });
  elements.boardSources.addEventListener("click", () => copySources(state.list));
  elements.boardZip.addEventListener("click", () => exportZip(state.list, boardName(state.board)));

  elements.newBoardCreate.addEventListener("click", () => {
    const name = elements.newBoardName.value.trim();
    if (!name) {
      elements.newBoardName.focus();
      return;
    }
    const id = createBoard(name);
    setBoardMembership(state.boardTargets, id, true);
    elements.newBoardName.value = "";
    savedChanged();
    renderBoardOptions();
    toast(`'${name}' 보드에 담았습니다.`);
  });
  elements.newBoardName.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      elements.newBoardCreate.click();
    }
  });

  elements.viewerPrev.addEventListener("click", () => stepViewer(-1));
  elements.viewerNext.addEventListener("click", () => stepViewer(1));
  elements.viewerClose.addEventListener("click", closeViewer);
  elements.viewerZoom.addEventListener("click", toggleZoom);
  elements.viewerBg.addEventListener("click", (event) => {
    const target = event.target.closest("[data-bg]");
    if (target) setViewerBackground(target.dataset.bg);
  });
  elements.viewer.addEventListener("close", () => writeUrl());
  let touchStart = null;
  elements.viewerCanvas.addEventListener("touchstart", (event) => {
    touchStart = event.touches[0];
  }, { passive: true });
  elements.viewerCanvas.addEventListener("touchend", (event) => {
    if (!touchStart) return;
    const dx = event.changedTouches[0].clientX - touchStart.clientX;
    const dy = event.changedTouches[0].clientY - touchStart.clientY;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) stepViewer(dx < 0 ? 1 : -1);
    touchStart = null;
  });

  elements.brandClose.addEventListener("click", () => elements.brandDialog.close());
  elements.brandDialog.addEventListener("close", () => { if(catalogRuntime.restoring)return; state.profile=""; writeUrl(); });
  elements.compareClose.addEventListener("click", () => elements.compareDialog.close());
  elements.helpOpen.addEventListener("click", () => elements.helpDialog.showModal());
  elements.helpClose.addEventListener("click", () => elements.helpDialog.close());
  elements.syncSettings.addEventListener("click", () => {
    updateSyncDialog();
    setSyncMessage("");
    elements.syncDialog.showModal();
  });
  elements.syncClose.addEventListener("click", () => elements.syncDialog.close());
  [elements.viewer, elements.brandDialog, elements.compareDialog, elements.boardDialog, elements.helpDialog, elements.syncDialog].forEach(closeOnBackdrop);

  elements.syncCreate.addEventListener("click", createSyncSpace);
  elements.syncConnectForm.addEventListener("submit", (event) => {
    event.preventDefault();
    connectSyncCode(elements.syncCodeInput.value);
  });
  elements.syncCopy.addEventListener("click", () => copyText(state.syncId, "동기화 코드를 복사했습니다."));
  elements.syncNow.addEventListener("click", () => syncNow());
  elements.syncDisconnect.addEventListener("click", () => {
    state.syncId = "";
    persistSavedState();
    updateSyncDialog();
    setSyncMessage("온라인 연결만 해제했습니다. 현재 보관함은 이 기기에 남아 있습니다.");
  });

  window.addEventListener("storage", (event) => {
    if ([FAVORITES_STORAGE_KEY, BOARDS_STORAGE_KEY, SYNC_STORAGE_KEY].includes(event.key)) {
      loadSavedState();
      updateFavoriteChrome();
      updateSyncDialog();
      if (state.view === "saved") render({ keepScroll: true });
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && state.syncId) syncNow({ quiet: true });
  });
  window.addEventListener("popstate", async () => {
    catalogRuntime.restoring=true;
    try {
      await Promise.all([elements.viewer,elements.brandDialog].filter(dialog=>dialog.open).map(dialog=>new Promise(resolve=>{dialog.addEventListener('close',resolve,{once:true});dialog.close();})));
      const itemKey=readUrl();
      await refreshCatalogView();
      if(itemKey&&state.itemByKey.has(itemKey))await openViewer([state.itemByKey.get(itemKey)],0);
      else if(state.profile&&state.rowBySlug.has(state.profile))await openBrand(state.rowBySlug.get(state.profile));
    } finally {catalogRuntime.restoring=false;writeUrl();}
  });

  document.addEventListener("keydown", (event) => {
    const typing = event.target.closest?.("input, select, textarea, [contenteditable]");
    if (event.metaKey || event.ctrlKey || event.altKey) return;

    if (elements.viewer.open && !typing && !document.querySelector('dialog[open]:not(#viewer):not(#brand-dialog)')) {
      const item = currentItem();
      const key = event.key.toLowerCase();
      const actions = {
        arrowleft: () => stepViewer(-1),
        arrowright: () => stepViewer(1),
        f: () => toggleFavorite(item),
        b: () => openBoardDialog([item]),
        c: () => isRemoteImage(item) ? copyText(item.path,"외부 원본 링크를 복사했습니다.") : copyImage(item),
        d: () => downloadItem(item),
        s: () => {
          toggleSelection(item, state.list.indexOf(item));
          renderViewerActions();
        },
        t: cycleBackground,
        z: toggleZoom,
      };
      if (actions[key]) {
        event.preventDefault();
        actions[key]();
      }
      return;
    }
    if (typing) {
      if (event.key === "Escape") event.target.blur();
      return;
    }
    if (anyDialogOpen()) return;
    if (event.key === "/") {
      event.preventDefault();
      elements.search.focus();
      elements.search.select();
    } else if (event.key === "?") {
      elements.helpDialog.showModal();
    } else if (event.key.toLowerCase() === "g") {
      setFilter({ view: state.view === "brands" ? "wall" : "brands" });
    } else if (event.key.toLowerCase() === "k") {
      setFilter({ view: state.view === "colors" ? "wall" : "colors" });
    } else if (event.key.toLowerCase() === "r") {
      setFilter({ sort: "random", seed: Math.floor(Math.random() * 1e9) });
    } else if (/^[0-9]$/.test(event.key) && KINDS[Number(event.key)]) {
      setFilter({ kind: KINDS[Number(event.key)].id, parts: [], bvariants: [], bshapes: [], areas: [] });
    } else if (event.key === "Escape") {
      if (document.body.classList.contains("filters-open")) document.body.classList.remove("filters-open");
      else if (state.selection.size) clearSelection();
    }
  });
}

/* ---------- boot ---------- */


loadSavedState();
setupTheme();
setupEvents();
loadPackedLibrary();
window.setInterval(() => {
  if (!document.hidden && state.syncId) syncNow({ quiet: true });
}, 60_000);
