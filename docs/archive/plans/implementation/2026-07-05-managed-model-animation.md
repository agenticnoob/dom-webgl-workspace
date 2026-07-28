# Managed Model Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Phase 7 managed model animation by adding a scene-native `WebGLModel` descriptor path plus richer runtime-owned clip, blend, scrub, morph, and model diagnostics APIs without exposing raw Three.js mixers, actions, bones, skeletons, morph arrays, loaders, scenes, cameras, or render-loop handles.

**Architecture:** Preserve the DOM-first Level 1 `WebGLTarget` path and extend the existing `model/glb` runtime substrate instead of replacing it. Reuse the existing GLB loader, model effect handle, model renderable animation controller, progress-signal channel, managed scene adapters, and descriptor registration patterns; add a separate scene-native model registry for `WebGLModel` because it has no DOM fallback, target lifecycle, or target-local pointer state. Public authoring remains descriptor-driven and `ctx.object`-centered for DOM-backed effects.

**Tech Stack:** TypeScript, React adapter components, Three.js internals behind controlled facades, Vitest/jsdom, npm workspaces, existing DOM WebGL runtime registries, existing `WebGLProgressSignalSource`.

---

## Context Verified For This Plan

- Roadmap Status table selection: the first `[not-started]` phase is
  `Phase 7: Managed Model Animation`.
- Existing focused plan: none exists for Phase 7 under
  `docs/superpowers/plans/`.
- This plan creation updates Phase 7 to `[planned]` and links this file from
  `docs/roadmap/managed-render-system.md`.
- Current branch while planning: `codex/managed-render-roadmap-iteration`.
- Current HEAD while planning: `465bdd4d`.
- Worktree was clean before this docs-only planning edit.
- Git truth includes Phase 6A closeout commits:
  `6e8f468c feat: add managed camera controllers`,
  `bcbc635d Fix DOM-bound pass viewport clipping`, and
  `465bdd4d fix: stabilize managed timeline camera`.
- `docs/STATUS.md` and the active roadmap agree that:
  - `WebGLTarget` remains the shortest DOM-first path;
  - scene-native `WebGLModel` is still future roadmap work;
  - existing model targets are DOM-backed `source: { kind: "model", type: "glb" }`;
  - `ctx.object.animation` and `ctx.object.model` exist for loaded GLB targets;
  - raw renderer, scene, camera, object, mesh, material, texture, mixer,
    action, raycaster, render target, and pass objects remain private.
- CodeGraph source truth:
  - `createModelRenderable(...)` loads `model/glb`, creates a runtime-owned
    target root, creates `createModelAnimationController(model)`, and exposes
    it through `createModelEffectHandle(...)`.
  - `createModelAnimationController(...)` currently supports `clips()`,
    `play(name, { loop, fadeInMs, timeScale })`, `stop(name)`, `stopAll()`,
    `setTime(seconds)`, visible-only `update(deltaMilliseconds)`, and
    `dispose()`.
  - `WebGLEffectAnimationFacade` currently has only `clips`, `play`, `stop`,
    `stopAll`, and `setTime`.
  - `WebGLEffectModelFacade` currently has `src`, `meshes`, `sampling`, and
    `points`; it has no morph or rig metadata facade.
  - `WebGLRuntime` currently exposes scene/camera/pass/passViewport,
    stagePrimitive, light, and target registration methods; it has no
    `registerModel(...)`.
  - React currently exports `WebGLScene`, `WebGLCamera`, `WebGLRenderPass`,
    `WebGLPassViewport`, `WebGLStagePlane`, `WebGLStageBox`, `WebGLLight`, and
    `WebGLTarget`; there is no `WebGLModel`.
  - Runtime `syncFrame(...)` updates render layer timelines, stage timelines,
    camera controllers, then target layout/effects/renderables. Scene-native
    models should update in this same frame loop and contribute to continuous
    rendering when an active clip requires ticking.
  - `createDebugState(...)` reports targets, stage primitives, lights, render
    passes, camera controllers, and postprocess requests, but no managed model
    inventory.
- Test truth:
  - `packages/dom-webgl-runtime/test/lib/render/renderables/modelRenderable.test.ts`
    covers basic model renderables and runtime-owned animation mixer creation.
  - `packages/dom-webgl-runtime/test/lib/render/renderables/modelEffectHandle.test.ts`
    covers controlled model handles and animation facade exposure.
  - `packages/dom-webgl-runtime/test/lib/effects/effectObjectCapabilities.test.ts`
    covers mapping model animation to `ctx.object.animation`.
  - `packages/dom-webgl-runtime/test/publicExports.test.ts` guards public type
    surface and raw handle rejections.
- Example asset truth:
  - `apps/example/public/models/hero.glb` and `apps/example/public/models/4.glb`
    have no GLB `animations`, no `skins`, and no morph targets in their JSON
    chunks.
  - `apps/example/public/models/Sprint.glb` exists and is the confirmed app
    dogfood asset for clip/skin animation. Its GLB JSON has many animation
    clips, including `MainSkeleton.001`, a small sub-rig clip, and many named
    object clips, plus corresponding main and sub-rig skins.
    It has no morph targets.
  - Morph target behavior still needs synthetic loaded-model fixtures or a
    later app-local morph asset; do not claim `Sprint.glb` proves morph visual
    behavior.
- User decisions recorded after initial plan:
  - Use `Sprint.glb` for visual clip/skin animation dogfood.
  - Do not implement additive layers, bone attachments, IK, action graphs, or
    animation state machines in Phase 7 v1, but document them as deferred
    future capability areas.
  - Do not support target-local `effects` on scene-native `WebGLModel` in v1.
    Record that scene-native model effect authoring is needed later and should
    be designed separately rather than bolted onto the target-local effect
    contract.
- No code implementation was performed while creating this plan.

## Scope

Implement the smallest complete Phase 7 v1:

- Keep DOM-backed `WebGLTarget` model sources valid and unchanged as the default
  DOM-first model path.
- Add scene-native `WebGLModel` as an opt-in Level 3 descriptor for
  `stage-local` models that do not need DOM fallback, DOM layout fitting, target
  lifecycle, or target-local pointer state.
- Add vanilla runtime parity with `runtime.registerModel(...)` and
  `runtime.unregisterModel(...)`.
- Reuse the runtime-owned GLB loader, `ResourceManager`, model disposal, model
  handle, animation controller, and scene adapter logic where possible.
- Extend the controlled animation facade so effects on DOM-backed model targets
  can:
  - list clips;
  - play default or named clips;
  - scrub a named clip from time or normalized progress;
  - blend two named clips by weight;
  - trigger a managed crossfade;
  - stop one clip or all clips;
  - keep raw `AnimationMixer` and `AnimationAction` private.
- Add controlled model morph and rig metadata facades below `ctx.object.model`:
  - list morph target names;
  - read and set morph weights by name;
  - list named bones for diagnostics only;
  - never expose raw `Bone`, `Skeleton`, `morphTargetDictionary`,
    `morphTargetInfluences`, mesh, or node objects.
- Add descriptor-driven model animation for scene-native `WebGLModel`:
  - default clip playback;
  - progress-driven clip scrub;
  - progress-driven blend/crossfade;
  - progress-driven morph weight;
  - controlled diagnostics for missing clip or morph names.
- Add descriptor-only debug summaries for managed models:
  - id, sceneId, src;
  - resource status;
  - clip names and active clip names;
  - morph target names;
  - current timeline facts when applicable;
  - diagnostics for missing clip/morph/bone references;
  - no raw objects.
- Update public docs and example docs to show:
  - Level 1 model target remains `WebGLTarget` with `source: model/glb`;
  - Level 3 scene-native model uses `WebGLModel`;
  - effects use `ctx.object.animation` and `ctx.object.model.morphs`;
  - missing GLB authoring data is an asset problem, not a runtime crash.

## Non-Goals

- Do not replace DOM-backed `WebGLTarget` model sources.
- Do not add DOM fallback, lifecycle hiding, target pointer state, or DOM layout
  fitting to `WebGLModel`.
- Do not add `WebGLModel` as a child of `WebGLTarget` or make it inherit target
  lifecycle.
- Do not expose raw `AnimationMixer`, `AnimationAction`, `Object3D`, `Group`,
  `Mesh`, `Material`, `Texture`, `Bone`, `Skeleton`, `morphTargetInfluences`,
  `GLTFLoader`, `DRACOLoader`, scene, camera, renderer, render pass, render
  target, composer, or render-loop hooks.
- Do not add loader callbacks such as `configureLoader`, `onGLTFLoaded`,
  `onObject3D`, or `onMixerCreated`.
- Do not add procedural character animation, IK, retargeting, bone constraints,
  cloth, ragdoll, physics, colliders, or attachment sockets in Phase 7 v1.
- Do not add picking, raycasting, object hit regions, pointer drag, pointer
  parallax, orbit controls, or empty-space camera controls. Those remain
  Phase 8 work.
- Do not add broad additive animation graph/layer APIs in v1. Blend and
  crossfade are enough for the Phase 7 exit criterion of two-clip blending.
- Do not add additive layers for idle overlays/breathing/secondary motion in
  v1. Record them as a later animation-composition iteration after v1 proves
  basic clip/blend/scrub ownership.
- Do not add bone attachments in v1. Listing bone names for diagnostics is
  allowed; attaching scene objects, lights, labels, or effects to named bones
  needs a separate managed attachment descriptor design.
- Do not add an IK system, action graph, or animation state machine in v1.
  Those imply prioritization, transitions, events, and possibly input/physics
  integration that should not be hidden inside Phase 7.
- Do not add target-local `effects` to scene-native `WebGLModel` in v1. Later
  scene-native model effect authoring should be discussed as its own API
  design, likely with explicit scene-object/effect scope rather than reusing
  the DOM-target effect contract unchanged.
- Do not couple animation to React state churn, GSAP timelines, or direct
  ScrollTrigger instances. Animation consumes runtime progress signals and
  descriptor data.
- Do not promote example-specific model effects, asset names, copy, or visual
  tuning into package core.

## API And Architecture Principles

- DOM-first: `WebGLTarget` remains the shortest documented model path when a
  model follows DOM layout, fallback, accessibility, or lifecycle.
- Scene-native is opt-in: `WebGLModel` is for stage-local 3D islands inside
  managed scenes, not the default target authoring model.
- React mental model: `WebGLModel` is a null React descriptor component like
  `WebGLStagePlane` and `WebGLLight`; nesting under `WebGLScene` communicates
  scene ownership.
- Agent-first naming: use explicit Three-like names such as `position`,
  `rotation`, `scale`, `animation`, `clip`, `loop`, `scrub`, `blend`,
  `crossfade`, `morph`, and `timeline`.
- Managed ownership: declarations and facades describe intent; runtime owns raw
  loaders, objects, mixers, actions, morph arrays, disposal, scheduling, and
  debug aggregation.
- Explicit data flow: progress signals feed model animation descriptors;
  descriptors update internal action weights/times; render passes draw the
  scene through existing managed camera/pass infrastructure.
- Controlled diagnostics: missing clips, morphs, or bones produce debug
  diagnostics and no-ops, not thrown crashes during frame updates.
- Public type boundary: root and React entrypoints export only managed
  descriptors/facades. Public tests must reject raw Three.js handles.

## Public API Direction

Use this public shape unless implementation finds a concrete type conflict with
existing declarations.

Root types:

```ts
export type WebGLModelAnimationLoop = "once" | "repeat";

export type WebGLModelClipPlaybackDeclaration =
  | string
  | {
      readonly clip: string;
      readonly loop?: WebGLModelAnimationLoop;
      readonly timeScale?: number;
      readonly fadeInMs?: number;
      readonly fadeOutMs?: number;
      readonly clampWhenFinished?: boolean;
    };

export type WebGLModelClipScrubDeclaration = {
  readonly clip: string;
  readonly timeline: WebGLTimelineBindingDeclaration;
  readonly durationSeconds?: number;
  readonly range?: WebGLTimelineActiveRangeDeclaration;
};

export type WebGLModelClipBlendDeclaration = {
  readonly from: string;
  readonly to: string;
  readonly timeline: WebGLTimelineBindingDeclaration;
  readonly fadeMs?: number;
  readonly range?: WebGLTimelineActiveRangeDeclaration;
};

export type WebGLModelMorphWeightDeclaration = {
  readonly name: string;
  readonly weight?: number;
  readonly timeline?: WebGLTimelineBindingDeclaration;
  readonly from?: number;
  readonly to?: number;
};

export type WebGLModelAnimationDeclaration = {
  readonly defaultClip?: WebGLModelClipPlaybackDeclaration;
  readonly scrub?: WebGLModelClipScrubDeclaration;
  readonly blend?: WebGLModelClipBlendDeclaration;
  readonly morphs?: readonly WebGLModelMorphWeightDeclaration[];
};

export type WebGLModelDeclaration = {
  readonly id: string;
  readonly sceneId: string;
  readonly src: string;
  readonly loader?: WebGLModelLoaderDeclaration;
  readonly position?: WebGLTuple3;
  readonly rotation?: WebGLTuple3;
  readonly scale?: WebGLTuple3;
  readonly visible?: boolean;
  readonly timeline?: WebGLTimelineBindingDeclaration;
  readonly animation?: WebGLModelAnimationDeclaration;
};

export type WebGLRuntime = {
  registerModel(declaration: WebGLModelDeclaration): void;
  unregisterModel(id: string): void;
};
```

React:

```tsx
<WebGLScene
  id="character.stage"
  projection="perspective-stage"
  render={{ camera: "character.camera" }}
>
  <WebGLCamera
    id="character.camera"
    default
    type="perspective"
    mode="perspective-stage"
    position={[0, 120, 680]}
    target={[0, 80, 0]}
  />

  <WebGLModel
    id="character"
    src="/models/character.glb"
    position={[0, -120, 0]}
    scale={[120, 120, 120]}
    animation={{
      defaultClip: { clip: "Idle", loop: "repeat", fadeInMs: 180 },
      blend: {
        from: "Idle",
        to: "Walk",
        timeline: "character.timeline",
        fadeMs: 240,
      },
      morphs: [
        {
          name: "Smile",
          timeline: "character.timeline",
          from: 0,
          to: 1,
        },
      ],
    }}
  />
</WebGLScene>
```

Effect facade additions for DOM-backed model targets:

```ts
export type WebGLEffectAnimationScrubOptions =
  | { readonly timeSeconds: number }
  | { readonly progress: number; readonly durationSeconds: number };

export type WebGLEffectAnimationBlendOptions = {
  readonly weight: number;
  readonly loop?: WebGLModelAnimationLoop;
  readonly timeScale?: number;
};

export type WebGLEffectAnimationCrossfadeOptions = {
  readonly fadeMs?: number;
  readonly loop?: WebGLModelAnimationLoop;
  readonly timeScale?: number;
};

export type WebGLEffectAnimationFacade = {
  clips(): readonly string[];
  play(name: string, options?: WebGLEffectAnimationPlayOptions): void;
  scrub(name: string, options: WebGLEffectAnimationScrubOptions): void;
  blend(from: string, to: string, options: WebGLEffectAnimationBlendOptions): void;
  crossFade(
    from: string,
    to: string,
    options?: WebGLEffectAnimationCrossfadeOptions,
  ): void;
  stop(name: string): void;
  stopAll(): void;
  setTime(seconds: number): void;
};

export type WebGLEffectModelMorphsFacade = {
  names(): readonly string[];
  get(name: string): number | undefined;
  set(name: string, weight: number): void;
};

export type WebGLEffectModelRigFacade = {
  bones(): readonly string[];
};

export type WebGLEffectModelFacade = {
  readonly src: string;
  meshes: WebGLEffectModelMeshesFacade;
  sampling: WebGLEffectModelSamplingFacade;
  points: WebGLEffectModelPointsFacade;
  morphs?: WebGLEffectModelMorphsFacade;
  rig?: WebGLEffectModelRigFacade;
};
```

Effect example:

```ts
defineWebGLEffect({
  kind: "app.characterScroll",
  source: "model/glb",
  update(ctx, _state, params: { progressKey: string }) {
    const progress = ctx.runtime.progress.get(params.progressKey);

    ctx.object.animation?.scrub("Walk", {
      progress,
      durationSeconds: 1.4,
    });
    ctx.object.animation?.blend("Idle", "Walk", {
      weight: progress,
      loop: "repeat",
    });
    ctx.object.model?.morphs?.set("Smile", progress);
  },
});
```

## File Map

- Modify `packages/dom-webgl-runtime/src/lib/types.ts`
  - Add model declaration, animation declaration, runtime methods, and debug
    summary types.
- Modify `packages/dom-webgl-runtime/src/index.ts`
  - Export root managed model and enhanced effect facade types.
- Modify `packages/dom-webgl-runtime/src/react.ts`
  - Export `WebGLModel` and `WebGLModelProps`.
- Create `packages/dom-webgl-runtime/src/lib/react/WebGLModel.tsx`
  - React null component that inherits nearest `WebGLScene` or accepts
    `scene`, then registers/unregisters the model descriptor.
- Create `packages/dom-webgl-runtime/src/lib/renderer/managedModelRegistry.ts`
  - Scene-native model registration, loading, transform application,
    descriptor animation application, timeline activation, debug inspection,
    update, and disposal.
- Modify `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`
  - Instantiate managed model registry, add runtime register/unregister methods,
    call model registry from `syncFrame(...)`, include model debug summaries,
    and dispose it before render layers.
- Modify `packages/dom-webgl-runtime/src/lib/render/renderables/modelAnimationControls.ts`
  - Extend runtime-owned animation controller for scrub, blend, crossfade,
    diagnostics, active clip summaries, and safer missing clip handling.
- Create `packages/dom-webgl-runtime/src/lib/render/renderables/modelMorphControls.ts`
  - Controlled morph and rig metadata facade from loaded model roots.
- Modify `packages/dom-webgl-runtime/src/lib/render/renderables/modelEffectHandle.ts`
  - Attach morph/rig facades to model handles.
- Modify `packages/dom-webgl-runtime/src/lib/effects/effectObject.ts`
  - Add public effect animation/model facade types.
- Modify `packages/dom-webgl-runtime/src/lib/effects/effectObjectCapabilities.ts`
  - Map new model facades into `ctx.object`.
- Modify `packages/dom-webgl-runtime/src/lib/debug/debugState.ts`
  - Add descriptor-only managed model summaries.
- Modify tests under `packages/dom-webgl-runtime/test/`
  - Add focused tests listed below.
- Modify docs:
  - `README.md`
  - `docs/STATUS.md`
  - `docs/agent/package-onboarding.md`
  - `docs/agent/package-usage.md`
  - `docs/agent/effect-object-boundary.md`
  - `docs/examples/effect-authoring.md`
  - `docs/roadmap/managed-render-system.md`
- Optional app dogfood, only after asset decision:
  - `apps/example/src/ManagedModelAnimationExample.tsx`
  - `apps/example/src/App.tsx`
  - `apps/example/src/styles.css`
  - an app-local public GLB asset with known clips/morphs and clear provenance.

## Implementation Steps

### Task 1: Lock Public Type Boundaries First

**Files:**
- Modify: `packages/dom-webgl-runtime/test/publicExports.test.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/types.ts`
- Modify: `packages/dom-webgl-runtime/src/index.ts`
- Modify: `packages/dom-webgl-runtime/src/react.ts`

- [ ] Add failing public export tests that prove `WebGLModelDeclaration`,
  `WebGLModelAnimationDeclaration`, enhanced `WebGLEffectAnimationFacade`,
  `WebGLEffectModelMorphsFacade`, and React `WebGLModel` are public.
- [ ] Add `@ts-expect-error` assertions that reject raw
  `AnimationMixer`, `AnimationAction`, `Bone`, `Skeleton`, `Object3D`, loader
  callbacks, and a raw `morphTargetInfluences` array in public declarations.
- [ ] Add minimal type declarations and exports to satisfy only the public
  type tests.
- [ ] Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/publicExports.test.ts
```

Expected after implementation: pass.

### Task 2: Expand Runtime-Owned Animation Controls

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/modelAnimationControls.ts`
- Test: `packages/dom-webgl-runtime/test/lib/render/renderables/modelAnimationControls.test.ts`
- Modify existing test if needed:
  `packages/dom-webgl-runtime/test/lib/render/renderables/modelRenderable.test.ts`

- [ ] Create a direct unit test for missing clip diagnostics:
  `play("Missing")`, `scrub("Missing", ...)`, `blend("Idle", "Missing", ...)`,
  and `crossFade("Missing", "Walk", ...)` must no-op and record controlled
  diagnostics without throwing.
- [ ] Test `scrub(name, { timeSeconds })` calls mixer/action state through a
  controlled internal adapter and clamps negative time to `0`.
- [ ] Test `scrub(name, { progress, durationSeconds })` clamps progress to
  `0..1` and sets clip time to `progress * durationSeconds`.
- [ ] Test `blend(from, to, { weight })` clamps weight to `0..1`, keeps both
  actions runtime-owned, and updates effective action weights without exposing
  actions.
- [ ] Test `crossFade(from, to, { fadeMs })` uses internal action methods such
  as `crossFadeTo` when available and falls back to managed weights when not.
- [ ] Test `dispose()` stops actions, clears internal maps, and uncaches the
  root once.
- [ ] Keep current `clips`, `play`, `stop`, `stopAll`, and `setTime`
  behavior compatible.
- [ ] Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/render/renderables/modelAnimationControls.test.ts packages/dom-webgl-runtime/test/lib/render/renderables/modelRenderable.test.ts
```

Expected after implementation: pass.

### Task 3: Add Morph And Rig Metadata Facades

**Files:**
- Create: `packages/dom-webgl-runtime/src/lib/render/renderables/modelMorphControls.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/modelEffectHandle.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/effects/effectObject.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/effects/effectObjectCapabilities.ts`
- Test: `packages/dom-webgl-runtime/test/lib/render/renderables/modelMorphControls.test.ts`
- Modify: `packages/dom-webgl-runtime/test/lib/render/renderables/modelEffectHandle.test.ts`
- Modify: `packages/dom-webgl-runtime/test/lib/effects/effectObjectCapabilities.test.ts`

- [ ] Build a controlled morph facade that traverses loaded model internals
  privately and returns stable public morph names.
- [ ] Support `morphs.get(name)` and `morphs.set(name, weight)` with `weight`
  clamped to `0..1`.
- [ ] When a morph name is absent, return `undefined` for `get`, no-op for
  `set`, and record a controlled diagnostic for debug inspection.
- [ ] Build a rig metadata facade that lists bone names only.
- [ ] Do not expose raw mesh traversal, bone objects, skeletons, morph
  dictionaries, or morph influence arrays.
- [ ] Attach `model.morphs` only when at least one morph exists; attach
  `model.rig` only when named bones exist.
- [ ] Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/render/renderables/modelMorphControls.test.ts packages/dom-webgl-runtime/test/lib/render/renderables/modelEffectHandle.test.ts packages/dom-webgl-runtime/test/lib/effects/effectObjectCapabilities.test.ts
```

Expected after implementation: pass.

### Task 4: Add Scene-Native Managed Model Registry

**Files:**
- Create: `packages/dom-webgl-runtime/src/lib/renderer/managedModelRegistry.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/types.ts`
- Test: `packages/dom-webgl-runtime/test/lib/renderer/managedModelRegistry.test.ts`
- Modify: `packages/dom-webgl-runtime/test/lib/renderer/runtimePipeline.test.ts`

- [ ] Implement `registerModel(declaration)` and `unregisterModel(id)` on
  `WebGLRuntime`.
- [ ] Use scene ownership rules that match stage primitives:
  duplicate ids replace/update the existing model entry, unregister is
  idempotent, and scene unregister releases models in that scene.
- [ ] Load GLB through existing `loadGLBModel(...)` and `ResourceManager`,
  honoring runtime `modelLoader` and per-model `loader`.
- [ ] Attach the loaded model root to the target scene adapter selected by
  `sceneId`; do not create a DOM anchor or fallback controller.
- [ ] Apply descriptor `position`, `rotation`, `scale`, and `visible` directly
  in scene-local coordinates. Defaults: position `[0, 0, 0]`, rotation
  `[0, 0, 0]`, scale `[1, 1, 1]`, visible `true`.
- [ ] Timeline active range should hide/skip model updates without overriding
  explicit `visible: false`.
- [ ] `update(frameInput, progressSignals)` returns whether the runtime should
  keep continuous rendering for active model animation.
- [ ] All lifecycle methods follow the repo disposed-guard pattern and double
  dispose must be safe.
- [ ] Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/renderer/managedModelRegistry.test.ts packages/dom-webgl-runtime/test/lib/renderer/runtimePipeline.test.ts
```

Expected after implementation: pass.

### Task 5: Add React `WebGLModel`

**Files:**
- Create: `packages/dom-webgl-runtime/src/lib/react/WebGLModel.tsx`
- Modify: `packages/dom-webgl-runtime/src/react.ts`
- Test: `packages/dom-webgl-runtime/test/lib/react/WebGLModel.test.tsx`

- [ ] Implement `WebGLModel` as a null component that reads
  `WebGLSceneContext` and `useWebGLRuntime()`.
- [ ] Props should be `Omit<WebGLModelDeclaration, "sceneId"> & { scene?: string }`.
- [ ] Throw a controlled error when neither `scene` nor parent `WebGLScene`
  provides a scene id.
- [ ] Register on mount/update and unregister by `id` on cleanup.
- [ ] Include `id`, `sceneId`, `src`, `loader`, transform props, `visible`,
  `timeline`, and `animation` in the effect dependency list.
- [ ] Add React tests for inherited scene, explicit scene prop, unregister on
  unmount, and missing scene diagnostic.
- [ ] Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/react/WebGLModel.test.tsx
```

Expected after implementation: pass.

### Task 6: Apply Declarative Animation, Blend, Scrub, And Morph Descriptors

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/managedModelRegistry.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/modelAnimationControls.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/modelMorphControls.ts`
- Test: `packages/dom-webgl-runtime/test/lib/renderer/managedModelRegistry.test.ts`

- [ ] Apply `animation.defaultClip` once when the model becomes ready or when
  the descriptor changes to a different clip.
- [ ] Apply `animation.scrub` on every frame using normalized progress from
  `WebGLProgressSignalSource`.
- [ ] Apply `animation.blend` on every frame by computing a clamped weight from
  the declared timeline and optional range.
- [ ] Apply `animation.morphs` on every frame; static `weight` applies directly,
  timeline `from`/`to` interpolates by normalized progress.
- [ ] Missing clips or morphs must record diagnostics and no-op without
  throwing during frame updates.
- [ ] Do not recreate actions or reload resources on every frame.
- [ ] Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/renderer/managedModelRegistry.test.ts
```

Expected after implementation: pass.

### Task 7: Add Debug Summaries And Diagnostics

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/types.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/debug/debugState.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/managedModelRegistry.ts`
- Test: `packages/dom-webgl-runtime/test/lib/debug/debugState.test.ts`
- Modify: `packages/dom-webgl-runtime/test/lib/renderer/runtimePipeline.test.ts`

- [ ] Add `WebGLDebugModelSummary` with descriptor-only fields:
  `id`, `sceneId`, `src`, `resourceStatus`, `visible`, optional `timeline`,
  `clips`, `activeClips`, `morphs`, `bones`, and `diagnostics`.
- [ ] Add `modelCount` and `models` to `WebGLDebugState` only when managed
  models exist.
- [ ] Make diagnostics simple serializable records:

```ts
export type WebGLDebugModelDiagnostic = {
  readonly modelId: string;
  readonly kind: "missing-clip" | "missing-morph" | "missing-bone";
  readonly name: string;
};
```

- [ ] Tests must prove debug state does not expose raw model roots, raw
  actions, raw mixers, raw bones, raw skeletons, or raw morph arrays.
- [ ] Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/debug/debugState.test.ts packages/dom-webgl-runtime/test/lib/renderer/runtimePipeline.test.ts
```

Expected after implementation: pass.

### Task 8: Preserve DOM-Backed Model Effects

**Files:**
- Modify: `packages/dom-webgl-runtime/test/lib/effects/effectAuthoring.test.ts`
- Modify: `packages/dom-webgl-runtime/test/lib/effects/effectController.test.ts`
- Modify: `packages/dom-webgl-runtime/test/lib/render/renderables/modelRenderable.test.ts`

- [ ] Add tests proving existing `ctx.object.animation?.play("Idle")`,
  `setTime(...)`, `stop(...)`, and model mesh/material effects still work for
  `WebGLTarget` model sources.
- [ ] Add effect tests for the new `scrub`, `blend`, and morph facade from a
  DOM-backed model target.
- [ ] Confirm `model/glb` renderables still fit to DOM rects unless an effect
  intentionally writes `ctx.object.position` or `ctx.object.scale`.
- [ ] Confirm offscreen/parked target behavior still pauses model animation
  updates.
- [ ] Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/effects/effectAuthoring.test.ts packages/dom-webgl-runtime/test/lib/effects/effectController.test.ts packages/dom-webgl-runtime/test/lib/render/renderables/modelRenderable.test.ts
```

Expected after implementation: pass.

### Task 9: Example And Browser Dogfood

**Files:**
- Create/modify: `apps/example/src/ManagedModelAnimationExample.tsx`
- Modify: `apps/example/src/App.tsx`
- Modify: `apps/example/src/example.css`
- Modify docs even if app dogfood is deferred:
  `docs/examples/effect-authoring.md`

- [ ] Before adding a visual example, confirm an asset route:
  - confirmed route A: use `apps/example/public/models/Sprint.glb` for clip and
    skin animation dogfood;
  - morph behavior still uses synthetic loaded-model test fixtures unless a
    later app-local morph asset is explicitly approved.
- [ ] If route A is approved, create a dedicated Phase 7 example section that
  uses `WebGLScene`, `WebGLCamera`, `WebGLPassViewport`, `WebGLLight`, and
  `WebGLModel`. Do not mix this dogfood into the pinned managed timeline,
  camera-controller, or stage primitive examples.
- [ ] Use a stable known clip from `Sprint.glb` for the first example. Prefer a
  clear top-level clip such as `MainSkeleton.001` for default playback if visual
  inspection confirms it drives the intended character/object motion.
- [ ] Do not create a morph UI around `Sprint.glb`; it has no morph targets.
- [ ] Keep visible copy in Chinese, keep API ids and effect kinds in English.
- [ ] Use public imports only:

```tsx
import {
  WebGLCamera,
  WebGLLight,
  WebGLModel,
  WebGLPassViewport,
  WebGLScene,
  WebGLStagePlane,
} from "@project/dom-webgl-runtime/react";
```

- [ ] Do not import package internals or example effects into package source.
- [ ] Browser smoke only if route A is implemented:

```bash
npm run dev -w @project/dom-webgl-example
```

Manual check: model appears in the clipped managed pass, default clip plays,
timeline scrub/blend visibly changes animation, and morph control visibly
changes the model if the chosen asset has morph data.

### Task 10: Documentation And Roadmap Closeout

**Files:**
- Modify: `README.md`
- Modify: `docs/STATUS.md`
- Modify: `docs/agent/package-onboarding.md`
- Modify: `docs/agent/package-usage.md`
- Modify: `docs/agent/effect-object-boundary.md`
- Modify: `docs/examples/effect-authoring.md`
- Modify: `docs/roadmap/managed-render-system.md`

- [ ] Document `WebGLModel` as Level 3 scene-native and opt-in.
- [ ] Document that DOM-following models stay as `WebGLTarget` with
  `source: { kind: "model", type: "glb" }`.
- [ ] Document `ctx.object.animation.scrub`, `blend`, `crossFade`, and
  `ctx.object.model.morphs`.
- [ ] Document asset requirements:
  clips require GLB animations with stable names; morphs require morph target
  attributes and stable names; bones require named bones.
- [ ] Document missing clip/morph/bone diagnostics and no-op behavior.
- [ ] Update `docs/STATUS.md` only with implemented truth after code is
  complete. During implementation, use `[in-progress]`; after code but before
  full verification/docs/commit, use `[implemented]`; only use `[verified]`
  after tests, docs, and commit are closed.
- [ ] Run docs/link sanity:

```bash
git diff --check
```

Expected after implementation: no whitespace errors.

## Testing Strategy

Run focused tests as each task lands, then full verification before marking the
phase beyond `[implemented]`:

```bash
npm test -- --run packages/dom-webgl-runtime/test/publicExports.test.ts
npm test -- --run packages/dom-webgl-runtime/test/lib/render/renderables/modelAnimationControls.test.ts packages/dom-webgl-runtime/test/lib/render/renderables/modelMorphControls.test.ts
npm test -- --run packages/dom-webgl-runtime/test/lib/renderer/managedModelRegistry.test.ts packages/dom-webgl-runtime/test/lib/renderer/runtimePipeline.test.ts
npm test -- --run packages/dom-webgl-runtime/test/lib/react/WebGLModel.test.tsx
npm test -- --run packages/dom-webgl-runtime/test/lib/debug/debugState.test.ts
npm run typecheck
npm run build
npm run check:imports
git diff --check
```

Browser smoke is required for the `Sprint.glb` clip/skin animation example.
Morph visual QA remains out of scope unless a morph asset is added later.

## Documentation Updates

- `README.md`: capability matrix and managed render roadmap summary.
- `docs/STATUS.md`: current implemented public surface, caveats, and Phase 7
  status after implementation.
- `docs/agent/package-onboarding.md`: first-decision guidance for DOM-backed
  model target versus scene-native `WebGLModel`.
- `docs/agent/package-usage.md`: full API contract, examples, asset
  requirements, and common failures.
- `docs/agent/effect-object-boundary.md`: effect facade additions under
  `ctx.object.animation` and `ctx.object.model.morphs`.
- `docs/examples/effect-authoring.md`: downstream React examples.
- `docs/roadmap/managed-render-system.md`: phase state transitions:
  `[planned]` now, then `[in-progress]`, `[implemented]`, and `[verified]` only
  when the roadmap rules are satisfied.
- Deferred design notes to record in implementation docs:
  additive animation layers, bone attachments, IK, action graphs, animation
  state machines, and scene-native `WebGLModel` effects are future topics, not
  Phase 7 v1 behavior.

## Exit Criteria

Phase 7 can move to `[verified]` only after all are true:

- `WebGLTarget` Level 1 model usage remains unchanged.
- `WebGLModel` exists as an opt-in scene-native descriptor with React and
  vanilla runtime parity.
- A complete animated GLB can declare and play a default clip without custom
  effect code through `WebGLModel`.
- An effect on a DOM-backed model target can scrub a named clip from a runtime
  progress signal through `ctx.object.animation`.
- Two clips can be blended/crossfaded through managed options without raw
  `AnimationAction` access.
- A named morph target can be driven by effect code or a descriptor timeline
  without raw morph arrays.
- Debug state can report available clips, active clips, morph names, and
  controlled missing-name diagnostics for managed models.
- Public type tests reject raw Three.js mixer/action/bone/skeleton/morph/loader
  escapes.
- README, STATUS, package onboarding/usage, effect boundary, examples docs, and
  roadmap all describe the current implemented truth.
- Verification commands pass:

```bash
npm test -- --run
npm run typecheck
npm run build
npm run check:imports
git diff --check
```

- A commit closes the implementation before roadmap status becomes
  `[verified]`.

## Risks And Decisions

- `Sprint.glb` is available for clip/skin animation dogfood, but it has no
  morph targets. Morph capability must be proven through synthetic fixtures or
  a later approved morph asset.
- `WebGLModel` can confuse the DOM-first boundary. Docs and examples must keep
  `WebGLTarget` first and say `WebGLModel` is Level 3 scene-native.
- Per-frame descriptor animation can accidentally cause React churn. Runtime
  progress signals and registry state must drive high-frequency updates.
- Crossfade behavior can become an animation graph. V1 should support one
  simple `blend`/`crossFade` surface, not arbitrary layers or priorities.
- Morph names are asset-authored and often inconsistent. Missing names must
  produce controlled diagnostics and no-op behavior.
- Additive layers, bone attachments, IK, action graphs, and animation state
  machines are explicitly deferred. Listing bone names for diagnostics is
  acceptable; exposing attachment objects or raw bones is not.
- Scene-native `WebGLModel` effects are explicitly deferred from v1. The later
  design should compare options such as a scene-object effect scope, a model
  controller descriptor, or a constrained facade under `WebGLModel`, instead of
  copying DOM-target `effects` onto scene-native models without a scope model.
  Recommended roadmap placement: Phase 8 pre-step, before picking/hit state is
  exposed, because both features need scene-native object identity and explicit
  object/scene/runtime scope.
- Managed model resource loading must obey existing `ResourceManager`
  concurrency and disposal rules; do not introduce a second loader path.

## Confirmed User Decisions

- Use `apps/example/public/models/Sprint.glb` for Phase 7 visual clip/skin
  animation dogfood.
- Keep Phase 7 v1 limited to default clip, scrub, blend/crossfade, morph
  facade/descriptors, and diagnostics.
- Do not implement additive layers, bone attachments, IK, action graphs, or
  animation state machines in Phase 7 v1; document them as deferred future
  capability areas.
- Do not add target-local `effects` support to scene-native `WebGLModel` in
  Phase 7 v1. Record it as a future design topic that needs a better explicit
  implementation model. The recommended roadmap owner is Phase 8 as a pre-step
  before picking and hit-state APIs.
