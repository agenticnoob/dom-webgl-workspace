# Managed Camera Controllers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Phase 6A managed, progress-driven camera motion/focus/framing through a single optional `controller` field on each managed `WebGLCamera`, without exposing raw Three.js camera, controls, matrices, render-loop, or implicit target-local `ctx.camera` access.

**Architecture:** Keep Level 1 `WebGLTarget` camera-free. Extend the existing managed camera descriptor with a nested controller descriptor, normalize it with the render-layer camera declaration, and apply controller output from named progress signals before target projection and pass rendering. The runtime owns raw camera mutation through internal camera framing adapters; React only forwards stable descriptor data through `WebGLCamera`.

**Tech Stack:** TypeScript, React adapter components, internal Three.js camera adapter, Vitest/jsdom, npm workspaces.

---

## Context Verified For This Plan

- Roadmap Status table selection: the first `[not-started]` phase was
  `Phase 6A: Managed Camera Controllers`.
- Existing focused plan: none existed at
  `docs/superpowers/plans/2026-07-04-managed-camera-controllers.md`.
- Current branch while planning:
  `codex/managed-render-roadmap-iteration`.
- Recent git truth includes Phase 6 closeout:
  `10e51db8 feat: add pass viewport and scoped postprocess` and
  `da65e4ec docs: clarify Phase 6A camera controller reuse for timeline signals`.
- At plan creation time, `docs/STATUS.md` said Phase 6 pass viewport/postprocess
  was verified and Phase 6A managed camera controllers were not started.
- At plan creation time, the roadmap table said Phase 6 was verified and Phase
  6A was not started. This plan creation updates Phase 6A to `[planned]` and
  links this focused plan.
- CodeGraph source truth:
  - `WebGLCameraDeclaration` currently has static framing fields only:
    `id`, `sceneId`, `type`, `mode`, `default`, `fov`, `near`, `far`,
    `position`, `target`, and `zoom`.
  - `WebGLSceneDeclaration`, `WebGLDeclaration`, `WebGLStagePlaneDeclaration`,
    `WebGLStageBoxDeclaration`, and `WebGLLightDeclaration` can bind timelines;
    `WebGLCameraDeclaration` intentionally does not have a top-level `timeline`.
  - React `WebGLCamera` only registers a camera descriptor and does not expose
    raw camera handles or behavior callbacks.
  - Runtime `syncFrame()` reads progress signals, resizes render layers, updates
    scene/stage timeline state, then measures targets and updates renderables.
  - `projectTargetLayoutForDescriptor(...)` reads the managed scene default
    camera entry for `screen-depth` projection, so camera controllers must apply
    before target projection in each frame.
  - `renderScene()` renders ordered passes with the resolved internal camera,
    viewport/scissor, and scoped postprocess.
  - `publicExports.test.ts` already guards React/root public exports and rejects
    raw scene/camera/object/material/light internals.
- User decision after initial planning:
  - Put the v1 controller inside `WebGLCamera` as `controller`.
  - Allow only one controller per camera.
  - Do not expose `pass` or pass-bound controller scope in v1.
  - Accept deferring orthographic zoom, screen overlay camera control, complex
    framing boxes, orbit, pan, drag, and pointer parallax.
- No implementation code was changed while creating or revising this plan.

## Scope

Implement the smallest useful Phase 6A slice:

- A nested public `WebGLCamera.controller` descriptor for progress-driven camera
  motion/focus/framing.
- React `WebGLCamera` forwards the `controller` descriptor through the existing
  `runtime.registerCamera(...)` path.
- Vanilla runtime parity comes through the existing `registerCamera(...)`
  declaration; no new `registerCameraController(...)` method is added in v1.
- Controller ownership is one-per-camera by descriptor shape.
- Timeline/progress consumption uses Phase 5 named progress signals.
- Internal camera framing updates for managed `perspective-stage` cameras:
  `position`, `target`, and `fov`.
- Controller updates run before `screen-depth` target projection and before pass
  rendering.
- Descriptor-only debug summaries expose camera controller state without raw
  camera, matrix, control, pass, scene, renderer, or render-loop handles.
- Public type tests prove:
  - `WebGLCamera.controller` is accepted;
  - top-level `WebGLCamera.timeline` is still rejected;
  - raw Three.js camera/controls/matrix/render-loop values are still rejected.
- Docs and example dogfood show camera motion as opt-in managed camera work, not
  Level 1 or target-local effect ownership.

## Non-Goals

- Do not add a top-level `timeline` to `WebGLCameraDeclaration`.
- Do not add a separate `WebGLCameraController` React component in v1.
- Do not add `runtime.registerCameraController(...)` or
  `runtime.unregisterCameraController(...)` in v1.
- Do not expose `pass`/`passId` on the v1 public controller API. If one camera
  is rendered by multiple passes, those passes see the same camera state.
- Do not support different framing per pass/viewport for the same camera in v1.
  If that becomes necessary, use distinct managed cameras now; plan pass-bound
  controller scope later only after real need is proven.
- Do not add implicit `ctx.camera` to target-local effects.
- Do not expose raw `THREE.Camera`, `PerspectiveCamera`, `OrthographicCamera`,
  `OrbitControls`, matrices, projection matrix mutation, `lookAt` callbacks,
  renderer, scene, pass, render target, composer, or render-loop handles.
- Do not control the internal generated Level 1 camera.
- Do not add orthographic zoom controllers, screen overlay camera controllers,
  or complex framing-box controllers in this phase. Record them as later
  possible camera-controller iterations.
- Do not add pointer-driven orbit, pan, drag, pointer parallax, empty-space
  camera interaction, or target/object-vs-camera input priority. Those remain
  Phase 8 input-routing work.
- Do not add camera collision, physics, constraints, inertia, or spring systems.
- Do not add a generalized animation graph, keyframe timeline editor, GSAP
  binding, or raw callback hook.
- Do not change `WebGLTarget` default behavior or require Level 1 users to
  author scenes, cameras, passes, controllers, or timelines.

## API And Architecture Principles

- DOM-first: `WebGLTarget` remains the shortest default path. Camera controllers
  are opt-in Level 2/3 managed camera work.
- React mental model: `WebGLCamera` owns the camera declaration and its one
  optional managed controller; component nesting still communicates scene
  ownership through `WebGLScene`.
- Agent-first scope: `controller` sits under `WebGLCamera`, so the API reads as
  camera-owned behavior rather than target effect behavior or raw Three object
  mutation.
- Three-like vocabulary: use `position`, `target`, `fov`, `camera`, and
  `timeline` with managed meanings close to Three.js.
- Runtime-owned mutation: controller descriptors compute managed framing data;
  only internal camera adapters mutate the raw camera.
- Explicit data flow: progress signals feed controller state, controller state
  updates camera entries, target projection reads updated camera state, passes
  render with updated internal cameras.
- Narrow v1: one controller per camera. No blend layers, no multiple controller
  priority, and no pass-bound controller scope.

## Public API Direction

Use this public type shape unless implementation finds a concrete conflict:

```ts
export type WebGLCameraControllerFrameDeclaration = {
  readonly position?: WebGLTuple3;
  readonly target?: WebGLTuple3;
  readonly fov?: number;
};

export type WebGLCameraControllerTimelineDeclaration =
  | string
  | {
      readonly id: string;
      readonly progressKey?: string;
      readonly range?: WebGLTimelineActiveRangeDeclaration;
    };

export type WebGLCameraControllerEasing = "linear" | "smoothstep";

export type WebGLCameraControllerDeclaration = {
  readonly timeline: WebGLCameraControllerTimelineDeclaration;
  readonly from?: WebGLCameraControllerFrameDeclaration;
  readonly to: WebGLCameraControllerFrameDeclaration;
  readonly easing?: WebGLCameraControllerEasing;
};

export type WebGLCameraDeclaration = WebGLCameraFramingDeclaration & {
  id: string;
  sceneId: string;
  type?: WebGLCameraType;
  mode?: WebGLCameraMode;
  default?: boolean;
  controller?: WebGLCameraControllerDeclaration;
};
```

React:

```tsx
<WebGLCamera
  id="hero.camera"
  default
  type="perspective"
  mode="perspective-stage"
  position={[0, 0, 700]}
  target={[0, 0, 0]}
  fov={44}
  controller={{
    timeline: {
      id: "hero.timeline",
      range: { from: 0.1, to: 0.9 },
    },
    to: {
      position: [0, 120, 520],
      target: [0, 48, 0],
      fov: 34,
    },
    easing: "smoothstep",
  }}
/>
```

Vanilla runtime:

```ts
runtime.registerCamera({
  id: "hero.camera",
  sceneId: "hero.scene",
  default: true,
  type: "perspective",
  mode: "perspective-stage",
  position: [0, 0, 700],
  target: [0, 0, 0],
  fov: 44,
  controller: {
    timeline: {
      id: "hero.timeline",
      range: { from: 0.1, to: 0.9 },
    },
    to: {
      position: [0, 120, 520],
      target: [0, 48, 0],
      fov: 34,
    },
    easing: "smoothstep",
  },
});
```

Semantics:

- `controller.timeline` string means `id` and `progressKey` are the same.
- `controller.timeline.range` maps progress into controller progress:
  `clamp((progress - from) / (to - from), 0, 1)`.
- Missing `controller.timeline.range` means the raw progress value is clamped to
  `0..1`.
- `controller.timeline.range.from` defaults to `0`;
  `controller.timeline.range.to` defaults to `1`.
- `from` is optional. For each missing `from` field, use the registered
  camera's static declaration/default for that field.
- `to` must contain at least one of `position`, `target`, or `fov`.
- `easing` defaults to `"linear"`. `"smoothstep"` uses
  `t * t * (3 - 2 * t)`.
- Controller output is clamped outside the range: before the range, the camera
  is at `from`; after the range, the camera is at `to`.
- Controllers apply only to non-generated managed `perspective-stage` cameras in
  this phase. A controller on the generated default camera, orthographic camera,
  or screen camera is a controlled runtime diagnostic.
- A camera can have at most one controller by descriptor shape.
- A pass renders the current state of its camera. Different pass-specific camera
  framing is not part of v1.

## Deferred Camera Work To Record

These are deliberately out of Phase 6A v1, but should remain visible for later
iteration:

- Orthographic zoom controllers for DOM-aligned or screen scenes.
- Screen overlay camera controller behavior.
- Complex framing-box / fit-to-bounds / focus-target framing helpers.
- Per-pass or per-viewport controller scope when one camera must render with
  different framing in different passes.
- Pointer-driven camera behavior: orbit, pan, drag, pointer parallax,
  empty-space camera controls, and camera/object input priority. This belongs to
  Phase 8 because it depends on input routing and picking priority.

## File Structure

Modify:

- `packages/dom-webgl-runtime/src/lib/types.ts`
  - Add camera-controller public types.
  - Extend `WebGLCameraDeclaration` with `controller?: WebGLCameraControllerDeclaration`.
  - Add descriptor-only camera-controller debug summaries.
- `packages/dom-webgl-runtime/src/index.ts`
  - Export camera-controller public types.
- `packages/dom-webgl-runtime/src/lib/react/WebGLCamera.tsx`
  - Accept `controller` in `WebGLCameraProps` and forward it through
    `runtime.registerCamera(...)`.
- `packages/dom-webgl-runtime/src/lib/renderer/renderLayerDeclarations.ts`
  - Either host normalization helpers or import them from the new
    `cameraControllerDeclarations.ts`.
- `packages/dom-webgl-runtime/src/lib/renderer/renderLayerRegistry.ts`
  - Store normalized camera controller data on camera entries, update controller
    state from progress signals, reset camera framing when a camera unregisters,
    and inspect descriptor-only summaries.
- `packages/dom-webgl-runtime/src/lib/renderer/threeRenderer.ts`
  - Add internal camera framing application for managed perspective cameras.
- `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`
  - Update controllers in `syncFrame()` before target projection, include debug
    summaries, and dispose controller state with render layers.
- `packages/dom-webgl-runtime/test/publicExports.test.ts`
  - Add React/root type checks for nested controller API and raw internals
    rejection.
- `packages/dom-webgl-runtime/test/lib/react/WebGLCamera.test.tsx`
  - Add React forwarding tests for `controller`.
- `packages/dom-webgl-runtime/test/lib/renderer/renderLayerRegistry.test.ts`
  - Add controller registration/update/validation tests through
    `registerCamera(...)`.
- `packages/dom-webgl-runtime/test/lib/renderer/threeRenderer.test.ts`
  - Add managed camera framing application tests.
- `packages/dom-webgl-runtime/test/lib/renderer/runtimePipeline.test.ts`
  - Add integration tests proving controller updates happen before
    `screen-depth` projection and pass rendering.
- `packages/dom-webgl-runtime/test/lib/debug/debugState.test.ts`
  - Add descriptor-only camera-controller debug summaries.
- `apps/example/src/ManagedTimelineExample.tsx`
  - Dogfood scroll timeline camera framing with `WebGLCamera controller`.
- `README.md`
  - Document the opt-in camera controller route.
- `docs/STATUS.md`
  - Move Phase 6A from planned to verified during implementation closeout only,
    and record deferred camera work.
- `docs/agent/package-onboarding.md`
  - Add the camera controller route and keep Level 1 camera-free.
- `docs/agent/package-usage.md`
  - Add public contract, examples, and common failure notes.
- `docs/agent/effect-object-boundary.md`
  - Keep no implicit `ctx.camera`; camera behavior is declaration/controller
    owned.
- `docs/examples/effect-authoring.md`
  - Update managed timeline example notes to show `WebGLCamera controller`.
- `docs/roadmap/managed-render-system.md`
  - During implementation, move Phase 6A status through in-progress,
    implemented, and verified only when each condition is actually true.
  - Record deferred camera work and Phase 8 pointer-driven camera controls.

Create:

- `packages/dom-webgl-runtime/src/lib/renderer/cameraControllerDeclarations.ts`
  - Normalize controller timeline range, easing, and frame values.
- `packages/dom-webgl-runtime/test/lib/renderer/cameraControllerDeclarations.test.ts`
  - Pure tests for normalization and progress interpolation.

## Implementation Steps

### Task 1: Public Types And Declaration Normalization

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/types.ts`
- Create: `packages/dom-webgl-runtime/src/lib/renderer/cameraControllerDeclarations.ts`
- Create: `packages/dom-webgl-runtime/test/lib/renderer/cameraControllerDeclarations.test.ts`
- Modify: `packages/dom-webgl-runtime/test/lib/renderer/renderLayerDeclarations.test.ts`

- [x] **Step 1: Write failing normalization tests**

Add tests for the exact nested controller shape:

```ts
import { describe, expect, test } from "vitest";

import {
  normalizeCameraControllerDeclaration,
  readCameraControllerProgress,
} from "../../../src/lib/renderer/cameraControllerDeclarations";

describe("camera controller declarations", () => {
  test("normalizes progress range and smoothstep easing", () => {
    const declaration = normalizeCameraControllerDeclaration({
      timeline: {
        id: "hero.timeline",
        progressKey: "hero.progress",
        range: { from: 0.25, to: 0.75 },
      },
      to: {
        position: [0, 120, 520],
        target: [0, 48, 0],
        fov: 34,
      },
      easing: "smoothstep",
    });

    expect(declaration).toMatchObject({
      timeline: {
        id: "hero.timeline",
        progressKey: "hero.progress",
        range: { from: 0.25, to: 0.75 },
      },
      easing: "smoothstep",
    });

    expect(readCameraControllerProgress(declaration, { get: () => 0.5 })).toBe(0.5);
    expect(readCameraControllerProgress(declaration, { get: () => 0.25 })).toBe(0);
    expect(readCameraControllerProgress(declaration, { get: () => 0.75 })).toBe(1);
  });

  test("rejects empty target frames", () => {
    expect(() =>
      normalizeCameraControllerDeclaration({
        timeline: "hero.timeline",
        to: {},
      }),
    ).toThrow("WebGL camera controller \"to\" must include position, target, or fov.");
  });
});
```

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/renderer/cameraControllerDeclarations.test.ts
```

Expected: FAIL because the module and types do not exist.

- [x] **Step 2: Add public types**

Add the public declarations from `Public API Direction` to
`packages/dom-webgl-runtime/src/lib/types.ts`, and extend
`WebGLCameraDeclaration` with:

```ts
controller?: WebGLCameraControllerDeclaration;
```

Do not add `registerCameraController(...)` to `WebGLRuntime`.

- [x] **Step 3: Implement normalization helpers**

Create `cameraControllerDeclarations.ts` with pure helpers:

```ts
export function readCameraControllerProgress(
  declaration: NormalizedCameraControllerDeclaration,
  progressSignals: WebGLProgressSignalSource,
): number {
  const raw = clampProgress(progressSignals.get(declaration.timeline.progressKey));
  const range = declaration.timeline.range;

  if (!range) {
    return applyEasing(raw, declaration.easing);
  }

  const span = range.to - range.from;
  const normalized = span <= 0 ? 1 : clampProgress((raw - range.from) / span);
  return applyEasing(normalized, declaration.easing);
}
```

Use existing local patterns from `renderLayerDeclarations.ts` and
`timelineDeclarations.ts`: finite number checks, tuple normalization, and
controlled error messages. If helper reuse would require exporting private
functions broadly, keep local focused helpers in this new file.

- [x] **Step 4: Run focused tests**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/renderer/cameraControllerDeclarations.test.ts
```

Expected: PASS.

### Task 2: Internal Camera Framing Adapter

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/threeRenderer.ts`
- Modify: `packages/dom-webgl-runtime/test/lib/renderer/threeRenderer.test.ts`

- [x] **Step 1: Add failing managed perspective camera tests**

Add tests that create a managed perspective camera through existing test
patterns and assert `position`, `lookAt`, `fov`, and projection update calls are
applied through internal helpers only.

Representative assertions:

```ts
expect(camera.position.set).toHaveBeenLastCalledWith(0, 120, 520);
expect(camera.lookAt).toHaveBeenLastCalledWith(0, 48, 0);
expect(camera.fov).toBe(34);
expect(camera.updateProjectionMatrix).toHaveBeenCalled();
```

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/renderer/threeRenderer.test.ts
```

Expected: FAIL because `ManagedThreeCameraEntry` cannot apply a new frame.

- [x] **Step 2: Extend internal camera entry**

Extend the internal `ManagedThreeCameraEntry` with a method such as:

```ts
applyFraming(
  framing: WebGLCameraControllerFrameDeclaration,
  viewport: DOMViewportSize,
): void;
```

For `perspective` cameras, update `fov`, `position`, `target`, `aspect`, and
projection. For orthographic cameras in Phase 6A, keep the method internal but
diagnose unsupported public controller use during registry validation instead of
silently changing DOM-aligned behavior.

- [x] **Step 3: Run focused tests**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/renderer/threeRenderer.test.ts
```

Expected: PASS.

### Task 3: Render Layer Camera Controller State

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/renderLayerDeclarations.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/renderLayerRegistry.ts`
- Modify: `packages/dom-webgl-runtime/test/lib/renderer/renderLayerDeclarations.test.ts`
- Modify: `packages/dom-webgl-runtime/test/lib/renderer/renderLayerRegistry.test.ts`

- [x] **Step 1: Write failing camera declaration tests**

Add tests proving `normalizeRenderLayerCameraDeclaration(...)` preserves a
normalized nested controller and rejects invalid controller fields.

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/renderer/renderLayerDeclarations.test.ts
```

Expected: FAIL because camera declarations do not accept `controller`.

- [x] **Step 2: Write failing registry tests**

Add tests for:

- registering a camera with a controller;
- updating controller state through progress signals;
- rejecting controller use on the generated default camera;
- rejecting controller use on non-`perspective-stage` cameras;
- resetting camera framing to base declaration after camera unregister;
- preserving one controller per camera by descriptor shape.

Representative test shape:

```ts
registry.registerScene({
  id: "hero.scene",
  projection: "perspective-stage",
});
registry.registerCamera({
  id: "hero.camera",
  sceneId: "hero.scene",
  type: "perspective",
  mode: "perspective-stage",
  default: true,
  position: [0, 0, 700],
  target: [0, 0, 0],
  fov: 44,
  controller: {
    timeline: "hero.timeline",
    to: { position: [0, 120, 520], target: [0, 48, 0], fov: 34 },
  },
});

registry.updateCameraControllers({ get: () => 0.5 });

expect(managedCamera.applyFraming).toHaveBeenLastCalledWith(
  {
    position: [0, 60, 610],
    target: [0, 24, 0],
    fov: 39,
  },
  { width: 800, height: 600 },
);
```

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/renderer/renderLayerRegistry.test.ts
```

Expected: FAIL because registry camera entries do not store or update
controller state.

- [x] **Step 3: Store controller on camera entries**

Extend `NormalizedRenderLayerCameraDeclaration` and
`InternalRenderCameraEntry` with optional normalized controller data and base
framing. Add:

```ts
updateCameraControllers(progressSignals: WebGLProgressSignalSource): boolean;
inspectCameraControllers(): readonly WebGLDebugCameraControllerSummary[];
```

Return `true` when at least one applied controller frame changes compared with
the previous applied frame.

- [x] **Step 4: Keep validation camera-owned**

Validation rules:

- controller is optional;
- controller is rejected for generated cameras;
- controller is rejected unless `camera.type === "perspective"` and
  `camera.mode === "perspective-stage"`;
- controller `to` must include at least one supported frame field;
- missing `from` fields read from base camera declaration/defaults;
- one camera has one controller because the field is singular;
- no pass id is accepted in the public controller declaration.

- [x] **Step 5: Run focused tests**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/renderer/renderLayerDeclarations.test.ts packages/dom-webgl-runtime/test/lib/renderer/renderLayerRegistry.test.ts
```

Expected: PASS.

### Task 4: Runtime Integration And Debug State

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/debug/debugState.ts`
- Modify: `packages/dom-webgl-runtime/test/lib/renderer/runtimePipeline.test.ts`
- Modify: `packages/dom-webgl-runtime/test/lib/debug/debugState.test.ts`

- [x] **Step 1: Write failing runtime pipeline tests**

Add an integration test where a `screen-depth` target is projected through a
managed `perspective-stage` camera that is moved by `WebGLCamera.controller`.
Assert the projection uses the controller-applied camera state in the same sync.

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/renderer/runtimePipeline.test.ts
```

Expected: FAIL because runtime does not update camera controllers.

- [x] **Step 2: Update `syncFrame()` order**

Call controller update after render-layer resize/timeline updates and before
target projection can happen:

```ts
rendererHost.resizeIfNeeded();
renderLayers.resize(rendererHost.getViewportSize());
renderLayers.updateTimelineState(progressSignals);
stageObjects.updateTimelineState(progressSignals);
const cameraControllerChanged =
  renderLayers.updateCameraControllers(progressSignals);
```

If `cameraControllerChanged` is true, mark the sync as a synchronous update so
`runtime.sync()` renders immediately. Progress signal subscriptions already
request frames; no continuous render loop is needed for scroll-scrubbed camera
controllers.

- [x] **Step 3: Add debug summaries**

Extend debug state with descriptor-only data:

```ts
cameraControllers: [
  {
    cameraId: "hero.camera",
    sceneId: "hero.scene",
    timelineId: "hero.timeline",
    progressKey: "hero.timeline",
    progress: 0.5,
    applied: true,
  },
];
```

Do not expose raw camera, matrices, scene, pass, renderer, controls, or internal
adapter objects.

- [x] **Step 4: Run focused runtime/debug tests**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/renderer/runtimePipeline.test.ts packages/dom-webgl-runtime/test/lib/debug/debugState.test.ts
```

Expected: PASS.

### Task 5: React Camera Props And Public Exports

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/react/WebGLCamera.tsx`
- Modify: `packages/dom-webgl-runtime/src/index.ts`
- Modify: `packages/dom-webgl-runtime/test/lib/react/WebGLCamera.test.tsx`
- Modify: `packages/dom-webgl-runtime/test/publicExports.test.ts`

- [x] **Step 1: Write failing React forwarding tests**

Test that `WebGLCamera` forwards `controller` through the existing camera
registration lifecycle and unregisters by id on unmount.

Representative component test:

```tsx
createRoot(container).render(
  createElement(
    WebGLRuntimeProvider,
    { runtime },
    createElement(
      WebGLSceneProvider,
      { sceneId: "hero.scene" },
      createElement(WebGLCamera, {
        id: "hero.camera",
        default: true,
        type: "perspective",
        mode: "perspective-stage",
        position: [0, 0, 700],
        target: [0, 0, 0],
        fov: 44,
        controller: {
          timeline: "hero.timeline",
          to: { position: [0, 120, 520], target: [0, 48, 0], fov: 34 },
        },
      }),
    ),
  ),
);

expect(runtime.registerCamera).toHaveBeenCalledWith({
  id: "hero.camera",
  sceneId: "hero.scene",
  default: true,
  type: "perspective",
  mode: "perspective-stage",
  position: [0, 0, 700],
  target: [0, 0, 0],
  fov: 44,
  controller: {
    timeline: "hero.timeline",
    to: { position: [0, 120, 520], target: [0, 48, 0], fov: 34 },
  },
});
```

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/react/WebGLCamera.test.tsx
```

Expected: FAIL because `WebGLCamera` does not forward `controller`.

- [x] **Step 2: Implement React prop forwarding**

Update `WebGLCamera.tsx` to destructure `controller`, include it in the
registration descriptor, and include it in the effect dependency list. Do not
create a separate controller component.

- [x] **Step 3: Extend public export tests**

Add type checks:

```tsx
const cameraWithControllerProps = {
  id: "hero.camera",
  default: true,
  type: "perspective",
  mode: "perspective-stage",
  controller: {
    timeline: "hero.timeline",
    to: { position: [0, 120, 520], target: [0, 48, 0], fov: 34 },
  },
} satisfies WebGLCameraProps;

cameraWithControllerProps satisfies WebGLCameraProps;

// @ts-expect-error WebGLCamera does not accept top-level timeline behavior.
const cameraTimelineProps = {
  id: "hero.camera",
  timeline: "hero.timeline",
} satisfies WebGLCameraProps;

// @ts-expect-error Camera controllers do not accept pass-bound public scope in v1.
const passBoundControllerProps = {
  id: "hero.camera",
  controller: {
    timeline: "hero.timeline",
    pass: "hero.pass",
    to: { fov: 34 },
  },
} satisfies WebGLCameraProps;

// @ts-expect-error Camera controllers do not accept raw Three camera handles.
const rawControllerProps = {
  id: "raw.controller",
  controller: {
    timeline: "hero.timeline",
    camera: rawCamera,
    to: { fov: 34 },
  },
} satisfies WebGLCameraProps;
```

Also add root type imports for `WebGLCameraControllerDeclaration`,
`WebGLCameraControllerFrameDeclaration`,
`WebGLCameraControllerTimelineDeclaration`, and
`WebGLCameraControllerEasing`.

- [x] **Step 4: Run focused public tests**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/react/WebGLCamera.test.tsx packages/dom-webgl-runtime/test/publicExports.test.ts
```

Expected: PASS.

### Task 6: Example Dogfood

**Files:**
- Modify: `apps/example/src/ManagedTimelineExample.tsx`
- Modify: `apps/example/src/App.tsx` only if navigation/copy references need a
  label change.
- Modify: `apps/example/src/example.css` only if the managed timeline camera
  example needs stable viewport framing.

- [x] **Step 1: Add controller to the managed timeline camera**

Keep the existing scene/target/stage dogfood. Add a `controller` prop to the
existing managed timeline `WebGLCamera` that uses the same named scroll timeline
as the managed scene:

```tsx
<WebGLCamera
  id="example.managedTimeline.camera"
  default
  type="perspective"
  mode="perspective-stage"
  position={exampleManagedTimelineCameraPosition}
  target={exampleManagedTimelineCameraTarget}
  fov={42}
  controller={{
    timeline: {
      id: managedTimelineId,
      range: { from: 0.12, to: 0.88 },
    },
    to: {
      position: [0, 96, 520],
      target: [0, 36, 0],
      fov: 34,
    },
    easing: "smoothstep",
  }}
/>
```

Use existing module-level constants for stable descriptor identity. Do not
animate by rebuilding React props per scroll tick.

- [x] **Step 2: Verify example imports stay public**

Run:

```bash
npm run check:imports
```

Expected: PASS.

### Task 7: Documentation And Roadmap Closeout

**Files:**
- Modify: `README.md`
- Modify: `docs/STATUS.md`
- Modify: `docs/agent/package-onboarding.md`
- Modify: `docs/agent/package-usage.md`
- Modify: `docs/agent/effect-object-boundary.md`
- Modify: `docs/examples/effect-authoring.md`
- Modify: `docs/roadmap/managed-render-system.md`

- [x] **Step 1: Update docs with exact contract**

Docs must state:

- `WebGLTarget` remains the shortest default path.
- `WebGLCamera` accepts a single optional `controller` object for
  progress-driven camera behavior.
- `WebGLCamera` still does not accept a top-level `timeline` prop.
- Camera controllers are managed descriptor data and do not expose raw cameras,
  controls, matrices, projection mutation, passes, or render loops.
- No implicit `ctx.camera` exists in target-local effects.
- v1 supports managed `perspective-stage` camera `position`, `target`, and
  `fov` only.
- Orthographic zoom controllers, screen overlay camera controllers, and complex
  framing-box helpers are deferred possible camera-controller iterations.
- Pointer-driven orbit, pan, drag, pointer parallax, and empty-space camera
  controls remain Phase 8 input-routing work.
- Per-pass camera controller scope is not public in v1; use separate cameras if
  different passes need different camera states.

- [x] **Step 2: Move roadmap status honestly**

During implementation:

- before code edits: `[planned]`;
- once tests/code start: `[in-progress]`;
- after code is written but before docs/verification/commit close: `[implemented]`;
- only after focused tests, docs, and commit are closed: `[verified]`.

Do not mark verified merely because the plan exists.

- [x] **Step 3: Run docs-focused checks**

Run:

```bash
git diff --check
```

Expected: PASS.

## Testing Strategy

Focused tests during implementation:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/renderer/cameraControllerDeclarations.test.ts
npm test -- --run packages/dom-webgl-runtime/test/lib/renderer/renderLayerDeclarations.test.ts
npm test -- --run packages/dom-webgl-runtime/test/lib/renderer/renderLayerRegistry.test.ts
npm test -- --run packages/dom-webgl-runtime/test/lib/renderer/threeRenderer.test.ts
npm test -- --run packages/dom-webgl-runtime/test/lib/renderer/runtimePipeline.test.ts
npm test -- --run packages/dom-webgl-runtime/test/lib/react/WebGLCamera.test.tsx
npm test -- --run packages/dom-webgl-runtime/test/lib/debug/debugState.test.ts
npm test -- --run packages/dom-webgl-runtime/test/publicExports.test.ts
```

Full closeout verification before marking Phase 6A verified:

```bash
npm run test -- --run
npm run typecheck
npm run build
npm run check:imports
git diff --check
```

Browser smoke check if example visuals changed:

```bash
npm run dev -w @project/dom-webgl-example
```

Verify the managed timeline scene camera moves/focuses/framing changes with the
scroll timeline, Level 1 targets still render without any scene/camera/controller
authoring, and no React text or controls overlap in the updated example.

## Exit Criteria

- Phase 6A has a public `WebGLCamera.controller` descriptor available in React
  and vanilla camera declarations.
- Progress-driven camera `position`, `target`, and `fov` work for explicit
  managed `perspective-stage` cameras.
- Controller updates run before `screen-depth` projection and pass rendering.
- Level 1 `WebGLTarget` usage remains unchanged and camera-free.
- Top-level `WebGLCameraDeclaration.timeline` is still rejected.
- No separate public `WebGLCameraController` component or runtime registration
  method exists in v1.
- No pass-bound controller API exists in v1.
- There is no implicit `ctx.camera`.
- Public tests reject raw Three.js camera, controls, matrix, pass, and
  render-loop surfaces.
- Debug state reports descriptor-only camera-controller summaries without raw
  internals.
- Example dogfoods `WebGLCamera.controller` through public imports only.
- Deferred camera work is recorded in roadmap/docs:
  orthographic zoom, screen overlay camera behavior, complex framing boxes, and
  Phase 8 pointer-driven camera controls.
- README, STATUS, package onboarding/usage, effect boundary, tutorial, and
  roadmap are aligned with implementation truth.
- Full closeout verification commands pass before the roadmap phase is marked
  `[verified]`.

## Risks And Mitigations

- Risk: Camera controllers break DOM-first projection by moving the generated
  camera.
  - Mitigation: reject controller use on the generated default camera and keep
    Level 1 camera-free.
- Risk: `screen-depth` targets project from stale camera state.
  - Mitigation: update controllers before target projection in `syncFrame()` and
    cover that ordering in `runtimePipeline.test.ts`.
- Risk: Nesting controller behavior under `WebGLCamera` makes future per-pass
  behavior unclear.
  - Mitigation: explicitly document that v1 camera state is shared by all passes
    using that camera; use separate cameras for different pass states until a
    later pass-bound controller plan proves necessary.
- Risk: React descriptor churn recreates cameras during scroll.
  - Mitigation: docs and example use module-level constants and named progress
    signals; scroll progress flows through `progressSignals`, not React props.
- Risk: API drifts into raw Three.js controls.
  - Mitigation: public export tests reject raw camera/control/matrix/pass/render-loop
    surfaces, and docs state that pointer-driven controls are Phase 8.
- Risk: Orthographic/screen/framing-box support expands scope.
  - Mitigation: Phase 6A v1 supports `perspective-stage` `position`, `target`,
    and `fov`; orthographic zoom, screen overlay camera behavior, and framing
    boxes are recorded as later iterations.

## Handoff Prompt

Use this prompt to implement after approval:

```text
Use docs/superpowers/plans/2026-07-04-managed-camera-controllers.md.
Implement Phase 6A task-by-task. Keep Level 1 WebGLTarget camera-free. Add
WebGLCamera.controller support for progress-driven perspective-stage camera
position/target/fov. Do not add a separate WebGLCameraController component,
runtime.registerCameraController, top-level WebGLCamera.timeline, implicit
ctx.camera, pass-bound controller scope, raw Three.js camera/control/matrix/pass
or render-loop access, orthographic/screen camera controllers, framing boxes, or
pointer-driven camera controls. Record deferred camera work in active docs and
keep Phase 8 responsible for orbit/pan/drag/pointer parallax.
```
