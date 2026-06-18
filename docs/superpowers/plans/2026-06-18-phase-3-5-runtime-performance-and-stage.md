# Phase 3.5 Runtime Performance And Stage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Execution status:** Implemented and verified in branch `codex/phase3-5-runtime-performance-stage`. Targeted Phase 3.5 tests passed with 16 files / 75 tests; full Vitest passed with 45 files / 212 tests; `npm run typecheck`, `npm run build`, `npm run check:imports`, and `git diff --check` passed. The existing non-blocking Vite chunk-size warning remains.

**Goal:** Bring Phase 1-3 runtime behavior up to the `docs/00-goal.md` performance and display contracts before adding any effect or animation layer.

**Architecture:** Keep the DOM-first target/source/renderable pipeline, but replace the current loose canvas placement and unconditional React RAF sync with a single owned WebGL stage, one renderer loop, batched layout reads, explicit content/resource dirty boundaries, and lifecycle-aware updates. The canvas must share the DOM coordinate space with targets, must not participate in normal document flow, and must be driven by the runtime renderer loop rather than by component-level loops.

**Tech Stack:** TypeScript, React, Three.js, Vitest, Vite demo app.

---

## Current Findings To Correct

- `docs/00-goal.md` already contains the performance contract under `DOM To WebGL Performance Contract`, `Viewport-Based Performance Contract`, `Runtime Lifecycle Contract`, and `Resource Loading And Unloading Contract`.
- Current Phase 1-3 implementation proves the base pipeline and visible renderables, but does not fully implement those performance contracts.
- The canvas is appended as a normal child of the runtime container, so it appears below DOM content instead of acting as a WebGL stage layer.
- The recently added React animation-frame sync is too broad: it drives full runtime sync continuously from React instead of a single renderer-owned frame loop.
- The current renderer uses `antialias: true` and does not set `alpha: false`, `powerPreference: "high-performance"`, or a DPR cap.
- Current `textSnapshotRenderable` redraws text content on every `sync()` call, which violates the goal that snapshots are resource builds, not frame updates.
- Layout measurement is still scattered through renderable `update()` calls; `00-goal.md` requires batched runtime layout measurement.
- Lifecycle states are still `idle/loading/ready/error/disposed` style resource states, not the goal-level `declared/preloading/loaded/mounted/active/inactive/paused/disposed/error` target lifecycle.
- There is no render target pool yet.

## File Structure

- Modify: `packages/dom-webgl-runtime/src/lib/renderer/threeRenderer.ts`
  - Own canvas CSS placement, renderer options, DPR cap, `setAnimationLoop`, and renderer disposal.
- Create: `packages/dom-webgl-runtime/src/lib/renderer/rendererLoop.ts`
  - Own the single frame loop: read input, route scroll/pointer, update runtime, render once.
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`
  - Move sync scheduling into runtime ownership, expose internal frame update hooks, remove React-owned frame loop dependency, and enforce one renderer host per runtime.
- Create: `packages/dom-webgl-runtime/src/lib/renderer/layoutPass.ts`
  - Batch DOM measurements for active renderables into one runtime layout pass.
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderable.ts`
  - Split layout update from content/resource update and add lifecycle state plumbing.
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/elementSnapshotRenderable.ts`
  - Treat element snapshot content as a resource build; per-frame work updates layout only.
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/textSnapshotRenderable.ts`
  - Stop per-frame text redraw; redraw only on explicit snapshot invalidation or initial build.
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/imageRenderable.ts`
  - Keep resource loading keyed by source and per-frame work layout-only.
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/videoRenderable.ts`
  - Keep `VideoTexture` frame behavior but align layout/resource lifecycle and inactive pause behavior.
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/modelRenderable.ts`
  - Keep GLB load once per source and layout-only frame updates.
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/sceneRenderableObject.ts`
  - Support layout updates from precomputed measurements and enforce disposal of geometry/material/texture resources.
- Modify: `packages/dom-webgl-runtime/src/lib/resources/resourceManager.ts`
  - Add lifecycle-aware resource records, optional concurrency budget, and explicit dispose semantics.
- Create: `packages/dom-webgl-runtime/src/lib/resources/renderTargetPool.ts`
  - Provide a small reusable render target pool with deterministic disposal.
- Modify: `packages/dom-webgl-runtime/src/lib/react/WebGLRuntime.tsx`
  - Remove React-owned RAF sync loop; React only creates/disposes runtime and registers targets.
- Modify: `packages/dom-webgl-runtime/src/lib/react/WebGLRuntime.test.tsx`
  - Replace "automatic RAF sync" tests with "runtime owns frame loop" tests.
- Modify: `apps/demo/src/demo.css`
  - Ensure the runtime container reserves the intended area while canvas is absolute-positioned and not in document flow.
- Modify: `README.md`, `docs/00-goal.md`, `docs/EXECUTION_STATE.md`, `docs/PHASE3_VISIBLE_RENDERABLE_PLAN.md`
  - Mark Phase 3.5 as implemented and verified before effect/animation work.

## Task 1: Canvas Stage Placement Contract

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/threeRenderer.ts`
- Test: `packages/dom-webgl-runtime/src/lib/renderer/threeRenderer.test.ts`

- [x] **Step 1: Write the failing canvas placement test**

Add a test asserting that the created canvas is not a normal document-flow child.

```ts
test("positions the renderer canvas as an internal stage layer", () => {
  const container = document.createElement("section");
  Object.defineProperties(container, {
    clientWidth: { configurable: true, value: 640 },
    clientHeight: { configurable: true, value: 360 },
  });

  const host = createThreeRendererHost(container, {
    createObjects: createRendererObjectsStub(),
  });

  expect(container.style.position).toBe("relative");
  expect(host.canvas.style.position).toBe("absolute");
  expect(host.canvas.style.inset).toBe("0px");
  expect(host.canvas.style.width).toBe("100%");
  expect(host.canvas.style.height).toBe("100%");
  expect(host.canvas.style.pointerEvents).toBe("none");
  expect(host.canvas.style.display).toBe("block");

  host.dispose();
});
```

- [x] **Step 2: Run the test to verify it fails**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/renderer/threeRenderer.test.ts -t "positions the renderer canvas"
```

Expected: FAIL because canvas styles are not set.

- [x] **Step 3: Implement minimal stage placement**

In `createThreeRendererHost`, add a small helper:

```ts
function configureCanvasStage(container: HTMLElement, canvas: HTMLCanvasElement): void {
  if (!container.style.position) {
    container.style.position = "relative";
  }

  Object.assign(canvas.style, {
    position: "absolute",
    inset: "0px",
    width: "100%",
    height: "100%",
    pointerEvents: "none",
    display: "block",
  });
}
```

Call it before `container.appendChild(canvas)`.

- [x] **Step 4: Verify the stage placement test passes**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/renderer/threeRenderer.test.ts -t "positions the renderer canvas"
```

Expected: PASS.

## Task 2: Renderer Performance Defaults

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/threeRenderer.ts`
- Test: `packages/dom-webgl-runtime/src/lib/renderer/threeRenderer.test.ts`

- [x] **Step 1: Write failing renderer options and DPR tests**

Add a test that mocks the Three.js renderer constructor and verifies options:

```ts
test("uses performance-oriented WebGLRenderer defaults", async () => {
  const createdOptions: unknown[] = [];

  vi.resetModules();
  vi.doMock("three/src/renderers/WebGLRenderer.js", () => ({
    WebGLRenderer: vi.fn((options) => {
      createdOptions.push(options);
      return {
        setSize: vi.fn(),
        setPixelRatio: vi.fn(),
        render: vi.fn(),
        dispose: vi.fn(),
      };
    }),
  }));

  const { createThreeRendererHost } = await import("./threeRenderer");
  const container = document.createElement("div");

  createThreeRendererHost(container);

  expect(createdOptions[0]).toMatchObject({
    antialias: false,
    alpha: false,
    powerPreference: "high-performance",
  });
});
```

Add a separate DPR cap test with an injected renderer stub:

```ts
test("caps renderer pixel ratio at 1.5", () => {
  const setPixelRatio = vi.fn();
  const container = document.createElement("div");
  Object.defineProperty(window, "devicePixelRatio", {
    configurable: true,
    value: 3,
  });

  createThreeRendererHost(container, {
    createObjects(canvas) {
      return {
        camera: {},
        scene: {},
        renderer: {
          canvas,
          setPixelRatio,
          setSize: vi.fn(),
          render: vi.fn(),
          dispose: vi.fn(),
        },
      };
    },
  });

  expect(setPixelRatio).toHaveBeenCalledWith(1.5);
});
```

- [x] **Step 2: Run tests to verify they fail**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/renderer/threeRenderer.test.ts -t "performance-oriented|pixel ratio"
```

Expected: FAIL because current renderer uses `antialias: true` and does not set DPR.

- [x] **Step 3: Implement renderer defaults**

Change renderer creation:

```ts
const renderer = new WebGLRenderer({
  antialias: false,
  alpha: false,
  powerPreference: "high-performance",
  canvas,
});
```

Extend `ThreeRendererAdapter`:

```ts
setPixelRatio?(ratio: number): void;
setAnimationLoop?(callback: ((time: number) => void) | null): void;
```

Apply DPR cap during viewport configuration:

```ts
const maxPixelRatio = 1.5;
const pixelRatio = Math.min(window.devicePixelRatio || 1, maxPixelRatio);
renderer.setPixelRatio?.(pixelRatio);
```

- [x] **Step 4: Verify renderer tests pass**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/renderer/threeRenderer.test.ts
```

Expected: PASS.

## Task 3: Single Renderer-Owned Loop

**Files:**
- Create: `packages/dom-webgl-runtime/src/lib/renderer/rendererLoop.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/threeRenderer.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/react/WebGLRuntime.tsx`
- Test: `packages/dom-webgl-runtime/src/lib/renderer/rendererLoop.test.ts`
- Test: `packages/dom-webgl-runtime/src/lib/react/WebGLRuntime.test.tsx`

- [x] **Step 1: Write failing renderer loop tests**

Create `rendererLoop.test.ts`:

```ts
import { describe, expect, test, vi } from "vitest";
import { createRendererLoop } from "./rendererLoop";

describe("renderer loop", () => {
  test("starts through renderer.setAnimationLoop and renders once after hooks", () => {
    const calls: string[] = [];
    let loopCallback: ((time: number) => void) | null = null;
    const renderer = {
      setAnimationLoop: vi.fn((callback: ((time: number) => void) | null) => {
        loopCallback = callback;
      }),
    };
    const loop = createRendererLoop({
      renderer,
      beforeRender() {
        calls.push("beforeRender");
      },
      render() {
        calls.push("render");
      },
    });

    loop.start();
    loopCallback?.(16);

    expect(renderer.setAnimationLoop).toHaveBeenCalledWith(expect.any(Function));
    expect(calls).toEqual(["beforeRender", "render"]);
  });

  test("stops by clearing renderer.setAnimationLoop", () => {
    const renderer = { setAnimationLoop: vi.fn() };
    const loop = createRendererLoop({
      renderer,
      beforeRender() {},
      render() {},
    });

    loop.start();
    loop.dispose();

    expect(renderer.setAnimationLoop).toHaveBeenLastCalledWith(null);
  });
});
```

In `WebGLRuntime.test.tsx`, replace the React RAF expectation with:

```ts
test("does not own a React requestAnimationFrame sync loop", async () => {
  const { WebGLRuntime } = await import("../../react");
  const { root } = createTestRoot();
  const requestAnimationFrame = vi.spyOn(globalThis, "requestAnimationFrame");

  await act(async () => {
    root.render(createElement(WebGLRuntime));
  });

  expect(requestAnimationFrame).not.toHaveBeenCalled();
  requestAnimationFrame.mockRestore();
});
```

- [x] **Step 2: Run tests to verify they fail**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/renderer/rendererLoop.test.ts packages/dom-webgl-runtime/src/lib/react/WebGLRuntime.test.tsx
```

Expected: FAIL because `rendererLoop.ts` does not exist and React still owns a RAF loop.

- [x] **Step 3: Implement `createRendererLoop`**

Create `rendererLoop.ts`:

```ts
export type RendererLoopOptions = {
  renderer: {
    setAnimationLoop?(callback: ((time: number) => void) | null): void;
  };
  beforeRender(time: number): void;
  render(): void;
};

export type RendererLoop = {
  start(): void;
  dispose(): void;
};

export function createRendererLoop(options: RendererLoopOptions): RendererLoop {
  let disposed = false;
  let started = false;

  const tick = (time: number) => {
    if (disposed) {
      return;
    }

    options.beforeRender(time);
    options.render();
  };

  return {
    start() {
      if (started || disposed) {
        return;
      }

      started = true;
      options.renderer.setAnimationLoop?.(tick);
    },
    dispose() {
      if (disposed) {
        return;
      }

      disposed = true;
      options.renderer.setAnimationLoop?.(null);
    },
  };
}
```

- [x] **Step 4: Wire the runtime to own the loop**

In `runtime.ts`, create the loop after `rendererHost` and call `loop.start()`.

Use:

```ts
const loop = createRendererLoop({
  renderer: rendererHost.renderer,
  beforeRender() {
    syncFrame();
  },
  render() {
    rendererHost.sceneAdapter.render();
  },
});
```

Extract the current update work from `sync()` into an internal `syncFrame()` that performs frame input, renderable updates, fallback state, and debug state without calling render directly. Keep public `sync()` as a compatibility method that calls `syncFrame()` then renders once.

- [x] **Step 5: Remove React-owned RAF loop**

Delete the `useEffect` in `WebGLRuntime.tsx` that calls `requestAnimationFrame`. React should only create/dispose runtime and provide it through context.

- [x] **Step 6: Verify loop ownership**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/renderer/rendererLoop.test.ts packages/dom-webgl-runtime/src/lib/react/WebGLRuntime.test.tsx packages/dom-webgl-runtime/src/lib/renderer/runtime.test.ts
```

Expected: PASS.

## Task 4: Batched Layout Pass

**Files:**
- Create: `packages/dom-webgl-runtime/src/lib/renderer/layoutPass.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderable.ts`
- Modify: renderables under `packages/dom-webgl-runtime/src/lib/render/renderables/`
- Test: `packages/dom-webgl-runtime/src/lib/renderer/layoutPass.test.ts`
- Test: `packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts`

- [x] **Step 1: Write failing layout pass test**

Create `layoutPass.test.ts`:

```ts
import { describe, expect, test, vi } from "vitest";
import { createLayoutPass } from "./layoutPass";

describe("layout pass", () => {
  test("measures each active target once and returns measurements by key", () => {
    const first = document.createElement("div");
    const second = document.createElement("div");
    const measureElement = vi
      .fn()
      .mockReturnValueOnce(new DOMRect(0, 0, 100, 50))
      .mockReturnValueOnce(new DOMRect(10, 20, 200, 80));
    const pass = createLayoutPass({ measureElement });

    const measurements = pass.measure([
      { key: "first", element: first, active: true },
      { key: "second", element: second, active: true },
      { key: "inactive", element: document.createElement("div"), active: false },
    ]);

    expect(measureElement).toHaveBeenCalledTimes(2);
    expect(measurements.get("first")).toMatchObject({ width: 100, height: 50 });
    expect(measurements.get("second")).toMatchObject({ width: 200, height: 80 });
    expect(measurements.has("inactive")).toBe(false);
  });
});
```

- [x] **Step 2: Run the test to verify it fails**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/renderer/layoutPass.test.ts
```

Expected: FAIL because `layoutPass.ts` does not exist.

- [x] **Step 3: Implement layout pass**

Create `layoutPass.ts`:

```ts
export type LayoutTarget = {
  key: string;
  element: HTMLElement;
  active: boolean;
};

export type ElementMeasurement = {
  x: number;
  y: number;
  width: number;
  height: number;
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type LayoutPass = {
  measure(targets: readonly LayoutTarget[]): Map<string, ElementMeasurement>;
};

export function createLayoutPass(options: {
  measureElement(element: HTMLElement): ElementMeasurement;
}): LayoutPass {
  return {
    measure(targets) {
      const measurements = new Map<string, ElementMeasurement>();

      for (const target of targets) {
        if (!target.active) {
          continue;
        }

        measurements.set(target.key, options.measureElement(target.element));
      }

      return measurements;
    },
  };
}
```

- [x] **Step 4: Refactor renderables to accept measured layout**

Add a renderable method:

```ts
updateLayout?(measurement: ElementMeasurement): void;
```

Move per-frame `measureElement()` calls out of renderable `update()` and into runtime layout pass. Renderables should apply received measurements to scene controllers.

- [x] **Step 5: Verify layout batching**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/renderer/layoutPass.test.ts packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts
```

Expected: PASS and existing runtime pipeline expectations updated to expect one batched measurement pass.

## Task 5: Snapshot Content Dirty Boundaries

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/textSnapshotRenderable.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/elementSnapshotRenderable.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/sceneRenderableObject.ts`
- Test: `packages/dom-webgl-runtime/src/lib/render/renderables/textSnapshotRenderable.test.ts`
- Test: `packages/dom-webgl-runtime/src/lib/render/renderables/elementSnapshotRenderable.test.ts`

- [x] **Step 1: Write failing text snapshot test**

Add a test:

```ts
test("does not redraw text content during layout-only frame updates", () => {
  const element = document.createElement("h1");
  element.textContent = "Initial";
  const renderable = createTextSnapshotRenderable(createContext(element), createOptions());

  renderable.update(createFrameInput());
  element.textContent = "Changed";
  renderable.updateLayout?.(new DOMRect(0, 0, 200, 50));

  expect(renderable.textContent).toBe("Initial");
});
```

- [x] **Step 2: Run the test to verify it fails**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/render/renderables/textSnapshotRenderable.test.ts -t "does not redraw"
```

Expected: FAIL because current update path rereads `textContent`.

- [x] **Step 3: Implement dirty-only content update**

Capture text once during initial content build:

```ts
const initialTextContent = context.descriptor.element.textContent ?? "";
```

Use `updateLayout()` for frame layout and reserve `update()` for resource/content build. Do not call `updateTextContent()` from layout-only updates.

- [x] **Step 4: Add explicit invalidation placeholder without public API expansion**

Add an internal method only if needed by tests:

```ts
invalidateContent?(): void;
```

Do not expose it publicly until a later API design requires it.

- [x] **Step 5: Verify snapshot tests**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/render/renderables/textSnapshotRenderable.test.ts packages/dom-webgl-runtime/src/lib/render/renderables/elementSnapshotRenderable.test.ts
```

Expected: PASS.

## Task 6: Lifecycle State Model

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/types.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderable.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/debug/debugState.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`
- Test: `packages/dom-webgl-runtime/src/lib/types.test.ts`
- Test: `packages/dom-webgl-runtime/src/lib/debug/debugState.test.ts`

- [x] **Step 1: Write failing public/internal type tests**

Add type coverage for lifecycle states:

```ts
type Expected =
  | "declared"
  | "preloading"
  | "loaded"
  | "mounted"
  | "active"
  | "inactive"
  | "paused"
  | "disposed"
  | "error";
```

Add debug assertion:

```ts
expect(state.targets[0]).toMatchObject({
  lifecycleState: "active",
});
```

- [x] **Step 2: Run tests to verify they fail**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/types.test.ts packages/dom-webgl-runtime/src/lib/debug/debugState.test.ts
```

Expected: FAIL because lifecycle state is not exposed in debug state.

- [x] **Step 3: Implement lifecycle state**

Add:

```ts
export type WebGLLifecycleState =
  | "declared"
  | "preloading"
  | "loaded"
  | "mounted"
  | "active"
  | "inactive"
  | "paused"
  | "disposed"
  | "error";
```

Use this state in renderable lifecycle bookkeeping and debug target records. Keep resource status separate from lifecycle state.

- [x] **Step 4: Verify lifecycle tests**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/types.test.ts packages/dom-webgl-runtime/src/lib/debug/debugState.test.ts
```

Expected: PASS.

## Task 7: Viewport Active Range And Work Skipping

**Files:**
- Create: `packages/dom-webgl-runtime/src/lib/renderer/viewportLifecycle.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`
- Test: `packages/dom-webgl-runtime/src/lib/renderer/viewportLifecycle.test.ts`

- [x] **Step 1: Write failing viewport lifecycle tests**

Create tests for range classification:

```ts
test("classifies targets as active only inside active margin", () => {
  const lifecycle = createViewportLifecycle({
    viewportHeight: 1000,
    activeMargin: "50vh",
    preloadMargin: "150vh",
    mountMargin: "100vh",
    unloadMargin: "250vh",
  });

  expect(lifecycle.classify(new DOMRect(0, 100, 100, 100))).toBe("active");
  expect(lifecycle.classify(new DOMRect(0, 1800, 100, 100))).toBe("preloading");
  expect(lifecycle.classify(new DOMRect(0, 4000, 100, 100))).toBe("disposed");
});
```

- [x] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/renderer/viewportLifecycle.test.ts
```

Expected: FAIL because module does not exist.

- [x] **Step 3: Implement viewport lifecycle classification**

Support `vh` margins for the first version. Do not add complex CSS parser behavior.

- [x] **Step 4: Use lifecycle state to skip expensive work**

In runtime frame update:

- Active targets receive layout updates.
- Inactive targets retain resources but skip snapshot rebuilds and effect hooks.
- Disposed/unloaded targets release GPU resources through renderable dispose.

- [x] **Step 5: Verify lifecycle behavior**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/renderer/viewportLifecycle.test.ts packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts
```

Expected: PASS.

## Task 8: Resource Manager Budgets And Disposal

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/resources/resourceManager.ts`
- Create: `packages/dom-webgl-runtime/src/lib/resources/renderTargetPool.ts`
- Test: `packages/dom-webgl-runtime/src/lib/resources/resourceManager.test.ts`
- Test: `packages/dom-webgl-runtime/src/lib/resources/renderTargetPool.test.ts`

- [x] **Step 1: Write failing resource budget and render target pool tests**

For resource manager:

```ts
test("keeps shared URL resources ref counted until the final dispose", () => {
  const manager = createResourceManager();
  const first = manager.acquire(createImageSource("/a.png"));
  const second = manager.acquire(createImageSource("/a.png"));

  expect(first.record).toBe(second.record);
  expect(first.record.refCount).toBe(2);

  first.dispose();
  expect(manager.inspect(first.record.key)).toBeDefined();

  second.dispose();
  expect(manager.inspect(first.record.key)).toBeUndefined();
});
```

For render target pool:

```ts
test("reuses released render targets and disposes retained targets", () => {
  const dispose = vi.fn();
  const pool = createRenderTargetPool({
    createTarget: () => ({ dispose }),
  });

  const first = pool.acquire("snapshot", 256, 256);
  pool.release(first);
  const second = pool.acquire("snapshot", 256, 256);

  expect(second).toBe(first);

  pool.dispose();
  expect(dispose).toHaveBeenCalledTimes(1);
});
```

- [x] **Step 2: Run tests to verify they fail**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/resources/resourceManager.test.ts packages/dom-webgl-runtime/src/lib/resources/renderTargetPool.test.ts
```

Expected: render target pool test fails because the module does not exist.

- [x] **Step 3: Implement render target pool**

Create a minimal generic pool around `{ dispose(): void }` objects. Keep Three.js `WebGLRenderTarget` creation behind an injected factory for testability.

- [x] **Step 4: Ensure renderable disposal releases GPU resources**

Audit all renderables:

- Element snapshot disposes geometry and material.
- Text snapshot disposes canvas texture, geometry, and material.
- Image/video dispose texture, geometry, material.
- Model recursively disposes geometry/material/texture where possible.
- Resource handles decrement ref counts.

- [x] **Step 5: Verify resource tests**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/resources/resourceManager.test.ts packages/dom-webgl-runtime/src/lib/resources/renderTargetPool.test.ts packages/dom-webgl-runtime/src/lib/render/renderables/modelRenderable.test.ts
```

Expected: PASS.

## Task 9: Demo Display Verification

**Files:**
- Modify: `apps/demo/src/demo.css`
- Modify: `apps/demo/src/App.test.tsx`
- Test: `apps/demo/src/App.test.tsx`

- [x] **Step 1: Write failing demo stage test**

Add an assertion that the demo runtime root receives stage-safe layout classes and does not rely on canvas in document flow:

```ts
expect(host.querySelector(".demo-runtime")).not.toBeNull();
expect(host.querySelector(".demo-scene")).not.toBeNull();
```

Add CSS expectations through class naming rather than computed browser layout in unit tests.

- [x] **Step 2: Run demo tests**

Run:

```bash
npm test -- --run apps/demo/src/App.test.tsx
```

Expected: FAIL if class contract is missing.

- [x] **Step 3: Update demo CSS**

Ensure the runtime has an explicit stage area and the content layer remains readable:

```css
.demo-runtime {
  position: relative;
  width: min(1120px, 100%);
  margin: 0 auto;
  min-height: 100vh;
}
```

Do not style the internal canvas from app CSS if runtime owns it.

- [x] **Step 4: Verify demo tests**

Run:

```bash
npm test -- --run apps/demo/src/App.test.tsx
```

Expected: PASS.

## Task 10: Documentation Alignment

**Files:**
- Modify: `README.md`
- Modify: `docs/00-goal.md`
- Modify: `docs/EXECUTION_STATE.md`
- Modify: `docs/PHASE3_VISIBLE_RENDERABLE_PLAN.md`

- [x] **Step 1: Document the Phase 3.5 checklist before editing code status**

In `docs/EXECUTION_STATE.md`, add a section:

```md
## Phase 3.5 Runtime Performance And Stage Checklist
- Canvas is an internal stage layer, not document-flow content.
- Renderer uses performance defaults and DPR cap.
- Runtime owns one renderer loop through `setAnimationLoop`.
- React does not own a frame loop.
- Layout reads are batched.
- Snapshot content rebuilds only on dirty invalidation.
- Lifecycle state separates resource status from target activity.
- Hidden/inactive targets skip high-cost updates.
- Resources and render targets dispose deterministically.
```

- [x] **Step 2: Update README demo expectations**

State that visible renderables appear in the runtime stage at DOM anchor positions and that the canvas must not appear below DOM content.

- [x] **Step 3: Update `docs/00-goal.md` implementation status**

Mark Phase 3.5 as the next correction required before effects. Do not claim effect/animation support.

- [x] **Step 4: Verify docs formatting**

Run:

```bash
git diff --check
```

Expected: no output.

## Task 11: Full Verification

**Files:**
- Modify only if verification exposes a bug in Phase 3.5 work.

- [x] **Step 1: Run targeted tests**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/renderer/threeRenderer.test.ts packages/dom-webgl-runtime/src/lib/renderer/rendererLoop.test.ts packages/dom-webgl-runtime/src/lib/renderer/layoutPass.test.ts packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts packages/dom-webgl-runtime/src/lib/react/WebGLRuntime.test.tsx apps/demo/src/App.test.tsx
```

Expected: PASS.

- [x] **Step 2: Run full tests**

Run:

```bash
npm test -- --run
```

Expected: PASS.

- [x] **Step 3: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [x] **Step 4: Run build**

Run:

```bash
npm run build
```

Expected: PASS. Existing Vite chunk-size warning is acceptable unless a new warning appears.

- [x] **Step 5: Run public import boundary**

Run:

```bash
npm run check:imports
```

Expected: `Demo import boundary OK`.

- [x] **Step 6: Run whitespace check**

Run:

```bash
git diff --check
```

Expected: no output.

## Self-Review

- Spec coverage: This plan covers the observed gaps against `docs/00-goal.md`: stage placement, renderer defaults, DPR cap, single loop owner, batched layout, snapshot dirty boundaries, lifecycle states, viewport activity, resource disposal, render target pooling, demo display, and documentation.
- Placeholder scan: No implementation step depends on unresolved placeholders, hidden future work, or unspecified tests.
- Type consistency: New names are consistent across tasks: `createRendererLoop`, `createLayoutPass`, `createViewportLifecycle`, `WebGLLifecycleState`, and `createRenderTargetPool`.

## Execution Options

1. Subagent-Driven (recommended): Dispatch a fresh subagent per task, review between tasks, keep changes small.
2. Inline Execution: Execute tasks in this session using `superpowers:executing-plans`, with checkpoints after each batch.
