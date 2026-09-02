const TYPE_DEFINITIONS = [
  { id: "all", label: "전체" },
  { id: "banner", label: "배너" },
  { id: "logo", label: "로고" },
  { id: "social", label: "소셜" },
  { id: "reference", label: "기타 참고" },
  { id: "favicon", label: "파비콘" },
];

const TYPE_LABELS = Object.fromEntries(TYPE_DEFINITIONS.map((item) => [item.id, item.label]));
const TYPE_ORDER = ["banner", "logo", "social", "reference", "favicon"];
const FAVORITES_STORAGE_KEY = "brand-library-favorites-v2";
const SYNC_STORAGE_KEY = "brand-library-favorites-sync-id";
const SYNC_API = "https://mantledb.sh/v2";
const SYNC_PATH = "favorites";

const elements = {
  root: document.documentElement,
  themeToggle: document.querySelector("#theme-toggle"),
  themeMeta: document.querySelector('meta[name="theme-color"]'),
  search: document.querySelector("#search"),
  category: document.querySelector("#category"),
  coverage: document.querySelector("#coverage"),
  sort: document.querySelector("#sort"),
  typeButtons: document.querySelector("#type-buttons"),
  resultCount: document.querySelector("#result-count"),
  reset: document.querySelector("#reset-filters"),
  favoritesView: document.querySelector("#favorites-view"),
  favoriteCount: document.querySelector("#favorite-count"),
  syncSettings: document.querySelector("#sync-settings"),
  syncStatus: document.querySelector("#sync-status"),
  grid: document.querySelector("#brand-grid"),
  loading: document.querySelector("#loading-state"),
  error: document.querySelector("#error-state"),
  empty: document.querySelector("#empty-state"),
  emptyTitle: document.querySelector("#empty-title"),
  emptyDescription: document.querySelector("#empty-description"),
  summaryBrands: document.querySelector("#summary-brands"),
  summaryAssets: document.querySelector("#summary-assets"),
  summaryBanners: document.querySelector("#summary-banners"),
  summaryLogos: document.querySelector("#summary-logos"),
  dialog: document.querySelector("#asset-dialog"),
  dialogClose: document.querySelector("#dialog-close"),
  dialogCategory: document.querySelector("#dialog-category"),
  dialogTitle: document.querySelector("#dialog-title"),
  dialogDescription: document.querySelector("#dialog-description"),
  dialogContent: document.querySelector("#dialog-content"),
  syncDialog: document.querySelector("#sync-dialog"),
  syncClose: document.querySelector("#sync-close"),
  syncDisconnected: document.querySelector("#sync-disconnected"),
  syncConnected: document.querySelector("#sync-connected"),
  syncCreate: document.querySelector("#sync-create"),
  syncConnectForm: document.querySelector("#sync-connect-form"),
  syncCodeInput: document.querySelector("#sync-code-input"),
  syncCodeOutput: document.querySelector("#sync-code-output"),
  syncCopy: document.querySelector("#sync-copy"),
  syncNow: document.querySelector("#sync-now"),
  syncDisconnect: document.querySelector("#sync-disconnect"),
  syncMessage: document.querySelector("#sync-message"),
};

const state = {
  rows: [],
  query: "",
  category: "all",
  coverage: "all",
  type: "all",
  sort: "assets",
  favoritesOnly: false,
  favorites: {},
  assetIndex: new Map(),
  syncId: "",
  syncing: false,
  syncTimer: 0,
};

function cleanText(value) {
  return String(value ?? "")
    .replace(/[\u2014\u2013]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function categoryLabel(value) {
  return cleanText(value).replaceAll("_", " / ");
}

function safeHttpUrl(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function legacyAssets(row) {
  const assets = [];
  if (row.favicon_path) {
    assets.push({
      type: "favicon",
      path: row.favicon_path,
      source_url: row.favicon_source_url,
      source_tag: row.favicon_source_tag,
      content_type: row.favicon_content_type,
      bytes: Number(row.favicon_bytes) || 0,
      width: 0,
      height: 0,
    });
  }
  if (row.og_path) {
    assets.push({
      type: "social",
      path: row.og_path,
      source_url: row.og_source_url,
      source_tag: row.og_source_tag,
      content_type: row.og_content_type,
      bytes: Number(row.og_bytes) || 0,
      width: 0,
      height: 0,
    });
  }
  return assets;
}

function normalizeRow(row) {
  const rawAssets = Array.isArray(row.assets) && row.assets.length ? row.assets : legacyAssets(row);
  const seen = new Set();
  const assets = rawAssets
    .map((asset) => ({
      type: TYPE_LABELS[asset.type] ? asset.type : "reference",
      path: cleanText(asset.path),
      source_url: cleanText(asset.source_url),
      source_tag: cleanText(asset.source_tag),
      content_type: cleanText(asset.content_type),
      bytes: Number(asset.bytes) || 0,
      width: Number(asset.width) || 0,
      height: Number(asset.height) || 0,
      sha256: cleanText(asset.sha256),
      source_sha256: cleanText(asset.source_sha256),
      variant: ["desktop", "mobile", "shared"].includes(asset.variant) ? asset.variant : "shared",
      source_pages: Array.isArray(asset.source_pages) ? asset.source_pages.map(cleanText).filter(Boolean) : [],
    }))
    .filter((asset) => {
      const key = `${asset.type}:${asset.path}`;
      if (!asset.path || seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  return {
    ...row,
    company: cleanText(row.company),
    category: cleanText(row.category),
    page_title: cleanText(row.page_title),
    official_url: safeHttpUrl(row.page_url || row.requested_url),
    assets,
  };
}

function countAssets(row, type) {
  return row.assets.filter((asset) => type === "all" || asset.type === type).length;
}

function hasAsset(row, type) {
  return row.assets.some((asset) => asset.type === type);
}

function uniquePathCount(rows, type = "all") {
  const paths = new Set();
  rows.forEach((row) => {
    row.assets.forEach((asset) => {
      if (type === "all" || asset.type === type) paths.add(asset.path);
    });
  });
  return paths.size;
}

function makeElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function favoriteKey(asset) {
  return cleanText(asset.source_sha256 || asset.sha256 || asset.path);
}

function selectedFavoriteCount() {
  return Object.values(state.favorites).filter((record) => record?.selected).length;
}

function loadFavoriteState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(FAVORITES_STORAGE_KEY) || "{}");
    state.favorites = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    state.syncId = localStorage.getItem(SYNC_STORAGE_KEY) || "";
  } catch {
    state.favorites = {};
    state.syncId = "";
  }
}

function persistFavoriteState() {
  try {
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(state.favorites));
    if (state.syncId) localStorage.setItem(SYNC_STORAGE_KEY, state.syncId);
    else localStorage.removeItem(SYNC_STORAGE_KEY);
  } catch {
    setSyncStatus("브라우저 저장을 사용할 수 없음", "error");
  }
}

function isFavorite(asset) {
  return Boolean(state.favorites[favoriteKey(asset)]?.selected);
}

function favoriteSnapshot(row, asset, selected = true) {
  return {
    selected,
    updatedAt: new Date().toISOString(),
    company: row.company,
    category: row.category,
    page_title: row.page_title,
    official_url: row.official_url,
    asset: {
      type: asset.type,
      path: asset.path,
      source_url: asset.source_url,
      content_type: asset.content_type,
      bytes: asset.bytes,
      width: asset.width,
      height: asset.height,
      sha256: asset.sha256,
      source_sha256: asset.source_sha256,
      variant: asset.variant,
      source_pages: asset.source_pages?.slice(0, 1) || [],
    },
  };
}

function updateFavoriteChrome() {
  const count = selectedFavoriteCount();
  elements.favoriteCount.textContent = count.toLocaleString("ko-KR");
  elements.favoritesView.setAttribute("aria-pressed", String(state.favoritesOnly));
  elements.favoritesView.querySelector("span").textContent = state.favoritesOnly ? "♥" : "♡";
  document.querySelectorAll(".favorite-button").forEach((button) => {
    const selected = Boolean(state.favorites[button.dataset.favoriteKey]?.selected);
    button.setAttribute("aria-pressed", String(selected));
    button.textContent = selected ? "♥ 찜됨" : "♡ 찜하기";
  });
}

function toggleFavorite(row, asset) {
  const key = favoriteKey(asset);
  state.favorites[key] = favoriteSnapshot(row, asset, !state.favorites[key]?.selected);
  persistFavoriteState();
  updateFavoriteChrome();
  if (state.favoritesOnly) render();
  scheduleFavoriteSync();
}

function makeFavoriteButton(row, asset) {
  const button = makeElement("button", "favorite-button");
  button.type = "button";
  button.dataset.favoriteKey = favoriteKey(asset);
  button.setAttribute("aria-label", `${row.company} ${TYPE_LABELS[asset.type]} 이미지 찜하기`);
  button.addEventListener("click", () => toggleFavorite(row, asset));
  return button;
}

function rebuildAssetIndex() {
  state.assetIndex = new Map();
  state.rows.forEach((row) => {
    row.assets.forEach((asset) => state.assetIndex.set(favoriteKey(asset), { row, asset }));
  });
}

function favoriteEntries() {
  return Object.entries(state.favorites)
    .filter(([, record]) => record?.selected)
    .map(([key, record]) => state.assetIndex.get(key) || {
      row: {
        company: cleanText(record.company),
        category: cleanText(record.category),
        page_title: cleanText(record.page_title),
        official_url: safeHttpUrl(record.official_url),
      },
      asset: record.asset,
    })
    .filter((entry) => entry.asset?.path)
    .sort((a, b) => a.row.company.localeCompare(b.row.company, "ko"));
}

function setTheme(theme, persist = true) {
  elements.root.dataset.theme = theme;
  elements.themeToggle.textContent = theme === "dark" ? "라이트 모드" : "다크 모드";
  elements.themeMeta.setAttribute("content", theme === "dark" ? "#151714" : "#f2f1ec");
  if (persist) {
    try {
      localStorage.setItem("brand-library-theme", theme);
    } catch {
      // Storage can be blocked when the file is opened directly.
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
  elements.themeToggle.addEventListener("click", () => {
    setTheme(elements.root.dataset.theme === "dark" ? "light" : "dark");
  });
}

function populateSummary() {
  elements.summaryBrands.textContent = state.rows.length.toLocaleString("ko-KR");
  elements.summaryAssets.textContent = uniquePathCount(state.rows).toLocaleString("ko-KR");
  elements.summaryBanners.textContent = uniquePathCount(state.rows, "banner").toLocaleString("ko-KR");
  elements.summaryLogos.textContent = uniquePathCount(state.rows, "logo").toLocaleString("ko-KR");
}

function populateCategories() {
  const categories = [...new Set(state.rows.map((row) => row.category))].sort((a, b) =>
    a.localeCompare(b, "ko"),
  );
  const fragment = document.createDocumentFragment();
  categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = `${categoryLabel(category)} (${state.rows.filter((row) => row.category === category).length})`;
    fragment.append(option);
  });
  elements.category.append(fragment);
}

function populateTypeButtons() {
  const fragment = document.createDocumentFragment();
  TYPE_DEFINITIONS.forEach(({ id, label }) => {
    const button = makeElement("button", "type-button");
    button.type = "button";
    button.dataset.type = id;
    button.setAttribute("aria-pressed", String(id === state.type));
    button.append(document.createTextNode(label));
    const count = makeElement("small", "", uniquePathCount(state.rows, id).toLocaleString("ko-KR"));
    button.append(count);
    button.addEventListener("click", () => {
      state.type = id;
      render();
    });
    fragment.append(button);
  });
  elements.typeButtons.replaceChildren(fragment);
}

function choosePreview(row) {
  const preferred = state.type === "all" ? TYPE_ORDER : [state.type, ...TYPE_ORDER.filter((type) => type !== state.type)];
  for (const type of preferred) {
    const asset = row.assets.find((item) => item.type === type);
    if (asset) return asset;
  }
  return null;
}

function imageWithFallback(asset, alt, contained = false) {
  const image = document.createElement("img");
  image.src = asset.path;
  image.alt = alt;
  image.loading = "lazy";
  image.decoding = "async";
  image.addEventListener(
    "error",
    () => {
      const parent = image.parentElement;
      if (!parent) return;
      image.remove();
      parent.classList.remove("is-contained");
      parent.append(makeElement("span", "preview-fallback", "이미지를 표시할 수 없습니다."));
    },
    { once: true },
  );
  if (contained) image.dataset.contained = "true";
  return image;
}

function coverageText(row) {
  const banner = hasAsset(row, "banner");
  const logo = hasAsset(row, "logo");
  if (banner && logo) return "배너와 로고 수집 완료";
  if (!banner && !logo) return "배너와 로고 미수집";
  return banner ? "로고 미수집" : "배너 미수집";
}

function createCard(row) {
  const card = makeElement("article", "brand-card");
  const preview = makeElement("div", "card-preview");
  const selectedAsset = choosePreview(row);
  if (selectedAsset) {
    const contained = ["logo", "favicon"].includes(selectedAsset.type);
    if (contained) preview.classList.add("is-contained");
    preview.append(
      imageWithFallback(
        selectedAsset,
        `${row.company} ${TYPE_LABELS[selectedAsset.type]} 이미지`,
        contained,
      ),
    );
  } else {
    preview.append(makeElement("span", "preview-fallback", "수집된 이미지가 없습니다."));
  }

  const body = makeElement("div", "card-body");
  const companyLine = makeElement("div", "company-line");
  companyLine.append(makeElement("h2", "", row.company));
  companyLine.append(makeElement("span", "category-name", categoryLabel(row.category)));

  const status = makeElement("p", "coverage-text", coverageText(row));
  const counts = makeElement("div", "asset-counts");
  TYPE_ORDER.forEach((type) => {
    const count = countAssets(row, type);
    if (count) counts.append(makeElement("span", "", `${TYPE_LABELS[type]} ${count}`));
  });

  const actions = makeElement("div", "card-actions");
  if (row.official_url) {
    const official = makeElement("a", "official-link", "공식 사이트");
    official.href = row.official_url;
    official.target = "_blank";
    official.rel = "noopener";
    official.setAttribute("aria-label", `${row.company} 공식 사이트 열기`);
    actions.append(official);
  } else {
    actions.append(makeElement("span", "category-name", "공식 주소 없음"));
  }
  const detail = makeElement("button", "detail-button", "이미지 전체 보기");
  detail.type = "button";
  detail.addEventListener("click", () => openDialog(row));
  actions.append(detail);
  if (selectedAsset) actions.append(makeFavoriteButton(row, selectedAsset));

  body.append(companyLine, status, counts, actions);
  card.append(preview, body);
  return card;
}

function filteredRows() {
  const query = state.query.trim().toLocaleLowerCase("ko");
  return state.rows
    .filter((row) => {
      const searchable = `${row.company} ${row.category} ${row.page_title}`.toLocaleLowerCase("ko");
      const matchesQuery = !query || searchable.includes(query);
      const matchesCategory = state.category === "all" || row.category === state.category;
      const matchesType = state.type === "all" || hasAsset(row, state.type);
      const banner = hasAsset(row, "banner");
      const logo = hasAsset(row, "logo");
      const matchesCoverage =
        state.coverage === "all" ||
        (state.coverage === "complete" && banner && logo) ||
        (state.coverage === "missing-banner" && !banner) ||
        (state.coverage === "missing-logo" && !logo);
      return matchesQuery && matchesCategory && matchesType && matchesCoverage;
    })
    .sort((a, b) => {
      if (state.sort === "name") return a.company.localeCompare(b.company, "ko");
      if (state.sort === "category") {
        return a.category.localeCompare(b.category, "ko") || a.company.localeCompare(b.company, "ko");
      }
      return countAssets(b, state.type) - countAssets(a, state.type) || a.company.localeCompare(b.company, "ko");
    });
}

function hasActiveFilters() {
  return Boolean(
    state.favoritesOnly || state.query || state.category !== "all" || state.coverage !== "all" || state.type !== "all" || state.sort !== "assets",
  );
}

function render() {
  if (state.favoritesOnly) {
    renderFavorites();
    return;
  }
  const rows = filteredRows();
  const visibleAssets = uniquePathCount(rows, state.type);
  const typeLabel = state.type === "all" ? "전체 유형" : TYPE_LABELS[state.type];
  elements.resultCount.textContent = `${rows.length.toLocaleString("ko-KR")}개 회사, ${visibleAssets.toLocaleString("ko-KR")}개 ${typeLabel} 이미지`;
  elements.reset.hidden = !hasActiveFilters();
  elements.empty.hidden = rows.length > 0;
  elements.emptyTitle.textContent = "선택한 조건에 맞는 회사가 없습니다.";
  elements.emptyDescription.textContent = "검색어나 필터를 바꿔 보세요.";
  elements.grid.hidden = rows.length === 0;
  elements.grid.classList.remove("favorite-grid");
  elements.typeButtons.querySelectorAll("button").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.type === state.type));
  });

  const fragment = document.createDocumentFragment();
  rows.forEach((row) => fragment.append(createCard(row)));
  elements.grid.replaceChildren(fragment);
  updateFavoriteChrome();
}

function createFavoriteCard(row, asset, index) {
  const card = makeElement("article", "favorite-card asset-item");
  const imageBox = makeElement("div", "asset-image");
  imageBox.append(imageWithFallback(asset, `${row.company} ${TYPE_LABELS[asset.type]} 찜한 이미지 ${index + 1}`, true));
  const meta = makeElement("div", "asset-meta");
  const heading = makeElement("div", "favorite-card-heading");
  const title = makeElement("div");
  title.append(makeElement("h2", "", row.company), makeElement("p", "", `${categoryLabel(row.category)} · ${TYPE_LABELS[asset.type]}`));
  heading.append(title, makeFavoriteButton(row, asset));
  const facts = makeElement("div", "asset-facts");
  const resolution = asset.width && asset.height ? `${asset.width} × ${asset.height}` : "해상도 미확인";
  facts.append(makeElement("span", "", resolution), makeElement("span", "", formatType(asset)), makeElement("span", "", formatBytes(asset.bytes)));
  const links = makeElement("div", "asset-links");
  const open = makeElement("a", "", "이미지 열기");
  open.href = asset.path;
  open.target = "_blank";
  open.rel = "noopener";
  const download = makeElement("a", "", "파일 저장");
  download.href = asset.path;
  download.download = "";
  links.append(open, download);
  const sourceUrl = safeHttpUrl(asset.source_url);
  if (sourceUrl) {
    const source = makeElement("a", "", "원본 출처");
    source.href = sourceUrl;
    source.target = "_blank";
    source.rel = "noopener";
    links.append(source);
  }
  meta.append(heading, facts, links);
  card.append(imageBox, meta);
  return card;
}

function renderFavorites() {
  const entries = favoriteEntries();
  elements.resultCount.textContent = `찜한 이미지 ${entries.length.toLocaleString("ko-KR")}개`;
  elements.reset.hidden = false;
  elements.empty.hidden = entries.length > 0;
  elements.emptyTitle.textContent = "아직 찜한 이미지가 없습니다.";
  elements.emptyDescription.textContent = "회사별 이미지에서 하트를 누르면 이곳에 따로 모입니다.";
  elements.grid.hidden = entries.length === 0;
  elements.grid.classList.add("favorite-grid");
  const fragment = document.createDocumentFragment();
  entries.forEach(({ row, asset }, index) => fragment.append(createFavoriteCard(row, asset, index)));
  elements.grid.replaceChildren(fragment);
  updateFavoriteChrome();
}

function formatBytes(bytes) {
  if (!bytes) return "용량 미확인";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatType(asset) {
  const pathExtension = asset.path.split(".").pop()?.toUpperCase() || "IMAGE";
  return pathExtension === "JPG" ? "JPEG" : pathExtension;
}

function createAssetItem(row, asset, index) {
  const item = makeElement("article", "asset-item");
  const imageBox = makeElement("div", "asset-image");
  imageBox.append(
    imageWithFallback(asset, `${row.company} ${TYPE_LABELS[asset.type]} ${index + 1}`, true),
  );

  const meta = makeElement("div", "asset-meta");
  const facts = makeElement("div", "asset-facts");
  const resolution = asset.width && asset.height ? `${asset.width} × ${asset.height}` : "해상도 미확인";
  facts.append(
    makeElement("span", "", resolution),
    makeElement("span", "", formatType(asset)),
    makeElement("span", "", formatBytes(asset.bytes)),
    makeElement("span", "", asset.variant === "desktop" ? "PC" : asset.variant === "mobile" ? "모바일" : "PC·모바일 공통"),
  );

  const links = makeElement("div", "asset-links");
  links.append(makeFavoriteButton(row, asset));
  const open = makeElement("a", "", "이미지 열기");
  open.href = asset.path;
  open.target = "_blank";
  open.rel = "noopener";
  links.append(open);

  const download = makeElement("a", "", "파일 저장");
  download.href = asset.path;
  download.download = "";
  links.append(download);

  const sourceUrl = safeHttpUrl(asset.source_url);
  if (sourceUrl) {
    const source = makeElement("a", "", "원본 출처");
    source.href = sourceUrl;
    source.target = "_blank";
    source.rel = "noopener";
    links.append(source);

    const discoveredPage = safeHttpUrl(asset.source_pages?.[0]);
    if (discoveredPage && discoveredPage !== sourceUrl) {
      const page = makeElement("a", "", "발견 페이지");
      page.href = discoveredPage;
      page.target = "_blank";
      page.rel = "noopener";
      links.append(page);
    }

    const copy = makeElement("button", "", "출처 URL 복사");
    copy.type = "button";
    const copyStatus = makeElement("p", "copy-status");
    copy.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(sourceUrl);
        copyStatus.textContent = "출처 URL을 복사했습니다.";
      } catch {
        copyStatus.textContent = "복사할 수 없습니다. 원본 출처를 열어 주소를 복사해 주세요.";
      }
    });
    links.append(copy);
    meta.append(facts, links, copyStatus);
  } else {
    meta.append(facts, links);
  }
  item.append(imageBox, meta);
  return item;
}

function openDialog(row) {
  elements.dialogCategory.textContent = categoryLabel(row.category);
  elements.dialogTitle.textContent = row.company;
  elements.dialogDescription.textContent = row.page_title || "공식 사이트에서 수집한 이미지 자료입니다.";
  const fragment = document.createDocumentFragment();

  TYPE_ORDER.forEach((type) => {
    const assets = row.assets.filter((asset) => asset.type === type);
    if (!assets.length) return;
    const group = makeElement("section", "asset-group");
    const heading = makeElement("div", "asset-group-heading");
    heading.append(makeElement("h3", "", TYPE_LABELS[type]), makeElement("span", "", `${assets.length}개`));
    const grid = makeElement("div", "asset-grid");
    assets.forEach((asset, index) => grid.append(createAssetItem(row, asset, index)));
    group.append(heading, grid);
    fragment.append(group);
  });

  if (!fragment.childNodes.length) {
    fragment.append(makeElement("div", "state-panel", "수집된 이미지가 없습니다."));
  }
  elements.dialogContent.replaceChildren(fragment);
  elements.dialog.showModal();
  updateFavoriteChrome();
}

function validSyncId(value) {
  const parts = cleanText(value).split(".");
  return parts.length === 2 && /^brandref-[a-z0-9]{16,40}$/i.test(parts[0]) && /^[a-f0-9]{64}$/i.test(parts[1]);
}

function parseSyncId(value) {
  const [namespace, key] = cleanText(value).split(".");
  if (!validSyncId(value)) throw new Error("동기화 코드 형식을 확인해 주세요.");
  return { namespace, key };
}

function compactFavoriteRecords(records) {
  const compact = {};
  const cutoff = Date.now() - 1000 * 60 * 60 * 24 * 120;
  Object.entries(records).forEach(([path, record]) => {
    const timestamp = Date.parse(record?.updatedAt || "") || Date.now();
    if (record?.selected || timestamp >= cutoff) compact[path] = { s: record?.selected ? 1 : 0, t: timestamp };
  });
  return compact;
}

function expandFavoriteRecords(records) {
  const expanded = {};
  Object.entries(records || {}).forEach(([path, record]) => {
    const live = state.assetIndex.get(path);
    if (live) {
      expanded[path] = favoriteSnapshot(live.row, live.asset, Boolean(record?.s));
      expanded[path].updatedAt = new Date(Number(record?.t) || Date.now()).toISOString();
    } else {
      expanded[path] = {
        selected: Boolean(record?.s),
        updatedAt: new Date(Number(record?.t) || Date.now()).toISOString(),
        asset: { path },
      };
    }
  });
  return expanded;
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

function mergeFavoriteRecords(localRecords, remoteRecords) {
  const merged = { ...remoteRecords };
  Object.entries(localRecords).forEach(([key, local]) => {
    const remote = merged[key];
    if (!remote || String(local?.updatedAt || "") >= String(remote?.updatedAt || "")) merged[key] = local;
  });
  return merged;
}

async function fetchRemoteFavorites(syncId) {
  const { namespace, key } = parseSyncId(syncId);
  const response = await fetch(`${SYNC_API}/${encodeURIComponent(namespace)}/${SYNC_PATH}`, {
    headers: { Accept: "application/json", "X-Mantle-Key": key },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(response.status === 404 ? "동기화 코드를 찾을 수 없습니다." : `동기화 서버 오류 (${response.status})`);
  const payload = await response.json();
  const records = payload?.records && typeof payload.records === "object" ? payload.records : {};
  return expandFavoriteRecords(records);
}

async function putRemoteFavorites(syncId, records) {
  const { namespace, key } = parseSyncId(syncId);
  const response = await fetch(`${SYNC_API}/${encodeURIComponent(namespace)}/${SYNC_PATH}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", "X-Mantle-Key": key },
    body: JSON.stringify({ version: 2, updatedAt: new Date().toISOString(), records: compactFavoriteRecords(records) }),
  });
  if (!response.ok) throw new Error(`동기화 저장 오류 (${response.status})`);
}

async function syncFavorites({ quiet = false } = {}) {
  if (!state.syncId || state.syncing) return;
  state.syncing = true;
  setSyncStatus("동기화 중…");
  if (!quiet) setSyncMessage("최신 하트 목록을 확인하고 있습니다.");
  try {
    const remote = await fetchRemoteFavorites(state.syncId);
    state.favorites = mergeFavoriteRecords(state.favorites, remote);
    await putRemoteFavorites(state.syncId, state.favorites);
    persistFavoriteState();
    updateFavoriteChrome();
    if (state.favoritesOnly) render();
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

function scheduleFavoriteSync() {
  if (!state.syncId) return;
  window.clearTimeout(state.syncTimer);
  state.syncTimer = window.setTimeout(() => syncFavorites({ quiet: true }), 700);
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
    await putRemoteFavorites(id, state.favorites);
    persistFavoriteState();
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
    const remote = await fetchRemoteFavorites(code);
    state.syncId = code;
    state.favorites = mergeFavoriteRecords(state.favorites, remote);
    await putRemoteFavorites(code, state.favorites);
    persistFavoriteState();
    updateSyncDialog();
    updateFavoriteChrome();
    if (state.favoritesOnly) render();
    elements.syncCodeInput.value = "";
    setSyncMessage("이 컴퓨터가 같은 하트 목록에 연결되었습니다.", "ok");
  } catch (error) {
    console.error(error);
    setSyncMessage(error.message || "동기화 코드에 연결하지 못했습니다.", "error");
  }
}

function disconnectSync() {
  state.syncId = "";
  persistFavoriteState();
  updateSyncDialog();
  setSyncMessage("온라인 연결만 해제했습니다. 현재 하트 목록은 이 기기에 남아 있습니다.");
}

function resetFilters() {
  state.query = "";
  state.category = "all";
  state.coverage = "all";
  state.type = "all";
  state.sort = "assets";
  state.favoritesOnly = false;
  elements.search.value = "";
  elements.category.value = "all";
  elements.coverage.value = "all";
  elements.sort.value = "assets";
  render();
}

function setupEvents() {
  elements.search.addEventListener("input", () => {
    state.query = elements.search.value;
    render();
  });
  elements.category.addEventListener("change", () => {
    state.category = elements.category.value;
    render();
  });
  elements.coverage.addEventListener("change", () => {
    state.coverage = elements.coverage.value;
    render();
  });
  elements.sort.addEventListener("change", () => {
    state.sort = elements.sort.value;
    render();
  });
  elements.reset.addEventListener("click", resetFilters);
  elements.favoritesView.addEventListener("click", () => {
    state.favoritesOnly = !state.favoritesOnly;
    render();
  });
  elements.syncSettings.addEventListener("click", () => {
    updateSyncDialog();
    setSyncMessage("");
    elements.syncDialog.showModal();
  });
  elements.dialogClose.addEventListener("click", () => elements.dialog.close());
  elements.dialog.addEventListener("click", (event) => {
    if (event.target === elements.dialog) elements.dialog.close();
  });
  elements.syncClose.addEventListener("click", () => elements.syncDialog.close());
  elements.syncDialog.addEventListener("click", (event) => {
    if (event.target === elements.syncDialog) elements.syncDialog.close();
  });
  elements.syncCreate.addEventListener("click", createSyncSpace);
  elements.syncConnectForm.addEventListener("submit", (event) => {
    event.preventDefault();
    connectSyncCode(elements.syncCodeInput.value);
  });
  elements.syncCopy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(state.syncId);
      setSyncMessage("동기화 코드를 복사했습니다.", "ok");
    } catch {
      setSyncMessage("코드를 복사하지 못했습니다. 직접 선택해 복사해 주세요.", "error");
    }
  });
  elements.syncNow.addEventListener("click", () => syncFavorites());
  elements.syncDisconnect.addEventListener("click", disconnectSync);
  window.addEventListener("storage", (event) => {
    if (event.key === FAVORITES_STORAGE_KEY || event.key === SYNC_STORAGE_KEY) {
      loadFavoriteState();
      updateFavoriteChrome();
      updateSyncDialog();
      if (state.favoritesOnly) render();
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && state.syncId) syncFavorites({ quiet: true });
  });
}

async function loadLibrary() {
  try {
    const response = await fetch("manifest.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    if (!Array.isArray(payload)) throw new Error("Invalid manifest");
    state.rows = payload.map(normalizeRow);
    rebuildAssetIndex();
    populateSummary();
    populateCategories();
    populateTypeButtons();
    elements.loading.hidden = true;
    render();
    updateSyncDialog();
    if (state.syncId) syncFavorites({ quiet: true });
  } catch (error) {
    console.error(error);
    elements.loading.hidden = true;
    elements.error.hidden = false;
    elements.resultCount.textContent = "자료를 불러오지 못했습니다.";
  }
}

loadFavoriteState();
setupTheme();
setupEvents();
loadLibrary();
window.setInterval(() => {
  if (!document.hidden && state.syncId) syncFavorites({ quiet: true });
}, 60_000);
