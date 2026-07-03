# Visual Effect Capability API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose a controlled visual capability API for shader/material, source texture, text, image, video, GLB/model, managed 3D layer, and simple postprocess effects without leaking raw Three.js runtime internals.

**Architecture:** Keep `defineWebGLEffect(...)` as the single authoring model. Runtime owns renderer, scene, camera, materials, textures, render targets, passes, and disposal; effects receive data-only or DOM-backed declarations and handles for material layers, uniforms, source textures, model mesh wrappers, managed 3D layers, and named postprocess requests.

**Tech Stack:** TypeScript, Three.js internal adapters, Vitest/jsdom, existing public export type fixtures, `apps/example` browser QA.

**Implementation status:** Implemented in this branch. Tasks 1-8 are complete
in code/docs; final full verification is tracked in the conversation closeout.
Visual browser QA for the Ghost Cursor dogfood remains user-owned per the latest
manual review instruction.

---

## Starting Truth

- Current source kinds are `snapshot/element`, `snapshot/text`, `image`, `video`, and `model/glb` in `packages/dom-webgl-runtime/src/lib/effects/effectAuthoring.ts:14-19`.
- Existing public handles cover Canvas2D drawing, text glyph commands, image/video texture transforms, video playback, model traversal, sampled vertices, and point-cloud creation in `effectAuthoring.ts:47-158`.
- Source capability factories are centralized in `packages/dom-webgl-runtime/src/lib/render/renderables/sourceCapabilityHandles.ts:50-155`.
- Element snapshots are runtime-owned `CanvasTexture` + `MeshBasicMaterial` planes in `elementPlaneSceneRenderable.ts:19-71`.
- Image/video renderables already own `Texture`/`VideoTexture`, object-fit mapping, and layer handles in `texturePlaneSceneRenderable.ts:34-160`.
- Model handles currently expose raw `unknown` mesh traversal and point-cloud creation in `modelEffectHandle.ts:11-41`.
- Runtime owns renderer, scene, camera, canvas, viewport, and render loop through `threeRenderer.ts` and `runtime.ts`; these must remain internal.

## Public Capability Shape

Add public data-only or DOM-backed types in `packages/dom-webgl-runtime/src/lib/effects/effectAuthoring.ts` and export them from the root entrypoint:

```ts
export type WebGLEffectUniformValue =
  | number
  | boolean
  | string
  | readonly [number, number]
  | readonly [number, number, number]
  | readonly [number, number, number, number]
  | readonly (readonly [number, number])[]
  | WebGLEffectTextureUniform;

export type WebGLEffectTextureUniform =
  | { kind: "source-texture" }
  | { kind: "canvas-texture"; source: HTMLCanvasElement }
  | { kind: "image-texture"; source: HTMLImageElement }
  | { kind: "video-texture"; source: HTMLVideoElement };

export type WebGLEffectBlendMode =
  | "normal"
  | "additive"
  | "multiply"
  | "screen";

export type WebGLEffectMaterialProgram = {
  vertexShader?: string;
  fragmentShader: string;
  uniforms?: Record<string, WebGLEffectUniformValue>;
  defines?: Record<string, string | number | boolean>;
  blend?: WebGLEffectBlendMode;
  transparent?: boolean;
  depthWrite?: boolean;
  depthTest?: boolean;
  toneMapped?: boolean;
};

export type WebGLEffectMaterialLayerHandle = {
  setProgram(program: WebGLEffectMaterialProgram): void;
  setUniforms(uniforms: Record<string, WebGLEffectUniformValue>): void;
  clear(): void;
  dispose(): void;
};

export type WebGLEffectMaterialLayerHost = {
  createMaterialLayer(options: {
    key: string;
    program: WebGLEffectMaterialProgram;
    sourceTextureUniform?: string;
    mode?: "replace-source" | "overlay";
  }): WebGLEffectMaterialLayerHandle;
};
```

Extend source handles so every source kind has a coherent route:

| Source | Capability |
| --- | --- |
| `snapshot/element` | Canvas2D surface plus `createMaterialLayer(...)` over the element/source texture. |
| `snapshot/text` | Text atlas/glyph data plus `createMaterialLayer(...)` over the text texture. |
| `image` | Object-fit aware image texture plus `createMaterialLayer(...)`. |
| `video` | Video texture/playback controls plus `createMaterialLayer(...)`. |
| `model/glb` | Controlled mesh handles, material override/restore, sampled point layers, and managed 3D layers. |

Add controlled model handles beside the existing `traverseMeshes(visitor: (mesh: unknown) => void)` compatibility API:

```ts
export type WebGLModelMeshHandle =
  WebGLEffectRenderableHandle &
  WebGLEffectMaterialLayerHost & {
    readonly index: number;
    readonly name?: string;
    readonly materialName?: string;
    restoreMaterial(): void;
  };

export type WebGLEffectPointLayerOptions = {
  positions: Float32Array;
  color?: number | string;
  size?: number;
  material?: WebGLEffectMaterialProgram;
};
```

`WebGLModelEffectHandle` should gain:

```ts
getMeshes(): readonly WebGLModelMeshHandle[];
forEachMesh(visitor: (mesh: WebGLModelMeshHandle) => void): void;
createPointLayer(options: WebGLEffectPointLayerOptions): WebGLEffectManagedObjectHandle;
```

Add a small postprocess request API as runtime-owned named effects:

```ts
export type WebGLEffectPostprocessRequest = {
  key: string;
  bloom?: { strength?: number; radius?: number; threshold?: number };
  grain?: { amount?: number };
  blur?: { radius?: number };
};

export type WebGLEffectVisualContext = {
  requestPostprocess(
    request: WebGLEffectPostprocessRequest,
  ): WebGLEffectPostprocessHandle;
};
```

Expose this through `ctx.visual.requestPostprocess(...)`. Rationale: postprocess is renderer/runtime-scoped, while `ctx.target` is a renderable/object handle. Do not expose raw composer/pass objects.

## File Structure

- Modify `packages/dom-webgl-runtime/src/lib/effects/effectAuthoring.ts`: public capability types and handle extensions.
- Modify `packages/dom-webgl-runtime/src/index.ts`: root type exports.
- Modify `packages/dom-webgl-runtime/src/publicExports.test.ts`: positive imports and negative internal export checks.
- Create `packages/dom-webgl-runtime/src/lib/render/renderables/materialLayer.ts`: internal compiler/restorer/disposer for runtime-owned material layers.
- Create `packages/dom-webgl-runtime/src/lib/render/renderables/materialLayer.test.ts`: compiler, uniform, restore, dispose tests.
- Modify `packages/dom-webgl-runtime/src/lib/render/renderables/sourceCapabilityHandles.ts`: attach material layer hosts to source handles.
- Modify `packages/dom-webgl-runtime/src/lib/render/renderables/elementPlaneSceneRenderable.ts`: pass source texture/material layer options.
- Modify `packages/dom-webgl-runtime/src/lib/render/renderables/texturePlaneSceneRenderable.ts`: pass image/video texture layer options and preserve object-fit transform.
- Modify `packages/dom-webgl-runtime/src/lib/render/renderables/modelEffectHandle.ts`: controlled mesh handles and managed point layers.
- Add/update model tests in `modelEffectHandle.test.ts` and `modelRenderable.test.ts`.
- Create `packages/dom-webgl-runtime/src/lib/renderer/postprocessController.ts` and tests if postprocess lands in this iteration.
- Modify `apps/example` Ghost Cursor effect to dogfood the new public API.
- Update `README.md`, `docs/00-goal.md`, `docs/EXECUTION_STATE.md`, `docs/agent/package-usage.md`, `docs/agent/package-onboarding.md`, and `docs/examples/effect-authoring.md`.

## Tasks

### Task 1: Public Contract And Export Boundary

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/effects/effectAuthoring.ts`
- Modify: `packages/dom-webgl-runtime/src/index.ts`
- Modify: `packages/dom-webgl-runtime/src/publicExports.test.ts`

- [x] Add the public types from "Public Capability Shape".
- [x] Extend handle types only through data-only public contracts.
- [x] Add positive type fixtures for material layers, model mesh handles, point layers, and postprocess request types.
- [x] Add negative type fixtures proving raw renderer/scene/camera/composer/render-target types are not exported.
- [x] Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/publicExports.test.ts
```

Expected: pass.

### Task 2: Material Layer Compiler

**Files:**
- Create: `packages/dom-webgl-runtime/src/lib/render/renderables/materialLayer.ts`
- Create: `packages/dom-webgl-runtime/src/lib/render/renderables/materialLayer.test.ts`

- [x] Implement an internal material layer factory that compiles public declarations into runtime-owned Three material state.
- [x] Support `setProgram`, `setUniforms`, `clear`, and `dispose`.
- [x] Preserve and restore the original material.
- [x] Map public blend modes internally.
- [x] Bind `{ kind: "source-texture" }` and DOM-backed texture refs to runtime-created texture uniforms.
- [x] Reject invalid uniform values with a deterministic error.
- [x] Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/render/renderables/materialLayer.test.ts
```

Expected: pass.

### Task 3: Source Material Layer Hosts

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/sourceCapabilityHandles.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/elementPlaneSceneRenderable.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/texturePlaneSceneRenderable.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/sourceCapabilityHandles.test.ts`

- [x] Attach `createMaterialLayer(...)` to element surface, text layer, image layer, and video layer handles.
- [x] Preserve existing `draw`, `clear`, `setGlyphs`, `setTextureTransform`, `play`, `pause`, `setMuted`, and `setPlaybackRate` behavior.
- [x] Ensure layer dispose restores source material and does not double-dispose.
- [x] Ensure image/video object-fit transforms still apply after a material layer is created.
- [x] Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/render/renderables/sourceCapabilityHandles.test.ts packages/dom-webgl-runtime/src/lib/render/renderables/imageRenderable.test.ts packages/dom-webgl-runtime/src/lib/render/renderables/videoRenderable.test.ts
```

Expected: pass.

### Task 4: Text And Media Shader Inputs

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/effects/effectAuthoring.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/sourceCapabilityHandles.ts`
- Modify: `packages/dom-webgl-runtime/src/publicExports.test.ts`
- Modify tests around text/media handles.

- [x] Expose source-specific shader input metadata for text/image/video without exposing raw Three types.
- [x] Include size, DPR, source texture availability, text glyph coordinates, media natural size, content box, and object-fit UV transform.
- [x] Add type tests for consuming those inputs from `defineWebGLEffect`.
- [x] Run focused public export and source capability tests.

Expected: pass.

### Task 5: GLB Mesh Handles And Managed 3D Layers

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/modelEffectHandle.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/modelEffectHandle.test.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/modelRenderable.test.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/effects/effectAuthoring.ts`

- [x] Add controlled `WebGLModelMeshHandle`.
- [x] Support mesh material layer creation and restore.
- [x] Support material arrays and missing material safely.
- [x] Add `createPointLayer(...)` that returns a managed handle and disposes generated geometry/material through runtime-owned lifecycle.
- [x] Keep existing raw `traverseMeshes` compatible but document it as an escape hatch.
- [x] Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/render/renderables/modelEffectHandle.test.ts packages/dom-webgl-runtime/src/lib/render/renderables/modelRenderable.test.ts
```

Expected: pass.

### Task 6: Controlled Postprocess Requests

**Files:**
- Create: `packages/dom-webgl-runtime/src/lib/renderer/postprocessController.ts`
- Create: `packages/dom-webgl-runtime/src/lib/renderer/postprocessController.test.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/threeRenderer.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/effects/effectAuthoring.ts`

- [x] Add named postprocess requests for `bloom`, `grain`, and `blur`.
- [x] Expose them through `ctx.visual.requestPostprocess(...)`.
- [x] Runtime owns any composer/pass/render-target objects.
- [x] Duplicate keys update existing requests.
- [x] Disposing an effect removes its request.
- [x] Rendering falls back to the current render path when no requests are active.
- [x] Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/renderer/postprocessController.test.ts packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts
```

Expected: pass.

### Task 7: Example Dogfood

**Files:**
- Modify: `apps/example/src/ghostCursorSurface.ts`
- Modify: `apps/example/src/surfaceEffects.ts`
- Modify: `apps/example/src/SnapshotElementExamples.tsx`
- Modify related example tests/docs.

- [x] Rewrite Ghost Cursor to use public material layer/shader capability.
- [x] Smoke field exists and animates without pointer.
- [x] Pointer only controls target-local emissive smoke/trail activation.
- [x] No global pointer effect.
- [x] No private package imports.
- [x] Run:

```bash
npm test -- --run apps/example/src
npm run check:imports
```

Expected: pass.

### Task 8: Docs, Boundary Sweep, And Lightweight Review

**Files:**
- Modify: `README.md`
- Modify: `docs/00-goal.md`
- Modify: `docs/EXECUTION_STATE.md`
- Modify: `docs/agent/package-usage.md`
- Modify: `docs/agent/package-onboarding.md`
- Modify: `docs/examples/effect-authoring.md`
- Modify: this plan file status if implementation starts/completes.

- [x] Document the capability matrix by source kind.
- [x] Document resource ownership and disposal rules.
- [x] Document why raw Three renderer/scene/camera/composer are not public.
- [x] Keep concrete effects consumer-owned.
- [x] Run:

```bash
rg -n "@project/dom-webgl-runtime/effects|effects\\.material|effects\\.motion" README.md docs packages/dom-webgl-runtime/src apps/example/src
git diff --check
```

Expected: no current-truth docs or source reintroduce removed APIs; `git diff --check` passes.

## Final Verification

Run:

```bash
npm run test -- --run
npm run typecheck
npm run build
npm run check:imports
git diff --check
```

Manual browser QA for `apps/example` remains the final visual gate before
release. Per the latest manual review instruction, this branch does not claim
agent browser QA for Ghost Cursor fidelity. The manual pass should verify:

- Ghost Cursor renders through the new public API.
- Default smoke exists without pointer.
- Pointer-activated emissive smoke/trail is target-local.
- No console errors.
- Mobile width has no text overflow.

## Review Scope

Keep review appropriate, not heavyweight:

- One package-boundary/code-design pass focused on public API leakage, lifecycle ownership, and source-kind cohesion.
- One browser/manual QA pass for the dogfood example.
- No high-ceremony multi-agent review unless explicitly requested.

## Success Criteria

- Controlled public API covers shader/material, source texture, text, image, video, GLB/model, managed 3D layer, and simple postprocess use cases.
- Public API does not leak raw Three renderer/scene/camera/composer/render-target objects.
- Runtime owns restore/dispose for material/layer/postprocess resources.
- Example uses only public entrypoints.
- Full verification passes.
