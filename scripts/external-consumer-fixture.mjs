import { mkdirSync, writeFileSync } from "node:fs";
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

  writeJson(root, "package.json", {
    name: "viselora-external-consumer-fixture",
    private: true,
    version: "0.0.0",
    type: "module",
    scripts: {
      typecheck: "tsc --noEmit",
      test: "vitest run",
      build: "vite build",
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
      jsdom: "^26.1.0",
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
    '<!doctype html>\n<html><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>\n',
  );
  writeText(root, "src/effects.ts", effectsSource);
  writeText(root, "src/App.tsx", appSource);
  writeText(root, "src/main.tsx", mainSource);
  writeText(root, "scripts/verify-ssr.mjs", ssrSource);
  writeText(root, "vitest.config.ts", vitestConfigSource);
  writeText(root, "test/WebGLRendererMock.ts", rendererMockSource);
  writeText(root, "test/runtime.test.tsx", runtimeTestSource);

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

export const runtimeEffects = [fixtureEffect, fixtureSceneObjectEffect] as const;
`;

const appSource = `import type { WebGLDebugState, WebGLDeclaration } from "@viselora/dom-webgl";
import {
  WebGLCamera,
  WebGLRenderPass,
  WebGLRuntime,
  WebGLScene,
  WebGLStageBox,
  WebGLTarget,
} from "@viselora/dom-webgl/react";
import { createScrollEffectProgressStore } from "@viselora/scroll-adapters";
import { WebGLScrollRuntime } from "@viselora/scroll-adapters/react";

import { runtimeEffects } from "./effects";

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
}: {
  onDebugStateChange?: (state: WebGLDebugState) => void;
}) {
  return (
    <WebGLRuntime effects={runtimeEffects} onDebugStateChange={onDebugStateChange}>
      <WebGLTarget data-fixture-target="true" webgl={targetDeclaration}>
        <p>Visible DOM fallback</p>
      </WebGLTarget>
      <WebGLScene id="fixture.scene" projection="perspective-stage">
        <WebGLCamera
          id="fixture.camera"
          type="perspective"
          mode="perspective-stage"
          position={[0, 0, 5]}
          target={[0, 0, 0]}
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
          material={{ kind: "basic", color: "#ffffff" }}
          effects={[{ kind: "fixture.sceneObject" }]}
        />
      </WebGLScene>
    </WebGLRuntime>
  );
}
`;

const mainSource = `import { createElement } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";

const container = document.getElementById("root");
if (!container) throw new Error("Missing #root");
createRoot(container).render(createElement(App));
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
