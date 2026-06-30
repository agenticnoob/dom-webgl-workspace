# Texture Performance Ownership Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Move texture upload decisions, texture size telemetry, and texture dirty state into one internal ownership path without changing the public DOM WebGL API.

**Architecture:** Keep the existing DOM-first, one-canvas, `renderer.setAnimationLoop(...)`, controlled effect-handle model. Add a small internal texture ownership layer used by canvas/text/media/material-layer texture paths, report texture-size budget warnings through the existing debug warning shape, and keep scheduler changes limited to dirty-frame requests caused by texture invalidation. Do not implement batching, WebGPU, multiple canvases, raw Three.js public handles, or a new effect scheduling API in this plan.

**Tech Stack:** TypeScript, Three.js `Texture` / `CanvasTexture` / `VideoTexture`, Vitest/jsdom, existing renderer loop and runtime pipeline tests, npm workspaces.

---

## Goal

Create a focused internal performance refactor that gives the runtime one place to answer:

- whether a texture upload is needed,
- why a texture was marked dirty,
- what size that texture represents for budget warnings,
- whether a texture invalidation should request an on-demand frame.

The end state should preserve public API shape and current app behavior while making future performance work measurable instead of scattered across renderables and effect handles.

## Current Truth

- Current branch: `codex/runtime-performance-roadmap-implementation`.
- `git status --short` currently shows unrelated untracked local files only: `.agents/` and `skills-lock.json`.
- Recent commits show runtime performance roadmap closeout is already landed:
  - `b170bc96 docs: align runtime performance closeout`
  - `dbe9dfea docs: record performance profile decision`
  - `dffcf0dd feat: add bounded postprocess passes`
  - `40f6e8a3 perf: reduce layout measurement candidates`
  - `6dd667ca feat: add demand-driven render scheduler`
  - `4df136d6 Implement runtime performance budget controls`
  - `8688710a docs: align runtime performance roadmap`
  - `7bc37033 docs: record completed effect API boundary plan`
- `docs/performance/profile-notes.md` records no dominant bottleneck. Draw calls stayed near active-renderable count, while DOM rect reads and texture upload activity stayed visible; batching is explicitly deferred.
- `docs/superpowers/plans/2026-06-30-runtime-performance-roadmap.md` marks Tasks 1-6 implemented or decided: budgets/debug warnings, demand-driven scheduler, layout candidate reduction, resource cache/load pressure, bounded postprocess, and profile-gated batching decision.
- `docs/EXECUTION_STATE.md` says Task 6 deferred batching because draw calls did not dominate many compatible planes, and the current performance path is not a renderer rewrite, WebGPU rewrite, multi-canvas architecture, or raw Three.js public API expansion.
- `rendererLoop.ts` owns the loop via `setAnimationLoop`. It supports `"continuous"` and `"on-demand"` and dirty reasons: `"initial"`, `"target-register"`, `"target-unregister"`, `"dom-invalidation"`, `"resource-ready"`, and `"manual-sync"`.
- `runtime.ts` currently decides continuous mode coarsely: active gate, media/video, pointer declaration, or any target with effects keeps the loop continuous. Async resource completion requests `"resource-ready"`. DOM invalidation can call renderable `invalidateContent()`.
- `debugState.ts` has default budgets including `maxTextureSize`, and public `WebGLPerformanceWarning["target"]` already includes `"textureSize"`, but current warning generation only counts active target/snapshot/video/model totals.
- `texturePlaneSceneRenderable.ts` owns media textures locally and directly sets `texture.needsUpdate = true` on creation, source switch, and UV transform.
- `textPlaneSceneRenderable.ts` owns a `CanvasTexture` locally and directly sets `texture.needsUpdate = true` after text canvas rasterization and glyph commands.
- `elementPlaneSceneRenderable.ts` owns a `CanvasTexture` locally and exposes `invalidate()` that directly marks `texture.needsUpdate = true`.
- `sourceCapabilityHandles.ts` hides raw `texture`, `mesh`, and `material` from public handles, but internally calls `markTextureDirty(...)`, which directly writes `needsUpdate` and then calls an invalidate callback.
- `materialLayer.ts` owns material-layer-created texture uniforms and disposes them correctly, but `image-texture` directly sets `texture.needsUpdate = true`; source texture uniforms are borrowed from renderables.
- `postprocessController.ts` already has bounded low-resolution internal pass ownership and render-target pool disposal; it should not be redesigned for this texture ownership task.
- `imageSequenceRenderable.ts` swaps consumer-owned frames through `updateTextureSource(...)`; the runtime must keep that contract and must not dispose consumer-owned `HTMLImageElement` / `ImageBitmap` frames.

## Decision

This task should be an internal texture ownership refactor, not a local patch and not a broader runtime rewrite.

### Why A Small Patch Is Not Enough

A local patch can add conditionals around `texture.needsUpdate`, but it cannot reliably answer texture size, dirty reason, scheduler impact, or ownership boundaries because those writes are currently spread across:

- media texture planes,
- text canvas rasterization,
- element canvas surfaces,
- source capability handles,
- material-layer texture uniforms,
- image-sequence frame switching.

The profile-selected next optimization is "profile-gate per-frame texture refresh"; that requires a single texture dirty/upload model. Otherwise the next profile still cannot distinguish deliberate texture uploads from accidental repeated `needsUpdate` writes.

### Why This Is Not Over-Designed

This plan does not add a renderer abstraction, WebGPU, batching, multiple canvases, public texture handles, or a public scheduling API. It adds one internal ownership module and small adapters in existing texture-producing files. The public API remains stable, and the work is directly tied to the existing `maxTextureSize` / `"textureSize"` debug warning fields and the Task 6 profile decision.

## Option Comparison

### Option A: Local Texture Upload Gating

**Coverage**

- Add local signatures around `texture.needsUpdate` writes in `texturePlaneSceneRenderable.ts`, `textPlaneSceneRenderable.ts`, and `sourceCapabilityHandles.ts`.
- Avoid some repeated updates when source identity, transform, or canvas raster state did not change.

**Changed Files**

- `packages/dom-webgl-runtime/src/lib/render/renderables/texturePlaneSceneRenderable.ts`
- `packages/dom-webgl-runtime/src/lib/render/renderables/textPlaneSceneRenderable.ts`
- `packages/dom-webgl-runtime/src/lib/render/renderables/elementPlaneSceneRenderable.ts`
- `packages/dom-webgl-runtime/src/lib/render/renderables/sourceCapabilityHandles.ts`
- Focused tests in `sourceCapabilityHandles.test.ts`, `imageSequenceRenderable.test.ts`, and existing renderable tests.

**Risks**

- Dirty state remains duplicated.
- Texture size telemetry remains missing.
- Scheduler still cannot tell texture dirty from general DOM invalidation.
- Material-layer texture uniforms remain a separate ownership path.

**Benefits**

- Smallest code diff.
- Lower immediate regression risk.

**Verification**

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/render/renderables/sourceCapabilityHandles.test.ts packages/dom-webgl-runtime/src/lib/render/renderables/imageSequenceRenderable.test.ts packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts
npm run typecheck
git diff --check
```

**Recommendation**

Not recommended. It reduces a symptom but leaves the ownership and telemetry problem intact.

### Option B: Internal Texture Ownership Refactor

**Coverage**

- Create one internal texture ownership module for source textures and runtime-created texture uniforms.
- Route all texture dirty writes through that module.
- Track texture source identity, logical size, DPR where relevant, last upload signature, dirty reason, and whether an on-demand frame should be requested.
- Report texture-size warnings through existing `maxTextureSize` and `"textureSize"` debug warning fields.
- Keep current continuous-mode behavior unchanged, except texture invalidation can request one on-demand frame through an existing or internal dirty reason.

**Changed Files**

- Create: `packages/dom-webgl-runtime/src/lib/render/renderables/textureUploadState.ts`
- Test: `packages/dom-webgl-runtime/src/lib/render/renderables/textureUploadState.test.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/texturePlaneSceneRenderable.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/textPlaneSceneRenderable.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/elementPlaneSceneRenderable.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/sourceCapabilityHandles.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/materialLayer.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderable.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/debug/debugState.ts`
- Test existing: `packages/dom-webgl-runtime/src/lib/render/renderables/sourceCapabilityHandles.test.ts`
- Test existing: `packages/dom-webgl-runtime/src/lib/render/renderables/materialLayer.test.ts`
- Test existing: `packages/dom-webgl-runtime/src/lib/render/renderables/imageSequenceRenderable.test.ts`
- Test existing: `packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts`
- Test existing: `packages/dom-webgl-runtime/src/lib/debug/debugState.test.ts`
- Test existing: `packages/dom-webgl-runtime/src/publicExports.test.ts`

**Risks**

- Touches several core renderable files.
- Needs care around `VideoTexture`, because video remains a legitimate continuous texture source.
- Needs care around consumer-owned image-sequence frames; ownership must not imply disposal of frame objects.
- If the ownership API is too broad, it can become a second renderable controller.

**Benefits**

- Fixes the actual ownership gap.
- Enables texture-size budget warnings without public API expansion.
- Gives the scheduler a clear internal signal for texture invalidation.
- Preserves postprocess, effect authoring, source taxonomy, and public handles.

**Verification**

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/render/renderables/textureUploadState.test.ts packages/dom-webgl-runtime/src/lib/render/renderables/sourceCapabilityHandles.test.ts packages/dom-webgl-runtime/src/lib/render/renderables/materialLayer.test.ts packages/dom-webgl-runtime/src/lib/render/renderables/imageSequenceRenderable.test.ts packages/dom-webgl-runtime/src/lib/debug/debugState.test.ts packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts packages/dom-webgl-runtime/src/publicExports.test.ts
npm run typecheck
npm run build
npm run check:imports
git diff --check
```

**Recommendation**

Recommended. It is the smallest change that addresses texture upload ownership, telemetry, and dirty/scheduler coupling together.

### Option C: Broader Runtime Performance Ownership Refactor

**Coverage**

- Do Option B.
- Add effect scheduling levels such as static, invalidation-driven, and continuous.
- Revisit batching readiness.
- Potentially add renderer-info debug counters and broader runtime cost ownership.

**Changed Files**

- All Option B files.
- `packages/dom-webgl-runtime/src/lib/effects/effectAuthoring.ts`
- `packages/dom-webgl-runtime/src/lib/effects/effectController.ts`
- `packages/dom-webgl-runtime/src/lib/types.ts`
- `packages/dom-webgl-runtime/src/publicExports.test.ts`
- Possibly render policy and renderer host files if draw-call telemetry becomes public-facing.

**Risks**

- Easily expands into public API design.
- Changes existing behavior protected by `runtimePipeline.test.ts`: any active effect currently keeps the loop continuous.
- Profile does not currently prove batching or effect scheduling levels are the next bottleneck.
- Higher chance of accidentally exposing raw renderer, texture, pass, or scheduling internals.

**Benefits**

- Could reduce idle work for static effects later.
- Could provide a bigger performance story if future profiles show effects dominate.

**Verification**

Full verification plus new public contract tests would be required:

```bash
npm run test -- --run
npm run typecheck
npm run build
npm run check:imports
git diff --check
```

**Recommendation**

Not recommended for this round. Reopen only after Option B telemetry shows effect update cost or draw calls dominate.

## Recommended Scope

Implement Option B only.

### Refactor Boundary

Inside scope:

- Internal texture upload/dirty ownership.
- Texture size telemetry for debug warnings.
- Existing scheduler dirty-frame integration for texture invalidation.
- Existing tests and docs aligned to this internal behavior.

Outside scope:

- Public API additions.
- New public effect scheduling modes.
- Batching or instancing.
- WebGPU.
- Multiple canvases.
- Raw Three.js renderer/scene/camera/material/texture/render-target exposure.
- Postprocess architecture changes.
- Example UI redesign.

## Non-Goals

- Do not change `WebGLDeclaration.source`, `effects`, `scroll`, `pointer`, or `lifecycle` public shapes.
- Do not add `ctx.source.*.texture`, `mesh`, `material`, `object3D`, `renderer`, `scene`, `camera`, `composer`, render target, render loop, pass ordering, or renderer-state mutation.
- Do not export a `textures` subpath or a concrete effect preset.
- Do not add WebGPU, multiple canvases, raycast picking, or batching.
- Do not change image-sequence ownership: frames remain consumer-owned and are not disposed by runtime.
- Do not make postprocess active requests force continuous mode; the existing test says active postprocess state alone does not force continuous rendering.
- Do not change the existing rule that any active effect keeps continuous mode in this plan.
- Do not modify `apps/example` UI or visual design.

## Public API Boundaries That Must Not Expand

- Root and React public entrypoints remain the only consumer entrypoints.
- `WebGLPerformanceBudget` and `WebGLPerformanceWarning` may be used as already exported, but this plan should not add new public warning targets unless a separate public API review says so.
- `WebGLDebugState` should not expose a raw texture list. Texture size should surface only as existing warning records.
- Effect handles stay capability-first: controlled `draw`, `setGlyphs`, `setTextureTransform`, `createMaterialLayer`, `requestPostprocess`, and similar methods only.
- Material programs stay limited to `vertexShader`, `fragmentShader`, `uniforms`, `defines`, and `blend`.

## Architecture

Add a small internal module:

```ts
// packages/dom-webgl-runtime/src/lib/render/renderables/textureUploadState.ts
export type TextureUploadDirtyReason =
  | "initial"
  | "source-change"
  | "canvas-raster"
  | "glyph-commands"
  | "texture-transform"
  | "effect-draw"
  | "effect-invalidate"
  | "material-uniform";

export type TextureUploadTelemetry = {
  key: string;
  width: number;
  height: number;
  devicePixelRatio?: number;
  sourceKind: "canvas" | "image" | "video" | "image-bitmap" | "unknown";
  dirty: boolean;
  dirtyReason?: TextureUploadDirtyReason;
};

export type TextureUploadSource =
  | HTMLCanvasElement
  | HTMLImageElement
  | HTMLVideoElement
  | ImageBitmap
  | undefined;

export type TextureUploadStateOptions = {
  key: string;
  texture: { needsUpdate?: boolean };
  source?: TextureUploadSource;
  requestFrame?(): void;
};
```

The module should return a tiny owner object with these responsibilities:

- Set `texture.needsUpdate = true` only from one place.
- Track the last size/source signature.
- Mark dirty with a reason.
- Update source identity for media/image-sequence.
- Read telemetry for runtime debug aggregation.
- Optionally call a provided `requestFrame()` callback when a texture invalidation should wake on-demand rendering.

The owner must not:

- own DOM measurement,
- own scene object layout,
- own effect lifecycle,
- own resource loading,
- dispose consumer-owned image/image-bitmap/video frame objects,
- expose Three.js texture publicly.

## File Structure

- Create `packages/dom-webgl-runtime/src/lib/render/renderables/textureUploadState.ts`: internal texture dirty/telemetry helper for `Texture`, `CanvasTexture`, and `VideoTexture`.
- Create `packages/dom-webgl-runtime/src/lib/render/renderables/textureUploadState.test.ts`: pure tests for signatures, dirty reasons, `needsUpdate`, telemetry, and frame request callback.
- Modify `packages/dom-webgl-runtime/src/lib/render/renderables/texturePlaneSceneRenderable.ts`: replace direct `texture.needsUpdate` writes and source/transform dirty logic with the owner.
- Modify `packages/dom-webgl-runtime/src/lib/render/renderables/textPlaneSceneRenderable.ts`: replace text canvas and glyph-command direct texture dirty writes with the owner.
- Modify `packages/dom-webgl-runtime/src/lib/render/renderables/elementPlaneSceneRenderable.ts`: replace canvas-surface direct texture dirty writes with the owner.
- Modify `packages/dom-webgl-runtime/src/lib/render/renderables/sourceCapabilityHandles.ts`: accept an internal `markTextureDirty(reason)` callback in options instead of writing `needsUpdate` directly.
- Modify `packages/dom-webgl-runtime/src/lib/render/renderables/materialLayer.ts`: route runtime-created uniform textures through the owner/helper for initial dirty and telemetry; keep local disposal ownership.
- Modify `packages/dom-webgl-runtime/src/lib/render/renderable.ts`: add an optional internal `inspectTextureTelemetry?(): readonly TextureUploadTelemetry[]` method.
- Modify `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`: aggregate renderable texture telemetry into debug state and pass an internal request-frame callback to renderable creation context only if needed.
- Modify `packages/dom-webgl-runtime/src/lib/debug/debugState.ts`: consume internal texture telemetry and emit existing `"textureSize"` budget warnings.
- Avoid changing `packages/dom-webgl-runtime/src/lib/types.ts` unless typecheck requires importing already exported warning types.

## Existing Tests To Protect

Keep these tests green while adding new coverage:

- `packages/dom-webgl-runtime/src/lib/renderer/rendererLoop.test.ts`: initial dirty frame, on-demand idle, `requestFrame("resource-ready")`, loop disposal.
- `packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts`: dirty raster invalidation, static scene idles, resource-ready dirty frame, postprocess does not force continuous, active effects/gates/videos/pointer targets keep continuous.
- `packages/dom-webgl-runtime/src/lib/debug/debugState.test.ts`: performance budget warning shape and custom budgets.
- `packages/dom-webgl-runtime/src/lib/render/renderables/sourceCapabilityHandles.test.ts`: no raw texture/mesh/material on public handles, draw invalidates existing texture, text glyph commands, texture transform invalidation, material-layer source texture binding.
- `packages/dom-webgl-runtime/src/lib/render/renderables/materialLayer.test.ts`: source texture uniform binding, runtime-created texture disposal, owned texture replacement, invalid uniform rejection.
- `packages/dom-webgl-runtime/src/lib/render/renderables/imageSequenceRenderable.test.ts`: frame selection, synchronous frame switching, no disposal of consumer-owned frames.
- `packages/dom-webgl-runtime/src/lib/renderer/postprocessController.test.ts`: bounded low-resolution pass and render-target disposal.
- `packages/dom-webgl-runtime/src/publicExports.test.ts`: public debug warning target restrictions and raw postprocess/Three internals staying private.

## Task Breakdown

### Task 1: Texture Upload State Helper

**Files:**

- Create: `packages/dom-webgl-runtime/src/lib/render/renderables/textureUploadState.ts`
- Create: `packages/dom-webgl-runtime/src/lib/render/renderables/textureUploadState.test.ts`

- [x] **Step 1: Write RED tests for dirty ownership**

Add tests proving:

```ts
const texture = { needsUpdate: false };
const requestFrame = vi.fn();
const owner = createTextureUploadState({
  key: "hero.texture",
  texture,
  source: document.createElement("canvas"),
  requestFrame,
});

owner.markDirty("canvas-raster");

expect(texture.needsUpdate).toBe(true);
expect(owner.inspect()).toMatchObject({
  key: "hero.texture",
  dirty: true,
  dirtyReason: "canvas-raster",
});
expect(requestFrame).toHaveBeenCalledTimes(1);
```

Also test that repeated `updateSource(...)` with the same source identity and size does not generate a new dirty reason, while a new source does.

- [x] **Step 2: Run RED tests**

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/render/renderables/textureUploadState.test.ts
```

Expected: fail because the module does not exist.

- [x] **Step 3: Implement the helper**

Implement a factory named `createTextureUploadState(...)` with:

```ts
export type TextureUploadState = {
  markDirty(reason: TextureUploadDirtyReason): void;
  updateSource(source: TextureUploadSource): void;
  updateSize(size: { width: number; height: number; devicePixelRatio?: number }): void;
  inspect(): TextureUploadTelemetry;
  dispose(): void;
};
```

Use `let disposed = false` and make double disposal safe. Do not use classes.

- [x] **Step 4: Run GREEN tests**

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/render/renderables/textureUploadState.test.ts
```

Expected: pass.

### Task 2: Route Source Handles Through Texture Ownership

**Files:**

- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/sourceCapabilityHandles.ts`
- Test: `packages/dom-webgl-runtime/src/lib/render/renderables/sourceCapabilityHandles.test.ts`

- [x] **Step 1: Write RED tests for reasoned invalidation**

Extend existing tests so handle calls assert the injected dirty callback receives reasoned events:

```ts
const markTextureDirty = vi.fn();
const handle = createTextureLayerCapabilityHandle({
  object3D: createObject3D(),
  mesh: createObject3D(),
  material: createMaterial(),
  texture,
  source: image,
  invalidate,
  markTextureDirty,
});

handle.setTextureTransform({ repeatX: 0.5 });

expect(markTextureDirty).toHaveBeenCalledWith("texture-transform");
```

Keep the existing assertions that raw `texture`, `mesh`, and `material` are absent from the public handle.

- [x] **Step 2: Run RED tests**

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/render/renderables/sourceCapabilityHandles.test.ts
```

Expected: fail until options support reasoned dirty callbacks.

- [x] **Step 3: Update handle option types and call sites**

Add optional internal callbacks:

```ts
markTextureDirty?(reason: TextureUploadDirtyReason): void;
```

Use it before falling back to the old local `needsUpdate` path so tests can migrate incrementally.

- [x] **Step 4: Run GREEN tests**

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/render/renderables/sourceCapabilityHandles.test.ts
```

Expected: pass.

### Task 3: Move Canvas/Text/Media Planes To The Owner

**Files:**

- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/texturePlaneSceneRenderable.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/textPlaneSceneRenderable.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/elementPlaneSceneRenderable.ts`
- Test: `packages/dom-webgl-runtime/src/lib/render/renderables/sourceCapabilityHandles.test.ts`
- Test: `packages/dom-webgl-runtime/src/lib/render/renderables/imageSequenceRenderable.test.ts`

- [x] **Step 1: Write RED behavior tests**

Add focused tests proving:

```ts
// Same image-sequence frame does not re-mark the texture dirty.
await renderable.update();
await renderable.update();
expect(updateTextureSource).toHaveBeenCalledTimes(1);
```

Add source-handle tests proving text glyph commands and canvas draws call the owner with `"glyph-commands"` and `"effect-draw"`.

- [x] **Step 2: Run RED tests**

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/render/renderables/sourceCapabilityHandles.test.ts packages/dom-webgl-runtime/src/lib/render/renderables/imageSequenceRenderable.test.ts
```

Expected: fail until renderables pass owner callbacks into handles and source switching is owner-aware.

- [x] **Step 3: Replace direct `needsUpdate` writes**

In each renderable, create one owner beside the texture:

```ts
const textureUpload = createTextureUploadState({
  key: options.key,
  texture,
  source: canvasOrMediaSource,
});
```

Call:

- `"initial"` after texture creation,
- `"source-change"` after image-sequence or media source replacement,
- `"texture-transform"` after UV transform changes,
- `"canvas-raster"` after text/canvas redraw,
- `"glyph-commands"` after glyph command redraw,
- `"effect-invalidate"` for explicit handle invalidation.

- [x] **Step 4: Run GREEN tests**

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/render/renderables/textureUploadState.test.ts packages/dom-webgl-runtime/src/lib/render/renderables/sourceCapabilityHandles.test.ts packages/dom-webgl-runtime/src/lib/render/renderables/imageSequenceRenderable.test.ts
```

Expected: pass.

### Task 4: Preserve Material Layer Ownership

**Files:**

- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/materialLayer.ts`
- Test: `packages/dom-webgl-runtime/src/lib/render/renderables/materialLayer.test.ts`

- [x] **Step 1: Write RED tests for runtime-created uniform textures**

Extend tests so `image-texture`, `canvas-texture`, and `video-texture` uniforms remain disposed by the layer, while source texture uniforms are not disposed by the layer.

```ts
const sourceTexture = new Texture();
const layer = createMaterialLayer({
  key: "source.layer",
  target: mesh,
  sourceTexture,
  program: {
    fragmentShader: "void main(){ gl_FragColor = vec4(1.0); }",
    uniforms: { sourceMap: { kind: "source-texture" } },
  },
});
const dispose = vi.spyOn(sourceTexture, "dispose");

layer.dispose();

expect(dispose).not.toHaveBeenCalled();
```

- [x] **Step 2: Run RED tests**

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/render/renderables/materialLayer.test.ts
```

Expected: fail only for newly asserted ownership behavior if current behavior lacks the helper hook.

- [x] **Step 3: Route owned uniform texture initialization through helper logic**

Keep disposal maps local to `materialLayer.ts`. Do not give material layers ownership of borrowed source textures.

- [x] **Step 4: Run GREEN tests**

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/render/renderables/materialLayer.test.ts
```

Expected: pass.

### Task 5: Aggregate Texture Telemetry Into Debug Warnings

**Files:**

- Modify: `packages/dom-webgl-runtime/src/lib/render/renderable.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/debug/debugState.ts`
- Test: `packages/dom-webgl-runtime/src/lib/debug/debugState.test.ts`
- Test: `packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts`
- Test: `packages/dom-webgl-runtime/src/publicExports.test.ts`

- [x] **Step 1: Write RED debug tests**

Add a debug state unit test:

```ts
const state = createDebugState({
  targetCount: 1,
  renderableCount: 1,
  currentScrollMode: "page",
  pointer: createPointerState(),
  performanceBudget: { maxTextureSize: 1024 },
  textureTelemetry: [
    {
      key: "hero.image",
      width: 2048,
      height: 1024,
      sourceKind: "image",
      dirty: false,
    },
  ],
  targets: [createDebugTargetState("hero.image", "media/image")],
});

expect(state.warnings).toContainEqual({
  code: "performance-budget-exceeded",
  target: "textureSize",
  count: 2048,
  limit: 1024,
});
```

Add a runtime pipeline test that a renderable telemetry provider is consumed without adding texture details to public `WebGLDebugState`.

- [x] **Step 2: Run RED tests**

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/debug/debugState.test.ts packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts packages/dom-webgl-runtime/src/publicExports.test.ts
```

Expected: fail until debug state accepts internal telemetry.

- [x] **Step 3: Add internal telemetry plumbing**

Add optional internal renderable method:

```ts
inspectTextureTelemetry?(): readonly TextureUploadTelemetry[];
```

Runtime aggregates it:

```ts
const textureTelemetry = Array.from(
  targetState.renderablesByTargetKey.values(),
  (renderable) => renderable.inspectTextureTelemetry?.() ?? [],
).flat();
```

Pass it to `createDebugState(...)` as internal `DebugRuntimeState.textureTelemetry`.

- [x] **Step 4: Keep public API unchanged**

Ensure `publicExports.test.ts` still rejects raw renderer metrics and raw texture exposure. Do not add a public `textures` field.

- [x] **Step 5: Run GREEN tests**

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/debug/debugState.test.ts packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts packages/dom-webgl-runtime/src/publicExports.test.ts
```

Expected: pass.

### Task 6: Scheduler Coupling Without Effect Scheduling Redesign

**Files:**

- Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`
- Modify only if needed: `packages/dom-webgl-runtime/src/lib/renderer/rendererLoop.ts`
- Test: `packages/dom-webgl-runtime/src/lib/renderer/rendererLoop.test.ts`
- Test: `packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts`

- [x] **Step 1: Write RED scheduler tests for texture invalidation**

Add a runtime pipeline test proving a texture invalidation requests exactly one on-demand frame for a static target:

```ts
// Arrange a static target whose source handle invalidates a texture.
loopHost.tick(16);
expect(loopHost.sceneAdapter.render).toHaveBeenCalledTimes(1);

triggerTextureInvalidation();
loopHost.tick(32);
loopHost.tick(48);

expect(loopHost.sceneAdapter.render).toHaveBeenCalledTimes(2);
```

Keep the existing test that active effects still render continuously.

- [x] **Step 2: Run RED tests**

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/renderer/rendererLoop.test.ts packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts
```

Expected: fail until texture owner invalidation reaches the loop.

- [x] **Step 3: Wire owner invalidation to existing request-frame semantics**

Prefer using existing `"dom-invalidation"` or `"manual-sync"` unless a new internal reason materially improves tests. If adding a new reason, keep it internal to `rendererLoop.ts` types and update tests explicitly.

Do not add public effect scheduling metadata in this task.

- [x] **Step 4: Run GREEN tests**

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/renderer/rendererLoop.test.ts packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts
```

Expected: pass.

### Task 7: Docs And Full Verification

**Files:**

- Modify: `docs/performance/profile-notes.md`
- Modify: `docs/EXECUTION_STATE.md`
- Modify if needed: `README.md`
- Modify if needed: `docs/agent/package-usage.md`

- [x] **Step 1: Update docs truth**

Document that the next Task 6 follow-up is complete only after internal texture ownership exists. Keep batching deferred and public API unchanged.

- [x] **Step 2: Run focused verification**

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/render/renderables/textureUploadState.test.ts packages/dom-webgl-runtime/src/lib/render/renderables/sourceCapabilityHandles.test.ts packages/dom-webgl-runtime/src/lib/render/renderables/materialLayer.test.ts packages/dom-webgl-runtime/src/lib/render/renderables/imageSequenceRenderable.test.ts packages/dom-webgl-runtime/src/lib/debug/debugState.test.ts packages/dom-webgl-runtime/src/lib/renderer/rendererLoop.test.ts packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts packages/dom-webgl-runtime/src/publicExports.test.ts
```

Expected: pass.

- [x] **Step 3: Run full verification**

```bash
npm run test -- --run && npm run typecheck && npm run build && npm run check:imports && git diff --check
```

Expected: all pass. Existing Vite chunk-size warnings remain non-blocking unless they become failures.

## Implementation Result

Implemented on `2026-06-30` as the recommended Option B only: Internal Texture
Ownership Refactor. The runtime now owns texture dirty state, source/size
telemetry, dirty reasons, and one-frame on-demand wakeups for runtime-created
canvas/text/media/material-layer texture paths. Public API shape is unchanged:
no batching, WebGPU path, multi-canvas path, raw Three.js texture handles, or
new effect scheduling API was added.

Focused and full verification passed after implementation:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/render/renderables/textureUploadState.test.ts packages/dom-webgl-runtime/src/lib/render/renderables/sourceCapabilityHandles.test.ts packages/dom-webgl-runtime/src/lib/render/renderables/materialLayer.test.ts packages/dom-webgl-runtime/src/lib/render/renderables/imageSequenceRenderable.test.ts packages/dom-webgl-runtime/src/lib/debug/debugState.test.ts packages/dom-webgl-runtime/src/lib/renderer/rendererLoop.test.ts packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts packages/dom-webgl-runtime/src/publicExports.test.ts
npm run test -- --run && npm run typecheck && npm run build && npm run check:imports && git diff --check
```

## TDD Steps

1. Start with `textureUploadState.test.ts` before creating the helper.
2. Add handle-level tests before changing `sourceCapabilityHandles.ts`.
3. Add renderable-level tests for image-sequence source stability and glyph/canvas dirty reasons before replacing direct `needsUpdate` writes.
4. Add material-layer ownership tests before changing uniform texture compilation.
5. Add debug warning tests before plumbing telemetry through runtime.
6. Add scheduler invalidation tests before wiring texture invalidation to `requestFrame(...)`.
7. Run focused tests after each task, then full verification at the end.

## Verification Commands

Focused:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/render/renderables/textureUploadState.test.ts packages/dom-webgl-runtime/src/lib/render/renderables/sourceCapabilityHandles.test.ts packages/dom-webgl-runtime/src/lib/render/renderables/materialLayer.test.ts packages/dom-webgl-runtime/src/lib/render/renderables/imageSequenceRenderable.test.ts packages/dom-webgl-runtime/src/lib/debug/debugState.test.ts packages/dom-webgl-runtime/src/lib/renderer/rendererLoop.test.ts packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts packages/dom-webgl-runtime/src/publicExports.test.ts
```

Full:

```bash
npm run test -- --run && npm run typecheck && npm run build && npm run check:imports && git diff --check
```

Optional browser profile follow-up, only after code verification:

```bash
npm run dev -w @project/dom-webgl-example
```

Use the same scenarios from `docs/performance/profile-notes.md`: idle page, scroll page, image sequence, GLB model, pinned section.

## Commit Strategy

Implementation was kept as one cohesive refactor commit because the helper,
renderable call sites, debug telemetry, scheduler wakeup, protected regression
tests, and docs describe one internal ownership change. Future follow-ups should
use separate commits only when they introduce a distinct behavior, such as a
profile-proven batching plan or a separately designed effect scheduling model.

## Rollback Strategy

- The first rollback boundary is the new `textureUploadState.ts` module and its call sites. Reverting those files should restore direct `texture.needsUpdate` behavior.
- Keep public API unchanged so rollback does not require downstream migration.
- If texture telemetry causes false positives, revert only the `debugState.ts` / runtime telemetry plumbing while keeping the ownership helper.
- If scheduler coupling causes extra renders, revert the texture invalidation `requestFrame(...)` bridge while preserving dirty reason telemetry.
- Do not rollback by changing public types unless a future implementation mistakenly expands them.

## Docs Sync Scope

Update only docs that describe current runtime truth:

- `docs/performance/profile-notes.md`: add follow-up note that texture upload ownership is the next implemented response to the Task 6 profile.
- `docs/EXECUTION_STATE.md`: update Current Task / Last Result after implementation.
- `README.md`: update only if debug warning behavior or performance guidance changes for consumers.
- `docs/agent/package-usage.md`: update only if agent-facing usage caveats need to mention texture-size budget warnings. Do not document internal texture ownership as a public authoring API.

## Effect Scheduling And Batching Follow-Up Policy

- Effect scheduling should remain unchanged in this refactor: any active effect keeps the loop continuous.
- A future effect scheduling plan is justified only if the new telemetry or a browser profile shows effect update work dominates static scenes.
- If future scheduling is needed, prefer internal effect metadata first; do not add public `continuous` / `static` effect flags without separate API design.
- Batching stays deferred. Reopen it only if a future profile shows draw calls dominate and many active renderables share compatible source/material families.
