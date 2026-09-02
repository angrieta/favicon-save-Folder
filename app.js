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
  grid: document.querySelector("#brand-grid"),
  loading: document.querySelector("#loading-state"),
  error: document.querySelector("#error-state"),
  empty: document.querySelector("#empty-state"),
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
};

const state = {
  rows: [],
  query: "",
  category: "all",
  coverage: "all",
  type: "all",
  sort: "assets",
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
    state.query || state.category !== "all" || state.coverage !== "all" || state.type !== "all" || state.sort !== "assets",
  );
}

function render() {
  const rows = filteredRows();
  const visibleAssets = uniquePathCount(rows, state.type);
  const typeLabel = state.type === "all" ? "전체 유형" : TYPE_LABELS[state.type];
  elements.resultCount.textContent = `${rows.length.toLocaleString("ko-KR")}개 회사, ${visibleAssets.toLocaleString("ko-KR")}개 ${typeLabel} 이미지`;
  elements.reset.hidden = !hasActiveFilters();
  elements.empty.hidden = rows.length > 0;
  elements.grid.hidden = rows.length === 0;
  elements.typeButtons.querySelectorAll("button").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.type === state.type));
  });

  const fragment = document.createDocumentFragment();
  rows.forEach((row) => fragment.append(createCard(row)));
  elements.grid.replaceChildren(fragment);
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
  );

  const links = makeElement("div", "asset-links");
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
}

function resetFilters() {
  state.query = "";
  state.category = "all";
  state.coverage = "all";
  state.type = "all";
  state.sort = "assets";
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
  elements.dialogClose.addEventListener("click", () => elements.dialog.close());
  elements.dialog.addEventListener("click", (event) => {
    if (event.target === elements.dialog) elements.dialog.close();
  });
}

async function loadLibrary() {
  try {
    const response = await fetch("manifest.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    if (!Array.isArray(payload)) throw new Error("Invalid manifest");
    state.rows = payload.map(normalizeRow);
    populateSummary();
    populateCategories();
    populateTypeButtons();
    elements.loading.hidden = true;
    render();
  } catch (error) {
    console.error(error);
    elements.loading.hidden = true;
    elements.error.hidden = false;
    elements.resultCount.textContent = "자료를 불러오지 못했습니다.";
  }
}

setupTheme();
setupEvents();
loadLibrary();
