#!/usr/bin/env node
// Browser check for a running Viselora page (dev server or preview build).
//
//   node <skill-dir>/scripts/browser-check.mjs <url> [options]
//
//   --follow <selector>    The centroid of the WebGL pixels in view must sit on
//                          this element after load, scroll, reverse scroll and
//                          resize (repeatable; assumes it is the main WebGL
//                          content while centred in the viewport).
//   --fallback <selector>  Element that must stay visible without WebGL and
//                          while --block requests hang or fail (repeatable).
//   --block <glob>         Request pattern for the fallback checks, e.g.
//                          "**/*.glb" (repeatable).
//   --deterministic        The scene is a pure function of scroll position:
//                          the same position must restore the same pixels.
//   --out <dir>            Screenshot directory (default .viselora-check).
//   --wait <ms>            Settle time after load (default 3000).
//
// Requires `playwright-core` (or `playwright`) resolvable from the current
// directory and a Chrome/Chromium: CHROME_PATH, a system Chrome, or Playwright's
// own browser. It reads canvas pixels; it does not replace a human visual
// review, real-GPU/mobile checks, or a remount test of the consumer component.
import { existsSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";

const valueOptions = new Set(["follow", "fallback", "block", "out", "wait"]);
const options = { follow: [], fallback: [], block: [], out: [], wait: [] };
const positional = [];
let deterministic = false;
const argv = process.argv.slice(2);
for (let index = 0; index < argv.length; index += 1) {
  const value = argv[index];
  const name = value.startsWith("--") ? value.slice(2) : undefined;
  if (name === "deterministic") deterministic = true;
  else if (name && valueOptions.has(name) && index + 1 < argv.length) options[name].push(argv[++index]);
  else if (name) usage(`Unknown or incomplete option: ${value}`);
  else positional.push(value);
}
const url = positional[0];
if (!url) usage("Missing page URL");
const follow = options.follow;
const fallbacks = options.fallback;
const blocks = options.block;
const out = resolve(options.out[0] ?? ".viselora-check");
const settle = Number(options.wait[0] ?? 3000);
mkdirSync(out, { recursive: true });

let playwright;
for (const name of ["playwright-core", "playwright"]) {
  try {
    playwright = createRequire(join(process.cwd(), "package.json"))(name);
    break;
  } catch {}
}
if (!playwright) {
  console.error("Install a browser driver first: npm install --save-dev playwright-core");
  process.exit(2);
}
const executablePath = [
  process.env.CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
].find((path) => path && existsSync(path));
const browser = await playwright.chromium.launch({
  executablePath,
  headless: true,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});

const results = [];
let maxForeground = 0;
const check = (name, ok, detail) => {
  results.push({ name, ok: Boolean(ok), detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail === undefined ? "" : ` ${JSON.stringify(detail)}`}`);
};

try {
  // ---- normal load: one canvas, pixels, following targets ----
  const page = await open();
  await page.goto(url, { waitUntil: "load" });
  await sleep(settle);
  const loaded = await page.evaluate(() => window.__visCheck.snapshot());
  check("one canvas with one live WebGL context", loaded.canvases === 1 && loaded.contexts === 1, loaded);
  await grid(page);
  await page.screenshot({ path: join(out, "loaded.png") });

  for (const selector of follow) {
    const states = {};
    await centre(page, selector);
    states.loaded = await onTarget(page, selector);
    await page.evaluate(() => window.scrollBy(0, 200));
    await sleep(800);
    states.scrolled = await onTarget(page, selector);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await sleep(800);
    await centre(page, selector);
    states.reversed = await onTarget(page, selector);
    await page.setViewportSize({ width: 820, height: 1000 });
    await sleep(1500);
    await centre(page, selector);
    states.resized = await onTarget(page, selector);
    await page.setViewportSize({ width: 1280, height: 800 });
    await sleep(800);
    check(`WebGL follows ${selector} (load, scroll, reverse, resize)`, Object.values(states).every(Boolean), states);
  }

  if (deterministic) {
    const at = async (fraction) => {
      await page.evaluate((f) => {
        const max = document.documentElement.scrollHeight - innerHeight;
        window.scrollTo(0, Math.round(max * f));
      }, fraction);
      await sleep(1200);
      return grid(page);
    };
    const top = await at(0);
    const middle = await at(0.5);
    const bottom = await at(1);
    const middleAgain = await at(0.5);
    const topAgain = await at(0);
    const span = changed(top, bottom);
    check("scene changes with scroll", span >= 0.05, { changedTopToBottom: span });
    const drift = Math.max(changed(middle, middleAgain), changed(top, topAgain));
    check("same scroll position restores the same frame", drift <= 0.01, { changed: drift });
    await page.setViewportSize({ width: 820, height: 1000 });
    await sleep(1200);
    await page.setViewportSize({ width: 1280, height: 800 });
    const afterResize = await at(0.5);
    check("resize keeps the scroll mapping", changed(middle, afterResize) <= 0.01, {
      changed: changed(middle, afterResize),
    });
  }
  // Counted over every frame sampled above, so content below the fold counts.
  check("WebGL canvas draws pixels", maxForeground >= 150, { foregroundCells: maxForeground });
  check("no page errors during normal load", page.errors.length === 0, page.errors.slice(0, 5));
  await page.context().close();

  // ---- fallback paths ----
  const cases = [["webgl-unavailable", { disableWebGL: true }]];
  if (blocks.length) cases.push(["requests-pending", { block: "hang" }], ["requests-failing", { block: "fail" }]);
  for (const [name, options] of cases) {
    const view = await open(options);
    await view.goto(url, { waitUntil: "load" });
    await sleep(settle);
    const text = await view.evaluate(() => document.body.innerText.trim().length);
    const states = [];
    for (const selector of fallbacks) {
      await centre(view, selector);
      states.push({ selector, ...(await view.evaluate((s) => window.__visCheck.visible(s), selector)) });
    }
    await view.screenshot({ path: join(out, `${name}.png`) });
    check(`${name}: semantic DOM stays readable`, text > 0 && states.every((state) => state.visible), states);
    await view.context().close();
  }
} finally {
  await browser.close();
}
const failed = results.filter((result) => !result.ok).length;
console.log(`${results.length - failed}/${results.length} browser checks passed; screenshots in ${out} (do not commit them).`);
process.exitCode = failed ? 1 : 0;

async function open({ disableWebGL = false, block } = {}) {
  // block: "hang" leaves matching requests pending; "fail" answers 404.
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  await context.addInitScript(instrument, { disableWebGL });
  const page = await context.newPage();
  page.errors = [];
  page.on("pageerror", (error) => page.errors.push(String(error.message).slice(0, 200)));
  for (const pattern of block ? blocks : []) {
    await page.route(pattern, (route) =>
      block === "fail" ? route.fulfill({ status: 404, body: "blocked by browser-check" }) : undefined,
    );
  }
  return page;
}

async function onTarget(page, selector) {
  const rect = await page.evaluate((s) => window.__visCheck.visible(s).rect, selector);
  const mask = analyze(await grid(page));
  if (!rect || !mask.centroid) return false;
  const padX = rect.width * 0.1;
  const padY = rect.height * 0.1;
  const { x, y } = mask.centroid;
  return x >= rect.left - padX && x <= rect.left + rect.width + padX && y >= rect.top - padY && y <= rect.top + rect.height + padY;
}

async function centre(page, selector) {
  await page.evaluate((s) => {
    const element = document.querySelector(s);
    if (!element) return;
    const rect = element.getBoundingClientRect();
    window.scrollTo(0, Math.max(0, scrollY + rect.top + rect.height / 2 - innerHeight / 2));
  }, selector);
  await sleep(1000);
}

async function grid(page) {
  const sample = await page.evaluate(() => window.__visCheck.grid(2));
  maxForeground = Math.max(maxForeground, analyze(sample).count);
  return sample;
}

// Foreground cells of a 2px grid: everything that differs from the most common colour.
function analyze(g) {
  if (!g) return { count: 0, centroid: null };
  const buckets = new Map();
  for (let i = 0; i < g.data.length; i += 4) {
    const key = g.data.slice(i, i + 4).map((v) => v >> 4).join(",");
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  const background = [...buckets.entries()].sort((a, b) => b[1] - a[1])[0][0].split(",").map((v) => v * 16 + 8);
  let count = 0;
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < g.data.length; i += 4) {
    let distance = 0;
    for (let c = 0; c < 4; c += 1) distance += Math.abs(g.data[i + c] - background[c]);
    if (distance <= 64) continue;
    count += 1;
    sx += ((i / 4) % g.cols) * g.cell;
    sy += Math.floor(i / 4 / g.cols) * g.cell;
  }
  return { count, centroid: count ? { x: sx / count, y: sy / count } : null };
}

function changed(a, b) {
  if (!a || !b || a.data.length !== b.data.length) return 1;
  let moved = 0;
  for (let i = 0; i < a.data.length; i += 4) {
    let distance = 0;
    for (let c = 0; c < 4; c += 1) distance += Math.abs(a.data[i + c] - b.data[i + c]);
    if (distance > 48) moved += 1;
  }
  return Math.round((moved / (a.data.length / 4)) * 10_000) / 10_000;
}

function usage(message) {
  console.error(`${message}\nUsage: browser-check.mjs <url> [--follow sel] [--fallback sel] [--block glob] [--deterministic] [--out dir] [--wait ms]`);
  process.exit(2);
}

function sleep(ms) {
  return new Promise((done) => setTimeout(done, ms));
}

// Runs in the page before any application script.
function instrument({ disableWebGL }) {
  const glCanvases = new Set();
  const lost = new WeakSet();
  const getContext = HTMLCanvasElement.prototype.getContext;
  const seen = new WeakSet();
  HTMLCanvasElement.prototype.getContext = function (type, attributes) {
    const isGL = /webgl/i.test(String(type));
    if (isGL && disableWebGL) return null;
    // preserveDrawingBuffer lets the checker read the last rendered frame.
    const context = getContext.call(this, type, isGL ? { ...attributes, preserveDrawingBuffer: true } : attributes);
    if (isGL && context && !seen.has(context)) {
      seen.add(context);
      glCanvases.add(this);
      this.addEventListener("webglcontextlost", () => lost.add(this));
      this.addEventListener("webglcontextrestored", () => lost.delete(this));
    }
    return context;
  };
  window.__visCheck = {
    snapshot: () => ({
      canvases: document.querySelectorAll("canvas").length,
      contexts: [...glCanvases].filter((canvas) => canvas.isConnected && !lost.has(canvas)).length,
    }),
    grid(cell) {
      const canvas = [...glCanvases].find((c) => c.isConnected);
      if (!canvas) return null;
      const cols = Math.ceil(innerWidth / cell);
      const rows = Math.ceil(innerHeight / cell);
      const scratch = document.createElement("canvas");
      scratch.width = cols;
      scratch.height = rows;
      const context = scratch.getContext("2d", { willReadFrequently: true });
      const r = canvas.getBoundingClientRect();
      context.drawImage(canvas, r.left / cell, r.top / cell, r.width / cell, r.height / cell);
      return { cell, cols, rows, data: Array.from(context.getImageData(0, 0, cols, rows).data) };
    },
    visible(selector) {
      const element = document.querySelector(selector);
      if (!element) return { exists: false, visible: false, rect: null };
      const box = element.getBoundingClientRect();
      let opacity = 1;
      let hidden = false;
      for (let node = element; node instanceof Element; node = node.parentElement) {
        const style = getComputedStyle(node);
        opacity *= Number(style.opacity);
        if (style.display === "none" || style.visibility === "hidden") hidden = true;
      }
      return {
        exists: true,
        visible: !hidden && opacity > 0.05 && box.width > 0 && box.height > 0,
        opacity,
        rect: { left: box.left, top: box.top, width: box.width, height: box.height },
      };
    },
  };
}
