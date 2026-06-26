# Runtime Image Sequence Source Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Add a small public `image-sequence` source to the DOM WebGL runtime so scroll progress can drive frame-addressable WebGL texture rendering without app-owned canvas code.

**Architecture:** Keep the feature narrow: one public source declaration, one internal source descriptor, one focused frame-cache module, and one renderable that reuses the existing texture-plane layout/object-fit machinery. Do not build a general media engine, timeline editor, or asset pipeline. The sequence renderable owns frame selection and cache policy; scroll adapters continue to own progress signals; effects continue to use existing texture/media handles.

**Tech Stack:** TypeScript, React adapter types, Three.js `Texture`, existing `ResourceManager`, existing `createTexturePlaneSceneRenderableController`, Vitest/jsdom tests.

---

## Design Constraints

- **Single responsibility:** parsing declarations, loading frames, choosing frames, and rendering textures live in separate modules.
- **Low coupling:** no dependency on `apps/example`, GSAP, Lenis, or `ScrollEffectSection` inside runtime. Runtime only reads `ctx.progress`/declaration data already passed to the target.
- **High cohesion:** all image-sequence cache behavior is in one module; all renderable behavior is in one renderable file.
- **No overdesign:** support numeric frame ranges and static URL patterns only. Do not add manifests, adaptive bitrate, reverse playback, frame interpolation, workers, streaming containers, or custom codecs in this slice.
- **Public API stays declarative:** consumers declare the sequence source and optionally attach app-owned effects. The package does not ship visual preset effects.
- **Lifecycle-owned resources:** decoded frames and Three textures are released through renderable dispose/offscreen lifecycle, not by React components.

## Proposed Public API

Add one source declaration variant:

```ts
type WebGLImageSequenceSourceDeclaration = {
  kind: "image-sequence";
  frameCount: number;
  frameSrc: string | ((frame: number) => string);
  progressKey?: string;
  startFrame?: number;
  preloadBefore?: number;
  preloadAfter?: number;
  maxCachedFrames?: number;
};
```

Initial examples:

```tsx
<WebGLTarget
  as="section"
  className="example-media example-media-video-bg"
  webgl={{
    key: "example.sequence.scrub",
    source: {
      kind: "image-sequence",
      frameCount: 454,
      frameSrc: "/example/bg-sequence/frame_{frame:0000}.webp",
      progressKey: "example.video.scrub",
      preloadBefore: 6,
      preloadAfter: 18,
      maxCachedFrames: 72,
    },
    effects: [{ kind: "example.imageSequenceTone" }],
  }}
/>
```

`frameSrc` string formatting is intentionally tiny:

- `{frame}` inserts the 1-based frame number.
- `{frame:0000}` inserts the 1-based frame number padded to four digits.

## File Structure

- Modify: `packages/dom-webgl-runtime/src/lib/types.ts`
  - Adds public `WebGLImageSequenceSourceDeclaration`.
- Modify: `packages/dom-webgl-runtime/src/lib/source/sourceDescriptor.ts`
  - Adds internal `WebGLImageSequenceSourceDescriptor`.
- Modify: `packages/dom-webgl-runtime/src/lib/source/inferSource.ts`
  - Parses declared `image-sequence`; accepts any HTMLElement as anchor.
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderableFactory.ts`
  - Routes `image-sequence` descriptors to the new renderable.
- Modify: `packages/dom-webgl-runtime/src/lib/resources/resourceManager.ts`
  - Adds `image-sequence` resource kind and cache key.
- Create: `packages/dom-webgl-runtime/src/lib/render/renderables/imageSequenceFrameCache.ts`
  - Builds frame URLs, loads/decodes frames, preloads a window, prunes LRU frames, disposes decoded frames.
- Create: `packages/dom-webgl-runtime/src/lib/render/renderables/imageSequenceRenderable.ts`
  - Creates one texture plane, selects frames from progress, swaps texture image, and exposes an image-like texture handle.
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/texturePlaneSceneRenderable.ts`
  - Adds a minimal texture source update hook if needed, without changing image/video behavior.
- Modify: `packages/dom-webgl-runtime/src/lib/effects/effectAuthoring.ts`
  - Extends source handle unions only if the renderable exposes a distinct `image-sequence` handle. Prefer reusing the existing image texture-layer shape with `kind: "image-sequence"` if type clarity requires it.
- Modify: `apps/example/src/App.tsx`
  - Replaces `ImageSequenceScrub` usage with `WebGLTarget` source declaration.
- Delete: `apps/example/src/ImageSequenceScrub.tsx`
  - Removed after runtime source handles the same behavior.
- Modify: `apps/example/src/App.test.tsx`
  - Asserts the sequence row is a WebGL target with `source.kind === "image-sequence"`.
- Modify: `apps/example/src/exampleAssets.test.ts`
  - Keeps first/last frame coverage.
- Modify docs:
  - `README.md`
  - `docs/EXECUTION_STATE.md`
  - `docs/agent/package-usage.md`
  - `docs/examples/effect-authoring.md`
  - `docs/agent/effect-authoring-example-report.md`

---

### Task 1: Public Types And Source Descriptor

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/types.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/source/sourceDescriptor.ts`
- Test: `packages/dom-webgl-runtime/src/lib/types.test.ts`
- Test: `packages/dom-webgl-runtime/src/lib/source/sourceDescriptor.test.ts`

- [x] **Step 1: Write failing public type coverage**

Add to `packages/dom-webgl-runtime/src/lib/types.test.ts`:

```ts
const imageSequenceDeclaration = {
  key: "sequence.hero",
  source: {
    kind: "image-sequence",
    frameCount: 454,
    frameSrc: "/example/bg-sequence/frame_{frame:0000}.webp",
    progressKey: "example.video.scrub",
    preloadBefore: 6,
    preloadAfter: 18,
    maxCachedFrames: 72,
  },
} satisfies WebGLDeclaration;

expect(imageSequenceDeclaration.source.kind).toBe("image-sequence");
```

- [x] **Step 2: Run the type test and verify it fails**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/types.test.ts
```

Expected: TypeScript/Vitest fails because `"image-sequence"` is not assignable to `WebGLSourceDeclaration`.

- [x] **Step 3: Add public declaration type**

In `packages/dom-webgl-runtime/src/lib/types.ts`, add:

```ts
export type WebGLImageSequenceSourceDeclaration = {
  kind: "image-sequence";
  frameCount: number;
  frameSrc: string | ((frame: number) => string);
  progressKey?: string;
  startFrame?: number;
  preloadBefore?: number;
  preloadAfter?: number;
  maxCachedFrames?: number;
};
```

Then include it in `WebGLSourceDeclaration`.

- [x] **Step 4: Add internal descriptor type**

In `packages/dom-webgl-runtime/src/lib/source/sourceDescriptor.ts`, add:

```ts
export type WebGLImageSequenceSourceDescriptor = {
  kind: "image-sequence";
  anchor: HTMLElement;
  frameCount: number;
  frameSrc: string | ((frame: number) => string);
  progressKey?: string;
  startFrame: number;
  preloadBefore: number;
  preloadAfter: number;
  maxCachedFrames: number;
};
```

Then include it in `WebGLSourceDescriptor`.

- [x] **Step 5: Run source descriptor/type tests**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/types.test.ts packages/dom-webgl-runtime/src/lib/source/sourceDescriptor.test.ts
```

Expected: tests pass after source union support lands.

---

### Task 2: Source Inference

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/source/inferSource.ts`
- Test: `packages/dom-webgl-runtime/src/lib/source/inferSource.test.ts`

- [x] **Step 1: Write failing inference test**

Add to `inferSource.test.ts`:

```ts
test("accepts declared image sequence sources on any element anchor", () => {
  const element = document.createElement("section");
  const descriptor = inferSourceDescriptor({
    key: "sequence.hero",
    element,
    declaration: {
      key: "sequence.hero",
      source: {
        kind: "image-sequence",
        frameCount: 454,
        frameSrc: "/example/bg-sequence/frame_{frame:0000}.webp",
        progressKey: "example.video.scrub",
      },
    },
    scanOrder: 0,
  });

  expect(descriptor).toEqual({
    kind: "image-sequence",
    anchor: element,
    frameCount: 454,
    frameSrc: "/example/bg-sequence/frame_{frame:0000}.webp",
    progressKey: "example.video.scrub",
    startFrame: 1,
    preloadBefore: 6,
    preloadAfter: 18,
    maxCachedFrames: 72,
  });
});
```

- [x] **Step 2: Run the inference test and verify it fails**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/source/inferSource.test.ts
```

Expected: unsupported source kind or type failure.

- [x] **Step 3: Implement `image-sequence` inference**

In `inferSourceDescriptor`, add a branch before image/video element inference:

```ts
if (declaredSource?.kind === "image-sequence") {
  return {
    kind: "image-sequence",
    anchor: element,
    frameCount: declaredSource.frameCount,
    frameSrc: declaredSource.frameSrc,
    progressKey: declaredSource.progressKey,
    startFrame: declaredSource.startFrame ?? 1,
    preloadBefore: declaredSource.preloadBefore ?? 6,
    preloadAfter: declaredSource.preloadAfter ?? 18,
    maxCachedFrames: declaredSource.maxCachedFrames ?? 72,
  };
}
```

- [x] **Step 4: Add validation for invalid frame counts**

Add a second test:

```ts
test("rejects image sequence sources with empty frame counts", () => {
  const element = document.createElement("section");

  expect(() =>
    inferSourceDescriptor({
      key: "sequence.bad",
      element,
      declaration: {
        key: "sequence.bad",
        source: {
          kind: "image-sequence",
          frameCount: 0,
          frameSrc: "/frames/frame_{frame:0000}.webp",
        },
      },
      scanOrder: 0,
    }),
  ).toThrow('WebGL target "sequence.bad" declares an image sequence with frameCount 0.');
});
```

Implement a narrow guard in the same branch:

```ts
if (!Number.isInteger(declaredSource.frameCount) || declaredSource.frameCount < 1) {
  throw new Error(
    `WebGL target "${targetDescriptor.key}" declares an image sequence with frameCount ${declaredSource.frameCount}.`,
  );
}
```

- [x] **Step 5: Run inference tests**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/source/inferSource.test.ts
```

Expected: all inference tests pass.

---

### Task 3: Frame URL And Cache Module

**Files:**
- Create: `packages/dom-webgl-runtime/src/lib/render/renderables/imageSequenceFrameCache.ts`
- Test: `packages/dom-webgl-runtime/src/lib/render/renderables/imageSequenceFrameCache.test.ts`

- [x] **Step 1: Write failing URL formatter tests**

Create `imageSequenceFrameCache.test.ts`:

```ts
import { describe, expect, test, vi } from "vitest";

import {
  createImageSequenceFrameCache,
  formatImageSequenceFrameSrc,
} from "./imageSequenceFrameCache";

describe("formatImageSequenceFrameSrc", () => {
  test("formats padded and unpadded one-based frame numbers", () => {
    expect(formatImageSequenceFrameSrc("/frames/frame_{frame:0000}.webp", 12)).toBe(
      "/frames/frame_0012.webp",
    );
    expect(formatImageSequenceFrameSrc("/frames/{frame}.webp", 12)).toBe(
      "/frames/12.webp",
    );
  });
});
```

- [x] **Step 2: Run the new test and verify it fails**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/render/renderables/imageSequenceFrameCache.test.ts
```

Expected: module missing.

- [x] **Step 3: Implement URL formatting only**

Create `imageSequenceFrameCache.ts` with:

```ts
export function formatImageSequenceFrameSrc(
  frameSrc: string | ((frame: number) => string),
  frame: number,
): string {
  if (typeof frameSrc === "function") {
    return frameSrc(frame);
  }

  return frameSrc.replace(/\{frame(?::(0+))?\}/g, (_match, padding: string | undefined) => {
    return padding ? String(frame).padStart(padding.length, "0") : String(frame);
  });
}
```

- [x] **Step 4: Add cache behavior tests**

Extend `imageSequenceFrameCache.test.ts`:

```ts
test("loads the selected frame and preloads a bounded window", async () => {
  const loaded: string[] = [];
  const cache = createImageSequenceFrameCache({
    frameCount: 10,
    frameSrc: "/frames/frame_{frame:0000}.webp",
    preloadBefore: 1,
    preloadAfter: 2,
    maxCachedFrames: 4,
    loadFrame(src) {
      loaded.push(src);
      return Promise.resolve({
        close: vi.fn(),
        height: 900,
        image: document.createElement("img"),
        width: 1600,
      });
    },
  });

  await cache.preloadAround(5);
  expect(loaded).toEqual([
    "/frames/frame_0004.webp",
    "/frames/frame_0005.webp",
    "/frames/frame_0006.webp",
    "/frames/frame_0007.webp",
  ]);
  await expect(cache.read(5)).resolves.toMatchObject({ width: 1600, height: 900 });
});
```

- [x] **Step 5: Implement bounded cache**

Add these exported types and factory:

```ts
export type ImageSequenceDecodedFrame = {
  readonly close: () => void;
  readonly height: number;
  readonly image: CanvasImageSource;
  readonly width: number;
};

export type ImageSequenceFrameCache = {
  preloadAround(frame: number): Promise<void>;
  read(frame: number): Promise<ImageSequenceDecodedFrame>;
  dispose(): void;
};
```

Implement `createImageSequenceFrameCache(...)` with:

- map keyed by one-based frame number
- `pending | ready | failed` entries
- `preloadAround(frame)` loading `frame - preloadBefore` through `frame + preloadAfter`
- LRU prune for ready frames above `maxCachedFrames`
- `dispose()` closing ready frames and clearing pending/failed entries

Keep helper functions in this file. Do not import Three.js here.

- [x] **Step 6: Run cache tests**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/render/renderables/imageSequenceFrameCache.test.ts
```

Expected: cache tests pass.

---

### Task 4: Texture Plane Update Hook

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/texturePlaneSceneRenderable.ts`
- Test: `packages/dom-webgl-runtime/src/lib/render/renderables/sceneRenderableObject.test.ts`

- [x] **Step 1: Write failing texture update test**

Add to `sceneRenderableObject.test.ts`:

```ts
test("texture plane can replace an image texture source without recreating layout", () => {
  const first = document.createElement("img");
  Object.defineProperties(first, {
    naturalWidth: { value: 1600 },
    naturalHeight: { value: 900 },
  });
  const second = document.createElement("img");
  Object.defineProperties(second, {
    naturalWidth: { value: 1600 },
    naturalHeight: { value: 900 },
  });

  const controller = createTexturePlaneSceneRenderableController({
    key: "sequence.hero",
    sceneAdapter: createSceneAdapter(),
    measureElement: () => createMeasurement(),
    element: document.createElement("section"),
    textureKind: "image",
    textureSource: first,
  });

  controller.object.textureLayerCapability?.replaceSource?.(second);

  expect(controller.object.textureSource).toBe(second);
});
```

If `replaceSource` would expand the public effect handle too much, use an internal `updateTextureSource(...)` returned on the scene object instead. Prefer the internal hook unless effects need to replace frames.

- [x] **Step 2: Run test and verify it fails**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/render/renderables/sceneRenderableObject.test.ts
```

Expected: missing update hook.

- [x] **Step 3: Implement minimal source replacement**

In `texturePlaneSceneRenderable.ts`, keep a mutable `currentTextureSource` initialized from `options.textureSource`. Add one internal method on the returned scene object:

```ts
controller.object.updateTextureSource = (nextSource) => {
  currentTextureSource = nextSource;
  controller.object.textureSource = nextSource;
  texture.image = nextSource;
  texture.needsUpdate = true;
  lastTextureTransformSignature = "";
};
```

If this requires typing, extend only `SceneRenderableObject` in `sceneRenderableController.ts`:

```ts
updateTextureSource?(source: HTMLImageElement | HTMLCanvasElement | ImageBitmap): void;
```

Keep this internal. Do not add it to public `WebGLEffectTextureLayerHandle` in this slice.

- [x] **Step 4: Run scene renderable tests**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/render/renderables/sceneRenderableObject.test.ts
```

Expected: all scene renderable tests pass.

---

### Task 5: Image Sequence Renderable

**Files:**
- Create: `packages/dom-webgl-runtime/src/lib/render/renderables/imageSequenceRenderable.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderableFactory.ts`
- Test: `packages/dom-webgl-runtime/src/lib/render/renderables/imageSequenceRenderable.test.ts`
- Test: `packages/dom-webgl-runtime/src/lib/render/renderableFactory.test.ts`

- [x] **Step 1: Write failing renderable test**

Create `imageSequenceRenderable.test.ts`:

```ts
import { describe, expect, test, vi } from "vitest";

import { createImageSequenceRenderable } from "./imageSequenceRenderable";

describe("createImageSequenceRenderable", () => {
  test("selects a frame from keyed progress and updates the texture plane", async () => {
    const anchor = document.createElement("section");
    const updateTextureSource = vi.fn();
    const renderable = createImageSequenceRenderable(
      {
        descriptor: {
          key: "sequence.hero",
          element: anchor,
          declaration: {
            key: "sequence.hero",
            source: {
              kind: "image-sequence",
              frameCount: 10,
              frameSrc: "/frames/frame_{frame:0000}.webp",
              progressKey: "scrub",
            },
          },
          scanOrder: 0,
        },
        source: {
          kind: "image-sequence",
          anchor,
          frameCount: 10,
          frameSrc: "/frames/frame_{frame:0000}.webp",
          progressKey: "scrub",
          startFrame: 1,
          preloadBefore: 1,
          preloadAfter: 2,
          maxCachedFrames: 4,
        },
        role: "media",
        policy: {},
      },
      {
        sceneAdapter: createSceneAdapter(),
        measureElement: () => createMeasurement(),
        progressSignals: { get: () => 0.5 },
        createFrameCache: () => ({
          preloadAround: vi.fn(() => Promise.resolve()),
          read: vi.fn(() =>
            Promise.resolve({
              close: vi.fn(),
              height: 900,
              image: document.createElement("img"),
              width: 1600,
            }),
          ),
          dispose: vi.fn(),
        }),
        createSceneController: () => createSceneController({ updateTextureSource }),
      },
    );

    await renderable.update();

    expect(updateTextureSource).toHaveBeenCalledTimes(1);
    expect(renderable.status).toBe("ready");
  });
});
```

Use local helpers in the test file, following existing test style.

- [x] **Step 2: Run the renderable test and verify it fails**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/render/renderables/imageSequenceRenderable.test.ts
```

Expected: module missing.

- [x] **Step 3: Implement renderable with DI seams**

`imageSequenceRenderable.ts` should:

- read only `WebGLImageSequenceSourceDescriptor`
- compute one-based frame:

```ts
const progress = source.progressKey
  ? input.progress.get(source.progressKey)
  : input.scroll.mode === "gate"
    ? input.scroll.sceneProgress
    : input.scroll.pageProgress;
const frame = source.startFrame + Math.round(clamp(progress) * (source.frameCount - 1));
```

- create one texture plane on first ready frame
- call `scene.object.updateTextureSource?.(frame.image)` when the frame changes
- call `cache.preloadAround(frame)` every update
- expose `effectTarget` and a texture source handle after scene creation
- dispose scene controller and frame cache

Do not create a second renderer or scan DOM.

- [x] **Step 4: Route factory**

Modify `renderableFactory.ts`:

```ts
case "image-sequence":
  return createImageSequenceRenderable(renderableContext, {
    sceneAdapter: context.sceneAdapter,
    measureElement: context.measureElement,
    getViewportSize: context.getViewportSize,
    progressSignals: context.progressSignals,
  });
```

Add `progressSignals?: WebGLProgressSignalSource` to `RenderableFactoryContext`; pass it from `runtime.ts` where the context is built.

- [x] **Step 5: Run renderable tests**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/render/renderables/imageSequenceRenderable.test.ts packages/dom-webgl-runtime/src/lib/render/renderableFactory.test.ts
```

Expected: tests pass.

---

### Task 6: Resource Manager And Debug Truth

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/resources/resourceManager.ts`
- Test: `packages/dom-webgl-runtime/src/lib/resources/resourceManager.test.ts`
- Test: `packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts`

- [x] **Step 1: Write failing resource key test**

Add to `resourceManager.test.ts`:

```ts
test("keys image sequence resources by frame source and count", () => {
  const manager = createResourceManager();
  const anchor = document.createElement("section");
  const first = manager.acquire({
    kind: "image-sequence",
    anchor,
    frameCount: 10,
    frameSrc: "/frames/a_{frame:0000}.webp",
    startFrame: 1,
    preloadBefore: 6,
    preloadAfter: 18,
    maxCachedFrames: 72,
  });
  const second = manager.acquire({
    kind: "image-sequence",
    anchor,
    frameCount: 20,
    frameSrc: "/frames/a_{frame:0000}.webp",
    startFrame: 1,
    preloadBefore: 6,
    preloadAfter: 18,
    maxCachedFrames: 72,
  });

  expect(first.record.key).not.toBe(second.record.key);
});
```

- [x] **Step 2: Run resource tests and verify failure**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/resources/resourceManager.test.ts
```

Expected: `image-sequence` is not handled in switches.

- [x] **Step 3: Add resource manager support**

In `resourceManager.ts`:

- extend `WebGLResourceKind` with `"image-sequence"`
- map descriptor kind to `"image-sequence"`
- create key:

```ts
case "image-sequence":
  return `image-sequence:${readElementKey(descriptor.anchor)}:${descriptor.frameCount}:${String(descriptor.frameSrc)}`;
```

Do not include progress key or cache window sizes in the resource key; those affect playback/cache policy, not the underlying sequence identity.

- [x] **Step 4: Add runtime pipeline debug test**

In `runtimePipeline.test.ts`, add a target with `source.kind: "image-sequence"` and assert debug state eventually reports:

```ts
expect(state.targets[0]).toMatchObject({
  key: "sequence.hero",
  sourceKind: "image-sequence",
  renderRole: "media",
});
```

Use injected frame-cache or loader seams if the test should avoid real network.

- [x] **Step 5: Run resource and runtime pipeline tests**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/resources/resourceManager.test.ts packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts
```

Expected: tests pass.

---

### Task 7: Effect Context And Public Export Guards

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/effects/effectAuthoring.ts`
- Test: `packages/dom-webgl-runtime/src/lib/effects/effectAuthoring.test.ts`
- Test: `packages/dom-webgl-runtime/src/publicExports.test.ts`

- [x] **Step 1: Decide handle shape from implementation evidence**

Use the smallest handle that passes real usage:

```ts
{
  kind: "image-sequence";
  element: HTMLElement;
  frame: number;
  src: string;
  image?: WebGLEffectTextureLayerHandle<CanvasImageSource>;
}
```

If TypeScript rejects `CanvasImageSource` in the existing generic bound, do not weaken it with `any`. Instead add a narrow `WebGLEffectImageSequenceLayerHandle` type that exposes the same methods without pretending the source is an `HTMLImageElement`.

- [x] **Step 2: Write source narrowing test**

Add a test proving an effect with `source: "image-sequence"` receives the new handle kind and can call texture transform methods.

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/effects/effectAuthoring.test.ts
```

Expected before implementation: type or runtime failure.

- [x] **Step 3: Implement the narrow handle type**

Update `effectAuthoring.ts` source union and compatibility types. Keep the change source-specific; do not broaden existing image/video handle contracts.

- [x] **Step 4: Update public export type tests**

In `publicExports.test.ts`, add a compile snippet that imports `WebGLDeclaration` and declares `source.kind: "image-sequence"`.

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/publicExports.test.ts
```

Expected: public type test passes.

---

### Task 8: React Example Migration

**Files:**
- Modify: `apps/example/src/App.tsx`
- Delete: `apps/example/src/ImageSequenceScrub.tsx`
- Modify: `apps/example/src/App.test.tsx`
- Modify: `apps/example/src/exampleEffectDeclarations.ts`
- Modify: `apps/example/src/exampleEffects.ts`
- Test: `apps/example/src/App.test.tsx`

- [x] **Step 1: Write failing App test expectation**

Change `App.test.tsx` so the pinned scrub row expects a WebGL target:

```ts
expect(finalTargetProps.map(({ webgl }) => webgl.key)).toContain(
  "example.image-sequence.scrub",
);
expect(finalTargetProps.find(({ webgl }) => webgl.key === "example.image-sequence.scrub")?.webgl.source).toEqual({
  kind: "image-sequence",
  frameCount: 454,
  frameSrc: "/example/bg-sequence/frame_{frame:0000}.webp",
  progressKey: "example.video.scrub",
  preloadBefore: 6,
  preloadAfter: 18,
  maxCachedFrames: 72,
});
```

- [x] **Step 2: Run App test and verify failure**

Run:

```bash
npm test -- --run apps/example/src/App.test.tsx
```

Expected: current app renders `ImageSequenceScrub`, not `WebGLTarget`.

- [x] **Step 3: Replace canvas component with WebGLTarget**

In `App.tsx`, replace:

```tsx
<ImageSequenceScrub ... />
```

with:

```tsx
<WebGLTarget
  as="section"
  className="example-media example-media-video-bg example-media-sequence"
  webgl={{
    key: "example.image-sequence.scrub",
    source: {
      kind: "image-sequence",
      frameCount: 454,
      frameSrc: "/example/bg-sequence/frame_{frame:0000}.webp",
      progressKey: videoScrubProgressKey,
      preloadBefore: 6,
      preloadAfter: 18,
      maxCachedFrames: 72,
    },
    lifecycle: { hideWhenReady: true, hideMode: "self" },
  }}
/>
```

- [x] **Step 4: Delete the app-local canvas component**

Delete `apps/example/src/ImageSequenceScrub.tsx`.

- [x] **Step 5: Run example tests**

Run:

```bash
npm test -- --run apps/example/src/App.test.tsx apps/example/src/exampleAssets.test.ts apps/example/src/import-boundary.test.ts
```

Expected: tests pass, and `apps/example` still imports only public runtime/adapters.

---

### Task 9: Documentation Truth Sweep

**Files:**
- Modify: `README.md`
- Modify: `docs/EXECUTION_STATE.md`
- Modify: `docs/agent/package-usage.md`
- Modify: `docs/examples/effect-authoring.md`
- Modify: `docs/agent/effect-authoring-example-report.md`
- Modify: `docs/superpowers/plans/2026-06-27-runtime-image-sequence-source.md`

- [x] **Step 1: Update README current behavior**

Add a current behavior bullet:

```md
- Runtime supports `source.kind: "image-sequence"` for frame-addressable media:
  a target declares `frameCount`, `frameSrc`, and optional `progressKey`; runtime
  owns decoded-frame caching, WebGL texture updates, and disposal.
```

- [x] **Step 2: Update package usage docs**

In `docs/agent/package-usage.md`, add a concise source declaration example:

```tsx
<WebGLTarget
  as="section"
  webgl={{
    key: "sequence.hero",
    source: {
      kind: "image-sequence",
      frameCount: 454,
      frameSrc: "/example/bg-sequence/frame_{frame:0000}.webp",
      progressKey: "example.video.scrub",
    },
  }}
/>
```

Explain that image sequences are for frame-addressable scrub playback, while normal `video` remains the better source for continuous playback.

- [x] **Step 3: Update example tutorial**

In `docs/examples/effect-authoring.md`, replace text saying the scrub row is intentionally not WebGL with text saying it now dogfoods runtime `image-sequence`.

- [x] **Step 4: Sweep stale phrases**

Run:

```bash
rg -n "ImageSequenceScrub|currentTime|all-keyframe|bg-scrub|not a WebGL video effect" README.md docs apps/example/src packages -S
```

Expected: no stale current-truth references. Historical mention of avoiding repeated `currentTime` seeking is acceptable only in `docs/agent/effect-authoring-example-report.md`.

---

### Task 10: Verification And Commit

**Files:**
- All changed files from Tasks 1-9.

- [x] **Step 1: Run targeted tests**

Run:

```bash
npm test -- --run \
  packages/dom-webgl-runtime/src/lib/types.test.ts \
  packages/dom-webgl-runtime/src/lib/source/inferSource.test.ts \
  packages/dom-webgl-runtime/src/lib/source/sourceDescriptor.test.ts \
  packages/dom-webgl-runtime/src/lib/render/renderables/imageSequenceFrameCache.test.ts \
  packages/dom-webgl-runtime/src/lib/render/renderables/imageSequenceRenderable.test.ts \
  packages/dom-webgl-runtime/src/lib/render/renderableFactory.test.ts \
  packages/dom-webgl-runtime/src/lib/resources/resourceManager.test.ts \
  packages/dom-webgl-runtime/src/publicExports.test.ts \
  apps/example/src/App.test.tsx \
  apps/example/src/exampleAssets.test.ts \
  apps/example/src/import-boundary.test.ts
```

Expected: all targeted tests pass.

- [x] **Step 2: Run full verification**

Run:

```bash
npm run check
npm run build
npm run check:imports
git diff --check
```

Expected: all commands exit 0. Existing Vite chunk-size warnings may remain.

- [x] **Step 3: Inspect final diff**

Run:

```bash
git status --short
git diff --stat
```

Expected: only runtime `image-sequence`, example migration, assets already committed from the prior branch, and docs changes are present. No `dist/`, `.DS_Store`, temp frame directories, or debug files.

- [x] **Step 4: Commit**

Run:

```bash
git add packages/dom-webgl-runtime apps/example README.md docs
git commit -m "feat: add runtime image sequence source"
```

Expected: one local commit on `codex/runtime-image-sequence-source`.

---

## Self-Review

Spec coverage:

- Public image-sequence source: covered by Tasks 1-2.
- Runtime-owned cache/GPU lifecycle: covered by Tasks 3-6.
- WebGL rendering rather than DOM canvas: covered by Tasks 4-5 and Task 8.
- Effect compatibility: covered by Task 7.
- Example migration and docs truth: covered by Tasks 8-9.
- Software design constraints: encoded in Design Constraints and enforced by file structure.

Placeholder scan:

- No `TODO`, `TBD`, or “implement later” placeholders.
- Each task has exact paths, commands, and expected outcomes.

Type consistency:

- Public `WebGLImageSequenceSourceDeclaration` maps to internal `WebGLImageSequenceSourceDescriptor`.
- `image-sequence` source kind is used consistently across types, inference, resource manager, factory, renderable, debug docs, and example.
