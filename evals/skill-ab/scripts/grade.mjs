#!/usr/bin/env node
// Scores one generated project against rubric.md and writes <runDir>/grade.json.
//
//   node evals/skill-ab/scripts/grade.mjs <runDir> [--tools <dir with playwright-core>]
//
// The run directory must contain agent-done.json (written by run-eval.mjs) or
// pass --task a|b|c. Screenshots go to <runDir>/.eval-shots/ for manual review.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { createRequire } from "node:module";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../../..");
const args = process.argv.slice(2);
const runDir = resolve(args[0]);
const option = (name) => {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? undefined : args[index + 1];
};
const meta = existsSync(join(runDir, "agent-done.json"))
  ? JSON.parse(readFileSync(join(runDir, "agent-done.json"), "utf8"))
  : { id: relative(process.cwd(), runDir), task: option("task") };
const task = meta.task;
if (!["a", "b", "c"].includes(task)) throw new Error("unknown task");
const toolsDir = resolve(option("tools") ?? join(runDir, "../../tools"));
const { chromium } = createRequire(join(toolsDir, "package.json"))("playwright-core");
const shots = join(runDir, ".eval-shots");
mkdirSync(shots, { recursive: true });

const testIds = {
  a: ["product-card", "model-fallback"],
  b: ["chapter-1", "chapter-2", "chapter-3"],
  c: ["wave-text"],
}[task];
const result = { ...meta, scores: {}, details: {}, notes: [] };

// ---------- static ----------
const verify = spawnSync(
  process.execPath,
  [join(repoRoot, "skills/viselora-dom-webgl/scripts/verify-consumer.mjs"), runDir],
  { encoding: "utf8" },
);
const violations = (verify.stderr || "")
  .split("\n")
  .filter((line) => line.startsWith("- "))
  .map((line) => line.slice(2));
const sources = collectSources(join(runDir, "src"));
const privateImports = [];
let usesViselora = false;
for (const file of sources) {
  const text = readFileSync(file, "utf8");
  for (const [, spec] of text.matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)) {
    if (/^@viselora\/(dom-webgl|scroll-adapters)(\/react)?$/.test(spec)) usesViselora = true;
    else if (spec.startsWith("@viselora/") || /node_modules\/|packages\/[^/]+\/src/.test(spec))
      privateImports.push(`${relative(runDir, file)}: ${spec}`);
  }
}
const importViolations = violations.filter((line) => /public Viselora entrypoint/.test(line));
result.details.static = {
  verifyConsumerPassed: verify.status === 0,
  verifyConsumerViolations: violations,
  privateImports,
  usesViselora,
  sourceFiles: sources.map((file) => relative(runDir, file)),
};
result.scores.public_imports = importViolations.length || privateImports.length ? 0 : 1;

// ---------- typecheck / build ----------
const bin = (name) => join(runDir, "node_modules/.bin", name);
const tsconfig = readJsonSafe(join(runDir, "tsconfig.json"));
const tscArgs =
  tsconfig?.references && Array.isArray(tsconfig.files) && !tsconfig.files.length
    ? ["-b"]
    : ["--noEmit", "-p", "tsconfig.json"];
const tsc = spawnSync(bin("tsc"), tscArgs, { cwd: runDir, encoding: "utf8", timeout: 240_000 });
result.scores.typecheck = tsc.status === 0 ? 1 : 0;
result.details.typecheck = { args: tscArgs, output: tail(tsc.stdout + tsc.stderr) };
const build = spawnSync(bin("vite"), ["build", "--outDir", ".eval-dist", "--emptyOutDir", "--logLevel", "warn"], {
  cwd: runDir,
  encoding: "utf8",
  timeout: 300_000,
});
result.scores.build = build.status === 0 ? 1 : 0;
result.details.build = { output: tail(build.stdout + build.stderr) };

// ---------- SSR ----------
const ssr = spawnSync(process.execPath, [join(scriptDir, "ssr-check.mjs"), runDir, testIds.join(",")], {
  cwd: runDir,
  encoding: "utf8",
  timeout: 90_000,
});
let ssrResult;
try {
  ssrResult = JSON.parse(ssr.stdout.trim().split("\n").pop());
} catch {
  ssrResult = { ok: false, error: tail(ssr.stdout + ssr.stderr) || "ssr check timed out" };
}
result.details.ssr = ssrResult;
result.scores.ssr_safe = ssrResult.ok ? 1 : 0;

// ---------- browser ----------
writeHarness();
const port = await freePort();
const server = spawn(bin("vite"), ["--port", String(port), "--strictPort", "--host", "127.0.0.1"], {
  cwd: runDir,
  detached: true,
  stdio: ["ignore", "pipe", "pipe"],
});
let serverLog = "";
server.stdout.on("data", (chunk) => (serverLog += chunk));
server.stderr.on("data", (chunk) => (serverLog += chunk));
const origin = `http://127.0.0.1:${port}`;
// Headless Chrome occasionally drops the connection under load. Retry the
// whole browser phase with a fresh browser; a page that crashes the browser on
// every attempt still scores 0 for the browser-based items.
const browserScores = ["single_canvas", "dom_fallback", "cleanup", "scroll_resize", "pixels", "task_effect"];
let browser;
try {
  await waitForServer(origin);
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    for (const key of browserScores) delete result.scores[key];
    browser = await chromium.launch({
      executablePath:
        process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      headless: true,
      args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
    });
    let disconnected = false;
    browser.on("disconnected", () => (disconnected = true));
    try {
      if (attempt === 1) await warmUp();
      const browserChecks = { a: gradeModelCard, b: gradeScrollStory, c: gradeTextWave }[task];
      await browserChecks();
      await gradeCleanup();
      result.details.browserAttempts = attempt;
      break;
    } catch (error) {
      result.notes.push(
        `browser attempt ${attempt} failed${disconnected ? " (browser disconnected)" : ""}: ${String(error?.message ?? error).slice(0, 300)}`,
      );
      if (attempt === 3) for (const key of browserScores) result.scores[key] = 0;
    } finally {
      await browser.close().catch(() => {});
    }
  }
} catch (error) {
  result.notes.push(`browser phase crashed: ${String(error?.stack ?? error).slice(0, 800)}`);
} finally {
  try {
    process.kill(-server.pid, "SIGTERM");
  } catch {}
}
result.details.serverLog = tail(serverLog, 1500);
for (const key of [
  "single_canvas",
  "dom_fallback",
  "ssr_safe",
  "cleanup",
  "scroll_resize",
  "public_imports",
  "typecheck",
  "build",
  "pixels",
  "task_effect",
])
  result.scores[key] = round(result.scores[key] ?? 0);
result.total = round(Object.values(result.scores).reduce((sum, value) => sum + value, 0));
writeFileSync(join(runDir, "grade.json"), JSON.stringify(result, null, 2));
console.log(`${meta.id}: total ${result.total}/10`, JSON.stringify(result.scores));

// ---------- task A ----------
async function gradeModelCard() {
  const card = '[data-testid="product-card"]';
  const fallback = '[data-testid="model-fallback"]';
  const page = await openPage();
  await page.goto(origin, { waitUntil: "load" });
  await sleep(5000);
  const checkpoints = [];
  await centerOn(page, card);
  await sleep(2000);
  checkpoints.push(await snapshot(page));
  const first = await measure(page, card);
  await page.screenshot({ path: join(shots, "a-normal.png") });
  result.scores.pixels = first.mask.count >= 150 ? 1 : 0;
  result.scores.task_effect = first.mask.count >= 150 && first.inside ? 1 : 0;

  await page.evaluate(() => window.scrollBy(0, 200));
  await sleep(1500);
  const scrolled = await measure(page, card);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await sleep(1200);
  await centerOn(page, card);
  await sleep(1500);
  const reversed = await measure(page, card);
  await page.setViewportSize({ width: 820, height: 1000 });
  await sleep(1500);
  await centerOn(page, card);
  await sleep(1500);
  const resized = await measure(page, card);
  checkpoints.push(await snapshot(page));
  await page.screenshot({ path: join(shots, "a-resized.png") });
  result.scores.scroll_resize = mean([scrolled.inside, reversed.inside, resized.inside]);
  result.scores.single_canvas = singleCanvas(checkpoints);
  result.details.browser = { first, scrolled, reversed, resized, checkpoints, errors: page.errors };
  await page.context().close();

  const fallbackCase = async (name, options, wait) => {
    const view = await openPage(options);
    await view.goto(origin, { waitUntil: "load" });
    await sleep(wait);
    await centerOn(view, card);
    await sleep(1000);
    const state = {
      fallback: await visible(view, fallback),
      card: await visible(view, card),
      snapshot: await snapshot(view),
      errors: view.errors,
    };
    await view.screenshot({ path: join(shots, `a-${name}.png`) });
    await view.context().close();
    state.ok = state.fallback.visible && state.card.visible && state.snapshot.bodyTextLength > 40;
    return state;
  };
  const pending = await fallbackCase("glb-pending", { glb: "pending" }, 3000);
  const missing = await fallbackCase("glb-404", { glb: "404" }, 4000);
  const noWebGL = await fallbackCase("no-webgl", { disableWebGL: true }, 3000);
  result.scores.dom_fallback = mean([pending.ok, missing.ok, noWebGL.ok]);
  result.details.fallback = { pending, missing, noWebGL };

  async function measure(view, selector) {
    const target = await visible(view, selector);
    const mask = analyze(await grid(view));
    return { rect: target.rect, mask: summary(mask), inside: centroidInside(mask, target.rect, 0.1) };
  }
}

// ---------- task B ----------
async function gradeScrollStory() {
  const chapters = [1, 2, 3].map((n) => `[data-testid="chapter-${n}"]`);
  const page = await openPage();
  await page.goto(origin, { waitUntil: "load" });
  await sleep(3000);
  const checkpoints = [await snapshot(page)];
  const down = [];
  for (const [index, chapter] of chapters.entries()) {
    await centerOn(page, chapter);
    await sleep(2500);
    down.push(await grid(page));
    await page.screenshot({ path: join(shots, `b-down-${index + 1}.png`) });
  }
  checkpoints.push(await snapshot(page));
  const d12 = changed(down[0], down[1]);
  const d23 = changed(down[1], down[2]);
  const counts = down.map((g) => analyze(g).count);
  result.scores.pixels = Math.max(...counts) >= 150 ? 1 : 0;
  result.scores.task_effect = mean([d12 >= 0.05, d23 >= 0.05]);

  await centerOn(page, chapters[1]);
  await sleep(2500);
  const up2 = await grid(page);
  await centerOn(page, chapters[0]);
  await sleep(2500);
  const up1 = await grid(page);
  const r2 = changed(down[1], up2);
  const r1 = changed(down[0], up1);
  await centerOn(page, chapters[1]);
  await page.setViewportSize({ width: 820, height: 1000 });
  await sleep(2500);
  const narrow = analyze(await grid(page)).count;
  checkpoints.push(await snapshot(page));
  await page.screenshot({ path: join(shots, "b-resized.png") });
  await page.setViewportSize({ width: 1280, height: 800 });
  await sleep(1500);
  await centerOn(page, chapters[1]);
  await sleep(2500);
  const back2 = await grid(page);
  const rr = changed(down[1], back2);
  const restored = (distance, reference) => reference >= 0.05 && distance <= Math.max(0.01, 0.2 * reference);
  result.scores.scroll_resize = mean([
    restored(r2, Math.min(d12, d23)),
    restored(r1, d12),
    narrow >= 150 && restored(rr, Math.min(d12, d23)),
  ]);
  result.scores.single_canvas = singleCanvas(checkpoints);
  result.details.browser = { d12, d23, counts, r1, r2, rr, narrow, checkpoints, errors: page.errors };

  const normalVisible = [];
  for (const chapter of chapters) {
    await centerOn(page, chapter);
    normalVisible.push((await visible(page, chapter)).visible);
  }
  await page.context().close();
  const view = await openPage({ disableWebGL: true });
  await view.goto(origin, { waitUntil: "load" });
  await sleep(3000);
  const noWebGL = [];
  for (const chapter of chapters) {
    await centerOn(view, chapter);
    noWebGL.push(await visible(view, chapter));
  }
  const noWebGLSnapshot = await snapshot(view);
  await view.screenshot({ path: join(shots, "b-no-webgl.png") });
  await view.context().close();
  result.scores.dom_fallback = mean([
    normalVisible.every(Boolean),
    noWebGL.every((state) => state.visible) && noWebGLSnapshot.bodyTextLength > 40,
  ]);
  result.details.fallback = { normalVisible, noWebGL, noWebGLSnapshot, errors: view.errors };
}

// ---------- task C ----------
async function gradeTextWave() {
  const heading = '[data-testid="wave-text"]';
  const copy = "Words that ripple through light";
  const page = await openPage();
  await page.goto(origin, { waitUntil: "load" });
  await sleep(3500);
  const checkpoints = [await snapshot(page)];
  const target = await visible(page, heading);
  const g1 = await grid(page);
  await sleep(500);
  const g2 = await grid(page);
  await page.screenshot({ path: join(shots, "c-normal.png") });
  const mask = analyze(g1);
  const animated = changed(g1, g2, expand(target.rect, 0.15));
  const alignment = await textAlignment(page, heading, g1);
  const aligned = alignment.aligned;
  result.scores.pixels = mask.count >= 150 ? 1 : 0;
  result.scores.task_effect = mean([mask.count >= 150 && aligned, animated >= 0.005]);

  await page.evaluate(() => window.scrollTo(0, 120));
  await sleep(1500);
  const scrolled = await alignedNow(page);
  await page.setViewportSize({ width: 700, height: 900 });
  await sleep(2500);
  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(1500);
  const resized = await alignedNow(page);
  resized.relayout = resized.mask.bbox ? resized.mask.bbox.width <= resized.rect.width * 1.25 + 40 : false;
  checkpoints.push(await snapshot(page));
  await page.screenshot({ path: join(shots, "c-resized.png") });
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await sleep(1200);
  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(1500);
  const reversed = await alignedNow(page);
  result.scores.scroll_resize = mean([scrolled.inside, resized.inside && resized.relayout, reversed.inside]);
  result.scores.single_canvas = singleCanvas(checkpoints);
  const semantic = await visible(page, heading);
  result.details.browser = {
    mask: summary(mask),
    target: target.rect,
    animated,
    alignment,
    scrolled,
    resized,
    reversed,
    checkpoints,
    errors: page.errors,
  };
  await page.context().close();

  const view = await openPage({ disableWebGL: true });
  await view.goto(origin, { waitUntil: "load" });
  await sleep(3000);
  const noWebGL = await visible(view, heading);
  const noWebGLSnapshot = await snapshot(view);
  await view.screenshot({ path: join(shots, "c-no-webgl.png") });
  await view.context().close();
  const semanticOk = semantic.displayed && !semantic.ariaHidden && semantic.text.includes(copy);
  result.scores.dom_fallback = mean([
    semanticOk,
    noWebGL.visible && noWebGL.text.includes(copy) && noWebGLSnapshot.bodyTextLength > 20,
  ]);
  result.details.fallback = { semantic, noWebGL, noWebGLSnapshot, errors: view.errors };

  async function alignedNow(view) {
    const state = await visible(view, heading);
    const rect = clipToViewport(state.rect, view.viewportSize());
    const g = await grid(view);
    const current = analyze(g);
    const alignment = await textAlignment(view, heading, g);
    return { rect, mask: summary(current), alignment, inside: alignment.aligned };
  }
}

// ---------- cleanup (all tasks) ----------
async function gradeCleanup() {
  const page = await openPage();
  await page.goto(`${origin}/eval-harness.html`, { waitUntil: "load" });
  await page.waitForFunction(() => window.__harnessReady === true, null, { timeout: 30_000 });
  await sleep(500);
  const baseline = await snapshot(page);
  await page.evaluate(() => window.__mount());
  await sleep(3000);
  const mounted = await snapshot(page);
  for (let cycle = 0; cycle < 2; cycle += 1) {
    await page.evaluate(() => window.__unmount());
    await sleep(1200);
    await page.evaluate(() => window.__mount());
    await sleep(2500);
  }
  await page.evaluate(() => window.__unmount());
  await sleep(1500);
  const unmounted = await snapshot(page);
  await sleep(1000);
  const idle = await snapshot(page);
  const errorsBeforeRemount = page.errors.length;
  await page.evaluate(() => window.__mount());
  await sleep(3000);
  const remounted = await snapshot(page);
  const checks = {
    canvasRemoved: unmounted.canvasCount === 0,
    contextsReleased: unmounted.liveContexts <= 0,
    listenersReleased: unmounted.listeners <= baseline.listeners && unmounted.observed <= baseline.observed,
    loopStopped: idle.raf - unmounted.raf <= 2,
    remountWorks:
      remounted.canvasCount === 1 &&
      remounted.liveContexts === 1 &&
      page.errors.length === errorsBeforeRemount,
  };
  // Nothing to release if the page never created a canvas: do not award
  // vacuous cleanup points.
  result.scores.cleanup = mounted.canvasCount > 0 ? mean(Object.values(checks)) : 0;
  result.details.cleanup = {
    checks,
    baseline,
    mounted,
    unmounted,
    rafAfterUnmount: idle.raf - unmounted.raf,
    remounted,
    errors: page.errors,
  };
  if (mounted.canvasCount !== 1) result.scores.single_canvas = Math.min(result.scores.single_canvas ?? 0, 0.5);
  await page.context().close();
}

// ---------- helpers ----------
async function openPage({ disableWebGL = false, glb } = {}) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  if (disableWebGL) await context.addInitScript(() => (window.__evalDisableWebGL = true));
  await context.addInitScript({ path: join(scriptDir, "instrument.js") });
  const page = await context.newPage();
  page.errors = [];
  page.on("crash", () => page.errors.push("page crashed"));
  page.on("pageerror", (error) => page.errors.push(`pageerror: ${String(error.message).slice(0, 300)}`));
  page.on("console", (message) => {
    if (message.type() === "error") page.errors.push(`console: ${message.text().slice(0, 300)}`);
  });
  if (glb === "pending") await page.route("**/*.glb", () => {});
  if (glb === "404") await page.route("**/*.glb", (route) => route.fulfill({ status: 404, body: "missing" }));
  return page;
}

async function warmUp() {
  // Let Vite discover and pre-bundle dependencies before measuring, so an
  // optimizer-triggered full reload does not land in the middle of a check.
  const page = await openPage();
  for (const path of ["/", "/eval-harness.html"]) {
    await page.goto(origin + path, { waitUntil: "load" }).catch(() => {});
    await sleep(6000);
  }
  await page.context().close();
}

function snapshot(page) {
  return page.evaluate(() => window.__evalSnapshot());
}
function visible(page, selector) {
  return page.evaluate((s) => window.__evalVisible(s), selector);
}
function grid(page) {
  return page.evaluate(() => window.__evalGrid(2));
}
function centerOn(page, selector) {
  return page.evaluate((s) => {
    const element = document.querySelector(s);
    if (!element) return;
    const rect = element.getBoundingClientRect();
    window.scrollTo(0, Math.max(0, window.scrollY + rect.top + rect.height / 2 - window.innerHeight / 2));
  }, selector);
}

function singleCanvas(checkpoints) {
  return mean(checkpoints.map((s) => s.canvasCount === 1 && s.liveContexts === 1));
}

// Task C alignment: cross-correlate WebGL foreground cells around the heading
// with the DOM heading's own glyph cells; the best offset must be within 6px. Glyphs are isolated by screenshotting the
// page (canvas hidden) with and without a magenta clone of the heading. Decorative
// WebGL layers elsewhere on the page therefore do not affect the result.
async function textAlignment(page, selector, g) {
  const box = await page.evaluate((s) => {
    const element = document.querySelector(s);
    if (!element) return null;
    const r = element.getBoundingClientRect();
    const padX = Math.max(8, r.width * 0.05);
    const padY = Math.max(8, r.height * 0.15);
    const left = Math.max(0, Math.floor(r.left - padX));
    const top = Math.max(0, Math.floor(r.top - padY));
    const right = Math.min(innerWidth, Math.ceil(r.right + padX));
    const bottom = Math.min(innerHeight, Math.ceil(r.bottom + padY));
    return right > left && bottom > top ? { x: left, y: top, width: right - left, height: bottom - top } : null;
  }, selector);
  if (!box || !g) return { aligned: false, reason: "heading or canvas missing" };
  // The runtime may own the heading's opacity, so overlay a magenta clone at
  // the same box instead of restyling the original.
  const hideCanvas = (hidden) =>
    page.evaluate((hidden) => {
      document.querySelectorAll("canvas").forEach((c) =>
        hidden ? c.style.setProperty("visibility", "hidden", "important") : c.style.removeProperty("visibility"),
      );
    }, hidden);
  await hideCanvas(true);
  const hidden = (await page.screenshot({ clip: box })).toString("base64");
  await page.evaluate((s) => {
    const element = document.querySelector(s);
    const r = element.getBoundingClientRect();
    const clone = element.cloneNode(true);
    clone.removeAttribute("data-testid");
    clone.id = "__eval_glyph_clone";
    element.after(clone);
    for (const [name, value] of [
      ["position", "fixed"],
      ["left", `${r.left}px`],
      ["top", `${r.top}px`],
      ["width", `${r.width}px`],
      ["margin", "0"],
      ["opacity", "1"],
      ["visibility", "visible"],
      ["color", "#ff00ff"],
      ["-webkit-text-fill-color", "#ff00ff"],
      ["text-shadow", "none"],
      ["transform", "none"],
      ["transition", "none"],
      ["animation", "none"],
      ["z-index", "2147483647"],
    ])
      clone.style.setProperty(name, value, "important");
    clone.querySelectorAll("*").forEach((child) => {
      child.style.setProperty("color", "#ff00ff", "important");
      child.style.setProperty("-webkit-text-fill-color", "#ff00ff", "important");
      child.style.setProperty("opacity", "1", "important");
    });
  }, selector);
  const shown = (await page.screenshot({ clip: box })).toString("base64");
  await page.evaluate(() => document.getElementById("__eval_glyph_clone")?.remove());
  await hideCanvas(false);
  const cell = g.cell;
  const glyphs = await page.evaluate(
    async ({ shown, hidden, cols, rows }) => {
      const read = async (b64) => {
        const image = new Image();
        image.src = `data:image/png;base64,${b64}`;
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = cols;
        canvas.height = rows;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        context.imageSmoothingQuality = "high";
        context.drawImage(image, 0, 0, cols, rows);
        return context.getImageData(0, 0, cols, rows).data;
      };
      const a = await read(shown);
      const b = await read(hidden);
      const mask = [];
      for (let i = 0; i < a.length; i += 4)
        mask.push(Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 60 ? 1 : 0);
      return mask;
    },
    { shown, hidden, cols: Math.round(box.width / cell), rows: Math.round(box.height / cell) },
  );
  const cols = Math.round(box.width / cell);
  const rows = Math.round(box.height / cell);
  const ox = Math.floor(box.x / cell);
  const oy = Math.floor(box.y / cell);
  const glyphCount = glyphs.reduce((sum, value) => sum + value, 0);
  // WebGL foreground in the heading box plus a 64px margin, against that
  // region's own dominant colour.
  const margin = 32;
  const rx = Math.max(0, ox - margin);
  const ry = Math.max(0, oy - margin);
  const rcols = Math.min(g.cols, ox + cols + margin) - rx;
  const rrows = Math.min(g.rows, oy + rows + margin) - ry;
  const region = { cell, cols: rcols, rows: rrows, data: [] };
  for (let row = 0; row < rrows; row += 1)
    for (let col = 0; col < rcols; col += 1) {
      const i = ((ry + row) * g.cols + rx + col) * 4;
      region.data.push(g.data[i], g.data[i + 1], g.data[i + 2], g.data[i + 3]);
    }
  const webgl = foreground(region);
  const density = webgl.reduce((sum, value) => sum + value, 0) / webgl.length;
  // Cross-correlate the DOM glyph mask with the WebGL mask; the best offset
  // tells whether the WebGL text sits on top of the DOM text.
  const glyphCells = [];
  for (let row = 0; row < rows; row += 1)
    for (let col = 0; col < cols; col += 1) if (glyphs[row * cols + col]) glyphCells.push([col + ox - rx, row + oy - ry]);
  const scoreAt = (dx, dy) => {
    let hits = 0;
    for (const [x, y] of glyphCells) {
      const wx = x + dx;
      const wy = y + dy;
      if (wx >= 0 && wy >= 0 && wx < rcols && wy < rrows && webgl[wy * rcols + wx]) hits += 1;
    }
    return glyphCells.length ? hits / glyphCells.length : 0;
  };
  let best = { dx: 0, dy: 0, score: -1 };
  for (let dy = -16; dy <= 16; dy += 1)
    for (let dx = -margin; dx <= margin; dx += 1) {
      const score = scoreAt(dx, dy);
      if (score > best.score + 1e-9 || (Math.abs(score - best.score) <= 1e-9 && Math.hypot(dx, dy) < Math.hypot(best.dx, best.dy)))
        best = { dx, dy, score };
    }
  return {
    box,
    glyphCells: glyphCount,
    webglDensity: round(density, 3),
    zeroOffsetScore: round(scoreAt(0, 0), 3),
    bestOffsetPx: { x: best.dx * cell, y: best.dy * cell },
    bestScore: round(best.score, 3),
    aligned:
      glyphCount >= 50 && density < 0.6 && best.score >= 0.6 && Math.abs(best.dx) <= 3 && Math.abs(best.dy) <= 3,
  };
}

function foreground(g) {
  const { background } = analyze(g);
  const mask = [];
  for (let i = 0; i < g.data.length; i += 4) {
    const distance =
      Math.abs(g.data[i] - background[0]) + Math.abs(g.data[i + 1] - background[1]) + Math.abs(g.data[i + 2] - background[2]) + Math.abs(g.data[i + 3] - background[3]);
    mask.push(distance > 64 ? 1 : 0);
  }
  return mask;
}

// Non-background mask of a canvas grid. Background = most frequent quantised colour.
function analyze(g) {
  if (!g) return { count: 0, cell: 2, cells: [] };
  const buckets = new Map();
  for (let i = 0; i < g.data.length; i += 4) {
    const key = ((g.data[i] >> 4) << 12) | ((g.data[i + 1] >> 4) << 8) | ((g.data[i + 2] >> 4) << 4) | (g.data[i + 3] >> 4);
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  const bgKey = [...buckets.entries()].sort((x, y) => y[1] - x[1])[0][0];
  const bg = [(bgKey >> 12) & 15, (bgKey >> 8) & 15, (bgKey >> 4) & 15, bgKey & 15].map((v) => v * 16 + 8);
  let count = 0;
  let sx = 0;
  let sy = 0;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -1;
  let maxY = -1;
  for (let i = 0; i < g.data.length; i += 4) {
    const distance =
      Math.abs(g.data[i] - bg[0]) + Math.abs(g.data[i + 1] - bg[1]) + Math.abs(g.data[i + 2] - bg[2]) + Math.abs(g.data[i + 3] - bg[3]);
    if (distance <= 64) continue;
    const cellIndex = i / 4;
    const x = (cellIndex % g.cols) * g.cell;
    const y = Math.floor(cellIndex / g.cols) * g.cell;
    count += 1;
    sx += x;
    sy += y;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return {
    count,
    background: bg,
    centroid: count ? { x: sx / count, y: sy / count } : null,
    bbox: count ? { left: minX, top: minY, width: maxX - minX + g.cell, height: maxY - minY + g.cell } : null,
  };
}

function summary(mask) {
  return { count: mask.count, centroid: mask.centroid, bbox: mask.bbox, background: mask.background };
}

// Fraction of grid cells (optionally within a viewport rect) whose colour changed.
function changed(a, b, rect) {
  if (!a || !b || a.cols !== b.cols || a.rows !== b.rows) return 1;
  let total = 0;
  let moved = 0;
  for (let row = 0; row < a.rows; row += 1)
    for (let col = 0; col < a.cols; col += 1) {
      const x = col * a.cell;
      const y = row * a.cell;
      if (rect && (x < rect.left || y < rect.top || x > rect.left + rect.width || y > rect.top + rect.height)) continue;
      const i = (row * a.cols + col) * 4;
      const distance =
        Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2]) + Math.abs(a.data[i + 3] - b.data[i + 3]);
      total += 1;
      if (distance > 48) moved += 1;
    }
  return total ? round(moved / total, 4) : 0;
}

function centroidInside(mask, rect, pad) {
  if (!mask.centroid || !rect) return false;
  const area = expand(rect, pad);
  const { x, y } = mask.centroid;
  return x >= area.left && x <= area.left + area.width && y >= area.top && y <= area.top + area.height;
}

function expand(rect, pad) {
  return {
    left: rect.left - rect.width * pad,
    top: rect.top - rect.height * pad,
    width: rect.width * (1 + 2 * pad),
    height: rect.height * (1 + 2 * pad),
  };
}

function clipToViewport(rect, viewport) {
  const left = Math.max(0, rect.left);
  const top = Math.max(0, rect.top);
  const right = Math.min(viewport.width, rect.left + rect.width);
  const bottom = Math.min(viewport.height, rect.top + rect.height);
  return right > left && bottom > top ? { left, top, width: right - left, height: bottom - top } : null;
}

function writeHarness() {
  const main = existsSync(join(runDir, "src/main.tsx")) ? readFileSync(join(runDir, "src/main.tsx"), "utf8") : "";
  const sideEffects = [...main.matchAll(/^import\s+["']([^"']+)["'];?/gm)]
    .map(([, spec]) => (spec.startsWith(".") ? `./src/${spec.replace(/^\.\//, "")}` : spec))
    .map((spec) => `import "${spec}";`)
    .join("\n");
  writeFileSync(
    join(runDir, "eval-harness.html"),
    `<!doctype html><html lang="en"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head><body><div id="root"></div><script type="module" src="/eval-harness.jsx"></script></body></html>\n`,
  );
  writeFileSync(
    join(runDir, "eval-harness.jsx"),
    `import { createElement } from "react";
import { createRoot } from "react-dom/client";
import * as Page from "./src/App";
${sideEffects}
const App = Page.App ?? Page.default;
// React registers one document-level listener on its first root; do that
// before the grader records its listener baseline.
createRoot(document.createElement("div")).unmount();
let root = null;
const container = document.getElementById("root");
window.__mount = () => {
  if (root) return;
  root = createRoot(container);
  root.render(createElement(App));
};
window.__unmount = () => {
  root?.unmount();
  root = null;
};
window.__harnessReady = true;
`,
  );
}

function collectSources(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? collectSources(path) : /\.[cm]?[jt]sx?$/.test(name) ? [path] : [];
  });
}

async function waitForServer(url) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await sleep(500);
  }
  throw new Error(`dev server did not start: ${serverLog.slice(-500)}`);
}

function freePort() {
  return new Promise((done) => {
    const probe = createServer();
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address();
      probe.close(() => done(port));
    });
  });
}

function readJsonSafe(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8").replace(/^\s*\/\/.*$/gm, ""));
  } catch {
    return undefined;
  }
}

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + Number(Boolean(value)), 0) / values.length : 0;
}
function round(value, digits = 2) {
  return Math.round(value * 10 ** digits) / 10 ** digits;
}
function tail(text, size = 2500) {
  return (text ?? "").slice(-size);
}
function sleep(ms) {
  return new Promise((done) => setTimeout(done, ms));
}
