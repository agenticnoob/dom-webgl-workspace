# Phase 9 Managed Dynamics And Physics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add descriptor-driven managed dynamics for scene-native stage/model objects without exposing raw Three.js or raw physics-engine ownership.

**Architecture:** Phase 9 v1 adds a runtime-owned physics controller that reads stable `physics` descriptors from `WebGLStagePlane`, `WebGLStageBox`, and scene-native `WebGLModel` registrations. The controller owns body state, collider summaries, simple integration, spring/drag constraints, collision response against managed colliders, debug summaries, scheduling, and disposal; it writes final transforms back through internal scene-object transform access. Level 1 `WebGLTarget` stays unchanged.

**Tech Stack:** TypeScript strict mode, React descriptor components, current Three.js internals, Vitest/jsdom tests, no new runtime dependency in v1.

---

## Current Truth Gate

- Roadmap `Roadmap Status` first `[not-started]` phase is `Phase 9: Dynamics and Physics`.
- No existing Phase 9 focused plan exists under `docs/superpowers/plans/`.
- Current public scene-object interaction supports only `interaction.pickable` with `hitTest: "bounds" | "mesh"` and pointer flags.
- `WebGLStagePlane`, `WebGLStageBox`, and scene-native `WebGLModel` already carry `effects` and `interaction` descriptors.
- `WebGLSceneObjectPointerState` already includes `hit.point`, optional `hit.normal`, `hit.distance`, and drag deltas for scene-object effects.
- No public `physics`, `dynamics`, `body`, `collider`, `force`, or `constraint` API exists in `packages/dom-webgl-runtime/src`.
- Runtime disposal already owns `stageObjects`, `managedModels`, `interactionRouter`, `renderLayers`, and renderer host teardown.

## Scope

- Add a descriptor-only `physics` field to scene-native stage primitives and `WebGLModel`.
- Support `static`, `dynamic`, and `kinematic` bodies.
- Support managed collider descriptors: `bounds`, `box`, `sphere`, and `plane`.
- Support gravity, velocity, damping, restitution, and friction as managed numeric body fields.
- Support simple descriptor constraints:
  - `anchor` keeps a body near a fixed scene position.
  - `spring` pulls a body toward a fixed scene position.
- Support pointer drag constraints built on Phase 8 object hit/capture state.
- Emit descriptor-only physics debug state.
- Keep physics paused/disposed with the runtime lifecycle.
- Add example dogfood to the existing managed interaction surface or a new adjacent managed physics row in `apps/example`.

## Non-Goals

- No raw physics engine object in public API.
- No raw `THREE.Object3D`, `Mesh`, `Material`, `Raycaster`, `Camera`, or intersection handles.
- No Level 1 `WebGLTarget` physics in v1.
- No DOM fallback/lifecycle changes for physics bodies.
- No broad rigid-body engine, joints graph, vehicle controller, ragdoll, soft body, IK, navmesh, particles, or cloth.
- No wheel or pinch gesture ownership changes.
- No external Rapier/Cannon/Ammo dependency in this first focused slice.
- No user-authored render loop, scheduler, loader, or worker.

## API And Architecture Principles

- `WebGLTarget` remains the shortest default DOM-first path.
- Physics is opt-in Level 3 scene-native behavior.
- Public naming is Three-like and explicit: `physics`, `body`, `collider`, `velocity`, `gravity`, `damping`, `restitution`, `friction`, `constraints`, `pointerDrag`.
- Public API is declarative descriptor data; runtime owns body state and integration.
- Runtime writes managed transforms internally; consumers never receive raw body or object handles.
- If a scene-native object has `physics.body`, physics owns final `position` updates after descriptor/timeline/effect base transforms for that frame. Object effects should avoid also writing `ctx.object.position` on physics-driven objects.
- Collision and drag events are debug/effect-readable summaries only; they are not raw solver contacts.
- v1 can be simple and predictable. If realistic collision solving exceeds this scope, stop and plan a Phase 9B optional engine-adapter decision.

## Proposed Public Types

Add these public types in `packages/dom-webgl-runtime/src/lib/types.ts`:

```ts
export type WebGLPhysicsBodyType = "static" | "dynamic" | "kinematic";

export type WebGLPhysicsBodyDeclaration = {
  readonly type?: WebGLPhysicsBodyType;
  readonly mass?: number;
  readonly velocity?: WebGLTuple3;
  readonly gravityScale?: number;
  readonly damping?: number;
  readonly restitution?: number;
  readonly friction?: number;
};

export type WebGLColliderDeclaration =
  | {
      readonly kind?: "bounds";
      readonly padding?: number | WebGLTuple3;
    }
  | {
      readonly kind: "box";
      readonly size?: WebGLTuple3;
      readonly center?: WebGLTuple3;
    }
  | {
      readonly kind: "sphere";
      readonly radius?: number;
      readonly center?: WebGLTuple3;
    }
  | {
      readonly kind: "plane";
      readonly normal?: WebGLTuple3;
      readonly offset?: number;
    };

export type WebGLPhysicsConstraintDeclaration =
  | {
      readonly kind: "anchor";
      readonly target: WebGLTuple3;
      readonly stiffness?: number;
      readonly damping?: number;
    }
  | {
      readonly kind: "spring";
      readonly target: WebGLTuple3;
      readonly restLength?: number;
      readonly stiffness?: number;
      readonly damping?: number;
    };

export type WebGLPhysicsPointerDragDeclaration =
  | boolean
  | {
      readonly stiffness?: number;
      readonly damping?: number;
      readonly maxForce?: number;
    };

export type WebGLPhysicsDeclaration = {
  readonly body?: WebGLPhysicsBodyDeclaration;
  readonly collider?: false | WebGLColliderDeclaration;
  readonly constraints?: readonly WebGLPhysicsConstraintDeclaration[];
  readonly pointerDrag?: WebGLPhysicsPointerDragDeclaration;
};
```

Add `physics?: WebGLPhysicsDeclaration` to:

```ts
export type WebGLStagePrimitiveBaseDeclaration = {
  // existing fields
  physics?: WebGLPhysicsDeclaration;
};

export type WebGLModelDeclaration = {
  // existing fields
  readonly physics?: WebGLPhysicsDeclaration;
};
```

Add descriptor-only debug summaries:

```ts
export type WebGLDebugPhysicsBodySummary = {
  readonly id: string;
  readonly sceneId: string;
  readonly sourceKind: WebGLSceneObjectEffectSourceKind;
  readonly type: WebGLPhysicsBodyType;
  readonly active: boolean;
  readonly collider?: { readonly kind: "bounds" | "box" | "sphere" | "plane" };
  readonly position: WebGLTuple3;
  readonly velocity: WebGLTuple3;
  readonly constraints: number;
  readonly pointerDrag: boolean;
};

export type WebGLDebugPhysicsSummary = {
  readonly bodyCount: number;
  readonly activeBodyCount: number;
  readonly collisionCount: number;
  readonly bodies: readonly WebGLDebugPhysicsBodySummary[];
};
```

Then add `physics?: WebGLDebugPhysicsSummary` to `WebGLDebugState`.

## File Map

- Modify `packages/dom-webgl-runtime/src/lib/types.ts` for public descriptor and debug types.
- Create `packages/dom-webgl-runtime/src/lib/renderer/physicsDeclarations.ts` for normalization and debug inspection helpers.
- Create `packages/dom-webgl-runtime/src/lib/renderer/sceneObjectTransform.ts` for internal read/write of scene-object transforms.
- Create `packages/dom-webgl-runtime/src/lib/renderer/physicsWorld.ts` for body state, simple integration, collision handling, pointer drag constraints, inspect, and dispose.
- Modify `packages/dom-webgl-runtime/src/lib/renderer/stageDeclarations.ts` to normalize `physics`.
- Modify `packages/dom-webgl-runtime/src/lib/renderer/managedModelRegistry.ts` to normalize model `physics`.
- Modify `packages/dom-webgl-runtime/src/lib/renderer/stageObjectRegistry.ts` to expose physics candidates for stage primitives.
- Modify `packages/dom-webgl-runtime/src/lib/renderer/managedModelRegistry.ts` to expose physics candidates for scene-native models.
- Modify `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts` to create, update, inspect, and dispose the physics world.
- Modify `packages/dom-webgl-runtime/src/lib/react/WebGLStagePlane.tsx`, `WebGLStageBox.tsx`, and `WebGLModel.tsx` to pass `physics` through registration.
- Modify `packages/dom-webgl-runtime/src/index.ts` to export the new public physics and debug types.
- Test:
  - Create `packages/dom-webgl-runtime/test/lib/renderer/physicsDeclarations.test.ts`.
  - Create `packages/dom-webgl-runtime/test/lib/renderer/physicsWorld.test.ts`.
  - Extend `packages/dom-webgl-runtime/test/lib/renderer/stageObjectRegistry.test.ts`.
  - Extend `packages/dom-webgl-runtime/test/lib/renderer/managedModelRegistry.test.ts`.
  - Extend `packages/dom-webgl-runtime/test/lib/renderer/runtimePipeline.test.ts`.
  - Extend `packages/dom-webgl-runtime/test/publicExports.test.ts`.
  - Extend `apps/example/test/ManagedInteractionExample.test.tsx` for public React descriptor usage.
- Docs:
  - Update `README.md`.
  - Update `docs/STATUS.md`.
  - Update `docs/agent/package-onboarding.md`.
  - Update `docs/agent/package-usage.md`.
  - Update `docs/examples/effect-authoring.md` to clarify that physics is descriptor-owned scene-native behavior, not a target effect transform shortcut.
  - Update `docs/roadmap/managed-render-system.md` closeout status only after implementation and verification.

## Implementation Tasks

### Task 1: Public Descriptor Contract

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/types.ts`
- Modify: `packages/dom-webgl-runtime/test/publicExports.test.ts`
- Create: `packages/dom-webgl-runtime/test/lib/renderer/physicsDeclarations.test.ts`

- [ ] **Step 1: Add RED type coverage for public descriptors**

Add typecheck cases proving:

```ts
const stagePhysics = {
  body: { type: "dynamic", mass: 1, velocity: [0, 0, 0], damping: 0.08 },
  collider: { kind: "box", size: [120, 20, 120] },
  pointerDrag: { stiffness: 0.28, damping: 0.16, maxForce: 1800 },
  constraints: [
    { kind: "spring", target: [0, 20, 0], restLength: 0, stiffness: 0.18 },
  ],
} satisfies WebGLPhysicsDeclaration;

const model = {
  id: "hero",
  sceneId: "world",
  src: "/models/hero.glb",
  physics: stagePhysics,
} satisfies WebGLModelDeclaration;
```

Also prove raw engine/object handles are rejected:

```ts
const invalidPhysics = {
  body: { type: "dynamic" },
  // @ts-expect-error - public physics descriptors cannot expose raw engine bodies.
  rigidBody: {},
} satisfies WebGLPhysicsDeclaration;
```

- [ ] **Step 2: Run the focused RED tests**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/publicExports.test.ts packages/dom-webgl-runtime/test/lib/renderer/physicsDeclarations.test.ts
```

Expected: FAIL because `WebGLPhysicsDeclaration` and the physics fields do not exist yet.

- [ ] **Step 3: Add public types**

Add the proposed public types from this plan to `types.ts`, add `physics` to `WebGLStagePrimitiveBaseDeclaration` and `WebGLModelDeclaration`, and add `physics?: WebGLDebugPhysicsSummary` to `WebGLDebugState`.

- [ ] **Step 4: Run the focused type tests**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/publicExports.test.ts packages/dom-webgl-runtime/test/lib/renderer/physicsDeclarations.test.ts
```

Expected: public type failures move to missing normalization helpers only.

### Task 2: Normalize And Inspect Physics Descriptors

**Files:**
- Create: `packages/dom-webgl-runtime/src/lib/renderer/physicsDeclarations.ts`
- Modify: `packages/dom-webgl-runtime/test/lib/renderer/physicsDeclarations.test.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/stageDeclarations.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/managedModelRegistry.ts` or extracted model declaration normalizer

- [ ] **Step 1: Add RED normalization tests**

Cover these exact expectations:

```ts
expect(normalizePhysicsDeclaration(undefined)).toBeUndefined();
expect(normalizePhysicsDeclaration({ body: {} })).toMatchObject({
  body: {
    type: "dynamic",
    mass: 1,
    gravityScale: 1,
    damping: 0,
    restitution: 0,
    friction: 0.5,
    velocity: [0, 0, 0],
  },
  collider: { kind: "bounds", padding: 0 },
  constraints: [],
  pointerDrag: undefined,
});
expect(normalizePhysicsDeclaration({ body: { type: "static" } })).toMatchObject({
  body: { type: "static", mass: 0, velocity: [0, 0, 0] },
});
expect(normalizePhysicsDeclaration({ collider: false })).toMatchObject({
  collider: undefined,
});
expect(normalizePhysicsDeclaration({ pointerDrag: true })).toMatchObject({
  pointerDrag: { stiffness: 0.24, damping: 0.18, maxForce: 1600 },
});
```

- [ ] **Step 2: Implement normalization**

Implement:

```ts
export type NormalizedPhysicsDeclaration = {
  readonly body?: NormalizedPhysicsBodyDeclaration;
  readonly collider?: NormalizedColliderDeclaration;
  readonly constraints: readonly NormalizedPhysicsConstraintDeclaration[];
  readonly pointerDrag?: NormalizedPhysicsPointerDragDeclaration;
};

export function normalizePhysicsDeclaration(
  declaration: WebGLPhysicsDeclaration | undefined,
): NormalizedPhysicsDeclaration | undefined;

export function inspectPhysicsDeclaration(
  declaration: NormalizedPhysicsDeclaration | undefined,
): WebGLDebugPhysicsBodySummary["collider"] | undefined;
```

Clamp non-finite numbers to defaults. Clamp `mass` to `0` for static bodies and to at least `0.001` for dynamic bodies. Clamp damping/friction/restitution into `0..1`.

- [ ] **Step 3: Thread normalized physics into existing declarations**

Add `physics` to normalized stage primitive entries and model entries. Do not change current normalization defaults when `physics` is absent.

- [ ] **Step 4: Run normalization tests**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/renderer/physicsDeclarations.test.ts packages/dom-webgl-runtime/test/lib/renderer/stageDeclarations.test.ts packages/dom-webgl-runtime/test/lib/renderer/managedModelRegistry.test.ts
```

Expected: PASS after wiring; existing stage/model tests stay green.

### Task 3: Internal Transform Access And Physics World

**Files:**
- Create: `packages/dom-webgl-runtime/src/lib/renderer/sceneObjectTransform.ts`
- Create: `packages/dom-webgl-runtime/src/lib/renderer/physicsWorld.ts`
- Create: `packages/dom-webgl-runtime/test/lib/renderer/physicsWorld.test.ts`

- [ ] **Step 1: Add RED physics world tests**

Cover:

```ts
test("dynamic bodies integrate velocity, gravity, and damping", () => {});
test("static bodies do not move", () => {});
test("kinematic bodies keep descriptor transform unless pointer drag is active", () => {});
test("spring constraints pull a body toward their target", () => {});
test("sphere and box bodies resolve against a static plane", () => {});
test("pointer drag creates a spring target from object pointer hit state", () => {});
test("dispose clears bodies and inspect returns an empty summary", () => {});
```

- [ ] **Step 2: Add internal transform helpers**

Implement helpers that work against the current `WebGLSceneObject.object3D?: unknown` shape:

```ts
export type SceneObjectTransformSnapshot = {
  readonly position: WebGLTuple3;
  readonly rotation: WebGLTuple3;
  readonly scale: WebGLTuple3;
};

export function readSceneObjectTransform(
  object: WebGLSceneObject,
): SceneObjectTransformSnapshot;

export function writeSceneObjectPosition(
  object: WebGLSceneObject,
  position: WebGLTuple3,
): void;
```

Use the same unknown-safe object/vector checks as `sceneObjectEffectObject.ts`. Do not export these helpers from the public package entrypoint.

- [ ] **Step 3: Implement `createPhysicsWorld`**

Expose an internal controller:

```ts
export type ManagedPhysicsCandidate = {
  readonly id: string;
  readonly sceneId: string;
  readonly sourceKind: WebGLSceneObjectEffectSourceKind;
  readonly object: WebGLSceneObject;
  readonly physics: NormalizedPhysicsDeclaration;
  readonly objectPointer?: WebGLSceneObjectPointerState;
};

export type PhysicsWorld = {
  update(input: {
    readonly frameInput: WebGLFrameInput;
    readonly candidates: readonly ManagedPhysicsCandidate[];
  }): { readonly changed: boolean; readonly requiresContinuousRendering: boolean };
  inspect(): WebGLDebugPhysicsSummary;
  dispose(): void;
};
```

Use semi-implicit Euler:

```text
velocity += (gravity * gravityScale + constraintForce / mass) * dt
velocity *= max(0, 1 - damping)
position += velocity * dt
```

Cap `dt` to `1 / 30` seconds to avoid large hidden-tab jumps. Bodies with no registered candidate in the current frame are removed.

- [ ] **Step 4: Keep collision response intentionally small**

For v1:

- Static `plane` colliders can push dynamic `sphere` or `box` bodies out along the plane normal.
- Static `box` colliders can provide conservative AABB push-out for dynamic `sphere` or `box` bodies.
- Dynamic-vs-dynamic collision can be detected and counted in debug but should not run a full impulse solver in this slice.

- [ ] **Step 5: Run physics world tests**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/renderer/physicsWorld.test.ts
```

Expected: PASS.

### Task 4: Registry And Runtime Wiring

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/stageObjectRegistry.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/managedModelRegistry.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`
- Modify: `packages/dom-webgl-runtime/test/lib/renderer/stageObjectRegistry.test.ts`
- Modify: `packages/dom-webgl-runtime/test/lib/renderer/managedModelRegistry.test.ts`
- Modify: `packages/dom-webgl-runtime/test/lib/renderer/runtimePipeline.test.ts`

- [ ] **Step 1: Add RED registry tests**

Prove stage and model registries collect physics candidates only when a scene object has normalized physics:

```ts
expect(registry.collectPhysicsCandidates()).toEqual([
  expect.objectContaining({
    id: "floor",
    sceneId: "world",
    sourceKind: "stage/plane",
  }),
]);
```

Also prove unregistering an object removes its candidate and scene unregister removes all candidates for that scene.

- [ ] **Step 2: Add candidate collection methods**

Add `collectPhysicsCandidates()` to `StageObjectRegistry` and `ManagedModelRegistry`. Include `readObjectPointerState(id)` in each candidate so pointer drag uses the same Phase 8 router state as scene-object effects.

- [ ] **Step 3: Add runtime physics controller**

In `runtime.ts`:

- create `const physicsWorld = createPhysicsWorld();`
- after `interactionResult = updateSceneObjectInteractions(frameInput)` and after model/stage objects for the frame are available, call:

```ts
const physicsUpdate = physicsWorld.update({
  frameInput,
  candidates: [
    ...stageObjects.collectPhysicsCandidates(),
    ...managedModels.collectPhysicsCandidates(),
  ],
});
```

- include `physicsUpdate.changed` in `didSynchronousUpdate`.
- include `physicsUpdate.requiresContinuousRendering` in `requiresContinuousRendering`.
- include `physics: physicsWorld.inspect()` in debug state when any bodies exist.
- call `physicsWorld.dispose()` during runtime disposal before scene/model/stage registries dispose.

- [ ] **Step 4: Keep ordering explicit**

The intended order is:

```text
camera controllers / camera gestures
-> scene-object interaction router
-> stage/model scene-object effects and model update
-> physics world writes final body transforms
-> target updates
-> render passes
```

If implementation reveals model update must happen before candidate collection, keep the same ownership rule: physics writes final transforms after effects/model registration for that frame.

- [ ] **Step 5: Run runtime wiring tests**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/renderer/stageObjectRegistry.test.ts packages/dom-webgl-runtime/test/lib/renderer/managedModelRegistry.test.ts packages/dom-webgl-runtime/test/lib/renderer/runtimePipeline.test.ts
```

Expected: PASS.

### Task 5: React Descriptor Pass-Through

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/react/WebGLStagePlane.tsx`
- Modify: `packages/dom-webgl-runtime/src/lib/react/WebGLStageBox.tsx`
- Modify: `packages/dom-webgl-runtime/src/lib/react/WebGLModel.tsx`
- Test: `packages/dom-webgl-runtime/test/lib/react/WebGLStagePlane.test.tsx`
- Test: `packages/dom-webgl-runtime/test/lib/react/WebGLStageBox.test.tsx`
- Test: `packages/dom-webgl-runtime/test/lib/react/WebGLModel.test.tsx`

- [ ] **Step 1: Add RED React pass-through tests**

Render each component under `WebGLScene` and assert runtime registration receives `physics` unchanged:

```tsx
createElement(WebGLStagePlane, {
  id: "floor",
  role: "floor",
  physics: { body: { type: "static" }, collider: { kind: "plane" } },
});
```

- [ ] **Step 2: Pass `physics` through registration**

Destructure `physics` in each component and include:

```ts
...(physics !== undefined ? { physics } : {}),
```

in the runtime registration descriptor. Add `physics` to the `useEffect` dependency array.

- [ ] **Step 3: Run React descriptor tests**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/react
```

Expected: PASS.

### Task 6: Example Dogfood

**Files:**
- Modify: `apps/example/src/ManagedInteractionExample.tsx`
- Modify: `apps/example/test/ManagedInteractionExample.test.tsx`

- [ ] **Step 1: Add a minimal dogfood scene**

Use one static floor and one dynamic model or box:

```tsx
<WebGLStagePlane
  id="physics.floor"
  role="floor"
  size={[900, 700]}
  physics={{
    body: { type: "static" },
    collider: { kind: "plane", normal: [0, 1, 0], offset: -120 },
  }}
/>

<WebGLStageBox
  id="physics.box"
  size={[80, 80, 80]}
  position={[0, 80, 0]}
  interaction={{ pickable: { hitTest: "bounds", pointer: { drag: true } } }}
  physics={{
    body: { type: "dynamic", mass: 1, damping: 0.04, restitution: 0.2 },
    collider: { kind: "box", size: [80, 80, 80] },
    pointerDrag: true,
  }}
/>
```

- [ ] **Step 2: Keep the dogfood public-API only**

Imports must come only from `@project/dom-webgl-runtime`, `@project/dom-webgl-runtime/react`, and existing public scroll adapter entrypoints. Do not import package `src`.

- [ ] **Step 3: Add example test coverage**

Assert the example renders the physics descriptors and does not import internal runtime paths.

- [ ] **Step 4: Run example/import tests**

Run:

```bash
npm test -- --run apps/example/test scripts
npm run check:imports
```

Expected: PASS.

### Task 7: Docs And Validation

**Files:**
- Modify: `README.md`
- Modify: `docs/STATUS.md`
- Modify: `docs/agent/package-onboarding.md`
- Modify: `docs/agent/package-usage.md`
- Modify: `docs/examples/effect-authoring.md`
- Modify: `docs/roadmap/managed-render-system.md`

- [ ] **Step 1: Document the new contract**

Docs must state:

- physics is opt-in scene-native Level 3 behavior;
- Level 1 `WebGLTarget` remains unchanged;
- `physics` descriptors are stable declaration data;
- runtime owns body state, collision, scheduling, and disposal;
- no raw physics engine or raw Three handles are exposed;
- object effects should not compete with physics for final transform ownership.

- [ ] **Step 2: Update roadmap status only after verification**

After implementation and verification, update Phase 9 from `[planned]` to `[verified]` with completion notes. Do not mark verified before tests/docs/commit are closed.

- [ ] **Step 3: Run focused validation**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/renderer/physicsDeclarations.test.ts packages/dom-webgl-runtime/test/lib/renderer/physicsWorld.test.ts packages/dom-webgl-runtime/test/lib/renderer/stageObjectRegistry.test.ts packages/dom-webgl-runtime/test/lib/renderer/managedModelRegistry.test.ts packages/dom-webgl-runtime/test/lib/renderer/runtimePipeline.test.ts packages/dom-webgl-runtime/test/publicExports.test.ts
npm run typecheck
npm run check:imports
git diff --check
```

Expected: all pass.

- [ ] **Step 4: Run full validation before closeout**

Run:

```bash
npm run test -- --run && npm run typecheck && npm run build && npm run check:imports && git diff --check
```

Expected: all pass. Existing Vite chunk-size warnings remain non-blocking if unchanged.

## Exit Criteria

- `physics` is public descriptor data on `WebGLStagePlane`, `WebGLStageBox`, and scene-native `WebGLModel`.
- Static/dynamic/kinematic bodies are runtime-owned and disposed with their scene objects.
- Bounds/box/sphere/plane colliders normalize and report descriptor-only debug summaries.
- Dynamic bodies integrate gravity/velocity/damping and resolve against simple static colliders.
- Anchor/spring constraints move dynamic bodies without consumer-owned loops.
- Pointer drag constraints use Phase 8 object hit/capture state and do not break camera gesture priority.
- Physics update requests continuous rendering only while body motion, settling, pointer drag, or collision response is active.
- `WebGLTarget` Level 1 behavior and DOM pointer behavior remain unchanged.
- Public tests reject raw engine/body/object handles.
- Docs describe scope, non-goals, and transform ownership.

## Risks

- **Transform ownership conflict:** scene-object effects and physics can both write transforms. Mitigation: physics writes final body transforms in v1 and docs tell authors not to combine transform effects with physics bodies.
- **Solver scope creep:** realistic rigid-body physics can grow quickly. Mitigation: v1 uses small deterministic dynamics and static-collider response; external engine adapter requires a later plan.
- **Pointer/camera priority regressions:** object drag constraints must not revive the pre-8B camera conflict. Mitigation: use existing object capture state and keep hover/click-only hits non-blocking for camera drag.
- **Performance drift:** continuous rendering can stay active too long. Mitigation: inspect active body count, settle thresholds, and `requiresContinuousRendering` in focused tests.
- **Debug leakage:** collision data can accidentally expose raw intersections or bodies. Mitigation: debug summaries include ids, shape kinds, positions, velocity, and counts only.

## Questions For Product Review

- Should the public field be named `physics` as planned, or should v1 use `dynamics` to signal the intentionally small solver scope?
- Should Phase 9 v1 dogfood a `WebGLStageBox` cube, a scene-native `WebGLModel`, or both?
- Should dynamic-vs-dynamic collision stay debug-only in v1, or must it resolve before Phase 9 can be considered verified?
