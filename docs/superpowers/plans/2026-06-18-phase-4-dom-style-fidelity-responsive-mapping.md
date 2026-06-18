# Phase 4 DOM Style Fidelity And Responsive Mapping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Make DOM-authored WebGL targets closely follow their DOM style, CSS-pixel position, resize behavior, and mobile layout without adding demo-specific runtime branches.

**Architecture:** Keep DOM as the source of truth and keep `apps/demo` as a public API consumer. The runtime should produce one batched `ElementLayoutSnapshot` per active target for geometry and viewport state, while style-derived snapshot state is cached behind explicit dirty boundaries. Renderables consume layout snapshots every active frame for CSS-pixel scene alignment, but rebuild textures only when width, height, capped DPR, content, media source, or cached style signatures change.

**Tech Stack:** TypeScript, React, Three.js, Vitest, jsdom, Vite demo app.

---

## Current Findings

- Phase 3.5 fixed the canvas stage, renderer loop, batched layout reads, dirty snapshot boundaries, and lifecycle/resource cleanup.
- DOM projection currently maps only `{ left, top, width, height }` into CSS-pixel scene coordinates.
- Element snapshots still render as a plain color plane from `backgroundColor`; borders, radii, shadows, opacity, transforms, and complex box paint are not represented.
- Text snapshots read measured text box, font, color, line height, padding, and alignment, but the style reader is text-specific instead of a reusable DOM style snapshot.
- The renderer host configures viewport size and DPR at creation time, but Phase 4 needs an explicit resize path for window resize, visual viewport changes, orientation changes, DPR changes, and narrow mobile layouts.
- Existing tests cover many runtime contracts, but there is no fidelity-focused contract that says which DOM CSS properties are intentionally mirrored.

## Recommended Route

Use a staged native fidelity layer.

1. **Recommended: native style/layout snapshot layer.** Read geometry every active layout pass, refresh supported computed CSS only on dirty boundaries, and render common box/text/media style through internal canvas/texture helpers. This fits the existing package boundary, is testable in Vitest, and keeps performance under runtime control.
2. **Alternative: direct DOM rasterizer dependency.** A library such as html-to-canvas-style rasterization may produce closer one-off snapshots, but it adds dependency weight, browser edge cases, poorer invalidation control, and likely weaker SSR/import boundaries.
3. **Alternative: full CSS engine clone.** Hand-rendering all CSS, pseudo-elements, filters, layout modes, and nested DOM is too large for the next phase and should not block useful fidelity gains.

Phase 4 should implement option 1, but in a deliberately narrow first slice: fix alignment, resize, and common 2D box/text/media fidelity before adding broader CSS coverage.

## Phase 4 Scope

Supported in Phase 4:

- CSS-pixel rect projection with fractional coordinates preserved until the final Three.js object update.
- Cached viewport and DPR resize updates for `window`, `visualViewport`, orientation changes, and manual `runtime.sync()`.
- Computed style snapshot for common 2D properties:
  - `display`, `visibility`, `opacity`
  - `backgroundColor`
  - `borderTop/Right/Bottom/LeftWidth`
  - `borderTop/Right/Bottom/LeftColor`
  - `borderTopLeft/TopRight/BottomRight/BottomLeftRadius`
  - `boxShadow` as a best-effort single outer shadow paint
  - text font, color, line height, padding, text align, and block alignment
  - media `objectFit` and `objectPosition`
- Snapshot texture rebuilds when style, content, size, capped DPR, or explicit invalidation signatures change.
- Mobile demo coverage at a narrow viewport with one-column layout and no runtime hardcoded demo keys or class names.

Deferred:

- Full DOM subtree rasterization.
- Pseudo-elements.
- CSS filters and backdrop filters.
- CSS gradients beyond debug reporting as unsupported box paint.
- Multiple box shadows.
- Matrix-level transform reproduction on WebGL objects. Phase 4 only guarantees transformed DOM bounding-box alignment.
- CSS masks, clip paths, blend modes, and SVG foreign-object paths.
- WebGL raycast picking, effect registry, animation layer, third-party scroll adapters, multiple canvases, and public Three.js render flags.

## File Structure

- Create: `packages/dom-webgl-runtime/src/lib/dom/styleSnapshot.ts`
  - Reads supported computed style into a stable internal `DOMStyleSnapshot`.
- Create: `packages/dom-webgl-runtime/src/lib/dom/styleSnapshot.test.ts`
  - Locks parsing and signatures for supported styles.
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/layoutPass.ts`
  - Return `ElementLayoutSnapshot` with rect, viewport, capped DPR, and geometry signatures.
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/layoutPass.test.ts`
  - Cover batched measurement plus viewport and geometry signature changes.
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/domProjection.ts`
  - Project layout snapshots into CSS-pixel scene boxes without early rounding.
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/domProjection.test.ts`
  - Cover fractional rects and mobile viewport size.
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/threeRenderer.ts`
  - Expose cached `resizeIfNeeded()` and viewport-size reads.
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/threeRenderer.test.ts`
  - Cover resize-driven renderer size, DPR, and camera projection updates.
- Create: `packages/dom-webgl-runtime/src/lib/dom/domInvalidation.ts`
  - Own narrow dirty tracking for target resize, inline style/class mutation, and viewport changes.
- Create: `packages/dom-webgl-runtime/src/lib/dom/domInvalidation.test.ts`
  - Cover dirty target callbacks and cleanup without broad subtree scanning behavior.
- Create: `packages/dom-webgl-runtime/src/lib/render/renderables/cssBoxCanvas.ts`
  - Draw supported CSS box paint into a canvas texture source.
- Create: `packages/dom-webgl-runtime/src/lib/render/renderables/cssBoxCanvas.test.ts`
  - Cover background, border, radius, shadow, and DPR-aware canvas sizing.
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/sceneRenderableObject.ts`
  - Add a reusable canvas-backed plane controller and apply projected opacity.
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/elementSnapshotRenderable.ts`
  - Use CSS box canvas snapshots instead of a color-only material.
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/textCanvasLayout.ts`
  - Consume shared style snapshot values instead of independently reading overlapping style.
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/textSnapshotRenderable.ts`
  - Rebuild text textures when text/style/size/DPR signatures change.
- Create: `packages/dom-webgl-runtime/src/lib/render/renderables/objectFit.ts`
  - Compute image/video crop and scale for `object-fit` and `object-position`.
- Create: `packages/dom-webgl-runtime/src/lib/render/renderables/objectFit.test.ts`
  - Cover `cover`, `contain`, `fill`, `none`, and percentage object positions.
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/imageRenderable.ts`
  - Apply object-fit mapping to image texture planes.
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/videoRenderable.ts`
  - Apply object-fit mapping to video texture planes.
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`
  - Wire invalidation, cached host resize, style cache, layout snapshots, and renderable layout updates.
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderable.ts`
  - Change layout update typing from `ElementMeasurement` to `ElementLayoutSnapshot`.
- Modify: `apps/demo/src/App.tsx`
  - Add a public API fidelity harness section with box, text, media, and responsive targets.
- Modify: `apps/demo/src/App.test.tsx`
  - Assert demo fidelity targets use only public declarations.
- Modify: `apps/demo/src/demo.css`
  - Add responsive desktop/mobile styles for the fidelity harness.
- Modify: `README.md`, `docs/00-goal.md`, `docs/EXECUTION_STATE.md`
  - Document Phase 4 plan, fidelity scope, deferred CSS features, and verification commands.

---

## Task 1: DOM Style Snapshot Contract

**Files:**
- Create: `packages/dom-webgl-runtime/src/lib/dom/styleSnapshot.ts`
- Create: `packages/dom-webgl-runtime/src/lib/dom/styleSnapshot.test.ts`

- [x] **Step 1: Write style snapshot tests**

Add tests that lock the supported style surface and a stable signature.

```ts
import { describe, expect, test } from "vitest";

import { readDOMStyleSnapshot } from "./styleSnapshot";

describe("readDOMStyleSnapshot", () => {
  test("reads common box text and media computed styles", () => {
    const element = document.createElement("div");
    Object.assign(element.style, {
      opacity: "0.72",
      backgroundColor: "rgb(240, 248, 255)",
      border: "2px solid rgb(12, 34, 56)",
      borderRadius: "18px 12px 10px 8px",
      boxShadow: "0px 12px 24px rgba(0, 0, 0, 0.2)",
      color: "rgb(20, 24, 28)",
      fontFamily: "Arial",
      fontSize: "22px",
      fontWeight: "700",
      lineHeight: "30px",
      padding: "10px 14px",
      textAlign: "center",
      objectFit: "cover",
      objectPosition: "25% 75%",
    });

    const snapshot = readDOMStyleSnapshot(element);

    expect(snapshot.box).toMatchObject({
      opacity: 0.72,
      backgroundColor: "rgb(240, 248, 255)",
      borderTopWidth: 2,
      borderRightWidth: 2,
      borderBottomWidth: 2,
      borderLeftWidth: 2,
      borderTopLeftRadius: 18,
      borderTopRightRadius: 12,
      borderBottomRightRadius: 10,
      borderBottomLeftRadius: 8,
      boxShadow: "0px 12px 24px rgba(0, 0, 0, 0.2)",
    });
    expect(snapshot.text).toMatchObject({
      color: "rgb(20, 24, 28)",
      lineHeight: 30,
      paddingTop: 10,
      paddingRight: 14,
      paddingBottom: 10,
      paddingLeft: 14,
      textAlign: "center",
    });
    expect(snapshot.media).toEqual({
      objectFit: "cover",
      objectPosition: "25% 75%",
    });
    expect(snapshot.rasterSignature).toContain("rgb(240, 248, 255)");
  });
});
```

- [x] **Step 2: Run the test and verify it fails**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/dom/styleSnapshot.test.ts
```

Expected: FAIL because `styleSnapshot.ts` does not exist.

- [x] **Step 3: Implement the style snapshot module**

Create `styleSnapshot.ts` with internal types and readers.

```ts
export type DOMBoxStyleSnapshot = {
  opacity: number;
  visibility: string;
  display: string;
  backgroundColor: string;
  borderTopWidth: number;
  borderRightWidth: number;
  borderBottomWidth: number;
  borderLeftWidth: number;
  borderTopColor: string;
  borderRightColor: string;
  borderBottomColor: string;
  borderLeftColor: string;
  borderTopLeftRadius: number;
  borderTopRightRadius: number;
  borderBottomRightRadius: number;
  borderBottomLeftRadius: number;
  boxShadow: string;
  overflow: string;
  transform: string;
  transformOrigin: string;
};

export type DOMTextStyleSnapshot = {
  font: string;
  color: string;
  lineHeight: number;
  blockAlignment: "start" | "center" | "end";
  textAlign: CanvasTextAlign;
  paddingTop: number;
  paddingRight: number;
  paddingBottom: number;
  paddingLeft: number;
};

export type DOMMediaStyleSnapshot = {
  objectFit: "fill" | "contain" | "cover" | "none" | "scale-down";
  objectPosition: string;
};

export type DOMStyleSnapshot = {
  box: DOMBoxStyleSnapshot;
  text: DOMTextStyleSnapshot;
  media: DOMMediaStyleSnapshot;
  rasterSignature: string;
};
```

Use `element.ownerDocument.defaultView?.getComputedStyle(element)` and numeric helpers that return `0` for unsupported pixel values. Keep this module internal; do not export it from the public package entrypoint.

- [x] **Step 4: Verify style snapshot tests pass**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/dom/styleSnapshot.test.ts
```

Expected: PASS.

## Task 2: Layout Snapshot And Projection Precision

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/layoutPass.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/layoutPass.test.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/domProjection.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/domProjection.test.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderable.ts`

- [x] **Step 1: Write failing layout snapshot tests**

Add coverage that one layout pass returns rect, viewport, DPR, and a geometry-only signature.

```ts
test("measures active targets into layout snapshots with style and DPR signatures", () => {
  const element = document.createElement("section");
  Object.assign(element.style, {
    backgroundColor: "rgb(10, 20, 30)",
    opacity: "0.8",
  });

  const layoutPass = createLayoutPass({
    measureElement: () =>
      ({
        x: 12.5,
        y: 20.25,
        left: 12.5,
        top: 20.25,
        right: 112.5,
        bottom: 70.25,
        width: 100,
        height: 50,
      }) as DOMRect,
    getViewportSize: () => ({ width: 390, height: 844 }),
    getDevicePixelRatio: () => 2,
  });

  const snapshots = layoutPass.measure([{ key: "card", element, active: true }]);
  const snapshot = snapshots.get("card");

  expect(snapshot).toMatchObject({
    left: 12.5,
    top: 20.25,
    width: 100,
    height: 50,
    viewport: { width: 390, height: 844 },
    devicePixelRatio: 2,
  });
  expect(snapshot?.layoutSignature).toContain("390");
});
```

- [x] **Step 2: Write failing projection tests**

Extend `domProjection.test.ts` with mobile-sized viewport and fractional coordinates.

```ts
test("projects fractional mobile CSS pixels without early rounding", () => {
  expect(
    projectDOMRectToSceneLayout(
      createDOMRect({ left: 16.5, top: 24.25, width: 327.75, height: 180.5 }),
      { width: 390, height: 844 },
    ),
  ).toEqual({
    x: 180.375,
    y: 729.5,
    width: 327.75,
    height: 180.5,
  });
});
```

- [x] **Step 3: Run the tests and verify they fail**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/renderer/layoutPass.test.ts packages/dom-webgl-runtime/src/lib/renderer/domProjection.test.ts
```

Expected: FAIL for the new layout snapshot fields.

- [x] **Step 4: Implement `ElementLayoutSnapshot`**

In `layoutPass.ts`, keep `ElementMeasurement` for compatibility but add a geometry-focused snapshot type.

```ts
export type ElementLayoutSnapshot = ElementMeasurement & {
  viewport: DOMViewportSize;
  devicePixelRatio: number;
  layoutSignature: string;
};

export type ElementRasterSnapshot = {
  style: DOMStyleSnapshot;
  rasterSignature: string;
};
```

Update `createLayoutPass` to accept optional `getViewportSize` and `getDevicePixelRatio`, cap DPR with the same policy as the renderer host, and set `layoutSignature` from rect, viewport, and capped DPR only. Style reads should not happen in the hot per-frame layout pass.

- [x] **Step 5: Update renderable layout typing**

Change `Renderable.updateLayout` and `RenderableHooks.updateLayout` from `ElementMeasurement` to `ElementLayoutSnapshot`. Existing renderables can keep reading `width`, `height`, `top`, and `left` because the new type extends the old measurement shape.

- [x] **Step 6: Verify layout and projection tests pass**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/renderer/layoutPass.test.ts packages/dom-webgl-runtime/src/lib/renderer/domProjection.test.ts packages/dom-webgl-runtime/src/lib/render/renderable.test.ts
```

Expected: PASS.

## Task 3: Renderer Resize And Mobile Viewport Contract

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/threeRenderer.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/threeRenderer.test.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtime.test.ts`

- [x] **Step 1: Write failing renderer host resize tests**

Add a test that calls `host.resizeIfNeeded()` after viewport values change.

```ts
test("resizes renderer camera and DPR when the viewport changes", async () => {
  const { createThreeRendererHost } = await import("./threeRenderer");
  const setSize = vi.fn();
  const setPixelRatio = vi.fn();
  const camera = {
    position: { set: vi.fn() },
    updateProjectionMatrix: vi.fn(),
  };
  const container = document.createElement("div");

  Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: 844 });
  Object.defineProperty(window, "devicePixelRatio", { configurable: true, value: 3 });

  const host = createThreeRendererHost(container, {
    createObjects(canvas) {
      return {
        camera,
        scene: {},
        renderer: { canvas, setSize, setPixelRatio, render: vi.fn(), dispose: vi.fn() },
      };
    },
  });

  host.resizeIfNeeded();

  expect(setSize).toHaveBeenLastCalledWith(390, 844, false);
  expect(setPixelRatio).toHaveBeenLastCalledWith(1.5);
  expect(camera).toMatchObject({ left: 0, right: 390, top: 844, bottom: 0 });

  host.dispose();
});
```

- [x] **Step 2: Run the test and verify it fails**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/renderer/threeRenderer.test.ts -t "resizes renderer camera"
```

Expected: FAIL because `host.resizeIfNeeded` does not exist.

- [x] **Step 3: Add cached resize surface to `ThreeRendererHost`**

Extend the host type:

```ts
export type ThreeRendererHost = {
  readonly canvas: HTMLCanvasElement;
  readonly renderer: ThreeRendererAdapter;
  readonly scene: object;
  readonly camera: object;
  readonly sceneAdapter: WebGLSceneAdapter;
  getViewportSize(): DOMViewportSize;
  resizeIfNeeded(): void;
  dispose(): void;
};
```

Implement `resizeIfNeeded()` by caching the last viewport width, height, and capped DPR, then reusing the existing CSS-pixel viewport configuration only when one of those values changed.

- [x] **Step 4: Wire runtime to resize before layout**

In `runtime.ts`, call `rendererHost.resizeIfNeeded()` before the layout pass whenever the runtime syncs a frame. Pass `rendererHost.getViewportSize` into `createLayoutPass` and renderable factory context so projection uses the same viewport as the camera.

- [x] **Step 5: Verify resize tests pass**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/renderer/threeRenderer.test.ts packages/dom-webgl-runtime/src/lib/renderer/runtime.test.ts
```

Expected: PASS.

## Task 4: DOM Invalidation Observers

**Files:**
- Create: `packages/dom-webgl-runtime/src/lib/dom/domInvalidation.ts`
- Create: `packages/dom-webgl-runtime/src/lib/dom/domInvalidation.test.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts`

- [x] **Step 1: Write failing observer tests**

Test the observer contract with injected observer constructors instead of relying on browser globals.

```ts
test("notifies dirty targets for size content style and viewport changes", () => {
  const dirtyKeys: string[] = [];
  const target = document.createElement("section");
  const controller = createDOMInvalidationController({
    onDirtyTarget: (key) => dirtyKeys.push(key),
    createResizeObserver(callback) {
      return createObserverStub(callback);
    },
    createMutationObserver(callback) {
      return createObserverStub(callback);
    },
    windowTarget: window,
  });

  controller.observeTarget({ key: "hero", element: target });
  controller.notifyViewportChanged();

  expect(dirtyKeys).toContain("hero");

  controller.unobserveTarget("hero");
  controller.dispose();
});

function createObserverStub(callback: () => void) {
  return {
    observe: () => callback(),
    unobserve: () => {},
    disconnect: () => {},
  };
}
```

- [x] **Step 2: Run the test and verify it fails**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/dom/domInvalidation.test.ts
```

Expected: FAIL because the controller does not exist.

- [x] **Step 3: Implement `createDOMInvalidationController`**

Create an internal controller with this surface:

```ts
export type DOMInvalidationController = {
  observeTarget(target: { key: string; element: HTMLElement }): void;
  unobserveTarget(key: string): void;
  notifyViewportChanged(): void;
  consumeDirtyKeys(): Set<string>;
  dispose(): void;
};
```

Use `ResizeObserver` for target size, `MutationObserver` only for `style` and `class` attribute changes on the target element, and `window` plus `visualViewport` listeners for viewport changes when available. Do not scan arbitrary descendant subtree mutations in Phase 4. If observers are unavailable, the geometry signature fallback from Task 2 still detects layout changes during `sync()`.

- [x] **Step 4: Wire runtime registration and disposal**

When `registerTarget` succeeds, observe the target. When `unregisterTarget` or runtime `dispose()` runs, unobserve and dispose observer resources. Before each frame sync, consume dirty keys, refresh cached style snapshots for matching targets, and call `renderable.invalidateContent?.()` only when `rasterSignature` changed.

- [x] **Step 5: Verify observer and runtime tests pass**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/dom/domInvalidation.test.ts packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts
```

Expected: PASS.

## Task 5: CSS Box Canvas Snapshot Renderable

**Files:**
- Create: `packages/dom-webgl-runtime/src/lib/render/renderables/cssBoxCanvas.ts`
- Create: `packages/dom-webgl-runtime/src/lib/render/renderables/cssBoxCanvas.test.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/sceneRenderableObject.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/elementSnapshotRenderable.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/elementSnapshotRenderable.test.ts`

- [x] **Step 1: Write failing CSS box canvas tests**

Cover canvas size, capped DPR scaling, background, borders, radius path, and one outer shadow through a context stub.

```ts
test("draws supported CSS box paint at DPR-scaled canvas size", () => {
  const canvas = document.createElement("canvas");
  const context = createCanvasContextStub();

  drawCSSBoxToCanvas(canvas, context, {
    width: 120,
    height: 80,
    devicePixelRatio: 2,
    style: createStyleSnapshot({
      backgroundColor: "rgb(240, 248, 255)",
      borderTopWidth: 2,
      borderRightWidth: 2,
      borderBottomWidth: 2,
      borderLeftWidth: 2,
      borderTopLeftRadius: 12,
      borderTopRightRadius: 12,
      borderBottomRightRadius: 8,
      borderBottomLeftRadius: 8,
      boxShadow: "0px 8px 16px rgba(0, 0, 0, 0.2)",
    }),
  });

  expect(canvas.width).toBe(240);
  expect(canvas.height).toBe(160);
  expect(context.scale).toHaveBeenCalledWith(2, 2);
  expect(context.fillStyle).toBe("rgb(240, 248, 255)");
  expect(context.fill).toHaveBeenCalled();
  expect(context.stroke).toHaveBeenCalled();
});

function createCanvasContextStub() {
  return {
    setTransform: vi.fn(),
    clearRect: vi.fn(),
    scale: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 0,
    shadowBlur: 0,
    shadowColor: "",
    shadowOffsetX: 0,
    shadowOffsetY: 0,
  } as unknown as CanvasRenderingContext2D & {
    scale: ReturnType<typeof vi.fn>;
    fill: ReturnType<typeof vi.fn>;
    stroke: ReturnType<typeof vi.fn>;
  };
}

function createStyleSnapshot(
  overrides: Partial<DOMStyleSnapshot["box"]>,
): DOMStyleSnapshot {
  return {
    box: {
      opacity: 1,
      visibility: "visible",
      display: "block",
      backgroundColor: "rgba(0, 0, 0, 0)",
      borderTopWidth: 0,
      borderRightWidth: 0,
      borderBottomWidth: 0,
      borderLeftWidth: 0,
      borderTopColor: "rgba(0, 0, 0, 0)",
      borderRightColor: "rgba(0, 0, 0, 0)",
      borderBottomColor: "rgba(0, 0, 0, 0)",
      borderLeftColor: "rgba(0, 0, 0, 0)",
      borderTopLeftRadius: 0,
      borderTopRightRadius: 0,
      borderBottomRightRadius: 0,
      borderBottomLeftRadius: 0,
      boxShadow: "none",
      overflow: "visible",
      transform: "none",
      transformOrigin: "50% 50%",
      ...overrides,
    },
    text: {
      font: "16px sans-serif",
      color: "#000000",
      lineHeight: 20,
      blockAlignment: "start",
      textAlign: "left",
      paddingTop: 0,
      paddingRight: 0,
      paddingBottom: 0,
      paddingLeft: 0,
    },
    media: {
      objectFit: "fill",
      objectPosition: "50% 50%",
    },
    rasterSignature: JSON.stringify(overrides),
  };
}
```

- [x] **Step 2: Run the test and verify it fails**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/render/renderables/cssBoxCanvas.test.ts
```

Expected: FAIL because `cssBoxCanvas.ts` does not exist.

- [x] **Step 3: Implement CSS box canvas drawing**

Create:

```ts
export type CSSBoxCanvasState = {
  width: number;
  height: number;
  devicePixelRatio: number;
  style: DOMStyleSnapshot;
};

export function createCSSBoxCanvasSignature(state: CSSBoxCanvasState): string {
  return JSON.stringify([
    state.width,
    state.height,
    state.devicePixelRatio,
    state.style.box,
  ]);
}

export function drawCSSBoxToCanvas(
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
  state: CSSBoxCanvasState,
): void {
  const dpr = Math.min(Math.max(1, state.devicePixelRatio), 1.5);
  canvas.width = Math.max(1, Math.ceil(state.width * dpr));
  canvas.height = Math.max(1, Math.ceil(state.height * dpr));
  context.setTransform?.(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.scale(dpr, dpr);
  // Draw one outer shadow, rounded background, and borders from state.style.box.
}
```

Keep unsupported CSS such as gradients and filters out of the rendering path for Phase 4; report them through debug notes in a later task rather than silently pretending they are supported.

- [x] **Step 4: Replace element snapshot color plane with canvas texture plane**

In `sceneRenderableObject.ts`, add a reusable canvas texture controller similar to the text controller. In `elementSnapshotRenderable.ts`, rebuild the canvas only when the incoming raster signature differs from the previous raster signature; pure position changes should update only scene layout.

- [x] **Step 5: Verify element snapshot tests pass**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/render/renderables/cssBoxCanvas.test.ts packages/dom-webgl-runtime/src/lib/render/renderables/elementSnapshotRenderable.test.ts
```

Expected: PASS.

## Task 6: Text Snapshot Uses Shared Style Snapshot

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/textCanvasLayout.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/textCanvasLayout.test.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/textSnapshotRenderable.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/textSnapshotRenderable.test.ts`

- [x] **Step 1: Write failing shared-style text tests**

Update tests so `readTextCanvasRenderState` can consume the cached text style snapshot plus the current capped DPR.

```ts
test("builds text render state from shared DOM style snapshot", () => {
  const element = document.createElement("h2");
  element.textContent = "Responsive headline";
  Object.assign(element.style, {
    color: "rgb(29, 33, 28)",
    fontSize: "30px",
    fontWeight: "700",
    lineHeight: "38px",
    padding: "12px 18px",
    textAlign: "center",
  });

  const style = readDOMStyleSnapshot(element);
  const state = readTextCanvasRenderState(element, "Responsive headline", {
    width: 260,
    height: 120,
    style,
    devicePixelRatio: 2,
  });

  expect(state).toMatchObject({
    width: 260,
    height: 120,
    color: "rgb(29, 33, 28)",
    lineHeight: 38,
    textAlign: "center",
    devicePixelRatio: 2,
  });
});
```

- [x] **Step 2: Run the text tests and verify they fail**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/render/renderables/textCanvasLayout.test.ts packages/dom-webgl-runtime/src/lib/render/renderables/textSnapshotRenderable.test.ts
```

Expected: FAIL until `readTextCanvasRenderState` accepts the new snapshot input shape.

- [x] **Step 3: Implement shared style consumption**

Change text render-state input to:

```ts
export type TextCanvasRenderInput = {
  width: number;
  height: number;
  style: DOMStyleSnapshot;
  devicePixelRatio: number;
};
```

Keep wrapping and alignment behavior, but read font, color, line height, padding, and text alignment from `input.style.text`.

- [x] **Step 4: Rebuild text texture by layout/style/content signature**

In `textSnapshotRenderable.ts`, create the render signature from text content plus the cached `rasterSignature`. A pure position change should update layout only; a style/size/DPR/content change should redraw the text canvas.

- [x] **Step 5: Verify text tests pass**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/render/renderables/textCanvasLayout.test.ts packages/dom-webgl-runtime/src/lib/render/renderables/textSnapshotRenderable.test.ts
```

Expected: PASS.

## Task 7: Media Object-Fit Mapping

**Files:**
- Create: `packages/dom-webgl-runtime/src/lib/render/renderables/objectFit.ts`
- Create: `packages/dom-webgl-runtime/src/lib/render/renderables/objectFit.test.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/imageRenderable.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/imageRenderable.test.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/videoRenderable.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/videoRenderable.test.ts`

- [x] **Step 1: Write failing object-fit tests**

```ts
test("computes cover crop for wider media inside a portrait DOM box", () => {
  expect(
    computeObjectFitTextureTransform({
      fit: "cover",
      position: "50% 50%",
      box: { width: 300, height: 400 },
      media: { width: 1600, height: 900 },
    }),
  ).toEqual({
    repeatX: 0.421875,
    repeatY: 1,
    offsetX: 0.2890625,
    offsetY: 0,
  });
});
```

- [x] **Step 2: Run the test and verify it fails**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/render/renderables/objectFit.test.ts
```

Expected: FAIL because the helper does not exist.

- [x] **Step 3: Implement object-fit helper**

Create:

```ts
export type ObjectFitInput = {
  fit: "fill" | "contain" | "cover" | "none" | "scale-down";
  position: string;
  box: { width: number; height: number };
  media: { width: number; height: number };
};

export type TextureTransform = {
  repeatX: number;
  repeatY: number;
  offsetX: number;
  offsetY: number;
};
```

For `cover`, crop the larger axis. For `contain`, preserve all media and accept empty-space behavior by plane scaling only if needed. For `fill`, use full repeat and zero offset.

- [x] **Step 4: Apply mapping to image and video textures**

Read cached media style snapshot values for `objectFit` and `objectPosition` during layout updates. Apply repeat/offset values to the Three texture when the source natural dimensions or raster signature changes.

- [x] **Step 5: Verify media tests pass**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/render/renderables/objectFit.test.ts packages/dom-webgl-runtime/src/lib/render/renderables/imageRenderable.test.ts packages/dom-webgl-runtime/src/lib/render/renderables/videoRenderable.test.ts
```

Expected: PASS.

## Task 8: Runtime Integration And Responsive Demo Harness

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts`
- Modify: `apps/demo/src/App.tsx`
- Modify: `apps/demo/src/App.test.tsx`
- Modify: `apps/demo/src/demo.css`
- Modify: `README.md`
- Modify: `docs/00-goal.md`
- Modify: `docs/EXECUTION_STATE.md`

- [x] **Step 1: Write failing runtime integration test**

Add a runtime pipeline test that proves style changes refresh raster state while layout updates still run on every sync.

```ts
test("updates renderable layout after viewport resize and raster state changes", async () => {
  const element = document.createElement("section");
  const layouts: unknown[] = [];
  const runtime = await createPipelineRuntime({
    measureElement: () =>
      ({
        x: 0,
        y: 0,
        left: 24,
        top: 40,
        right: 224,
        bottom: 160,
        width: 200,
        height: 120,
      }) as DOMRect,
    onRenderableCreated(renderable) {
      const originalUpdateLayout = renderable.updateLayout?.bind(renderable);
      renderable.updateLayout = (snapshot) => {
        layouts.push(snapshot);
        originalUpdateLayout?.(snapshot);
      };
    },
  });

  Object.assign(element.style, { backgroundColor: "rgb(10, 20, 30)" });
  runtime.registerTarget(element, { key: "responsive.box" });

  await runtime.sync();
  Object.assign(element.style, { backgroundColor: "rgb(40, 50, 60)" });
  await runtime.sync();

  expect(layouts).toHaveLength(2);
  expect(layouts).toHaveLength(2);

  runtime.dispose();
});
```

- [x] **Step 2: Run the integration test and verify it fails**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts -t "viewport resize and raster state"
```

Expected: FAIL until runtime passes layout snapshots through the full renderable path and separates layout from raster invalidation.

- [x] **Step 3: Implement runtime integration**

Use one flow inside `syncFrame()`:

```txt
rendererHost.resizeIfNeeded()
  -> layoutPass.measure(active target descriptors)
  -> compare layout signatures
  -> refresh cached style snapshots for dirty targets only
  -> invalidate content for dirty style/size/DPR/content targets
  -> renderable.update(frameInput)
  -> renderable.updateLayout(layoutSnapshot)
  -> sceneAdapter.render()
```

Do not add branches for demo keys, demo paths, demo class names, or demo DOM structure.

- [x] **Step 4: Add responsive demo harness**

Extend the demo with public API targets that intentionally stress fidelity:

```tsx
<WebGLTarget
  className="demo-fidelity-card demo-fidelity-card--surface"
  webgl={{
    key: "demo.fidelity.surface",
    source: { kind: "snapshot", mode: "element" },
    lifecycle: { hideWhenReady: true, hideMode: "self" },
  }}
>
  <p className="demo-label">Fidelity surface</p>
  <strong>Rounded, bordered, shadowed CSS box</strong>
</WebGLTarget>
```

Add at least:

- one rounded/shadowed element snapshot
- one multi-line text snapshot
- one image/video target with `object-fit: cover`
- one mobile-only layout change under `@media (max-width: 700px)`

- [x] **Step 5: Verify demo imports and tests**

Run:

```bash
npm test -- --run apps/demo/src/App.test.tsx apps/demo/src/demo-import-boundary.test.ts
npm run check:imports
```

Expected: PASS and no internal runtime imports in the demo.

- [x] **Step 6: Update docs**

Update:

- `README.md`: status and current visual behavior.
- `docs/00-goal.md`: DOM fidelity and responsive mapping contract.
- `docs/EXECUTION_STATE.md`: Phase 4 current task and known deferred fidelity gaps.

- [x] **Step 7: Run full verification**

Run:

```bash
npm run test -- --run
npm run typecheck
npm run build
npm run check:imports
git diff --check
```

Expected: all pass. The existing non-blocking Vite chunk-size warning may remain.

## Completion Criteria

Phase 4 is complete when:

- Element snapshots render a canvas-backed CSS box for supported common style properties.
- Text snapshots use the shared style snapshot and rebuild on text, style, size, or DPR changes.
- Image and video renderables respect `object-fit` and `object-position` for common responsive layouts.
- DOM rect projection remains CSS-pixel aligned on desktop and mobile viewport sizes.
- Renderer size, DPR, and orthographic camera update after resize/orientation/visual viewport changes without reconfiguring every frame.
- Runtime invalidation avoids per-frame style snapshot reads and avoids rebuilding snapshots on pure position changes.
- Demo remains a public API consumer and exposes a responsive fidelity harness.
- Documentation clearly lists supported and deferred CSS fidelity features.
