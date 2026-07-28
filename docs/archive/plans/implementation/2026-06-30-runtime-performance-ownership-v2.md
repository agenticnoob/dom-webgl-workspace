# Runtime Performance Ownership V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Finish the next performance layer by making rendering, texture upload, effect scheduling, renderer telemetry, resource priority, postprocess cost, and draw-call decisions owned by explicit internal runtime policies.

**Architecture:** Keep the existing DOM-first, one-canvas, renderer-owned `setAnimationLoop(...)`, and capability-handle public API. Refactor internal ownership where current behavior is too coarse; do not expand raw Three.js access, add multiple canvases, default to batching, or start a WebGPU rewrite. Each task is independently testable and should be committed separately.

**Tech Stack:** TypeScript, Three.js WebGLRenderer, Vitest/jsdom, npm workspaces, CodeGraph-indexed runtime modules, existing `apps/example` browser profile notes.

---

## Current Truth

- Runtime performance roadmap Task 1-6 is implemented or decided.
- Internal texture ownership follow-up is implemented in `packages/dom-webgl-runtime/src/lib/render/renderables/textureUploadState.ts`.
- `docs/performance/profile-notes.md` records `no dominant bottleneck`; batching is deferred because draw calls did not dominate many compatible planes.
- `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts` still keeps any target with effects in continuous rendering through `shouldKeepTargetContinuous(...)`.
- `packages/dom-webgl-runtime/src/lib/render/renderables/materialLayer.ts` still treats `setUniforms(...)` as material update work, even when only uniform values changed.
- Renderer-level draw calls, triangles, programs, geometry count, texture count, and render-target cost are not yet reported through stable debug warnings.
- Resource loading has concurrency control, but not viewport/lifecycle priority.
- Bounded postprocess exists, but pass count, target memory, active request count, and static-input reuse are not yet explicit budget controls.

## Non-Goals

- Do not expose raw Three.js renderer, scene, camera, material, texture, render target, composer, pass ordering, mixer, or renderer info object.
- Do not add multiple canvases.
- Do not implement WebGPU or TSL migration in this plan.
- Do not add default batching or instancing until renderer stats and a stress profile prove draw calls dominate.
- Do not hardcode `apps/example` keys, DOM shape, assets, or copy into runtime/package code.
- Do not make public effect presets or concrete package-owned visual effects.

## File Structure

- Modify `packages/dom-webgl-runtime/src/lib/render/renderables/textureUploadState.ts`: split texture upload dirty state from frame-only dirty state.
- Modify `packages/dom-webgl-runtime/src/lib/render/renderables/texturePlaneSceneRenderable.ts`: stop treating UV transform changes as texture uploads.
- Modify `packages/dom-webgl-runtime/src/lib/render/renderables/sceneRenderableController.ts`: only mark element canvas textures dirty when canvas backing size or raster content changes.
- Modify `packages/dom-webgl-runtime/src/lib/render/renderables/materialLayer.ts`: update uniform values in place and only recompile shader material when shader structure changes.
- Modify `packages/dom-webgl-runtime/src/lib/effects/effectAuthoring.ts`: add a narrow public scheduling hint to effect definitions.
- Modify `packages/dom-webgl-runtime/src/lib/effects/effectController.ts`: expose effect scheduling need to runtime without exposing effect internals.
- Modify `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`: consume effect scheduling need, renderer stats, resource priority, and budget warnings.
- Modify `packages/dom-webgl-runtime/src/lib/renderer/rendererLoop.ts`: add dirty reasons needed by effect/resource/postprocess scheduling.
- Modify `packages/dom-webgl-runtime/src/lib/renderer/threeRenderer.ts`: expose stable renderer summary stats through the internal adapter.
- Modify `packages/dom-webgl-runtime/src/lib/debug/debugState.ts` and `packages/dom-webgl-runtime/src/lib/types.ts`: add budget warning targets for draw calls, texture count, postprocess requests, and render target size.
- Modify `packages/dom-webgl-runtime/src/lib/resources/resourceManager.ts`: add priority-aware queued loading.
- Modify `packages/dom-webgl-runtime/src/lib/renderer/postprocessController.ts`: add request/pass/target-size budget reporting and static-input reuse.
- Modify `packages/dom-webgl-runtime/src/lib/render/renderables/modelRenderable.ts`: add internal animation ownership hooks without making animation public API mandatory.
- Add focused tests beside the modified files.
- Update `docs/performance/profile-notes.md`, `README.md`, `docs/00-goal.md`, `docs/EXECUTION_STATE.md`, `docs/agent/package-usage.md`, and this plan as tasks complete.

## Task 1: Split Texture Upload Dirty From Frame Dirty

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/textureUploadState.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/texturePlaneSceneRenderable.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/sceneRenderableController.ts`
- Test: `packages/dom-webgl-runtime/src/lib/render/renderables/textureUploadState.test.ts`
- Test: `packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts`

- [x] **Step 1: Write failing texture dirty semantics tests**

Add tests to `textureUploadState.test.ts`:

```ts
test("marks frame dirty without uploading texture pixels", () => {
  const texture = { needsUpdate: false };
  const requestFrame = vi.fn();
  const owner = createTextureUploadState({
    key: "hero.image",
    texture,
    requestFrame,
  });

  owner.markFrameDirty("texture-transform");

  expect(texture.needsUpdate).toBe(false);
  expect(owner.inspect()).toMatchObject({
    key: "hero.image",
    dirty: true,
    dirtyReason: "texture-transform",
  });
  expect(requestFrame).toHaveBeenCalledTimes(1);
});
```

Add a second test proving upload dirty still uploads pixels:

```ts
test("marks upload dirty when pixels changed", () => {
  const texture = { needsUpdate: false };
  const requestFrame = vi.fn();
  const owner = createTextureUploadState({
    key: "hero.canvas",
    texture,
    requestFrame,
  });

  owner.markUploadDirty("canvas-raster");

  expect(texture.needsUpdate).toBe(true);
  expect(owner.inspect()).toMatchObject({
    dirty: true,
    dirtyReason: "canvas-raster",
  });
});
```

- [x] **Step 2: Verify the tests fail**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/render/renderables/textureUploadState.test.ts
```

Expected: fail because `markFrameDirty(...)` and `markUploadDirty(...)` do not exist.

- [x] **Step 3: Implement minimal split dirty API**

In `textureUploadState.ts`, replace `markDirty(reason)` with:

```ts
markUploadDirty(reason: TextureUploadDirtyReason): void;
markFrameDirty(reason: TextureUploadDirtyReason): void;
```

Keep `markDirty(reason)` temporarily as an internal alias to `markUploadDirty(reason)` only if needed to migrate call sites inside the same task; remove it before committing this task. `markUploadDirty(...)` must set `texture.needsUpdate = true`; `markFrameDirty(...)` must not.

- [x] **Step 4: Migrate call sites**

Use `markFrameDirty("texture-transform")` for UV repeat/offset changes in `texturePlaneSceneRenderable.ts`. Use `markUploadDirty(...)` for `initial`, `source-change`, `canvas-raster`, `glyph-commands`, `effect-draw`, `effect-invalidate`, and `material-uniform`.

In `resizeCanvasToMeasurement(...)`, only call the dirty callback when the backing canvas size changed:

```ts
const changed = canvas.width !== width || canvas.height !== height;
if (canvas.width !== width) canvas.width = width;
if (canvas.height !== height) canvas.height = height;
if (changed) markTextureDirty?.();
```

- [x] **Step 5: Run focused verification**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/render/renderables/textureUploadState.test.ts packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts
npm run typecheck
git diff --check
```

Expected: all pass.

- [x] **Step 6: Commit**

```bash
git add packages/dom-webgl-runtime/src/lib/render/renderables/textureUploadState.ts packages/dom-webgl-runtime/src/lib/render/renderables/textureUploadState.test.ts packages/dom-webgl-runtime/src/lib/render/renderables/texturePlaneSceneRenderable.ts packages/dom-webgl-runtime/src/lib/render/renderables/sceneRenderableController.ts packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts
git commit -m "perf: split texture upload and frame dirtiness"
```

## Task 2: Make Material Uniform Updates Incremental

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/materialLayer.ts`
- Test: `packages/dom-webgl-runtime/src/lib/render/renderables/materialLayer.test.ts`

- [x] **Step 1: Write failing material update tests**

Add tests to `materialLayer.test.ts`:

```ts
test("setUniforms updates scalar uniforms without recompiling material", () => {
  const target = { material: new MeshBasicMaterial() };
  const layer = createMaterialLayer({
    key: "test.layer",
    target,
    program: {
      fragmentShader: "void main(){ gl_FragColor = vec4(1.0); }",
      uniforms: { amount: 0.25 },
    },
  });
  const shader = readShaderMaterial(target.material);

  shader.needsUpdate = false;
  layer.setUniforms({ amount: 0.5 });

  expect(readShaderMaterial(target.material)).toBe(shader);
  expect(shader.uniforms.amount?.value).toBe(0.5);
  expect(shader.needsUpdate).toBe(false);
});
```

Add a texture replacement test:

```ts
test("setUniforms disposes replaced owned texture uniforms only when source changes", () => {
  const target = { material: new MeshBasicMaterial() };
  const first = document.createElement("canvas");
  const second = document.createElement("canvas");
  const layer = createMaterialLayer({
    key: "test.layer",
    target,
    program: {
      fragmentShader: "void main(){ gl_FragColor = vec4(1.0); }",
      uniforms: { map: { kind: "canvas-texture", source: first } },
    },
  });
  const shader = readShaderMaterial(target.material);
  const original = shader.uniforms.map?.value as Texture;
  const dispose = vi.spyOn(original, "dispose");

  layer.setUniforms({ map: { kind: "canvas-texture", source: first } });
  expect(dispose).not.toHaveBeenCalled();

  layer.setUniforms({ map: { kind: "canvas-texture", source: second } });
  expect(dispose).toHaveBeenCalledTimes(1);
});
```

- [x] **Step 2: Verify the tests fail**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/render/renderables/materialLayer.test.ts
```

Expected: fail because `setUniforms(...)` currently recreates values and sets `activeMaterial.needsUpdate = true`.

- [x] **Step 3: Implement uniform diffing**

Add internal helpers:

```ts
function canUpdateUniformValueInPlace(current: unknown, next: WebGLEffectUniformValue): boolean
function updateUniformValueInPlace(current: unknown, next: WebGLEffectUniformValue): boolean
function readTextureUniformSignature(value: WebGLEffectUniformValue): string | undefined
```

Use in-place updates for numbers, booleans, strings, `Vector2`, `Vector3`, `Vector4`, and arrays of vec2 tuples. For texture uniforms, reuse the existing owned texture when `kind` and source identity are unchanged. Recompile only when `setProgram(...)` changes shader structure.

- [x] **Step 4: Run focused verification**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/render/renderables/materialLayer.test.ts
npm run typecheck
git diff --check
```

Expected: all pass.

- [x] **Step 5: Commit**

```bash
git add packages/dom-webgl-runtime/src/lib/render/renderables/materialLayer.ts packages/dom-webgl-runtime/src/lib/render/renderables/materialLayer.test.ts
git commit -m "perf: update material layer uniforms incrementally"
```

## Task 3: Add Effect Scheduling Ownership

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/effects/effectAuthoring.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/effects/effectController.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`
- Test: `packages/dom-webgl-runtime/src/lib/effects/effectController.test.ts`
- Test: `packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts`
- Test: `packages/dom-webgl-runtime/src/publicExports.test.ts`

- [x] **Step 1: Write failing effect scheduling tests**

Add to `effectController.test.ts`:

```ts
test("reports static reactive and frame scheduling needs", () => {
  const registry = createWebGLEffectRegistry([
    defineWebGLEffect({ kind: "test.static", schedule: "static", update() {} }),
    defineWebGLEffect({ kind: "test.reactive", schedule: "reactive", update() {} }),
    defineWebGLEffect({ kind: "test.frame", schedule: "frame", update() {} }),
  ]);

  expect(createWebGLEffectController({
    key: "static",
    declaration: [{ kind: "test.static" }],
    source: createElementSnapshotSource(),
    registry,
  }).schedulingMode).toBe("static");
  expect(createWebGLEffectController({
    key: "reactive",
    declaration: [{ kind: "test.reactive" }],
    source: createElementSnapshotSource(),
    registry,
  }).schedulingMode).toBe("reactive");
  expect(createWebGLEffectController({
    key: "frame",
    declaration: [{ kind: "test.frame" }],
    source: createElementSnapshotSource(),
    registry,
  }).schedulingMode).toBe("frame");
});
```

Add a public type fixture in `publicExports.test.ts` proving `schedule` accepts only `"static" | "reactive" | "frame"`.

- [x] **Step 2: Verify the tests fail**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/effects/effectController.test.ts packages/dom-webgl-runtime/src/publicExports.test.ts
```

Expected: fail because effect definitions do not expose scheduling mode.

- [x] **Step 3: Implement scheduling types and controller summary**

Add:

```ts
export type WebGLEffectSchedule = "static" | "reactive" | "frame";
```

Add optional `schedule?: WebGLEffectSchedule` to the effect definition type. Default to `"frame"` for backward compatibility.

Expose from `WebGLEffectController`:

```ts
readonly schedulingMode: WebGLEffectSchedule;
needsUpdate(input: WebGLFrameInput, dirtyReasons: readonly RenderDirtyReason[]): boolean;
```

Rules:
- `frame` returns true every active frame and keeps continuous rendering.
- `reactive` returns true when dirty reasons include target/register/resource/dom/manual, when scroll mode is gate, when pointer declaration is active, or when progress/resource/layout changed.
- `static` runs once after source and target are available, then only after source/resource/layout invalidation.

- [x] **Step 4: Integrate runtime continuous decision**

In `runtime.ts`, replace the `hasEffects === true` branch in `shouldKeepTargetContinuous(...)` with `effectController.schedulingMode === "frame"`. Keep video, gate, and pointer declarations continuous.

When `needsUpdate(...)` returns false, skip `effectController.update(...)` for that frame.

- [x] **Step 5: Run focused verification**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/effects/effectController.test.ts packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts packages/dom-webgl-runtime/src/publicExports.test.ts
npm run typecheck
git diff --check
```

Expected: all pass.

- [x] **Step 6: Commit**

```bash
git add packages/dom-webgl-runtime/src/lib/effects/effectAuthoring.ts packages/dom-webgl-runtime/src/lib/effects/effectController.ts packages/dom-webgl-runtime/src/lib/effects/effectController.test.ts packages/dom-webgl-runtime/src/lib/renderer/runtime.ts packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts packages/dom-webgl-runtime/src/publicExports.test.ts
git commit -m "perf: add effect scheduling ownership"
```

## Task 4: Add Renderer Stats And Budget Warnings

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/threeRenderer.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/debug/debugState.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/types.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`
- Test: `packages/dom-webgl-runtime/src/lib/renderer/threeRenderer.test.ts`
- Test: `packages/dom-webgl-runtime/src/lib/debug/debugState.test.ts`
- Test: `packages/dom-webgl-runtime/src/publicExports.test.ts`

- [x] **Step 1: Write failing renderer stats tests**

Add test expectations:

```ts
expect(host.sceneAdapter.render).toBeDefined();
expect(host.readRendererStats()).toMatchObject({
  drawCalls: 0,
  triangles: 0,
  geometries: 0,
  textures: 0,
});
```

Add debug warning test:

```ts
const state = createDebugState({
  targetCount: 1,
  renderableCount: 1,
  currentScrollMode: "page",
  pointer: createInitialPointerState(),
  performanceBudget: { maxDrawCalls: 2, maxTextureCount: 3 },
  rendererStats: { drawCalls: 4, triangles: 12, geometries: 2, textures: 5 },
  targets: [createActiveTarget("hero")],
});

expect(state.warnings).toEqual([
  { code: "performance-budget-exceeded", target: "drawCalls", count: 4, limit: 2 },
  { code: "performance-budget-exceeded", target: "textureCount", count: 5, limit: 3 },
]);
```

- [x] **Step 2: Verify the tests fail**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/renderer/threeRenderer.test.ts packages/dom-webgl-runtime/src/lib/debug/debugState.test.ts packages/dom-webgl-runtime/src/publicExports.test.ts
```

Expected: fail because renderer stats and budget fields do not exist.

- [x] **Step 3: Implement internal renderer stats**

Add to `ThreeRendererHost`:

```ts
readRendererStats(): {
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
  programs?: number;
};
```

Map from `renderer.info.render.calls`, `renderer.info.render.triangles`, `renderer.info.memory.geometries`, `renderer.info.memory.textures`, and `renderer.info.programs?.length`. Return zeros when unavailable.

- [x] **Step 4: Add budget fields**

Extend `WebGLPerformanceBudget` with:

```ts
maxDrawCalls?: number;
maxTextureCount?: number;
maxRenderTargetSize?: number;
maxPostprocessRequests?: number;
```

Extend `WebGLPerformanceWarning["target"]` with `"drawCalls" | "textureCount" | "renderTargetSize" | "postprocessRequests"`.

- [x] **Step 5: Wire runtime debug state**

Pass `rendererHost.readRendererStats()` into `createDebugState(...)`. Do not expose raw renderer info or mutable Three objects.

- [x] **Step 6: Run focused verification**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/renderer/threeRenderer.test.ts packages/dom-webgl-runtime/src/lib/debug/debugState.test.ts packages/dom-webgl-runtime/src/publicExports.test.ts
npm run typecheck
git diff --check
```

Expected: all pass.

- [x] **Step 7: Commit**

```bash
git add packages/dom-webgl-runtime/src/lib/renderer/threeRenderer.ts packages/dom-webgl-runtime/src/lib/renderer/threeRenderer.test.ts packages/dom-webgl-runtime/src/lib/debug/debugState.ts packages/dom-webgl-runtime/src/lib/debug/debugState.test.ts packages/dom-webgl-runtime/src/lib/types.ts packages/dom-webgl-runtime/src/lib/renderer/runtime.ts packages/dom-webgl-runtime/src/publicExports.test.ts
git commit -m "feat: add renderer performance stats"
```

## Task 5: Add Viewport-Aware Resource Loading Priority

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/resources/resourceManager.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`
- Test: `packages/dom-webgl-runtime/src/lib/resources/resourceManager.test.ts`
- Test: `packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts`

- [x] **Step 1: Write failing priority queue tests**

Add to `resourceManager.test.ts`:

```ts
test("starts higher priority queued loads before lower priority loads", async () => {
  const manager = createResourceManager({ maxConcurrentResourceLoads: 1 });
  const first = manager.acquire(createModelDescriptor("/first.glb"));
  const second = manager.acquire(createModelDescriptor("/second.glb"));
  const order: string[] = [];
  let releaseFirst!: () => void;

  const firstLoad = first.load(
    () => new Promise<string>((resolve) => {
      order.push("first");
      releaseFirst = () => resolve("first");
    }),
    { priority: 0 },
  );
  const secondLoad = second.load(async () => {
    order.push("second");
    return "second";
  }, { priority: 10 });

  expect(order).toEqual(["first"]);
  releaseFirst();
  await Promise.all([firstLoad, secondLoad]);
  expect(order).toEqual(["first", "second"]);
});
```

Add a second test where two pending loads are queued before drain and the higher priority starts first.

- [x] **Step 2: Verify the tests fail**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/resources/resourceManager.test.ts
```

Expected: fail because `load(..., { priority })` is not supported.

- [x] **Step 3: Implement priority load options**

Change `ResourceHandle.load` to:

```ts
load(loader: () => Promise<T>, options?: { priority?: number }): Promise<T>;
```

In `createResourceLoadQueue`, store pending entries as `{ priority, run }`, sort descending priority before drain, and preserve FIFO order within equal priority.

- [x] **Step 4: Wire runtime priority**

In `runtime.ts`, pass priority based on lifecycle:
- active target: `100`
- preloading target: `50`
- inactive target: `10`
- disposed/far target: do not start new load

Keep image-sequence first frame priority higher than later frames when the source code path is available.

- [x] **Step 5: Run focused verification**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/resources/resourceManager.test.ts packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts
npm run typecheck
git diff --check
```

Expected: all pass.

- [x] **Step 6: Commit**

```bash
git add packages/dom-webgl-runtime/src/lib/resources/resourceManager.ts packages/dom-webgl-runtime/src/lib/resources/resourceManager.test.ts packages/dom-webgl-runtime/src/lib/renderer/runtime.ts packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts
git commit -m "perf: prioritize viewport resource loads"
```

## Task 6: Add Postprocess Budget V2

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/postprocessController.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/debug/debugState.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`
- Test: `packages/dom-webgl-runtime/src/lib/renderer/postprocessController.test.ts`
- Test: `packages/dom-webgl-runtime/src/lib/debug/debugState.test.ts`

- [x] **Step 1: Write failing postprocess budget tests**

Add to `postprocessController.test.ts`:

```ts
test("reports active request count and max render target size", () => {
  const controller = createPostprocessController(createPostprocessOptions({
    viewport: { width: 1600, height: 900 },
  }));

  controller.requestPostprocess({ key: "glow", bloom: { strength: 0.4 } });

  expect(controller.inspect()).toMatchObject({
    activeRequests: 1,
    maxRenderTargetSize: 800,
  });
});
```

Add a duplicate request merge test:

```ts
test("updates duplicate postprocess request keys instead of adding pass count", () => {
  const controller = createPostprocessController(createPostprocessOptions());
  const first = controller.requestPostprocess({ key: "glow", bloom: { strength: 0.2 } });
  controller.requestPostprocess({ key: "glow", bloom: { strength: 0.8 } });

  expect(controller.inspect().activeRequests).toBe(1);
  first.dispose();
  expect(controller.inspect().activeRequests).toBe(0);
});
```

- [x] **Step 2: Verify the tests fail**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/renderer/postprocessController.test.ts packages/dom-webgl-runtime/src/lib/debug/debugState.test.ts
```

Expected: fail because `inspect()` does not include these stats.

- [x] **Step 3: Implement controller inspection**

Add:

```ts
inspect(): {
  activeRequests: number;
  passCount: number;
  maxRenderTargetSize: number;
};
```

Keep half-resolution target behavior. Do not expose render targets or pass objects.

- [x] **Step 4: Add debug warnings**

Pass postprocess inspection into `createDebugState(...)` and emit warnings for `postprocessRequests` and `renderTargetSize`.

- [x] **Step 5: Run focused verification**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/renderer/postprocessController.test.ts packages/dom-webgl-runtime/src/lib/debug/debugState.test.ts packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts
npm run typecheck
git diff --check
```

Expected: all pass.

- [x] **Step 6: Commit**

```bash
git add packages/dom-webgl-runtime/src/lib/renderer/postprocessController.ts packages/dom-webgl-runtime/src/lib/renderer/postprocessController.test.ts packages/dom-webgl-runtime/src/lib/debug/debugState.ts packages/dom-webgl-runtime/src/lib/debug/debugState.test.ts packages/dom-webgl-runtime/src/lib/renderer/runtime.ts packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts
git commit -m "perf: budget postprocess runtime cost"
```

## Task 7: Add Plane Geometry Sharing And Batching Gate

**Files:**
- Create: `packages/dom-webgl-runtime/src/lib/render/renderables/sharedPlaneGeometry.ts`
- Test: `packages/dom-webgl-runtime/src/lib/render/renderables/sharedPlaneGeometry.test.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/texturePlaneSceneRenderable.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/textPlaneSceneRenderable.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/elementPlaneSceneRenderable.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/debug/debugState.ts`
- Test: `packages/dom-webgl-runtime/src/lib/debug/debugState.test.ts`

- [x] **Step 1: Write failing shared geometry tests**

Create `sharedPlaneGeometry.test.ts`:

```ts
import { describe, expect, test, vi } from "vitest";
import { acquireSharedPlaneGeometry } from "./sharedPlaneGeometry";

describe("shared plane geometry", () => {
  test("reuses one PlaneGeometry until all handles dispose", () => {
    const first = acquireSharedPlaneGeometry();
    const second = acquireSharedPlaneGeometry();
    const dispose = vi.spyOn(first.geometry, "dispose");

    expect(first.geometry).toBe(second.geometry);
    first.dispose();
    expect(dispose).not.toHaveBeenCalled();
    second.dispose();
    expect(dispose).toHaveBeenCalledTimes(1);
  });
});
```

- [x] **Step 2: Verify the test fails**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/render/renderables/sharedPlaneGeometry.test.ts
```

Expected: fail because the module does not exist.

- [x] **Step 3: Implement shared geometry ownership**

Create:

```ts
export function acquireSharedPlaneGeometry(): {
  geometry: PlaneGeometry;
  dispose(): void;
}
```

Use a module-level `PlaneGeometry(1, 1)` and ref count. Dispose only at zero refs.

- [x] **Step 4: Migrate plane renderables**

Replace direct `new PlaneGeometry(1, 1)` in texture/text/element plane renderables with `acquireSharedPlaneGeometry()`. Call the handle's `dispose()` where geometry disposal currently happens.

- [x] **Step 5: Add batching gate telemetry**

Do not implement batching. Add debug-only counters that identify active compatible plane families:

```ts
type BatchCandidateSummary = {
  compatiblePlaneCount: number;
  largestFamilySize: number;
};
```

Expose only through internal debug state or profile notes; do not add a public batching API.

- [x] **Step 6: Run focused verification**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/render/renderables/sharedPlaneGeometry.test.ts packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts packages/dom-webgl-runtime/src/lib/debug/debugState.test.ts
npm run typecheck
git diff --check
```

Expected: all pass.

- [x] **Step 7: Commit**

```bash
git add packages/dom-webgl-runtime/src/lib/render/renderables/sharedPlaneGeometry.ts packages/dom-webgl-runtime/src/lib/render/renderables/sharedPlaneGeometry.test.ts packages/dom-webgl-runtime/src/lib/render/renderables/texturePlaneSceneRenderable.ts packages/dom-webgl-runtime/src/lib/render/renderables/textPlaneSceneRenderable.ts packages/dom-webgl-runtime/src/lib/render/renderables/elementPlaneSceneRenderable.ts packages/dom-webgl-runtime/src/lib/debug/debugState.ts packages/dom-webgl-runtime/src/lib/debug/debugState.test.ts packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts
git commit -m "perf: share plane geometry and report batching candidates"
```

## Task 8: Add Model Animation Ownership Boundary

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/modelRenderable.ts`
- Test: `packages/dom-webgl-runtime/src/lib/render/renderables/modelRenderable.test.ts`
- Modify only if needed: `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`

- [x] **Step 1: Write failing model animation ownership tests**

Add to `modelRenderable.test.ts`:

```ts
test("updates model animation mixer only while visible and active", async () => {
  const source = createModelDescriptor("/models/animated.glb");
  const descriptor = createTargetDescriptor(
    source.anchor,
    { key: "hero.model" },
    0,
  );
  const mixer = { update: vi.fn() };
  const model = {
    scene: new Group(),
    animations: [{ name: "Idle" }],
    mixer,
  };
  const renderable = createModelRenderable(
    {
      descriptor,
      source,
      role: "model",
      policy: compileRenderPolicy("model"),
    },
    {
      resourceManager: createResourceManager(),
      sceneAdapter: createSceneAdapter(),
      measureElement: () => createMeasurement(0, 0, 100, 100),
      loadModel: async () => model,
    },
  );

  await renderable.update(createFrameInput({ delta: 16 }));
  renderable.setVisible(false);
  await renderable.update(createFrameInput({ delta: 16 }));

  expect(mixer.update).toHaveBeenCalledTimes(1);
});
```

Use the existing helpers in `modelRenderable.test.ts`: `createModelDescriptor`, `createSceneAdapter`, and `createMeasurement`. Add a local `createFrameInput` helper if the file does not already have one:

```ts
function createFrameInput(input: Partial<WebGLFrameInput> = {}): WebGLFrameInput {
  return {
    time: 100,
    delta: 16,
    scroll: {
      mode: "page",
      pageProgress: 0,
      direction: 0,
      velocity: 0,
    },
    pointer: {
      x: 0,
      y: 0,
      normalizedX: 0,
      normalizedY: 0,
      isInside: false,
      isDown: false,
      downTime: 0,
      pressDuration: 0,
      isDragging: false,
      dragStartX: 0,
      dragStartY: 0,
      dragDeltaX: 0,
      dragDeltaY: 0,
      clickCount: 0,
    },
    ...input,
  };
}
```

- [x] **Step 2: Verify the test fails**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/render/renderables/modelRenderable.test.ts
```

Expected: fail because model animation mixer ownership is not implemented.

- [x] **Step 3: Implement internal optional animation driver**

Recognize an internal loaded model shape with `animations` and an adapter-created mixer. Keep this internal; do not export mixer handles. Add a renderable method or status bit that tells runtime whether active model animation requires continuous frames.

Rule:
- no clips or no active mixer: no continuous rendering.
- visible active mixer: update by `frameInput.delta / 1000`.
- parked/offscreen/invisible: do not update mixer.

- [x] **Step 4: Run focused verification**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/render/renderables/modelRenderable.test.ts packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts
npm run typecheck
git diff --check
```

Expected: all pass.

- [x] **Step 5: Commit**

```bash
git add packages/dom-webgl-runtime/src/lib/render/renderables/modelRenderable.ts packages/dom-webgl-runtime/src/lib/render/renderables/modelRenderable.test.ts packages/dom-webgl-runtime/src/lib/renderer/runtime.ts packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts
git commit -m "perf: own model animation scheduling"
```

## Task 9: Profile Harness And Documentation Closeout

**Files:**
- Modify: `docs/performance/profile-notes.md`
- Modify: `README.md`
- Modify: `docs/00-goal.md`
- Modify: `docs/EXECUTION_STATE.md`
- Modify: `docs/agent/package-usage.md`
- Modify: `docs/superpowers/plans/2026-06-30-runtime-performance-ownership-v2.md`

- [x] **Step 1: Run full verification**

Run:

```bash
npm run test -- --run && npm run typecheck && npm run build && npm run check:imports && git diff --check
```

Expected: all pass. Existing Vite chunk-size warning remains non-blocking unless it becomes a failure.

- [x] **Step 2: Run profile scenarios**

Start the example:

```bash
npm run dev -w @project/dom-webgl-example
```

Profile these scenarios using the same browser counter method recorded in `docs/performance/profile-notes.md`:
- idle page
- scroll page
- pinned section
- image sequence
- GLB model
- postprocess active target
- many plane targets stress case

Record:
- frame time avg / p95 / max
- draw calls per frame
- texture uploads per frame
- DOM rect reads per frame
- renderer textures/geometries/programs
- active postprocess requests
- largest batching candidate family

- [x] **Step 3: Update docs**

Update docs with exact current truth:
- runtime now has split upload/frame dirty ownership,
- material uniforms update incrementally,
- effects can declare scheduling intent,
- renderer stats feed budget warnings,
- resources load by viewport priority,
- postprocess requests have cost warnings,
- plane geometry is shared,
- batching is still gated by profile evidence,
- model animation scheduling is runtime-owned when model animation exists.

- [x] **Step 4: Mark plan complete**

Change this plan's checkboxes from `[ ]` to `[x]` only for tasks that were actually implemented and verified. Add a short `Implementation Result` section with commit hashes and verification output.

- [x] **Step 5: Commit docs closeout**

```bash
git add docs/performance/profile-notes.md README.md docs/00-goal.md docs/EXECUTION_STATE.md docs/agent/package-usage.md docs/superpowers/plans/2026-06-30-runtime-performance-ownership-v2.md
git commit -m "docs: record runtime performance ownership v2"
```

## Final Verification

Before claiming this plan is complete, run:

```bash
npm run test -- --run && npm run typecheck && npm run build && npm run check:imports && git diff --check
```

Expected: all commands pass. If the production build reports the existing chunk-size warning only, record it as non-blocking.

## Implementation Result

- Task 1 commit: `c2e11784` (`perf: split texture upload and frame dirtiness`)
- Task 2 commit: `9563d35f` (`perf: update material layer uniforms incrementally`)
- Task 3 commit: `c81933bd` (`perf: add effect scheduling ownership`)
- Task 4 commit: `21c827ad` (`feat: add renderer performance stats`)
- Task 5 commit: `006aff3c` (`perf: prioritize viewport resource loads`)
- Task 6 commit: `ed556e3e` (`perf: budget postprocess runtime cost`)
- Task 7 commit: `ee7b7798` (`perf: share plane geometry and report batching candidates`)
- Task 8 commit: `af5f127d` (`perf: own model animation scheduling`)
- Task 9 commit: this docs/profile closeout commit.

Verification before docs closeout:

```bash
npm run test -- --run && npm run typecheck && npm run build && npm run check:imports && git diff --check
```

Result: passed. `npm run test -- --run` passed with 90 files / 528 tests.
`npm run build` passed with the existing non-blocking Vite chunk-size warning.
`npm run check:imports` passed with `Example import boundary OK`.

Profile result: `docs/performance/profile-notes.md` records the 2026-06-30
Playwright/browser-counter profile. The current example still does not prove
draw calls dominate many compatible active planes; automatic batching remains
deferred. The current example has no true postprocess requester and no dedicated
many-plane stress fixture, so those rows are recorded as current-app proxy
samples rather than claimed as full stress coverage.

## Commit Strategy

- Commit Task 1 through Task 8 independently.
- Commit Task 9 docs/profile closeout independently.
- Do not stage `.agents/` or `skills-lock.json`.
- Do not squash until every task has passed focused verification; a later branch finishing step may decide whether to squash.

## Rollback Strategy

- Task 1 can be rolled back by restoring direct texture upload dirty behavior.
- Task 2 can be rolled back by reverting material uniform diffing while keeping material layer public API unchanged.
- Task 3 can be rolled back by defaulting all effects to frame scheduling and restoring the previous continuous decision.
- Task 4 can be rolled back by removing renderer stats from debug state; no public raw renderer access should exist.
- Task 5 can be rolled back by ignoring resource priority and preserving current concurrency limits.
- Task 6 can be rolled back by disabling postprocess budget warnings while preserving bounded pass execution.
- Task 7 can be rolled back by reverting shared plane geometry call sites to per-renderable geometries.
- Task 8 can be rolled back by disabling internal animation mixer updates without changing model source declarations.

## Execution Handoff

Recommended execution mode: subagent-driven, one fresh implementer per task, with a spec-compliance review and code-quality review before each commit. Inline execution is acceptable if the executor works task-by-task and stops after any failed focused verification.
