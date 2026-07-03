# Effect Object Only Public Context Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `ctx.object` the only public visual authoring surface by removing `ctx.source`, `ctx.target`, and `ctx.visual` from public `WebGLEffectContext`.

**Architecture:** Keep runtime internals unchanged where possible: effect context assembly may still receive source, target, and visual handles internally, but public effect definitions only receive `ctx.object` plus input/time/layout/progress/resource fields. Fill missing object-facade metadata first, migrate every example and public type fixture to object-only syntax, then remove the old public context fields and root exports.

**Tech Stack:** TypeScript, npm workspaces, Vitest/jsdom, CodeGraph for source orientation, strict public type fixtures in `packages/dom-webgl-runtime/test/publicExports.test.ts`.

---

## Scope And Public Boundary

After this plan, public effect authors should use:

```ts
ctx.object;
ctx.resources;
ctx.pointer;
ctx.targetPointer;
ctx.progress;
ctx.layout;
ctx.input;
ctx.scroll;
ctx.scrollProgress;
ctx.time;
ctx.delta;
ctx.key;
ctx.sourceKind;
```

Public effect authors should not use:

```ts
ctx.source;
ctx.target;
ctx.visual;
```

Runtime internals may still use `WebGLEffectSourceHandle`,
`WebGLEffectTargetHandle`, and `WebGLEffectVisualContext` to assemble
`ctx.object`. Those types must not be exported from the package root after the
cleanup.

## File Structure

- `packages/dom-webgl-runtime/src/lib/effects/effectObject.ts`: public facade
  types only; add metadata fields here.
- `packages/dom-webgl-runtime/src/lib/effects/effectObjectCapabilities.ts`:
  internal mapping from current source handles to object modules.
- `packages/dom-webgl-runtime/src/lib/effects/effectObjectContext.ts`: object
  assembly from internal source/target/visual handles.
- `packages/dom-webgl-runtime/src/lib/effects/effectAuthoring.ts`: public
  `WebGLEffectContext`; remove old fields only after migrations pass.
- `packages/dom-webgl-runtime/src/index.ts`: root public exports; remove direct
  source/target/visual context handle exports.
- `apps/example/src/*.ts`: migrate remaining example effects off old fields.
- `apps/example/test/effectContext.ts`: keep test source fixtures internal, but
  stop indexing through `WebGLEffectContext["source"]`.
- `packages/dom-webgl-runtime/test/publicExports.test.ts`: primary public API
  contract tests.
- `packages/dom-webgl-runtime/test/lib/effects/effectObject*.test.ts`: focused
  object facade behavior tests.
- Active docs: `README.md`, `docs/00-goal.md`, `docs/EXECUTION_STATE.md`,
  `docs/agent/effect-object-boundary.md`, `docs/agent/package-onboarding.md`,
  `docs/agent/package-usage.md`, `docs/agent/custom-effects.md`,
  `docs/examples/effect-authoring.md`, and `AGENTS.md`.

## Desired Public Object Additions

Use these additions unless implementation discovers a concrete conflict:

```ts
export type WebGLEffectTextureFacade = {
  readonly src?: string;
  readonly frame?: number;
  readonly shaderInputs: WebGLEffectMediaShaderInputs;
  setTransform(transform: WebGLEffectTextureTransform): void;
  invalidate(): void;
  material: WebGLEffectMaterialLayerHost;
};

export type WebGLEffectVideoFacade = {
  play(): Promise<void> | void;
  pause(): void;
  setMuted(muted: boolean): void;
  setPlaybackRate(rate: number): void;
};

export type WebGLEffectTextFacade = {
  readonly text: string;
  readonly style: WebGLTextLayerStyle;
  readonly shaderInputs: WebGLEffectTextShaderInputs;
  getGlyphs(): readonly WebGLTextGlyph[];
  setText(text: string): void;
  setGlyphs(
    transform: (
      glyphs: readonly WebGLTextGlyph[],
    ) => readonly WebGLTextGlyphRenderCommand[],
  ): void;
  material: WebGLEffectMaterialLayerHost;
};

export type WebGLEffectModelFacade = {
  readonly src: string;
  meshes: WebGLEffectModelMeshesFacade;
  sampling: WebGLEffectModelSamplingFacade;
  points: WebGLEffectModelPointsFacade;
};
```

Do not expose raw Three.js renderer, scene, camera, object, mesh, material,
texture, loader, mixer, raycaster, composer, render target, or pass instances.

## Task 1: Public RED Tests For Object-Only Context

**Files:**

- Modify: `packages/dom-webgl-runtime/test/publicExports.test.ts`
- Modify: `packages/dom-webgl-runtime/test/lib/effects/effectAuthoring.test.ts`

- [ ] **Step 1: Add public negative context-field checks**

Inside the root public type-check fixture in
`packages/dom-webgl-runtime/test/publicExports.test.ts`, add:

```ts
declare const publicCtx: WebGLEffectContext;
publicCtx.object satisfies WebGLEffectObjectHandle;
publicCtx.resources satisfies WebGLEffectResourceScope;
publicCtx.targetPointer.localX satisfies number;
publicCtx.progress.get("section") satisfies number;

// @ts-expect-error use ctx.object and ctx.sourceKind instead.
publicCtx.source;
// @ts-expect-error use ctx.object transform controls instead.
publicCtx.target;
// @ts-expect-error use ctx.object.postprocess instead.
publicCtx.visual;
```

- [ ] **Step 2: Add object metadata fixture**

In the same fixture, add an object-only effect that demonstrates every
replacement needed by current example code:

```ts
const objectOnlyEffect = defineWebGLEffect({
  kind: "custom.objectOnly",
  update(ctx) {
    ctx.object.opacity = 1;
    ctx.object.position.set(0, 24, 0);
    ctx.object.rotation.y += ctx.delta / 1000;
    ctx.object.scale.setScalar(1.05);
    ctx.object.postprocess.request({ key: "custom.soft", blur: { radius: 0.2 } });

    ctx.object.surface?.draw(({ context }) => {
      context.fillRect(0, 0, 1, 1);
    });

    ctx.object.text?.setGlyphs((glyphs) =>
      glyphs.map((glyph) => ({ index: glyph.index, char: glyph.char })),
    );
    ctx.object.text?.shaderInputs.glyphs satisfies readonly WebGLTextGlyph[] | undefined;
    ctx.object.text?.style.font satisfies string | undefined;

    ctx.object.texture?.setTransform({ repeatX: 1, repeatY: 1 });
    ctx.object.texture?.shaderInputs.uvTransform.repeatX satisfies number | undefined;
    ctx.object.texture?.src satisfies string | undefined;
    ctx.object.texture?.frame satisfies number | undefined;

    ctx.object.video?.setMuted(true);
    ctx.object.video?.setPlaybackRate(1);

    ctx.object.model?.points.create({
      positions: ctx.object.model.sampling.vertices({ maxPoints: 128 }),
    });
    ctx.object.model?.src satisfies string | undefined;
  },
});

objectOnlyEffect satisfies WebGLEffectDefinition;
```

- [ ] **Step 3: Remove old positive fixtures for direct fields**

In `packages/dom-webgl-runtime/test/publicExports.test.ts`, remove or rewrite
the existing direct checks:

```ts
ctx.source satisfies WebGLEffectSourceHandle;
ctx.target satisfies WebGLEffectTargetHandle | undefined;
ctx.visual satisfies WebGLEffectVisualContext;
ctx.visual.requestPostprocess(...);
ctx.target?.setPosition(...);
ctx.source.model.createPointLayer(...);
ctx.source.textLayer?.setGlyphs(...);
ctx.source.image?.setTextureTransform(...);
```

Replace them with equivalent `ctx.object` expressions.

- [ ] **Step 4: Add authoring syntax regression**

Append this test to
`packages/dom-webgl-runtime/test/lib/effects/effectAuthoring.test.ts`:

```ts
test("does not expose source target or visual on public effect context", () => {
  const definition = defineWebGLEffect({
    kind: "custom.objectOnlySyntax",
    update(ctx) {
      ctx.object.opacity = 0.8;
      ctx.object.postprocess.request({ key: "soft", grain: { amount: 0.1 } });

      // @ts-expect-error source is no longer public effect context.
      ctx.source;
      // @ts-expect-error target is no longer public effect context.
      ctx.target;
      // @ts-expect-error visual is no longer public effect context.
      ctx.visual;
    },
  });

  expect(definition.kind).toBe("custom.objectOnlySyntax");
});
```

- [ ] **Step 5: Run RED verification**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/publicExports.test.ts packages/dom-webgl-runtime/test/lib/effects/effectAuthoring.test.ts
```

Expected: fail because `ctx.source`, `ctx.target`, and `ctx.visual` still exist,
and because some `ctx.object` metadata fields are missing.

## Task 2: Complete Object Metadata Facades

**Files:**

- Modify: `packages/dom-webgl-runtime/src/lib/effects/effectObject.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/effects/effectObjectCapabilities.ts`
- Modify: `packages/dom-webgl-runtime/test/lib/effects/effectObjectCapabilities.test.ts`
- Modify: `packages/dom-webgl-runtime/test/lib/effects/effectObjectContext.test.ts`

- [ ] **Step 1: Write failing metadata tests**

Add these cases to
`packages/dom-webgl-runtime/test/lib/effects/effectObjectCapabilities.test.ts`:

```ts
test("maps text style and shader inputs to object.text", () => {
  const calls: string[] = [];
  const textLayer = createTextLayer("Hello", calls);
  const source = {
    kind: "dom",
    type: "text",
    element: document.createElement("p"),
    text: "Hello",
    textLayer,
  } satisfies WebGLEffectSourceHandle;

  const text = createEffectObjectCapabilities(source).text;

  expect(text?.style.font).toBe("16px sans-serif");
  expect(text?.shaderInputs.text).toBe("Hello");
});

test("maps media metadata to object.texture and keeps video controls separate", () => {
  const calls: string[] = [];
  const video = createVideoLayer(calls);
  const source = {
    kind: "media",
    type: "video",
    element: document.createElement("video"),
    src: "/video.mp4",
    video,
  } satisfies WebGLEffectSourceHandle;

  const capabilities = createEffectObjectCapabilities(source);

  expect(capabilities.texture?.src).toBe("/video.mp4");
  expect(capabilities.texture?.shaderInputs.objectFit).toBe("cover");
  capabilities.video?.setPlaybackRate(0.75);
  expect(calls).toContain("playback:0.75");
});

test("maps image sequence frame metadata to object.texture", () => {
  const source = {
    kind: "media",
    type: "image-sequence",
    element: document.createElement("section"),
    frame: 12,
    src: "/frames/0012.webp",
    image: createImageSequenceLayer([]),
  } satisfies WebGLEffectSourceHandle;

  const texture = createEffectObjectCapabilities(source).texture;

  expect(texture?.src).toBe("/frames/0012.webp");
  expect(texture?.frame).toBe(12);
});

test("maps model src to object.model", () => {
  const model = createModel([], createMesh("Body"), new Float32Array(), createManagedObject());
  const source = {
    kind: "model",
    type: "glb",
    anchor: document.createElement("div"),
    src: "/models/hero.glb",
    model,
  } satisfies WebGLEffectSourceHandle;

  expect(createEffectObjectCapabilities(source).model?.src).toBe("/models/hero.glb");
});
```

If helper names differ from the current test file, adjust the call sites only;
do not loosen assertions.

- [ ] **Step 2: Run RED verification**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/effects/effectObjectCapabilities.test.ts
```

Expected: fail on missing `style`, `shaderInputs`, `src`, `frame`, or video
facade fields.

- [ ] **Step 3: Update public facade types**

In `packages/dom-webgl-runtime/src/lib/effects/effectObject.ts`, add:

```ts
export type WebGLEffectVideoFacade = {
  play(): Promise<void> | void;
  pause(): void;
  setMuted(muted: boolean): void;
  setPlaybackRate(rate: number): void;
};
```

Extend `WebGLEffectTextFacade`, `WebGLEffectTextureFacade`, and
`WebGLEffectModelFacade` exactly as shown in "Desired Public Object Additions".
Change `WebGLEffectObjectHandle["video"]` from `WebGLEffectVideoLayerHandle` to
`WebGLEffectVideoFacade`. Remove the import of `WebGLEffectVideoLayerHandle`
from `effectObject.ts`.

- [ ] **Step 4: Implement capability mapping**

In `packages/dom-webgl-runtime/src/lib/effects/effectObjectCapabilities.ts`:

```ts
function createTextFacade(
  source: Extract<DOMSourceHandle, { type: "text" }>,
): NonNullable<WebGLEffectObjectCapabilities["text"]> {
  const textLayer = source.textLayer;
  return {
    get text() {
      return textLayer?.text ?? source.text;
    },
    get style() {
      return textLayer?.style ?? {
        font: "",
        lineHeight: 0,
        letterSpacing: 0,
        wordSpacing: 0,
        textAlign: "start",
        color: "",
      };
    },
    get shaderInputs() {
      return textLayer?.shaderInputs ?? {
        size: { width: 0, height: 0, devicePixelRatio: 1 },
        contentBox: { x: 0, y: 0, width: 0, height: 0 },
        sourceTexture: {
          available: false,
          uniform: "source-texture",
          width: 0,
          height: 0,
        },
        text: source.text,
        style: this.style,
        glyphs: [],
      };
    },
    getGlyphs() {
      return textLayer?.getGlyphs() ?? [];
    },
    setText(text) {
      textLayer?.setText(text);
    },
    setGlyphs(transform) {
      textLayer?.setGlyphs(transform);
    },
    material: textLayer,
  };
}
```

Then adapt the existing text branch to use `createTextFacade(source)` only when
`source.textLayer` exists. For media, change `createTextureFacade` to receive
metadata:

```ts
function createTextureFacade(
  layer: TextureLayer,
  metadata: { src?: string; frame?: number },
): WebGLEffectTextureFacade {
  return {
    src: metadata.src,
    frame: metadata.frame,
    get shaderInputs() {
      return layer.shaderInputs;
    },
    setTransform(transform) {
      layer.setTextureTransform(transform);
    },
    invalidate() {
      layer.invalidate();
    },
    material: layer,
  };
}
```

For video, map controls into a separate facade:

```ts
function createVideoFacade(
  video: NonNullable<Extract<MediaSourceHandle, { type: "video" }>["video"]>,
): NonNullable<WebGLEffectObjectCapabilities["video"]> {
  return {
    play() {
      return video.play();
    },
    pause() {
      video.pause();
    },
    setMuted(muted) {
      video.setMuted(muted);
    },
    setPlaybackRate(rate) {
      video.setPlaybackRate(rate);
    },
  };
}
```

For model, return `src: source.src` in the model facade.

- [ ] **Step 5: Run GREEN verification**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/effects/effectObjectCapabilities.test.ts packages/dom-webgl-runtime/test/lib/effects/effectObjectContext.test.ts packages/dom-webgl-runtime/test/publicExports.test.ts
```

Expected: object metadata tests pass. Public context removal tests may still
fail until Task 4 removes the old fields.

## Task 3: Migrate All Runtime And Example Consumers Off Old Context Fields

**Files:**

- Modify: `apps/example/src/mediaEffects.ts`
- Modify: `apps/example/src/pinnedScrollEffect.ts`
- Modify: `apps/example/src/sequenceCardEffect.ts`
- Modify: `apps/example/src/surfaceVideo.ts`
- Modify: `apps/example/test/effectContext.ts`
- Modify: `apps/example/test/mediaEffects.test.ts`
- Modify: `apps/example/test/pinnedScrollEffect.test.ts`
- Modify: `apps/example/test/sequenceCardEffect.test.ts`
- Modify: `apps/example/test/surfaceEffects.test.ts`
- Modify: `packages/dom-webgl-runtime/test/lib/effects/effectController.test.ts`
- Modify: `packages/dom-webgl-runtime/test/lib/renderer/runtimePipeline.test.ts`
- Modify: `packages/dom-webgl-runtime/test/publicExports.test.ts`

- [ ] **Step 1: Migrate `apps/example/src/pinnedScrollEffect.ts`**

Replace:

```ts
if (ctx.source.kind !== "dom" || ctx.source.type !== "text") {
  return;
}

ctx.source.textLayer?.setGlyphs((glyphs) => {
  // existing transform body
});
```

with:

```ts
if (!ctx.object.text) {
  return;
}

ctx.object.text.setGlyphs((glyphs) => {
  // keep the existing transform body unchanged
});
```

- [ ] **Step 2: Migrate `apps/example/src/sequenceCardEffect.ts`**

Replace target transform calls:

```ts
ctx.target?.setVisible(true);
ctx.target?.setOpacity(opacity);
ctx.target?.setPosition(x, y, 0);
```

with:

```ts
ctx.object.visible = true;
ctx.object.opacity = opacity;
ctx.object.position.set(x, y, 0);
```

Replace source surface access:

```ts
if (ctx.source.kind !== "dom" || ctx.source.type !== "element") {
  return;
}

const surface = ctx.source.surface;
```

with:

```ts
const surface = ctx.object.surface;
if (!surface) {
  return;
}
```

Keep `ctx.targetPointer` unchanged; it remains public input state.

- [ ] **Step 3: Migrate `apps/example/src/surfaceVideo.ts`**

Replace:

```ts
if (ctx.source.kind !== "dom" || ctx.source.type !== "element") {
  return;
}

const video = createLoopingVideo(videoSrc, ctx.source.surface);
```

with:

```ts
const video = createLoopingVideo(videoSrc, ctx.object.surface);
```

If the helper needs to no-op without a surface, guard at the call site:

```ts
if (!ctx.object.surface) {
  return;
}
```

- [ ] **Step 4: Migrate image hover reveal metadata**

In `apps/example/src/mediaEffects.ts`, replace:

```ts
if (ctx.source.kind !== "media" || ctx.source.type !== "image") {
  return;
}
const imageHandle = ctx.source.image;
const uvTransform = ctx.source.image?.shaderInputs.uvTransform ?? fallback;
```

with:

```ts
const texture = ctx.object.texture;
if (!texture) {
  return;
}
const uvTransform = texture.shaderInputs.uvTransform;
```

Use `texture.invalidate()` and `texture.material.createMaterialLayer(...)`.

- [ ] **Step 5: Update app test context helper**

In `apps/example/test/effectContext.ts`, replace all type indexes through
`WebGLEffectContext["source"]` with the local `TestEffectSource` or
`ReturnType<typeof createEffectSource>`. Specifically change helpers like:

```ts
function readEffectSourceKind(
  source: WebGLEffectContext["source"],
): WebGLEffectContext["sourceKind"] { ... }
```

to:

```ts
function readEffectSourceKind(source: ReturnType<typeof createEffectSource>):
  WebGLEffectContext["sourceKind"] { ... }
```

Do not add `source`, `target`, or `visual` back onto the returned
`WebGLEffectContext` object once Task 4 removes them.

- [ ] **Step 6: Rewrite package tests to object-first syntax**

In `packages/dom-webgl-runtime/test/lib/effects/effectController.test.ts` and
`packages/dom-webgl-runtime/test/lib/renderer/runtimePipeline.test.ts`, replace
effect bodies that read:

```ts
ctx.target?.setVisible(true);
ctx.target?.setRotation(0, ctx.pointer.normalizedX);
ctx.visual.requestPostprocess(...);
updateEffect(ctx.source);
```

with:

```ts
ctx.object.visible = true;
ctx.object.rotation.set(0, ctx.pointer.normalizedX, 0);
ctx.object.postprocess.request(...);
updateEffect(ctx.object);
```

For tests that intentionally assert source-backed capabilities, assert the
object module instead:

```ts
expect(Boolean(ctx.object.surface)).toBe(true);
```

- [ ] **Step 7: Run migration tests**

Run:

```bash
npm test -- --run apps/example/test/pinnedScrollEffect.test.ts apps/example/test/sequenceCardEffect.test.ts apps/example/test/surfaceEffects.test.ts apps/example/test/mediaEffects.test.ts packages/dom-webgl-runtime/test/lib/effects/effectController.test.ts packages/dom-webgl-runtime/test/lib/renderer/runtimePipeline.test.ts packages/dom-webgl-runtime/test/publicExports.test.ts
```

Expected: pass except for public negative checks that still expect old fields to
be absent. Those pass in Task 4.

## Task 4: Remove Old Public Context Fields

**Files:**

- Modify: `packages/dom-webgl-runtime/src/lib/effects/effectAuthoring.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/effects/effectContext.ts`
- Modify: `packages/dom-webgl-runtime/src/index.ts`
- Modify: `packages/dom-webgl-runtime/test/publicExports.test.ts`
- Modify: `packages/dom-webgl-runtime/test/lib/effects/effectAuthoring.test.ts`

- [ ] **Step 1: Remove fields from public `WebGLEffectContext`**

In `packages/dom-webgl-runtime/src/lib/effects/effectAuthoring.ts`, change:

```ts
export type WebGLEffectContext = {
  key: string;
  sourceKind: WebGLEffectSourceKind;
  layout: ElementLayoutSnapshot;
  input: WebGLFrameInput;
  pointer: WebGLFrameInput["pointer"];
  targetPointer: WebGLTargetPointerState;
  scroll: WebGLFrameInput["scroll"];
  scrollProgress: number;
  progress: WebGLProgressSignalSource;
  visual: WebGLEffectVisualContext;
  time: number;
  delta: number;
  object: WebGLEffectObjectHandle;
  source: WebGLEffectSourceHandle;
  target: WebGLEffectTargetHandle | undefined;
  resources: WebGLEffectResourceScope;
};
```

to:

```ts
export type WebGLEffectContext = {
  key: string;
  sourceKind: WebGLEffectSourceKind;
  layout: ElementLayoutSnapshot;
  input: WebGLFrameInput;
  pointer: WebGLFrameInput["pointer"];
  targetPointer: WebGLTargetPointerState;
  scroll: WebGLFrameInput["scroll"];
  scrollProgress: number;
  progress: WebGLProgressSignalSource;
  time: number;
  delta: number;
  object: WebGLEffectObjectHandle;
  resources: WebGLEffectResourceScope;
};
```

Do not remove `WebGLEffectContextOptions.source`, `target`, or `visual` from
`effectContext.ts`; those are internal assembly inputs.

- [ ] **Step 2: Stop returning old fields from context assembly**

In `packages/dom-webgl-runtime/src/lib/effects/effectContext.ts`, keep the
internal `visual` local and object assembly, but remove these fields from the
returned object:

```ts
visual,
source: options.source,
target: options.target,
```

The return object must still include:

```ts
object: createWebGLEffectObject({
  sourceKind: options.sourceKind,
  source: options.source,
  target: options.target,
  visual,
}),
```

- [ ] **Step 3: Remove root exports for old context handles**

In `packages/dom-webgl-runtime/src/index.ts`, remove these root exports:

```ts
type WebGLEffectSourceHandle,
type WebGLEffectTargetHandle,
type WebGLEffectVisualContext,
```

Keep public object facade types and any public object module types still needed
by `ctx.object`, such as `WebGLEffectCanvasSurfaceHandle`,
`WebGLEffectTextFacade`, `WebGLEffectTextureFacade`,
`WebGLEffectVideoFacade`, `WebGLEffectModelFacade`, and material layer types.

- [ ] **Step 4: Add root export negative checks**

In `packages/dom-webgl-runtime/test/publicExports.test.ts`, add:

```ts
// @ts-expect-error source handles are internal assembly details.
import type { WebGLEffectSourceHandle } from "${importPath}";
// @ts-expect-error target handles are internal assembly details.
import type { WebGLEffectTargetHandle } from "${importPath}";
// @ts-expect-error visual context is replaced by ctx.object.postprocess.
import type { WebGLEffectVisualContext } from "${importPath}";
```

If the fixture already imports those types positively, remove them from the
positive import list first.

- [ ] **Step 5: Run public contract verification**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/publicExports.test.ts packages/dom-webgl-runtime/test/lib/effects/effectAuthoring.test.ts packages/dom-webgl-runtime/test/lib/effects/effectObjectCapabilities.test.ts packages/dom-webgl-runtime/test/lib/effects/effectObjectContext.test.ts
```

Expected: pass.

## Task 5: Remove Documentation Compatibility Language

**Files:**

- Modify: `README.md`
- Modify: `docs/00-goal.md`
- Modify: `docs/EXECUTION_STATE.md`
- Modify: `docs/agent/effect-object-boundary.md`
- Modify: `docs/agent/package-onboarding.md`
- Modify: `docs/agent/package-usage.md`
- Modify: `docs/agent/custom-effects.md`
- Modify: `docs/examples/effect-authoring.md`
- Modify: `AGENTS.md`

- [ ] **Step 1: Update primary status wording**

Replace wording like:

```md
`ctx.source.*`, `ctx.target`, and `ctx.visual` remain compatibility and
implementation substrate
```

with:

```md
Effect authors use `ctx.object` for all visual control and source-backed
capabilities. Source, target, and visual handles are internal runtime assembly
details and are not part of the public effect context.
```

- [ ] **Step 2: Remove compatibility handle tables**

In `docs/agent/package-usage.md` and `docs/agent/package-onboarding.md`, delete
tables or bullet lists that teach direct handles:

```md
ctx.source.surface
ctx.source.textLayer
ctx.source.image
ctx.source.video
ctx.source.model
```

Replace with:

```md
Object modules:

- `ctx.object.surface`: canvas draw/clear/invalidate/material-layer controls.
- `ctx.object.text`: text, style, shader inputs, glyph read/write, material-layer controls.
- `ctx.object.texture`: media src/frame metadata, shader inputs, texture transform, invalidate, material-layer controls.
- `ctx.object.video`: video playback controls.
- `ctx.object.model`: model src, mesh list, vertex sampling, and managed point layers.
- `ctx.object.postprocess`: named postprocess requests.
```

- [ ] **Step 3: Update examples**

Ensure docs examples use:

```ts
ctx.object.opacity = progress;
ctx.object.text?.setGlyphs(...);
ctx.object.texture?.setTransform(...);
ctx.object.model?.points.create(...);
ctx.object.postprocess.request(...);
```

Do not include new current examples that use `ctx.source`, `ctx.target`, or
`ctx.visual`.

- [ ] **Step 4: Preserve historical report context**

Historical report files such as
`docs/agent/effect-authoring-example-report.md` may keep old `ctx.source.*`
mentions if they are clearly historical. Do not rewrite historical evidence
unless the text claims to describe the current API.

- [ ] **Step 5: Run docs verification**

Run:

```bash
rg -n "ctx\\.source|ctx\\.target|ctx\\.visual|WebGLEffectSourceHandle|WebGLEffectTargetHandle|WebGLEffectVisualContext" README.md docs/00-goal.md docs/EXECUTION_STATE.md docs/agent docs/examples AGENTS.md
git diff --check
```

Expected: remaining matches are historical notes explicitly labeled historical
or internal implementation notes, not current public usage instructions.

## Task 6: Full Verification And Commit

**Files:**

- No new implementation files unless earlier tasks require them.

- [ ] **Step 1: Run full verification**

Run:

```bash
npm run test -- --run
npm run typecheck
npm run build
npm run check:imports
git diff --check
```

Expected:

- all Vitest suites pass;
- typecheck passes;
- build passes, with only existing Vite chunk-size warning if present;
- example import boundary passes;
- whitespace check passes.

- [ ] **Step 2: Inspect final public boundary**

Run:

```bash
rg -n "ctx\\.(source|target|visual)" packages/dom-webgl-runtime/test/publicExports.test.ts packages/dom-webgl-runtime/test/lib/effects apps/example/src packages/dom-webgl-runtime/src/lib/effects
rg -n "WebGLEffectSourceHandle|WebGLEffectTargetHandle|WebGLEffectVisualContext" packages/dom-webgl-runtime/src/index.ts packages/dom-webgl-runtime/test/publicExports.test.ts
```

Expected:

- no current effect examples use `ctx.source`, `ctx.target`, or `ctx.visual`;
- public fixture rejects removed fields and removed root exports;
- internal files may still mention source/target/visual handles for object
  assembly.

- [ ] **Step 3: Commit**

After verification passes:

```bash
git add -A
git diff --cached --check
git commit -m "feat: make effect context object-only"
```

Do not push unless explicitly requested.

## Self-Review Checklist

- The public effect context no longer exposes `ctx.source`, `ctx.target`, or
  `ctx.visual`.
- `ctx.object` has replacements for all source metadata and visual controls used
  by current example effects.
- Runtime internals still own renderer, scene, camera, Object3D, material,
  texture, loaders, postprocess controller, resources, fallback visibility, and
  scheduling.
- No raw Three.js handles are exposed.
- `defineWebGLEffect(...)` and runtime-level `effects` remain the authoring
  entrypoint.
- Docs teach object-only public authoring and do not present compatibility
  handles as current public API.
