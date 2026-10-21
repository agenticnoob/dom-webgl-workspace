import { cpSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

/** `threeMinor` selects the Three.js release line, e.g. "0.186". */
export function createExternalConsumerFixture(
  fixtureRoot,
  coreTarball,
  adaptersTarball,
  threeMinor = "0.184",
) {
  if (!/^0\.\d+$/.test(threeMinor))
    throw new Error(`Expected a Three.js minor such as 0.186, received ${threeMinor}`);
  const root = resolve(fixtureRoot);
  for (const dir of [
    "src",
    "scripts",
    "test",
    "e2e",
    "evidence",
    "public/models",
  ])
    mkdirSync(resolve(root, dir), { recursive: true });
  const write = (path, text) => writeFileSync(resolve(root, path), text);
  const json = (path, value) =>
    write(path, JSON.stringify(value, null, 2) + "\n");
  json("package.json", {
    name: "viselora-external-consumer-fixture",
    private: true,
    version: "0.0.0",
    type: "module",
    scripts: {
      typecheck: "tsc --noEmit",
      test: "vitest run",
      build: "vite build",
      "test:browser": "playwright test --project=chromium",
    },
    dependencies: {
      "@viselora/dom-webgl": `file:${resolve(coreTarball)}`,
      "@viselora/scroll-adapters": `file:${resolve(adaptersTarball)}`,
      "@react-three/fiber": "^9.8.1",
      react: "~19.2.0",
      "react-dom": "~19.2.0",
      three: `^${threeMinor}.0`,
    },
    devDependencies: {
      "@types/react": "^19.2.0",
      "@types/react-dom": "^19.2.0",
      "@types/three": `^${threeMinor}.0`,
      "@types/node": "^24.0.0",
      "@playwright/test": "^1.55.0",
      "@types/pngjs": "^6.0.5",
      pngjs: "^7.0.0",
      typescript: "^5.8.3",
      vite: "^7.3.5",
      vitest: "^3.2.4",
    },
  });
  json("tsconfig.json", {
    compilerOptions: {
      target: "ES2022",
      lib: ["ES2022", "DOM", "DOM.Iterable"],
      module: "ESNext",
      moduleResolution: "Bundler",
      strict: true,
      jsx: "react-jsx",
      skipLibCheck: true,
      noEmit: true,
      types: ["vitest/globals", "node"],
    },
    include: ["src", "test", "e2e"],
  });
  write(
    "index.html",
    '<!doctype html><html><head><title>Viselora R3F consumer</title><link rel="icon" href="data:,"></head><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>',
  );
  write("src/App.tsx", appSource);
  write("src/main.tsx", mainSource);
  write("scripts/verify-ssr.mjs", ssrSource);
  write("test/runtime.test.tsx", runtimeTestSource);
  write(
    "vitest.config.ts",
    'import { defineConfig } from "vitest/config";\nexport default defineConfig({ test: { include: ["test/**/*.test.tsx"] } });\n',
  );
  write("playwright.config.ts", playwrightConfigSource);
  write("e2e/capabilities.spec.ts", browserTestSource);
  cpSync(
    resolve(process.cwd(), "apps/example/public/models/hero.glb"),
    resolve(root, "public/models/hero.glb"),
  );
  return root;
}

const appSource = `import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import { Mesh } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { createDOMTextTexture, type RuntimeDebugState } from "@viselora/dom-webgl";
import { WebGLRuntime, WebGLTarget, useDOMTarget, useWebGLRuntime } from "@viselora/dom-webgl/react";
import { createScrollEffectProgressStore } from "@viselora/scroll-adapters";

export const fixtureProgress = createScrollEffectProgressStore();
function TitleProjection() {
  const target = useDOMTarget("title");
  const runtime = useWebGLRuntime();
  const mesh = useRef<Mesh>(null);
  const [snapshot, setSnapshot] = useState<ReturnType<typeof createDOMTextTexture>>();
  useEffect(() => {
    if (!target) return;
    const next = createDOMTextTexture(target.element);
    setSnapshot(next);
    return () => { runtime.setTargetReady("title", false, target); next.dispose(); };
  }, [runtime, target]);
  useEffect(() => {
    if (snapshot && target) runtime.setTargetReady("title", true, target);
  }, [runtime, snapshot, target]);
  useFrame(({ size, viewport }) => {
    if (!mesh.current || !target) return;
    const rect = target.rect;
    mesh.current.position.set((rect.left + rect.width / 2 - size.width / 2) * viewport.width / size.width, (size.height / 2 - rect.top - rect.height / 2) * viewport.height / size.height, 0);
    mesh.current.scale.set(rect.width * viewport.width / size.width, rect.height * viewport.height / size.height, 1);
  });
  return snapshot ? <mesh ref={mesh}><planeGeometry /><meshBasicMaterial map={snapshot.texture} transparent depthTest={false} /></mesh> : null;
}
function Model() {
  const asset = useLoader(GLTFLoader, "/models/hero.glb");
  const object = useMemo(() => asset.scene.clone(true), [asset]);
  useEffect(() => {
    object.traverse((child) => {
      if (child instanceof Mesh) child.onAfterRender = () => { window.__fixtureModelReady = true; };
    });
  }, [object]);
  return <primitive object={object} position={[-1.6, -1.1, 0]} scale={0.6} dispose={null} />;
}
function Scene() {
  const runtime = useWebGLRuntime();
  const mesh = useRef<Mesh>(null);
  useFrame(() => {
    if (mesh.current) mesh.current.rotation.y = runtime.progress.get("fixture.progress") * Math.PI;
  });
  return <>
    <ambientLight intensity={1.4} /><directionalLight position={[3, 4, 5]} intensity={3} />
    <TitleProjection />
    <mesh ref={mesh} position={[0, -0.2, 0]} rotation={[0.4, 0.3, 0]}><boxGeometry args={[1.1, 1.1, 1.1]} /><meshStandardMaterial color="#ff6633" /></mesh>
    <mesh position={[1.6, -1, 0]}><sphereGeometry args={[0.6, 32, 16]} /><meshPhysicalMaterial color="#33bbff" roughness={0.15} metalness={0.25} clearcoat={1} /></mesh>
    <Suspense fallback={null}><Model /></Suspense>
  </>;
}
export function App({ onDebugStateChange }: { onDebugStateChange?: (state: RuntimeDebugState) => void }) {
  return <WebGLRuntime progressSignals={fixtureProgress.source} onDebugStateChange={onDebugStateChange} canvas={{ camera: { position: [0, 0, 5], fov: 50 }, gl: { preserveDrawingBuffer: true } }} scene={<Scene />}>
    <WebGLTarget id="title" hideWhenReady><h1 style={{ position: "fixed", left: 32, top: 70, margin: 0, fontSize: 32, color: "white" }}>Semantic DOM projection</h1></WebGLTarget>
  </WebGLRuntime>;
}
`;

const mainSource = `import { useState } from "react";
import { createRoot } from "react-dom/client";
import type { RuntimeDebugState } from "@viselora/dom-webgl";
import { App, fixtureProgress } from "./App";
declare global { interface Window { __fixtureDebug?: RuntimeDebugState; __fixtureModelReady?: boolean; __fixtureSetProgress(value: number): void } }
document.body.style.cssText = "margin:0;background:#05070a;min-height:100vh";
window.__fixtureSetProgress = (value) => fixtureProgress.set("fixture.progress", value);
function Fixture() {
  const [mounted, setMounted] = useState(true);
  return <><button style={{ position: "fixed", zIndex: 10, top: 8, left: 8 }} onClick={() => setMounted((value) => !value)}>{mounted ? "Unmount runtime" : "Remount runtime"}</button>{mounted && <App onDebugStateChange={(state) => { window.__fixtureDebug = state; }} />}</>;
}
const root = document.getElementById("root");
if (!root) throw new Error("Missing root");
createRoot(root).render(<Fixture />);
`;

const ssrSource = `delete globalThis.window;
delete globalThis.document;
const core = await import("@viselora/dom-webgl");
const react = await import("@viselora/dom-webgl/react");
const adapters = await import("@viselora/scroll-adapters");
const adaptersReact = await import("@viselora/scroll-adapters/react");
const { createElement } = await import("react");
const { renderToString } = await import("react-dom/server");
for (const value of [core.createDOMTextTexture, react.WebGLRuntime, react.WebGLTarget, adapters.createScrollEffectProgressStore, adaptersReact.WebGLScrollRuntime]) {
  if (typeof value !== "function") throw new Error("Missing public React runtime export");
}
const html = renderToString(createElement(react.WebGLRuntime, null, createElement("h1", null, "Server content")));
if (!html.includes("Server content")) throw new Error("SSR semantic DOM missing");
if ("createWebGLRuntime" in core) throw new Error("Retired imperative renderer export remains");
console.log("SSR imports and semantic DOM OK");
`;

const runtimeTestSource = `import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { WebGLRuntime, WebGLTarget } from "@viselora/dom-webgl/react";
import { createScrollEffectProgressStore } from "@viselora/scroll-adapters";
describe("installed consumer", () => {
  it("preserves semantic content in SSR", () => {
    const html = renderToString(createElement(WebGLRuntime, { children: createElement(WebGLTarget, { id: "title", hideWhenReady: true, children: createElement("h1", null, "Accessible title") }) }));
    expect(html).toContain("Accessible title");
    expect(html).not.toContain("opacity:0");
  });
  it("shares reversible progress without requiring a renderer", () => {
    const store = createScrollEffectProgressStore();
    store.set("chapter", 0.9); expect(store.source.get("chapter")).toBe(0.9);
    store.set("chapter", 0.2); expect(store.source.get("chapter")).toBe(0.2);
  });
});
`;

const playwrightConfigSource = `import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";
const systemChromium = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? (existsSync(systemChromium) ? systemChromium : undefined);
export default defineConfig({
  testDir: "./e2e", timeout: 60000, workers: 1,
  webServer: { command: "npx vite --host 127.0.0.1 --port 4179", port: 4179, reuseExistingServer: false },
  use: { baseURL: "http://127.0.0.1:4179", viewport: { width: 960, height: 720 } },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], launchOptions: executablePath ? { executablePath } : {} } }],
});
`;

const browserTestSource = `import { writeFileSync } from "node:fs";
import { test, expect } from "@playwright/test";
import { PNG } from "pngjs";
function changedPixels(left: Buffer, right: Buffer) {
  const a = PNG.sync.read(left), b = PNG.sync.read(right); let count = 0;
  for (let i = 0; i < a.data.length; i += 4) if (Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i+1] - b.data[i+1]) + Math.abs(a.data[i+2] - b.data[i+2]) > 20) count++;
  return count;
}
test("R3F native objects, DOM fallback, progress, and remount", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  const model = page.waitForResponse((response) => response.url().endsWith("/models/hero.glb") && response.ok());
  await page.goto("/"); await model;
  await expect(page.locator("canvas")).toHaveCount(1);
  await expect.poll(() => page.evaluate(() => window.__fixtureModelReady)).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__fixtureDebug?.targets[0]?.ready)).toBe(true);
  await expect(page.locator("h1")).toHaveCSS("opacity", "0");
  await expect.poll(async () => {
    const png = PNG.sync.read(await page.locator("canvas").screenshot()); let colored = 0;
    for (let i = 0; i < png.data.length; i += 4) if (png.data[i] > 50 || png.data[i+1] > 50 || png.data[i+2] > 50) colored++;
    return colored;
  }).toBeGreaterThan(2000);
  const before = await page.locator("canvas").screenshot();
  await page.evaluate(() => window.__fixtureSetProgress(0.7));
  await expect.poll(async () => changedPixels(before, await page.locator("canvas").screenshot())).toBeGreaterThan(500);
  await page.evaluate(() => window.__fixtureSetProgress(0));
  await expect.poll(async () => changedPixels(before, await page.locator("canvas").screenshot())).toBeLessThan(100);
  await page.screenshot({ path: "evidence/native-scene.png" });
  await page.evaluate(() => { const gl = document.querySelector("canvas")?.getContext("webgl2"); gl?.getExtension("WEBGL_lose_context")?.loseContext(); });
  await expect(page.locator("h1")).toHaveCSS("opacity", "1");
  await page.getByRole("button", { name: "Unmount runtime" }).click();
  await expect(page.locator("canvas")).toHaveCount(0);
  await page.getByRole("button", { name: "Remount runtime" }).click();
  await expect(page.locator("canvas")).toHaveCount(1);
  await expect(page.locator("h1")).toHaveCSS("opacity", "0");
  expect(errors).toEqual([]);
  writeFileSync("evidence/browser-capabilities.json", JSON.stringify({ oneCanvas: true, nativeGLTF: true, nativePhysicalMaterial: true, renderedPixels: true, reversibleProgress: true, contextLossFallback: true, remount: true, errors }, null, 2));
});
`;
