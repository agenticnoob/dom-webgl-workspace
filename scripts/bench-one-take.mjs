#!/usr/bin/env node
// Runs the one-take benchmark page (apps/example/bench.html) in Chrome and
// records frame timing per chapter. See apps/example/docs/benchmark.md.
//
//   npm run build
//   node scripts/bench-one-take.mjs --serve [--variant sections] [--gpu low-power] [--throttle 4]
//
// Without --headless Chrome uses the real GPU; --headless uses SwiftShader and
// only checks that the page runs. Results are written to output/bench/.
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const appDir = join(root, "apps/example");

const { values: options } = parseArgs({
  options: {
    url: { type: "string" },
    serve: { type: "boolean", default: false },
    port: { type: "string", default: "4173" },
    duration: { type: "string", default: "60" },
    throttle: { type: "string", default: "1" },
    variant: { type: "string", default: "naive" },
    gpu: { type: "string", default: "default" },
    "max-dpr": { type: "string", default: "2" },
    width: { type: "string", default: "1440" },
    height: { type: "string", default: "900" },
    scale: { type: "string", default: "2" },
    headless: { type: "boolean", default: false },
    label: { type: "string", default: "" },
    diagnostics: { type: "boolean", default: false },
    fixture: { type: "string", default: "none" },
    out: { type: "string", default: join(root, "output/bench") },
  },
});

const duration = Number(options.duration);
const throttle = Number(options.throttle);
const baseUrl = options.url ?? `http://127.0.0.1:${options.port}/bench.html`;
const query = new URLSearchParams({
  variant: options.variant,
  gpu: options.gpu,
  maxDpr: options["max-dpr"],
  duration: String(duration),
  ...(options.diagnostics ? { diagnostics: "1" } : {}),
  ...(options.fixture !== "none" ? { fixture: options.fixture } : {}),
});
const pageUrl = `${baseUrl}?${query}`;

const playwright = loadPlaywright();
const server = options.serve ? await startPreview(baseUrl) : undefined;
const executablePath = [
  process.env.CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].find((path) => path && existsSync(path));
const browser = await playwright.chromium.launch({
  executablePath,
  headless: options.headless,
  args: options.headless
    ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
    : [
        "--ignore-gpu-blocklist",
        "--disable-renderer-backgrounding",
        "--disable-background-timer-throttling",
        "--disable-backgrounding-occluded-windows",
      ],
});

const errors = [];
const warnings = [];
try {
  const context = await browser.newContext({
    viewport: { width: Number(options.width), height: Number(options.height) },
    deviceScaleFactor: Number(options.scale),
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
    if (message.type() === "warning" && message.text().startsWith("[viselora]"))
      warnings.push(message.text());
  });

  console.log(`Loading ${pageUrl}`);
  await page.goto(pageUrl, { waitUntil: "load" });
  await page.waitForFunction(
    () => window.__vbench?.snapshot().phase === "ready",
    null,
    { timeout: 120_000, polling: 500 },
  );
  if (throttle > 1) {
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: throttle });
  }
  await page.waitForTimeout(3_000);
  console.log(`Running for ${duration}s (CPU throttle ${throttle}x)`);
  await page.evaluate((seconds) => window.__vbench.start(seconds), duration);
  await page.waitForFunction(
    () => window.__vbench?.snapshot().phase === "done",
    null,
    { timeout: (duration + 60) * 1000, polling: 1000 },
  );
  const result = await page.evaluate(() => window.__vbench.snapshot().result);

  const report = {
    label: options.label,
    date: new Date().toISOString(),
    commit: git(["rev-parse", "--short", "HEAD"]),
    dirty: git(["status", "--porcelain"]) !== "",
    browser: browser.version(),
    headless: options.headless,
    cpuThrottle: throttle,
    deviceScaleFactor: Number(options.scale),
    url: pageUrl,
    errors,
    warnings,
    result,
  };
  mkdirSync(options.out, { recursive: true });
  const stamp = report.date.replace(/[:.]/g, "-");
  const name = [
    stamp,
    options.label || result.variant,
    options.gpu,
    `dpr${options["max-dpr"]}`,
    `cpu${throttle}x`,
    ...(options.headless ? ["swiftshader"] : []),
  ].join("-");
  const file = join(options.out, `${name}.json`);
  writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);
  printReport(report);
  console.log(`\nSaved ${file}`);
} finally {
  await browser.close();
  server?.kill();
}

function printReport({ result, errors: pageErrors, warnings: runtimeWarnings }) {
  console.log(`\nRenderer: ${result.renderer}`);
  console.log(
    `Viewport ${result.viewport.width}x${result.viewport.height} @ device ${result.devicePixelRatio}, canvas DPR ${result.dpr}, tier ${result.tier}${result.tierChanges.length ? ` (${result.tierChanges.join(", ")})` : ""}${result.assetsTimedOut ? " (assets timed out)" : ""}`,
  );
  const columns = ["label", "fps", "p50Ms", "p95Ms", "maxMs", "longFrames", "programsAdded", "texturesAdded", "stallFrames", "maxCalls", "longTasks"];
  const rows = [result.summary.overall, ...result.summary.chapters];
  const widths = columns.map((column) =>
    Math.max(column.length, ...rows.map((row) => String(row[column]).length)),
  );
  const line = (cells) => cells.map((cell, index) => String(cell).padStart(widths[index])).join("  ");
  console.log(line(columns));
  for (const row of rows) console.log(line(columns.map((column) => row[column])));
  if (runtimeWarnings.length) console.log(`\nRuntime warnings (${runtimeWarnings.length}):\n${runtimeWarnings.join("\n")}`);
  if (pageErrors.length) console.log(`\nPage errors (${pageErrors.length}):\n${pageErrors.join("\n")}`);
}

function loadPlaywright() {
  const tools = join(root, "output/bench-tools");
  for (const base of [root, tools]) {
    try {
      return createRequire(join(base, "package.json"))("playwright-core");
    } catch {
      // Try the next location, then install into the ignored tools folder.
    }
  }
  mkdirSync(tools, { recursive: true });
  if (!existsSync(join(tools, "package.json")))
    writeFileSync(join(tools, "package.json"), '{ "name": "bench-tools", "private": true }\n');
  const install = spawnSync(
    "npm",
    ["install", "--no-audit", "--no-fund", "playwright-core@^1.55.0"],
    { cwd: tools, stdio: "inherit" },
  );
  if (install.status !== 0) throw new Error("Installing playwright-core failed.");
  return createRequire(join(tools, "package.json"))("playwright-core");
}

async function startPreview(url) {
  if (!existsSync(join(appDir, "dist/bench.html")))
    throw new Error("apps/example/dist/bench.html is missing; run `npm run build` first.");
  const { hostname, port } = new URL(url);
  const child = spawn(
    "npx",
    ["vite", "preview", "--host", hostname, "--port", port, "--strictPort"],
    { cwd: appDir, stdio: "ignore" },
  );
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(url)).ok) return child;
    } catch {
      // The preview server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  child.kill();
  throw new Error(`Preview server did not answer at ${url}.`);
}

function git(args) {
  try {
    return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}
