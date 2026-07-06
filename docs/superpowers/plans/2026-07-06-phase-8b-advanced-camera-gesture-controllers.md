# Phase 8B Advanced Camera Gesture Controllers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the existing Phase 8 managed camera pointer controller into drag-based orbit, pan, dolly, camera pointer parallax, damping, and reset behavior while preserving object-vs-camera input priority and raw Three.js encapsulation.

**Architecture:** Keep `WebGLCamera.controller` as the single camera-owned API surface and keep Level 1 `WebGLTarget` free of scene/camera/pass requirements. Add pointer button/modifier state for drag gesture matching, normalize richer camera gesture descriptors in the existing camera controller declaration path, and move gesture math into a small renderer module that outputs managed camera frames. Runtime input routing remains ordered as object hit/capture first, then camera empty-space drag gestures, then passive pointer/progress effects.

**Tech Stack:** TypeScript, React descriptor components, runtime-owned Three.js camera adapters, existing interaction router and render-layer registry, Vitest/jsdom with dependency injection, `apps/example` browser dogfood, npm workspaces.

---

## Context Verified For This Plan

- `docs/roadmap/managed-render-system.md` `Roadmap Status` selects `Phase 8B: Advanced Camera Gesture Controllers` as the first `[not-started]` phase.
- The Phase 8B roadmap row and section both had `Focused Plan: none` before this file.
- `docs/STATUS.md` says Phase 8 is verified and Phase 8B is a planned roadmap slot, not a focused implementation plan yet.
- `git status --short` was clean before plan creation.
- CodeGraph source truth:
  - `WebGLCamera.controller.pointer` currently supports only `{ kind: "orbit", activation: "empty-space-drag", target, sensitivity, minPolarAngle, maxPolarAngle }`.
  - `createPointerController(...)` currently listens to `pointermove`, `pointerdown`, and `pointerup`; this plan keeps Phase 8B v1 drag-based and does not add wheel or pinch capture.
  - `WebGLPointerState` currently stores pointer coordinates, down/drag state, click count, and drag deltas; it does not store button/modifier state for gesture matching.
  - `syncFrame()` updates timeline camera controllers, then scene-object interaction, then camera pointer controllers with `blocked: isCameraPointerBlocked(...)`.
  - Camera pointer controllers are currently applied in `renderLayerRegistry.updateCameraPointerControllers(...)`; object hits, pressed objects, and captured objects block camera activation.
  - `interactionRouter.test.ts` covers pass viewport gating, object capture, click release, and empty-space reporting.
  - `renderLayerRegistry.test.ts` covers timeline camera controllers, pointer orbit layered after timeline framing, resize reapplication, and rejection outside managed `perspective-stage` cameras.
  - `WebGLCamera` React component forwards the `controller` descriptor directly to `runtime.registerCamera(...)`.
  - `apps/example/src/ManagedInteractionExample.tsx` dogfoods object picking plus minimal empty-space orbit drag through public React descriptors.
- No implementation code was changed while creating this plan.

## Scope

Implement Phase 8B as a focused managed camera gesture layer:

- Preserve the existing `controller.pointer` orbit shorthand for compatibility.
- Add a richer descriptor form under `WebGLCamera.controller.pointer` for:
  - empty-space orbit drag;
  - empty-space pan drag;
  - empty-space dolly drag;
  - camera-scoped pointer parallax;
  - kinematic damping;
  - double-click reset to the controller base frame.
- Keep gesture activation camera-owned and scene-scoped through the camera's managed scene and the render passes that draw that scene.
- Gate camera gestures by the same Phase 8 object priority: active object hit, press, drag, or capture blocks camera pan/orbit/dolly/parallax.
- Add pointer button and modifier state to support drag gesture matching without changing DOM-target pointer declarations.
- Keep camera gesture math inside runtime-owned modules that output `position`, `target`, and `fov` frames for managed `perspective-stage` cameras.
- Add descriptor-only debug state for active gesture type, controlled camera id, scene id, and damping activity.
- Extend `ManagedInteractionExample` as the dogfood surface instead of creating a disconnected example.
- Update package docs and roadmap status after implementation verifies.

## Non-Goals

- Do not require scenes, cameras, passes, or camera controllers for Level 1 `WebGLTarget` usage.
- Do not expose raw `OrbitControls`, `PointerLockControls`, `THREE.Camera`, matrices, renderer, scene, raycaster, intersections, render targets, composer passes, or render-loop hooks.
- Do not add imperative camera refs or consumer-owned event listeners.
- Do not add pass-bound camera controller descriptors in this phase; pass viewports are used only to decide whether the pointer is inside a pass that renders the camera's scene.
- Do not add orthographic/screen camera gesture controllers in this phase.
- Do not add mouse wheel zoom or touch pinch zoom in Phase 8B v1. Wheel remains page-scroll-owned by default, and pinch/touch zoom needs a separate mobile gesture ownership decision.
- Do not add physics, collision-aware camera movement, constraints, forces, body dragging, spring simulation, or inertia. Damping here is kinematic smoothing only.
- Do not move pointer parallax to a scene layer. Phase 8B v1 uses explicit `scope: "camera"` so the motion owner is unambiguous.
- Do not change scene-object picking, object effects, `ctx.targetPointer`, DOM pointer declarations, or DOM fallback behavior.
- Do not add gesture callbacks as the public model. Declarations and managed state remain the public contract.

## API And Architecture Principles

- DOM-first: `WebGLTarget` remains the shortest documented path.
- React mental model: `WebGLCamera` owns one stable `controller` descriptor; component nesting continues to express scene ownership.
- Agent-first naming: public fields use clear gesture names (`orbit`, `pan`, `dolly`, `parallax`, `damping`, `reset`) and scope names (`camera`, `empty-space`).
- Three-like behavior: orbit rotates around `target`, pan moves camera and target in the camera plane, dolly changes camera-target distance, and FOV remains descriptor-controlled unless timeline framing already controls it.
- Runtime ownership: descriptors calculate managed camera frames; only internal camera adapters mutate raw Three.js cameras.
- Explicit data flow: browser pointer input -> `WebGLFrameInput.pointer` button/modifier/drag state -> interaction router priority -> camera gesture controller -> internal camera frame -> target projection and pass rendering.
- Narrow v1: camera gesture scope is camera + scene + active pass viewport gating, not a generalized control graph.

## Public API Direction

Keep the existing shorthand valid:

```ts
const existingOrbitController = {
  pointer: {
    kind: "orbit",
    activation: "empty-space-drag",
    target: [0, 0, 0],
    sensitivity: [0.004, 0.004],
    minPolarAngle: 0.1,
    maxPolarAngle: Math.PI - 0.1,
  },
} satisfies WebGLCameraControllerDeclaration;
```

Add a richer descriptor form:

```ts
export type WebGLCameraGestureButton = "primary" | "middle" | "secondary";
export type WebGLCameraGestureModifier = "shift" | "alt" | "ctrl" | "meta";

export type WebGLCameraGestureDragDeclaration = {
  readonly button?: WebGLCameraGestureButton;
  readonly modifier?: WebGLCameraGestureModifier;
};

export type WebGLCameraOrbitGestureDeclaration = {
  readonly drag?: WebGLCameraGestureDragDeclaration;
  readonly target?: WebGLTuple3;
  readonly sensitivity?: WebGLTuple2;
  readonly minPolarAngle?: number;
  readonly maxPolarAngle?: number;
  readonly minDistance?: number;
  readonly maxDistance?: number;
};

export type WebGLCameraPanGestureDeclaration = {
  readonly drag?: WebGLCameraGestureDragDeclaration;
  readonly sensitivity?: WebGLTuple2;
};

export type WebGLCameraDollyGestureDeclaration = {
  readonly drag?: WebGLCameraGestureDragDeclaration;
  readonly sensitivity?: number;
  readonly minDistance?: number;
  readonly maxDistance?: number;
};

export type WebGLCameraPointerParallaxDeclaration = {
  readonly scope: "camera";
  readonly strength?: WebGLTuple2;
  readonly maxOffset?: WebGLTuple2;
};

export type WebGLCameraGestureDampingDeclaration =
  | boolean
  | {
      readonly factor?: number;
      readonly settleEpsilon?: number;
    };

export type WebGLCameraGestureResetDeclaration = {
  readonly onDoubleClick?: boolean;
  readonly durationMs?: number;
};

export type WebGLCameraGesturePointerControllerDeclaration = {
  readonly activation?: "empty-space";
  readonly orbit?: boolean | WebGLCameraOrbitGestureDeclaration;
  readonly pan?: boolean | WebGLCameraPanGestureDeclaration;
  readonly dolly?: boolean | WebGLCameraDollyGestureDeclaration;
  readonly parallax?: WebGLCameraPointerParallaxDeclaration;
  readonly damping?: WebGLCameraGestureDampingDeclaration;
  readonly reset?: WebGLCameraGestureResetDeclaration;
};

export type WebGLCameraPointerControllerDeclaration =
  | WebGLCameraOrbitPointerControllerDeclaration
  | WebGLCameraGesturePointerControllerDeclaration;
```

Example dogfood target:

```tsx
const cameraController = {
  pointer: {
    orbit: {
      drag: { button: "primary" },
      target: [120, -78, -70],
      sensitivity: [0.0035, 0.003],
      minPolarAngle: 0.52,
      maxPolarAngle: 1.42,
      minDistance: 240,
      maxDistance: 980,
    },
    pan: {
      drag: { button: "secondary" },
      sensitivity: [0.9, 0.9],
    },
    dolly: {
      drag: { button: "primary", modifier: "alt" },
      sensitivity: 1.4,
      minDistance: 240,
      maxDistance: 980,
    },
    parallax: {
      scope: "camera",
      strength: [16, 8],
      maxOffset: [28, 16],
    },
    damping: { factor: 0.18, settleEpsilon: 0.001 },
    reset: { onDoubleClick: true, durationMs: 220 },
  },
} satisfies NonNullable<WebGLCameraProps["controller"]>;
```

Default behavior:

- Existing shorthand remains exactly an empty-space primary-drag orbit controller.
- Rich `pointer` object defaults `activation` to `"empty-space"`.
- `orbit: true` defaults to primary drag around the current camera target.
- `pan: true` defaults to secondary drag.
- `dolly: true` defaults to primary + alt drag.
- `damping` defaults to `false`.
- `reset` defaults to disabled.
- `parallax.scope` is required and only `"camera"` is valid in Phase 8B v1.

## File Structure

- Modify `packages/dom-webgl-runtime/src/lib/types.ts`
  - Public gesture descriptor types.
  - Pointer button/modifier state.
  - `WebGLDebugInteractionSummary.cameraController` fields.
- Modify `packages/dom-webgl-runtime/src/lib/input/pointerController.ts`
  - Add pointer button/modifier state.
- Modify `packages/dom-webgl-runtime/src/lib/input/frameInput.ts`
  - Clone pointer button/modifier state with the rest of `WebGLFrameInput`.
- Modify `packages/dom-webgl-runtime/src/lib/renderer/cameraControllerDeclarations.ts`
  - Normalize legacy orbit shorthand and rich gesture declarations into one internal shape.
  - Validate finite/clamped distances, damping, reset, button/modifier, and parallax scope.
- Create `packages/dom-webgl-runtime/src/lib/renderer/cameraGestureController.ts`
  - Pure camera gesture math and state update helpers.
  - No DOM, React, or Three imports.
- Modify `packages/dom-webgl-runtime/src/lib/renderer/renderLayerRegistry.ts`
  - Replace narrow pointer-orbit update path with managed gesture update path.
  - Keep timeline controller layering and camera resize reset behavior.
  - Store per-camera gesture state and debug summary.
- Modify `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`
  - Pass active managed pass/camera scope and object-block state into camera gesture updates.
  - Request continuous rendering while damping is settling or a gesture is active.
- Modify `packages/dom-webgl-runtime/src/lib/react/WebGLCamera.tsx`
  - No new component; only type compatibility through existing `controller` prop.
- Modify `packages/dom-webgl-runtime/test/lib/input/frameInput.test.ts`
  - Frame cloning tests for pointer button/modifier state.
- Modify or create `packages/dom-webgl-runtime/test/lib/input/pointerController.test.ts`
  - Pointer button/modifier state tests.
- Modify `packages/dom-webgl-runtime/test/lib/renderer/cameraControllerDeclarations.test.ts`
  - Descriptor normalization and validation tests.
- Create `packages/dom-webgl-runtime/test/lib/renderer/cameraGestureController.test.ts`
  - Pure math tests for orbit, pan, dolly, parallax, damping, and reset.
- Modify `packages/dom-webgl-runtime/test/lib/renderer/renderLayerRegistry.test.ts`
  - Integration tests for priority, pass viewport gating, timeline layering, and debug summary.
- Modify `packages/dom-webgl-runtime/test/publicExports.test.ts`
  - Type acceptance and rejection for public gesture descriptors and raw-control exclusions.
- Modify `apps/example/src/ManagedInteractionExample.tsx`
  - Dogfood rich camera gestures through public React descriptors.
- Modify `docs/agent/package-onboarding.md`, `docs/agent/package-usage.md`, `docs/STATUS.md`, and `docs/roadmap/managed-render-system.md`
  - Document public scope, caveats, verification status, and next phase boundary.

## Implementation Tasks

### Task 1: Public Types And Declaration Normalization

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/types.ts:240-340`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/cameraControllerDeclarations.ts:1-199`
- Test: `packages/dom-webgl-runtime/test/lib/renderer/cameraControllerDeclarations.test.ts`

- [ ] **Step 1: Write failing normalization tests**

Add tests that assert both legacy and rich descriptors normalize into a single internal shape:

```ts
test("normalizes legacy orbit pointer controller shorthand", () => {
  expect(
    normalizeCameraControllerDeclaration({
      pointer: {
        kind: "orbit",
        activation: "empty-space-drag",
        target: [1, 2, 3],
      },
    }).pointer,
  ).toEqual({
    activation: "empty-space",
    orbit: {
      drag: { button: "primary" },
      target: [1, 2, 3],
      sensitivity: [0.004, 0.004],
    },
  });
});

test("normalizes rich camera gesture descriptors", () => {
  expect(
    normalizeCameraControllerDeclaration({
      pointer: {
        orbit: { target: [0, 0, 0], minDistance: 240, maxDistance: 980 },
        pan: true,
        dolly: { drag: { button: "primary", modifier: "alt" } },
        parallax: { scope: "camera", strength: [16, 8] },
        damping: { factor: 0.18 },
        reset: { onDoubleClick: true, durationMs: 220 },
      },
    }).pointer,
  ).toMatchObject({
    activation: "empty-space",
    orbit: { minDistance: 240, maxDistance: 980 },
    pan: { drag: { button: "secondary" } },
    dolly: { drag: { button: "primary", modifier: "alt" } },
    parallax: { scope: "camera", strength: [16, 8] },
    damping: { factor: 0.18, settleEpsilon: 0.001 },
    reset: { onDoubleClick: true, durationMs: 220 },
  });
});

test("rejects invalid camera gesture distance ranges", () => {
  expect(() =>
    normalizeCameraControllerDeclaration({
      pointer: {
        orbit: { minDistance: 600, maxDistance: 200 },
      },
    }),
  ).toThrow("WebGL camera orbit gesture minDistance must be <= maxDistance.");
});
```

- [ ] **Step 2: Run the focused failing test**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/renderer/cameraControllerDeclarations.test.ts
```

Expected: FAIL because the rich descriptor types and normalization do not exist yet.

- [ ] **Step 3: Add public descriptor types**

Modify `packages/dom-webgl-runtime/src/lib/types.ts` with the public type direction from this plan. Keep the existing shorthand type as:

```ts
export type WebGLCameraOrbitPointerControllerDeclaration = {
  readonly kind: "orbit";
  readonly activation: "empty-space-drag";
  readonly target?: WebGLTuple3;
  readonly sensitivity?: WebGLTuple2;
  readonly minPolarAngle?: number;
  readonly maxPolarAngle?: number;
};
```

Then define `WebGLCameraPointerControllerDeclaration` as the union of shorthand and rich gesture descriptors.

- [ ] **Step 4: Normalize rich descriptors**

In `cameraControllerDeclarations.ts`, replace `NormalizedCameraPointerControllerDeclaration` with:

```ts
export type NormalizedCameraPointerControllerDeclaration = {
  readonly activation: "empty-space";
  readonly orbit?: NormalizedCameraOrbitGestureDeclaration;
  readonly pan?: NormalizedCameraPanGestureDeclaration;
  readonly dolly?: NormalizedCameraDollyGestureDeclaration;
  readonly parallax?: NormalizedCameraPointerParallaxDeclaration;
  readonly damping?: NormalizedCameraGestureDampingDeclaration;
  readonly reset?: NormalizedCameraGestureResetDeclaration;
};
```

Implement `normalizePointerController(...)` so `"kind" in declaration` maps the legacy shorthand to `{ activation: "empty-space", orbit: ... }`, otherwise each named gesture is normalized independently.

- [ ] **Step 5: Run normalization tests**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/renderer/cameraControllerDeclarations.test.ts
```

Expected: PASS.

### Task 2: Drag Button And Modifier Input

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/types.ts:540-593`
- Modify: `packages/dom-webgl-runtime/src/lib/input/pointerController.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/input/frameInput.ts`
- Test: `packages/dom-webgl-runtime/test/lib/input/pointerController.test.ts`
- Test: `packages/dom-webgl-runtime/test/lib/input/frameInput.test.ts`

- [ ] **Step 1: Write failing input tests**

Add tests for pointer button and modifier state:

```ts
test("captures pointer button and modifier state for camera gestures", () => {
  const element = createElementWithRect();
  const events = createEventTarget();
  const controller = createPointerController({
    coordinateElement: element,
    eventTarget: events,
  });

  events.dispatch(
    new PointerEvent("pointerdown", {
      button: 2,
      buttons: 2,
      altKey: true,
      clientX: 40,
      clientY: 50,
    }),
  );

  expect(controller.getState()).toMatchObject({
    button: "secondary",
    buttons: ["secondary"],
    modifiers: { alt: true, shift: false, ctrl: false, meta: false },
  });
});

test("clones pointer button state through frame input", () => {
  const pointerController = createPointerControllerStub({
    button: "primary",
    buttons: ["primary"],
    modifiers: { alt: true, shift: false, ctrl: false, meta: false },
  });
  const source = createFrameInputSource(createScrollState(), pointerController, () => 100);

  expect(source.update().pointer).toMatchObject({
    button: "primary",
    buttons: ["primary"],
    modifiers: { alt: true, shift: false, ctrl: false, meta: false },
  });
});
```

The helper can use the existing event-target and frame-input test patterns in package tests.

- [ ] **Step 2: Run failing input tests**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/input/pointerController.test.ts packages/dom-webgl-runtime/test/lib/input/frameInput.test.ts
```

Expected: FAIL because `WebGLPointerState.button`, `buttons`, and `modifiers` do not exist yet.

- [ ] **Step 3: Add pointer gesture-matching state**

Add to `WebGLPointerState`:

```ts
export type WebGLPointerButton = "primary" | "middle" | "secondary";

export type WebGLPointerModifiers = {
  readonly shift: boolean;
  readonly alt: boolean;
  readonly ctrl: boolean;
  readonly meta: boolean;
};

export type WebGLPointerState = {
  // existing fields...
  readonly button?: WebGLPointerButton;
  readonly buttons: readonly WebGLPointerButton[];
  readonly modifiers: WebGLPointerModifiers;
};
```

- [ ] **Step 4: Extend pointer controller**

Map DOM pointer buttons:

```ts
function normalizePointerButton(button: number): WebGLPointerButton | undefined {
  switch (button) {
    case 0:
      return "primary";
    case 1:
      return "middle";
    case 2:
      return "secondary";
  }
}
```

Read `shiftKey`, `altKey`, `ctrlKey`, and `metaKey` from each pointer event.

- [ ] **Step 5: Include state in frame input cloning**

Modify `cloneFrameInput(...)` so `pointer.buttons` and `pointer.modifiers` are cloned instead of shared by reference.

- [ ] **Step 6: Run input tests**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/input/pointerController.test.ts packages/dom-webgl-runtime/test/lib/input/frameInput.test.ts
```

Expected: PASS.

### Task 3: Pure Camera Gesture Math

**Files:**
- Create: `packages/dom-webgl-runtime/src/lib/renderer/cameraGestureController.ts`
- Test: `packages/dom-webgl-runtime/test/lib/renderer/cameraGestureController.test.ts`

- [ ] **Step 1: Write failing pure math tests**

Cover orbit, pan, dolly, parallax, damping, and reset:

```ts
test("pans camera and target together in camera plane", () => {
  const result = updateCameraGestureFrame({
    baseFrame: { position: [0, 0, 500], target: [0, 0, 0], fov: 42 },
    state: createInitialCameraGestureState(),
    pointer: { pan: { drag: { button: "secondary" }, sensitivity: [1, 1] } },
    frameInput: createGestureFrameInput({
      pointer: { isDown: true, isDragging: true, dragDeltaX: 20, dragDeltaY: -10, button: "secondary" },
    }),
  });

  expect(result.frame.position).toEqual([-20, -10, 500]);
  expect(result.frame.target).toEqual([-20, -10, 0]);
  expect(result.activeGesture).toBe("pan");
});

test("dollies camera distance with alt primary drag", () => {
  const result = updateCameraGestureFrame({
    baseFrame: { position: [0, 0, 500], target: [0, 0, 0], fov: 42 },
    state: createInitialCameraGestureState(),
    pointer: {
      dolly: {
        drag: { button: "primary", modifier: "alt" },
        sensitivity: 2,
        minDistance: 300,
        maxDistance: 700,
      },
    },
    frameInput: createGestureFrameInput({
      pointer: {
        isDown: true,
        isDragging: true,
        button: "primary",
        modifiers: { alt: true, shift: false, ctrl: false, meta: false },
        dragDeltaY: -120,
      },
    }),
  });

  expect(result.frame.position).toEqual([0, 0, 300]);
  expect(result.activeGesture).toBe("dolly");
});

test("continues rendering while damping is settling", () => {
  const result = updateCameraGestureFrame({
    baseFrame: { position: [0, 0, 500], target: [0, 0, 0], fov: 42 },
    state: createInitialCameraGestureState({
      appliedFrame: { position: [0, 0, 600], target: [0, 0, 0], fov: 42 },
    }),
    pointer: { damping: { factor: 0.2, settleEpsilon: 0.001 } },
    frameInput: createGestureFrameInput({ delta: 16 }),
  });

  expect(result.requiresContinuousRendering).toBe(true);
  expect(result.frame.position?.[2]).toBeGreaterThan(500);
  expect(result.frame.position?.[2]).toBeLessThan(600);
});
```

- [ ] **Step 2: Run failing gesture math test**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/renderer/cameraGestureController.test.ts
```

Expected: FAIL because the new module does not exist.

- [ ] **Step 3: Implement pure helpers**

Create:

```ts
export type CameraGestureUpdateInput = {
  readonly baseFrame: NormalizedCameraControllerFrameDeclaration;
  readonly state: CameraGestureControllerState;
  readonly pointer: NormalizedCameraPointerControllerDeclaration;
  readonly frameInput: WebGLFrameInput;
};

export type CameraGestureUpdateResult = {
  readonly frame: NormalizedCameraControllerFrameDeclaration;
  readonly state: CameraGestureControllerState;
  readonly changed: boolean;
  readonly requiresContinuousRendering: boolean;
  readonly activeGesture?: "orbit" | "pan" | "dolly" | "parallax" | "reset" | "damping";
};
```

Keep all math pure and tuple-based. Do not import Three.js.

- [ ] **Step 4: Run pure gesture tests**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/renderer/cameraGestureController.test.ts
```

Expected: PASS.

### Task 4: Render-Layer And Runtime Integration

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/renderLayerRegistry.ts:95-116`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/renderLayerRegistry.ts:413-501`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts:849-867`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts:1348-1394`
- Test: `packages/dom-webgl-runtime/test/lib/renderer/renderLayerRegistry.test.ts`
- Test: `packages/dom-webgl-runtime/test/lib/renderer/runtimePipeline.test.ts`

- [ ] **Step 1: Write failing integration tests**

Add render-layer tests:

```ts
test("blocks camera gestures while an object owns pointer capture", () => {
  const managedCamera = createManagedCameraStub();
  const registry = createPerspectiveStageRegistry(managedCamera);

  registry.registerCamera({
    id: "world.camera",
    sceneId: "world",
    type: "perspective",
    mode: "perspective-stage",
    position: [0, 0, 500],
    target: [0, 0, 0],
    controller: { pointer: { pan: true, dolly: true } },
  });

  const result = registry.updateCameraGestureControllers({
    frameInput: createFrameInput({
      pointer: { isDown: true, isDragging: true, button: "secondary", dragDeltaX: 30 },
    }),
    blocked: true,
    passes: [{ id: "world.pass", sceneId: "world", cameraId: "world.camera", order: 1 }],
  });

  expect(result.changed).toBe(false);
  expect(managedCamera.applyFraming).not.toHaveBeenCalledWith(
    expect.objectContaining({ position: expect.any(Array) }),
    expect.anything(),
  );
});

test("activates drag gestures only inside a pass for the camera scene", () => {
  const managedCamera = createManagedCameraStub();
  const registry = createPerspectiveStageRegistry(managedCamera);

  registry.registerCamera({
    id: "world.camera",
    sceneId: "world",
    type: "perspective",
    mode: "perspective-stage",
    position: [0, 0, 500],
    target: [0, 0, 0],
    controller: { pointer: { pan: true } },
  });

  const result = registry.updateCameraGestureControllers({
    frameInput: createFrameInput({
      pointer: {
        x: 32,
        y: 32,
        isInside: true,
        isDown: true,
        isDragging: true,
        button: "secondary",
        dragDeltaX: 24,
      },
    }),
    blocked: false,
    passes: [
      {
        id: "world.pass",
        sceneId: "world",
        cameraId: "world.camera",
        order: 1,
        viewport: { x: 0, y: 0, width: 200, height: 200 },
      },
    ],
  });

  expect(result.summary).toMatchObject({
    cameraId: "world.camera",
    sceneId: "world",
    activeGesture: "pan",
  });
});
```

- [ ] **Step 2: Run failing integration tests**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/renderer/renderLayerRegistry.test.ts packages/dom-webgl-runtime/test/lib/renderer/runtimePipeline.test.ts
```

Expected: FAIL because `updateCameraGestureControllers(...)` and pass camera ids do not exist.

- [ ] **Step 3: Replace narrow pointer update method**

Rename registry method from `updateCameraPointerControllers(...)` to `updateCameraGestureControllers(...)` and pass:

```ts
type ManagedCameraGesturePass = {
  readonly id: string;
  readonly sceneId: string;
  readonly cameraId: string;
  readonly order: number;
  readonly viewport?: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
};
```

Use ordered pass viewport gating so gestures apply only when the pointer is in a pass that renders the camera's scene and camera.

- [ ] **Step 4: Preserve controller layering**

Keep the existing sequence:

```text
timeline frame -> gesture base frame -> gesture target frame -> damping frame -> internal applyFraming
```

If a timeline controller updates in the same frame, use its applied frame as the gesture base.

- [ ] **Step 5: Update runtime sync**

In `syncFrame()`:

```ts
const interactionResult = updateSceneObjectInteractions(frameInput);
const cameraGestureUpdate = renderLayers.updateCameraGestureControllers({
  frameInput,
  blocked: isCameraPointerBlocked(interactionResult.debug),
  passes: readManagedCameraGesturePasses(),
});
```

Set continuous rendering when `cameraGestureUpdate.summary?.active === true` or `cameraGestureUpdate.requiresContinuousRendering === true`.

- [ ] **Step 6: Run integration tests**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/renderer/renderLayerRegistry.test.ts packages/dom-webgl-runtime/test/lib/renderer/runtimePipeline.test.ts
```

Expected: PASS.

### Task 5: Public Type Boundary And Debug State

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/types.ts:700-760`
- Modify: `packages/dom-webgl-runtime/src/lib/debug/debugState.ts`
- Modify: `packages/dom-webgl-runtime/test/publicExports.test.ts`
- Modify: `packages/dom-webgl-runtime/test/lib/debug/debugState.test.ts`

- [ ] **Step 1: Write failing public type tests**

Add fixture coverage:

```tsx
<WebGLCamera
  id="stage.camera"
  default
  type="perspective"
  mode="perspective-stage"
  controller={{
    pointer: {
      orbit: { target: [0, 0, 0], minDistance: 240, maxDistance: 980 },
      pan: true,
      dolly: { drag: { button: "primary", modifier: "alt" } },
      parallax: { scope: "camera", strength: [16, 8] },
      damping: { factor: 0.18 },
      reset: { onDoubleClick: true },
    },
  }}
/>
```

Also add a rejecting fixture:

```ts
const invalidParallax = {
  pointer: {
    // @ts-expect-error Scene-layer parallax is not a Phase 8B v1 public scope.
    parallax: { scope: "scene-layer" },
  },
} satisfies WebGLCameraProps["controller"];
```

- [ ] **Step 2: Run public export test**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/publicExports.test.ts
```

Expected: FAIL before implementation, PASS after type wiring.

- [ ] **Step 3: Extend debug summary**

Add descriptor-only debug fields:

```ts
cameraController?: {
  readonly cameraId: string;
  readonly sceneId: string;
  readonly active: boolean;
  readonly activeGesture?: "orbit" | "pan" | "dolly" | "parallax" | "reset" | "damping";
  readonly damping: boolean;
};
```

Do not add raw camera, controls, matrix, pass, raycaster, or event objects.

- [ ] **Step 4: Run debug tests**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/debug/debugState.test.ts packages/dom-webgl-runtime/test/publicExports.test.ts
```

Expected: PASS.

### Task 6: Example Dogfood

**Files:**
- Modify: `apps/example/src/ManagedInteractionExample.tsx`
- Modify: `apps/example/src/App.css`
- Test: `apps/example/test/publicImportBoundaries.test.ts` if present
- Test: `scripts/assert-example-public-imports.mjs`

- [ ] **Step 1: Extend the existing interaction example**

Change only public React descriptor data:

```tsx
const cameraController = {
  pointer: {
    orbit: {
      drag: { button: "primary" },
      target: [120, -78, -70],
      sensitivity: [0.0035, 0.003],
      minPolarAngle: 0.52,
      maxPolarAngle: 1.42,
      minDistance: 240,
      maxDistance: 980,
    },
    pan: {
      drag: { button: "secondary" },
      sensitivity: [0.9, 0.9],
    },
    dolly: {
      drag: { button: "primary", modifier: "alt" },
      sensitivity: 1.4,
      minDistance: 240,
      maxDistance: 980,
    },
    parallax: {
      scope: "camera",
      strength: [16, 8],
      maxOffset: [28, 16],
    },
    damping: { factor: 0.18, settleEpsilon: 0.001 },
    reset: { onDoubleClick: true, durationMs: 220 },
  },
} satisfies NonNullable<WebGLCameraProps["controller"]>;
```

- [ ] **Step 2: Keep example imports public**

Run:

```bash
npm run check:imports
```

Expected: PASS.

- [ ] **Step 3: Browser dogfood**

Run:

```bash
npm run dev -w @project/dom-webgl-example
```

Browser checks:

- Primary empty-space drag orbits the managed interaction camera.
- Secondary empty-space drag pans the camera.
- Alt + primary empty-space drag dollies.
- Hovering/dragging the model or floor blocks camera gestures.
- Double-click empty space resets camera framing.
- Level 1 DOM target rows still render and respond as before.

Follow-up correction:

- The current `ManagedInteractionExample` is no longer the Phase 8B rich gesture
  dogfood. It is intentionally floor-only for Phase 8 picking/coordinate drift:
  one pickable floor, hover/click feedback, and minimal primary-drag orbit.
- Future Phase 8B browser QA should use a separate rich gesture surface or
  temporarily expanded test route rather than adding pan, dolly, parallax,
  damping, reset, scene-native models, or screen-plane targets back to the
  Phase 8 floor-only dogfood.

### Task 7: Documentation Sync

**Files:**
- Modify: `docs/agent/package-onboarding.md`
- Modify: `docs/agent/package-usage.md`
- Modify: `docs/STATUS.md`
- Modify: `docs/roadmap/managed-render-system.md`
- Modify: `README.md` if it contains camera interaction examples

- [ ] **Step 1: Update package docs**

Document:

- `WebGLCamera.controller.pointer` legacy shorthand remains valid.
- Rich gesture descriptors are managed camera API, not target effects.
- Wheel zoom and pinch zoom are deferred out of Phase 8B v1 because wheel remains page-scroll-owned by default and pinch needs a separate mobile gesture ownership decision.
- Object interaction priority blocks camera gestures.
- `parallax.scope` is `"camera"` in Phase 8B v1.
- Damping is kinematic smoothing, not physics.

- [ ] **Step 2: Update status and roadmap**

After implementation verification:

- Set Phase 8B roadmap row to `[verified]`.
- Keep Phase 9 `[not-started]`.
- Update `docs/STATUS.md` implemented surface and caveats.
- Record that physics/inertia remains Phase 9.

- [ ] **Step 3: Run docs sanity checks**

Run:

```bash
rg -n "OrbitControls|PointerLockControls|THREE\\.Camera|raw camera|scene-layer" README.md docs packages/dom-webgl-runtime/src
```

Expected:

- Any `OrbitControls` or `PointerLockControls` hit is a negative guard or non-goal.
- No public docs imply raw camera access.
- `scene-layer` appears only as an explicit non-goal or rejected type example.

### Task 8: Verification And Closeout

**Files:**
- Verify all changed files from Tasks 1-7.

- [ ] **Step 1: Run focused tests**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/renderer/cameraControllerDeclarations.test.ts
npm test -- --run packages/dom-webgl-runtime/test/lib/input/pointerController.test.ts packages/dom-webgl-runtime/test/lib/input/frameInput.test.ts
npm test -- --run packages/dom-webgl-runtime/test/lib/renderer/cameraGestureController.test.ts
npm test -- --run packages/dom-webgl-runtime/test/lib/renderer/renderLayerRegistry.test.ts packages/dom-webgl-runtime/test/lib/renderer/runtimePipeline.test.ts
npm test -- --run packages/dom-webgl-runtime/test/lib/debug/debugState.test.ts packages/dom-webgl-runtime/test/publicExports.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run package validation**

Run:

```bash
npm run typecheck -w @project/dom-webgl-runtime
npm run check:imports
git diff --check
```

Expected: PASS.

- [ ] **Step 3: Run full repo validation before declaring verified**

Run:

```bash
npm run test -- --run && npm run typecheck && npm run build && npm run check:imports && git diff --check
```

Expected: PASS.

- [ ] **Step 4: Commit only after execution scope includes commit**

If the implementation request includes committing, run:

```bash
git status --short
git add packages/dom-webgl-runtime/src/lib/types.ts \
  packages/dom-webgl-runtime/src/lib/input/pointerController.ts \
  packages/dom-webgl-runtime/src/lib/input/frameInput.ts \
  packages/dom-webgl-runtime/src/lib/renderer/cameraControllerDeclarations.ts \
  packages/dom-webgl-runtime/src/lib/renderer/cameraGestureController.ts \
  packages/dom-webgl-runtime/src/lib/renderer/renderLayerRegistry.ts \
  packages/dom-webgl-runtime/src/lib/renderer/runtime.ts \
  packages/dom-webgl-runtime/test/lib/input/pointerController.test.ts \
  packages/dom-webgl-runtime/test/lib/input/frameInput.test.ts \
  packages/dom-webgl-runtime/test/lib/renderer/cameraControllerDeclarations.test.ts \
  packages/dom-webgl-runtime/test/lib/renderer/cameraGestureController.test.ts \
  packages/dom-webgl-runtime/test/lib/renderer/renderLayerRegistry.test.ts \
  packages/dom-webgl-runtime/test/lib/renderer/runtimePipeline.test.ts \
  packages/dom-webgl-runtime/test/lib/debug/debugState.test.ts \
  packages/dom-webgl-runtime/test/publicExports.test.ts \
  apps/example/src/ManagedInteractionExample.tsx \
  apps/example/src/App.css \
  docs/agent/package-onboarding.md \
  docs/agent/package-usage.md \
  docs/STATUS.md \
  docs/roadmap/managed-render-system.md \
  README.md
git commit -m "feat: add managed camera gesture controllers"
```

Expected: commit succeeds after validation and secret/temp-file review.

## Testing Strategy

- Unit-test descriptor normalization before runtime integration.
- Unit-test pointer button/modifier input before camera gesture math.
- Unit-test camera gesture math as pure functions with no DOM or Three.js imports.
- Integration-test render-layer ordering, timeline layering, object-blocking, pass viewport gating, and debug summaries.
- Type-test public React and root package surfaces with `publicExports.test.ts`.
- Keep example import boundary guarded by `npm run check:imports`.
- Browser-dogfood the existing managed interaction example for real drag, object-blocking, reset, and parallax behavior.

## Documentation Updates

- `docs/agent/package-onboarding.md`: add a concise route for managed camera gestures after opt-in managed scene setup.
- `docs/agent/package-usage.md`: document rich `WebGLCamera.controller.pointer` descriptors, defaults, scope, priority, and non-goals.
- `docs/STATUS.md`: after implementation, move Phase 8B from planned slot to implemented/verified truth with caveats.
- `docs/roadmap/managed-render-system.md`: this planning turn marks Phase 8B `[planned]`; implementation closeout later marks it `[verified]`.
- `README.md`: update only if its camera interaction snippets become stale.

## Exit Criteria

- Phase 8B roadmap row starts implementation from this plan.
- Existing Phase 8 object hover/click/drag behavior remains unchanged.
- Existing legacy orbit shorthand continues to compile and behave as empty-space primary-drag orbit.
- Empty-space pan, dolly, parallax, damping, and reset are descriptor-driven under `WebGLCamera.controller.pointer`.
- Object hit/press/drag/capture blocks all camera gestures.
- Wheel zoom and pinch zoom remain deferred and absent from Phase 8B v1 public descriptors.
- Debug state exposes only descriptor-level camera gesture facts.
- Package docs explain scope, defaults, and non-goals.
- Full validation passes before any verified closeout.

## Risks

- Wheel events can conflict with page scroll. Mitigation: wheel zoom is deferred out of Phase 8B v1; keep page scroll ownership unchanged.
- Pinch behavior differs across browsers. Mitigation: touch pinch zoom is deferred out of Phase 8B v1 until mobile gesture ownership is designed.
- Damping can accidentally keep the render loop active. Mitigation: use `settleEpsilon`, explicit `requiresContinuousRendering`, and tests for settling.
- Multiple passes can render the same scene/camera. Mitigation: v1 uses topmost pass viewport gating and does not add per-pass controller state.
- Adding button/modifier fields to `WebGLPointerState` broadens public effect input. Mitigation: additive fields only; existing pointer fields and target pointer semantics remain unchanged.
- Example gestures may be hard to verify visually. Mitigation: use debug state plus browser pixel checks for movement and object-block priority.
