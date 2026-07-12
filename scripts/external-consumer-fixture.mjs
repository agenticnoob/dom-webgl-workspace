import { cpSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

export function createExternalConsumerFixture(
  fixtureRoot,
  coreTarball,
  adaptersTarball,
) {
  const root = resolve(fixtureRoot);
  mkdirSync(resolve(root, "src"), { recursive: true });
  mkdirSync(resolve(root, "scripts"), { recursive: true });
  mkdirSync(resolve(root, "test"), { recursive: true });
  mkdirSync(resolve(root, "e2e"), { recursive: true });
  mkdirSync(resolve(root, "evidence"), { recursive: true });
  mkdirSync(resolve(root, "public/models"), { recursive: true });

  writeJson(root, "package.json", {
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
      gsap: "^3.15.0",
      lenis: "^1.3.23",
      react: "^19.1.0",
      "react-dom": "^19.1.0",
    },
    devDependencies: {
      "@types/react": "^19.1.8",
      "@types/react-dom": "^19.1.6",
      "@playwright/test": "^1.55.0",
      "@types/pngjs": "^6.0.5",
      jsdom: "^26.1.0",
      pngjs: "^7.0.0",
      typescript: "^5.8.3",
      vite: "^7.3.5",
      vitest: "^3.2.4",
    },
  });

  writeJson(root, "tsconfig.json", {
    compilerOptions: {
      target: "ES2022",
      lib: ["ES2022", "DOM", "DOM.Iterable"],
      module: "ESNext",
      moduleResolution: "Bundler",
      strict: true,
      jsx: "react-jsx",
      skipLibCheck: true,
      noEmit: true,
      types: ["vitest/globals"],
    },
    include: ["src", "test"],
  });

  writeText(
    root,
    "index.html",
    '<!doctype html>\n<html><head><link rel="icon" href="data:,"></head><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>\n',
  );
  writeText(root, "src/effects.ts", effectsSource);
  writeText(root, "src/App.tsx", appSource);
  writeText(root, "src/main.tsx", mainSource);
  writeText(root, "playwright.config.ts", playwrightConfigSource);
  writeText(root, "e2e/capabilities.spec.ts", browserTestSource);
  writeText(root, "scripts/verify-ssr.mjs", ssrSource);
  writeText(root, "vitest.config.ts", vitestConfigSource);
  writeText(root, "test/WebGLRendererMock.ts", rendererMockSource);
  writeText(root, "test/runtime.test.tsx", runtimeTestSource);
  cpSync(
    resolve(process.cwd(), "apps/example/public/models/hero.glb"),
    resolve(root, "public/models/hero.glb"),
  );

  return root;
}

function writeJson(root, path, value) {
  writeText(root, path, `${JSON.stringify(value, null, 2)}\n`);
}

function writeText(root, path, content) {
  writeFileSync(resolve(root, path), content);
}

const effectsSource = `import {
  defineWebGLEffect,
  defineWebGLSceneObjectEffect,
} from "@viselora/dom-webgl";

export const fixtureEffect = defineWebGLEffect({
  kind: "fixture.surface",
  source: "dom/element",
  update(ctx) {
    ctx.object.opacity = 1;
    ctx.object.visible = true;
  },
});

export const fixtureSceneObjectEffect = defineWebGLSceneObjectEffect({
  kind: "fixture.sceneObject",
  source: "stage/box",
  update(ctx) {
    ctx.object.opacity = 1;
    ctx.object.visible = true;
  },
});

export const fixtureModelEffect = defineWebGLSceneObjectEffect({
  kind: "fixture.modelCapability",
  source: "model/glb",
  schedule: "frame",
  setup(ctx) {
    const model = ctx.object.model;
    if (!model) return {};
    const positions = model.sampling.vertices({ maxPoints: 500 });
    const pointLayer = model.points.create({
      positions,
      color: "#63e6ff",
      size: 3,
    });
    pointLayer.setVisible(false);
    ctx.resources.addDisposable(() => pointLayer.dispose());
    return { pointLayer };
  },
  update(ctx, state) {
    const progress = ctx.progress.get("fixture.progress");
    const modelVisible = ctx.progress.get("fixture.visible") > 0.5;
    const pointsVisible = progress >= 0.68;
    ctx.object.visible = modelVisible;
    ctx.object.position.set(
      (progress - 0.35) * 220 + ctx.pointer.normalizedX * 42,
      -150 + ctx.pointer.normalizedY * 24,
      -70,
    );
    ctx.object.rotation.set(
      ctx.pointer.normalizedY * 0.18,
      -0.35 + progress * 1.5 + ctx.pointer.normalizedX * 0.24,
      0,
    );
    ctx.object.scale.setScalar(12 + Math.max(0, progress - 0.68) * 22);
    state.pointLayer?.setVisible(modelVisible && pointsVisible);
    ctx.object.model?.meshes.forEach((mesh) => {
      mesh.setOpacity?.(pointsVisible ? 0 : 1);
    });
  },
});

export const runtimeEffects = [
  fixtureEffect,
  fixtureSceneObjectEffect,
  fixtureModelEffect,
] as const;
`;

const appSource = `import type { WebGLDebugState, WebGLDeclaration } from "@viselora/dom-webgl";
import {
  WebGLCamera,
  WebGLLight,
  WebGLModel,
  WebGLRenderPass,
  WebGLRuntime,
  WebGLScene,
  WebGLStageBox,
  WebGLTarget,
} from "@viselora/dom-webgl/react";
import { createScrollEffectProgressStore } from "@viselora/scroll-adapters";
import { WebGLScrollRuntime } from "@viselora/scroll-adapters/react";

import { runtimeEffects } from "./effects";

export const fixtureProgress = createScrollEffectProgressStore();
fixtureProgress.set("fixture.progress", 0.2);
fixtureProgress.set("fixture.visible", 1);

const cameraPosition = [120, 132, 620] as const;
const cameraTarget = [120, -78, -70] as const;
const modelEffects = [{ kind: "fixture.modelCapability" }] as const;
const stageEffects = [{ kind: "fixture.sceneObject" }] as const;

const targetDeclaration = {
  key: "fixture.target",
  source: { kind: "dom", type: "element" },
  lifecycle: {
    hideWhenReady: false,
    hideMode: "self",
    offscreen: { strategy: "restore-dom" },
  },
  effects: [{ kind: "fixture.surface" }],
} satisfies WebGLDeclaration;

void createScrollEffectProgressStore;
void WebGLScrollRuntime;

export function App({
  onDebugStateChange,
  includeModel = false,
}: {
  onDebugStateChange?: (state: WebGLDebugState) => void;
  includeModel?: boolean;
}) {
  return (
    <WebGLRuntime
      className="fixture-runtime"
      effects={runtimeEffects}
      progressSignals={fixtureProgress.source}
      onDebugStateChange={onDebugStateChange}
    >
      <WebGLTarget data-fixture-target="true" webgl={targetDeclaration}>
        <p>Visible DOM fallback</p>
      </WebGLTarget>
      <WebGLScene id="fixture.scene" projection="perspective-stage">
        <WebGLCamera
          id="fixture.camera"
          type="perspective"
          mode="perspective-stage"
          fov={42}
          position={cameraPosition}
          target={cameraTarget}
          default
        />
        <WebGLRenderPass
          id="fixture.pass"
          camera="fixture.camera"
          order={10}
          clear
        />
        <WebGLStageBox
          id="fixture.stage"
          size={[1, 1, 1]}
          position={[10000, 10000, 10000]}
          visible={false}
          material={{ kind: "basic", color: "#ffffff" }}
          effects={stageEffects}
        />
        {includeModel ? (
          <>
            <WebGLModel
              id="fixture.model"
              src="/models/hero.glb"
              effects={modelEffects}
            />
            <WebGLLight id="fixture.ambient" kind="ambient" intensity={0.42} />
            <WebGLLight
              id="fixture.key"
              kind="point"
              color="#63e6ff"
              intensity={2.4}
              position={[-160, 160, 180]}
            />
          </>
        ) : null}
      </WebGLScene>
    </WebGLRuntime>
  );
}
`;

const mainSource = `import { createElement, useState } from "react";
import { createRoot } from "react-dom/client";

import type { WebGLDebugState } from "@viselora/dom-webgl";

import { App, fixtureProgress } from "./App";

document.documentElement.style.background = "#05070a";
document.body.style.margin = "0";
document.body.style.background = "#05070a";
document.body.style.overflow = "hidden";

function BrowserFixture() {
  const [mounted, setMounted] = useState(true);
  return createElement(
    "div",
    { style: { width: "100vw", height: "100vh", background: "#05070a" } },
    createElement(
      "button",
      {
        type: "button",
        "data-runtime-toggle": true,
        style: { position: "fixed", zIndex: 10, top: 8, left: 8 },
        onClick: () => setMounted((value) => !value),
      },
      mounted ? "Unmount runtime" : "Remount runtime",
    ),
    mounted
      ? createElement(App, {
          includeModel: true,
          onDebugStateChange(state: WebGLDebugState) {
            (window as unknown as { __fixtureDebug?: WebGLDebugState }).__fixtureDebug = state;
          },
        })
      : null,
  );
}

(window as unknown as {
  __fixtureSetProgress(value: number): void;
  __fixtureSetVisible(value: boolean): void;
}).__fixtureSetProgress = (value) => fixtureProgress.set("fixture.progress", value);
(window as unknown as {
  __fixtureSetVisible(value: boolean): void;
}).__fixtureSetVisible = (value) => fixtureProgress.set("fixture.visible", value ? 1 : 0);

const container = document.getElementById("root");
if (!container) throw new Error("Missing #root");
createRoot(container).render(createElement(BrowserFixture));
`;

const playwrightConfigSource = `import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

const systemChromium = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ??
  (existsSync(systemChromium) ? systemChromium : undefined);

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  workers: 1,
  webServer: {
    command: "npx vite --host 127.0.0.1 --port 4179",
    port: 4179,
    reuseExistingServer: false,
  },
  use: { baseURL: "http://127.0.0.1:4179", viewport: { width: 960, height: 720 } },
  projects: [{
    name: "chromium",
    use: {
      ...devices["Desktop Chrome"],
      launchOptions: executablePath ? { executablePath } : {},
    },
  }],
});
`;

const browserTestSource = `import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { PNG } from "pngjs";

test("packed scene/model effects pass real Chromium final-canvas gates", async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/");
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveCount(1);
  await expect.poll(() => readModelDebug(page)).toMatchObject({
    resourceStatus: "ready",
    attached: true,
    visible: true,
  });
  const debug = await readDebug(page);
  expect(debug.stagePrimitives).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ id: "fixture.stage", effects: ["fixture.sceneObject"] }),
    ]),
  );
  const model = debug.models.find((entry: { id: string }) => entry.id === "fixture.model");
  expect(model).not.toHaveProperty("error");

  await setVisible(page, false);
  const empty = await canvas.screenshot({ path: evidencePath("empty.png") });
  await setVisible(page, true);
  await setProgress(page, 0.2);
  const solidStart = await canvas.screenshot({ path: evidencePath("solid-start.png") });
  const staticScene = changedPixelCount(empty, solidStart);
  expect(staticScene).toBeGreaterThan(100);

  await setProgress(page, 0.52);
  const progressed = await canvas.screenshot({ path: evidencePath("progress.png") });
  const progressTransform = changedPixelCount(solidStart, progressed);
  expect(progressTransform).toBeGreaterThan(100);

  await page.mouse.move(480, 360);
  await page.waitForTimeout(180);
  const pointerCenter = await canvas.screenshot({ path: evidencePath("pointer-center.png") });
  await page.mouse.move(900, 80, { steps: 8 });
  await page.waitForTimeout(220);
  const pointerCorner = await canvas.screenshot({ path: evidencePath("pointer-corner.png") });
  const pointerTransform = changedPixelCount(pointerCenter, pointerCorner);
  expect(pointerTransform).toBeGreaterThan(100);

  await page.mouse.move(480, 360);
  await setProgress(page, 0.58);
  const solid = await canvas.screenshot({ path: evidencePath("solid.png") });
  await setProgress(page, 0.82);
  const points = await canvas.screenshot({ path: evidencePath("points.png") });
  const solidToPoints = changedPixelCount(solid, points);
  expect(solidToPoints).toBeGreaterThan(100);
  await setProgress(page, 0.58);
  const solidReturn = await canvas.screenshot({ path: evidencePath("solid-return.png") });
  const pointsToSolid = changedPixelCount(points, solidReturn);
  expect(pointsToSolid).toBeGreaterThan(100);

  await page.getByRole("button", { name: "Unmount runtime" }).click();
  await expect(canvas).toHaveCount(0);
  await page.getByRole("button", { name: "Remount runtime" }).click();
  await expect(page.locator("canvas")).toHaveCount(1);
  await expect.poll(() => readModelDebug(page)).toMatchObject({
    resourceStatus: "ready",
    attached: true,
    visible: true,
  });

  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
  const evidence = {
    packageVersion: "0.1.0-alpha.0",
    capabilityId: "scene-object-effect-registration",
    passed: true,
    capture: "canvas-element-only",
    domOverlayPixelsExcluded: true,
    measurements: {
      staticScene,
      progressTransform,
      pointerTransform,
      solidToPoints,
      pointsToSolid,
    },
    consoleErrors,
    pageErrors,
    canvasLifecycle: [1, 0, 1],
  };
  mkdirSync(resolve("evidence"), { recursive: true });
  writeFileSync(evidencePath("browser-capabilities.json"), JSON.stringify(evidence, null, 2) + "\\n");
});

function evidencePath(name: string): string {
  return resolve("evidence", name);
}

async function readDebug(page: import("@playwright/test").Page): Promise<any> {
  return page.evaluate(() => (window as unknown as { __fixtureDebug: unknown }).__fixtureDebug);
}

async function readModelDebug(page: import("@playwright/test").Page): Promise<any> {
  const debug = await readDebug(page);
  return debug?.models?.find((entry: { id: string }) => entry.id === "fixture.model");
}

async function setProgress(page: import("@playwright/test").Page, value: number): Promise<void> {
  await page.evaluate((next) => {
    (window as unknown as { __fixtureSetProgress(value: number): void }).__fixtureSetProgress(next);
  }, value);
  await page.waitForTimeout(240);
}

async function setVisible(page: import("@playwright/test").Page, visible: boolean): Promise<void> {
  await page.evaluate((next) => {
    (window as unknown as { __fixtureSetVisible(value: boolean): void }).__fixtureSetVisible(next);
  }, visible);
  await page.waitForTimeout(240);
}

function changedPixelCount(first: Buffer, second: Buffer): number {
  const a = PNG.sync.read(first);
  const b = PNG.sync.read(second);
  expect([a.width, a.height]).toEqual([b.width, b.height]);
  let changed = 0;
  for (let index = 0; index < a.data.length; index += 4) {
    const delta =
      Math.abs(a.data[index] - b.data[index]) +
      Math.abs(a.data[index + 1] - b.data[index + 1]) +
      Math.abs(a.data[index + 2] - b.data[index + 2]) +
      Math.abs(a.data[index + 3] - b.data[index + 3]);
    if (delta > 24) changed += 1;
  }
  return changed;
}
`;

const ssrSource = `delete globalThis.window;
delete globalThis.document;

const core = await import("@viselora/dom-webgl");
const react = await import("@viselora/dom-webgl/react");
const adapters = await import("@viselora/scroll-adapters");
const adaptersReact = await import("@viselora/scroll-adapters/react");

for (const [name, value] of Object.entries({
  createWebGLRuntime: core.createWebGLRuntime,
  WebGLRuntime: react.WebGLRuntime,
  createLenisGsapScrollStack: adapters.createLenisGsapScrollStack,
  WebGLScrollRuntime: adaptersReact.WebGLScrollRuntime,
})) {
  if (typeof value !== "function") throw new Error(\`Missing public export \${name}\`);
}

console.log("SSR imports OK");
`;

const vitestConfigSource = `import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig(({ mode }) => ({
  resolve:
    mode === "test"
      ? {
          alias: {
            "three/src/renderers/WebGLRenderer.js": fileURLToPath(
              new URL("./test/WebGLRendererMock.ts", import.meta.url),
            ),
          },
        }
      : undefined,
  test: {
    environment: "jsdom",
    include: ["test/**/*.test.ts", "test/**/*.test.tsx"],
    server: {
      deps: {
        inline: ["@viselora/dom-webgl"],
      },
    },
  },
}));
`;

const rendererMockSource = `export class WebGLRendererMock {
  readonly canvas: HTMLCanvasElement;
  autoClear = true;
  readonly info = {
    render: { calls: 0, triangles: 0 },
    memory: { geometries: 0, textures: 0 },
    programs: [],
  };
  constructor(options: { canvas: HTMLCanvasElement }) {
    this.canvas = options.canvas;
  }
  setAnimationLoop(_callback: ((time: number) => void) | null) {}
  setPixelRatio(_ratio: number) {}
  setSize(_width: number, _height: number, _updateStyle?: boolean) {}
  setClearAlpha(_alpha: number) {}
  setViewport(_x: number, _y: number, _width: number, _height: number) {}
  setScissor(_x: number, _y: number, _width: number, _height: number) {}
  setScissorTest(_enabled: boolean) {}
  setRenderTarget(_target: object | null) {}
  clear() {}
  clearDepth() {}
  render(_scene: object, _camera: object) {}
  dispose() {}
}

export { WebGLRendererMock as WebGLRenderer };
`;

const runtimeTestSource = `// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import type { WebGLDebugState } from "@viselora/dom-webgl";

import { App } from "../src/App";

let host: HTMLDivElement;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.append(host);
  Object.defineProperty(globalThis, "ResizeObserver", {
    configurable: true,
    value: class ResizeObserverMock {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (this: HTMLCanvasElement) {
    return createCanvasContext(this) as unknown as CanvasRenderingContext2D;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

test("mounts one runtime canvas and one target from installed tarballs", async () => {
  const debugStates: WebGLDebugState[] = [];
  const runtimeErrors: string[] = [];
  const originalConsoleError = console.error;
  console.error = (...args: unknown[]) => {
    runtimeErrors.push(args.map(String).join(" "));
    originalConsoleError(...args);
  };
  const root = createRoot(host);

  try {
    await act(async () => {
      root.render(createElement(App, { onDebugStateChange: (state) => debugStates.push(state) }));
    });

    expect(
      host.querySelectorAll("canvas"),
      JSON.stringify(debugStates),
    ).toHaveLength(1);
    expect(host.querySelectorAll("[data-fixture-target]")).toHaveLength(1);
    expect(debugStates.some((state) => state.targetCount === 1)).toBe(true);
    expect(
      debugStates.some((state) =>
        state.stagePrimitives?.some(
          (stage) => stage.effects?.includes("fixture.sceneObject"),
        ),
      ),
    ).toBe(true);
    expect(runtimeErrors).toEqual([]);

    await act(async () => root.unmount());
    expect(host.querySelectorAll("canvas")).toHaveLength(0);
  } finally {
    console.error = originalConsoleError;
  }
});

function createCanvasContext(canvas: HTMLCanvasElement) {
  return {
    canvas,
    globalAlpha: 1,
    fillStyle: "#000000",
    font: "16px sans-serif",
    textAlign: "start",
    textBaseline: "alphabetic",
    beginPath() {},
    arc() {},
    fill() {},
    clearRect() {},
    drawImage() {},
    fillRect() {},
    fillText() {},
    measureText(text: string) { return { width: text.length * 8 }; },
    restore() {},
    save() {},
    scale() {},
    setTransform() {},
    translate() {},
  };
}
`;
