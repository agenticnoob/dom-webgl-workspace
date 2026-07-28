# Unified Source Capability Handles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Expose low-level, reusable output handles for every supported source kind: `snapshot/element`, `snapshot/text`, `image`, `video`, and `model/glb`.

**Implementation status:** Completed on `2026-06-21`. The package exposes the
public handle types from the root entrypoint, renderables attach runtime-owned
source capability handles, demo effects consume each handle as application-owned
examples, and docs/tests are aligned with the package boundary.

**Current truth update:** After the ScrollZoomImage gallery migration, common
target/model/renderable controls also include scene-space `setPosition(...)`.
The "Starting Truth" section below records the pre-plan baseline and should not
be copied as current API surface.

**Architecture:** Keep all concrete effects consumer-owned. The package exposes controlled render-output primitives through `defineWebGLEffect(...)` context: canvas surface, text/glyph layer, texture layer, video layer, and model handle. Effects receive inputs from `ctx.source`, `ctx.pointer`, `ctx.scroll`, `ctx.layout`, and `ctx.time`, then mutate only runtime-managed output handles. Renderer, camera, scene, render order, depth flags, ray picking, multiple canvases, and concrete presets remain internal.

**Tech Stack:** TypeScript, Three.js internal renderables, CanvasTexture, Vitest, public export type fixtures, docs in `README.md`, `docs/00-goal.md`, `docs/agent/package-usage.md`, and `docs/EXECUTION_STATE.md`.

---

## Decision From The Text Effect Discussion

The right API is not `setScramble()` or `setPressure()`. It is also not direct raw access to the entire internal runtime.

The correct package capability is a set of low-level output handles:

- `snapshot/element` gets a canvas-backed surface handle for custom drawing and material/object control.
- `snapshot/text` gets a text layer handle with canvas, texture, DOM-derived style, glyph layout, `draw(...)`, `setText(...)`, and glyph render commands.
- `image` gets a texture layer handle with object/material/texture control and texture transform.
- `video` gets the texture layer handle plus playback controls.
- `model/glb` keeps the model handle and gains the same common object controls.

This means future effects such as scrambled text, text pressure, wave text, split reveal, media displacement, image hover distortion, video playback scrubbing, or GLB particle effects are all user-authored effects on the same primitives.

## Starting Truth Before This Plan

- Public effect authoring is `defineWebGLEffect(...)` plus runtime-level `effects`.
- The package does not export concrete visual effects and must not reintroduce an `./effects` subpath.
- Existing `ctx.source.kind` values already cover `snapshot/element`, `snapshot/text`, `image`, `video`, and `model/glb`.
- Existing `ctx.target` only gives generic target controls: visible, rotation, scale, opacity, and `addObject3D`. Superseded current truth: target handles now also expose scene-space `setPosition(...)`.
- Existing `snapshot/text` can render a runtime text canvas internally, but the effect context does not expose canvas, texture, style, glyph layout, or draw hooks.
- Existing `image` and `video` renderables create texture planes internally, but the effect context does not expose texture/material/mesh handles.
- Existing `model/glb` exposes model helpers, but common controls should be aligned with other source handles.

## Public API Shape

Implement this public discriminated union in `packages/dom-webgl-runtime/src/lib/effects/effectAuthoring.ts`:

```ts
export type WebGLEffectSourceHandle =
  | {
      kind: "snapshot/element";
      element: HTMLElement;
      surface?: WebGLEffectCanvasSurfaceHandle;
    }
  | {
      kind: "snapshot/text";
      element: HTMLElement;
      text: string;
      textLayer?: WebGLEffectTextLayerHandle;
    }
  | {
      kind: "image";
      element: HTMLImageElement;
      src: string;
      image?: WebGLEffectTextureLayerHandle<HTMLImageElement>;
    }
  | {
      kind: "video";
      element: HTMLVideoElement;
      src: string;
      video?: WebGLEffectVideoLayerHandle;
    }
  | {
      kind: "model/glb";
      anchor: HTMLElement;
      src: string;
      model: WebGLModelEffectHandle;
    };
```

Use these public handle types:

```ts
export type WebGLEffectRenderableHandle = {
  readonly object3D: unknown;
  setVisible?(visible: boolean): void;
  setPosition?(x: number, y: number, z?: number): void;
  setRotation?(x: number, y: number, z?: number): void;
  setScale?(x: number, y?: number, z?: number): void;
  setOpacity?(opacity: number): void;
};

export type WebGLEffectCanvasSurfaceHandle = WebGLEffectRenderableHandle & {
  readonly canvas: HTMLCanvasElement;
  readonly context: CanvasRenderingContext2D | null;
  readonly texture: unknown;
  readonly mesh: unknown;
  readonly material: unknown;
  clear(): void;
  draw(drawer: WebGLEffectCanvasDrawer): void;
  invalidate(): void;
  getSize(): { width: number; height: number; devicePixelRatio: number };
};

export type WebGLEffectCanvasDrawer = (context: {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  width: number;
  height: number;
  devicePixelRatio: number;
}) => void;

export type WebGLTextGlyph = {
  index: number;
  char: string;
  line: number;
  x: number;
  y: number;
  width: number;
  height: number;
  baseline: number;
};

export type WebGLTextGlyphRenderCommand = Partial<WebGLTextGlyph> & {
  index: number;
  char?: string;
  opacity?: number;
  scaleX?: number;
  scaleY?: number;
  rotation?: number;
  color?: string;
};

export type WebGLEffectTextLayerHandle = WebGLEffectCanvasSurfaceHandle & {
  readonly text: string;
  readonly style: WebGLTextLayerStyle;
  getGlyphs(): readonly WebGLTextGlyph[];
  setText(text: string): void;
  setGlyphs(
    transform: (
      glyphs: readonly WebGLTextGlyph[],
    ) => readonly WebGLTextGlyphRenderCommand[],
  ): void;
};

export type WebGLTextLayerStyle = {
  font: string;
  lineHeight: number;
  letterSpacing: number;
  wordSpacing: number;
  textAlign: CanvasTextAlign;
  color: string;
};

export type WebGLEffectTextureTransform = {
  repeatX?: number;
  repeatY?: number;
  offsetX?: number;
  offsetY?: number;
};

export type WebGLEffectTextureLayerHandle<
  TSource extends HTMLImageElement | HTMLVideoElement =
    | HTMLImageElement
    | HTMLVideoElement,
> = WebGLEffectRenderableHandle & {
  readonly source: TSource;
  readonly texture: unknown;
  readonly mesh: unknown;
  readonly material: unknown;
  setTextureTransform(transform: WebGLEffectTextureTransform): void;
  invalidate(): void;
};

export type WebGLEffectVideoLayerHandle =
  WebGLEffectTextureLayerHandle<HTMLVideoElement> & {
    play(): Promise<void> | void;
    pause(): void;
    setMuted(muted: boolean): void;
    setPlaybackRate(rate: number): void;
  };
```

`WebGLModelEffectHandle` should extend `WebGLEffectRenderableHandle` and keep its existing helpers:

```ts
export type WebGLModelEffectHandle = WebGLEffectRenderableHandle & {
  readonly object3D: unknown;
  traverseMeshes(visitor: (mesh: unknown) => void): void;
  sampleVertices(options?: { maxPoints?: number }): Float32Array;
  createPointCloud(options: {
    density?: number;
    color?: number | string;
    size?: number;
  }): unknown;
};
```

---

## File Structure

- Modify `packages/dom-webgl-runtime/src/lib/effects/effectAuthoring.ts`
  - Own public handle types and source union.
- Modify `packages/dom-webgl-runtime/src/index.ts`
  - Export new public handle types.
- Modify `packages/dom-webgl-runtime/src/publicExports.test.ts`
  - Type-check every new public handle and reject internal renderer types.
- Modify `packages/dom-webgl-runtime/src/lib/render/renderables/textCanvasLayout.ts`
  - Extract glyph layout computation from the existing text canvas rendering path.
- Modify `packages/dom-webgl-runtime/src/lib/render/renderables/textCanvasLayout.test.ts`
  - Lock glyph layout for wrapping, line index, x/y, width, height, and spacing.
- Create `packages/dom-webgl-runtime/src/lib/render/renderables/sourceCapabilityHandles.ts`
  - Internal factories for canvas surface, text layer, texture layer, video layer.
- Create `packages/dom-webgl-runtime/src/lib/render/renderables/sourceCapabilityHandles.test.ts`
  - Unit coverage for handle behavior.
- Modify `packages/dom-webgl-runtime/src/lib/render/renderables/sceneRenderableObject.ts`
  - Attach output handles to scene renderable objects.
- Modify renderables:
  - `packages/dom-webgl-runtime/src/lib/render/renderables/elementSnapshotRenderable.ts`
  - `packages/dom-webgl-runtime/src/lib/render/renderables/textSnapshotRenderable.ts`
  - `packages/dom-webgl-runtime/src/lib/render/renderables/imageRenderable.ts`
  - `packages/dom-webgl-runtime/src/lib/render/renderables/videoRenderable.ts`
  - `packages/dom-webgl-runtime/src/lib/render/renderables/modelRenderable.ts`
- Modify model and target helpers:
  - `packages/dom-webgl-runtime/src/lib/render/renderables/modelEffectHandle.ts`
  - `packages/dom-webgl-runtime/src/lib/render/renderables/effectTargets/elementPlaneEffectTarget.ts`
- Modify docs:
  - `README.md`
  - `docs/00-goal.md`
  - `docs/agent/package-usage.md`
  - `docs/agent/custom-effects.md`
  - `docs/EXECUTION_STATE.md`

---

### Task 1: Lock Public API Types

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/effects/effectAuthoring.ts`
- Modify: `packages/dom-webgl-runtime/src/index.ts`
- Modify: `packages/dom-webgl-runtime/src/publicExports.test.ts`

- [x] **Step 1: Add failing public type fixture**

In `packages/dom-webgl-runtime/src/publicExports.test.ts`, extend the root entrypoint fixture imports with:

```ts
import type {
  WebGLEffectCanvasDrawer,
  WebGLEffectCanvasSurfaceHandle,
  WebGLEffectRenderableHandle,
  WebGLEffectTextLayerHandle,
  WebGLEffectTextureLayerHandle,
  WebGLEffectTextureTransform,
  WebGLEffectVideoLayerHandle,
  WebGLTextGlyph,
  WebGLTextGlyphRenderCommand,
  WebGLTextLayerStyle,
} from "${importPath}";
```

Add this fixture body:

```ts
const sourceCapabilityEffect = defineWebGLEffect({
  kind: "custom.sourceCapabilities",
  update(ctx) {
    if (ctx.source.kind === "snapshot/element") {
      ctx.source.surface satisfies WebGLEffectCanvasSurfaceHandle | undefined;
      ctx.source.surface?.draw(({ context }) => {
        context.fillRect(0, 0, 10, 10);
      });
    }

    if (ctx.source.kind === "snapshot/text") {
      ctx.source.textLayer satisfies WebGLEffectTextLayerHandle | undefined;
      const glyphs = ctx.source.textLayer?.getGlyphs() ?? [];
      glyphs satisfies readonly WebGLTextGlyph[];
      ctx.source.textLayer?.setGlyphs((entries) =>
        entries.map((glyph) => ({
          index: glyph.index,
          char: glyph.char,
          scaleX: 1,
          scaleY: 1,
          opacity: 1,
        })),
      );
    }

    if (ctx.source.kind === "image") {
      ctx.source.image satisfies
        | WebGLEffectTextureLayerHandle<HTMLImageElement>
        | undefined;
      ctx.source.image?.setTextureTransform({ repeatX: 1, repeatY: 1 });
    }

    if (ctx.source.kind === "video") {
      ctx.source.video satisfies WebGLEffectVideoLayerHandle | undefined;
      ctx.source.video?.setMuted(true);
      ctx.source.video?.setPlaybackRate(1);
    }

    if (ctx.source.kind === "model/glb") {
      ctx.source.model satisfies WebGLEffectRenderableHandle;
      ctx.source.model.sampleVertices({ maxPoints: 64 });
    }
  },
});

sourceCapabilityEffect satisfies WebGLEffectDefinition;
({ repeatX: 1, offsetY: 0 }) satisfies WebGLEffectTextureTransform;
({ index: 0, char: "A" }) satisfies WebGLTextGlyphRenderCommand;
declare const drawer: WebGLEffectCanvasDrawer;
drawer satisfies WebGLEffectCanvasDrawer;
declare const style: WebGLTextLayerStyle;
style.font satisfies string;
```

- [x] **Step 2: Run the fixture and verify failure**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/publicExports.test.ts -t "root entrypoint type-checks public types and hides internal types"
```

Expected: FAIL because the new handle types and source fields are not implemented yet.

- [x] **Step 3: Implement public types and root exports**

Add the public API shape from the "Public API Shape" section to `effectAuthoring.ts`, then export all new type names from `packages/dom-webgl-runtime/src/index.ts`.

- [x] **Step 4: Run the fixture and verify pass**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/publicExports.test.ts -t "root entrypoint type-checks public types and hides internal types"
```

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add packages/dom-webgl-runtime/src/lib/effects/effectAuthoring.ts packages/dom-webgl-runtime/src/index.ts packages/dom-webgl-runtime/src/publicExports.test.ts
git commit -m "feat: expose source capability handle types"
```

---

### Task 2: Extract Text Glyph Layout

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/textCanvasLayout.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/textCanvasLayout.test.ts`

- [x] **Step 1: Add failing glyph layout tests**

Add tests that call a new exported `computeTextGlyphLayout(...)` helper:

```ts
test("computes per-glyph layout for wrapped text", () => {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  expect(context).not.toBeNull();

  const state = readTextCanvasRenderState(
    document.createElement("p"),
    "AB CD",
    {
      width: 120,
      height: 40,
      devicePixelRatio: 1,
    },
  );
  const glyphs = computeTextGlyphLayout(context!, "AB CD", state);

  expect(glyphs.map((glyph) => glyph.char).join("")).toBe("AB CD");
  expect(glyphs[0]).toMatchObject({
    index: 0,
    char: "A",
    line: 0,
    x: expect.any(Number),
    y: expect.any(Number),
    width: expect.any(Number),
    height: state.lineHeight,
    baseline: expect.any(Number),
  });
});
```

- [x] **Step 2: Run tests and verify failure**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/render/renderables/textCanvasLayout.test.ts
```

Expected: FAIL because `computeTextGlyphLayout` is not exported.

- [x] **Step 3: Implement `computeTextGlyphLayout(...)`**

In `textCanvasLayout.ts`, export a function that reuses the same wrapping, alignment, line-height, letter-spacing, and word-spacing path as `drawTextToCanvas(...)`. It must return `WebGLTextGlyph[]` with stable `index`, `char`, `line`, `x`, `y`, `width`, `height`, and `baseline`.

Implementation rule: do not create a second wrapping algorithm. Reuse `wrapCanvasText`, `readTextX`, `readTextStartY`, `readTextLineStartX`, `measureTextLine`, and `readTextSpacing`.

- [x] **Step 4: Run text layout tests**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/render/renderables/textCanvasLayout.test.ts
```

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add packages/dom-webgl-runtime/src/lib/render/renderables/textCanvasLayout.ts packages/dom-webgl-runtime/src/lib/render/renderables/textCanvasLayout.test.ts
git commit -m "feat: expose internal text glyph layout"
```

---

### Task 3: Build Source Capability Handle Factories

**Files:**
- Create: `packages/dom-webgl-runtime/src/lib/render/renderables/sourceCapabilityHandles.ts`
- Create: `packages/dom-webgl-runtime/src/lib/render/renderables/sourceCapabilityHandles.test.ts`

- [x] **Step 1: Add failing factory tests**

Create tests covering:

- canvas surface `draw(...)`, `clear()`, `invalidate()`, `getSize()`;
- text layer `getGlyphs()`, `setText(...)`, `setGlyphs(...)`;
- texture layer `setTextureTransform(...)`;
- video layer `play()`, `pause()`, `setMuted(...)`, `setPlaybackRate(...)`;
- common object controls `setVisible`, `setPosition`, `setRotation`,
  `setScale`, `setOpacity`.

The text-layer test must prove `setGlyphs(...)` redraws from glyph render commands without mutating the DOM element text.

- [x] **Step 2: Run tests and verify failure**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/render/renderables/sourceCapabilityHandles.test.ts
```

Expected: FAIL because the factory file does not exist.

- [x] **Step 3: Implement factories**

Create factories with these exported names:

```ts
export type CanvasSurfaceCapabilityOptions = {
  object3D: unknown;
  mesh: unknown;
  material: unknown;
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D | null;
  texture: unknown;
  getSize(): { width: number; height: number; devicePixelRatio: number };
  invalidate(): void;
};

export type TextLayerCapabilityOptions = CanvasSurfaceCapabilityOptions & {
  getText(): string;
  getStyle(): WebGLTextLayerStyle;
  getGlyphs(): readonly WebGLTextGlyph[];
  setText(text: string): void;
  drawGlyphs(commands: readonly WebGLTextGlyphRenderCommand[]): void;
};

export type TextureLayerCapabilityOptions<
  TSource extends HTMLImageElement | HTMLVideoElement,
> = {
  object3D: unknown;
  mesh: unknown;
  material: unknown;
  texture: unknown;
  source: TSource;
  invalidate(): void;
};

export function createCanvasSurfaceCapabilityHandle(
  options: CanvasSurfaceCapabilityOptions,
): WebGLEffectCanvasSurfaceHandle;

export function createTextLayerCapabilityHandle(
  options: TextLayerCapabilityOptions,
): WebGLEffectTextLayerHandle;

export function createTextureLayerCapabilityHandle<
  TSource extends HTMLImageElement | HTMLVideoElement,
>(
  options: TextureLayerCapabilityOptions<TSource>,
): WebGLEffectTextureLayerHandle<TSource>;

export function createVideoLayerCapabilityHandle(
  options: TextureLayerCapabilityOptions<HTMLVideoElement>,
): WebGLEffectVideoLayerHandle;
```

Factory behavior:

- `draw(...)` clears and redraws the existing canvas, then marks the existing texture dirty.
- `setGlyphs(...)` draws glyph commands onto the existing text canvas with per-glyph `char`, `x`, `y`, `scaleX`, `scaleY`, `rotation`, `opacity`, and optional `color`.
- `setText(...)` updates only the WebGL text layer, not DOM `textContent`.
- `invalidate()` marks the texture dirty and resets the render signature used by the renderable.
- Texture transform updates `texture.repeat`, `texture.offset`, and `texture.needsUpdate`.

- [x] **Step 4: Run factory tests**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/render/renderables/sourceCapabilityHandles.test.ts
```

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add packages/dom-webgl-runtime/src/lib/render/renderables/sourceCapabilityHandles.ts packages/dom-webgl-runtime/src/lib/render/renderables/sourceCapabilityHandles.test.ts
git commit -m "feat: add source capability handle factories"
```

---

### Task 4: Wire Handles Through Renderables

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/sceneRenderableObject.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/elementSnapshotRenderable.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/textSnapshotRenderable.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/imageRenderable.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/videoRenderable.ts`
- Modify related renderable tests.

- [x] **Step 1: Add failing renderable source assertions**

For `snapshot/element`, assert:

```ts
expect(renderable.effectSource).toMatchObject({
  kind: "snapshot/element",
  surface: expect.objectContaining({
    canvas: expect.any(HTMLCanvasElement),
    draw: expect.any(Function),
    clear: expect.any(Function),
    invalidate: expect.any(Function),
  }),
});
```

For `snapshot/text`, assert:

```ts
expect(renderable.effectSource).toMatchObject({
  kind: "snapshot/text",
  text: "Visible text",
  textLayer: expect.objectContaining({
    canvas: expect.any(HTMLCanvasElement),
    texture: expect.anything(),
    getGlyphs: expect.any(Function),
    setGlyphs: expect.any(Function),
    setText: expect.any(Function),
  }),
});
```

For `image`, assert:

```ts
expect(renderable.effectSource).toMatchObject({
  kind: "image",
  image: expect.objectContaining({
    source: source.element,
    texture: expect.anything(),
    setTextureTransform: expect.any(Function),
  }),
});
```

For `video`, assert:

```ts
expect(renderable.effectSource).toMatchObject({
  kind: "video",
  video: expect.objectContaining({
    source: source.element,
    play: expect.any(Function),
    pause: expect.any(Function),
    setMuted: expect.any(Function),
    setPlaybackRate: expect.any(Function),
  }),
});
```

- [x] **Step 2: Run renderable tests and verify failure**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/render/renderables/elementSnapshotRenderable.test.ts packages/dom-webgl-runtime/src/lib/render/renderables/textSnapshotRenderable.test.ts packages/dom-webgl-runtime/src/lib/render/renderables/imageRenderable.test.ts packages/dom-webgl-runtime/src/lib/render/renderables/videoRenderable.test.ts
```

Expected: FAIL because source handles do not include these output handles.

- [x] **Step 3: Attach handles in `sceneRenderableObject.ts`**

Add internal fields on `SceneRenderableObject` for:

```ts
surfaceCapability?: WebGLEffectCanvasSurfaceHandle;
textLayerCapability?: WebGLEffectTextLayerHandle;
textureLayerCapability?: WebGLEffectTextureLayerHandle;
videoLayerCapability?: WebGLEffectVideoLayerHandle;
```

Wire each controller:

- element plane creates a canvas surface handle;
- text plane creates a text layer handle using the existing text canvas, texture, style state, and glyph layout helper;
- image texture plane creates an image texture layer handle;
- video texture plane creates a video texture layer handle.

- [x] **Step 4: Return handles from renderable `effectSource()`**

Use these fields:

```ts
surface: state.scene?.object.surfaceCapability
textLayer: state.scene?.object.textLayerCapability
image: state.scene?.object.textureLayerCapability
video: state.scene?.object.videoLayerCapability
```

- [x] **Step 5: Run renderable tests**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/render/renderables/elementSnapshotRenderable.test.ts packages/dom-webgl-runtime/src/lib/render/renderables/textSnapshotRenderable.test.ts packages/dom-webgl-runtime/src/lib/render/renderables/imageRenderable.test.ts packages/dom-webgl-runtime/src/lib/render/renderables/videoRenderable.test.ts packages/dom-webgl-runtime/src/lib/render/renderables/sceneRenderableObject.test.ts
```

Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add packages/dom-webgl-runtime/src/lib/render/renderables/sceneRenderableObject.ts packages/dom-webgl-runtime/src/lib/render/renderables/elementSnapshotRenderable.ts packages/dom-webgl-runtime/src/lib/render/renderables/textSnapshotRenderable.ts packages/dom-webgl-runtime/src/lib/render/renderables/imageRenderable.ts packages/dom-webgl-runtime/src/lib/render/renderables/videoRenderable.ts packages/dom-webgl-runtime/src/lib/render/renderables/*Renderable.test.ts
git commit -m "feat: wire source capability handles through renderables"
```

---

### Task 5: Align Model and Generic Target Controls

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/modelEffectHandle.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/modelEffectHandle.test.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/effectTargets/elementPlaneEffectTarget.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/effectTargets/elementPlaneEffectTarget.test.ts`

- [x] **Step 1: Add failing common-control tests**

Add tests proving:

- `model.setVisible`, `setRotation`, `setScale`, and `setOpacity` work;
- `ctx.target?.setOpacity(...)` applies recursively to grouped media/model objects;
- material arrays and nested child meshes are covered.

- [x] **Step 2: Run tests and verify failure**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/render/renderables/modelEffectHandle.test.ts packages/dom-webgl-runtime/src/lib/render/renderables/effectTargets/elementPlaneEffectTarget.test.ts
```

Expected: FAIL where recursive opacity/common model controls are missing.

- [x] **Step 3: Implement recursive common controls**

Implementation rules:

- Traverse child objects recursively for opacity.
- Support material arrays.
- Do not expose renderer, scene, camera, render order, depth flags, or picking.
- Keep public model object type as `unknown`.

- [x] **Step 4: Run tests**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/render/renderables/modelEffectHandle.test.ts packages/dom-webgl-runtime/src/lib/render/renderables/effectTargets/elementPlaneEffectTarget.test.ts
```

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add packages/dom-webgl-runtime/src/lib/render/renderables/modelEffectHandle.ts packages/dom-webgl-runtime/src/lib/render/renderables/modelEffectHandle.test.ts packages/dom-webgl-runtime/src/lib/render/renderables/effectTargets/elementPlaneEffectTarget.ts packages/dom-webgl-runtime/src/lib/render/renderables/effectTargets/elementPlaneEffectTarget.test.ts
git commit -m "feat: align model and target controls"
```

---

### Task 6: Runtime Pass-Through and Demo Consumer Harness

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/effects/effectController.test.ts`
- Modify: `apps/demo/src/demoEffects.ts`
- Modify: `apps/demo/src/App.tsx`
- Modify: `apps/demo/src/App.test.tsx`
- Modify: `apps/demo/src/demo-import-boundary.test.ts`

- [x] **Step 1: Add effect-controller pass-through coverage**

Add tests proving `createWebGLEffectController(...)` passes the renderable-provided dynamic source handle through unchanged for all five source kinds.

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/effects/effectController.test.ts
```

Expected: PASS after Tasks 1-5.

- [x] **Step 2: Add demo-local effects that consume every handle**

In `apps/demo/src/demoEffects.ts`, add consumer-owned examples:

- `demo.capabilitySurface` uses `ctx.source.surface?.draw(...)`;
- `demo.capabilityTextLayer` uses `ctx.source.textLayer?.getGlyphs()` and `setGlyphs(...)`;
- `demo.capabilityImageTexture` uses `ctx.source.image?.setTextureTransform(...)`;
- `demo.capabilityVideoPlayback` uses `ctx.source.video?.setMuted(...)` and `setPlaybackRate(...)`;
- existing GLB demo effects keep using `ctx.source.model`.

These effects must remain demo-local and imported only through public package entrypoints.

- [x] **Step 3: Run demo and import boundary tests**

Run:

```bash
npm test -- --run apps/demo/src/App.test.tsx apps/demo/src/demo-import-boundary.test.ts
npm run check:imports
```

Expected: PASS.

- [x] **Step 4: Commit**

```bash
git add packages/dom-webgl-runtime/src/lib/effects/effectController.test.ts apps/demo/src/demoEffects.ts apps/demo/src/App.tsx apps/demo/src/App.test.tsx apps/demo/src/demo-import-boundary.test.ts
git commit -m "test: demonstrate unified source capability handles"
```

---

### Task 7: Documentation Alignment

**Files:**
- Modify: `README.md`
- Modify: `docs/00-goal.md`
- Modify: `docs/agent/package-usage.md`
- Modify: `docs/agent/custom-effects.md`
- Modify: `docs/EXECUTION_STATE.md`

- [x] **Step 1: Document the capability matrix**

Add this matrix to `docs/agent/package-usage.md`:

```md
| Source kind | Public output handle | Main controls |
| --- | --- | --- |
| `snapshot/element` | `ctx.source.surface` | canvas draw, clear, invalidate, object/material controls |
| `snapshot/text` | `ctx.source.textLayer` | canvas draw, style, glyph layout, `setText`, `setGlyphs`, object/material controls |
| `image` | `ctx.source.image` | texture, material, mesh, texture transform, invalidate |
| `video` | `ctx.source.video` | texture controls plus play, pause, muted, playback rate |
| `model/glb` | `ctx.source.model` | object controls, mesh traversal, vertex samples, point cloud creation |
```

State explicitly:

- DOM text remains the source of content, accessibility, and fallback.
- `textLayer.setText(...)` and `setGlyphs(...)` affect the WebGL output layer only.
- Effects should not mutate DOM text for visual animation.
- Package core does not include scrambled text, text pressure, or any other concrete effect.

- [x] **Step 2: Update README, goal, and execution state**

Use this wording:

```md
The effect context now exposes low-level runtime output handles for every
supported source kind. Consumers can draw to canvas-backed element surfaces,
control WebGL text layers and glyph layout, transform image/video texture
planes, control video playback, and inspect/manipulate GLB model handles through
public effect context. Concrete effects remain application-owned.
```

- [x] **Step 3: Run docs checks**

Run:

```bash
npm run check:imports
git diff --check
```

Expected: PASS.

- [x] **Step 4: Commit**

```bash
git add README.md docs/00-goal.md docs/agent/package-usage.md docs/agent/custom-effects.md docs/EXECUTION_STATE.md
git commit -m "docs: document source capability handles"
```

---

### Task 8: Full Verification

**Files:**
- No source files are modified in this task.

- [x] **Step 1: Run targeted tests**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/publicExports.test.ts packages/dom-webgl-runtime/src/lib/effects/effectController.test.ts packages/dom-webgl-runtime/src/lib/render/renderables/textCanvasLayout.test.ts packages/dom-webgl-runtime/src/lib/render/renderables/sourceCapabilityHandles.test.ts packages/dom-webgl-runtime/src/lib/render/renderables/effectTargets/elementPlaneEffectTarget.test.ts packages/dom-webgl-runtime/src/lib/render/renderables/elementSnapshotRenderable.test.ts packages/dom-webgl-runtime/src/lib/render/renderables/textSnapshotRenderable.test.ts packages/dom-webgl-runtime/src/lib/render/renderables/imageRenderable.test.ts packages/dom-webgl-runtime/src/lib/render/renderables/videoRenderable.test.ts packages/dom-webgl-runtime/src/lib/render/renderables/modelEffectHandle.test.ts packages/dom-webgl-runtime/src/lib/render/renderables/modelRenderable.test.ts apps/demo/src/App.test.tsx apps/demo/src/demo-import-boundary.test.ts
```

Expected: PASS.

- [x] **Step 2: Run workspace checks**

Run:

```bash
npm run check
npm run build
npm run check:imports
git diff --check
```

Expected: PASS. Existing Vite chunk-size warnings are non-blocking only if build exits 0.

- [x] **Step 3: Inspect boundary**

Run:

```bash
git diff -- packages/dom-webgl-runtime/src apps/demo/src README.md docs
```

Expected:

- No runtime hardcoding of demo keys, assets, DOM structure, layout, or copy.
- No package-owned concrete effects.
- No `@project/dom-webgl-runtime/effects` subpath.
- No public renderer, camera, scene, render order, depth-write, picking, or multiple-canvas API.
- Demo imports only public runtime entrypoints.

- [x] **Step 4: Commit verification fixes only if needed**

If verification required fixes:

```bash
git add packages/dom-webgl-runtime/src apps/demo/src README.md docs
git commit -m "fix: harden source capability handles"
```

If no fixes were required, do not create an empty commit.

---

## Handoff Notes

- This plan deliberately exposes primitives, not effects.
- `snapshot/text` is the highest-risk slice because it requires shared glyph layout and a WebGL-only text override path.
- `textLayer.setText(...)` must not mutate DOM `textContent`.
- If a future effect needs more power, first check whether it can be expressed with `draw(...)`, `getGlyphs()`, `setGlyphs(...)`, texture transform, video controls, or model traversal. Add source primitives only when the missing capability is genuinely generic.
