// Shared Chrome DevTools Protocol helpers for the collector scripts.
// Uses an installed Chrome or Edge, so no extra packages are needed.

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

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

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function withTimeout(promise, ms, label) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timed out`)), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

export class Browser {
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


// Resolve once the page has had no new network activity for `quiet` ms.
// Requests pending for more than 8s (analytics beacons, long polling) are ignored.
export function trackNetwork(browser, sessionId) {
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

export function webpSize(buffer) {
  const chunk = buffer.toString("ascii", 12, 16);
  if (chunk === "VP8X") return [1 + buffer.readUIntLE(24, 3), 1 + buffer.readUIntLE(27, 3)];
  if (chunk === "VP8L") {
    const bits = buffer.readUInt32LE(21);
    return [1 + (bits & 0x3fff), 1 + ((bits >> 14) & 0x3fff)];
  }
  if (chunk === "VP8 ") return [buffer.readUInt16LE(26) & 0x3fff, buffer.readUInt16LE(28) & 0x3fff];
  return [0, 0];
}
