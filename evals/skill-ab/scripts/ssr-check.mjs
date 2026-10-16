#!/usr/bin/env node
// Server-renders a generated project's `src/App.tsx` with its own Vite and
// React in plain Node (no DOM globals). Prints one JSON line.
//
//   node ssr-check.mjs <projectDir> <testid>[,<testid>...]
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(process.argv[2]);
const testIds = (process.argv[3] ?? "").split(",").filter(Boolean);
const require = createRequire(join(root, "package.json"));
const rejections = [];
process.on("unhandledRejection", (reason) => {
  rejections.push(String(reason?.stack ?? reason).slice(0, 400));
});

const result = { ok: false };
let server;
try {
  const { createServer } = await import(
    pathToFileURL(require.resolve("vite")).href
  );
  server = await createServer({
    root,
    logLevel: "error",
    appType: "custom",
    server: { middlewareMode: true, hmr: false, watch: null },
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  const mod = await server.ssrLoadModule("/src/App.tsx");
  const App = mod.App ?? mod.default;
  if (typeof App !== "function" && typeof App !== "object")
    throw new Error("src/App.tsx exports no App component");
  const { createElement } = require("react");
  const { renderToString } = require("react-dom/server");
  const html = renderToString(createElement(App));
  result.htmlLength = html.length;
  result.missingTestIds = testIds.filter(
    (id) => !html.includes(`data-testid="${id}"`),
  );
  result.ok = result.missingTestIds.length === 0;
  if (!result.ok) result.error = `SSR HTML lacks ${result.missingTestIds}`;
} catch (error) {
  result.error = String(error?.stack ?? error).slice(0, 1200);
} finally {
  await new Promise((done) => setTimeout(done, 300));
  result.unhandledRejections = rejections;
  await server?.close().catch(() => {});
  console.log(JSON.stringify(result));
  process.exit(0);
}
