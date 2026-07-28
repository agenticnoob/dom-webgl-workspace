# Phase 8 Interaction And Picking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the first runtime-owned managed interaction layer for scene-native objects: explicit scene-object effects, `screen-plane` placement, object hit state, pointer capture, and minimal empty-space camera drag without exposing raw Three.js input or raycast objects.

**Architecture:** Keep Level 1 DOM-backed `WebGLTarget` unchanged and make all Phase 8 behavior opt-in on managed scenes, scene-native objects, and managed cameras. Scene-native `WebGLModel` and stage primitive effects use a separate scene-object effect context so they can read object hit state without inheriting DOM layout, fallback lifecycle, or `ctx.targetPointer`. Runtime input routing owns pointer capture, pass/camera selection, ray-to-scene math, hit priority, and debug state; consumers only see managed descriptors and controlled facades.

**Tech Stack:** TypeScript, React descriptor components, Three.js behind runtime-owned adapters, existing `WebGLRuntime` effect registry, managed scene/camera/pass registries, Vitest/jsdom with dependency injection, `apps/example` browser dogfood, npm workspaces.

---

## Context Verified For This Plan

- The `Roadmap Status` table selects Phase 8 as the first `[not-started]` phase, and no Phase 8 focused plan existed before this file.
- `docs/STATUS.md` and git history show Phase 7D is verified at commit `ab8b2ec8 perf: defer prepared model loading by viewport proximity`.
- `WebGLModel` is implemented as a scene-native descriptor with `id`, `sceneId`, `src`, transform, timeline, animation, and prepare fields, but no public `effects` or interaction fields.
- `packages/dom-webgl-runtime/test/publicExports.test.ts` currently rejects `WebGLModel.effects` with `@ts-expect-error`; Phase 8 must replace that guard with a scene-object-scoped contract, not a copied DOM-target effect contract.
- `ctx.pointer` is runtime/canvas pointer state and `ctx.targetPointer` is DOM target layout-local state. Current target pointer behavior does not perform inverse-transformed picking for rotated groups, models, stage objects, or custom meshes.
- `ctx.scene` exists as descriptor metadata and timeline state only. There is no public `ctx.camera` and no raw scene/camera/object access.
- Current source contains no public `pickable`, `collider`, raw `raycaster`, or intersection API. These remain future/deferred wording in docs and README.
- `screen-plane` is explicitly deferred to the Phase 8 pre-step and must use named runtime-owned stage planes rather than raw plane/camera/raycaster handles.

## Scope

Implement Phase 8 v1 as a focused managed interaction foundation:

- Add explicit scene-native object effect support for `WebGLModel`, `WebGLStagePlane`, and `WebGLStageBox`.
- Keep existing DOM target effects unchanged and continue to use `defineWebGLEffect(...)` for DOM-backed targets.
- Add a new `defineWebGLSceneObjectEffect(...)` helper and a scene-object effect definition type that reads `ctx.object`, `ctx.scene`, `ctx.runtime`, `ctx.pointer`, and `ctx.objectPointer`, but does not expose `layout`, `targetPointer`, DOM fallback, target lifecycle, or raw Three.js objects.
- Add optional `effects` and `interaction` descriptors to scene-native models and stage primitives. The `effects` prop is scene-object-scoped only.
- Add `screen-plane` placement for DOM-backed `WebGLTarget` objects in a `perspective-stage` scene by projecting the target DOM rect through the active managed camera onto a named `WebGLStagePlane`.
- Add runtime-owned object hit routing for opt-in pickable stage primitives and scene-native models.
- Add object pointer state with hover, press, click, drag, hit point, pointer capture, and release semantics.
- Add minimal managed camera empty-space drag by extending the existing single `WebGLCamera.controller` descriptor with pointer input. Timeline camera controllers remain supported.
- Keep camera interaction to empty-space orbit drag only: pointer down + drag changes yaw/pitch, pointer up stops the controller, and object hit/capture always wins over camera drag.
- Add descriptor-only debug state for active hit, hovered object, pressed object, captured object, and camera interaction state.
- Dogfood in `apps/example` with a small managed interaction section that proves object hover/click, model hover/drag, and empty-space camera drag priority.

## Non-Goals

- Do not change Level 1 `WebGLTarget` setup, defaults, fallback visibility, or DOM pointer semantics.
- Do not make `WebGLScene`, `WebGLCamera`, `WebGLRenderPass`, or `WebGLPassViewport` required for ordinary DOM-first effects.
- Do not add raw `THREE.Raycaster`, intersection objects, cameras, controls, meshes, materials, textures, render targets, composer passes, loaders, mixers, or render-loop handles to public API.
- Do not add physics, inertia, collision response, constraints, forces, impulses, or a physics adapter.
- Do not promise inverse-transformed picking for all `transformScope: "subtree"` cases.
- Do not add mesh-level material picking, bone picking, skinned mesh per-triangle hit details, or custom collider geometry in v1.
- Do not copy `ctx.targetPointer`, DOM layout, DOM fallback, or target lifecycle onto `WebGLModel`.
- Do not add arbitrary event callbacks as the primary interaction model. Effects and descriptors should remain the main public contract.
- Do not add raw orbit/trackball control instances or consumer-owned camera mutation loops.
- Do not add pan, dolly, wheel zoom, pinch zoom, pointer parallax, damping, or inertial camera controls in Phase 8 v1. These belong to Phase 8B after the v1 router and object-vs-camera priority are stable.

## Public API Direction

### Scene-Object Effects

Keep DOM target effects as they are:

```ts
const targetEffect = defineWebGLEffect({
  kind: "app.targetEffect",
  update(ctx) {
    ctx.targetPointer.isInside;
    ctx.object.opacity = 1;
  },
});
```

Add a separate scene-object effect definition helper:

```ts
const modelHoverEffect = defineWebGLSceneObjectEffect({
  kind: "app.modelHover",
  source: "model/glb",
  update(ctx) {
    ctx.objectPointer.isHovered;
    ctx.object.rotation.y += ctx.objectPointer.dragDeltaX * 0.004;
  },
});
```

Scene-object effect context shape:

```ts
export type WebGLSceneObjectEffectSourceKind =
  | "model/glb"
  | "stage/plane"
  | "stage/box";

export type WebGLSceneObjectPointerState = {
  readonly isHovered: boolean;
  readonly isPressed: boolean;
  readonly isDragging: boolean;
  readonly wasClicked: boolean;
  readonly pointerId?: number;
  readonly dragStartX: number;
  readonly dragStartY: number;
  readonly dragDeltaX: number;
  readonly dragDeltaY: number;
  readonly hit?: {
    readonly point: WebGLTuple3;
    readonly normal?: WebGLTuple3;
    readonly distance: number;
  };
};

export type WebGLSceneObjectEffectContext = {
  readonly objectId: string;
  readonly sourceKind: WebGLSceneObjectEffectSourceKind;
  readonly input: WebGLFrameInput;
  readonly pointer: WebGLFrameInput["pointer"];
  readonly objectPointer: WebGLSceneObjectPointerState;
  readonly progress: WebGLProgressSignalSource;
  readonly runtime: WebGLEffectRuntimeScope;
  readonly scene: WebGLEffectSceneScope;
  readonly time: number;
  readonly delta: number;
  readonly object: WebGLEffectObjectHandle;
  readonly resources: WebGLEffectResourceScope;
};
```

Runtime effects remain registered once at runtime level:

```tsx
const runtimeEffects = [targetEffect, modelHoverEffect] as const;

<WebGLRuntime effects={runtimeEffects}>
  <WebGLScene id="world" projection="perspective-stage" render={{ camera: "world.camera" }}>
    <WebGLCamera id="world.camera" default type="perspective" mode="perspective-stage" />
    <WebGLModel
      id="runner"
      src="/models/Sprint.glb"
      interaction={{
        pickable: {
          hitTest: "bounds",
          pointer: { hover: true, press: true, click: true, drag: true },
        },
      }}
      effects={[{ kind: "app.modelHover" }]}
    />
  </WebGLScene>
</WebGLRuntime>
```

Validation rule:

- DOM target declarations can use only `defineWebGLEffect(...)` definitions.
- Scene-native object declarations can use only `defineWebGLSceneObjectEffect(...)` definitions.
- If the effect kind exists but has the wrong scope, registration fails with a scoped error such as `Effect "app.modelHover" is not a scene-object effect`.

### Interaction Descriptors

Add the same interaction shape to `WebGLModel`, `WebGLStagePlane`, and `WebGLStageBox`:

```ts
export type WebGLObjectPointerDeclaration = {
  readonly hover?: boolean;
  readonly press?: boolean;
  readonly click?: boolean;
  readonly drag?: boolean;
};

export type WebGLPickableDeclaration =
  | boolean
  | {
      readonly hitTest?: "bounds";
      readonly pointer?: WebGLObjectPointerDeclaration;
    };

export type WebGLSceneObjectInteractionDeclaration = {
  readonly pickable?: WebGLPickableDeclaration;
};
```

Defaults:

- `interaction` omitted: the object is not pickable and creates no hit-test candidate.
- `pickable: true`: equivalent to `{ hitTest: "bounds", pointer: { hover: true } }`.
- `pointer.drag: true`: object press captures the pointer until release.
- Hit testing is object-level bounds in v1. Mesh-level managed hits and colliders remain later work.

### `screen-plane` Placement

Extend placement descriptors without changing the Level 1 default:

```ts
export type WebGLScreenPlanePlacementDeclaration = {
  readonly mode: "screen-plane";
  readonly planeId: string;
  readonly offset?: WebGLTuple3;
  readonly scale?: number | WebGLTuple2;
};
```

Rules:

- Valid only for targets routed to a `perspective-stage` scene with a managed camera.
- `planeId` must refer to a registered `WebGLStagePlane` in the same scene.
- Runtime computes ray-to-plane internally from the target DOM rect center and active managed camera.
- Public API never exposes raw rays, cameras, intersections, planes, or meshes.
- If the named plane/camera is missing, the target remains hidden/skipped and debug state reports a descriptor-only placement diagnostic.

### Camera Empty-Space Drag

Extend the existing single camera controller descriptor with pointer input:

```ts
export type WebGLCameraPointerControllerDeclaration = {
  readonly kind: "orbit";
  readonly activation: "empty-space-drag";
  readonly target?: WebGLTuple3;
  readonly sensitivity?: WebGLTuple2;
  readonly minPolarAngle?: number;
  readonly maxPolarAngle?: number;
};

export type WebGLCameraControllerDeclaration = {
  readonly timeline?: WebGLCameraControllerTimelineDeclaration | string;
  readonly from?: WebGLCameraControllerFrameDeclaration;
  readonly to?: WebGLCameraControllerFrameDeclaration;
  readonly easing?: WebGLCameraControllerEasing;
  readonly pointer?: WebGLCameraPointerControllerDeclaration;
};
```

Rules:

- Timeline controller state applies first; pointer controller state layers a camera-frame offset after it.
- Empty-space drag activates only when no object has hover/press/drag priority.
- Object drag capture wins over camera drag.
- Pointer up stops the camera gesture. No damping, inertia, pan, dolly, wheel, or pinch behavior ships in Phase 8 v1.
- This is a kinematic controller, not physics.

## File Structure

- Modify `packages/dom-webgl-runtime/src/lib/types.ts`
  - Add interaction descriptors, `screen-plane` placement, scene-object effect public types, object pointer debug summaries, and camera pointer controller types.
- Modify `packages/dom-webgl-runtime/src/lib/effects/effectAuthoring.ts`
  - Add `defineWebGLSceneObjectEffect(...)`, `WebGLSceneObjectEffectDefinition`, and `WebGLSceneObjectEffectContext`.
- Modify `packages/dom-webgl-runtime/src/lib/effects/effectRegistry.ts`
  - Store target effect definitions and scene-object effect definitions under the same runtime registry with explicit scope checks.
- Create `packages/dom-webgl-runtime/src/lib/effects/sceneObjectEffectContext.ts`
  - Builds scene-object effect contexts without DOM `layout` or `targetPointer`.
- Create `packages/dom-webgl-runtime/src/lib/effects/sceneObjectEffectController.ts`
  - Runs scene-object effects using existing schedule/resource patterns.
- Modify `packages/dom-webgl-runtime/src/lib/react/WebGLModel.tsx`
  - Accept and register `effects` plus `interaction`.
- Modify `packages/dom-webgl-runtime/src/lib/react/WebGLStagePlane.tsx`
  - Accept and register `effects` plus `interaction`.
- Modify `packages/dom-webgl-runtime/src/lib/react/WebGLStageBox.tsx`
  - Accept and register `effects` plus `interaction`.
- Modify `packages/dom-webgl-runtime/src/lib/react/WebGLCamera.tsx`
  - Pass through `controller.pointer`.
- Modify `packages/dom-webgl-runtime/src/index.ts` and `packages/dom-webgl-runtime/src/react.ts`
  - Export the new public types and helper.
- Create `packages/dom-webgl-runtime/src/lib/renderer/screenPlanePlacement.ts`
  - Resolves DOM rect center to a named managed stage plane through runtime-owned camera math.
- Create `packages/dom-webgl-runtime/src/lib/renderer/interactionRouter.ts`
  - Owns hit candidate collection, pass/camera priority, hover/press/click/drag/capture state, and descriptor-only debug summaries.
- Modify `packages/dom-webgl-runtime/src/lib/renderer/threeRenderer.ts`
  - Add an internal hit-test adapter that accepts managed candidates and returns managed hit summaries.
- Modify `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`
  - Wire pointer input, render-layer facts, scene adapters, model/stage registries, effect controllers, and debug output into the interaction router.
- Modify `packages/dom-webgl-runtime/src/lib/renderer/managedModelRegistry.ts`
  - Store normalized `effects` and `interaction`; expose model scene-object effect target handles to the router/controller.
- Modify `packages/dom-webgl-runtime/src/lib/renderer/stageObjectRegistry.ts`
  - Store normalized `effects` and `interaction`; expose stage object effect target handles to the router/controller.
- Modify `packages/dom-webgl-runtime/src/lib/renderer/projectionPolicies.ts`
  - Route `screen-plane` placement through `screenPlanePlacement.ts`.
- Add tests under `packages/dom-webgl-runtime/test/lib/effects/`
  - `sceneObjectEffectController.test.ts`
  - `sceneObjectEffectContext.test.ts`
- Add tests under `packages/dom-webgl-runtime/test/lib/renderer/`
  - `screenPlanePlacement.test.ts`
  - `interactionRouter.test.ts`
  - updates to `managedModelRegistry.test.ts`, `stageObjectRegistry.test.ts`, and `runtimePipeline.test.ts`
- Modify `packages/dom-webgl-runtime/test/publicExports.test.ts`
  - Replace the Phase 7 `WebGLModel.effects` rejection with Phase 8 scene-object scope acceptance and wrong-scope rejection.
- Modify `packages/dom-webgl-runtime/test/lib/debug/debugState.test.ts`
  - Cover descriptor-only interaction summaries.
- Modify `apps/example/src/ManagedModelAnimationExample.tsx` or create `apps/example/src/ManagedInteractionExample.tsx`
  - Dogfood model/stage hover, click, drag capture, and empty-space camera drag.
- Modify `README.md`, `docs/STATUS.md`, `docs/agent/package-onboarding.md`, `docs/agent/package-usage.md`, `docs/examples/effect-authoring.md`, and `docs/roadmap/managed-render-system.md`
  - Document the new Phase 8 contract, caveats, and status.

## Tasks

### Task 1: Lock The Public Type Contract

**Files:**
- Modify: `packages/dom-webgl-runtime/test/publicExports.test.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/types.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/effects/effectAuthoring.ts`
- Modify: `packages/dom-webgl-runtime/src/index.ts`

- [x] **Step 1: Write failing public export tests**

Add tests that prove scene-native object effects are accepted only through the new scene-object helper:

```ts
const sceneObjectEffect = defineWebGLSceneObjectEffect({
  kind: "app.modelHover",
  source: "model/glb",
  update(ctx) {
    ctx.objectId satisfies string;
    ctx.objectPointer.isHovered satisfies boolean;
    ctx.scene.id satisfies string;
    ctx.runtime.progress.get("hero") satisfies number;
    ctx.object.rotation.y = 0;

    // @ts-expect-error scene-object effects do not expose DOM target layout.
    ctx.layout;
    // @ts-expect-error scene-object effects do not expose DOM target pointer state.
    ctx.targetPointer;
  },
});
sceneObjectEffect satisfies WebGLSceneObjectEffectDefinition;

const modelProps = {
  id: "character",
  src: "/models/Sprint.glb",
  interaction: {
    pickable: {
      hitTest: "bounds",
      pointer: { hover: true, press: true, click: true, drag: true },
    },
  },
  effects: [{ kind: "app.modelHover" }],
} satisfies WebGLModelProps;
modelProps satisfies WebGLModelProps;
```

Add guards that raw objects still fail:

```ts
// @ts-expect-error pickable does not accept raw Three raycaster options.
const rawRaycastModel = { id: "raw", src: "/m.glb", interaction: { raycaster: {} } } satisfies WebGLModelProps;

// @ts-expect-error scene-object effects do not expose raw intersections.
const rawIntersectionEffect = defineWebGLSceneObjectEffect({
  kind: "app.rawIntersection",
  update(ctx) {
    ctx.objectPointer.intersection.object;
  },
});
```

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/publicExports.test.ts
```

Expected: fails because the new helper, types, and props do not exist yet.

- [x] **Step 2: Add minimal public types and exports**

Implement the public type shapes from the API section in `types.ts` and `effectAuthoring.ts`. Export `defineWebGLSceneObjectEffect`, `WebGLSceneObjectEffectDefinition`, `WebGLSceneObjectEffectContext`, `WebGLSceneObjectPointerState`, `WebGLSceneObjectInteractionDeclaration`, and `WebGLScreenPlanePlacementDeclaration` from `src/index.ts`.

- [x] **Step 3: Re-run public export tests**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/publicExports.test.ts
```

Expected: passes for type exposure and continues to reject raw Three.js handles.

### Task 2: Thread React And Vanilla Descriptors

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/react/WebGLModel.tsx`
- Modify: `packages/dom-webgl-runtime/src/lib/react/WebGLStagePlane.tsx`
- Modify: `packages/dom-webgl-runtime/src/lib/react/WebGLStageBox.tsx`
- Modify: `packages/dom-webgl-runtime/src/lib/react/WebGLCamera.tsx`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/managedModelRegistry.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/stageObjectRegistry.ts`
- Modify: `packages/dom-webgl-runtime/test/lib/renderer/managedModelRegistry.test.ts`
- Modify: `packages/dom-webgl-runtime/test/lib/renderer/stageObjectRegistry.test.ts`

- [x] **Step 1: Write descriptor normalization tests**

Cover:

- `WebGLModel.effects` and `WebGLModel.interaction` are preserved in normalized model entries.
- `WebGLStagePlane.effects` and `WebGLStagePlane.interaction` are preserved in normalized stage primitive entries.
- `pickable: true` normalizes to bounds hover.
- `pointer.drag: true` is stored explicitly.
- `WebGLCamera.controller.pointer` is preserved without removing timeline controller support.

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/renderer/managedModelRegistry.test.ts packages/dom-webgl-runtime/test/lib/renderer/stageObjectRegistry.test.ts
```

Expected: fails until registries normalize the new descriptors.

- [x] **Step 2: Thread props into runtime registrations**

Pass `effects` and `interaction` through React descriptor components. Preserve the existing `useEffect` registration pattern and stable descriptor guidance.

- [x] **Step 3: Normalize descriptors in registries**

Add small normalization helpers in the owning registry files. Keep the helpers local unless both registries genuinely need the same code.

- [x] **Step 4: Re-run focused descriptor tests**

Run the same test command. Expected: passes.

### Task 3: Add Scene-Object Effect Runtime

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/effects/effectRegistry.ts`
- Create: `packages/dom-webgl-runtime/src/lib/effects/sceneObjectEffectContext.ts`
- Create: `packages/dom-webgl-runtime/src/lib/effects/sceneObjectEffectController.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/managedModelRegistry.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/stageObjectRegistry.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`
- Add: `packages/dom-webgl-runtime/test/lib/effects/sceneObjectEffectContext.test.ts`
- Add: `packages/dom-webgl-runtime/test/lib/effects/sceneObjectEffectController.test.ts`

- [x] **Step 1: Test scope separation**

Write tests proving:

- target effects cannot run on scene-native objects;
- scene-object effects cannot run on DOM targets;
- scene-object effects receive `objectPointer` and `ctx.scene`;
- scene-object effects do not receive `layout` or `targetPointer`;
- `resources.dispose()` runs on object unregister and runtime dispose.

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/effects/sceneObjectEffectContext.test.ts packages/dom-webgl-runtime/test/lib/effects/sceneObjectEffectController.test.ts
```

Expected: fails until runtime support exists.

- [x] **Step 2: Add registry scope checks**

Extend the effect registry to store definition scope. Default existing `defineWebGLEffect(...)` definitions to target scope. Store `defineWebGLSceneObjectEffect(...)` definitions as scene-object scope.

- [x] **Step 3: Build scene-object contexts**

Create `sceneObjectEffectContext.ts` using the same resource and runtime scope patterns as target effects, but build context from object id, scene scope, frame input, object pointer state, and controlled object facade.

- [x] **Step 4: Run scene-object effect controllers from model/stage registries**

Instantiate effect controllers when a scene-native model/stage object is registered and dispose them when the object or scene unregisters. Keep effect execution controlled by runtime dirty reasons and object interaction changes.

- [x] **Step 5: Re-run focused effect tests**

Run the same effect test command. Expected: passes.

### Task 4: Implement `screen-plane` Placement

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/types.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/projectionPolicies.ts`
- Create: `packages/dom-webgl-runtime/src/lib/renderer/screenPlanePlacement.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/stageObjectRegistry.ts`
- Modify: `packages/dom-webgl-runtime/test/lib/renderer/projectionPolicies.test.ts`
- Add: `packages/dom-webgl-runtime/test/lib/renderer/screenPlanePlacement.test.ts`

- [x] **Step 1: Write projection tests**

Cover:

- `screen-plane` rejects missing `planeId`.
- `screen-plane` only resolves in `perspective-stage`.
- missing plane produces a descriptor-only diagnostic and no raw handle.
- valid camera + plane + DOM rect returns a stage-local position.
- `offset` and `scale` apply after plane intersection.

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/renderer/screenPlanePlacement.test.ts packages/dom-webgl-runtime/test/lib/renderer/projectionPolicies.test.ts
```

Expected: fails until resolver exists.

- [x] **Step 2: Add a runtime-owned resolver**

Implement `screenPlanePlacement.ts` as a pure helper around injected camera/plane facts. Do not import React and do not expose Three.js types in public signatures.

- [x] **Step 3: Wire projection policy**

Extend placement normalization and projection policy switch cases. Keep `dom-anchored`, `screen-anchored`, `screen-depth`, and `stage-local` behavior unchanged.

- [x] **Step 4: Re-run projection tests**

Run the same projection command. Expected: passes.

### Task 5: Add Runtime Interaction Router

**Files:**
- Create: `packages/dom-webgl-runtime/src/lib/renderer/interactionRouter.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/threeRenderer.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/managedModelRegistry.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/stageObjectRegistry.ts`
- Add: `packages/dom-webgl-runtime/test/lib/renderer/interactionRouter.test.ts`
- Modify: `packages/dom-webgl-runtime/test/lib/renderer/runtimePipeline.test.ts`

- [x] **Step 1: Write router tests**

Cover:

- only objects with `interaction.pickable` become candidates;
- pass viewport scissor limits hit tests to the active DOM-bound pass rect;
- higher-order pass wins when passes overlap;
- object press captures pointer for drag until release;
- captured object keeps receiving drag even if the pointer leaves its bounds;
- empty-space result is emitted when no object is hit;
- raw intersection objects never appear in public debug or effect state.

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/renderer/interactionRouter.test.ts packages/dom-webgl-runtime/test/lib/renderer/runtimePipeline.test.ts
```

Expected: fails until router is wired.

- [x] **Step 2: Add managed hit candidate records**

Represent candidates as descriptor ids plus internal object refs:

```ts
type ManagedHitCandidate = {
  readonly id: string;
  readonly sceneId: string;
  readonly sourceKind: "model/glb" | "stage/plane" | "stage/box";
  readonly object3D: unknown;
  readonly hitTest: "bounds";
};
```

Keep this internal. Public debug state should use ids and source kind only.

- [x] **Step 3: Add internal hit-test adapter**

Add a `pickManagedObjects(...)` method to the renderer host or a small injected adapter owned by `threeRenderer.ts`. It may use Three.js internally, but returns only:

```ts
type ManagedHitResult = {
  readonly id: string;
  readonly sceneId: string;
  readonly point: WebGLTuple3;
  readonly normal?: WebGLTuple3;
  readonly distance: number;
};
```

- [x] **Step 4: Wire router into runtime frame sync**

Run the router after pointer state and pass/camera facts are known, before scene-object effects update. Mark pointer input and interaction state changes as render dirty reasons.

- [x] **Step 5: Re-run router tests**

Run the same router command. Expected: passes.

### Task 6: Expose Object Pointer State To Scene-Object Effects And Debug

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/types.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/effects/sceneObjectEffectContext.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/debug/debugState.ts`
- Modify: `packages/dom-webgl-runtime/test/lib/debug/debugState.test.ts`
- Modify: `packages/dom-webgl-runtime/test/lib/effects/sceneObjectEffectController.test.ts`

- [x] **Step 1: Write debug and context tests**

Cover object states:

- hover on/off;
- press without drag;
- click on release;
- drag after movement;
- pointer capture and release;
- hit point present only when a managed hit exists.

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/debug/debugState.test.ts packages/dom-webgl-runtime/test/lib/effects/sceneObjectEffectController.test.ts
```

Expected: fails until state is exposed.

- [x] **Step 2: Add descriptor-only debug summaries**

Use ids and booleans only:

```ts
export type WebGLDebugInteractionSummary = {
  readonly hoveredObjectId?: string;
  readonly pressedObjectId?: string;
  readonly capturedObjectId?: string;
  readonly lastClickedObjectId?: string;
  readonly cameraController?: {
    readonly cameraId: string;
    readonly active: boolean;
    readonly kind: "orbit";
  };
};
```

- [x] **Step 3: Feed object pointer state into contexts**

Set `ctx.objectPointer` from the router's current state. Ensure missing state returns an immutable inactive object, not `undefined`.

- [x] **Step 4: Re-run debug and effect tests**

Run the same command. Expected: passes.

### Task 7: Add Minimal Empty-Space Camera Drag

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/types.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/renderLayerRegistry.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`
- Modify: `packages/dom-webgl-runtime/test/lib/renderer/renderLayerRegistry.test.ts`
- Modify: `packages/dom-webgl-runtime/test/lib/renderer/runtimePipeline.test.ts`
- Modify: `packages/dom-webgl-runtime/test/publicExports.test.ts`

- [x] **Step 1: Write camera controller priority tests**

Cover:

- pointer drag over empty scene activates `controller.pointer.kind: "orbit"`;
- pointer drag over a pickable object does not activate camera drag;
- active object drag capture blocks camera drag;
- timeline controller output remains the base frame;
- pointer camera offset is applied only while dragging and stops on pointer release;
- no pan, dolly, wheel, pinch, damping, inertia, or raw controls surface is exposed.

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/renderer/runtimePipeline.test.ts packages/dom-webgl-runtime/test/lib/renderer/renderLayerRegistry.test.ts packages/dom-webgl-runtime/test/publicExports.test.ts
```

Expected: fails until pointer controller support is implemented.

- [x] **Step 2: Normalize pointer camera controller descriptors**

Keep one `WebGLCamera.controller` field. Add optional `pointer` data under it instead of introducing raw controls or a separate camera ref API.

- [x] **Step 3: Apply pointer camera offset after timeline controller frame**

In runtime camera update order:

1. apply declaration base frame;
2. apply timeline controller frame when present;
3. apply pointer controller offset when active;
4. render passes use the resulting managed camera.

- [x] **Step 4: Re-run camera tests**

Run the same camera command. Expected: passes.

### Task 8: Add Example Dogfood And Browser Verification

**Files:**
- Create or modify: `apps/example/src/ManagedInteractionExample.tsx`
- Modify: `apps/example/src/App.tsx`
- Modify or create effects under `apps/example/src/*Effects.ts`
- Add or modify tests under `apps/example/test/`
- Modify: `docs/performance/profile-notes.md` if browser profile evidence is collected

- [x] **Step 1: Add a small interaction example**

Include:

- a managed `perspective-stage` scene;
- one `WebGLStagePlane` with `interaction.pickable`;
- one `WebGLModel` with `interaction.pickable` and a scene-object hover/drag effect;
- one `WebGLCamera.controller.pointer` empty-space orbit;
- a DOM-backed target using `screen-plane` placement against the stage plane.

- [x] **Step 2: Add example tests**

Cover import boundaries and descriptor usage through public package entrypoints only.

Run:

```bash
npm test -- --run apps/example/test
npm run check:imports
```

Expected: passes.

- [x] **Step 3: Run browser verification**

Start the example:

```bash
npm run dev -w @project/dom-webgl-example
```

Verify with a real browser:

- hover stage primitive changes debug/effect state;
- click stage primitive records `lastClickedObjectId`;
- drag model captures pointer and releases on pointer up;
- drag empty space moves the managed camera;
- object drag wins over camera drag;
- `screen-plane` target appears on the named plane and does not create a second canvas.

Verification result:

- Browser console errors: 0.
- Canvas count: 1.
- Stage primitive hit verified at `(120, 460)` with
  `hover example.interaction.floor`, then explicit pointer down/up recorded
  `press example.interaction.floor` and `click example.interaction.floor`.
- Model hit verified at `(680, 425)` with
  `hover example.interaction.hero`; drag recorded
  `press example.interaction.hero` and `capture example.interaction.hero`.
- Empty-space hit verified at `(40, 40)` with `Interaction none`; drag there
  activated `example.interaction.camera · orbit · active`.
- During model drag, the Camera debug row stayed absent, so object capture wins
  over camera drag.
- The example dogfood uses `/models/hero.glb` for this interaction row because
  `/models/Sprint.glb` has very coarse root bounds and is already covered by
  the Phase 7 animation dogfood.

Follow-up correction:

- `ManagedInteractionExample` was later expanded again for Phase 8B: it now
  keeps the pickable floor and reintroduces `/models/hero.glb` as the only
  scene-native model in this row, with object drag capture plus rich camera
  gestures. It still omits the screen-plane card.

### Task 9: Update Documentation And Close Phase

**Files:**
- Modify: `README.md`
- Modify: `docs/STATUS.md`
- Modify: `docs/agent/package-onboarding.md`
- Modify: `docs/agent/package-usage.md`
- Modify: `docs/examples/effect-authoring.md`
- Modify: `docs/roadmap/managed-render-system.md`

- [x] **Step 1: Document public usage**

Add package usage examples for:

- `defineWebGLSceneObjectEffect(...)`;
- `WebGLModel.effects` as scene-object-scoped effects;
- `interaction.pickable`;
- `ctx.objectPointer`;
- `screen-plane`;
- `WebGLCamera.controller.pointer`.

- [x] **Step 2: Document caveats**

State explicitly:

- Level 1 `WebGLTarget` remains the shortest path.
- `ctx.targetPointer` remains DOM-target local.
- scene-object effects do not receive DOM layout or fallback lifecycle.
- hit state is managed and descriptor-only.
- v1 picking is bounds-level, not physics/collider/mesh detail.
- raw raycaster/intersection/camera/control handles remain private.

- [x] **Step 3: Update roadmap status after implementation**

When code, tests, docs, and commit are complete, update Phase 8 to `[verified]`. Use `[implemented]` first if code is written but verification/docs/commit are not closed.

## Testing Strategy

Run focused tests after each task. Full closeout verification should be:

```bash
npm run test -- --run
npm run typecheck
npm run build
npm run check:imports
git diff --check
```

Browser verification is required before claiming Phase 8 verified because pointer routing, pass viewport hit gating, and camera/object priority depend on real event behavior.

## Documentation Updates

Update docs in this order:

1. `docs/agent/package-usage.md` for the precise public contract.
2. `README.md` for project-level usage and caveats.
3. `docs/examples/effect-authoring.md` for consumer effect authoring examples.
4. `docs/STATUS.md` for active implementation truth.
5. `docs/roadmap/managed-render-system.md` for phase status only after implementation and verification state changes.

## Exit Criteria

- `WebGLModel`, `WebGLStagePlane`, and `WebGLStageBox` can opt into managed bounds-level hit testing.
- Scene-native object effects run through `defineWebGLSceneObjectEffect(...)` and receive `ctx.objectPointer`.
- DOM target effects and `ctx.targetPointer` behavior are unchanged.
- `screen-plane` placement works against a named `WebGLStagePlane` without raw ray/camera/plane exposure.
- Object hover, click, drag, pointer capture, and release are deterministic in tests.
- Empty-space camera drag works and loses priority to object hover/press/drag.
- Phase 8 does not add full camera gesture controls; pan, dolly, wheel/pinch zoom, damping, inertia, and pointer parallax remain Phase 8B.
- Debug state exposes descriptor-only interaction summaries.
- Public export tests reject raw Three.js handles, raw intersections, raw raycasters, and wrong-scope effects.
- Example dogfood proves stage/model/object/camera priority in a real browser.
- Docs are synchronized and Phase 8 roadmap status is updated according to actual completion state.

## Risks

- Scene-object effects may look similar to target effects because both use an `effects` prop. Mitigation: separate definition helper, scope validation, docs, and wrong-scope tests.
- Bounds-level picking may be too coarse for some model meshes. Mitigation: document v1 as coarse/object-level and defer mesh/collider detail to a later focused phase.
- Camera pointer controller could conflict with timeline controller state. Mitigation: deterministic update order and tests for timeline base plus pointer offset.
- Pass viewport hit priority can regress DOM-bound clipping behavior. Mitigation: reuse pass viewport facts and add overlap/scissor tests.
- Pointer capture can create stuck drag state if release is missed. Mitigation: clear capture on pointer up, pointer cancel, object unregister, scene unregister, and runtime dispose.
- `screen-plane` depends on camera and plane facts that may not exist during registration order changes. Mitigation: resolve per frame, skip safely, and report descriptor-only diagnostics until all dependencies exist.
