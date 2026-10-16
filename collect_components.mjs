// Collect page parts (header, navigation, first view, sections, cards, footer,
// floating widgets, popups, search/forms, tabs), buttons and brand colors from
// each official site, on PC and mobile.
//
// One visit per device:
//   1. popups that open on load are cropped, then hidden
//   2. the page is scrolled so lazy images load, floating widgets and the
//      scrolled (sticky) header are cropped, then floating widgets are hidden
//   3. the static parts are measured and ONE full-page screenshot is saved to
//      layouts/. Static parts are stored as boxes on that screenshot instead of
//      separate files, which keeps the library small and free of duplicates.
//   4. buttons are cropped at 2x, then states that need interaction are cropped:
//      the mega menu on hover (PC) and the menu drawer behind the hamburger
//      button (mobile, and the "all menu" overlay on PC).
//
//   node collect_components.mjs --workers 6
//   node collect_components.mjs --company 롯데렌터카 --devices pc
//   node collect_components.mjs --category 금융 --skip-existing

import { createHash } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Browser, sleep, trackNetwork, webpSize, withTimeout } from "./cdp.mjs";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const MANIFEST = path.join(ROOT, "manifest.json");
// The output lists can be redirected for test runs next to a running collection.
const LAYOUTS_JSON = process.env.RC_LAYOUTS_JSON || path.join(ROOT, "layouts.json");
const COMPONENTS_JSON = process.env.RC_COMPONENTS_JSON || path.join(ROOT, "components.json");
// Pages that failed twice are not retried by --skip-existing.
const FAILED_JSON = path.join(ROOT, ".collect_state", "components_failed.json");

const DEVICES = {
  pc: {
    width: 1440,
    height: 900,
    scale: 1,
    mobile: false,
    maxHeight: 8500,
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  },
  mobile: {
    width: 390,
    height: 844,
    scale: 2,
    mobile: true,
    maxHeight: 6000,
    userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36",
  },
};

function parseArgs(argv) {
  const args = {
    workers: 4, company: [], category: [], limit: 0, devices: ["pc", "mobile"], skipExisting: false,
    quality: 62, layoutQuality: 60, rows: "", maxJobs: 0, browsers: 0,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (flag === "--workers") args.workers = Math.max(1, Number(value) || 1), (i += 1);
    else if (flag === "--company") args.company.push(value), (i += 1);
    else if (flag === "--category") args.category.push(value), (i += 1);
    else if (flag === "--limit") args.limit = Number(value) || 0, (i += 1);
    else if (flag === "--devices") args.devices = value.split(",").filter((d) => DEVICES[d]), (i += 1);
    else if (flag === "--quality") args.quality = Number(value) || 62, (i += 1);
    else if (flag === "--layout-quality") args.layoutQuality = Number(value) || 60, (i += 1);
    else if (flag === "--rows") args.rows = value, (i += 1);
    else if (flag === "--max-jobs") args.maxJobs = Number(value) || 0, (i += 1);
    else if (flag === "--browsers") args.browsers = Number(value) || 0, (i += 1);
    else if (flag === "--skip-existing") args.skipExisting = true;
  }
  return args;
}

/* ---------- code that runs inside the page ---------- */

// Shared helpers, installed once per page as window.__rc.
function installHelpers() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const toHex = (r, g, b) => "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
  const rc = {
    els: [],
    hidden: [],
    vw: window.innerWidth,
    vh: window.innerHeight,
  };
  rc.parseColor = (value) => {
    if (!value) return null;
    value = String(value).trim();
    if (!value || value === "transparent" || value === "none" || value === "currentcolor") return null;
    const m = value.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/i);
    if (m) {
      let alpha = m[4] === undefined ? 1 : m[4].endsWith("%") ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
      if (alpha < 0.5) return null;
      return toHex(+m[1], +m[2], +m[3]);
    }
    ctx.fillStyle = "#010203";
    ctx.fillStyle = value;
    if (ctx.fillStyle === "#010203" && value.toLowerCase() !== "#010203") return null;
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    if (d[3] < 128) return null;
    return toHex(d[0], d[1], d[2]);
  };
  rc.parseLoose = (value) => {
    value = String(value || "").trim().replace(/!important$/, "").trim();
    if (!value || /var\(|url\(|gradient/i.test(value)) return null;
    if (/^\d+(\.\d+)?(deg)?\s+\d+(\.\d+)?%\s+\d+(\.\d+)?%$/.test(value)) return rc.parseColor(`hsl(${value})`);
    if (/^\d{1,3}[\s,]+\d{1,3}[\s,]+\d{1,3}$/.test(value)) return rc.parseColor(`rgb(${value.replace(/\s+/g, " ").split(/[\s,]+/).join(",")})`);
    return rc.parseColor(value);
  };
  rc.rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  rc.dist = (a, b) => {
    if (!a || !b) return 999;
    const x = rc.rgb(a), y = rc.rgb(b);
    return Math.sqrt((x[0] - y[0]) ** 2 + (x[1] - y[1]) ** 2 + (x[2] - y[2]) ** 2);
  };
  rc.chroma = (hex) => {
    const [r, g, b] = rc.rgb(hex).map((v) => v / 255);
    return Math.max(r, g, b) - Math.min(r, g, b);
  };
  rc.visible = (el) => {
    if (!el || el.nodeType !== 1) return false;
    const s = getComputedStyle(el);
    if (s.display === "none" || s.visibility === "hidden" || Number(s.opacity) < 0.1) return false;
    const r = el.getBoundingClientRect();
    return r.width > 1 && r.height > 1;
  };
  rc.docRect = (el) => {
    const r = el.getBoundingClientRect();
    return { x: r.left + window.scrollX, y: r.top + window.scrollY, w: r.width, h: r.height };
  };
  rc.bgOf = (el) => {
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const c = rc.parseColor(getComputedStyle(n).backgroundColor);
      if (c) return c;
    }
    return "#ffffff";
  };
  rc.text = (el, max = 40) => {
    if (!el) return "";
    const own = el.getAttribute && (el.getAttribute("aria-label") || el.getAttribute("title") || el.getAttribute("alt"));
    const text = own || el.innerText || el.textContent || "";
    return String(text).replace(/\s+/g, " ").trim().slice(0, max);
  };
  rc.heading = (el) => {
    const h = el.querySelector("h1, h2, h3, h4, [class*=title i], [class*=tit i], strong");
    const text = h ? rc.text(h, 50) : "";
    return text || rc.text(el, 50);
  };
  rc.positioned = (el) => {
    for (let n = el; n && n.nodeType === 1 && n !== document.body; n = n.parentElement) {
      const p = getComputedStyle(n).position;
      if (p === "fixed" || p === "sticky") return n;
    }
    return null;
  };
  rc.register = (el) => {
    rc.els.push(el);
    return rc.els.length - 1;
  };
  // Inline !important beats any stylesheet rule, even an !important one with an id.
  rc.hide = (el, mode = "display") => {
    if (!el || el.hasAttribute("data-rc-hide")) return;
    el.setAttribute("data-rc-hide", mode);
    const property = mode === "display" ? "display" : "visibility";
    el.__rcPrevious = [property, el.style.getPropertyValue(property), el.style.getPropertyPriority(property)];
    el.style.setProperty(property, mode === "display" ? "none" : "hidden", "important");
    rc.hidden.push(el);
  };
  rc.unhide = (el) => {
    if (!el || !el.hasAttribute("data-rc-hide")) return;
    const [property, value, priority] = el.__rcPrevious || ["display", "", ""];
    if (value) el.style.setProperty(property, value, priority);
    else el.style.removeProperty(property);
    el.removeAttribute("data-rc-hide");
  };
  rc.identity = (el) => {
    const cls = typeof el.className === "string" ? el.className : el.className?.baseVal || "";
    return `${el.tagName} ${el.id || ""} ${cls} ${el.getAttribute("role") || ""} ${el.getAttribute("aria-label") || ""}`;
  };
  rc.inChrome = (el) => Boolean(el.closest("header, nav, footer, [role=banner], [role=navigation], [role=contentinfo], #header, #footer, #gnb"));

  const style = document.createElement("style");
  style.id = "rc-style";
  style.textContent = `
    *, *::before, *::after { transition-duration: 0s !important; transition-delay: 0s !important; scroll-behavior: auto !important; caret-color: transparent !important; }
    [data-aos] { opacity: 1 !important; transform: none !important; }
    .wow, .reveal, .fade-up, .fadeInUp { visibility: visible !important; }
    [data-rc-hide="display"] { display: none !important; }
    [data-rc-hide="visibility"] { visibility: hidden !important; }
    html.rc-unlock, html.rc-unlock body { overflow: auto !important; height: auto !important; position: static !important; }
  `;
  document.documentElement.append(style);
  window.__rc = rc;
  return true;
}

// Popups, dim layers and consent bars that are open when the page loads.
function findOverlays() {
  const rc = window.__rc;
  const vw = window.innerWidth, vh = window.innerHeight;
  const POPUP_RE = /popup|pop_|pop-|modal|dialog|layer|lightbox|notice|overlay|dimmed|dim\b|promotion/i;
  const CONSENT_RE = /cookie|consent|gdpr|onetrust|trustarc|cookiebot|쿠키|개인정보\s*(수집|처리)/i;
  const found = [];
  for (const el of document.body.querySelectorAll("*")) {
    const s = getComputedStyle(el);
    if (s.position !== "fixed" && s.position !== "absolute") continue;
    if (!rc.visible(el)) continue;
    const r = el.getBoundingClientRect();
    const w = Math.min(r.right, vw) - Math.max(r.left, 0);
    const h = Math.min(r.bottom, vh) - Math.max(r.top, 0);
    if (w < 120 || h < 60) continue;
    const coverage = (w * h) / (vw * vh);
    const identity = rc.identity(el);
    const text = (el.innerText || "").slice(0, 600);
    const z = parseInt(s.zIndex, 10) || 0;
    const isDialog = el.getAttribute("role") === "dialog" || el.getAttribute("aria-modal") === "true" || POPUP_RE.test(identity);
    const isConsent = CONSENT_RE.test(identity) || (s.position === "fixed" && CONSENT_RE.test(text) && coverage < 0.6);
    const bg = s.backgroundColor.match(/[\d.]+/g);
    const isDim = s.position === "fixed" && coverage > 0.85 && bg && bg.length === 4 && Number(bg[3]) > 0.15 && Number(bg[3]) < 0.97;
    if (!isDialog && !isConsent && !isDim) continue;
    // A layer popup sits above the page; slides and inline blocks with popup-ish class names do not.
    if (s.position === "absolute" && z < 100) continue;
    if (!isConsent && !isDim && el.closest("[class*=swiper i], [class*=slick i], [class*=carousel i], [class*=splide i], [class*=flickity i], [class*=owl i]")) continue;
    if (isDialog && !isDim && !isConsent && (w < 280 || h < 180)) continue;
    // Headers are often fixed and full width; they are not popups.
    if (r.top <= 2 && r.height < 220 && !isConsent && !isDim && el.querySelector("a[href]") && coverage < 0.3) continue;
    found.push({ el, rect: r, coverage, isConsent, isDim, isDialog });
  }
  // Keep the outermost of nested candidates for hiding, the innermost box for cropping.
  const outer = found.filter((c) => !found.some((o) => o !== c && o.el.contains(c.el)));
  const shots = [];
  for (const group of outer) {
    const inner = found
      .filter((c) => c !== group && group.el.contains(c.el) && !c.isDim && c.coverage < 0.9 && c.coverage > 0.03)
      .sort((a, b) => b.coverage - a.coverage);
    const boxes = inner.length ? inner.filter((c) => !inner.some((o) => o !== c && o.el.contains(c.el))) : [group];
    for (const box of boxes.slice(0, 3)) {
      const r = box.el.getBoundingClientRect();
      const x = Math.max(0, r.left), y = Math.max(0, r.top);
      shots.push({
        kind: box.isConsent || group.isConsent ? "floating" : "popup",
        label: box.isConsent || group.isConsent ? "쿠키·개인정보 동의 배너" : (rc.heading(box.el) || "팝업"),
        box: { x: x + window.scrollX, y: y + window.scrollY, w: Math.min(r.right, vw) - x, h: Math.min(r.bottom, vh) - y },
        fullscreen: box.coverage > 0.85,
      });
    }
  }
  window.__rcOverlays = outer.map((c) => c.el);
  return shots.slice(0, 4);
}

function hideOverlays() {
  const rc = window.__rc;
  let hidden = 0;
  for (const el of window.__rcOverlays || []) {
    rc.hide(el);
    hidden += 1;
  }
  if (hidden) {
    const lock = ["hidden", "clip"];
    if (lock.includes(getComputedStyle(document.documentElement).overflowY) || lock.includes(getComputedStyle(document.body).overflowY) || getComputedStyle(document.body).position === "fixed") {
      document.documentElement.classList.add("rc-unlock");
    }
  }
  return hidden;
}

// Fixed and sticky elements while the page is scrolled: quick menus, chat
// buttons, "top" buttons, bottom CTA bars and the scrolled header.
function findFloating() {
  const rc = window.__rc;
  const vw = window.innerWidth, vh = window.innerHeight;
  const hits = [];
  for (const el of document.body.querySelectorAll("*")) {
    if (el.closest("[data-rc-hide]")) continue;
    const s = getComputedStyle(el);
    if (s.position !== "fixed" && s.position !== "sticky") continue;
    if (!rc.visible(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.bottom <= 0 || r.top >= vh || r.right <= 0 || r.left >= vw) continue;
    const w = Math.min(r.right, vw) - Math.max(r.left, 0);
    const h = Math.min(r.bottom, vh) - Math.max(r.top, 0);
    if (w < 22 || h < 22) continue;
    if ((w * h) / (vw * vh) > 0.45) continue;
    // Sticky sidebars and tab rows are page layout, not floating widgets.
    if (s.position === "sticky" && !(r.top <= 4 && w >= vw * 0.85) && !(r.bottom >= vh - 4) && !(w <= 160 && h <= 160)) continue;
    hits.push({ el, r, w, h });
  }
  const outer = hits.filter((c) => !hits.some((o) => o !== c && o.el.contains(c.el)));
  const out = [];
  for (const { el, r, w, h } of outer) {
    const identity = `${rc.identity(el)} ${rc.text(el, 80)}`;
    const top = r.top <= 4 && w >= vw * 0.85 && h <= 240;
    let kind = "floating";
    let label = "";
    if (top) {
      kind = "header";
      label = "스크롤 시 고정 헤더";
    } else if (/top|위로|맨\s*위|scroll-?up|go-?top/i.test(identity) && w < 120) label = "TOP 버튼";
    else if (/chat|talk|상담|채팅|kakao|channel|문의|help|support|messenger/i.test(identity)) label = "상담·챗봇";
    else if (/quick|퀵|side|aside|wing/i.test(identity)) label = "퀵메뉴";
    else if (/app|앱|download|다운로드/i.test(identity)) label = "앱 설치 안내";
    else if (/cookie|쿠키|consent/i.test(identity)) label = "쿠키·개인정보 동의 배너";
    else if (r.bottom >= vh - 4 && w >= vw * 0.85 && h <= 160) label = "하단 고정 바";
    else continue;
    const pad = kind === "header" ? 0 : 8;
    const x = Math.max(0, r.left - pad), y = Math.max(0, r.top - pad);
    out.push({
      kind,
      label,
      index: rc.register(el),
      box: {
        x: x + window.scrollX,
        y: y + window.scrollY,
        w: Math.min(vw, r.right + pad) - x,
        h: Math.min(vh, r.bottom + pad) - y,
      },
    });
  }
  return out.slice(0, 8);
}

function hideFloating(indexes) {
  const rc = window.__rc;
  for (const index of indexes) {
    const el = rc.els[index];
    if (el && !el.matches("header, [role=banner]") && !el.querySelector("nav, [role=navigation]")) rc.hide(el, "visibility");
  }
  return true;
}

// Static parts measured with the page scrolled to the top. Coordinates are in
// CSS pixels of the document.
function measureParts(maxHeight) {
  const rc = window.__rc;
  const vw = window.innerWidth, vh = window.innerHeight;
  const mobile = vw < 700;
  const docHeight = Math.min(document.documentElement.scrollHeight, maxHeight);
  const parts = [];
  const add = (kind, el, box, label, extra = {}) => {
    if (!box || box.w < 16 || box.h < 12) return;
    const y = Math.max(0, box.y);
    const h = Math.min(box.h - (y - box.y), docHeight - y);
    if (h < 12) return;
    const x = Math.max(0, box.x);
    const w = Math.min(box.w - (x - box.x), vw - x);
    if (w < 16) return;
    parts.push({ kind, label: label || "", box: { x, y, w, h }, ...extra });
  };
  const fullWidth = (r) => r.w >= vw * 0.8;
  const overlapY = (a, b) => Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

  /* header */
  let header = null;
  const headerCandidates = [...document.querySelectorAll("header, [role=banner], #header, #gnb, [id*=header i], [class*=header i]")]
    .filter((el) => rc.visible(el) && !el.closest("[data-rc-hide]"))
    .map((el) => ({ el, r: rc.docRect(el) }))
    .filter(({ r }) => r.y < 220 && fullWidth(r) && r.h >= 28 && r.h <= 360);
  if (headerCandidates.length) {
    headerCandidates.sort((a, b) => (a.el.contains(b.el) ? -1 : b.el.contains(a.el) ? 1 : a.r.y - b.r.y));
    header = headerCandidates[0];
  } else {
    let el = document.elementFromPoint(vw / 2, 24);
    while (el && el !== document.body) {
      const r = rc.docRect(el);
      if (fullWidth(r) && r.h >= 36 && r.h <= 260 && el.querySelector("a[href]")) {
        header = { el, r };
        break;
      }
      el = el.parentElement;
    }
  }
  let headerBox = null;
  if (header) {
    const bottom = header.r.y + header.r.h;
    headerBox = { x: 0, y: header.r.y < 140 ? 0 : header.r.y, w: vw, h: bottom - (header.r.y < 140 ? 0 : header.r.y) };
    add("header", header.el, headerBox, "헤더");
  }

  /* GNB inside the header (PC) */
  if (header && !mobile) {
    const navs = [...header.el.querySelectorAll("nav, [role=navigation], ul")]
      .filter((el) => rc.visible(el))
      .map((el) => ({ el, r: rc.docRect(el), links: [...el.querySelectorAll(":scope > li > a, :scope > a, :scope > ul > li > a, :scope > div > ul > li > a")].filter(rc.visible) }))
      .filter(({ r, links }) => links.length >= 3 && r.h <= 120 && r.w >= 200);
    navs.sort((a, b) => b.links.length - a.links.length);
    const nav = navs[0];
    if (nav && nav.r.w * nav.r.h < headerBox.w * headerBox.h * 0.7) {
      add("nav", nav.el, { x: nav.r.x - 12, y: nav.r.y - 8, w: nav.r.w + 24, h: nav.r.h + 16 }, "GNB 메뉴");
    }
  }

  /* footer */
  let footerBox = null;
  const footers = [...document.querySelectorAll("footer, [role=contentinfo], #footer, [id*=footer i], [class*=footer i]")]
    .filter((el) => rc.visible(el))
    .map((el) => ({ el, r: rc.docRect(el) }))
    .filter(({ r }) => fullWidth(r) && r.h >= 50 && r.h <= 2600 && r.y > vh * 0.5);
  if (footers.length) {
    footers.sort((a, b) => (b.r.y + b.r.h) - (a.r.y + a.r.h) || (a.el.contains(b.el) ? -1 : 1));
    const f = footers.find((c) => !footers.some((o) => o !== c && o.el.contains(c.el) && o.r.h <= 2600)) || footers[0];
    footerBox = { x: 0, y: f.r.y, w: vw, h: Math.min(f.r.h, mobile ? 1800 : 1400) };
    if (f.r.y < docHeight) add("footer", f.el, footerBox, "푸터");
  }

  /* first view */
  add("hero", null, { x: 0, y: 0, w: vw, h: Math.min(vh, docHeight) }, "첫 화면");

  /* sections */
  const chromeTop = headerBox ? headerBox.y + headerBox.h : 0;
  const chromeBottom = footerBox ? footerBox.y : docHeight;
  const stackKids = (el) => [...el.children].filter((c) => {
    if (!rc.visible(c) || c.matches("script, style, header, footer, nav")) return false;
    const r = rc.docRect(c);
    return r.w >= vw * 0.78 && r.h >= 110 && r.y + r.h > chromeTop + 20 && r.y < chromeBottom - 20;
  });
  let container = document.querySelector("main, [role=main], #main, #container, #content, #contents, .main, .container") || document.body;
  if (!rc.visible(container) || rc.docRect(container).h < vh * 0.8) container = document.body;
  let kids = stackKids(container);
  for (let depth = 0; depth < 7 && kids.length < 3; depth += 1) {
    const pool = kids.length ? kids : [...container.children].filter(rc.visible);
    const tallest = pool.map((el) => ({ el, h: rc.docRect(el).h })).sort((a, b) => b.h - a.h)[0];
    if (!tallest) break;
    container = tallest.el;
    kids = stackKids(container);
  }
  // Split a child that is really several sections.
  const expanded = [];
  for (const kid of kids) {
    const r = rc.docRect(kid);
    const inner = r.h > vh * 2.2 ? stackKids(kid) : [];
    if (inner.length >= 2) expanded.push(...inner);
    else expanded.push(kid);
  }
  const heroBox = { x: 0, y: 0, w: vw, h: vh };
  const sectionLimit = mobile ? 8 : 10;
  const maxSection = mobile ? 1500 : 1300;
  let sectionCount = 0;
  for (const el of expanded) {
    if (sectionCount >= sectionLimit) break;
    const r = rc.docRect(el);
    if (r.y >= docHeight - 60) continue;
    const top = Math.max(r.y, chromeTop);
    const bottom = Math.min(r.y + r.h, chromeBottom);
    if (bottom - top < 160) continue;
    const box = { x: 0, y: top, w: vw, h: Math.min(bottom - top, maxSection) };
    if (overlapY(box, heroBox) > box.h * 0.6) continue;
    add("section", el, box, rc.heading(el));
    sectionCount += 1;
  }

  /* cards: three or more similar siblings with card styling */
  const cardBoxes = [];
  const iou = (a, b) => {
    const ix = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
    const iy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
    const inter = ix * iy;
    return inter / (a.w * a.h + b.w * b.h - inter || 1);
  };
  const cardLike = (el) => {
    const s = getComputedStyle(el);
    const border = parseFloat(s.borderTopWidth) > 0 && rc.parseColor(s.borderTopColor);
    const shadow = s.boxShadow && s.boxShadow !== "none";
    const radius = parseFloat(s.borderTopLeftRadius) >= 4;
    const bg = rc.parseColor(s.backgroundColor);
    const parentBg = rc.bgOf(el.parentElement);
    const ownBg = bg && rc.dist(bg, parentBg) > 10;
    const media = el.querySelector("img, picture, svg, video, [style*=background-image]");
    const text = (el.innerText || "").trim().length >= 6;
    return (border || shadow || ownBg || (radius && media)) || (media && text);
  };
  const groups = [];
  for (const parent of document.body.querySelectorAll("ul, ol, div, section, article")) {
    if (parent.children.length < 3 || parent.children.length > 80) continue;
    if (parent.closest("header, nav, footer, [role=navigation], [data-rc-hide]")) continue;
    const items = [...parent.children].filter((c) => rc.visible(c));
    if (items.length < 3) continue;
    const rects = items.map((el) => ({ el, r: rc.docRect(el) }));
    const first = rects.find(({ r }) => r.w >= 110 && r.h >= 90 && r.w <= (mobile ? vw * 0.96 : vw * 0.46) && r.h <= 760 && r.y < docHeight - 40 && r.x >= -2 && r.x + r.w <= vw + 2);
    if (!first) continue;
    const similar = rects.filter(({ r }) => Math.abs(r.w - first.r.w) <= first.r.w * 0.1 && Math.abs(r.h - first.r.h) <= first.r.h * 0.3);
    if (similar.length < 3) continue;
    if (!cardLike(first.el)) continue;
    groups.push({ parent, first, count: similar.length });
  }
  const cardLimit = mobile ? 8 : 10;
  for (const { first } of groups) {
    if (cardBoxes.length >= cardLimit) break;
    const pad = 10;
    const box = { x: first.r.x - pad, y: first.r.y - pad, w: first.r.w + pad * 2, h: first.r.h + pad * 2 };
    if (cardBoxes.some((b) => iou(b, box) > 0.6 || (box.x >= b.x && box.y >= b.y && box.x + box.w <= b.x + b.w && box.y + box.h <= b.y + b.h))) continue;
    cardBoxes.push(box);
    add("card", first.el, box, rc.heading(first.el));
  }

  /* search boxes and forms */
  const formBoxes = [];
  const searchInputs = [...document.querySelectorAll("input[type=search], [role=search] input, input[placeholder*=검색], input[placeholder*=search i], input[name*=search i], input[name*=keyword i], input[type=email], textarea")]
    .filter((el) => rc.visible(el) && !el.closest("[data-rc-hide]"));
  for (const input of searchInputs) {
    if (formBoxes.length >= 4) break;
    let box = null;
    let node = input;
    for (let step = 0; step < 5 && node && node !== document.body; step += 1) {
      const r = rc.docRect(node);
      if (r.w > vw * 0.96 || r.h > 220) break;
      const s = getComputedStyle(node);
      const framed = (parseFloat(s.borderTopWidth) > 0 && rc.parseColor(s.borderTopColor)) || (rc.parseColor(s.backgroundColor) && rc.dist(rc.parseColor(s.backgroundColor), rc.bgOf(node.parentElement)) > 8) || (s.boxShadow && s.boxShadow !== "none");
      if (framed && r.w >= 120 && r.h >= 28) box = r;
      node = node.parentElement;
    }
    if (!box) box = rc.docRect(input);
    const padded = { x: box.x - 12, y: box.y - 12, w: box.w + 24, h: box.h + 24 };
    if (formBoxes.some((b) => iou(b, padded) > 0.5)) continue;
    formBoxes.push(padded);
    const kindLabel = input.type === "email" ? "이메일 입력" : input.tagName === "TEXTAREA" ? "입력 폼" : "검색창";
    add("form", input, padded, kindLabel);
  }
  for (const form of document.querySelectorAll("form")) {
    if (formBoxes.length >= 5) break;
    if (!rc.visible(form) || form.closest("[data-rc-hide]")) continue;
    const fields = [...form.querySelectorAll("input:not([type=hidden]), select, textarea")].filter(rc.visible);
    if (fields.length < 2) continue;
    const r = rc.docRect(form);
    if (r.w < 200 || r.h < 60 || r.h > 900) continue;
    const padded = { x: r.x - 12, y: r.y - 12, w: r.w + 24, h: r.h + 24 };
    if (formBoxes.some((b) => iou(b, padded) > 0.4)) continue;
    formBoxes.push(padded);
    add("form", form, padded, rc.heading(form) || "입력 폼");
  }

  /* tabs */
  const tabBoxes = [];
  const tabLists = [...document.querySelectorAll("[role=tablist], [class*=tab i]:not(table):not(tbody)")]
    .filter((el) => rc.visible(el) && !el.closest("header, footer, [data-rc-hide]"));
  for (const list of tabLists) {
    if (tabBoxes.length >= 4) break;
    const items = [...list.querySelectorAll(":scope > li, :scope > button, :scope > a, :scope > [role=tab], :scope > ul > li, :scope > div > button")].filter(rc.visible);
    if (items.length < 2 || items.length > 14) continue;
    const r = rc.docRect(list);
    if (r.h < 24 || r.h > 110 || r.w < 120) continue;
    const tops = new Set(items.map((el) => Math.round(rc.docRect(el).y / 6)));
    if (tops.size > 2) continue;
    const padded = { x: r.x - 12, y: r.y - 10, w: r.w + 24, h: r.h + 20 };
    if (tabBoxes.some((b) => iou(b, padded) > 0.4)) continue;
    tabBoxes.push(padded);
    add("tab", list, padded, items.map((el) => rc.text(el, 12)).filter(Boolean).slice(0, 4).join(" · "));
  }

  return { parts, docHeight, scrollHeight: document.documentElement.scrollHeight };
}

// Buttons with a visible fill or outline, one per distinct style.
function findButtons(limit) {
  const rc = window.__rc;
  const vw = window.innerWidth;
  const seen = new Set();
  const out = [];
  const els = document.querySelectorAll("button, a, input[type=button], input[type=submit], [role=button]");
  for (const el of els) {
    if (out.length >= limit) break;
    if (el.closest("[data-rc-hide]") || !rc.visible(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 40 || r.height < 24 || r.width > 460 || r.height > 92) continue;
    const text = (el.tagName === "INPUT" ? el.value : el.innerText || "").replace(/\s+/g, " ").trim();
    const label = text || el.getAttribute("aria-label") || el.getAttribute("title") || "";
    if (!label || label.length > 34) continue;
    // Slider controls and skip links are not design references.
    if (/(skip to|본문 바로가기|자동재생|일시정지|pause|play|stop|prev|next|이전|다음|close|닫기)/i.test(label)) continue;
    const s = getComputedStyle(el);
    const bg = rc.parseColor(s.backgroundColor);
    const gradient = /gradient/i.test(s.backgroundImage);
    const parentBg = rc.bgOf(el.parentElement);
    const borderWidth = parseFloat(s.borderTopWidth) || 0;
    const borderColor = borderWidth >= 1 ? rc.parseColor(s.borderTopColor) : null;
    let variant = "";
    if (gradient || (bg && rc.dist(bg, parentBg) > 18)) variant = "filled";
    else if (borderColor && rc.dist(borderColor, parentBg) > 30) variant = "outline";
    if (!variant) continue;
    const radius = parseFloat(s.borderTopLeftRadius) || 0;
    const shape = radius >= r.height / 2 - 1 ? "pill" : radius >= 3 ? "rounded" : "square";
    const fg = rc.parseColor(s.color);
    const signature = [variant, bg, gradient ? s.backgroundImage.slice(0, 60) : "", fg, borderColor, shape, Math.round(r.height / 6), s.fontWeight].join("|");
    if (seen.has(signature)) continue;
    seen.add(signature);
    out.push({
      index: rc.register(el),
      label: label.slice(0, 34),
      style: {
        variant,
        shape,
        bg: variant === "filled" ? (bg || rc.parseColor(s.backgroundImage.match(/rgba?\([^)]+\)|#[0-9a-f]{3,8}/i)?.[0])) : null,
        fg,
        border: borderColor,
        radius: Math.round(radius),
        height: Math.round(r.height),
        font_size: Math.round(parseFloat(s.fontSize) || 0),
        font_weight: Number(s.fontWeight) || 400,
        gradient,
      },
      area: Math.round(r.width * r.height),
    });
  }
  return out;
}

function placeElement(index, pad) {
  const rc = window.__rc;
  const el = rc.els[index];
  if (!el || !rc.visible(el) || el.closest("[data-rc-hide]")) return null;
  el.scrollIntoView({ block: "center", inline: "center" });
  const r = el.getBoundingClientRect();
  if (r.width < 4 || r.height < 4) return null;
  return {
    x: Math.max(0, r.left + window.scrollX - pad),
    y: Math.max(0, r.top + window.scrollY - pad),
    w: r.width + pad * 2,
    h: r.height + pad * 2,
    bg: rc.bgOf(el.parentElement),
  };
}

// Colors a brand pushes: CSS variables with brand-ish names, theme-color,
// filled buttons, links and saturated text or backgrounds.
function collectColors(buttons) {
  const rc = window.__rc;
  const add = (map, hex, weight) => {
    if (!hex) return;
    map.set(hex, (map.get(hex) || 0) + weight);
  };
  const top = (map, n) => [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([hex, w]) => [hex, Math.round(w)]);
  const theme = rc.parseLoose(document.querySelector("meta[name=theme-color]")?.getAttribute("content"));
  const vars = [];
  const seenVar = new Set();
  const NAME_RE = /(primary|brand|main|point|accent|key|theme|secondary|tertiary|highlight|signature|corp|ci-|-ci\b|color-(red|blue|green|orange|purple|yellow|navy|pink|mint|teal))/i;
  for (const node of [document.documentElement, document.body]) {
    const cs = getComputedStyle(node);
    for (let i = 0; i < cs.length && vars.length < 60; i += 1) {
      const name = cs[i];
      if (!name.startsWith("--") || seenVar.has(name) || !NAME_RE.test(name)) continue;
      if (/(shadow|size|width|height|radius|font|spacing|duration|z-index|opacity|gap|space)/i.test(name)) continue;
      seenVar.add(name);
      const hex = rc.parseLoose(cs.getPropertyValue(name));
      if (hex) vars.push([name, hex]);
    }
  }
  const buttonColors = new Map();
  for (const b of buttons) {
    if (b.style.bg) add(buttonColors, b.style.bg, b.area);
    else if (b.style.border) add(buttonColors, b.style.border, b.area * 0.3);
  }
  const links = new Map();
  const accents = new Map();
  const backgrounds = new Map();
  let sampled = 0;
  for (const el of document.body.querySelectorAll("a, strong, em, b, mark, span, h1, h2, h3, h4, p, i")) {
    if (sampled > 4000) break;
    if (el.closest("[data-rc-hide]")) continue;
    const text = (el.childNodes.length && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) ? el.textContent.trim().length : 0;
    if (!text) continue;
    sampled += 1;
    const s = getComputedStyle(el);
    if (s.display === "none" || s.visibility === "hidden") continue;
    const color = rc.parseColor(s.color);
    if (!color) continue;
    if (el.tagName === "A" && !rc.inChrome(el)) add(links, color, 1);
    if (rc.chroma(color) >= 0.28) add(accents, color, Math.min(text, 40));
  }
  let big = 0;
  for (const el of document.body.querySelectorAll("section, div, li, article, aside, a, button")) {
    if (big > 5000) break;
    big += 1;
    const s = getComputedStyle(el);
    const bg = rc.parseColor(s.backgroundColor);
    if (!bg || rc.chroma(bg) < 0.22) continue;
    const r = el.getBoundingClientRect();
    const area = r.width * r.height;
    if (area < 1200) continue;
    add(backgrounds, bg, Math.sqrt(area));
  }
  const header = document.querySelector("header, [role=banner], #header");
  const footer = document.querySelector("footer, [role=contentinfo], #footer");
  return {
    theme,
    vars,
    buttons: top(buttonColors, 8),
    links: top(links, 5),
    accents: top(accents, 8),
    backgrounds: top(backgrounds, 8),
    text: rc.parseColor(getComputedStyle(document.body).color),
    bg: rc.bgOf(document.body),
    header_bg: header ? rc.bgOf(header) : null,
    footer_bg: footer ? rc.bgOf(footer) : null,
  };
}

// Bot walls, captchas and error pages are not the site's design.
function blockedReason() {
  const title = (document.title || "").trim();
  const text = (document.body?.innerText || "").replace(/\s+/g, " ").trim();
  const WALL_RE = /just a moment|attention required|access denied|verify you are human|are you a robot|checking your browser|pardon our interruption|request unsuccessful|sorry, you have been blocked|unusual traffic|security check|bot protection|captcha|enable javascript and cookies|you don't have permission to access/i;
  if (WALL_RE.test(title)) return title;
  if (text.length < 1500 && WALL_RE.test(text)) return text.slice(0, 80);
  if (/^(403|404|500|502|503)\b|forbidden|not found|service unavailable|bad gateway/i.test(title) && text.length < 1500) return title;
  if (text.length < 1500 && /cloudflare ray id|incapsula incident|errors\.edgesuite\.net|reference #[0-9a-f.]+/i.test(text)) return text.slice(0, 80);
  return "";
}

// Title, icons and share image as the browser sees them, used to fill in
// favicons and social images for sites that block plain HTTP clients.
function collectMeta() {
  const abs = (value) => {
    try {
      return new URL(value, location.href).href;
    } catch {
      return "";
    }
  };
  const icons = [...document.querySelectorAll("link[rel~=icon], link[rel=apple-touch-icon], link[rel=apple-touch-icon-precomposed], link[rel=mask-icon]")]
    .map((link) => ({ href: abs(link.getAttribute("href")), rel: link.getAttribute("rel") || "", sizes: link.getAttribute("sizes") || "", type: link.getAttribute("type") || "" }))
    .filter((icon) => /^https?:/.test(icon.href))
    .slice(0, 12);
  const og = document.querySelector("meta[property='og:image'], meta[name='og:image'], meta[name='twitter:image'], meta[property='twitter:image']");
  return {
    title: document.title.replace(/\s+/g, " ").trim().slice(0, 160),
    description: (document.querySelector("meta[name=description]")?.getAttribute("content") || "").replace(/\s+/g, " ").trim().slice(0, 240),
    final_url: location.href,
    icons,
    og_image: og ? abs(og.getAttribute("content")) : "",
    lang: document.documentElement.lang || "",
  };
}

// Menu, button and link icons (the same rules as collect_icons.mjs).
function findIcons(limit) {
  const MIN = 9;
  const MAX = 84;
  const areaFor = (element) => {
    if (element.closest("header, [class*=header], [class*=gnb], [id*=header]")) return "header";
    if (element.closest("nav, [role=navigation], [class*=menu], [class*=nav]")) return "menu";
    if (element.closest("footer, [class*=footer]")) return "footer";
    if (element.closest("button, [role=button], [class*=btn], [class*=button]")) return "button";
    if (element.closest("a")) return "link";
    return "other";
  };
  const labelFor = (element) => {
    const own = element.getAttribute("aria-label") || element.getAttribute("alt") || element.getAttribute("title")
      || (element.querySelector ? element.querySelector("title")?.textContent : "") || "";
    if (own.trim()) return own.replace(/\s+/g, " ").trim().slice(0, 50);
    const host = element.closest("a, button, [role=button], li");
    const text = host ? (host.getAttribute("aria-label") || host.getAttribute("title") || host.textContent || "") : "";
    return text.replace(/\s+/g, " ").trim().slice(0, 50);
  };
  const backgroundFor = (element) => window.__rc.bgOf(element);
  const skip = /logo|symbol|banner/i;
  // Sliders, popups and hero areas hold photos that happen to be icon sized.
  const noisyHost = "[class*=slide], [class*=swiper], [class*=carousel], [class*=popup], [class*=modal], [class*=layer], [class*=visual], [class*=hero], [class*=thumb], [class*=profile], [class*=avatar]";

  const candidates = [];
  const seen = new Set();
  const consider = (element, type, signature) => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    if (rect.width < MIN || rect.height < MIN || rect.width > MAX || rect.height > MAX) return;
    if (style.visibility === "hidden" || style.display === "none" || Number(style.opacity) < 0.15) return;
    if (!element.closest("header, nav, footer, a, button, [role=button], [class*=menu], [class*=btn], [class*=icon], [class*=nav]")) return;
    const identity = (element.className || "") + " " + (element.getAttribute("alt") || "") + " " + (element.getAttribute("src") || "");
    if (skip.test(identity)) return;
    if (element.closest("[data-rc-hide]")) return;
    if (element.closest(noisyHost)) return;
    // A photo used as a background fills its box; real icons keep their own size.
    if (type === "background" && /cover/.test(style.backgroundSize)) return;
    const key = type + "|" + signature + "|" + Math.round(rect.width) + "x" + Math.round(rect.height);
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push({ element, type, rect, key });
  };

  document.querySelectorAll("svg").forEach((svg) => {
    if (svg.parentElement && svg.parentElement.closest("svg")) return;
    consider(svg, "svg", svg.outerHTML.replace(/\s+/g, "").slice(0, 300));
  });
  document.querySelectorAll("img").forEach((image) => {
    consider(image, "img", image.currentSrc || image.src || "");
  });
  document.querySelectorAll("i, span, em, b, button, a, div").forEach((element) => {
    if (element.querySelector("img, svg") || (element.textContent || "").trim().length > 2) return;
    const style = getComputedStyle(element);
    const image = style.backgroundImage;
    if (image && image !== "none" && !image.includes("gradient")) {
      consider(element, "background", image + "|" + style.backgroundPosition + "|" + style.backgroundSize);
      return;
    }
    for (const pseudo of ["::before", "::after"]) {
      const computed = getComputedStyle(element, pseudo);
      const content = computed.content;
      if (content && !["none", "normal", '""'].includes(content) && /icon|awesome|material|xeicon|glyph/i.test(computed.fontFamily + element.className)) {
        consider(element, "font", element.className + "|" + content);
        return;
      }
    }
  });

  // Keep the innermost candidate when one wraps another.
  const kept = candidates
    .filter((candidate) => !candidates.some((other) => other !== candidate && candidate.element.contains(other.element)))
    .slice(0, limit);

  window.__icons = kept.map((candidate) => candidate.element);
  return kept.map((candidate, index) => ({
    index,
    type: candidate.type,
    label: labelFor(candidate.element),
    area: areaFor(candidate.element),
    background: backgroundFor(candidate.element),
    src: candidate.element.currentSrc || candidate.element.src || "",
    width: Math.round(candidate.rect.width),
    height: Math.round(candidate.rect.height),
  }));
}

// Top-level menu entries in the header that may open a dropdown on hover.
function findNavItems() {
  const rc = window.__rc;
  const header = document.querySelector("header, [role=banner], #header, #gnb, [class*=header i]");
  const scope = header || document.body;
  const headerBottom = header && rc.visible(header) ? Math.min(260, header.getBoundingClientRect().bottom) : 120;
  const links = [...scope.querySelectorAll("nav li > a, nav li > button, [role=navigation] li > a, ul > li > a, ul > li > button, [class*=gnb i] li > a, [class*=menu i] li > a")]
    .filter((el) => rc.visible(el) && el.getBoundingClientRect().top < 200 && (el.innerText || "").trim().length >= 1);
  const unique = [];
  for (const el of links) {
    const r = el.getBoundingClientRect();
    if (unique.some((u) => Math.abs(u.x - (r.left + r.width / 2)) < 8)) continue;
    const li = el.closest("li");
    const hasSub = Boolean(li && li.querySelector("ul, div, [class*=sub i], [class*=depth i], [class*=dropdown i]"));
    unique.push({ x: r.left + r.width / 2, y: r.top + r.height / 2, text: rc.text(el, 20), hasSub });
  }
  unique.sort((a, b) => Number(b.hasSub) - Number(a.hasSub) || a.x - b.x);
  const snapshot = new Set();
  for (const el of document.body.querySelectorAll("*")) if (rc.visible(el)) snapshot.add(el);
  window.__rcSnapshot = snapshot;
  return { items: unique.slice(0, 4), headerBottom };
}

// Area of elements that became visible since the last snapshot. With a header
// bottom given, only panels that hang from the header count (a dropdown), so a
// carousel changing slides further down the page is not mistaken for one.
function newlyVisible(minArea, headerBottom) {
  const rc = window.__rc;
  const vw = window.innerWidth, vh = window.innerHeight;
  const snapshot = window.__rcSnapshot || new Set();
  const header = document.querySelector("header, [role=banner], #header, #gnb, [class*=header i]");
  const hanging = headerBottom !== undefined && headerBottom !== null;
  let box = null;
  for (const el of document.body.querySelectorAll("*")) {
    if (snapshot.has(el) || !rc.visible(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.bottom <= 0 || r.top >= vh || r.width < 30 || r.height < 12) continue;
    if (hanging) {
      const inHeader = header && header.contains(el);
      if (!inHeader && r.top > headerBottom + 30) continue;
      if (!inHeader && el.closest("[class*=swiper i], [class*=slick i], [class*=carousel i], [class*=slide i], [class*=visual i]")) continue;
    }
    const next = {
      x1: Math.max(0, r.left), y1: Math.max(0, r.top),
      x2: Math.min(vw, r.right), y2: Math.min(vh, r.bottom),
    };
    box = box ? { x1: Math.min(box.x1, next.x1), y1: Math.min(box.y1, next.y1), x2: Math.max(box.x2, next.x2), y2: Math.max(box.y2, next.y2) } : next;
  }
  if (!box) return null;
  const area = (box.x2 - box.x1) * (box.y2 - box.y1);
  if (hanging && box.y2 < headerBottom + 40) return null;
  return area >= minArea ? { x: box.x1, y: box.y1, w: box.x2 - box.x1, h: box.y2 - box.y1, bottom: box.y2 } : null;
}

function snapshotVisible() {
  const rc = window.__rc;
  const snapshot = new Set();
  for (const el of document.body.querySelectorAll("*")) if (rc.visible(el)) snapshot.add(el);
  window.__rcSnapshot = snapshot;
  return snapshot.size;
}

// The hamburger or "all menu" button in the header.
function findMenuButton() {
  const rc = window.__rc;
  const vw = window.innerWidth;
  const MENU_RE = /hamburger|burger|allmenu|all-menu|all_menu|전체\s*메뉴|sitemap|drawer|menu|메뉴|gnb|nav-?toggle|navbar-toggler|side-?nav|btn-?nav/i;
  const NOT_RE = /close|닫기|search|검색|cart|장바구니|bag|basket|쇼핑백|login|로그인|my\s*page|마이|account|계정|profile|user|lang|language|언어|share|공유|알림|notification|bell|wish|찜|bookmark|region|country|국가/i;
  const cands = [];
  for (const el of document.querySelectorAll("button, a, [role=button], [onclick], label, div, span, i")) {
    if (!rc.visible(el) || el.closest("[data-rc-hide]")) continue;
    const r = el.getBoundingClientRect();
    if (r.top > 150 || r.top < -2 || r.width < 16 || r.height < 16 || r.width > 140 || r.height > 90) continue;
    const identity = `${rc.identity(el)} ${el.getAttribute("title") || ""} ${(el.innerText || "").slice(0, 20)}`;
    if (!MENU_RE.test(identity) || NOT_RE.test(identity)) continue;
    const tagScore = el.matches("button, [role=button]") ? 3 : el.matches("a") ? 2 : 1;
    const edge = Math.min(r.left, vw - r.right) < vw * 0.2 ? 2 : 0;
    cands.push({ el, r, score: tagScore + edge + (/hamburger|burger|allmenu|전체/i.test(identity) ? 3 : 0) });
  }
  cands.sort((a, b) => b.score - a.score);
  const best = cands.find((c) => !cands.some((o) => o !== c && o.el.contains(c.el) && o.score >= c.score)) || cands[0];
  if (!best) return null;
  return { index: rc.register(best.el), label: rc.text(best.el, 20), x: best.r.left + best.r.width / 2, y: best.r.top + best.r.height / 2 };
}

// How the page scrolls: the document, an inner scroll container, or one
// screen at a time (fullPage.js and similar section sliders).
function scrollMode() {
  const vh = window.innerHeight;
  const doc = document.documentElement.scrollHeight;
  const lock = ["hidden", "clip"];
  const locked = lock.includes(getComputedStyle(document.documentElement).overflowY) || lock.includes(getComputedStyle(document.body).overflowY);
  if (doc > vh * 1.15 && !locked) return { mode: "document", height: doc };
  let best = null;
  for (const el of document.querySelectorAll("body *")) {
    const s = getComputedStyle(el);
    if (!/(auto|scroll|overlay)/.test(s.overflowY)) continue;
    if (el.clientHeight < vh * 0.6 || el.scrollHeight <= el.clientHeight * 1.3) continue;
    if (!best || el.scrollHeight > best.scrollHeight) best = el;
  }
  if (best) {
    window.__rcScroller = best;
    return { mode: "element", height: best.scrollHeight };
  }
  const slides = document.querySelectorAll(".fp-section, .section.fp-table, .pp-section, #fullpage > .section, #fullpage > section, .fullpage-wrapper > *, .swiper-vertical > .swiper-wrapper > .swiper-slide, .swiper-container-vertical > .swiper-wrapper > .swiper-slide");
  if (slides.length >= 2) return { mode: "slides", height: doc, slides: slides.length };
  return { mode: doc > vh * 1.15 ? "document" : "single", height: doc };
}

// Hide what would repeat on every stitched tile: fixed elements, and sticky
// elements that are stuck to the top like a header.
function hideStuck() {
  const rc = window.__rc;
  const vw = window.innerWidth;
  let hidden = 0;
  for (const el of document.body.querySelectorAll("*")) {
    if (el.closest("[data-rc-hide]")) continue;
    const s = getComputedStyle(el);
    if (s.position === "fixed") {
      rc.hide(el, "visibility");
      hidden += 1;
    } else if (s.position === "sticky") {
      const r = el.getBoundingClientRect();
      if (r.top <= 2 && r.width >= vw * 0.8 && r.height <= 240) {
        rc.hide(el, "visibility");
        hidden += 1;
      }
    }
  }
  return hidden;
}

function unhideVisibility() {
  const rc = window.__rc;
  rc.hidden.filter((el) => el.getAttribute("data-rc-hide") === "visibility").forEach((el) => rc.unhide(el));
  rc.hidden = rc.hidden.filter((el) => el.hasAttribute("data-rc-hide"));
  return true;
}

// Runs in a blank page: paint the tiles onto one canvas and encode it as WebP.
async function stitchTiles(width, height, quality) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  for (const tile of window.__tiles) {
    const image = new Image();
    image.src = "data:image/jpeg;base64," + tile.data;
    await image.decode();
    ctx.drawImage(image, 0, tile.y);
  }
  window.__tiles = [];
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", quality / 100));
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

const SCROLL_SCRIPT = (maxHeight) => `
  new Promise((resolve) => {
    const step = Math.max(300, Math.round(window.innerHeight * 0.8));
    let y = 0;
    const tick = () => {
      const total = Math.min(document.documentElement.scrollHeight, ${maxHeight});
      y += step;
      window.scrollTo(0, y);
      if (y < total) setTimeout(tick, 200);
      else setTimeout(() => resolve(document.documentElement.scrollHeight), 300);
    };
    tick();
  })
`;

/* ---------- node side ---------- */

const call = (fn, ...args) => `(${fn.toString()})(${args.map((a) => JSON.stringify(a)).join(",")})`;

async function collectDevice(browser, row, deviceName, args, day, job = { aborted: false }) {
  const device = DEVICES[deviceName];
  const url = row.page_url || row.requested_url;
  const { targetId } = await browser.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await browser.send("Target.attachToTarget", { targetId, flatten: true });
  job.targetId = targetId;
  const send = (method, params) => {
    if (job.aborted) return Promise.reject(new Error("aborted"));
    return withTimeout(browser.send(method, params, sessionId), 90_000, method);
  };
  const evaluate = async (expression, timeout = 40_000) => {
    const result = await withTimeout(send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }), timeout, "evaluate");
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description?.split("\n")[0] || "page script failed");
    return result.result?.value;
  };
  const network = trackNetwork(browser, sessionId);
  const dir = `components/${row.category}/${row.slug}`;
  const pixel = device.scale;
  const saved = [];
  const hashes = new Set();
  const debug = (...parts) => process.env.RC_DEBUG && console.log(`  [${row.slug} ${deviceName}]`, ...parts);
  const started = Date.now();
  let lastMark = started;
  const mark = (label) => {
    if (!process.env.RC_DEBUG) return;
    const now = Date.now();
    debug(`${label} +${now - lastMark}ms (${Math.round((now - started) / 1000)}s)`);
    lastMark = now;
  };

  const shoot = async (box, { quality = args.quality, scale = 1, beyond = true } = {}) => {
    const clip = {
      x: Math.max(0, Math.round(box.x)),
      y: Math.max(0, Math.round(box.y)),
      width: Math.max(1, Math.round(box.w)),
      height: Math.max(1, Math.round(box.h)),
      scale,
    };
    const shot = await send("Page.captureScreenshot", { format: "webp", quality, captureBeyondViewport: beyond, clip });
    return Buffer.from(shot.data, "base64");
  };
  const keep = async (buffer, kind, label, extra = {}, format = "webp") => {
    if (job.aborted || buffer.length < (format === "png" ? 120 : 300)) return null;
    const sha256 = createHash("sha256").update(buffer).digest("hex");
    if (hashes.has(sha256)) return null;
    hashes.add(sha256);
    const count = saved.filter((item) => item.kind === kind).length + 1;
    const name = `${deviceName}-${kind}-${String(count).padStart(2, "0")}.${format}`;
    await mkdir(path.join(ROOT, dir), { recursive: true });
    await writeFile(path.join(ROOT, dir, name), buffer);
    const [width, height] = format === "png" ? [buffer.readUInt32BE(16), buffer.readUInt32BE(20)] : webpSize(buffer);
    const item = { kind, label: label || "", path: `${dir}/${name}`, width, height, bytes: buffer.length, sha256, ...extra };
    saved.push(item);
    return item;
  };
  // Crop popups that are open now, then hide them. Repeats because some sites
  // open a second popup once the first one is gone.
  const sweepOverlays = async (state) => {
    for (let round = 0; round < 3; round += 1) {
      const overlays = await evaluate(call(findOverlays)).catch(() => []);
      if (!overlays?.length) return;
      for (const overlay of overlays) {
        try {
          await keep(await shoot(overlay.box, { beyond: false }), overlay.kind, overlay.label, { state });
        } catch {
          // The popup closed itself.
        }
      }
      const hidden = await evaluate(call(hideOverlays)).catch(() => 0);
      debug("overlays", overlays.length, "hidden", hidden);
      await sleep(350);
    }
  };
  // Encode tiles captured in this page into one image, in a blank page so the
  // site's content security policy cannot block the data URLs.
  const stitch = async (tiles, width, height) => {
    const { targetId: blankId } = await browser.send("Target.createTarget", { url: "about:blank" });
    const { sessionId: blank } = await browser.send("Target.attachToTarget", { targetId: blankId, flatten: true });
    try {
      await browser.send("Runtime.evaluate", { expression: "window.__tiles = []; true" }, blank);
      for (const tile of tiles) {
        await browser.send("Runtime.evaluate", { expression: `window.__tiles.push({ y: ${tile.y}, data: "${tile.data}" }); true` }, blank);
      }
      const result = await withTimeout(browser.send("Runtime.evaluate", {
        expression: call(stitchTiles, width, height, args.layoutQuality),
        awaitPromise: true,
        returnByValue: true,
      }, blank), 60_000, "stitch");
      if (result.exceptionDetails) throw new Error("stitch failed");
      return Buffer.from(result.result.value, "base64");
    } finally {
      await withTimeout(browser.send("Target.closeTarget", { targetId: blankId }), 5000, "close").catch(() => {});
    }
  };
  const viewportTile = async (y) => {
    // JPEG is much faster to encode than WebP; the stitched page is encoded once as WebP.
    const shot = await send("Page.captureScreenshot", {
      format: "jpeg",
      quality: 92,
      captureBeyondViewport: false,
      clip: { x: 0, y, width: device.width, height: device.height, scale: 1 },
    });
    return shot.data;
  };

  try {
    await send("Page.enable");
    await send("Network.enable");
    await send("Emulation.setDeviceMetricsOverride", { width: device.width, height: device.height, deviceScaleFactor: device.scale, mobile: device.mobile });
    await send("Emulation.setUserAgentOverride", { userAgent: device.userAgent, acceptLanguage: "ko-KR,ko;q=0.9,en;q=0.7" });
    if (device.mobile) await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });

    const loaded = browser.waitFor("Page.loadEventFired", sessionId, 30_000);
    const navigation = await send("Page.navigate", { url });
    if (navigation.errorText) throw new Error(navigation.errorText);
    await loaded;
    await network.idle(1500, 10_000);
    await sleep(700);
    // Heavy pages can still be busy starting up; give them a second chance.
    await evaluate(call(installHelpers)).catch(async () => {
      await sleep(3000);
      await evaluate(call(installHelpers), 60_000);
    });
    mark("loaded");
    const blocked = await evaluate(call(blockedReason)).catch(() => "");
    if (blocked) throw new Error(`blocked page: ${blocked}`);

    /* 1. popups on load */
    await sweepOverlays("on-load");

    mark("popups");
    /* 2. lazy load, floating widgets, scrolled header */
    let mode = await evaluate(call(scrollMode)).catch(() => ({ mode: "single" }));
    if (mode.mode === "document") {
      await evaluate(SCROLL_SCRIPT(device.maxHeight), 30_000).catch(() => {});
      await network.idle(1200, 7000);
      await evaluate(`window.scrollTo(0, Math.round(window.innerHeight * 1.4)); true`);
      await sleep(900);
      await sweepOverlays("on-scroll");
    }
    const floating = await evaluate(call(findFloating)).catch(() => []);
    for (const item of floating || []) {
      try {
        await keep(await shoot(item.box, { beyond: false, scale: device.mobile ? 1 : 1.5 }), item.kind, item.label, { state: mode.mode === "document" ? "scrolled" : "on-load" });
      } catch {
        // ignore
      }
    }
    await evaluate(call(hideFloating, (floating || []).filter((f) => f.kind === "floating").map((f) => f.index))).catch(() => {});
    await evaluate(`window.scrollTo(0, 0); true`);
    await sleep(600);
    await network.idle(800, 3000);
    await sweepOverlays("late");
    mark("scrolled+floating");

    /* 3. static parts, then the full page as stitched screen-sized tiles */
    mode = await evaluate(call(scrollMode)).catch(() => mode);
    const measured = await evaluate(call(measureParts, device.maxHeight), 60_000);
    const buttons = await evaluate(call(findButtons, device.mobile ? 14 : 18)).catch(() => []);
    const colors = await evaluate(call(collectColors, buttons || []), 20_000).catch(() => null);
    const meta = await evaluate(call(collectMeta)).catch(() => null);
    mark("measured");

    // Icons are cropped at 3x on PC before the capture hides fixed headers.
    if (!device.mobile) {
      const found = await evaluate(call(findIcons, 32)).catch(() => []);
      for (const candidate of found || []) {
        try {
          const placed = await evaluate(`(() => {
            const element = window.__icons[${candidate.index}];
            if (!element) return null;
            element.scrollIntoView({ block: "center", inline: "center" });
            const rect = element.getBoundingClientRect();
            return { x: rect.left + window.scrollX, y: rect.top + window.scrollY, w: rect.width, h: rect.height };
          })()`);
          if (!placed || placed.w < 9 || placed.h < 9) continue;
          await sleep(70);
          // The icon was scrolled into view, so a viewport capture is enough and far faster.
          const shot = await send("Page.captureScreenshot", {
            format: "png",
            captureBeyondViewport: false,
            clip: { x: Math.max(0, placed.x - 2), y: Math.max(0, placed.y - 2), width: placed.w + 4, height: placed.h + 4, scale: 3 },
          });
          const buffer = Buffer.from(shot.data, "base64");
          if (buffer.length < 120 || buffer.length > 400_000) continue;
          await keep(buffer, "icon", candidate.label, {
            area: candidate.area,
            background: candidate.background,
            source_type: candidate.type,
            source_url: candidate.src || "",
            css_width: candidate.width,
            css_height: candidate.height,
          }, "png");
        } catch {
          // The icon moved away while the page was still settling.
        }
      }
      await evaluate(`window.scrollTo(0, 0); true`).catch(() => {});
      await sleep(300);
    }
    await evaluate(`window.scrollTo(0, 0); true`);
    await sleep(300);

    mark("icons");

    /* buttons at 2x (PC), before the capture hides fixed headers; each is scrolled
       to the middle of the screen, away from a fixed header */
    const labelCounts = {};
    for (const buttonInfo of buttons || []) {
      if ((labelCounts[buttonInfo.label] || 0) >= 2) continue;
      try {
        const box = await evaluate(call(placeElement, buttonInfo.index, 6));
        if (!box) continue;
        await sleep(60);
        const item = await keep(await shoot(box, { quality: 80, scale: device.mobile ? 1 : 2, beyond: false }), "button", buttonInfo.label, { style: { ...buttonInfo.style, surface: box.bg } });
        if (item) labelCounts[buttonInfo.label] = (labelCounts[buttonInfo.label] || 0) + 1;
      } catch {
        // The button moved away (slider) or disappeared.
      }
    }
    await evaluate(`window.scrollTo(0, 0); true`).catch(() => {});
    await sleep(250);
    mark("buttons");
    const tiles = [];
    let height = device.height;
    let slideCount = 0;
    if (mode.mode === "document") {
      const metrics = await send("Page.getLayoutMetrics");
      const contentHeight = Math.ceil(metrics.cssContentSize?.height || device.height);
      height = Math.max(device.height, Math.min(contentHeight, device.maxHeight));
      for (let y = 0; y < height; y += device.height) {
        const top = Math.min(y, height - device.height);
        // A busy page may answer slowly; keep going with what is on screen.
        await evaluate(`window.scrollTo(0, ${top}); true`, 20_000).catch(() => {});
        await sleep(y === 0 ? 200 : 320);
        const scrolled = await evaluate("Math.round(window.scrollY)", 20_000).catch(() => top);
        if (scrolled < top - 4) {
          // The page got shorter while scrolling; end the capture here.
          tiles.push({ y: scrolled * pixel, data: await viewportTile(scrolled) });
          height = scrolled + device.height;
          break;
        }
        tiles.push({ y: top * pixel, data: await viewportTile(top) });
        if (y === 0) await evaluate(call(hideStuck)).catch(() => 0);
      }
    } else {
      // One screen at a time: an inner scroller, a section slider or a single screen.
      let previous = "";
      const maxScreens = Math.min(10, Math.floor(16383 / (device.height * pixel)));
      for (let index = 0; index < maxScreens; index += 1) {
        if (index > 0) {
          if (mode.mode === "element") {
            const moved = await evaluate(`(() => { const el = window.__rcScroller; const before = el.scrollTop; el.scrollTop = before + el.clientHeight; return el.scrollTop !== before; })()`).catch(() => false);
            if (!moved) break;
          } else if (mode.mode === "slides") {
            await send("Input.dispatchMouseEvent", { type: "mouseWheel", x: Math.round(device.width / 2), y: Math.round(device.height / 2), deltaX: 0, deltaY: 600 }).catch(() => {});
            await send("Input.dispatchKeyEvent", { type: "keyDown", key: "PageDown", code: "PageDown", windowsVirtualKeyCode: 34 }).catch(() => {});
            await send("Input.dispatchKeyEvent", { type: "keyUp", key: "PageDown", code: "PageDown", windowsVirtualKeyCode: 34 }).catch(() => {});
          } else break;
          await sleep(1300);
          await network.idle(600, 4000);
        }
        const data = await viewportTile(0);
        const digest = createHash("sha256").update(data).digest("hex");
        if (digest === previous) break;
        previous = digest;
        tiles.push({ y: index * device.height * pixel, data });
        slideCount = index + 1;
      }
      height = device.height * Math.max(1, slideCount);
    }
    mark(`tiles x${tiles.length}`);
    const fullBuffer = await stitch(tiles, device.width * pixel, height * pixel);
    mark("stitched");
    if (job.aborted) throw new Error("aborted");
    const [fullWidth, fullHeight] = webpSize(fullBuffer);
    const layoutPath = `layouts/${row.category}/${row.slug}/${day}-${deviceName}.webp`;
    await mkdir(path.join(ROOT, path.dirname(layoutPath)), { recursive: true });
    await writeFile(path.join(ROOT, layoutPath), fullBuffer);
    debug("mode", mode.mode, "tiles", tiles.length, "size", fullWidth, fullHeight);

    let parts = measured?.parts || [];
    if (mode.mode !== "document") {
      // Screens after the first are sections of their own.
      parts = parts.filter((part) => part.kind !== "section" && part.kind !== "footer" && part.box.y < device.height);
      for (let index = 1; index < slideCount; index += 1) {
        parts.push({ kind: "section", label: `화면 ${index + 1}`, box: { x: 0, y: index * device.height, w: device.width, h: device.height } });
      }
    }
    const regions = parts
      .filter((part) => part.box.y < height - 10)
      .map((part) => {
        const x = Math.round(part.box.x * pixel);
        const y = Math.round(part.box.y * pixel);
        const w = Math.min(Math.round(part.box.w * pixel), fullWidth - x);
        const h = Math.min(Math.round(part.box.h * pixel), fullHeight - y);
        return { kind: part.kind, label: part.label, box: [x, y, w, h], width: w, height: h };
      })
      .filter((part) => part.width >= 16 && part.height >= 12);

    const layout = {
      category: row.category,
      slug: row.slug,
      company: row.company,
      device: deviceName,
      path: layoutPath,
      page_url: url,
      width: fullWidth || device.width * pixel,
      height: fullHeight || height * pixel,
      viewport_width: device.width,
      content_height: height,
      truncated: mode.mode === "document" && (mode.height || 0) > device.maxHeight,
      scroll_mode: mode.mode,
      bytes: fullBuffer.length,
      sha256: createHash("sha256").update(fullBuffer).digest("hex"),
      captured_at: new Date().toISOString(),
      source: "components",
    };

    await evaluate(call(unhideVisibility)).catch(() => {});
    await evaluate(`window.scrollTo(0, 0); if (window.__rcScroller) window.__rcScroller.scrollTop = 0; true`).catch(() => {});
    await sleep(500);

    /* 5. interactive states */
    if (!device.mobile) {
      const nav = await evaluate(call(findNavItems)).catch(() => null);
      for (const item of nav?.items || []) {
        try {
          await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: Math.round(item.x), y: Math.round(item.y) });
          await sleep(850);
          const opened = await evaluate(call(newlyVisible, 30_000, nav.headerBottom));
          if (opened) {
            const bottom = Math.min(device.height, Math.round(opened.bottom + 16));
            await keep(await shoot({ x: 0, y: 0, w: device.width, h: bottom }, { beyond: false }), "nav", `메가메뉴 · ${item.text}`, { state: "hover" });
            break;
          }
        } catch {
          // ignore
        }
      }
      await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: Math.round(device.width / 2), y: device.height - 4 }).catch(() => {});
      await sleep(400);
    }
    const menuButton = await evaluate(call(findMenuButton)).catch(() => null);
    if (menuButton) {
      try {
        const before = await evaluate(`location.href`);
        await evaluate(call(snapshotVisible));
        await evaluate(`(() => { const el = window.__rc.els[${menuButton.index}]; el.click(); return true; })()`);
        await sleep(1100);
        let after = await evaluate(`location.href`).catch(() => "");
        let opened = after === before ? await evaluate(call(newlyVisible, device.width * device.height * 0.25, null)) : null;
        if (!opened && after === before && device.mobile) {
          await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: Math.round(menuButton.x), y: Math.round(menuButton.y) }] });
          await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
          await sleep(1100);
          after = await evaluate(`location.href`).catch(() => "");
          opened = after === before ? await evaluate(call(newlyVisible, device.width * device.height * 0.25, null)) : null;
        }
        if (opened) {
          await keep(await shoot({ x: 0, y: 0, w: device.width, h: device.height }, { beyond: false }), "nav", device.mobile ? "모바일 메뉴 (햄버거)" : "전체 메뉴", { state: "open" });
        }
      } catch {
        // The menu did not open.
      }
    }

    mark("menus");
    return {
      entry: {
        category: row.category,
        slug: row.slug,
        company: row.company,
        device: deviceName,
        page_url: url,
        collected_at: new Date().toISOString(),
        layout: layoutPath,
        layout_width: layout.width,
        layout_height: layout.height,
        pixel_ratio: pixel,
        scroll_mode: mode.mode,
        regions,
        items: saved,
        colors,
        meta,
      },
      layout,
    };
  } finally {
    network.stop();
    await withTimeout(browser.send("Target.closeTarget", { targetId }), 5000, "close").catch(() => {});
  }
}

// Write through a temporary file so a reader never sees a half-written file.
async function writeAtomic(file, text) {
  const temp = `${file}.${process.pid}.tmp`;
  await writeFile(temp, text, "utf8");
  for (let attempt = 0; ; attempt += 1) {
    try {
      await rename(temp, file);
      return;
    } catch (error) {
      if (attempt >= 20) throw error;
      await sleep(150);
    }
  }
}

// Another script may be rewriting the file right now; a half-written file is
// retried instead of being taken as empty.
async function loadJson(file, fallback) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    let text;
    try {
      text = await readFile(file, "utf8");
    } catch {
      return fallback;
    }
    try {
      return JSON.parse(text);
    } catch {
      await sleep(500);
    }
  }
  return fallback;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const day = new Date().toISOString().slice(0, 10);
  const rows = await loadJson(args.rows ? path.resolve(args.rows) : MANIFEST, []);
  let components = await loadJson(COMPONENTS_JSON, []);
  let layouts = await loadJson(LAYOUTS_JSON, []);

  const failures = await loadJson(FAILED_JSON, {});
  const done = new Set(components.map((entry) => `${entry.slug}:${entry.device}`));
  let targets = rows.filter((row) => /^https?:/i.test(row.page_url || row.requested_url || ""));
  if (args.company.length) targets = targets.filter((row) => args.company.includes(row.company) || args.company.includes(row.slug));
  if (args.category.length) targets = targets.filter((row) => args.category.includes(row.category));
  if (args.limit) targets = targets.slice(0, args.limit);
  let jobs = targets.flatMap((row) => args.devices.map((device) => ({ row, device })))
    .filter(({ row, device }) => !args.skipExisting || (!done.has(`${row.slug}:${device}`) && (failures[`${row.slug}:${device}`] || 0) < 2));
  const remaining = jobs.length;
  if (args.maxJobs) jobs = jobs.slice(0, args.maxJobs);
  console.log(`REMAINING ${remaining}`);
  const recordFailure = async (key) => {
    failures[key] = (failures[key] || 0) + 1;
    await mkdir(path.dirname(FAILED_JSON), { recursive: true });
    await writeFile(FAILED_JSON, JSON.stringify(failures), "utf8");
  };

  // One browser's main process handles every screenshot of its tabs, so a few
  // browsers with a few tabs each are much faster than one browser with many.
  const browserCount = Math.max(1, args.browsers || Math.ceil(args.workers / 2));
  const pool = [];
  for (let index = 0; index < browserCount; index += 1) pool.push({ browser: await Browser.launch(), restarting: null, failures: 0 });
  console.log(`Browser: ${pool[0].browser.executable} x${browserCount}`);
  console.log(`Collecting components for ${jobs.length} pages with ${args.workers} workers`);

  let saveChain = Promise.resolve();
  const save = (result) => {
    const { entry, layout } = result;
    const previous = components.find((item) => item.slug === entry.slug && item.device === entry.device);
    components = components.filter((item) => !(item.slug === entry.slug && item.device === entry.device));
    components.push(entry);
    components.sort((a, b) => a.category.localeCompare(b.category) || a.slug.localeCompare(b.slug) || a.device.localeCompare(b.device));
    layouts = layouts.filter((item) => item.path !== layout.path);
    layouts.push(layout);
    layouts.sort((a, b) => a.category.localeCompare(b.category) || a.slug.localeCompare(b.slug) || a.captured_at.localeCompare(b.captured_at));
    const componentSnapshot = JSON.stringify(components);
    const layoutSnapshot = JSON.stringify(layouts, null, 2);
    // Files of a previous run for this page that were not reused.
    const stale = (previous?.items || []).map((item) => item.path).filter((p) => !entry.items.some((item) => item.path === p));
    saveChain = saveChain.then(async () => {
      await writeAtomic(COMPONENTS_JSON, componentSnapshot);
      await writeAtomic(LAYOUTS_JSON, layoutSnapshot);
      for (const file of stale) await rm(path.join(ROOT, file), { force: true }).catch(() => {});
    });
    return saveChain;
  };

  let cursor = 0;
  let finished = 0;
  let failed = 0;
  let lastProgress = Date.now();
  let failStreak = 0;
  const watchdog = setInterval(() => {
    if (Date.now() - lastProgress > 12 * 60_000) {
      console.log(`WATCHDOG no progress for 10 minutes; ending this batch (saved=${finished} failed=${failed})`);
      pool.forEach((slot) => slot.browser.child.kill());
      saveChain.finally(() => process.exit(3));
    }
  }, 30_000);
  const worker = async (workerIndex) => {
    const slot = pool[workerIndex % pool.length];
    while (cursor < jobs.length) {
      const { row, device } = jobs[cursor++];
      if (slot.restarting) await slot.restarting;
      const browser = slot.browser;
      try {
        const job = { aborted: false };
        const result = await withTimeout(collectDevice(browser, row, device, args, day, job), 420_000, "collect").catch(async (error) => {
          job.aborted = true;
          if (job.targetId) await withTimeout(browser.send("Target.closeTarget", { targetId: job.targetId }), 5000, "close").catch(() => {});
          throw error;
        });
        await save(result);
        finished += 1;
        lastProgress = Date.now();
        failStreak = 0;
        slot.failures = 0;
        const e = result.entry;
        const kinds = {};
        e.regions.concat(e.items).forEach((item) => { kinds[item.kind] = (kinds[item.kind] || 0) + 1; });
        console.log(`[${finished + failed}/${jobs.length}] ${row.company} ${device} ${Object.entries(kinds).map(([k, v]) => `${k}=${v}`).join(" ")}`);
      } catch (error) {
        failed += 1;
        lastProgress = Date.now();
        failStreak += 1;
        slot.failures += 1;
        // A long run of failures means the browsers are wedged, not the sites.
        if (failStreak >= 12) {
          console.log(`WATCHDOG ${failStreak} failures in a row; ending this batch (saved=${finished} failed=${failed})`);
          pool.forEach((entry) => entry.browser.child.kill());
          await saveChain;
          process.exit(3);
        }
        await recordFailure(`${row.slug}:${device}`).catch(() => {});
        console.log(`[${finished + failed}/${jobs.length}] ${row.company} ${device} failed: ${error.message}`);
        const wedged = slot.failures >= 3;
        if ((wedged || /connection closed|Target closed|WebSocket/i.test(error.message)) && !slot.restarting && slot.browser === browser) {
          slot.failures = 0;
          slot.restarting = (async () => {
            await browser.close().catch(() => {});
            slot.browser = await Browser.launch();
            slot.restarting = null;
          })();
          await slot.restarting;
        }
      }
    }
  };
  await Promise.all(Array.from({ length: args.workers }, (_, index) => worker(index)));
  clearInterval(watchdog);
  await saveChain;
  await Promise.all(pool.map((slot) => withTimeout(slot.browser.close(), 15_000, "browser close").catch(() => slot.browser.child.kill())));
  console.log(`Done. saved=${finished} failed=${failed}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
