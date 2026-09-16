/* Brand image reference library */

const KINDS = [
  { id: "all", label: "전체" },
  { id: "layout", label: "레이아웃", hint: "PC·모바일 첫 화면부터 푸터까지 전체 화면" },
  { id: "banner", label: "배너", hint: "메인 비주얼, 프로모션, 캠페인 영역" },
  { id: "logo", label: "로고", hint: "헤더, 푸터, 구조화 데이터의 로고" },
  { id: "social", label: "소셜 공유", hint: "링크 공유 시 보이는 대표 이미지(OG)" },
  { id: "photo", label: "사진·콘텐츠", hint: "제품, 서비스, 콘텐츠 사진" },
  { id: "graphic", label: "그래픽·아이콘", hint: "일러스트, 아이콘, 단색 그래픽" },
  { id: "appicon", label: "앱 아이콘", hint: "홈 화면 추가용 큰 아이콘" },
  { id: "favicon", label: "파비콘", hint: "브라우저 탭 아이콘" },
];
const KIND_LABELS = Object.fromEntries(KINDS.map((kind) => [kind.id, kind.label]));
const KIND_ORDER = KINDS.slice(1).map((kind) => kind.id);
const CONTAINED_KINDS = new Set(["logo", "favicon", "appicon", "graphic"]);

const CATEGORY_ORDER = ["장기렌트_리스", "렌터카_국내", "렌터카_글로벌", "자동차", "금융", "게임_엔터", "테크_플랫폼", "유통_커머스", "식품_생활", "항공_여행", "산업_건설_통신"];

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
const DENSITY_WIDTH = { s: 170, m: 240, l: 330, xl: 460 };
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
  view: "wall",
  q: "",
  brand: "",
  cats: [],
  kind: "all",
  devices: [],
  ratios: [],
  minWidth: 0,
  tones: [],
  formats: [],
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

function normalizeRow(raw) {
  const company = cleanText(raw.company);
  const slug = cleanText(raw.slug) || company;
  const category = cleanText(raw.category);
  const pageTitle = cleanText(raw.page_title);
  return {
    company,
    slug,
    category,
    page_title: pageTitle,
    official_url: safeHttpUrl(raw.page_url || raw.requested_url),
    status: cleanText(raw.collection_status),
    search: `${company} ${slug.replaceAll("-", " ")} ${categoryLabel(category)} ${pageTitle}`.toLocaleLowerCase("ko"),
    initials: choseong(company.replace(/\s+/g, "")),
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
  const format = formatOf(path);
  return {
    key: cleanText(asset.source_sha256 || sha || path),
    row,
    type,
    kind: extra.kind || kindOf(type, asset, analysis),
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
    date: extra.date ?? campaignDate(asset.source_url),
    dateLabel: extra.dateLabel || "캠페인 날짜",
    archived: Boolean(extra.archived),
    truncated: Boolean(extra.truncated),
    analysis,
  };
}

function buildItems(manifest, layouts, history) {
  state.rows = manifest.map(normalizeRow);
  state.rowBySlug = new Map(state.rows.map((row) => [row.slug, row]));
  const items = [];
  const seen = new Set();
  const push = (item) => {
    const id = `${item.kind}:${item.path}`;
    if (!item.path || seen.has(id)) return;
    seen.add(id);
    item.row.items.push(item);
    items.push(item);
  };

  state.rows.forEach((row) => {
    row.rawAssets.forEach((asset) => push(makeItem(row, asset)));
    delete row.rawAssets;
  });

  const latest = new Map();
  layouts.forEach((entry) => {
    const id = `${entry.slug}:${entry.device}`;
    if (!latest.has(id) || String(entry.captured_at) > String(latest.get(id).captured_at)) latest.set(id, entry);
  });
  layouts.forEach((entry) => {
    const row = state.rowBySlug.get(entry.slug);
    if (!row) return;
    const isLatest = latest.get(`${entry.slug}:${entry.device}`) === entry;
    push(makeItem(row, { ...entry, variant: entry.device === "pc" ? "desktop" : "mobile", source_url: entry.page_url }, {
      type: "layout",
      kind: "layout",
      date: String(entry.captured_at || "").slice(0, 10),
      dateLabel: "캡처 날짜",
      archived: !isLatest,
      truncated: entry.truncated,
      pageUrl: entry.page_url,
    }));
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
      counters[item.kind] = (counters[item.kind] || 0) + 1;
      rank.set(item, counters[item.kind]);
    });
  });
  items.forEach((item) => {
    item.rank = rank.get(item) || 0;
    item.jitter = hashString(item.key) % 1000;
  });
}

async function fetchJson(url, optional = false) {
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    if (optional) return null;
    throw error;
  }
}

/* ---------- URL state ---------- */

const LIST_PARAMS = { cats: "cat", devices: "device", ratios: "ratio", tones: "tone", formats: "fmt" };

function readUrl() {
  const params = new URLSearchParams(window.location.search);
  Object.assign(state, structuredClone(DEFAULT_FILTERS));
  state.view = ["wall", "brands", "saved"].includes(params.get("view")) ? params.get("view") : "wall";
  state.q = params.get("q") || "";
  state.brand = params.get("brand") || "";
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

function writeUrl() {
  const params = new URLSearchParams();
  if (state.view !== "wall") params.set("view", state.view);
  if (state.q) params.set("q", state.q);
  if (state.brand) params.set("brand", state.brand);
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
  if (next !== `${window.location.pathname}${window.location.search}`) window.history.replaceState(null, "", next);
}

/* ---------- filtering ---------- */

function matchesQuery(row) {
  if (state.brand && row.slug !== state.brand) return false;
  const query = state.q.trim().toLocaleLowerCase("ko");
  if (!query) return true;
  if (row.search.includes(query)) return true;
  const compact = query.replace(/\s+/g, "");
  return /^[ㄱ-ㅎ]+$/.test(compact) && row.initials.includes(compact);
}

function itemPasses(item, skip = "") {
  if (!state.archived && item.archived && state.view !== "saved") return false;
  if (skip !== "cats" && state.cats.length && !state.cats.includes(item.row.category)) return false;
  if (skip !== "kind" && state.kind !== "all" && item.kind !== state.kind) return false;
  if (skip !== "devices" && state.devices.length && !state.devices.includes(item.variant)) return false;
  if (skip !== "ratios" && state.ratios.length && !RATIO_OPTIONS.some((option) => state.ratios.includes(option.id) && option.test(item.ratio))) return false;
  if (skip !== "minWidth" && state.minWidth && item.width < state.minWidth) return false;
  if (skip !== "formats" && state.formats.length && !state.formats.includes(item.formatGroup)) return false;
  if (skip !== "tones" && state.tones.length) {
    if (!item.analysis || !TONE_OPTIONS.some((option) => state.tones.includes(option.id) && option.test(item.analysis))) return false;
  }
  if (skip !== "color" && state.color) {
    if (!item.analysis || colorDistance(item, state.colorLab) > 24) return false;
  }
  return true;
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
      return items.sort((a, b) => a.rank - b.rank || a.jitter - b.jitter);
  }
}

function computeList() {
  state.colorLab = state.color ? rgbToLab(hexToRgb(state.color)) : null;
  const items = baseItems().filter((item) => matchesQuery(item.row) && itemPasses(item) && (state.view !== "brands" || coveragePasses(item.row)));
  state.list = sortItems(items);
  if (state.view === "brands") {
    const rows = new Map();
    state.list.forEach((item) => {
      if (!rows.has(item.row)) rows.set(item.row, []);
      rows.get(item.row).push(item);
    });
    const hasItemFilter = state.kind !== "all" || state.devices.length || state.ratios.length || state.minWidth || state.formats.length || state.tones.length || state.color;
    if (!hasItemFilter) {
      state.rows.filter((row) => !rows.has(row) && matchesQuery(row) && (!state.cats.length || state.cats.includes(row.category)) && coveragePasses(row)).forEach((row) => rows.set(row, []));
    }
    state.brandList = [...rows.entries()].sort(([a, itemsA], [b, itemsB]) => {
      if (state.sort === "name") return a.company.localeCompare(b.company, "ko");
      return itemsB.length - itemsA.length || a.company.localeCompare(b.company, "ko");
    });
  }
}

function facetCount(skip, predicate) {
  let count = 0;
  const pool = baseItems();
  for (const item of pool) {
    if (predicate(item) && matchesQuery(item.row) && itemPasses(item, skip)) count += 1;
  }
  return count;
}

function activeFilterCount() {
  return state.devices.length + state.ratios.length + (state.minWidth ? 1 : 0) + state.tones.length + state.formats.length + (state.color ? 1 : 0) + (state.coverage !== "all" ? 1 : 0) + (state.archived ? 1 : 0);
}

/* ---------- chrome rendering ---------- */

function renderCategoryChips() {
  const categories = [...new Set(state.rows.map((row) => row.category))].sort((a, b) => {
    const ia = CATEGORY_ORDER.indexOf(a);
    const ib = CATEGORY_ORDER.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b, "ko");
  });
  const fragment = document.createDocumentFragment();
  const all = button("chip", "", () => setFilter({ cats: [] }), { "aria-pressed": String(!state.cats.length) });
  all.append("전체 업종", make("small", "", numberFormat(facetCount("cats", () => true))));
  fragment.append(all);
  categories.forEach((category) => {
    const selected = state.cats.includes(category);
    const chip = button("chip", "", (event) => {
      let cats;
      if (event.shiftKey || event.metaKey || event.ctrlKey || state.cats.length) {
        cats = selected ? state.cats.filter((value) => value !== category) : [...state.cats, category];
      } else {
        cats = [category];
      }
      setFilter({ cats });
    }, { "aria-pressed": String(selected), title: "여러 업종을 함께 보려면 이어서 선택하세요" });
    chip.append(categoryLabel(category), make("small", "", numberFormat(facetCount("cats", (item) => item.row.category === category))));
    fragment.append(chip);
  });
  elements.categoryChips.replaceChildren(fragment);
}

function renderKindTabs() {
  const fragment = document.createDocumentFragment();
  KINDS.forEach((kind, index) => {
    const count = facetCount("kind", (item) => kind.id === "all" || item.kind === kind.id);
    const tab = button("chip kind-chip", "", () => setFilter({ kind: kind.id }), {
      "aria-pressed": String(state.kind === kind.id),
      title: `${kind.hint || "모든 유형"} (단축키 ${index})`,
    });
    tab.dataset.kind = kind.id;
    tab.append(kind.label, make("small", "", numberFormat(count)));
    if (!count && state.kind !== kind.id) tab.classList.add("is-empty");
    fragment.append(tab);
  });
  elements.kindTabs.replaceChildren(fragment);
}

function facetSection(title, content, note) {
  const section = make("section", "facet");
  const heading = make("h3", "", title);
  section.append(heading);
  if (note) section.append(make("p", "facet-note", note));
  section.append(content);
  return section;
}

function toggleList(key, value) {
  const list = state[key].includes(value) ? state[key].filter((item) => item !== value) : [...state[key], value];
  setFilter({ [key]: list });
}

function optionChips(key, options, predicateFor) {
  const wrap = make("div", "facet-options");
  options.forEach((option) => {
    const id = option.id ?? option;
    const label = option.label ?? option;
    const count = facetCount(key, predicateFor(id));
    const chip = button("facet-chip", "", () => toggleList(key, id), { "aria-pressed": String(state[key].includes(id)) });
    chip.append(label, make("small", "", numberFormat(count)));
    if (option.hint) chip.title = option.hint;
    if (!count && !state[key].includes(id)) chip.classList.add("is-empty");
    wrap.append(chip);
  });
  return wrap;
}

function renderFacets() {
  const fragment = document.createDocumentFragment();

  fragment.append(facetSection("기기", optionChips("devices", DEVICE_OPTIONS, (id) => (item) => item.variant === id)));
  fragment.append(facetSection("비율", optionChips("ratios", RATIO_OPTIONS, (id) => {
    const option = RATIO_OPTIONS.find((entry) => entry.id === id);
    return (item) => option.test(item.ratio);
  })));

  const widths = make("div", "facet-options");
  WIDTH_OPTIONS.forEach((option) => {
    const chip = button("facet-chip", option.label, () => setFilter({ minWidth: option.id }), { "aria-pressed": String(state.minWidth === option.id) });
    if (option.id) chip.append(make("small", "", numberFormat(facetCount("minWidth", (item) => item.width >= option.id))));
    widths.append(chip);
  });
  fragment.append(facetSection("최소 가로 해상도", widths));

  fragment.append(facetSection("톤", optionChips("tones", TONE_OPTIONS, (id) => {
    const option = TONE_OPTIONS.find((entry) => entry.id === id);
    return (item) => Boolean(item.analysis && option.test(item.analysis));
  })));

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
  custom.append(picker);
  if (state.color && !COLOR_SWATCHES.some((swatch) => swatch.hex === state.color)) {
    custom.style.setProperty("--swatch", state.color);
    custom.setAttribute("aria-pressed", "true");
  }
  colors.append(custom);
  fragment.append(facetSection("색상", colors, state.color ? `${state.color.toUpperCase()}와 가까운 색을 가진 이미지를 먼저 보여 줍니다.` : "대표 색상이 비슷한 이미지를 찾습니다."));

  fragment.append(facetSection("파일 형식", optionChips("formats", FORMAT_OPTIONS, (id) => (item) => item.formatGroup === id)));

  if (state.view === "brands") {
    const coverage = make("div", "facet-options");
    COVERAGE_OPTIONS.forEach((option) => {
      coverage.append(button("facet-chip", option.label, () => setFilter({ coverage: option.id }), { "aria-pressed": String(state.coverage === option.id) }));
    });
    fragment.append(facetSection("수집 상태", coverage));
  }

  const archivedCount = state.items.filter((item) => item.archived).length;
  const archive = make("label", "switch");
  const checkbox = make("input");
  checkbox.type = "checkbox";
  checkbox.checked = state.archived;
  checkbox.addEventListener("change", () => setFilter({ archived: checkbox.checked }));
  archive.append(checkbox, make("span", "", `지난 버전 포함 (${numberFormat(archivedCount)})`));
  fragment.append(facetSection("기록", archive, "이전에 캡처한 레이아웃과 교체된 배너·로고를 함께 봅니다."));

  elements.facets.replaceChildren(fragment);
}

function renderSummary() {
  const live = state.items.filter((item) => !item.archived);
  const count = (kind) => live.filter((item) => item.kind === kind).length;
  const entries = [
    ["회사", state.rows.length],
    ["이미지", live.length],
    ["레이아웃", count("layout")],
    ["배너", count("banner")],
  ];
  elements.summary.replaceChildren(...entries.map(([label, value]) => {
    const wrap = make("div");
    wrap.append(make("dt", "", label), make("dd", "", numberFormat(value)));
    return wrap;
  }));
}

function renderActiveFilters() {
  const chips = [];
  const add = (label, patch) => chips.push(button("active-chip", `${label} ✕`, () => setFilter(patch), { "aria-label": `${label} 필터 해제` }));
  if (state.brand) add(`회사: ${state.rowBySlug.get(state.brand)?.company || state.brand}`, { brand: "" });
  if (state.q) add(`검색: ${state.q}`, { q: "" });
  state.cats.forEach((cat) => add(categoryLabel(cat), { cats: state.cats.filter((value) => value !== cat) }));
  if (state.kind !== "all") add(KIND_LABELS[state.kind], { kind: "all" });
  state.devices.forEach((id) => add(DEVICE_OPTIONS.find((o) => o.id === id)?.label || id, { devices: state.devices.filter((v) => v !== id) }));
  state.ratios.forEach((id) => add(RATIO_OPTIONS.find((o) => o.id === id)?.label || id, { ratios: state.ratios.filter((v) => v !== id) }));
  if (state.minWidth) add(`가로 ${state.minWidth}px+`, { minWidth: 0 });
  state.tones.forEach((id) => add(TONE_OPTIONS.find((o) => o.id === id)?.label || id, { tones: state.tones.filter((v) => v !== id) }));
  if (state.color) add(`색상 ${state.color.toUpperCase()}`, { color: "" });
  state.formats.forEach((id) => add(id, { formats: state.formats.filter((v) => v !== id) }));
  if (state.coverage !== "all") add(COVERAGE_OPTIONS.find((o) => o.id === state.coverage).label, { coverage: "all" });
  if (state.archived) add("지난 버전 포함", { archived: false });
  if (chips.length > 1) chips.push(button("text-button", "모두 지우기", resetFilters));
  elements.activeFilters.replaceChildren(...chips);
  elements.activeFilters.hidden = chips.length === 0;
  const count = activeFilterCount();
  elements.filterBadge.textContent = String(count);
  elements.filterBadge.hidden = count === 0;
}

function renderChrome() {
  elements.viewButtons.forEach((element) => element.setAttribute("aria-pressed", String(element.dataset.view === state.view)));
  elements.search.value = state.q;
  elements.sort.value = state.sort;
  elements.shuffle.hidden = state.sort !== "random";
  elements.density.querySelectorAll("button").forEach((element) => element.setAttribute("aria-pressed", String(element.dataset.density === state.density)));
  elements.density.hidden = state.view === "brands";
  elements.savedBar.hidden = state.view !== "saved";
  renderCategoryChips();
  renderKindTabs();
  renderFacets();
  renderActiveFilters();
  if (state.view === "saved") renderBoardTabs();
}

/* ---------- wall ---------- */

function displayAspect(item) {
  const inverse = item.height && item.width ? item.height / item.width : 0.75;
  if (item.kind === "layout") return Math.min(inverse, item.variant === "mobile" ? 1.7 : 1.1);
  if (item.kind === "favicon" || item.kind === "appicon") return 1;
  if (item.kind === "logo") return Math.min(Math.max(inverse, 0.5), 1);
  return Math.min(Math.max(inverse, 0.28), 2);
}

function createTile(item, index) {
  const tile = make("article", `tile kind-${item.kind}`);
  tile.dataset.index = String(index);
  tile.dataset.key = item.key;
  if (state.selection.has(item.key)) tile.classList.add("is-selected");

  const hit = button("tile-hit", "", null, { "aria-label": `${item.row.company} ${KIND_LABELS[item.kind]} 크게 보기` });
  hit.dataset.action = "open";
  const media = make("div", "tile-media");
  media.style.aspectRatio = `1 / ${displayAspect(item)}`;
  const dominant = item.analysis?.p?.[0]?.[0];
  if (dominant && !CONTAINED_KINDS.has(item.kind)) media.style.backgroundColor = dominant;
  if (CONTAINED_KINDS.has(item.kind)) media.classList.add("is-contained");
  const image = make("img");
  image.src = item.path;
  image.alt = "";
  image.loading = "lazy";
  image.decoding = "async";
  image.addEventListener("error", () => media.classList.add("is-broken"), { once: true });
  media.append(image);
  if (item.kind === "layout") media.append(make("span", "tile-badge", item.variant === "mobile" ? "모바일" : "PC"));
  if (item.archived) media.append(make("span", "tile-badge archived", item.date ? `지난 버전 ${item.date}` : "지난 버전"));
  hit.append(media);

  const check = button("tile-check", "", null, { "aria-label": `${item.row.company} 이미지 선택`, "aria-pressed": String(state.selection.has(item.key)) });
  check.dataset.action = "select";
  const heart = button("tile-heart", isFavorite(item) ? "♥" : "♡", null, { "aria-label": `${item.row.company} 이미지 찜하기`, "aria-pressed": String(isFavorite(item)) });
  heart.dataset.action = "heart";
  heart.dataset.favoriteKey = item.key;

  const caption = make("div", "tile-caption");
  caption.append(make("strong", "", item.row.company), make("span", "", `${KIND_LABELS[item.kind]}${item.width ? ` · ${item.width}×${item.height}` : ""}`));

  tile.append(hit, check, heart, caption);
  return tile;
}

function setupColumns() {
  const width = elements.wall.clientWidth || elements.wall.parentElement.clientWidth;
  const gap = state.density === "s" ? 10 : 14;
  const minimum = window.innerWidth <= 520 ? 2 : 1;
  const count = Math.max(minimum, Math.floor((width + gap) / (DENSITY_WIDTH[state.density] + gap)));
  elements.wall.style.setProperty("--gap", `${gap}px`);
  state.columns = Array.from({ length: count }, () => make("div", "wall-column"));
  state.columnHeights = new Array(count).fill(0);
  state.columnWidth = (width - gap * (count - 1)) / count;
  elements.wall.replaceChildren(...state.columns);
  state.rendered = 0;
}

function appendBatch() {
  if (state.view === "brands") return;
  const end = Math.min(state.list.length, state.rendered + BATCH_SIZE);
  for (let index = state.rendered; index < end; index += 1) {
    const item = state.list[index];
    let target = 0;
    state.columnHeights.forEach((height, column) => {
      if (height < state.columnHeights[target] - 1) target = column;
    });
    state.columns[target].append(createTile(item, index));
    state.columnHeights[target] += state.columnWidth * displayAspect(item) + 48;
  }
  state.rendered = end;
  elements.sentinel.hidden = state.rendered >= state.list.length;
}

function renderWall() {
  elements.grid.hidden = true;
  elements.wall.hidden = state.list.length === 0;
  setupColumns();
  appendBatch();
  window.requestAnimationFrame(fillViewport);
}

function fillViewport() {
  if (state.view === "brands" || state.rendered >= state.list.length) return;
  if (elements.sentinel.getBoundingClientRect().top < window.innerHeight * 2.2) {
    appendBatch();
    window.requestAnimationFrame(fillViewport);
  }
}

/* ---------- brand cards ---------- */

function createBrandCard(row, items) {
  const card = make("article", "brand-card");
  const liveItems = items.length ? items : row.items.filter((item) => !item.archived);
  const preferred = ["layout", "banner", "social", "photo", "logo", "graphic", "appicon", "favicon"];
  const cover = preferred.map((kind) => liveItems.find((item) => item.kind === kind && (kind !== "layout" || item.variant === "desktop")) || liveItems.find((item) => item.kind === kind)).find(Boolean);

  const preview = button("card-preview", "", () => openBrand(row), { "aria-label": `${row.company} 이미지 전체 보기` });
  if (cover) {
    if (CONTAINED_KINDS.has(cover.kind)) preview.classList.add("is-contained");
    if (cover.kind === "layout") preview.classList.add("is-layout");
    const image = make("img");
    image.src = cover.path;
    image.alt = "";
    image.loading = "lazy";
    preview.append(image);
  } else {
    preview.append(make("span", "preview-fallback", "수집된 이미지가 없습니다."));
  }

  const logo = row.items.find((item) => item.kind === "logo" && !item.archived) || row.items.find((item) => item.kind === "appicon" || item.kind === "favicon");
  const body = make("div", "card-body");
  const heading = make("div", "company-line");
  if (logo) {
    const mark = make("img", "company-mark");
    mark.src = logo.path;
    mark.alt = "";
    mark.loading = "lazy";
    heading.append(mark);
  }
  const titles = make("div", "company-titles");
  titles.append(make("h2", "", row.company), make("span", "category-name", categoryLabel(row.category)));
  heading.append(titles);

  const palette = make("div", "mini-palette");
  const colors = new Map();
  liveItems.filter((item) => ["logo", "banner", "layout"].includes(item.kind)).forEach((item) => {
    (item.analysis?.p || []).slice(0, 3).forEach(([hex, weight]) => colors.set(hex, (colors.get(hex) || 0) + weight));
  });
  [...colors.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).forEach(([hex]) => {
    const dot = make("span");
    dot.style.background = hex;
    dot.title = hex;
    palette.append(dot);
  });

  const counts = make("div", "asset-counts");
  KIND_ORDER.forEach((kind) => {
    const count = liveItems.filter((item) => item.kind === kind).length;
    if (count) counts.append(make("span", "", `${KIND_LABELS[kind]} ${count}`));
  });

  const actions = make("div", "card-actions");
  if (row.official_url) actions.append(link("공식 사이트", row.official_url, "official-link"));
  actions.append(button("detail-button", "이미지 벽으로", () => setFilter({ view: "wall", brand: row.slug, q: "" })));
  actions.append(button("detail-button", "전체 보기", () => openBrand(row)));

  body.append(heading, palette, counts, actions);
  card.append(preview, body);
  return card;
}

function renderBrands() {
  elements.wall.hidden = true;
  elements.wall.replaceChildren();
  elements.sentinel.hidden = true;
  elements.grid.hidden = state.brandList.length === 0;
  const fragment = document.createDocumentFragment();
  state.brandList.forEach(([row, items]) => fragment.append(createBrandCard(row, items)));
  elements.grid.replaceChildren(fragment);
}

/* ---------- main render ---------- */

function render({ keepScroll = false } = {}) {
  computeList();
  renderChrome();
  const isBrands = state.view === "brands";
  const count = isBrands ? state.brandList.length : state.list.length;
  const companies = new Set(state.list.map((item) => item.row)).size;
  const kindLabel = state.kind === "all" ? "이미지" : KIND_LABELS[state.kind];
  if (state.view === "saved") {
    elements.resultCount.textContent = `${boardName(state.board)} · ${numberFormat(state.list.length)}개`;
  } else if (isBrands) {
    elements.resultCount.textContent = `${numberFormat(count)}개 회사 · ${numberFormat(state.list.length)}개 ${kindLabel}`;
  } else {
    elements.resultCount.textContent = `${numberFormat(state.list.length)}개 ${kindLabel} · ${numberFormat(companies)}개 회사`;
  }

  elements.empty.hidden = count > 0;
  if (!count) {
    if (state.view === "saved") {
      elements.emptyTitle.textContent = state.board === HEART_BOARD ? "아직 찜한 이미지가 없습니다." : "이 보드는 비어 있습니다.";
      elements.emptyDescription.textContent = "이미지의 하트를 누르거나, 선택한 뒤 보드에 추가해 보세요.";
    } else {
      elements.emptyTitle.textContent = "선택한 조건에 맞는 이미지가 없습니다.";
      elements.emptyDescription.textContent = state.kind === "layout" && !state.items.some((item) => item.kind === "layout")
        ? "아직 레이아웃 캡처가 없습니다. node capture_layouts.mjs 를 실행해 주세요."
        : "필터를 줄이거나 검색어를 바꿔 보세요.";
    }
  }

  if (isBrands) renderBrands();
  else renderWall();
  updateSelectionBar();
  updateFavoriteChrome();
  writeUrl();
  if (!keepScroll && window.scrollY > elements.wall.offsetTop) window.scrollTo({ top: 0 });
}

function setFilter(patch) {
  const viewChanged = patch.view && patch.view !== state.view;
  Object.assign(state, patch);
  if (viewChanged && patch.view !== "saved") state.board = HEART_BOARD;
  render();
}

function resetFilters() {
  const { view, board } = state;
  Object.assign(state, structuredClone(DEFAULT_FILTERS), { view, board });
  render();
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
  if (id === HEART_BOARD) return "♥ 찜한 이미지";
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
    if (element.classList.contains("tile-heart")) element.textContent = selected ? "♥" : "♡";
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
  fragment.append(button("board-tab add", "+ 새 보드", () => {
    const name = window.prompt("새 보드 이름", "");
    if (name === null) return;
    const id = createBoard(name);
    persistSavedState();
    scheduleSync();
    setFilter({ board: id });
  }));
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
  const options = [[HEART_BOARD, "♥ 찜한 이미지"], ...liveBoards().map(([id, board]) => [id, board.name])];
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

function openViewer(list, index) {
  if (!list.length) return;
  state.viewer.list = list;
  state.viewer.index = Math.max(0, Math.min(index, list.length - 1));
  state.viewer.zoom = false;
  if (!elements.viewer.open) elements.viewer.showModal();
  renderViewer();
}

function closeViewer() {
  if (elements.viewer.open) elements.viewer.close();
}

function stepViewer(delta) {
  const { list } = state.viewer;
  if (!list.length) return;
  state.viewer.index = (state.viewer.index + delta + list.length) % list.length;
  state.viewer.zoom = false;
  renderViewer();
}

function currentItem() {
  return state.viewer.list[state.viewer.index];
}

function renderViewer() {
  const item = currentItem();
  if (!item) return;
  const { list, index } = state.viewer;
  elements.viewerPosition.textContent = `${numberFormat(index + 1)} / ${numberFormat(list.length)}`;
  elements.viewerCanvas.dataset.bg = state.viewer.bg;
  elements.viewerCanvas.dataset.kind = item.kind;
  elements.viewerCanvas.classList.toggle("is-zoomed", state.viewer.zoom);
  elements.viewerZoom.setAttribute("aria-pressed", String(state.viewer.zoom));
  elements.viewerBg.querySelectorAll("button").forEach((element) => element.setAttribute("aria-pressed", String(element.dataset.bg === state.viewer.bg)));

  const image = make("img", item.kind === "layout" ? "is-layout" : "");
  image.src = item.path;
  image.alt = `${item.row.company} ${KIND_LABELS[item.kind]}`;
  image.addEventListener("click", () => toggleZoom());
  elements.viewerCanvas.replaceChildren(image);
  elements.viewerCanvas.scrollTo(0, 0);

  elements.viewerCategory.textContent = categoryLabel(item.row.category);
  elements.viewerTitle.textContent = item.row.company;
  elements.viewerKind.textContent = `${KIND_LABELS[item.kind]}${item.archived ? " · 지난 버전" : ""}`;
  renderViewerActions();

  const facts = [
    ["해상도", item.width ? `${numberFormat(item.width)} × ${numberFormat(item.height)}` : "미확인"],
    ["비율", item.width ? ratioLabel(item.ratio) : "미확인"],
    ["형식", item.format],
    ["용량", formatBytes(item.bytes)],
    ["기기", deviceLabel(item.variant)],
  ];
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

  const links = [];
  if (item.sourceUrl) links.push(link(item.kind === "layout" ? "캡처한 페이지" : "원본 출처", item.sourceUrl));
  if (item.sourcePage && item.sourcePage !== item.sourceUrl) links.push(link("발견 페이지", item.sourcePage));
  if (item.row.official_url && item.row.official_url !== item.sourceUrl) links.push(link("공식 사이트", item.row.official_url));
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
    button(`action-button heart${favorite ? " is-on" : ""}`, favorite ? "♥ 찜됨" : "♡ 찜하기", () => toggleFavorite(item), { "aria-pressed": String(favorite), title: "F" }),
    button("action-button", boards ? `보드 ${boards}곳` : "보드에 추가", () => openBoardDialog([item]), { title: "B" }),
    button("action-button", "이미지 복사", () => copyImage(item), { title: "C · Figma에 바로 붙여넣기" }),
    button("action-button", "파일 저장", () => downloadItem(item), { title: "D" }),
    button(`action-button${selected ? " is-on" : ""}`, selected ? "✓ 선택됨" : "선택에 담기", () => {
      toggleSelection(item, state.list.indexOf(item));
      renderViewerActions();
    }, { title: "S · 비교와 ZIP 저장에 사용" }),
  );
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
    const thumb = button(`related-thumb${CONTAINED_KINDS.has(entry.kind) ? " is-contained" : ""}`, "", () => openViewer(items, index), { "aria-label": `${entry.row.company} ${KIND_LABELS[entry.kind]}`, title: `${entry.row.company} · ${KIND_LABELS[entry.kind]}${entry.date ? ` · ${entry.date}` : ""}` });
    const image = make("img");
    image.src = entry.path;
    image.alt = "";
    image.loading = "lazy";
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
    .filter((entry) => entry.kind === item.kind && (item.kind !== "layout" || entry.variant === item.variant) && (entry.archived || entry === item))
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  if (history.length > 1) sections.push(relatedStrip("변천사", history, `${history.length}개 버전`));
  const sameBrand = item.row.items.filter((entry) => !entry.archived && entry !== item).sort((a, b) => (a.kind === item.kind ? -1 : 0) - (b.kind === item.kind ? -1 : 0)).slice(0, 18);
  sections.push(relatedStrip("같은 회사", sameBrand));
  sections.push(relatedStrip("비슷한 이미지", similarItems(item), "형태·색감 기준"));
  elements.viewerRelated.replaceChildren(...sections.filter(Boolean));
}

function preloadNeighbors() {
  [-1, 1].forEach((delta) => {
    const neighbor = state.viewer.list[(state.viewer.index + delta + state.viewer.list.length) % state.viewer.list.length];
    if (neighbor && neighbor.kind !== "layout") new Image().src = neighbor.path;
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

function openBrand(row) {
  elements.brandCategory.textContent = categoryLabel(row.category);
  elements.brandTitle.textContent = row.company;
  elements.brandDescription.textContent = row.page_title || "공식 사이트에서 수집한 이미지 자료입니다.";
  const actions = [];
  if (row.official_url) actions.push(link("공식 사이트", row.official_url, "quiet-button"));
  actions.push(button("quiet-button", "이미지 벽으로 보기", () => {
    elements.brandDialog.close();
    setFilter({ view: "wall", brand: row.slug, q: "", kind: "all" });
  }));
  elements.brandActions.replaceChildren(...actions);

  const fragment = document.createDocumentFragment();
  const live = row.items.filter((item) => !item.archived);
  KIND_ORDER.forEach((kind) => {
    const items = live.filter((item) => item.kind === kind);
    if (!items.length) return;
    fragment.append(brandGroup(KIND_LABELS[kind], items));
  });
  const archived = row.items.filter((item) => item.archived).sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  if (archived.length) fragment.append(brandGroup("지난 버전", archived));
  if (!fragment.childNodes.length) fragment.append(make("div", "state-panel", "수집된 이미지가 없습니다."));
  elements.brandContent.replaceChildren(fragment);
  elements.brandDialog.showModal();
}

function brandGroup(title, items) {
  const group = make("section", "asset-group");
  const heading = make("div", "asset-group-heading");
  heading.append(make("h3", "", title), make("span", "", `${items.length}개`));
  const grid = make("div", "asset-grid");
  items.forEach((item, index) => {
    const card = button(`asset-thumb kind-${item.kind}${CONTAINED_KINDS.has(item.kind) ? " is-contained" : ""}`, "", () => openViewer(items, index), { "aria-label": `${item.row.company} ${KIND_LABELS[item.kind]} ${index + 1} 크게 보기` });
    const media = make("span", "asset-thumb-media");
    const image = make("img");
    image.src = item.path;
    image.alt = "";
    image.loading = "lazy";
    media.append(image);
    const meta = make("span", "asset-thumb-meta", [item.width ? `${item.width}×${item.height}` : "", item.variant !== "shared" ? deviceLabel(item.variant) : "", item.format, item.date].filter(Boolean).join(" · "));
    card.append(media, meta);
    grid.append(card);
  });
  group.append(heading, grid);
  return group;
}

/* ---------- compare ---------- */

function openCompare(items) {
  if (items.length < 2) {
    toast("비교하려면 이미지를 2개 이상 선택하세요.", "error");
    return;
  }
  const columns = items.slice(0, 6).map((item) => {
    const column = make("article", "compare-column");
    const head = make("header");
    head.append(make("strong", "", item.row.company), make("span", "", `${KIND_LABELS[item.kind]} · ${item.width}×${item.height} · ${deviceLabel(item.variant)}`));
    const scroller = make("div", `compare-media${CONTAINED_KINDS.has(item.kind) ? " is-contained" : ""}`);
    const image = make("img");
    image.src = item.path;
    image.alt = `${item.row.company} ${KIND_LABELS[item.kind]}`;
    scroller.append(image);
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
  return [item.row.company, categoryLabel(item.row.category), KIND_LABELS[item.kind], item.sourceUrl || item.row.official_url, item.date ? `${item.dateLabel} ${item.date}` : ""].filter(Boolean).join(" · ");
}

async function copyImage(item) {
  if (!navigator.clipboard || typeof ClipboardItem === "undefined") {
    toast("이 브라우저는 이미지 복사를 지원하지 않습니다.", "error");
    return;
  }
  try {
    const blob = new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        const scale = item.format === "SVG" ? Math.max(1, 1200 / Math.max(image.naturalWidth || 1, 1)) : 1;
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round((image.naturalWidth || item.width || 512) * scale));
        canvas.height = Math.max(1, Math.round((image.naturalHeight || item.height || 512) * scale));
        canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((result) => (result ? resolve(result) : reject(new Error("toBlob failed"))), "image/png");
      };
      image.onerror = reject;
      image.src = item.path;
    });
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    toast("이미지를 복사했습니다. Figma나 문서에 붙여넣으세요.");
  } catch (error) {
    console.error(error);
    toast("이미지를 복사하지 못했습니다.", "error");
  }
}

function fileNameFor(item, index = 0) {
  const extension = item.path.split(".").pop() || "img";
  const base = [item.row.company, KIND_LABELS[item.kind], item.variant !== "shared" ? deviceLabel(item.variant) : "", item.width ? `${item.width}x${item.height}` : "", item.date]
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
  try {
    const response = await fetch(item.path);
    saveBlob(await response.blob(), fileNameFor(item));
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

async function exportZip(items, name) {
  if (!items.length) {
    toast("저장할 이미지가 없습니다.", "error");
    return;
  }
  const files = [];
  const rows = [["파일", "회사", "업종", "유형", "기기", "가로", "세로", "형식", "날짜", "원본 URL", "공식 사이트"]];
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    toast(`ZIP 준비 중 ${index + 1} / ${items.length}`);
    try {
      const response = await fetch(item.path);
      if (!response.ok) throw new Error(String(response.status));
      const fileName = fileNameFor(item, index + 1);
      files.push({ name: fileName, data: new Uint8Array(await response.arrayBuffer()) });
      rows.push([fileName, item.row.company, categoryLabel(item.row.category), KIND_LABELS[item.kind], deviceLabel(item.variant), item.width, item.height, item.format, item.date, item.sourceUrl, item.row.official_url]);
    } catch {
      // Skip files that cannot be read.
    }
  }
  const csv = `﻿${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
  files.push({ name: "출처.csv", data: new TextEncoder().encode(csv) });
  const stamp = new Date().toISOString().slice(0, 10);
  saveBlob(buildZip(files), `${name.replace(/[\\/:*?"<>|♥\s]+/g, "-").replace(/^-+/, "") || "레퍼런스"}_${stamp}.zip`);
  toast(`${numberFormat(files.length - 1)}개 이미지를 ZIP으로 저장했습니다.`);
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
  elements.themeMeta.setAttribute("content", theme === "dark" ? "#151714" : "#f4f3ef");
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
  return [elements.viewer, elements.brandDialog, elements.compareDialog, elements.boardDialog, elements.helpDialog, elements.syncDialog].some((dialog) => dialog.open);
}

function closeOnBackdrop(dialog) {
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
}

function setupEvents() {
  const deck = document.querySelector(".deck");
  new ResizeObserver(() => elements.root.style.setProperty("--deck-height", `${deck.offsetHeight}px`)).observe(deck);

  let searchTimer = 0;
  elements.search.addEventListener("input", () => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => setFilter({ q: elements.search.value.trim() ? elements.search.value : "" }), 140);
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
      appendBatch();
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
      if (state.view !== "brands" && state.rows.length) {
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
  document.getElementById("sel-sources").addEventListener("click", () => copyText(selectedItems().map(sourceLine).join("\n"), "출처 목록을 복사했습니다."));
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
  elements.boardSources.addEventListener("click", () => copyText(state.list.map(sourceLine).join("\n"), "출처 목록을 복사했습니다."));
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
  window.addEventListener("popstate", () => {
    readUrl();
    render();
  });

  document.addEventListener("keydown", (event) => {
    const typing = event.target.closest?.("input, select, textarea, [contenteditable]");
    if (event.metaKey || event.ctrlKey || event.altKey) return;

    if (elements.viewer.open && !typing && !elements.boardDialog.open) {
      const item = currentItem();
      const key = event.key.toLowerCase();
      const actions = {
        arrowleft: () => stepViewer(-1),
        arrowright: () => stepViewer(1),
        f: () => toggleFavorite(item),
        b: () => openBoardDialog([item]),
        c: () => copyImage(item),
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
    } else if (event.key.toLowerCase() === "r") {
      setFilter({ sort: "random", seed: Math.floor(Math.random() * 1e9) });
    } else if (/^[0-8]$/.test(event.key)) {
      setFilter({ kind: KINDS[Number(event.key)].id });
    } else if (event.key === "Escape") {
      if (document.body.classList.contains("filters-open")) document.body.classList.remove("filters-open");
      else if (state.selection.size) clearSelection();
    }
  });
}

/* ---------- boot ---------- */

async function loadLibrary() {
  try {
    const [manifest, layouts, history, analysis] = await Promise.all([
      fetchJson("manifest.json"),
      fetchJson("layouts.json", true),
      fetchJson("history.json", true),
      fetchJson("analysis.json", true),
    ]);
    if (!Array.isArray(manifest)) throw new Error("Invalid manifest");
    state.analysis = analysis && typeof analysis === "object" ? analysis : {};
    buildItems(manifest, Array.isArray(layouts) ? layouts : [], Array.isArray(history) ? history : []);
    elements.loading.hidden = true;
    renderSummary();
    const itemKey = readUrl();
    render();
    updateSyncDialog();
    if (itemKey) {
      const index = state.list.findIndex((item) => item.key === itemKey);
      const item = state.itemByKey.get(itemKey);
      if (index >= 0) openViewer(state.list, index);
      else if (item) openViewer([item], 0);
    }
    if (state.syncId) syncNow({ quiet: true });
  } catch (error) {
    console.error(error);
    elements.loading.hidden = true;
    elements.error.hidden = false;
    elements.resultCount.textContent = "자료를 불러오지 못했습니다.";
  }
}

loadSavedState();
setupTheme();
setupEvents();
loadLibrary();
window.setInterval(() => {
  if (!document.hidden && state.syncId) syncNow({ quiet: true });
}, 60_000);
