# Managed Stage Primitives Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add declarative runtime-owned stage primitives and lights that can live in managed scenes and participate in Three.js lighting/depth without exposing raw Three.js objects.

**Architecture:** Keep `WebGLTarget` as the default DOM-first path and add scene-native stage objects as opt-in managed descriptors under `WebGLScene`. Public React components and vanilla runtime methods register normalized primitive/light descriptors; an internal stage registry creates and disposes Three meshes, geometries, materials, and lights through controlled scene objects attached to existing scene adapters. `screen-plane` placement is explicitly deferred to a Phase 8 ray-to-plane follow-up because it needs camera/plane intersection semantics beyond the stage substrate.

**Tech Stack:** TypeScript, React descriptor components, Vitest, jsdom, internal Three.js renderer adapter, existing managed scene/camera/pass registry.

---

## Current Truth

- Roadmap `Roadmap Status` selected Phase 4 because it was the first `[not-started]` phase and had no focused plan.
- Worktree was clean before planning. Current branch is `codex/managed-render-roadmap-iteration`; current HEAD is `e135bdc1 feat: add managed projection policies`.
- `docs/STATUS.md` matches code truth: Phase 3 projection policies are implemented; named lit stage primitives, scene-native `WebGLModel`, and `screen-plane` remain roadmap work.
- No existing focused plan for Phase 4 exists under `docs/superpowers/plans/`.
- Current public scene surface:
  - Root exports `WebGLSceneDeclaration`, `WebGLCameraDeclaration`, `WebGLRenderPassDeclaration`, placement types, and tuple types from `packages/dom-webgl-runtime/src/index.ts`.
  - React exports `WebGLScene`, `WebGLCamera`, `WebGLRenderPass`, and `WebGLTarget` from `packages/dom-webgl-runtime/src/react.ts`.
  - Runtime exposes `registerScene`, `registerCamera`, `registerRenderPass`, and matching unregister methods.
- Current placement surface is `dom-anchored`, `screen-anchored`, `screen-depth`, and `stage-local`; there is no `screen-plane` type or implementation.
- Current renderer internals already provide the right attachment seam:
  - `createInternalRenderLayerRegistry(...)` stores generated and managed scene adapters.
  - `createThreeSceneAdapter(...)` can `addObject`, `removeObject`, create groups, and render with camera overrides.
  - `renderScene()` renders ordered passes and applies pass `clear`/`clearDepth`.
- Current effect lights are not enough for Phase 4:
  - `ctx.object.lights` creates target/effect-owned keyed lights through `createManagedLightsFacade(...)`.
  - Phase 4 needs scene-owned declarative lights that do not depend on a target/effect.
- Current material controls are useful reference only:
  - `createManagedMaterialFacade(...)` supports `color`, `emissive`, `opacity`, `metalness`, and `roughness`.
  - Stage material declarations should be descriptor data, not public raw material handles.

## Scope

- Add public descriptor types for managed stage primitives and lights:
  - `WebGLStagePlaneDeclaration`
  - `WebGLStageBoxDeclaration`
  - `WebGLStagePrimitiveDeclaration`
  - `WebGLLightDeclaration`
  - `WebGLStageMaterialDeclaration`
  - supporting color, role, light-kind, and transform tuple types where needed
- Add vanilla runtime lifecycle methods:
  - `registerStagePrimitive(declaration)`
  - `unregisterStagePrimitive(id)`
  - `registerLight(declaration)`
  - `unregisterLight(id)`
- Add React components:
  - `<WebGLStagePlane />`
  - `<WebGLStageBox />`
  - `<WebGLLight />`
- Let React stage/light components inherit the nearest `WebGLScene` through existing `WebGLSceneContext`; vanilla descriptors use explicit `sceneId`.
- Support initial primitive set:
  - `plane`
  - `box`
  - plane role aliases: `floor`, `wall`, `backdrop`
- Support initial material descriptors:
  - `{ kind: "standard", color, emissive, emissiveIntensity, opacity, metalness, roughness }`
  - `{ kind: "basic", color, opacity }`
- Support initial light descriptors:
  - `ambient`
  - `directional`
  - `point`
- Keep all Three.js `Mesh`, `Geometry`, `Material`, `Light`, `Object3D`, `Scene`, and `Camera` instances internal.
- Make runtime disposal and scene unregistration dispose stage geometries, materials, lights, directional-light target objects, and generated groups exactly once.
- Preserve Level 1 behavior: `WebGLTarget` alone remains the shortest supported authoring path.
- Update package docs after implementation so users see Level 1 first and stage primitives as an opt-in managed scene feature.

## Non-Goals

- Do not add scene-native `WebGLModel`; Phase 7 owns managed model animation and scene-native model work remains outside this Phase 4 substrate.
- Do not add `screen-plane` placement in this phase.
- Do not add picking, hover/click state for stage primitives, raycasters, intersection objects, colliders, or physics.
- Do not add pass-scoped postprocess or change current `ctx.object.postprocess` runtime-canvas scope.
- Do not add `ctx.scene`, `ctx.camera`, `ctx.runtime`, or scoped effect routing; Phase 5 owns effect scope.
- Do not expose raw Three.js renderer, scene, camera, object, group, mesh, material, texture, geometry, light, render target, composer, pass, loader, mixer, raycaster, or render loop handles.
- Do not make `WebGLScene`, `WebGLCamera`, `WebGLRenderPass`, stage primitives, or lights required for existing consumers.
- Do not replace effect-owned `ctx.object.lights`; leave that facade intact for target-local effect lighting.
- Do not commit automatically during implementation unless the user explicitly asks for a commit.

## API And Architecture Principles

- DOM-first default: `WebGLTarget` stays the Level 1 bridge for DOM layout, fallback, lifecycle, pointer, and target-local effects.
- React mental model: component nesting expresses scene ownership; props are descriptor data; mount/unmount maps to runtime register/unregister.
- Agent-first naming: use explicit `sceneId`, `id`, `kind`, `role`, `position`, `rotation`, `scale`, `size`, `material`, `color`, `intensity`, `distance`, `decay`, and `target`.
- Three-like but managed: public names match familiar Three.js concepts while runtime owns every underlying object and lifecycle.
- Descriptor/facade separation: stage material/light declarations are static data; effect material/light facades remain runtime mutation APIs.
- Low coupling: keep declaration normalization, Three object creation, registry lifecycle, runtime wiring, and React components in separate modules.
- Smallest useful Phase 4: ship lit plane/box primitives and declarative lights, then stop.

## Public Shape

React:

```tsx
import {
  WebGLCamera,
  WebGLLight,
  WebGLRuntime,
  WebGLScene,
  WebGLStageBox,
  WebGLStagePlane,
  WebGLTarget,
} from "@project/dom-webgl-runtime/react";

export function Example() {
  return (
    <WebGLRuntime effects={runtimeEffects}>
      <WebGLTarget webgl={{ key: "hero.title", source: { kind: "dom", type: "text" } }}>
        DOM-first title
      </WebGLTarget>

      <WebGLScene
        id="world"
        projection="perspective-stage"
        render={{ camera: "world.camera", clearDepth: true }}
      >
        <WebGLCamera
          id="world.camera"
          default
          type="perspective"
          mode="perspective-stage"
          position={[0, 0, 500]}
          target={[0, 0, 0]}
        />

        <WebGLStagePlane
          id="floor"
          role="floor"
          size={[1200, 800]}
          position={[0, -180, 0]}
          material={{ kind: "standard", color: "#05070a", roughness: 0.8 }}
        />

        <WebGLStageBox
          id="plinth"
          size={[180, 80, 180]}
          position={[0, -120, -40]}
          material={{ kind: "standard", color: "#111827", metalness: 0.1, roughness: 0.6 }}
        />

        <WebGLLight id="ambient" kind="ambient" intensity={0.2} />
        <WebGLLight id="hero" kind="point" intensity={1.8} position={[0, 0, 160]} />
      </WebGLScene>
    </WebGLRuntime>
  );
}
```

Vanilla/runtime descriptor parity:

```ts
runtime.registerScene({
  id: "world",
  projection: "perspective-stage",
});
runtime.registerCamera({
  id: "world.camera",
  sceneId: "world",
  default: true,
  type: "perspective",
  mode: "perspective-stage",
  position: [0, 0, 500],
  target: [0, 0, 0],
});
runtime.registerRenderPass({
  id: "world.pass",
  sceneId: "world",
  cameraId: "world.camera",
  clearDepth: true,
});
runtime.registerStagePrimitive({
  id: "floor",
  sceneId: "world",
  kind: "plane",
  role: "floor",
  size: [1200, 800],
  material: { kind: "standard", color: "#05070a", roughness: 0.8 },
});
runtime.registerLight({
  id: "hero",
  sceneId: "world",
  kind: "point",
  intensity: 1.8,
  position: [0, 0, 160],
});
```

Descriptor defaults:

```ts
const stageDefaults = {
  position: [0, 0, 0],
  rotationByRole: {
    floor: [-Math.PI / 2, 0, 0],
    wall: [0, 0, 0],
    backdrop: [0, 0, 0],
    plane: [0, 0, 0],
    box: [0, 0, 0],
  },
  scale: 1,
  visible: true,
  material: {
    kind: "standard",
    color: "#ffffff",
    roughness: 1,
    metalness: 0,
    opacity: 1,
  },
} as const;
```

## Screen-Plane Decision

Do not implement `placement: { mode: "screen-plane", planeId }` in Phase 4.

Reason: Phase 4's minimum useful substrate is scene-native stage geometry and lighting. `screen-plane` is target placement math that casts a DOM rect/camera ray onto a named plane, which introduces camera/plane intersection semantics and should share infrastructure with future picking. The exact owner is a Phase 8 pre-step named "screen-plane placement against named stage planes" before interactive picking state is exposed. That follow-up should use Phase 4's named stage planes as data but should not expose raw planes, raycasters, intersections, meshes, or cameras.

Phase 4 exit remains valid when the plan, roadmap, and docs record this decision explicitly.

## File Structure

- Modify `packages/dom-webgl-runtime/src/lib/types.ts`
  - Add public stage primitive, material, light, color, role, and transform descriptor types.
  - Add stage/light registration methods to `WebGLRuntime`.
- Modify `packages/dom-webgl-runtime/src/index.ts`
  - Export the new descriptor and prop-supporting types.
- Create `packages/dom-webgl-runtime/src/lib/renderer/stageDeclarations.ts`
  - Normalize ids, scene ids, primitive roles, transforms, sizes, material descriptors, light descriptors, and finite number defaults.
- Create `packages/dom-webgl-runtime/src/lib/renderer/managedStageObjects.ts`
  - Create internal Three plane/box meshes and light objects from normalized declarations.
  - Dispose geometry/material/light/target/group resources.
- Create `packages/dom-webgl-runtime/src/lib/renderer/stageObjectRegistry.ts`
  - Own stage primitive/light maps.
  - Attach/detach internal scene objects through existing `WebGLSceneAdapter`.
  - Remove all objects for a scene before scene unregister.
- Modify `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`
  - Instantiate the stage registry.
  - Add runtime registration methods.
  - Dispose stage objects on scene unregister and runtime dispose.
  - Request render frames and emit debug state on stage/light registration changes.
- Modify `packages/dom-webgl-runtime/src/lib/react/WebGLRuntime.tsx`
  - Add no-op stage/light methods to the pending runtime stub.
- Create `packages/dom-webgl-runtime/src/lib/react/WebGLStagePlane.tsx`
  - Register/unregister a plane under nearest scene or explicit `scene` prop.
- Create `packages/dom-webgl-runtime/src/lib/react/WebGLStageBox.tsx`
  - Register/unregister a box under nearest scene or explicit `scene` prop.
- Create `packages/dom-webgl-runtime/src/lib/react/WebGLLight.tsx`
  - Register/unregister a light under nearest scene or explicit `scene` prop.
- Modify `packages/dom-webgl-runtime/src/react.ts`
  - Export `WebGLStagePlane`, `WebGLStageBox`, `WebGLLight`, and prop types.
- Add or modify tests:
  - `packages/dom-webgl-runtime/test/publicExports.test.ts`
  - `packages/dom-webgl-runtime/test/lib/renderer/stageDeclarations.test.ts`
  - `packages/dom-webgl-runtime/test/lib/renderer/managedStageObjects.test.ts`
  - `packages/dom-webgl-runtime/test/lib/renderer/stageObjectRegistry.test.ts`
  - `packages/dom-webgl-runtime/test/lib/renderer/runtimePipeline.test.ts`
  - `packages/dom-webgl-runtime/test/lib/react/WebGLStagePlane.test.tsx`
  - `packages/dom-webgl-runtime/test/lib/react/WebGLStageBox.test.tsx`
  - `packages/dom-webgl-runtime/test/lib/react/WebGLLight.test.tsx`
- Update docs after implementation:
  - `README.md`
  - `docs/STATUS.md`
  - `docs/roadmap/managed-render-system.md`
  - `docs/agent/package-onboarding.md`
  - `docs/agent/package-usage.md`

## Task 1: Public API And Type Boundary Tests

**Files:**
- Modify: `packages/dom-webgl-runtime/test/publicExports.test.ts`

- [x] **Step 1: Add failing React entrypoint runtime assertions**

Add expectations to `React entrypoint exposes the public React adapter`:

```ts
expect(reactApi.WebGLStagePlane).toEqual(expect.any(Function));
expect(reactApi.WebGLStageBox).toEqual(expect.any(Function));
expect(reactApi.WebGLLight).toEqual(expect.any(Function));
```

- [x] **Step 2: Add failing React type fixture imports**

Extend the React fixture imports:

```tsx
import {
  WebGLCamera,
  WebGLLight,
  WebGLRenderPass,
  WebGLRuntime,
  WebGLScene,
  WebGLStageBox,
  WebGLStagePlane,
  WebGLTarget,
} from "${importPath}";
import type {
  WebGLLightProps,
  WebGLStageBoxProps,
  WebGLStagePlaneProps,
} from "${importPath}";
import type { Light as ThreeLight } from "three/src/lights/Light.js";
import type { Material as ThreeMaterial } from "three/src/materials/Material.js";
import type { Mesh as ThreeMesh } from "three/src/objects/Mesh.js";
```

- [x] **Step 3: Add accepted managed stage component fixture**

Add this JSX inside the existing `levelTwoElement` fixture:

```tsx
<WebGLScene
  id="world.stage"
  projection="perspective-stage"
  render={{ camera: "world.stage.camera", clearDepth: true }}
>
  <WebGLCamera
    id="world.stage.camera"
    default
    type="perspective"
    mode="perspective-stage"
    position={[0, 0, 500]}
    target={[0, 0, 0]}
  />
  <WebGLStagePlane
    id="stage.floor"
    role="floor"
    size={[1200, 800]}
    material={{ kind: "standard", color: "#05070a", roughness: 0.8 }}
  />
  <WebGLStageBox
    id="stage.box"
    size={[120, 80, 120]}
    position={[0, -40, 0]}
    material={{ kind: "basic", color: "#ffffff", opacity: 0.5 }}
  />
  <WebGLLight id="stage.ambient" kind="ambient" intensity={0.2} />
  <WebGLLight
    id="stage.hero"
    kind="point"
    color="#7dd3fc"
    intensity={1.8}
    position={[0, 0, 160]}
  />
</WebGLScene>
```

- [x] **Step 4: Add rejected raw Three props**

Add type assertions that reject raw handles:

```tsx
declare const rawMesh: ThreeMesh;
declare const rawMaterial: ThreeMaterial;
declare const rawLight: ThreeLight;

// @ts-expect-error Stage planes do not accept raw Three mesh handles.
const rawMeshPlaneProps = { id: "raw.plane", mesh: rawMesh } satisfies WebGLStagePlaneProps;

// @ts-expect-error Stage material is a descriptor, not a raw Three material.
const rawMaterialPlaneProps = {
  id: "raw.material",
  material: rawMaterial,
} satisfies WebGLStagePlaneProps;

// @ts-expect-error WebGLLight is a descriptor, not a raw Three light wrapper.
const rawLightProps = { id: "raw.light", light: rawLight } satisfies WebGLLightProps;
```

- [x] **Step 5: Run the focused public export test**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/publicExports.test.ts
```

Expected before implementation: FAIL because the React entrypoint and public types do not exist.

## Task 2: Public Types And Exports

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/types.ts`
- Modify: `packages/dom-webgl-runtime/src/index.ts`

- [x] **Step 1: Add stage and light descriptor types**

Add this public shape near existing scene/camera/pass declarations:

```ts
export type WebGLColorValue = string | number | readonly [number, number, number];

export type WebGLStagePrimitiveKind = "plane" | "box";
export type WebGLStagePlaneRole = "floor" | "wall" | "backdrop";

export type WebGLStageMaterialDeclaration =
  | {
      kind?: "standard";
      color?: WebGLColorValue;
      emissive?: WebGLColorValue;
      emissiveIntensity?: number;
      opacity?: number;
      metalness?: number;
      roughness?: number;
    }
  | {
      kind: "basic";
      color?: WebGLColorValue;
      opacity?: number;
    };

export type WebGLStagePrimitiveBaseDeclaration = {
  id: string;
  sceneId: string;
  position?: WebGLTuple3;
  rotation?: WebGLTuple3;
  scale?: number | WebGLTuple3;
  visible?: boolean;
  material?: WebGLStageMaterialDeclaration;
};

export type WebGLStagePlaneDeclaration = WebGLStagePrimitiveBaseDeclaration & {
  kind: "plane";
  role?: WebGLStagePlaneRole;
  size?: WebGLTuple2;
};

export type WebGLStageBoxDeclaration = WebGLStagePrimitiveBaseDeclaration & {
  kind: "box";
  size?: WebGLTuple3;
};

export type WebGLStagePrimitiveDeclaration =
  | WebGLStagePlaneDeclaration
  | WebGLStageBoxDeclaration;

export type WebGLLightKind = "ambient" | "directional" | "point";

export type WebGLLightDeclaration = {
  id: string;
  sceneId: string;
  kind: WebGLLightKind;
  color?: WebGLColorValue;
  intensity?: number;
  position?: WebGLTuple3;
  target?: WebGLTuple3;
  distance?: number;
  decay?: number;
  visible?: boolean;
};
```

- [x] **Step 2: Add runtime methods to `WebGLRuntime`**

Add methods beside scene/camera/pass registration:

```ts
registerStagePrimitive(declaration: WebGLStagePrimitiveDeclaration): void;
unregisterStagePrimitive(id: string): void;
registerLight(declaration: WebGLLightDeclaration): void;
unregisterLight(id: string): void;
```

- [x] **Step 3: Export public types from the root entrypoint**

Add the new type exports to `packages/dom-webgl-runtime/src/index.ts`:

```ts
type WebGLColorValue,
type WebGLLightDeclaration,
type WebGLLightKind,
type WebGLStageBoxDeclaration,
type WebGLStageMaterialDeclaration,
type WebGLStagePlaneDeclaration,
type WebGLStagePlaneRole,
type WebGLStagePrimitiveDeclaration,
type WebGLStagePrimitiveKind,
```

- [x] **Step 4: Run the focused public export test**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/publicExports.test.ts
```

Expected after this task: still FAIL because React components and runtime methods are not wired yet.

## Task 3: Descriptor Normalization

**Files:**
- Create: `packages/dom-webgl-runtime/src/lib/renderer/stageDeclarations.ts`
- Create: `packages/dom-webgl-runtime/test/lib/renderer/stageDeclarations.test.ts`

- [x] **Step 1: Write failing normalization tests**

Cover these exact cases:

```ts
expect(normalizeStagePrimitiveDeclaration({
  id: "floor",
  sceneId: "world",
  kind: "plane",
  role: "floor",
})).toMatchObject({
  id: "floor",
  sceneId: "world",
  kind: "plane",
  role: "floor",
  size: [1, 1],
  position: [0, 0, 0],
  rotation: [-Math.PI / 2, 0, 0],
  scale: 1,
  visible: true,
  material: {
    kind: "standard",
    color: "#ffffff",
    opacity: 1,
    metalness: 0,
    roughness: 1,
  },
});

expect(normalizeStagePrimitiveDeclaration({
  id: "box",
  sceneId: "world",
  kind: "box",
  size: [2, 3, 4],
  material: { kind: "basic", color: 0xff0000, opacity: 0.5 },
})).toMatchObject({
  id: "box",
  sceneId: "world",
  kind: "box",
  size: [2, 3, 4],
  material: { kind: "basic", color: 0xff0000, opacity: 0.5 },
});

expect(normalizeLightDeclaration({
  id: "hero",
  sceneId: "world",
  kind: "point",
})).toMatchObject({
  id: "hero",
  sceneId: "world",
  kind: "point",
  color: "#ffffff",
  intensity: 1,
  position: [0, 0, 120],
  distance: 0,
  decay: 2,
  visible: true,
});
```

- [x] **Step 2: Add failing diagnostics tests**

Assert these failures:

```ts
expect(() => normalizeStagePrimitiveDeclaration({
  id: " ",
  sceneId: "world",
  kind: "plane",
})).toThrow("WebGL stage primitive declaration requires a non-empty id.");

expect(() => normalizeStagePrimitiveDeclaration({
  id: "floor",
  sceneId: " ",
  kind: "plane",
})).toThrow("WebGL scene declaration requires a non-empty id.");

expect(() => normalizeStagePrimitiveDeclaration({
  id: "bad",
  sceneId: "world",
  kind: "plane",
  size: [Number.NaN, 1],
})).toThrow("WebGL stage plane size must contain finite positive numbers.");

expect(() => normalizeLightDeclaration({
  id: "bad.light",
  sceneId: "world",
  kind: "point",
  intensity: -1,
})).toThrow("WebGL light intensity must be a finite non-negative number.");
```

- [x] **Step 3: Implement pure normalization**

Create normalized internal types and exported functions:

```ts
export type NormalizedStageMaterialDeclaration =
  | {
      kind: "standard";
      color: WebGLColorValue;
      emissive: WebGLColorValue;
      emissiveIntensity: number;
      opacity: number;
      metalness: number;
      roughness: number;
    }
  | {
      kind: "basic";
      color: WebGLColorValue;
      opacity: number;
    };

export type NormalizedStagePrimitiveDeclaration =
  | {
      id: string;
      sceneId: string;
      kind: "plane";
      role?: WebGLStagePlaneRole;
      size: WebGLTuple2;
      position: WebGLTuple3;
      rotation: WebGLTuple3;
      scale: number | WebGLTuple3;
      visible: boolean;
      material: NormalizedStageMaterialDeclaration;
    }
  | {
      id: string;
      sceneId: string;
      kind: "box";
      size: WebGLTuple3;
      position: WebGLTuple3;
      rotation: WebGLTuple3;
      scale: number | WebGLTuple3;
      visible: boolean;
      material: NormalizedStageMaterialDeclaration;
    };

export type NormalizedLightDeclaration = {
  id: string;
  sceneId: string;
  kind: WebGLLightKind;
  color: WebGLColorValue;
  intensity: number;
  position: WebGLTuple3;
  target: WebGLTuple3;
  distance: number;
  decay: number;
  visible: boolean;
};
```

- [x] **Step 4: Run descriptor tests**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/renderer/stageDeclarations.test.ts
```

Expected after implementation: PASS.

## Task 4: Managed Three Stage Object Factory

**Files:**
- Create: `packages/dom-webgl-runtime/src/lib/renderer/managedStageObjects.ts`
- Create: `packages/dom-webgl-runtime/test/lib/renderer/managedStageObjects.test.ts`

- [x] **Step 1: Write failing factory tests with mocked Three constructors**

Mock these imports:

```ts
vi.doMock("three/src/geometries/PlaneGeometry.js", () => ({ PlaneGeometry }));
vi.doMock("three/src/geometries/BoxGeometry.js", () => ({ BoxGeometry }));
vi.doMock("three/src/materials/MeshBasicMaterial.js", () => ({ MeshBasicMaterial }));
vi.doMock("three/src/materials/MeshStandardMaterial.js", () => ({ MeshStandardMaterial }));
vi.doMock("three/src/objects/Mesh.js", () => ({ Mesh }));
vi.doMock("three/src/objects/Group.js", () => ({ Group }));
vi.doMock("three/src/lights/AmbientLight.js", () => ({ AmbientLight }));
vi.doMock("three/src/lights/DirectionalLight.js", () => ({ DirectionalLight }));
vi.doMock("three/src/lights/PointLight.js", () => ({ PointLight }));
vi.doMock("three/src/core/Object3D.js", () => ({ Object3D }));
```

Assert:

```ts
const object = createManagedStagePrimitiveObject(normalizedFloor);

expect(PlaneGeometry).toHaveBeenCalledWith(1200, 800);
expect(MeshStandardMaterial).toHaveBeenCalledWith(expect.objectContaining({
  color: "#05070a",
  roughness: 0.8,
}));
expect(mesh.position.set).toHaveBeenCalledWith(0, -180, 0);
expect(mesh.rotation.set).toHaveBeenCalledWith(-Math.PI / 2, 0, 0);
expect(object.key).toBe("floor");
expect(object.object3D).toBe(mesh);
```

- [x] **Step 2: Assert disposal**

Assert primitive disposal:

```ts
object.dispose();
object.dispose();

expect(geometry.dispose).toHaveBeenCalledTimes(1);
expect(material.dispose).toHaveBeenCalledTimes(1);
```

Assert directional light owns a target object:

```ts
const lightObject = createManagedLightObject(normalizedDirectionalLight);

expect(DirectionalLight).toHaveBeenCalledWith("#ffffff", 1);
expect(group.add).toHaveBeenCalledWith(directionalLight);
expect(group.add).toHaveBeenCalledWith(targetObject);
expect(directionalLight.target).toBe(targetObject);
```

- [x] **Step 3: Implement factory functions**

Expose only internal factory functions:

```ts
export function createManagedStagePrimitiveObject(
  declaration: NormalizedStagePrimitiveDeclaration,
): WebGLSceneObject;

export function createManagedLightObject(
  declaration: NormalizedLightDeclaration,
): WebGLSceneObject;
```

Each returned `WebGLSceneObject` must:

```ts
{
  key: declaration.id,
  object3D,
  setVisible(visible) {
    object3D.visible = visible;
  },
  updateLayout() {
    return;
  },
  dispose() {
    // idempotent cleanup for geometry, material, light target, and groups
  },
}
```

- [x] **Step 4: Run factory tests**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/renderer/managedStageObjects.test.ts
```

Expected after implementation: PASS.

## Task 5: Stage Object Registry

**Files:**
- Create: `packages/dom-webgl-runtime/src/lib/renderer/stageObjectRegistry.ts`
- Create: `packages/dom-webgl-runtime/test/lib/renderer/stageObjectRegistry.test.ts`

- [x] **Step 1: Write failing registry tests**

Create a registry with injected scene adapter lookup and factories:

```ts
const worldAdapter = createSceneAdapter();
const registry = createStageObjectRegistry({
  getSceneAdapter(sceneId) {
    if (sceneId !== "world") {
      throw new Error(`Unknown WebGL scene "${sceneId}".`);
    }
    return worldAdapter;
  },
  createPrimitiveObject(declaration) {
    return createSceneObject(`primitive:${declaration.id}`);
  },
  createLightObject(declaration) {
    return createSceneObject(`light:${declaration.id}`);
  },
});
```

Assert registration and unregistration:

```ts
registry.registerStagePrimitive({
  id: "floor",
  sceneId: "world",
  kind: "plane",
});
registry.registerLight({
  id: "hero",
  sceneId: "world",
  kind: "point",
});

expect(worldAdapter.addObject).toHaveBeenCalledTimes(2);

registry.unregisterStagePrimitive("floor");
registry.unregisterLight("hero");

expect(worldAdapter.removeObject).toHaveBeenCalledTimes(2);
```

- [x] **Step 2: Assert duplicate, missing scene, and scene cleanup**

Add tests:

```ts
expect(() => registry.registerStagePrimitive({
  id: "floor",
  sceneId: "world",
  kind: "plane",
})).toThrow('WebGL stage primitive id "floor" is already registered.');

expect(() => registry.registerLight({
  id: "missing.light",
  sceneId: "missing",
  kind: "ambient",
})).toThrow('Unknown WebGL scene "missing".');

registry.unregisterScene("world");
expect(floorObject.dispose).toHaveBeenCalledTimes(1);
expect(heroLightObject.dispose).toHaveBeenCalledTimes(1);
```

- [x] **Step 3: Implement registry lifecycle**

Create:

```ts
export type StageObjectRegistry = {
  registerStagePrimitive(declaration: WebGLStagePrimitiveDeclaration): void;
  unregisterStagePrimitive(id: string): void;
  registerLight(declaration: WebGLLightDeclaration): void;
  unregisterLight(id: string): void;
  unregisterScene(sceneId: string): void;
  dispose(): void;
};
```

Rules:

- Store primitive ids and light ids in separate maps so `"floor"` primitive and `"floor"` light cannot collide with their own kind but produce clear diagnostics.
- Normalize declarations before object creation.
- Attach through `createSceneObjectController(adapter, object)` so attach/remove/dispose follows existing scene object behavior.
- `unregisterScene(sceneId)` removes all primitives and lights in that scene.
- `dispose()` removes everything exactly once.

- [x] **Step 4: Run registry tests**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/renderer/stageObjectRegistry.test.ts
```

Expected after implementation: PASS.

## Task 6: Runtime Wiring

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/react/WebGLRuntime.tsx`
- Modify: `packages/dom-webgl-runtime/test/lib/renderer/runtimePipeline.test.ts`

- [x] **Step 1: Write failing runtime tests**

Add a test that registers scene, stage primitive, and light:

```ts
const runtime = await createPipelineRuntime({
  renderLayerRegistryFactory: createRegistryWithSceneAdapter(worldAdapter),
});

runtime.registerStagePrimitive({
  id: "floor",
  sceneId: "world",
  kind: "plane",
  material: { kind: "standard", color: "#05070a" },
});
runtime.registerLight({
  id: "hero",
  sceneId: "world",
  kind: "point",
  intensity: 1.8,
  position: [0, 0, 160],
});

expect(worldAdapter.addObject).toHaveBeenCalledTimes(2);
expect(runtime.getDebugState().targetCount).toBe(0);
```

Add a scene unregister test:

```ts
runtime.unregisterScene("world");

expect(worldAdapter.removeObject).toHaveBeenCalledTimes(2);
```

- [x] **Step 2: Instantiate `stageObjectRegistry` inside `createWebGLRuntime`**

Use existing render-layer scene adapter lookup:

```ts
const stageObjects = createStageObjectRegistry({
  getSceneAdapter(sceneId) {
    return renderLayers.getSceneAdapterForTarget(sceneId);
  },
});
```

- [x] **Step 3: Add public runtime methods**

Add methods to the returned runtime object:

```ts
registerStagePrimitive(declaration) {
  if (disposed) {
    throw new Error("Cannot register a WebGL stage primitive after runtime disposal.");
  }

  stageObjects.registerStagePrimitive(declaration);
  rendererLoopRequestFrame("target-register");
  emitDebugState(true);
},
unregisterStagePrimitive(id) {
  stageObjects.unregisterStagePrimitive(id);
  rendererLoopRequestFrame("target-unregister");
  emitDebugState(true);
},
registerLight(declaration) {
  if (disposed) {
    throw new Error("Cannot register a WebGL light after runtime disposal.");
  }

  stageObjects.registerLight(declaration);
  rendererLoopRequestFrame("target-register");
  emitDebugState(true);
},
unregisterLight(id) {
  stageObjects.unregisterLight(id);
  rendererLoopRequestFrame("target-unregister");
  emitDebugState(true);
},
```

- [x] **Step 4: Dispose stage objects before scene/render-layer disposal**

Update scene unregister:

```ts
stageObjects.unregisterScene(sceneId);
unregisterTargetsForScene(sceneId);
renderLayers.unregisterScene(sceneId);
```

Update runtime dispose:

```ts
stageObjects.dispose();
renderLayers.dispose();
```

- [x] **Step 5: Add pending runtime no-op methods**

In `createPendingRuntime()` add:

```ts
registerStagePrimitive() {},
unregisterStagePrimitive() {},
registerLight() {},
unregisterLight() {},
```

- [x] **Step 6: Run focused runtime tests**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/renderer/runtimePipeline.test.ts
```

Expected after implementation: PASS.

## Task 7: React Components

**Files:**
- Create: `packages/dom-webgl-runtime/src/lib/react/WebGLStagePlane.tsx`
- Create: `packages/dom-webgl-runtime/src/lib/react/WebGLStageBox.tsx`
- Create: `packages/dom-webgl-runtime/src/lib/react/WebGLLight.tsx`
- Modify: `packages/dom-webgl-runtime/src/react.ts`
- Create: `packages/dom-webgl-runtime/test/lib/react/WebGLStagePlane.test.tsx`
- Create: `packages/dom-webgl-runtime/test/lib/react/WebGLStageBox.test.tsx`
- Create: `packages/dom-webgl-runtime/test/lib/react/WebGLLight.test.tsx`

- [x] **Step 1: Write failing React registration tests**

For `WebGLStagePlane`, assert inherited scene registration:

```ts
render(
  createElement(WebGLRuntimeProvider, { runtime },
    createElement(WebGLSceneProvider, { sceneId: "world" },
      createElement(WebGLStagePlane, {
        id: "floor",
        role: "floor",
        size: [1200, 800],
      }),
    ),
  ),
);

expect(runtime.registerStagePrimitive).toHaveBeenCalledWith({
  id: "floor",
  sceneId: "world",
  kind: "plane",
  role: "floor",
  size: [1200, 800],
});
```

For explicit scene override:

```ts
createElement(WebGLStageBox, {
  id: "box",
  scene: "overlay",
  size: [1, 2, 3],
});
```

Expect `sceneId: "overlay"`.

For `WebGLLight`:

```ts
createElement(WebGLLight, {
  id: "hero",
  kind: "point",
  intensity: 1.8,
  position: [0, 0, 160],
});
```

Expect `runtime.registerLight(...)` with inherited scene id.

- [x] **Step 2: Assert missing scene diagnostics**

Each component outside a `WebGLScene` and without `scene` prop must throw a controlled message:

```ts
'WebGL stage plane "floor" requires a scene prop or a parent WebGLScene.'
'WebGL stage box "box" requires a scene prop or a parent WebGLScene.'
'WebGL light "hero" requires a scene prop or a parent WebGLScene.'
```

- [x] **Step 3: Implement components**

Use `useContext(WebGLSceneContext)`, `useWebGLRuntime()`, and `useEffect(...)`.

`WebGLStagePlaneProps`:

```ts
export type WebGLStagePlaneProps =
  Omit<WebGLStagePlaneDeclaration, "kind" | "sceneId"> & {
    scene?: string;
  };
```

Registration shape:

```ts
runtime.registerStagePrimitive({
  id,
  sceneId,
  kind: "plane",
  role,
  size,
  position,
  rotation,
  scale,
  visible,
  material,
});
```

Cleanup:

```ts
return () => {
  runtime.unregisterStagePrimitive(id);
};
```

`WebGLStageBox` mirrors plane with `kind: "box"`. `WebGLLight` calls `registerLight` and `unregisterLight`.

- [x] **Step 4: Export React components**

Add to `packages/dom-webgl-runtime/src/react.ts`:

```ts
export {
  WebGLStagePlane,
  type WebGLStagePlaneProps,
} from "./lib/react/WebGLStagePlane";
export {
  WebGLStageBox,
  type WebGLStageBoxProps,
} from "./lib/react/WebGLStageBox";
export {
  WebGLLight,
  type WebGLLightProps,
} from "./lib/react/WebGLLight";
```

- [x] **Step 5: Run focused React tests**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/react/WebGLStagePlane.test.tsx packages/dom-webgl-runtime/test/lib/react/WebGLStageBox.test.tsx packages/dom-webgl-runtime/test/lib/react/WebGLLight.test.tsx
```

Expected after implementation: PASS.

## Task 8: Docs And Roadmap Closeout

**Files:**
- Modify: `README.md`
- Modify: `docs/STATUS.md`
- Modify: `docs/roadmap/managed-render-system.md`
- Modify: `docs/agent/package-onboarding.md`
- Modify: `docs/agent/package-usage.md`

- [x] **Step 1: Update active truth docs after implementation**

Update `docs/STATUS.md`:

- Add managed stage primitives and lights to implemented public surface.
- Move the caveat `named lit stage primitives ... remain future roadmap work` to a narrower caveat: scene-native `WebGLModel` remains future work.
- Keep `screen-plane` caveat as deferred to Phase 8 pre-step.
- Keep `ctx.object.postprocess` caveat unchanged.

- [x] **Step 2: Update package usage docs**

In `docs/agent/package-onboarding.md` and `docs/agent/package-usage.md`, add an opt-in managed stage section after managed scene integration. The docs must state:

- `WebGLTarget` remains the default path.
- Stage primitives are scene-native and have no fallback DOM.
- Stage primitives are declared under `WebGLScene`.
- `WebGLStagePlane`, `WebGLStageBox`, and `WebGLLight` are managed descriptors.
- Consumers must not pass raw Three.js meshes, materials, geometries, lights, scenes, cameras, or renderers.
- `screen-plane` is still not available.

- [x] **Step 3: Update README**

Add a short advanced managed stage example that uses:

```tsx
<WebGLScene id="world" projection="perspective-stage" render={{ camera: "world.camera" }}>
  <WebGLCamera id="world.camera" default type="perspective" mode="perspective-stage" />
  <WebGLStagePlane id="floor" role="floor" material={{ kind: "standard", color: "#05070a" }} />
  <WebGLLight id="hero" kind="point" intensity={1.8} position={[0, 0, 160]} />
</WebGLScene>
```

Keep the Level 1 `WebGLTarget` example before the stage example.

- [x] **Step 4: Update roadmap phase status after implementation**

Only after code and focused verification pass:

- Change Phase 4 from `[planned]` to `[verified]` if tests, docs, and commit are closed.
- Use `[implemented]` if code is done but verification/docs/commit are not closed.
- Keep the Focused Plan link to this file.
- Record `screen-plane` as deferred to Phase 8 pre-step if not already present.

## Testing Strategy

Run focused tests while implementing:

```bash
npm test -- --run packages/dom-webgl-runtime/test/publicExports.test.ts
npm test -- --run packages/dom-webgl-runtime/test/lib/renderer/stageDeclarations.test.ts
npm test -- --run packages/dom-webgl-runtime/test/lib/renderer/managedStageObjects.test.ts
npm test -- --run packages/dom-webgl-runtime/test/lib/renderer/stageObjectRegistry.test.ts
npm test -- --run packages/dom-webgl-runtime/test/lib/renderer/runtimePipeline.test.ts
npm test -- --run packages/dom-webgl-runtime/test/lib/react/WebGLStagePlane.test.tsx packages/dom-webgl-runtime/test/lib/react/WebGLStageBox.test.tsx packages/dom-webgl-runtime/test/lib/react/WebGLLight.test.tsx
```

Run final verification before claiming implementation complete:

```bash
npm run test -- --run
npm run typecheck
npm run build
npm run check:imports
git diff --check
```

Expected final result: all commands pass.

## Exit Criteria

- `WebGLStagePlane`, `WebGLStageBox`, and `WebGLLight` are public React descriptor components.
- Vanilla runtime can register/unregister stage primitives and lights with descriptor data.
- A standard-material floor/backdrop and a point light can coexist in one managed scene with GLB model targets without raw Three handles in public API.
- `dom/element` surfaces remain canvas texture planes and are not lit by stage lights.
- Geometry, material, light, directional target, group, and scene object resources are disposed exactly once on unregister, scene unregister, and runtime dispose.
- `screen-plane` is not implemented in Phase 4 and is explicitly documented as a Phase 8 pre-step follow-up.
- Active docs explain Level 1 default usage first and managed stage primitives as opt-in escalation.
- Public export/type tests reject raw Three.js mesh/material/light handles.
- Roadmap Phase 4 moves from `[planned]` to `[verified]` only after tests, docs, and commit are closed.

## Risks

- React effect ordering: `WebGLScene` uses `useLayoutEffect`; stage/light components should use `useEffect` so parent scene registration is available before child registration.
- Directional light target ownership: Three directional lights need a target object; the factory should attach a managed target object in an internal group and dispose it with the light wrapper.
- Stage aliases can become magical: keep `role` defaults limited to rotation and semantic labeling; do not add hidden camera, pass, material, or lighting behavior.
- Material descriptor drift: descriptor defaults should mirror existing effect material semantics where possible but must remain static declaration data.
- Scene unregistration order: stage objects must unregister before the scene adapter is disposed so registry maps do not retain detached objects.
- `screen-plane` pressure: do not mix ray/plane projection into this implementation loop; keep the follow-up explicit.

## Self-Review

- Spec coverage: Phase 4 scope, non-goals, API/architecture principles, implementation steps, testing strategy, docs updates, exit criteria, risks, and `screen-plane` decision are covered.
- Wording scan: no unfinished marker text, unchecked design gaps, or generic test-writing steps remain; each task names files and concrete assertions.
- Type consistency: public names use `WebGLStagePlane`, `WebGLStageBox`, `WebGLLight`, `WebGLStagePrimitiveDeclaration`, and `WebGLLightDeclaration` consistently across tasks.
