// Capture full-page PC and mobile screenshots of each official homepage.
// Uses an installed Chrome or Edge through the DevTools protocol, so no extra packages are needed.
//
//   node capture_layouts.mjs --workers 3
//   node capture_layouts.mjs --company 롯데렌터카 --devices pc
//   node capture_layouts.mjs --category 장기렌트_리스 --skip-existing

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Browser, sleep, trackNetwork, webpSize, withTimeout } from "./cdp.mjs";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const MANIFEST = path.join(ROOT, "manifest.json");
const LAYOUTS_JSON = path.join(ROOT, "layouts.json");

const DEVICES = {
  pc: {
    width: 1440,
    height: 900,
    scale: 1,
    mobile: false,
    maxHeight: 7200,
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  },
  mobile: {
    width: 390,
    height: 844,
    scale: 2,
    mobile: true,
    maxHeight: 5600,
    userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36",
  },
};

function parseArgs(argv) {
  const args = { workers: 3, company: [], category: [], limit: 0, devices: ["pc", "mobile"], skipExisting: false, quality: 72 };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (flag === "--workers") args.workers = Math.max(1, Number(value) || 1), (i += 1);
    else if (flag === "--company") args.company.push(value), (i += 1);
    else if (flag === "--category") args.category.push(value), (i += 1);
    else if (flag === "--limit") args.limit = Number(value) || 0, (i += 1);
    else if (flag === "--devices") args.devices = value.split(",").filter((d) => DEVICES[d]), (i += 1);
    else if (flag === "--quality") args.quality = Number(value) || 72, (i += 1);
    else if (flag === "--skip-existing") args.skipExisting = true;
  }
  return args;
}

const SCROLL_SCRIPT = (maxHeight) => `
  new Promise((resolve) => {
    const step = Math.max(300, Math.round(window.innerHeight * 0.8));
    let y = 0;
    const tick = () => {
      const total = Math.min(document.documentElement.scrollHeight, ${maxHeight});
      y += step;
      window.scrollTo(0, y);
      if (y < total) setTimeout(tick, 220);
      else setTimeout(() => { window.scrollTo(0, 0); resolve(document.documentElement.scrollHeight); }, 400);
    };
    tick();
  })
`;


async function capture(browser, row, deviceName, quality) {
  const device = DEVICES[deviceName];
  const url = row.page_url || row.requested_url;
  const { targetId } = await browser.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await browser.send("Target.attachToTarget", { targetId, flatten: true });
  const send = (method, params) => browser.send(method, params, sessionId);
  const network = trackNetwork(browser, sessionId);
  try {
    await send("Page.enable");
    await send("Network.enable");
    await send("Emulation.setDeviceMetricsOverride", {
      width: device.width,
      height: device.height,
      deviceScaleFactor: device.scale,
      mobile: device.mobile,
    });
    await send("Emulation.setUserAgentOverride", { userAgent: device.userAgent, acceptLanguage: "ko-KR,ko;q=0.9,en;q=0.7" });
    if (device.mobile) await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });

    const loaded = browser.waitFor("Page.loadEventFired", sessionId, 30_000);
    const navigation = await send("Page.navigate", { url });
    if (navigation.errorText) throw new Error(navigation.errorText);
    await loaded;
    await network.idle(1500, 15_000);
    await withTimeout(send("Runtime.evaluate", { expression: SCROLL_SCRIPT(device.maxHeight), awaitPromise: true }), 25_000, "scroll").catch(() => {});
    await network.idle(1200, 10_000);
    await sleep(800);

    const metrics = await send("Page.getLayoutMetrics");
    const contentHeight = Math.ceil(metrics.cssContentSize?.height || device.height);
    const height = Math.max(device.height, Math.min(contentHeight, device.maxHeight));
    const shot = await send("Page.captureScreenshot", {
      format: "webp",
      quality,
      captureBeyondViewport: true,
      clip: { x: 0, y: 0, width: device.width, height, scale: 1 },
    });
    const buffer = Buffer.from(shot.data, "base64");
    const [width, pixelHeight] = webpSize(buffer);
    const capturedAt = new Date();
    const day = capturedAt.toISOString().slice(0, 10);
    const relative = `layouts/${row.category}/${row.slug}/${day}-${deviceName}.webp`;
    await mkdir(path.join(ROOT, path.dirname(relative)), { recursive: true });
    await writeFile(path.join(ROOT, relative), buffer);
    return {
      category: row.category,
      slug: row.slug,
      company: row.company,
      device: deviceName,
      path: relative,
      page_url: url,
      width: width || device.width * device.scale,
      height: pixelHeight || height * device.scale,
      viewport_width: device.width,
      content_height: contentHeight,
      truncated: contentHeight > device.maxHeight,
      bytes: buffer.length,
      sha256: createHash("sha256").update(buffer).digest("hex"),
      captured_at: capturedAt.toISOString(),
    };
  } finally {
    network.stop();
    await browser.send("Target.closeTarget", { targetId }).catch(() => {});
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const rows = JSON.parse(await readFile(MANIFEST, "utf8"));
  let layouts = [];
  try {
    layouts = JSON.parse(await readFile(LAYOUTS_JSON, "utf8"));
  } catch {
    layouts = [];
  }

  const done = new Set(layouts.map((entry) => `${entry.slug}:${entry.device}`));
  let targets = rows.filter((row) => /^https?:/i.test(row.page_url || row.requested_url || ""));
  if (args.company.length) targets = targets.filter((row) => args.company.includes(row.company) || args.company.includes(row.slug));
  if (args.category.length) targets = targets.filter((row) => args.category.includes(row.category));
  if (args.limit) targets = targets.slice(0, args.limit);

  const jobs = targets.flatMap((row) => args.devices.map((device) => ({ row, device })))
    .filter(({ row, device }) => !args.skipExisting || !done.has(`${row.slug}:${device}`));

  const browser = await Browser.launch();
  console.log(`Browser: ${browser.executable}`);
  console.log(`Capturing ${jobs.length} screenshots with ${args.workers} workers`);

  let saveChain = Promise.resolve();
  const save = (entry) => {
    layouts = layouts.filter((item) => item.path !== entry.path);
    layouts.push(entry);
    layouts.sort((a, b) => a.category.localeCompare(b.category) || a.slug.localeCompare(b.slug) || a.captured_at.localeCompare(b.captured_at));
    const snapshot = JSON.stringify(layouts, null, 2);
    saveChain = saveChain.then(() => writeFile(LAYOUTS_JSON, snapshot, "utf8"));
    return saveChain;
  };

  let cursor = 0;
  let finished = 0;
  let failed = 0;
  const worker = async () => {
    while (cursor < jobs.length) {
      const { row, device } = jobs[cursor++];
      try {
        const entry = await withTimeout(capture(browser, row, device, args.quality), 90_000, "capture");
        await save(entry);
        finished += 1;
        console.log(`[${finished + failed}/${jobs.length}] ${row.company} ${device} ${entry.width}x${entry.height} ${Math.round(entry.bytes / 1024)}KB`);
      } catch (error) {
        failed += 1;
        console.log(`[${finished + failed}/${jobs.length}] ${row.company} ${device} failed: ${error.message}`);
      }
    }
  };
  await Promise.all(Array.from({ length: args.workers }, worker));
  await saveChain;
  await browser.close();
  console.log(`Done. saved=${finished} failed=${failed}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
