// Capture full-page PC and mobile screenshots of each official homepage.
// Uses an installed Chrome or Edge through the DevTools protocol, so no extra packages are needed.
//
//   node capture_layouts.mjs --workers 3
//   node capture_layouts.mjs --company 롯데렌터카 --devices pc
//   node capture_layouts.mjs --category 장기렌트_리스 --skip-existing

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

const BROWSERS = [
  process.env.LAYOUT_BROWSER,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].filter(Boolean);

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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function withTimeout(promise, ms, label) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timed out`)), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

class Browser {
  static async launch() {
    const executable = BROWSERS.find((candidate) => existsSync(candidate));
    if (!executable) throw new Error("Chrome or Edge was not found. Set LAYOUT_BROWSER to the browser executable.");
    const profile = await mkdtemp(path.join(tmpdir(), "layout-capture-"));
    const child = spawn(executable, [
      "--headless=new",
      "--remote-debugging-port=0",
      `--user-data-dir=${profile}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-extensions",
      "--disable-sync",
      "--hide-scrollbars",
      "--mute-audio",
      "--lang=ko-KR",
      "about:blank",
    ], { stdio: "ignore" });

    const portFile = path.join(profile, "DevToolsActivePort");
    let endpoint = "";
    for (let attempt = 0; attempt < 100 && !endpoint; attempt += 1) {
      await sleep(150);
      try {
        const [port, wsPath] = (await readFile(portFile, "utf8")).trim().split(/\r?\n/);
        if (port && wsPath) endpoint = `ws://127.0.0.1:${port}${wsPath}`;
      } catch {
        // The browser has not written its port yet.
      }
    }
    if (!endpoint) throw new Error("The browser did not start DevTools.");
    const browser = new Browser(child, profile, executable);
    await browser.connect(endpoint);
    return browser;
  }

  constructor(child, profile, executable) {
    this.child = child;
    this.profile = profile;
    this.executable = executable;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Set();
  }

  connect(endpoint) {
    return new Promise((resolve, reject) => {
      this.socket = new WebSocket(endpoint);
      this.socket.addEventListener("open", resolve, { once: true });
      this.socket.addEventListener("error", reject, { once: true });
      this.socket.addEventListener("message", (event) => this.onMessage(JSON.parse(event.data)));
      this.socket.addEventListener("close", () => {
        this.pending.forEach(({ reject: fail }) => fail(new Error("Browser connection closed")));
        this.pending.clear();
      });
    });
  }

  onMessage(message) {
    if (message.id && this.pending.has(message.id)) {
      const { resolve, reject } = this.pending.get(message.id);
      this.pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result);
      return;
    }
    this.listeners.forEach((listener) => listener(message));
  }

  send(method, params = {}, sessionId) {
    const id = this.nextId++;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify(payload));
    });
  }

  waitFor(method, sessionId, timeout) {
    return new Promise((resolve) => {
      const listener = (message) => {
        if (message.method === method && message.sessionId === sessionId) done(true);
      };
      const timer = setTimeout(() => done(false), timeout);
      const done = (value) => {
        clearTimeout(timer);
        this.listeners.delete(listener);
        resolve(value);
      };
      this.listeners.add(listener);
    });
  }

  async close() {
    try {
      await this.send("Browser.close");
    } catch {
      this.child.kill();
    }
    await sleep(500);
    await rm(this.profile, { recursive: true, force: true }).catch(() => {});
  }
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

function webpSize(buffer) {
  const chunk = buffer.toString("ascii", 12, 16);
  if (chunk === "VP8X") return [1 + buffer.readUIntLE(24, 3), 1 + buffer.readUIntLE(27, 3)];
  if (chunk === "VP8L") {
    const bits = buffer.readUInt32LE(21);
    return [1 + (bits & 0x3fff), 1 + ((bits >> 14) & 0x3fff)];
  }
  if (chunk === "VP8 ") return [buffer.readUInt16LE(26) & 0x3fff, buffer.readUInt16LE(28) & 0x3fff];
  return [0, 0];
}

// Resolve once the page has had no new network activity for `quiet` ms.
// Requests pending for more than 8s (analytics beacons, long polling) are ignored.
function trackNetwork(browser, sessionId) {
  const inflight = new Map();
  let lastActivity = Date.now();
  const listener = (message) => {
    if (message.sessionId !== sessionId) return;
    const id = message.params?.requestId;
    if (message.method === "Network.requestWillBeSent") {
      inflight.set(id, Date.now());
      lastActivity = Date.now();
    } else if (message.method === "Network.loadingFinished" || message.method === "Network.loadingFailed") {
      inflight.delete(id);
      lastActivity = Date.now();
    }
  };
  browser.listeners.add(listener);
  return {
    async idle(quiet = 1200, max = 15_000) {
      const started = Date.now();
      while (Date.now() - started < max) {
        const now = Date.now();
        const active = [...inflight.values()].filter((time) => now - time < 8000).length;
        if (active === 0 && now - lastActivity >= quiet) return;
        await sleep(200);
      }
    },
    stop: () => browser.listeners.delete(listener),
  };
}

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
