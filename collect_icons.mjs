// Collect the small icons used in menus, buttons and links on each official site.
// Icons are usually inline SVG, sprite sheets or icon fonts, so they cannot be
// downloaded by URL. Instead the page is rendered and each icon element is
// cropped straight out of the screenshot, with its label and background kept.
//
//   node collect_icons.mjs --workers 3
//   node collect_icons.mjs --company 롯데렌터카
//   node collect_icons.mjs --category 금융 --skip-existing

import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Browser, sleep, trackNetwork, withTimeout } from "./cdp.mjs";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const MANIFEST = path.join(ROOT, "manifest.json");
const ICONS_JSON = path.join(ROOT, "icons.json");
const VIEWPORT = { width: 1440, height: 950 };
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

function parseArgs(argv) {
  const args = { workers: 3, company: [], category: [], limit: 0, max: 44, skipExisting: false };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (flag === "--workers") args.workers = Math.max(1, Number(value) || 1), (i += 1);
    else if (flag === "--company") args.company.push(value), (i += 1);
    else if (flag === "--category") args.category.push(value), (i += 1);
    else if (flag === "--limit") args.limit = Number(value) || 0, (i += 1);
    else if (flag === "--max") args.max = Number(value) || 44, (i += 1);
    else if (flag === "--skip-existing") args.skipExisting = true;
  }
  return args;
}

// Runs inside the page. Finds icon-sized graphics that sit in navigation,
// buttons or links, keeps the innermost one of any nested pair, and stores the
// elements on window.__icons so they can be cropped one by one.
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
  const backgroundFor = (element) => {
    let node = element;
    while (node && node !== document.documentElement) {
      const parts = getComputedStyle(node).backgroundColor.match(/[\d.]+/g);
      if (parts && (parts.length < 4 || Number(parts[3]) > 0.5)) {
        return "#" + parts.slice(0, 3).map((value) => Number(value).toString(16).padStart(2, "0")).join("");
      }
      node = node.parentElement;
    }
    return "#ffffff";
  };
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

const SCROLL_SCRIPT = `
  new Promise((resolve) => {
    let y = 0;
    const tick = () => {
      y += Math.round(window.innerHeight * 0.9);
      window.scrollTo(0, y);
      if (y < Math.min(document.documentElement.scrollHeight, 6000)) setTimeout(tick, 180);
      else setTimeout(() => { window.scrollTo(0, 0); resolve(1); }, 300);
    };
    tick();
  })
`;

function pngSize(buffer) {
  return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)];
}

async function collect(browser, row, max) {
  const url = row.page_url || row.requested_url;
  const { targetId } = await browser.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await browser.send("Target.attachToTarget", { targetId, flatten: true });
  const send = (method, params) => browser.send(method, params, sessionId);
  const network = trackNetwork(browser, sessionId);
  try {
    await send("Page.enable");
    await send("Network.enable");
    await send("Emulation.setDeviceMetricsOverride", { ...VIEWPORT, deviceScaleFactor: 1, mobile: false });
    await send("Emulation.setUserAgentOverride", { userAgent: USER_AGENT, acceptLanguage: "ko-KR,ko;q=0.9,en;q=0.7" });

    const loaded = browser.waitFor("Page.loadEventFired", sessionId, 30_000);
    const navigation = await send("Page.navigate", { url });
    if (navigation.errorText) throw new Error(navigation.errorText);
    await loaded;
    await network.idle(1500, 15_000);
    await withTimeout(send("Runtime.evaluate", { expression: SCROLL_SCRIPT, awaitPromise: true }), 15_000, "scroll").catch(() => {});
    await network.idle(1000, 8000);
    await sleep(600);

    const found = await send("Runtime.evaluate", {
      expression: `(${findIcons.toString()})(${max})`,
      returnByValue: true,
    });
    const candidates = found.result?.value || [];
    const directory = `icons/${row.category}/${row.slug}`;
    await rm(path.join(ROOT, directory), { recursive: true, force: true });
    const icons = [];
    const hashes = new Set();

    for (const candidate of candidates) {
      try {
        const placed = await send("Runtime.evaluate", {
          expression: `(() => {
            const element = window.__icons[${candidate.index}];
            if (!element) return null;
            element.scrollIntoView({ block: "center", inline: "center" });
            const rect = element.getBoundingClientRect();
            return { x: rect.left + window.scrollX, y: rect.top + window.scrollY, width: rect.width, height: rect.height };
          })()`,
          returnByValue: true,
        });
        const box = placed.result?.value;
        if (!box || box.width < 9 || box.height < 9) continue;
        await sleep(90);
        const pad = 2;
        const shot = await send("Page.captureScreenshot", {
          format: "png",
          captureBeyondViewport: true,
          clip: {
            x: Math.max(0, box.x - pad),
            y: Math.max(0, box.y - pad),
            width: box.width + pad * 2,
            height: box.height + pad * 2,
            scale: 3,
          },
        });
        const buffer = Buffer.from(shot.data, "base64");
        if (buffer.length < 120 || buffer.length > 400_000) continue;
        const sha256 = createHash("sha256").update(buffer).digest("hex");
        if (hashes.has(sha256)) continue;
        hashes.add(sha256);
        const [width, height] = pngSize(buffer);
        const name = `icon-${String(icons.length + 1).padStart(3, "0")}.png`;
        await mkdir(path.join(ROOT, directory), { recursive: true });
        await writeFile(path.join(ROOT, directory, name), buffer);
        icons.push({
          path: `${directory}/${name}`,
          label: candidate.label,
          area: candidate.area,
          source_type: candidate.type,
          source_url: candidate.src || "",
          background: candidate.background,
          width,
          height,
          css_width: candidate.width,
          css_height: candidate.height,
          bytes: buffer.length,
          sha256,
        });
      } catch {
        // Skip icons that disappear while the page is still moving.
      }
    }
    return {
      category: row.category,
      slug: row.slug,
      company: row.company,
      page_url: url,
      collected_at: new Date().toISOString(),
      icons,
    };
  } finally {
    network.stop();
    await browser.send("Target.closeTarget", { targetId }).catch(() => {});
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const rows = JSON.parse(await readFile(MANIFEST, "utf8"));
  let collections = [];
  try {
    collections = JSON.parse(await readFile(ICONS_JSON, "utf8"));
  } catch {
    collections = [];
  }

  const done = new Set(collections.filter((entry) => entry.icons.length).map((entry) => entry.slug));
  let targets = rows.filter((row) => /^https?:/i.test(row.page_url || row.requested_url || ""));
  if (args.company.length) targets = targets.filter((row) => args.company.includes(row.company) || args.company.includes(row.slug));
  if (args.category.length) targets = targets.filter((row) => args.category.includes(row.category));
  if (args.skipExisting) targets = targets.filter((row) => !done.has(row.slug));
  if (args.limit) targets = targets.slice(0, args.limit);

  const browser = await Browser.launch();
  console.log(`Browser: ${browser.executable}`);
  console.log(`Collecting icons from ${targets.length} companies with ${args.workers} workers`);

  let saveChain = Promise.resolve();
  const save = (entry) => {
    collections = collections.filter((item) => item.slug !== entry.slug);
    collections.push(entry);
    collections.sort((a, b) => a.category.localeCompare(b.category) || a.slug.localeCompare(b.slug));
    const snapshot = JSON.stringify(collections, null, 2);
    saveChain = saveChain.then(() => writeFile(ICONS_JSON, snapshot, "utf8"));
    return saveChain;
  };

  let cursor = 0;
  let finished = 0;
  let failed = 0;
  const worker = async () => {
    while (cursor < targets.length) {
      const row = targets[cursor++];
      try {
        const entry = await withTimeout(collect(browser, row, args.max), 150_000, "collect");
        await save(entry);
        finished += 1;
        console.log(`[${finished + failed}/${targets.length}] ${row.company} ${entry.icons.length} icons`);
      } catch (error) {
        failed += 1;
        console.log(`[${finished + failed}/${targets.length}] ${row.company} failed: ${error.message}`);
      }
    }
  };
  await Promise.all(Array.from({ length: args.workers }, worker));
  await saveChain;
  await browser.close();
  const total = collections.reduce((sum, entry) => sum + entry.icons.length, 0);
  console.log(`Done. companies=${finished} failed=${failed} icons=${total}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
