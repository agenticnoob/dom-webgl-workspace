# Projection Policies Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add explicit managed projection and placement policies while preserving current Level 1 DOM rect behavior.

**Architecture:** Keep `WebGLTarget` as the default DOM-first path and route all target layout through a single projection-policy module. Expand managed scene/camera descriptors to support `dom-aligned`, `screen`, and initial `perspective-stage` policies, while keeping raw Three.js scene, camera, object, material, texture, renderer, render target, and render loop ownership internal. Choose `screen-depth` as the first perspective-stage placement because it is testable without Phase 4 stage planes.

**Tech Stack:** TypeScript, React descriptor components, Vitest, jsdom, internal Three.js renderer adapter, existing DOM-first runtime pipeline.

---

## Current Truth

- Roadmap `Roadmap Status` selected Phase 3 because it was the first `[not-started]` phase and had no focused plan.
- Worktree was clean before planning. Current HEAD was `7749aaec feat: add opt-in managed scene declarations`.
- `docs/STATUS.md` and `docs/roadmap/managed-render-system.md` still said `Last reviewed against: c890d975 docs: add managed render roadmap status guardrails`; this plan updates active docs to the current HEAD truth.
- Phase 2 is implemented in code:
  - `packages/dom-webgl-runtime/src/lib/types.ts` exports `WebGLSceneDeclaration`, `WebGLCameraDeclaration`, `WebGLRenderPassDeclaration`, `WebGLSceneProjection`, `WebGLCameraType`, and `WebGLCameraMode`.
  - `WebGLSceneProjection` is currently only `"dom-aligned"`.
  - `WebGLCameraType` is currently only `"orthographic"`.
  - `WebGLCameraMode` is currently only `"dom-aligned"`.
  - `WebGLDeclaration` has `sceneId?: string`, but no placement descriptor.
  - `WebGLRenderPassDeclaration` has `id`, `sceneId`, `cameraId`, and `order`, but no `clear` or `clearDepth`.
  - React exports `WebGLScene`, `WebGLCamera`, and `WebGLRenderPass`.
  - Follow-up Phase 2 API adjustment: React-owned rendering should prefer
    `WebGLScene render`; `WebGLRenderPass` remains an advanced explicit pass
    descriptor. Phase 3 examples that add pass options should be rechecked
    against that React-first API before implementation.
  - Follow-up Phase 2 id adjustment: the generated Level 1 scene/camera/pass
    use the internal reserved id `__dom-webgl-default__`; consumer ids such as
    `main` are allowed and do not replace the generated default.
- `packages/dom-webgl-runtime/src/lib/renderer/renderLayerDeclarations.ts` currently rejects future projection/camera policies at runtime.
- `packages/dom-webgl-runtime/test/lib/renderer/renderLayerDeclarations.test.ts` currently has Phase 2 negative assertions for `"perspective-stage"` and `"perspective"`.
- `packages/dom-webgl-runtime/src/lib/renderer/renderLayerRegistry.ts` stores each managed scene with one internal scene adapter and one `scene.camera`; each camera entry currently reuses that scene camera.
- `packages/dom-webgl-runtime/src/lib/renderer/threeRenderer.ts` has `createManagedDomAlignedSceneAdapter(renderer)` and `configureOrthographicCamera(...)`, but no screen or perspective camera helpers.
- `packages/dom-webgl-runtime/src/lib/renderer/domProjection.ts` contains the current layout math:

```ts
export function projectDOMRectToSceneLayout(
  rect: Pick<DOMRectReadOnly, "left" | "top" | "width" | "height">,
  viewport: DOMViewportSize,
): ProjectedDOMRect {
  return {
    x: rect.left + rect.width / 2,
    y: viewport.height - (rect.top + rect.height / 2),
    width: rect.width,
    height: rect.height,
  };
}
```

- `packages/dom-webgl-runtime/src/lib/render/renderableFactory.ts` already passes every DOM/media/model renderable through one optional `projectLayout(descriptor, measurement, viewport)` callback, so Phase 3 can centralize policy math without touching every renderable deeply.
- `packages/dom-webgl-runtime/src/lib/debug/debugState.ts` currently emits `sceneId` for targets, but not projection or placement.
- Active docs currently state Phase 2 supports only DOM-aligned scenes/cameras and that projection policies are a later roadmap phase.

## Scope

- Expand public descriptor types without exposing raw Three.js handles:
  - `WebGLSceneProjection`: `"dom-aligned" | "screen" | "perspective-stage"`.
  - `WebGLCameraType`: `"orthographic" | "perspective"`.
  - `WebGLCameraMode`: `"dom-aligned" | "screen" | "perspective-stage"`.
  - `WebGLPlacementDeclaration`: target placement policy data.
- Add `placement?: WebGLPlacementDeclaration` to `WebGLDeclaration`.
- Keep `placement` default as `{ mode: "dom-anchored" }` for every existing `WebGLTarget`.
- Implement and test these placement modes:
  - `dom-anchored`: existing DOM rect center/size behavior.
  - `screen-anchored`: overlay/HUD placement from viewport anchor, offset, and explicit or DOM-derived size.
  - `screen-depth`: first perspective-stage DOM target mapping from DOM rect to a fixed camera-space depth.
  - `stage-local`: explicit managed scene coordinates for advanced opt-in target placement and future Phase 4 scene-native descriptors.
- Keep `screen-plane`, `screen-billboard`, named stage planes, scene-native `WebGLModel`, stage primitives, and picking out of this phase.
- Add pass-level `clear?: boolean` and `clearDepth?: boolean` descriptors so screen overlay passes can render without world-depth interference.
- Decouple internal managed scenes from internal managed cameras enough that different camera declarations can own separate internal camera objects.
- Keep Level 1 unchanged: no user-authored scene/camera/pass/placement is required for existing examples.
- Add debug target fields for `sceneId`, `projection`, and `placementMode`.
- Update active package docs and roadmap after implementation.

## Non-Goals

- Do not expose raw `THREE.Scene`, `THREE.Camera`, `Object3D`, `Group`, `Mesh`, `Material`, `Texture`, `WebGLRenderer`, render target, composer, pass, loader, mixer, raycaster, or render-loop handles.
- Do not build a general render graph or composer plugin chain.
- Do not add `WebGLModel`, `WebGLStagePlane`, `WebGLLight`, colliders, picking, camera controls, physics, or pass-scoped postprocess.
- Do not move ordinary DOM effects away from `WebGLTarget`.
- Do not make `WebGLScene`, `WebGLCamera`, `WebGLRenderPass`, or `placement` required for existing consumers.
- Do not change `ctx.object`, `ctx.scene`, `ctx.camera`, or `ctx.runtime` effect scope in this phase; Phase 5 owns scoped effect contexts.
- Do not make `screen-plane` the initial perspective-stage mode because it requires named stage planes from Phase 4.
- Do not commit automatically during implementation unless the user explicitly asks for a commit.

## API And Architecture Principles

- DOM-first remains the default: existing `<WebGLRuntime><WebGLTarget ... /></WebGLRuntime>` usage must keep its current behavior and layout math.
- React mental model stays declarative: scenes, cameras, passes, and targets are props/descriptor driven; nesting still expresses scene inheritance.
- Agent-first naming: public fields say `projection`, `type`, `mode`, `placement`, `sceneId`, `cameraId`, `clearDepth`, `anchor`, `offset`, `position`, `rotation`, and `scale`.
- Three-like vocabulary is controlled: `position`, `rotation`, `scale`, `camera`, and `scene` keep familiar meanings but map to runtime-owned descriptors.
- Projection policy and placement mode stay separate:
  - projection policy describes scene/camera coordinate mapping;
  - placement mode describes where a target object gets its transform from.
- Runtime owns all camera objects and projection matrices.
- Keep projection math in a focused pure module that runtime and tests can call.
- Keep renderer adapter changes minimal: add methods needed by passes/cameras, not a raw renderer escape hatch.

## Proposed Public Shape

Level 1 remains unchanged:

```tsx
<WebGLRuntime effects={runtimeEffects}>
  <WebGLTarget
    webgl={{
      key: "hero.title",
      source: { kind: "dom", type: "text" },
      effects: [{ kind: "app.titleReveal" }],
    }}
  >
    Hero title
  </WebGLTarget>
</WebGLRuntime>
```

Screen overlay scene:

```tsx
<WebGLRuntime effects={runtimeEffects}>
  <WebGLScene id="overlay" projection="screen">
    <WebGLCamera
      id="overlay.camera"
      default
      type="orthographic"
      mode="screen"
    />
    <WebGLTarget
      webgl={{
        key: "hud.badge",
        source: { kind: "dom", type: "element" },
        placement: {
          mode: "screen-anchored",
          anchor: "top-right",
          offset: [-32, 32],
          size: [180, 48],
        },
      }}
    >
      <div aria-label="HUD status" />
    </WebGLTarget>
  </WebGLScene>
  <WebGLRenderPass
    id="overlay.pass"
    scene="overlay"
    camera="overlay.camera"
    order={10}
    clearDepth
  />
</WebGLRuntime>
```

Initial perspective-stage target mapping:

```tsx
<WebGLRuntime effects={runtimeEffects}>
  <WebGLScene id="world" projection="perspective-stage" defaultPass>
    <WebGLCamera
      id="world.camera"
      default
      type="perspective"
      mode="perspective-stage"
      fov={50}
      near={0.1}
      far={2000}
      position={[0, 0, 500]}
      target={[0, 0, 0]}
    />
    <WebGLTarget
      webgl={{
        key: "hero.model",
        source: { kind: "model", type: "glb", src: "/models/hero.glb" },
        placement: {
          mode: "screen-depth",
          depth: 500,
        },
      }}
    >
      <div aria-label="Hero model fallback" />
    </WebGLTarget>
  </WebGLScene>
</WebGLRuntime>
```

Stage-local target placement remains advanced and opt-in:

```ts
const declaration = {
  key: "world.model",
  sceneId: "world",
  source: { kind: "model", type: "glb", src: "/models/hero.glb" },
  placement: {
    mode: "stage-local",
    position: [0, 0, 0],
    rotation: [0, Math.PI, 0],
    scale: 1.2,
    size: [240, 240],
  },
} satisfies WebGLDeclaration;
```

## File Structure

- Modify `packages/dom-webgl-runtime/src/lib/types.ts`
  - Expand scene/camera unions.
  - Add tuple, anchor, placement, camera framing, and render-pass clear fields.
  - Add `placement?: WebGLPlacementDeclaration` to `WebGLDeclaration`.
  - Add `projection` and `placementMode` to target debug summaries.
- Modify `packages/dom-webgl-runtime/src/index.ts`
  - Export the new placement and tuple types.
- Modify `packages/dom-webgl-runtime/src/lib/renderer/renderLayerDeclarations.ts`
  - Normalize scene projection, camera type/mode/framing, pass clear fields, and target placement.
  - Add scene/camera compatibility checks.
- Create `packages/dom-webgl-runtime/src/lib/renderer/projectionPolicies.ts`
  - Own pure projection and placement math.
  - Keep current DOM-aligned math behavior byte-for-byte compatible in output.
- Modify `packages/dom-webgl-runtime/src/lib/renderer/domProjection.ts`
  - Re-export compatible `DOMViewportSize`, `ProjectedDOMRect`, and `projectDOMRectToSceneLayout` from the new policy module, or delegate to it.
- Modify `packages/dom-webgl-runtime/src/lib/renderer/renderLayerRegistry.ts`
  - Store scene projection on scene entries.
  - Store camera type/mode/framing on camera entries.
  - Create separate internal camera objects for managed camera declarations.
  - Apply pass `clear` and `clearDepth` metadata.
- Modify `packages/dom-webgl-runtime/src/lib/renderer/threeRenderer.ts`
  - Add internal managed scene and camera factory helpers.
  - Add perspective camera setup.
  - Add renderer adapter `clearDepth?()` and `clear?()` support.
- Modify `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`
  - Use normalized placement and scene projection when projecting each target layout.
  - Apply pass `clear`/`clearDepth` before rendering.
  - Add `projection` and `placementMode` to debug target records.
  - Keep transform-group projection in the same policy path.
- Modify `packages/dom-webgl-runtime/src/lib/render/renderables/sceneRenderableController.ts`
  - Accept projected `z`, optional rotation, and explicit scale when provided by placement policy.
- Modify React descriptor components:
  - `packages/dom-webgl-runtime/src/lib/react/WebGLScene.tsx`
  - `packages/dom-webgl-runtime/src/lib/react/WebGLCamera.tsx`
  - `packages/dom-webgl-runtime/src/lib/react/WebGLRenderPass.tsx`
  - These should forward new descriptor props only.
- Add or modify tests:
  - `packages/dom-webgl-runtime/test/publicExports.test.ts`
  - `packages/dom-webgl-runtime/test/lib/renderer/projectionPolicies.test.ts`
  - `packages/dom-webgl-runtime/test/lib/renderer/renderLayerDeclarations.test.ts`
  - `packages/dom-webgl-runtime/test/lib/renderer/renderLayerRegistry.test.ts`
  - `packages/dom-webgl-runtime/test/lib/renderer/threeRenderer.test.ts`
  - `packages/dom-webgl-runtime/test/lib/renderer/runtimePipeline.test.ts`
  - `packages/dom-webgl-runtime/test/lib/debug/debugState.test.ts`
  - `packages/dom-webgl-runtime/test/lib/react/WebGLScene.test.tsx`
  - `packages/dom-webgl-runtime/test/lib/react/WebGLCamera.test.tsx`
  - `packages/dom-webgl-runtime/test/lib/react/WebGLRenderPass.test.tsx`
- Update docs after implementation:
  - `README.md`
  - `docs/STATUS.md`
  - `docs/roadmap/managed-render-system.md`
  - `docs/agent/package-onboarding.md`
  - `docs/agent/package-usage.md`

## Task 1: Add Failing Public API And Type Boundary Tests

**Files:**
- Modify: `packages/dom-webgl-runtime/test/publicExports.test.ts`
- Test: `packages/dom-webgl-runtime/test/publicExports.test.ts`

- [ ] **Step 1: Expand public type imports in the root type fixture**

Add the new public types to the existing root import block:

```ts
import type {
  WebGLCameraFramingDeclaration,
  WebGLPlacementDeclaration,
  WebGLPlacementMode,
  WebGLScreenAnchor,
  WebGLTuple2,
  WebGLTuple3,
} from "${importPath}";
```

- [ ] **Step 2: Add positive type assertions for projection and placement**

Add this block near the existing scene/camera/pass assertions:

```ts
const screenScene = {
  id: "overlay",
  projection: "screen",
  defaultCameraId: "overlay.camera",
} satisfies WebGLSceneDeclaration;

const perspectiveScene = {
  id: "world",
  projection: "perspective-stage",
  defaultCameraId: "world.camera",
  defaultPass: true,
} satisfies WebGLSceneDeclaration;

const screenCamera = {
  id: "overlay.camera",
  sceneId: "overlay",
  type: "orthographic",
  mode: "screen",
  default: true,
} satisfies WebGLCameraDeclaration;

const perspectiveCamera = {
  id: "world.camera",
  sceneId: "world",
  type: "perspective",
  mode: "perspective-stage",
  fov: 50,
  near: 0.1,
  far: 2000,
  position: [0, 0, 500],
  target: [0, 0, 0],
} satisfies WebGLCameraDeclaration;

const screenPlacement = {
  mode: "screen-anchored",
  anchor: "top-right",
  offset: [-32, 32],
  size: [180, 48],
} satisfies WebGLPlacementDeclaration;

const perspectivePlacement = {
  mode: "screen-depth",
  depth: 500,
} satisfies WebGLPlacementDeclaration;

const stagePlacement = {
  mode: "stage-local",
  position: [0, 0, 0],
  rotation: [0, Math.PI, 0],
  scale: 1.2,
  size: [240, 240],
} satisfies WebGLPlacementDeclaration;

"screen" satisfies WebGLSceneProjection;
"perspective-stage" satisfies WebGLSceneProjection;
"perspective" satisfies WebGLCameraType;
"screen" satisfies WebGLCameraMode;
"perspective-stage" satisfies WebGLCameraMode;
"screen-anchored" satisfies WebGLPlacementMode;
"screen-depth" satisfies WebGLPlacementMode;
"stage-local" satisfies WebGLPlacementMode;
"top-right" satisfies WebGLScreenAnchor;
[-32, 32] satisfies WebGLTuple2;
[0, 0, 500] satisfies WebGLTuple3;

screenScene satisfies WebGLSceneDeclaration;
perspectiveScene satisfies WebGLSceneDeclaration;
screenCamera satisfies WebGLCameraDeclaration;
perspectiveCamera satisfies WebGLCameraDeclaration;
screenPlacement satisfies WebGLPlacementDeclaration;
perspectivePlacement satisfies WebGLPlacementDeclaration;
stagePlacement satisfies WebGLPlacementDeclaration;
```

- [ ] **Step 3: Add target placement and pass clear type assertions**

Add a target declaration and pass declaration that use the new fields:

```ts
const overlayDeclaration = {
  key: "overlay.badge",
  sceneId: "overlay",
  source: { kind: "dom", type: "element" },
  placement: screenPlacement,
} satisfies WebGLDeclaration;

const overlayPass = {
  id: "overlay.pass",
  sceneId: "overlay",
  cameraId: "overlay.camera",
  order: 10,
  clearDepth: true,
} satisfies WebGLRenderPassDeclaration;

overlayDeclaration satisfies WebGLDeclaration;
overlayPass satisfies WebGLRenderPassDeclaration;
```

- [ ] **Step 4: Preserve raw Three.js negative assertions**

Add these assertions beside the existing raw scene/camera rejection:

```ts
declare const rawCamera: import("three").Camera;

// @ts-expect-error camera descriptors do not accept raw Three camera handles.
({ id: "raw.camera", sceneId: "world", camera: rawCamera } satisfies WebGLCameraDeclaration);
// @ts-expect-error placement does not accept raw Object3D handles.
({ key: "raw.object", object3D: {} } satisfies WebGLDeclaration);
// @ts-expect-error render passes do not accept raw render targets.
({ sceneId: "world", renderTarget: {} } satisfies WebGLRenderPassDeclaration);
```

- [ ] **Step 5: Run the focused public export test and confirm failure**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/publicExports.test.ts
```

Expected: `FAIL` with TypeScript fixture errors because the new projection, placement, camera, and pass fields do not exist yet.

## Task 2: Define Projection, Camera, Placement, And Pass Types

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/types.ts`
- Modify: `packages/dom-webgl-runtime/src/index.ts`
- Test: `packages/dom-webgl-runtime/test/publicExports.test.ts`

- [ ] **Step 1: Add public tuple, placement, and camera descriptor types**

Add these types near the existing managed scene/camera/pass declarations:

```ts
export type WebGLTuple2 = readonly [number, number];

export type WebGLTuple3 = readonly [number, number, number];

export type WebGLSceneProjection =
  | "dom-aligned"
  | "screen"
  | "perspective-stage";

export type WebGLCameraType = "orthographic" | "perspective";

export type WebGLCameraMode =
  | "dom-aligned"
  | "screen"
  | "perspective-stage";

export type WebGLScreenAnchor =
  | "top-left"
  | "top"
  | "top-right"
  | "right"
  | "bottom-right"
  | "bottom"
  | "bottom-left"
  | "left"
  | "center";

export type WebGLPlacementMode =
  | "dom-anchored"
  | "screen-anchored"
  | "screen-depth"
  | "stage-local";

export type WebGLCameraFramingDeclaration = {
  fov?: number;
  near?: number;
  far?: number;
  position?: WebGLTuple3;
  target?: WebGLTuple3;
  zoom?: number;
};

export type WebGLDOMAnchoredPlacementDeclaration = {
  mode?: "dom-anchored";
};

export type WebGLScreenAnchoredPlacementDeclaration = {
  mode: "screen-anchored";
  anchor?: WebGLScreenAnchor;
  offset?: WebGLTuple2;
  size?: "dom" | WebGLTuple2;
};

export type WebGLScreenDepthPlacementDeclaration = {
  mode: "screen-depth";
  depth?: number;
  size?: "dom" | WebGLTuple2;
};

export type WebGLStageLocalPlacementDeclaration = {
  mode: "stage-local";
  position?: WebGLTuple3;
  rotation?: WebGLTuple3;
  scale?: number | WebGLTuple3;
  size?: WebGLTuple2;
};

export type WebGLPlacementDeclaration =
  | WebGLDOMAnchoredPlacementDeclaration
  | WebGLScreenAnchoredPlacementDeclaration
  | WebGLScreenDepthPlacementDeclaration
  | WebGLStageLocalPlacementDeclaration;
```

- [ ] **Step 2: Extend public declarations**

Update the managed declarations:

```ts
export type WebGLCameraDeclaration = WebGLCameraFramingDeclaration & {
  id: string;
  sceneId: string;
  type?: WebGLCameraType;
  mode?: WebGLCameraMode;
  default?: boolean;
};

export type WebGLRenderPassDeclaration = {
  id?: string;
  sceneId: string;
  cameraId?: string;
  order?: number;
  clear?: boolean;
  clearDepth?: boolean;
};

export type WebGLDeclaration = {
  key: string;
  sceneId?: string;
  placement?: WebGLPlacementDeclaration;
  source?: WebGLSourceDeclaration;
  renderRole?: WebGLRenderRole;
  scroll?: WebGLScrollBehavior;
  pointer?: WebGLPointerDeclaration;
  lifecycle?: WebGLLifecycleDeclaration;
  effects?: WebGLEffectsDeclaration;
  transformScope?: WebGLTransformScope;
};
```

- [ ] **Step 3: Extend debug target summaries**

Update the target summary type:

```ts
targets: Array<{
  key: string;
  sceneId?: string;
  projection?: WebGLSceneProjection;
  placementMode?: WebGLPlacementMode;
  sourceKind: string;
  renderRole: WebGLRenderRole;
  resourceStatus: WebGLResourceStatus;
  lifecycleState: WebGLLifecycleState;
  visible: boolean;
  pointer?: WebGLTargetPointerState;
  parentKey?: string;
  layerDepth: number;
  siblingIndex: number;
  computedRenderOrder?: number;
  error?: string;
}>;
```

- [ ] **Step 4: Export new public types from the root entrypoint**

Add these names to `packages/dom-webgl-runtime/src/index.ts`:

```ts
type WebGLCameraFramingDeclaration,
type WebGLDOMAnchoredPlacementDeclaration,
type WebGLPlacementDeclaration,
type WebGLPlacementMode,
type WebGLScreenAnchor,
type WebGLScreenAnchoredPlacementDeclaration,
type WebGLScreenDepthPlacementDeclaration,
type WebGLStageLocalPlacementDeclaration,
type WebGLTuple2,
type WebGLTuple3,
```

- [ ] **Step 5: Run the public export test again**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/publicExports.test.ts
```

Expected: still `FAIL`, now on missing normalization/runtime behavior rather than missing exported types.

## Task 3: Normalize Projection, Placement, Camera, And Pass Descriptors

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/renderLayerDeclarations.ts`
- Modify: `packages/dom-webgl-runtime/test/lib/renderer/renderLayerDeclarations.test.ts`

- [ ] **Step 1: Replace Phase 2 negative tests with Phase 3 positive normalization tests**

Replace the old `rejects future projection and camera policies in Phase 2` test with:

```ts
test("normalizes screen scene camera pass and placement descriptors", () => {
  expect(
    normalizeRenderLayerSceneDeclaration({
      id: " overlay ",
      projection: "screen",
      defaultCameraId: " overlay.camera ",
    }),
  ).toEqual({
    id: "overlay",
    projection: "screen",
    defaultCameraId: "overlay.camera",
    defaultPass: false,
  });

  expect(
    normalizeRenderLayerCameraDeclaration({
      id: " overlay.camera ",
      sceneId: " overlay ",
      type: "orthographic",
      mode: "screen",
      default: true,
      zoom: 1.25,
    }),
  ).toEqual({
    id: "overlay.camera",
    sceneId: "overlay",
    type: "orthographic",
    mode: "screen",
    default: true,
    zoom: 1.25,
  });

  expect(
    normalizeRenderLayerPassDeclaration({
      sceneId: " overlay ",
      cameraId: " overlay.camera ",
      clearDepth: true,
    }),
  ).toEqual({
    id: "overlay:overlay.camera:pass",
    sceneId: "overlay",
    cameraId: "overlay.camera",
    order: 0,
    clear: false,
    clearDepth: true,
  });

  expect(
    normalizeTargetPlacement({
      mode: "screen-anchored",
      anchor: "top-right",
      offset: [-32, 32],
      size: [180, 48],
    }),
  ).toEqual({
    mode: "screen-anchored",
    anchor: "top-right",
    offset: [-32, 32],
    size: [180, 48],
  });
});
```

- [ ] **Step 2: Add perspective-stage normalization tests**

Add:

```ts
test("normalizes perspective stage camera and placement descriptors", () => {
  expect(
    normalizeRenderLayerSceneDeclaration({
      id: "world",
      projection: "perspective-stage",
      defaultPass: true,
    }),
  ).toEqual({
    id: "world",
    projection: "perspective-stage",
    defaultPass: true,
  });

  expect(
    normalizeRenderLayerCameraDeclaration({
      id: "world.camera",
      sceneId: "world",
      type: "perspective",
      mode: "perspective-stage",
      fov: 50,
      near: 0.1,
      far: 2000,
      position: [0, 0, 500],
      target: [0, 0, 0],
    }),
  ).toEqual({
    id: "world.camera",
    sceneId: "world",
    type: "perspective",
    mode: "perspective-stage",
    default: false,
    fov: 50,
    near: 0.1,
    far: 2000,
    position: [0, 0, 500],
    target: [0, 0, 0],
  });

  expect(normalizeTargetPlacement({ mode: "screen-depth", depth: 500 })).toEqual({
    mode: "screen-depth",
    depth: 500,
    size: "dom",
  });

  expect(
    normalizeTargetPlacement({
      mode: "stage-local",
      position: [0, 0, 0],
      rotation: [0, Math.PI, 0],
      scale: 1.2,
      size: [240, 240],
    }),
  ).toEqual({
    mode: "stage-local",
    position: [0, 0, 0],
    rotation: [0, Math.PI, 0],
    scale: 1.2,
    size: [240, 240],
  });
});
```

- [ ] **Step 3: Add compatibility diagnostics tests**

Add:

```ts
test("rejects incompatible scene and camera policies", () => {
  expect(() =>
    assertCameraMatchesSceneProjection(
      { id: "overlay", projection: "screen", defaultPass: false },
      {
        id: "overlay.camera",
        sceneId: "overlay",
        type: "perspective",
        mode: "perspective-stage",
        default: false,
      },
    ),
  ).toThrow(
    'WebGL camera "overlay.camera" uses perspective/perspective-stage but scene "overlay" uses projection "screen".',
  );

  expect(() =>
    assertCameraMatchesSceneProjection(
      { id: "world", projection: "perspective-stage", defaultPass: false },
      {
        id: "world.camera",
        sceneId: "world",
        type: "orthographic",
        mode: "screen",
        default: false,
      },
    ),
  ).toThrow(
    'WebGL camera "world.camera" uses orthographic/screen but scene "world" uses projection "perspective-stage".',
  );
});
```

- [ ] **Step 4: Implement normalization helpers**

Add or update these exported helpers:

```ts
export type NormalizedTargetPlacement = Required<WebGLDOMAnchoredPlacementDeclaration> |
  (WebGLScreenAnchoredPlacementDeclaration & {
    anchor: WebGLScreenAnchor;
    offset: WebGLTuple2;
    size: "dom" | WebGLTuple2;
  }) |
  (WebGLScreenDepthPlacementDeclaration & {
    depth: number;
    size: "dom" | WebGLTuple2;
  }) |
  (WebGLStageLocalPlacementDeclaration & {
    position: WebGLTuple3;
    rotation: WebGLTuple3;
    scale: number | WebGLTuple3;
  });

export function normalizeTargetPlacement(
  placement: WebGLPlacementDeclaration | undefined,
): NormalizedTargetPlacement {
  if (!placement || placement.mode === undefined || placement.mode === "dom-anchored") {
    return { mode: "dom-anchored" };
  }

  switch (placement.mode) {
    case "screen-anchored":
      return {
        mode: "screen-anchored",
        anchor: placement.anchor ?? "center",
        offset: normalizeTuple2(placement.offset, [0, 0], "screen-anchored offset"),
        size: placement.size ?? "dom",
      };
    case "screen-depth":
      return {
        mode: "screen-depth",
        depth: normalizePositiveNumber(placement.depth, 500, "screen-depth depth"),
        size: placement.size ?? "dom",
      };
    case "stage-local":
      return {
        mode: "stage-local",
        position: normalizeTuple3(placement.position, [0, 0, 0], "stage-local position"),
        rotation: normalizeTuple3(placement.rotation, [0, 0, 0], "stage-local rotation"),
        scale: placement.scale ?? 1,
        ...(placement.size ? { size: placement.size } : {}),
      };
  }
}
```

- [ ] **Step 5: Run the focused normalization tests**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/renderer/renderLayerDeclarations.test.ts
```

Expected: `PASS`.

## Task 4: Add Pure Projection Policy Math

**Files:**
- Create: `packages/dom-webgl-runtime/src/lib/renderer/projectionPolicies.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/domProjection.ts`
- Create: `packages/dom-webgl-runtime/test/lib/renderer/projectionPolicies.test.ts`

- [ ] **Step 1: Write failing projection policy tests**

Create `projectionPolicies.test.ts`:

```ts
import { describe, expect, test } from "vitest";

import {
  projectTargetLayout,
  projectDOMRectToSceneLayout,
} from "../../../src/lib/renderer/projectionPolicies";

describe("projection policies", () => {
  test("preserves current dom-aligned rect mapping", () => {
    const rect = { left: 100, top: 120, width: 220, height: 140 };
    const viewport = { width: 800, height: 600 };

    expect(projectDOMRectToSceneLayout(rect, viewport)).toEqual({
      x: 210,
      y: 410,
      width: 220,
      height: 140,
    });
  });

  test("projects screen anchored placement from viewport anchor and offset", () => {
    expect(
      projectTargetLayout({
        sceneProjection: "screen",
        camera: { type: "orthographic", mode: "screen" },
        placement: {
          mode: "screen-anchored",
          anchor: "top-right",
          offset: [-32, 32],
          size: [180, 48],
        },
        measurement: { left: 0, top: 0, width: 1, height: 1 },
        viewport: { width: 800, height: 600 },
      }),
    ).toEqual({
      x: 768,
      y: 568,
      z: 0,
      width: 180,
      height: 48,
    });
  });

  test("projects perspective screen-depth placement at a fixed camera depth", () => {
    expect(
      projectTargetLayout({
        sceneProjection: "perspective-stage",
        camera: {
          type: "perspective",
          mode: "perspective-stage",
          fov: 50,
          position: [0, 0, 500],
          target: [0, 0, 0],
        },
        placement: { mode: "screen-depth", depth: 500, size: "dom" },
        measurement: { left: 300, top: 250, width: 200, height: 100 },
        viewport: { width: 800, height: 600 },
      }),
    ).toEqual({
      x: 0,
      y: 0,
      z: 0,
      width: expect.any(Number),
      height: expect.any(Number),
    });
  });

  test("projects stage-local placement from explicit coordinates", () => {
    expect(
      projectTargetLayout({
        sceneProjection: "perspective-stage",
        camera: {
          type: "perspective",
          mode: "perspective-stage",
          fov: 50,
          position: [0, 0, 500],
          target: [0, 0, 0],
        },
        placement: {
          mode: "stage-local",
          position: [10, 20, -30],
          rotation: [0, Math.PI, 0],
          scale: 2,
          size: [240, 120],
        },
        measurement: { left: 0, top: 0, width: 1, height: 1 },
        viewport: { width: 800, height: 600 },
      }),
    ).toMatchObject({
      x: 10,
      y: 20,
      z: -30,
      width: 240,
      height: 120,
      rotation: [0, Math.PI, 0],
      scale: 2,
    });
  });
});
```

- [ ] **Step 2: Implement the projection policy module**

Add:

```ts
import type {
  WebGLCameraMode,
  WebGLCameraType,
  WebGLSceneProjection,
  WebGLTuple3,
} from "../types";
import type { NormalizedTargetPlacement } from "./renderLayerDeclarations";

export type DOMViewportSize = {
  width: number;
  height: number;
};

export type ProjectedDOMRect = {
  x: number;
  y: number;
  z?: number;
  width: number;
  height: number;
  rotation?: WebGLTuple3;
  scale?: number | WebGLTuple3;
};

export type ProjectionCameraState = {
  type: WebGLCameraType;
  mode: WebGLCameraMode;
  fov?: number;
  position?: WebGLTuple3;
  target?: WebGLTuple3;
};

export type ProjectTargetLayoutInput = {
  sceneProjection: WebGLSceneProjection;
  camera: ProjectionCameraState;
  placement: NormalizedTargetPlacement;
  measurement: Pick<DOMRectReadOnly, "left" | "top" | "width" | "height">;
  viewport: DOMViewportSize;
};

export function projectDOMRectToSceneLayout(
  rect: Pick<DOMRectReadOnly, "left" | "top" | "width" | "height">,
  viewport: DOMViewportSize,
): ProjectedDOMRect {
  return {
    x: rect.left + rect.width / 2,
    y: viewport.height - (rect.top + rect.height / 2),
    width: rect.width,
    height: rect.height,
  };
}

export function projectTargetLayout(input: ProjectTargetLayoutInput): ProjectedDOMRect {
  switch (input.placement.mode) {
    case "dom-anchored":
      return projectDOMRectToSceneLayout(input.measurement, input.viewport);
    case "screen-anchored":
      return projectScreenAnchoredLayout(input);
    case "screen-depth":
      return projectScreenDepthLayout(input);
    case "stage-local":
      return projectStageLocalLayout(input);
  }
}
```

Use a small helper for screen-depth:

```ts
function projectScreenDepthLayout(input: ProjectTargetLayoutInput): ProjectedDOMRect {
  const depth = input.placement.mode === "screen-depth" ? input.placement.depth : 500;
  const fov = input.camera.fov ?? 50;
  const verticalSpan = 2 * depth * Math.tan((fov * Math.PI) / 360);
  const unitsPerPixel = verticalSpan / input.viewport.height;
  const centerX = input.measurement.left + input.measurement.width / 2;
  const centerY = input.measurement.top + input.measurement.height / 2;
  const cameraZ = input.camera.position?.[2] ?? 500;

  return {
    x: (centerX - input.viewport.width / 2) * unitsPerPixel,
    y: (input.viewport.height / 2 - centerY) * unitsPerPixel,
    z: cameraZ - depth,
    width: readProjectedSize(input.placement.size, input.measurement.width, unitsPerPixel),
    height: readProjectedSize(input.placement.size, input.measurement.height, unitsPerPixel),
  };
}
```

- [ ] **Step 3: Keep `domProjection.ts` as the compatibility import path**

Replace the implementation with:

```ts
export type { DOMViewportSize, ProjectedDOMRect } from "./projectionPolicies";
export { projectDOMRectToSceneLayout } from "./projectionPolicies";
```

- [ ] **Step 4: Run the focused projection tests**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/renderer/projectionPolicies.test.ts
```

Expected: `PASS`.

## Task 5: Create Managed Screen And Perspective Cameras Internally

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/threeRenderer.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/renderLayerRegistry.ts`
- Modify: `packages/dom-webgl-runtime/test/lib/renderer/renderLayerRegistry.test.ts`
- Modify: `packages/dom-webgl-runtime/test/lib/renderer/threeRenderer.test.ts`

- [ ] **Step 1: Add failing registry tests for separate managed cameras**

Add to `renderLayerRegistry.test.ts`:

```ts
test("creates managed cameras separately from managed scene adapters", () => {
  const mainAdapter = createSceneAdapter();
  const worldAdapter = createSceneAdapter();
  const perspectiveCamera = { label: "perspective-camera" };
  const resizeCamera = vi.fn();
  const registry = createInternalRenderLayerRegistry(
    createRendererHostStub(mainAdapter),
    {
      createManagedSceneAdapter() {
        return {
          scene: { label: "world-scene" },
          sceneAdapter: worldAdapter,
          resize() {},
          dispose() {},
        };
      },
      createManagedCamera(declaration) {
        expect(declaration.type).toBe("perspective");
        return {
          camera: perspectiveCamera,
          resize: resizeCamera,
          dispose() {},
        };
      },
    },
  );

  registry.registerScene({ id: "world", projection: "perspective-stage" });
  registry.registerCamera({
    id: "world.camera",
    sceneId: "world",
    type: "perspective",
    mode: "perspective-stage",
    default: true,
  });

  expect(registry.getCamera("world.camera")).toMatchObject({
    id: "world.camera",
    sceneId: "world",
    type: "perspective",
    mode: "perspective-stage",
    camera: perspectiveCamera,
  });

  registry.resize({ width: 390, height: 844 });

  expect(resizeCamera).toHaveBeenCalledWith({ width: 390, height: 844 });
});
```

- [ ] **Step 2: Change internal entry types**

Update scene and camera entries:

```ts
export type InternalRenderSceneEntry = {
  readonly id: string;
  readonly generated: boolean;
  readonly projection: WebGLSceneProjection;
  readonly scene: object;
  readonly sceneAdapter: WebGLSceneAdapter;
  readonly defaultCameraId?: string;
  readonly resize?: (viewport: DOMViewportSize) => void;
  readonly dispose?: () => void;
};

export type InternalRenderCameraEntry = {
  readonly id: string;
  readonly generated: boolean;
  readonly sceneId: string;
  readonly type: WebGLCameraType;
  readonly mode: WebGLCameraMode;
  readonly default: boolean;
  readonly camera: object;
  readonly fov?: number;
  readonly near?: number;
  readonly far?: number;
  readonly position?: WebGLTuple3;
  readonly target?: WebGLTuple3;
  readonly resize?: (viewport: DOMViewportSize) => void;
  readonly dispose?: () => void;
};
```

- [ ] **Step 3: Add internal factory option for cameras**

Add:

```ts
export type ManagedThreeCameraEntry = {
  readonly camera: object;
  resize(viewport: DOMViewportSize): void;
  dispose(): void;
};

export type InternalRenderLayerRegistryOptions = {
  createManagedSceneAdapter?(
    declaration: NormalizedRenderLayerSceneDeclaration,
  ): ManagedThreeSceneAdapterEntry;
  createManagedCamera?(
    declaration: NormalizedRenderLayerCameraDeclaration,
    scene: InternalRenderSceneEntry,
  ): ManagedThreeCameraEntry;
};
```

- [ ] **Step 4: Implement compatibility checks during camera registration**

After resolving the scene in `registerCamera`, call:

```ts
assertCameraMatchesSceneProjection(scene, normalized);
const managedCamera = createManagedCamera(normalized, scene);
```

Set camera entry fields from `normalized` and `managedCamera.camera`.

- [ ] **Step 5: Implement internal camera helpers in `threeRenderer.ts`**

Add helpers:

```ts
export function createManagedSceneAdapter(
  renderer: ThreeRendererAdapter,
): ManagedThreeSceneAdapterEntry {
  const scene = new Scene();
  configureDefaultSceneLighting(scene);
  const fallbackCamera = new OrthographicCamera(0, 800, 600, 0, 0.1, 1000);
  const sceneAdapter = createThreeSceneAdapter(scene, fallbackCamera, renderer);

  return {
    scene,
    sceneAdapter,
    resize() {},
    dispose() {
      clearSceneObjects(scene);
    },
  };
}

export function createManagedCamera(
  declaration: NormalizedRenderLayerCameraDeclaration,
): ManagedThreeCameraEntry {
  if (declaration.type === "perspective") {
    const camera = new PerspectiveCamera(
      declaration.fov ?? 50,
      1,
      declaration.near ?? 0.1,
      declaration.far ?? 2000,
    );
    configurePerspectiveCamera(camera, declaration, { width: 800, height: 600 });
    return {
      camera,
      resize(viewport) {
        configurePerspectiveCamera(camera, declaration, viewport);
      },
      dispose() {},
    };
  }

  const camera = new OrthographicCamera(0, 800, 600, 0, 0.1, 1000);
  configureOrthographicCamera(camera, 800, 600);
  return {
    camera,
    resize(viewport) {
      configureOrthographicCamera(camera, viewport.width, viewport.height);
    },
    dispose() {},
  };
}
```

Keep `createManagedDomAlignedSceneAdapter` as a compatibility wrapper or replace its call sites in the same task.

- [ ] **Step 6: Run focused renderer-layer tests**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/renderer/renderLayerRegistry.test.ts packages/dom-webgl-runtime/test/lib/renderer/threeRenderer.test.ts
```

Expected: `PASS`.

## Task 6: Route Runtime Layout Through Projection Policies

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/sceneRenderableController.ts`
- Modify: `packages/dom-webgl-runtime/test/lib/renderer/runtimePipeline.test.ts`

- [ ] **Step 1: Add runtime tests for projection debug and screen placement**

Add to `runtimePipeline.test.ts`:

```ts
test("projects screen anchored targets through the selected scene projection", async () => {
  const overlayAdapter = createObjectRecordingSceneAdapter();
  const { registry } = createRenderLayerRegistryStub(
    createObjectRecordingSceneAdapter(),
    {
      scenes: { overlay: overlayAdapter },
      sceneProjection: { overlay: "screen" },
      cameras: {
        "overlay.camera": {
          sceneId: "overlay",
          type: "orthographic",
          mode: "screen",
        },
      },
    },
  );
  const runtime = await createPipelineRuntime({
    renderLayerRegistryFactory() {
      return registry;
    },
    measureElement: () => createLayoutMeasurement(0, 0, 10, 10),
  });

  runtime.registerTarget(document.createElement("section"), {
    key: "overlay.badge",
    sceneId: "overlay",
    source: { kind: "dom", type: "element" },
    placement: {
      mode: "screen-anchored",
      anchor: "top-right",
      offset: [-32, 32],
      size: [180, 48],
    },
  });

  await runtime.sync();

  expect(readSceneObjectLastLayout(overlayAdapter, "overlay.badge")).toEqual({
    x: 768,
    y: 568,
    z: 0,
    width: 180,
    height: 48,
  });
  expect(runtime.getDebugState().targets[0]).toMatchObject({
    key: "overlay.badge",
    sceneId: "overlay",
    projection: "screen",
    placementMode: "screen-anchored",
  });

  runtime.dispose();
});
```

- [ ] **Step 2: Add runtime tests preserving Level 1 layout**

Add:

```ts
test("keeps Level 1 dom anchored layout unchanged", async () => {
  const sceneAdapter = createObjectRecordingSceneAdapter();
  const runtime = await createPipelineRuntime({
    rendererHostFactory(container) {
      return createRendererHostStub(container, sceneAdapter);
    },
    measureElement: () => createLayoutMeasurement(100, 120, 220, 140),
  });

  runtime.registerTarget(document.createElement("section"), {
    key: "level1.surface",
    source: { kind: "dom", type: "element" },
  });

  await runtime.sync();

  expect(readSceneObjectLastLayout(sceneAdapter, "level1.surface")).toEqual({
    x: 210,
    y: 410,
    width: 220,
    height: 140,
  });

  runtime.dispose();
});
```

- [ ] **Step 3: Add runtime tests for pass clearDepth**

Add:

```ts
test("clears depth before passes that request clearDepth", async () => {
  const clearDepth = vi.fn();
  const sceneAdapter = createRecordingSceneAdapter();
  const { registry } = createRenderLayerRegistryStub(sceneAdapter, {
    passes: [
      { id: "main", generated: true, sceneId: "main", cameraId: "main", order: 0 },
      {
        id: "overlay.pass",
        generated: false,
        sceneId: "main",
        cameraId: "main",
        order: 1,
        clearDepth: true,
      },
    ],
  });
  const runtime = await createPipelineRuntime({
    rendererHostFactory(container) {
      const host = createRendererHostStub(container, sceneAdapter);
      return {
        ...host,
        renderer: {
          ...host.renderer,
          clearDepth,
        },
      };
    },
    renderLayerRegistryFactory() {
      return registry;
    },
  });

  runtime.sync();

  expect(clearDepth).toHaveBeenCalledTimes(1);
  runtime.dispose();
});
```

- [ ] **Step 4: Implement runtime projection lookup**

In `runtime.ts`, replace direct calls to `projectDOMRectToSceneLayout(...)` inside `renderableFactoryContext.projectLayout` and `syncTransformGroups` with a helper:

```ts
function projectTargetLayoutForDescriptor(
  descriptor: TargetDescriptor,
  measurement: ElementLayoutSnapshot,
  viewport: DOMViewportSize,
): ProjectedDOMRect {
  const sceneId = normalizeTargetSceneId(descriptor.declaration.sceneId);
  const scene = renderLayers.getScene(sceneId);
  const camera = renderLayers.getCamera(
    scene.defaultCameraId ?? readFirstCameraIdForScene(scene.id) ?? "main",
  );

  return projectTargetLayout({
    sceneProjection: scene.projection,
    camera,
    placement: normalizeTargetPlacement(descriptor.declaration.placement),
    measurement,
    viewport,
  });
}
```

If `readFirstCameraIdForScene` is not already available, add a registry method such as `getDefaultCameraForScene(sceneId)` rather than scanning private maps from runtime.

- [ ] **Step 5: Apply z, rotation, and scale in scene renderable layout**

Extend `updateObject3DLayout(...)`:

```ts
setVector3((object3D as { position?: unknown }).position, layout.x, layout.y, layout.z ?? 0);
if (layout.rotation) {
  setVector3(
    (object3D as { rotation?: unknown }).rotation,
    layout.rotation[0],
    layout.rotation[1],
    layout.rotation[2],
  );
}
if (layout.scale !== undefined) {
  applyProjectedScale((object3D as { scale?: unknown }).scale, layout);
  return;
}
setVector3((object3D as { scale?: unknown }).scale, layout.width, layout.height, 1);
```

- [ ] **Step 6: Implement pass clear behavior without exposing raw renderer**

Add `clear?()` and `clearDepth?()` to the internal `ThreeRendererAdapter` and call before each pass:

```ts
renderLayers.renderPasses((pass, scene, camera) => {
  if (pass.clear) {
    rendererHost.renderer.clear?.();
  }
  if (pass.clearDepth) {
    rendererHost.renderer.clearDepth?.();
  }
  postprocessController.render(() => {
    scene.sceneAdapter.render(camera.camera);
  });
});
```

- [ ] **Step 7: Run focused runtime tests**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/renderer/runtimePipeline.test.ts
```

Expected: `PASS`.

## Task 7: Forward New React Descriptor Props

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/react/WebGLScene.tsx`
- Modify: `packages/dom-webgl-runtime/src/lib/react/WebGLCamera.tsx`
- Modify: `packages/dom-webgl-runtime/src/lib/react/WebGLRenderPass.tsx`
- Modify: `packages/dom-webgl-runtime/test/lib/react/WebGLScene.test.tsx`
- Modify: `packages/dom-webgl-runtime/test/lib/react/WebGLCamera.test.tsx`
- Modify: `packages/dom-webgl-runtime/test/lib/react/WebGLRenderPass.test.tsx`

- [ ] **Step 1: Add React scene forwarding test**

In `WebGLScene.test.tsx`, add:

```ts
test("forwards screen projection declarations", async () => {
  const registerScene = vi.fn();
  const { WebGLRuntimeProvider, WebGLScene } = await import(
    "../../../src/react"
  );

  render(
    createElement(
      WebGLRuntimeProvider,
      { runtime: createRuntimeStub({ registerScene }) },
      createElement(WebGLScene, {
        id: "overlay",
        projection: "screen",
        defaultCameraId: "overlay.camera",
      }),
    ),
  );

  expect(registerScene).toHaveBeenCalledWith({
    id: "overlay",
    projection: "screen",
    defaultCameraId: "overlay.camera",
    defaultPass: undefined,
  });
});
```

- [ ] **Step 2: Add React camera forwarding test**

In `WebGLCamera.test.tsx`, add:

```ts
test("forwards perspective camera declarations", async () => {
  const registerCamera = vi.fn();
  const { WebGLCamera, WebGLRuntimeProvider, WebGLScene } = await import(
    "../../../src/react"
  );

  render(
    createElement(
      WebGLRuntimeProvider,
      { runtime: createRuntimeStub({ registerCamera }) },
      createElement(
        WebGLScene,
        { id: "world" },
        createElement(WebGLCamera, {
          id: "world.camera",
          type: "perspective",
          mode: "perspective-stage",
          fov: 50,
          near: 0.1,
          far: 2000,
          position: [0, 0, 500],
          target: [0, 0, 0],
          default: true,
        }),
      ),
    ),
  );

  expect(registerCamera).toHaveBeenCalledWith({
    id: "world.camera",
    sceneId: "world",
    type: "perspective",
    mode: "perspective-stage",
    fov: 50,
    near: 0.1,
    far: 2000,
    position: [0, 0, 500],
    target: [0, 0, 0],
    default: true,
  });
});
```

- [ ] **Step 3: Add React render pass forwarding test**

In `WebGLRenderPass.test.tsx`, add:

```ts
test("forwards clear and clearDepth render pass declarations", async () => {
  const registerRenderPass = vi.fn();
  const { WebGLRenderPass, WebGLRuntimeProvider } = await import(
    "../../../src/react"
  );

  render(
    createElement(
      WebGLRuntimeProvider,
      { runtime: createRuntimeStub({ registerRenderPass }) },
      createElement(WebGLRenderPass, {
        id: "overlay.pass",
        scene: "overlay",
        camera: "overlay.camera",
        order: 10,
        clearDepth: true,
      }),
    ),
  );

  expect(registerRenderPass).toHaveBeenCalledWith({
    id: "overlay.pass",
    sceneId: "overlay",
    cameraId: "overlay.camera",
    order: 10,
    clear: undefined,
    clearDepth: true,
  });
});
```

- [ ] **Step 4: Update React component props and registration payloads**

Forward new fields in the existing components. Do not add imperative refs or raw Three handles.

- [ ] **Step 5: Run focused React tests**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/react/WebGLScene.test.tsx packages/dom-webgl-runtime/test/lib/react/WebGLCamera.test.tsx packages/dom-webgl-runtime/test/lib/react/WebGLRenderPass.test.tsx
```

Expected: `PASS`.

## Task 8: Add Debug Projection And Placement Records

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/debug/debugState.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`
- Modify: `packages/dom-webgl-runtime/test/lib/debug/debugState.test.ts`
- Modify: `packages/dom-webgl-runtime/test/lib/renderer/runtimePipeline.test.ts`

- [ ] **Step 1: Add debug state unit test**

In `debugState.test.ts`, add a target fixture with projection fields:

```ts
expect(
  createDebugState({
    targetCount: 1,
    renderableCount: 1,
    currentScrollMode: "page",
    pointer: createPointerState(),
    targets: [
      {
        key: "overlay.badge",
        sceneId: "overlay",
        projection: "screen",
        placementMode: "screen-anchored",
        sourceKind: "dom/element",
        renderRole: "surface",
        resourceStatus: "ready",
        lifecycleState: "active",
        visible: true,
      },
    ],
  }).targets[0],
).toMatchObject({
  key: "overlay.badge",
  sceneId: "overlay",
  projection: "screen",
  placementMode: "screen-anchored",
});
```

- [ ] **Step 2: Extend debug target state types and mapping**

Add optional fields to `DebugTargetState` and map them through:

```ts
projection?: WebGLSceneProjection;
placementMode?: WebGLPlacementMode;
```

In `createDebugState`, copy them when present.

- [ ] **Step 3: Populate debug target fields in runtime**

In `createCurrentDebugState()`, include:

```ts
const sceneId = normalizeTargetSceneId(descriptor.declaration.sceneId);
const scene = renderLayers.getScene(sceneId);
const placement = normalizeTargetPlacement(descriptor.declaration.placement);

return {
  key: descriptor.key,
  sceneId,
  projection: scene.projection,
  placementMode: placement.mode,
  ...readTargetDebugRecord(descriptor, targetState),
  parentKey: layer?.parentKey,
  layerDepth: layer?.depth ?? 0,
  siblingIndex: layer?.siblingIndex ?? 0,
  computedRenderOrder: ordering?.renderOrder,
};
```

- [ ] **Step 4: Run focused debug tests**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/debug/debugState.test.ts packages/dom-webgl-runtime/test/lib/renderer/runtimePipeline.test.ts
```

Expected: `PASS`.

## Task 9: Update Active Docs

**Files:**
- Modify: `README.md`
- Modify: `docs/STATUS.md`
- Modify: `docs/agent/package-onboarding.md`
- Modify: `docs/agent/package-usage.md`
- Modify: `docs/roadmap/managed-render-system.md`

- [ ] **Step 1: Update README managed scene section**

Replace Phase 2-only caveat text with text that says:

```md
Managed scenes support explicit projection policies:

- `dom-aligned` keeps the current DOM rect to orthographic scene mapping.
- `screen` is for overlay/HUD scenes and usually renders in a pass with `clearDepth`.
- `perspective-stage` is the first managed 3D projection path. Phase 3 supports `screen-depth` target placement; named stage planes and scene-native objects remain later roadmap work.

`WebGLTarget` remains DOM-backed and defaults to `placement: { mode: "dom-anchored" }`.
```

- [ ] **Step 2: Update `docs/agent/package-onboarding.md`**

In the opt-in managed scene section, replace the Phase 2 support bullet with:

```md
- Projection policies are explicit:
  - `projection: "dom-aligned"` with camera `type: "orthographic"` and `mode: "dom-aligned"` preserves the default DOM rect mapping.
  - `projection: "screen"` with camera `mode: "screen"` is for overlay/HUD scenes.
  - `projection: "perspective-stage"` with camera `type: "perspective"` and `mode: "perspective-stage"` supports initial `screen-depth` target placement.
- `WebGLTarget` defaults to `placement: { mode: "dom-anchored" }`; only opt into `screen-anchored`, `screen-depth`, or `stage-local` when the target should stop following ordinary document layout.
```

- [ ] **Step 3: Update `docs/agent/package-usage.md`**

Add examples for `screen` and `perspective-stage` that match the public shape in this plan. Keep Level 1 usage first.

- [ ] **Step 4: Update `docs/STATUS.md` after implementation**

Update runtime truth and active caveats:

```md
- Managed scene projection policies:
  - `dom-aligned`
  - `screen`
  - `perspective-stage` with initial `screen-depth` target placement
- `WebGLTarget` placement defaults to `dom-anchored`.
```

Also say that `screen-plane`, stage primitives, scene-native models, picking, and physics remain later roadmap phases.

- [ ] **Step 5: Update roadmap Phase 3 after implementation**

When implementation and verification complete, change Phase 3 from `[planned]` to `[implemented]` or `[verified]` according to the roadmap status rules. Do not mark `[verified]` until tests, docs, and commit are closed.

## Task 10: Focused Verification

**Files:**
- No code files modified in this task.

- [ ] **Step 1: Run focused tests first**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/publicExports.test.ts packages/dom-webgl-runtime/test/lib/renderer/renderLayerDeclarations.test.ts packages/dom-webgl-runtime/test/lib/renderer/projectionPolicies.test.ts packages/dom-webgl-runtime/test/lib/renderer/renderLayerRegistry.test.ts packages/dom-webgl-runtime/test/lib/renderer/runtimePipeline.test.ts packages/dom-webgl-runtime/test/lib/debug/debugState.test.ts packages/dom-webgl-runtime/test/lib/react/WebGLScene.test.tsx packages/dom-webgl-runtime/test/lib/react/WebGLCamera.test.tsx packages/dom-webgl-runtime/test/lib/react/WebGLRenderPass.test.tsx
```

Expected: `PASS`.

- [ ] **Step 2: Run package-level typecheck**

Run:

```bash
npm run typecheck -w @project/dom-webgl-runtime
```

Expected: `PASS`.

- [ ] **Step 3: Run boundary checks**

Run:

```bash
npm run check:imports
git diff --check
```

Expected: both pass with no output from `git diff --check`.

- [ ] **Step 4: Run full project check only after focused checks pass**

Run:

```bash
npm run check
```

Expected: `PASS`.

## Exit Criteria

- Existing Level 1 `WebGLTarget` examples and tests still use no user-authored scene/camera/pass/placement declarations.
- `dom-aligned` projection preserves existing rect-to-plane behavior.
- `screen` projection supports overlay/HUD placement with `screen-anchored` targets.
- `perspective-stage` supports initial `screen-depth` target placement with explicit math and tests.
- `stage-local` placement is normalized and projected without raw object exposure.
- Managed cameras are real internal camera entries rather than multiple public ids pointing at the same scene camera.
- Screen overlay passes can request `clearDepth` without exposing renderer internals.
- Debug target summaries include `sceneId`, `projection`, and `placementMode`.
- Public type tests accept managed descriptors and continue rejecting raw Three.js handles.
- Active docs describe Phase 3 as implemented only after code lands; roadmap remains `[planned]` until implementation starts.

## Risks

- Perspective math can become a hidden camera-control API if it grows beyond `screen-depth`. Keep `screen-plane`, camera controllers, and named stage planes out of this phase.
- `stage-local` on `WebGLTarget` can blur the later `WebGLModel`/stage primitive boundary. Docs must state it is advanced opt-in and that DOM-following models should stay `dom-anchored`.
- Decoupling scene and camera internals touches render-layer registry tests and runtime pipeline stubs. Keep the change local to registry/renderer helpers.
- Adding z/rotation/scale to projected layout can accidentally change current DOM-aligned object scale. The Level 1 preservation test must stay explicit.
- Pass `clearDepth` needs a renderer adapter method, not a public renderer handle.
