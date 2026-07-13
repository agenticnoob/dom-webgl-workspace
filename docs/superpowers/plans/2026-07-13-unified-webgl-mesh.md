# Unified WebGLMesh Mental Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the public `WebGLStagePlane` / `WebGLStageBox` split with one agent-friendly `WebGLMesh` declaration that supports common built-in geometries and one narrowly scoped custom `BufferGeometry` factory.

**Architecture:** `WebGLMesh` is the only public procedural-mesh declaration. Consumers choose a discriminated `geometry` descriptor; the runtime normalizes it, creates and owns the Three.js geometry/material/object, registers it in the existing scene-object pipeline, and disposes it. The only raw-Three escape hatch is `geometry.kind: "custom"` returning a newly owned `BufferGeometry`; scene, renderer, camera, `Object3D`, material, scheduling, and disposal remain runtime-owned.

**Tech Stack:** TypeScript, React, Three.js, Vitest, npm workspaces.

## Global Constraints

- This is an intentional alpha breaking change. Remove `WebGLStagePlane`, `WebGLStageBox`, `WebGLStagePrimitive*`, `registerStagePrimitive`, `unregisterStagePrimitive`, and `"stage/plane" | "stage/box"` from the final public API. Tasks 1-5 may keep the existing implementation beside the new path so every task commit remains buildable; do not add new deprecated aliases or compatibility wrappers, and remove the old path atomically in Task 6.
- Scope is only the procedural mesh authoring model. Do not redesign Effect, Scene, Camera, Model, Light, Scroll, Physics, RenderPass, or raw scene-graph APIs.
- Keep the agent decision tree explicit: DOM-backed visual -> `WebGLTarget`; procedural geometry -> `WebGLMesh`; GLB asset -> `WebGLModel`.
- Built-in geometry kinds are `plane`, `box`, `sphere`, `cylinder`, `cone`, and `tetrahedron`. Advanced geometry uses `custom`.
- The custom factory returns a fresh `BufferGeometry` instance for that mesh registration. The runtime validates, prepares, owns, and disposes it exactly once. A consumer that imports Three.js to build custom geometry should declare `three` as its own dependency.
- Preserve existing scene inheritance, transform, material, timeline, effect, interaction, picking, physics binding, render-pass membership, and screen-plane behavior. Physics colliders remain explicit and are not inferred from visual geometry.
- Rename public `Stage` terminology to `Mesh`; internal file names may remain temporarily where renaming would create unrelated churn, but symbols, errors, debug fields, and public docs must use `mesh` consistently.
- Keep module import SSR-safe: do not invoke custom factories or touch browser globals during module evaluation.
- Follow repository conventions: factory functions and object literals, no new classes, exhaustive discriminated-union switches without `default`, `satisfies` instead of unsafe casts, and idempotent disposal.
- Keep `apps/example` on public package imports only. Do not add app-specific branches to runtime code.
- Do not bump a package version, publish, deploy, or redesign package dependency topology in this work.
- Preserve the pre-existing modification in `apps/hero-next/next-env.d.ts`; never stage or overwrite it.
- During implementation, commit task-sized verified changes only after the user selects an execution workflow. This planning turn itself does not stage or commit.

---

## Public Contract to Implement

The primary React call should read as one concept:

```tsx
<WebGLMesh
  id="hero.shape"
  geometry={{ kind: "tetrahedron", radius: 1, detail: 0 }}
  material={{
    kind: "standard",
    color: "#f5f1e8",
    roughness: 0.72,
    metalness: 0.08,
  }}
/>
```

`scene` remains optional when nested under `WebGLScene` and required otherwise. Plane and box become geometry choices rather than components:

```tsx
<WebGLMesh
  id="studio.floor"
  geometry={{ kind: "plane", role: "floor", size: [12, 8] }}
/>

<WebGLMesh
  id="studio.plinth"
  geometry={{ kind: "box", size: [2, 1, 2] }}
/>
```

The public declaration types should be equivalent to:

```ts
import type { BufferGeometry } from "three";

export type WebGLPlaneRole = "floor" | "wall" | "backdrop";

export type WebGLMeshGeometryDeclaration =
  | {
      kind: "plane";
      role?: WebGLPlaneRole;
      size?: WebGLTuple2;
    }
  | {
      kind: "box";
      size?: WebGLTuple3;
    }
  | {
      kind: "sphere";
      radius?: number;
      widthSegments?: number;
      heightSegments?: number;
    }
  | {
      kind: "cylinder";
      radiusTop?: number;
      radiusBottom?: number;
      height?: number;
      radialSegments?: number;
      heightSegments?: number;
      openEnded?: boolean;
    }
  | {
      kind: "cone";
      radius?: number;
      height?: number;
      radialSegments?: number;
      heightSegments?: number;
      openEnded?: boolean;
    }
  | {
      kind: "tetrahedron";
      radius?: number;
      detail?: number;
    }
  | {
      kind: "custom";
      create: () => BufferGeometry;
    };

export type WebGLMeshMaterialDeclaration =
  | {
      kind?: "standard";
      isMaterial?: never;
      color?: WebGLColorValue;
      emissive?: WebGLColorValue;
      emissiveIntensity?: number;
      opacity?: number;
      metalness?: number;
      roughness?: number;
    }
  | {
      kind: "basic";
      isMaterial?: never;
      color?: WebGLColorValue;
      opacity?: number;
    };

export type WebGLMeshDeclaration = {
  id: string;
  sceneId: string;
  geometry: WebGLMeshGeometryDeclaration;
  position?: WebGLTuple3;
  rotation?: WebGLTuple3;
  scale?: number | WebGLTuple3;
  visible?: boolean;
  material?: WebGLMeshMaterialDeclaration;
  timeline?: WebGLTimelineBindingDeclaration;
  effects?: WebGLEffectsDeclaration;
  interaction?: WebGLSceneObjectInteractionDeclaration;
  physics?: WebGLPhysicsDeclaration;
};
```

The imperative runtime surface becomes:

```ts
runtime.registerMesh(declaration);
runtime.unregisterMesh(id);
```

All procedural meshes expose one effect source kind:

```ts
type WebGLSceneObjectEffectSourceKind = "model/glb" | "mesh";
```

The debug surface becomes `meshCount` and `meshes`. `WebGLDebugMeshSummary` preserves the current diagnostic fields—`id`, `sceneId`, optional `timeline`, optional `effects`, and optional `interaction`—and replaces primitive `kind` with `geometryKind`. Do not preserve `stagePrimitiveCount` or `stagePrimitives` aliases.

The advanced escape hatch is deliberately narrower than exposing raw Three.js:

```tsx
import { TetrahedronGeometry } from "three";

const customGeometry = {
  kind: "custom",
  create: () => new TetrahedronGeometry(1, 1),
} satisfies WebGLMeshGeometryDeclaration;

<WebGLMesh id="hero.custom" geometry={customGeometry} />;
```

The factory must return a new instance rather than a shared singleton because runtime unregistration owns disposal.

---

## Task 1: Introduce the WebGLMesh Declaration Contract

**Files:**

- Modify: `packages/dom-webgl-runtime/test/publicExports.test.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/types.ts`
- Modify: `packages/dom-webgl-runtime/src/index.ts`

- [x] Add compile fixtures that import `WebGLMeshDeclaration`, `WebGLMeshGeometryDeclaration`, `WebGLMeshMaterialDeclaration`, and `WebGLPlaneRole` from the root entry point. React component and runtime/debug exports are introduced in later tasks.
- [x] Add positive type cases for every built-in geometry kind, the custom `BufferGeometry` factory, scene id, material, effects, interaction, and physics.
- [x] Add `@ts-expect-error` cases for an unknown geometry kind, missing custom `create`, non-`BufferGeometry` custom return, and invalid tuple dimensions. Old source-kind and export-removal assertions belong to Task 6, after runtime and consumers have migrated.
- [x] Run the public export test and confirm it fails because the new surface is not implemented:

```bash
npm test -- --run packages/dom-webgl-runtime/test/publicExports.test.ts
```

Expected: non-zero exit with missing mesh declaration exports.

- [x] Implement and export the public geometry, material, and declaration types exactly as defined above. Keep the existing Stage types temporarily so the current runtime remains buildable until Task 6.
- [x] Keep `BufferGeometry` as a type-only import so importing the package does not eagerly evaluate additional Three.js modules.
- [x] Re-run the focused test:

```bash
npm test -- --run packages/dom-webgl-runtime/test/publicExports.test.ts
npm run typecheck -w @viselora/dom-webgl
```

Expected: exit 0.

- [x] Commit after focused verification:

```bash
git add packages/dom-webgl-runtime/test/publicExports.test.ts packages/dom-webgl-runtime/src/lib/types.ts packages/dom-webgl-runtime/src/index.ts
git commit -m "feat: define unified WebGLMesh public contract"
```

## Task 2: Normalize Every Mesh Geometry Deterministically

**Files:**

- Modify: `packages/dom-webgl-runtime/test/lib/renderer/stageDeclarations.test.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/stageDeclarations.ts`

- [x] Add `normalizeMeshDeclaration` cases for common fields and all seven geometry variants. Keep the existing Stage primitive normalization tests until Task 6 so this commit does not break current consumers.
- [x] Lock these defaults in tests:

```ts
const expectedDefaults = {
  plane: { size: [1, 1] },
  box: { size: [1, 1, 1] },
  sphere: { radius: 1, widthSegments: 32, heightSegments: 16 },
  cylinder: {
    radiusTop: 1,
    radiusBottom: 1,
    height: 1,
    radialSegments: 32,
    heightSegments: 1,
    openEnded: false,
  },
  cone: {
    radius: 1,
    height: 1,
    radialSegments: 32,
    heightSegments: 1,
    openEnded: false,
  },
  tetrahedron: { radius: 1, detail: 0 },
};
```

- [x] Preserve plane-role rotation defaults: floor -> `[-Math.PI / 2, 0, 0]`; wall/backdrop -> `[0, 0, 0]`; an explicit rotation always wins.
- [x] Add failure cases for blank ids, blank scene ids, non-positive tuple sizes, non-positive sphere/cone/tetrahedron radii and heights, negative cylinder radii, segment counts below Three.js-safe minimums, non-integer segments/detail, non-finite values, and missing/non-function custom factories. Cylinder top or bottom radius may be zero, but not both at once.
- [x] Define segment minimums explicitly: sphere `widthSegments >= 3`, sphere `heightSegments >= 2`, cylinder/cone `radialSegments >= 3`, `heightSegments >= 1`, tetrahedron `detail >= 0`.
- [x] Run the focused test and observe failure on the old two-kind normalizer:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/renderer/stageDeclarations.test.ts
```

Expected: non-zero exit because `normalizeMeshDeclaration` and the extra variants do not exist.

- [x] Add a discriminated `NormalizedMeshDeclaration` whose common fields stay at the top level and whose `geometry` preserves the public discriminator with all defaults filled. Keep the old normalizer temporarily; Task 6 removes it after the registry and consumers switch.
- [x] Rename material normalization symbols and error messages from `stage material` to `mesh material`.
- [x] Keep light normalization behavior unchanged in this file.
- [x] Use exhaustive switches for both public and normalized geometry unions; do not add a `default` branch.
- [x] Re-run the focused test and confirm exit 0.
- [x] Commit:

```bash
git add packages/dom-webgl-runtime/test/lib/renderer/stageDeclarations.test.ts packages/dom-webgl-runtime/src/lib/renderer/stageDeclarations.ts
git commit -m "feat: normalize WebGLMesh geometry descriptors"
```

## Task 3: Create and Own Built-in and Custom BufferGeometry

**Files:**

- Modify: `packages/dom-webgl-runtime/test/lib/renderer/managedStageObjects.test.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/managedStageObjects.ts`

- [ ] Add `createManagedMeshObject` tests for `PlaneGeometry`, `BoxGeometry`, `SphereGeometry`, `CylinderGeometry`, `ConeGeometry`, and `TetrahedronGeometry` constructor arguments. Keep old managed primitive tests until the final migration.
- [ ] Add a custom-factory test proving the factory is called exactly once per registration and its returned geometry is attached to the runtime-owned `Mesh`.
- [ ] Add a failure test where `create` returns a non-geometry object; require this error:

```text
WebGL mesh "<id>" custom geometry factory must return a Three.js BufferGeometry.
```

- [ ] Add disposal tests proving geometry and material are each disposed once even when the managed object is disposed twice.
- [ ] Add preparation tests proving a valid custom triangle without normals receives computed vertex normals, and missing bounding box/sphere values are computed once for picking/layout consumers.
- [ ] Run the focused test and confirm it fails before implementation:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/renderer/managedStageObjects.test.ts
```

- [ ] Import Three.js geometry constructors from their source modules, matching existing SSR-safe import practice.
- [ ] Implement `createManagedMeshObject` with an exhaustive geometry switch. For `custom`, invoke `create` inside object creation, validate `geometry.isBufferGeometry === true`, compute missing normals/bounds, and transfer ownership to the managed object only after validation succeeds.
- [ ] Do not expose the created `Mesh`, geometry, or material through public APIs.
- [ ] Re-run the focused test and confirm exit 0.
- [ ] Commit:

```bash
git add packages/dom-webgl-runtime/test/lib/renderer/managedStageObjects.test.ts packages/dom-webgl-runtime/src/lib/renderer/managedStageObjects.ts
git commit -m "feat: create runtime-owned WebGLMesh geometry"
```

## Task 4: Add Mesh Registry, Runtime, Effects, Debug, Picking, and Physics Wiring

**Files:**

- Modify: `packages/dom-webgl-runtime/test/lib/renderer/stageObjectRegistry.test.ts`
- Modify: `packages/dom-webgl-runtime/test/lib/renderer/runtimePipeline.test.ts`
- Modify: `packages/dom-webgl-runtime/test/lib/debug/debugState.test.ts`
- Modify: `packages/dom-webgl-runtime/test/lib/effects/sceneObjectEffectController.test.ts`
- Modify: `packages/dom-webgl-runtime/test/lib/renderer/interactionRouter.test.ts`
- Modify: `packages/dom-webgl-runtime/test/lib/renderer/physicsWorld.test.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/stageObjectRegistry.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/debug/debugState.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/types.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/effects/effectAuthoring.ts`

- [ ] Add registry tests for `registerMesh` / `unregisterMesh` and all geometry discriminators. Assert duplicate-id, missing-scene, scene-removal, effect lifecycle, visibility, render-pass membership, and disposal behavior remain unchanged. Keep old primitive tests temporarily.
- [ ] Add a regression test proving a custom factory is not invoked when its scene registration fails, and is invoked/disposed once on successful register/unregister.
- [ ] Add effect-controller tests so the new procedural geometry path reports source kind `"mesh"`; model effects continue to report `"model/glb"`. Existing Stage source kinds remain only until Task 6.
- [ ] Add debug assertions for `meshCount` and `meshes`, and assert each summary includes `geometryKind`. Remove old debug fields in Task 6.
- [ ] Preserve screen-plane placement only when `geometry.kind === "plane"`; rename the internal reader to `readMeshPlane` and make non-plane ids return `undefined`.
- [ ] Keep picking based on the managed Three.js object so built-in and custom meshes work without new public picking APIs.
- [ ] Keep physics declarations and collider resolution independent of geometry kind; add a sphere-visual/box-collider case to prove no implicit collider inference was introduced.
- [ ] Run the affected tests and observe failures on the old registry contract:

```bash
npm test -- --run \
  packages/dom-webgl-runtime/test/lib/renderer/stageObjectRegistry.test.ts \
  packages/dom-webgl-runtime/test/lib/renderer/runtimePipeline.test.ts \
  packages/dom-webgl-runtime/test/lib/debug/debugState.test.ts \
  packages/dom-webgl-runtime/test/lib/effects/sceneObjectEffectController.test.ts \
  packages/dom-webgl-runtime/test/lib/renderer/interactionRouter.test.ts \
  packages/dom-webgl-runtime/test/lib/renderer/physicsWorld.test.ts
```

- [ ] Add mesh maps, entry types, methods, source-kind routing, errors, and debug assembly using mesh terminology. Reuse shared scene-object helpers rather than duplicating behavior. Retain old primitive entry points only until Task 6.
- [ ] Register a normalized declaration only after scene validation and managed-object creation succeed; on any failure, leave registry maps and scene children unchanged.
- [ ] Update runtime delegation and debug-state construction to the new methods/fields.
- [ ] Re-run the six focused tests and confirm exit 0.
- [ ] Commit:

```bash
git add packages/dom-webgl-runtime/test/lib/renderer/stageObjectRegistry.test.ts packages/dom-webgl-runtime/test/lib/renderer/runtimePipeline.test.ts packages/dom-webgl-runtime/test/lib/debug/debugState.test.ts packages/dom-webgl-runtime/test/lib/effects/sceneObjectEffectController.test.ts packages/dom-webgl-runtime/test/lib/renderer/interactionRouter.test.ts packages/dom-webgl-runtime/test/lib/renderer/physicsWorld.test.ts packages/dom-webgl-runtime/src/lib/renderer/stageObjectRegistry.ts packages/dom-webgl-runtime/src/lib/renderer/runtime.ts packages/dom-webgl-runtime/src/lib/debug/debugState.ts packages/dom-webgl-runtime/src/lib/types.ts packages/dom-webgl-runtime/src/lib/effects/effectAuthoring.ts
git commit -m "refactor: route procedural objects through WebGLMesh"
```

## Task 5: Add WebGLMesh Beside the Existing React Components

**Files:**

- Create: `packages/dom-webgl-runtime/src/lib/react/WebGLMesh.tsx`
- Create: `packages/dom-webgl-runtime/test/lib/react/WebGLMesh.test.tsx`
- Modify: `packages/dom-webgl-runtime/test/publicExports.test.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/react/WebGLRuntime.tsx`
- Modify: `packages/dom-webgl-runtime/src/react.ts`
- Modify: `packages/dom-webgl-runtime/test/lib/react/WebGLRuntime.test.tsx`
- Modify as required by compile fallout: the other React tests under `packages/dom-webgl-runtime/test/lib/react/`

- [ ] Write `WebGLMesh.test.tsx` first. Cover explicit `scene`, inherited `WebGLScene`, missing-scene error, full declaration forwarding, unregister-on-unmount, and re-registration when a declaration prop changes.
- [ ] Require this missing-scene error:

```text
WebGL mesh "<id>" requires a scene prop or a parent WebGLScene.
```

- [ ] Run the new focused test and confirm it fails because the component is absent:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/react/WebGLMesh.test.tsx
```

- [ ] Implement `WebGLMeshProps` as `Omit<WebGLMeshDeclaration, "sceneId"> & { scene?: string }` and forward one declaration to `runtime.registerMesh`.
- [ ] Preserve the existing declarative lifecycle: cleanup unregisters by id; changed declaration references re-register. Document that reusable custom `geometry` descriptors should be module constants or memoized.
- [ ] Change the pending runtime stub in `WebGLRuntime.tsx` to expose no-op `registerMesh` / `unregisterMesh`; retain the old no-op methods until Task 6.
- [ ] Export `WebGLMesh` and `WebGLMeshProps` from `@viselora/dom-webgl/react`. Keep the two old component exports only until current consumers migrate in Task 6.
- [ ] Add public export fixtures for `WebGLMesh` and `WebGLMeshProps`; final absence assertions for the old components remain in Task 6.
- [ ] Run all React adapter tests:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/react
npm test -- --run packages/dom-webgl-runtime/test/publicExports.test.ts
```

Expected: exit 0.

- [ ] Commit:

```bash
git add packages/dom-webgl-runtime/src/lib/react packages/dom-webgl-runtime/src/react.ts packages/dom-webgl-runtime/test/lib/react packages/dom-webgl-runtime/test/publicExports.test.ts
git commit -m "feat: add the WebGLMesh React component"
```

## Task 6: Migrate Consumers and Atomically Remove the Old Public Model

**Files:**

- Modify: `apps/example/src/App.tsx`
- Modify: `apps/example/src/ManagedInteractionExample.tsx`
- Modify: `apps/example/src/ManagedPhysicsExample.tsx`
- Create: `apps/example/src/ManagedMeshExample.tsx`
- Delete: `apps/example/src/ManagedStagePrimitiveExample.tsx`
- Modify: `apps/example/src/ManagedTimelineExample.tsx`
- Modify: `apps/example/src/interactionEffects.ts`
- Modify: `apps/example/test/App.test.tsx`
- Modify: `apps/example/test/ManagedInteractionExample.test.tsx`
- Modify: `apps/example/test/ManagedPhysicsExample.test.tsx`
- Create: `apps/example/test/ManagedMeshExample.test.tsx`
- Delete: `apps/example/test/ManagedStagePrimitiveExample.test.tsx`
- Modify: `apps/example/test/ManagedTimelineExample.test.tsx`
- Modify: `apps/example/test/interactionEffects.test.ts`
- Modify: `scripts/external-consumer-fixture.mjs`
- Modify: `test/external-consumer-fixture.test.ts`
- Modify: `packages/dom-webgl-runtime/test/publicExports.test.ts`
- Modify: `packages/dom-webgl-runtime/test/lib/renderer/stageDeclarations.test.ts`
- Modify: `packages/dom-webgl-runtime/test/lib/renderer/managedStageObjects.test.ts`
- Modify: `packages/dom-webgl-runtime/test/lib/renderer/stageObjectRegistry.test.ts`
- Modify: `packages/dom-webgl-runtime/test/lib/renderer/runtimePipeline.test.ts`
- Modify: `packages/dom-webgl-runtime/test/lib/debug/debugState.test.ts`
- Modify: `packages/dom-webgl-runtime/test/lib/effects/sceneObjectEffectController.test.ts`
- Modify: `packages/dom-webgl-runtime/test/lib/react/WebGLRuntime.test.tsx`
- Modify: `packages/dom-webgl-runtime/src/lib/types.ts`
- Modify: `packages/dom-webgl-runtime/src/index.ts`
- Modify: `packages/dom-webgl-runtime/src/react.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/effects/effectAuthoring.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/react/WebGLRuntime.tsx`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/stageDeclarations.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/managedStageObjects.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/stageObjectRegistry.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/debug/debugState.ts`
- Delete: `packages/dom-webgl-runtime/src/lib/react/WebGLStagePlane.tsx`
- Delete: `packages/dom-webgl-runtime/src/lib/react/WebGLStageBox.tsx`
- Delete: `packages/dom-webgl-runtime/test/lib/react/WebGLStagePlane.test.tsx`
- Delete: `packages/dom-webgl-runtime/test/lib/react/WebGLStageBox.test.tsx`

- [ ] Update tests first to expect `WebGLMesh`, `geometry={{ kind: ... }}`, and effect source `"mesh"`.
- [ ] Add one tetrahedron example using the built-in descriptor; it must not import Three.js.
- [ ] Add one packed-consumer custom geometry compile fixture that imports a Three.js geometry constructor, declares `three` directly in the fixture package manifest, and returns it through `geometry.kind: "custom"`.
- [ ] Run the focused app and fixture tests and confirm they fail against the old examples:

```bash
npm test -- --run apps/example/test test/external-consumer-fixture.test.ts
```

- [ ] Replace all plane/box component calls with `WebGLMesh`; keep existing ids, transforms, effects, interactions, physics, and user-visible behavior.
- [ ] Rename `ManagedStagePrimitiveExample` to `ManagedMeshExample`, rename its test, and update navigation/imports atomically. Do not rename unrelated stage concepts such as scenes, lights, cameras, or render passes.
- [ ] Use module-scope constants for geometry descriptors reused across renders. Inline literal descriptors are allowed for static one-shot examples, but custom factories must be stable and return a fresh geometry per call.
- [ ] Change interaction-effect source filters from `"stage/plane" | "stage/box"` to `"mesh"`.
- [ ] Delete the old React components/tests, Stage declaration/normalization/managed-object paths, primitive registry/runtime methods, old debug fields, old effect source kinds, and all old root/react exports.
- [ ] Extend `publicExports.test.ts` with `WebGLMesh`, `WebGLMeshProps`, runtime/debug exports, and `@ts-expect-error` coverage for `"stage/plane"`. Add export-boundary assertions proving old Stage symbols are absent.
- [ ] Verify import boundaries:

```bash
npm test -- --run apps/example/test test/external-consumer-fixture.test.ts
npm run check:imports
npm run typecheck
```

Expected: all three commands exit 0; no example imports runtime internals.

- [ ] Commit:

```bash
git add apps/example scripts/external-consumer-fixture.mjs test/external-consumer-fixture.test.ts packages/dom-webgl-runtime/src packages/dom-webgl-runtime/test
git commit -m "refactor: migrate consumers to WebGLMesh"
```

## Task 7: Make WebGLMesh the Canonical Agent Guidance

**Files:**

- Modify: `README.md`
- Modify: `docs/STATUS.md`
- Modify: `docs/roadmap/managed-render-system.md`
- Modify: `docs/agent/package-onboarding.md`
- Modify: `docs/agent/package-usage.md`
- Modify: `docs/consumer-standard-usage.md`
- Modify: `docs/examples/effect-authoring.md`
- Modify: `apps/hero-next/AGENTS.md`
- Modify: `skills/viselora-dom-webgl/SKILL.md`
- Modify: `skills/viselora-dom-webgl/references/architecture-rules.md`
- Modify: `skills/viselora-dom-webgl/references/capability-status.md`
- Modify: `skills/viselora-dom-webgl/references/public-api.md`
- Modify: `skills/viselora-dom-webgl/references/api-scenes-models.md`
- Modify: `skills/viselora-dom-webgl/references/api-coverage.json`
- Regenerate: `skills/viselora-dom-webgl/references/api-surface.generated.md`

- [ ] Update active docs to teach exactly this three-way choice near their first usage guidance:

```text
DOM-backed visual -> WebGLTarget
Procedural 3D geometry -> WebGLMesh
GLB asset -> WebGLModel
```

- [ ] Show one built-in tetrahedron example before advanced customization. List all built-in geometry kinds and their default values in the reference docs.
- [ ] Document custom geometry as an advanced escape hatch: it exposes only a factory returning a fresh `BufferGeometry`; it does not grant access to scene, renderer, camera, `Object3D`, material, loader, render targets, lifecycle, or scheduling.
- [ ] Update wording that currently says raw Three.js is never allowed so it accurately describes this narrow exception without weakening the general ownership boundary.
- [ ] Document disposal ownership, direct `three` dependency guidance for custom users, stable React descriptor references, SSR timing, and explicit physics colliders.
- [ ] Update `apps/hero-next/AGENTS.md` from the old “planes and boxes only” limitation to current WebGLMesh truth. Do not touch `apps/hero-next/next-env.d.ts`.
- [ ] Update the roadmap current-truth section. Do not rewrite archived plans/specs as if history had used the new API. Active guidance must use only the current Mesh terminology even when it links to historical evidence.
- [ ] Update API coverage records for added/removed symbols, then regenerate the public API surface:

```bash
npm run skill:api:generate
npm run verify:skill
```

Expected: both commands exit 0 and generated output contains `WebGLMesh` but no current `WebGLStagePlane` / `WebGLStageBox` export.

- [ ] Run a focused stale-guidance scan:

```bash
rg -n 'WebGLStage(Plane|Box)|stage/(plane|box)|registerStagePrimitive|stagePrimitiveCount|stagePrimitives' \
  README.md docs/STATUS.md docs/roadmap/managed-render-system.md docs/agent docs/consumer-standard-usage.md docs/examples apps/hero-next/AGENTS.md skills/viselora-dom-webgl \
  -g '!docs/archive/**' -g '!docs/superpowers/plans/**' -g '!docs/superpowers/specs/**'
```

Expected: no matches.

- [ ] Commit:

```bash
git add README.md docs/STATUS.md docs/roadmap/managed-render-system.md docs/agent docs/consumer-standard-usage.md docs/examples/effect-authoring.md apps/hero-next/AGENTS.md skills/viselora-dom-webgl
git commit -m "docs: teach the unified WebGLMesh model"
```

## Task 8: Verify the Breaking Migration End to End

**Files:**

- Review: all files changed in Tasks 1-7
- Preserve unstaged: `apps/hero-next/next-env.d.ts`

- [ ] Run the repository-required verification sequence:

```bash
npm run test -- --run
npm run typecheck
npm run build
npm run check:imports
npm run verify:skill
npm run verify:tarballs
npm run verify:consumer
git diff --check
```

Expected: every command exits 0.

- [ ] Scan implementation and current consumer surfaces for old public names:

```bash
rg -n 'WebGLStage(Plane|Box)|WebGLStagePrimitive|registerStagePrimitive|unregisterStagePrimitive|stage/(plane|box)|stagePrimitiveCount|stagePrimitives' \
  packages/dom-webgl-runtime/src packages/dom-webgl-runtime/test apps/example scripts test README.md docs/STATUS.md docs/agent docs/consumer-standard-usage.md docs/examples skills/viselora-dom-webgl apps/hero-next/AGENTS.md \
  -g '!docs/archive/**' -g '!docs/superpowers/plans/**' -g '!docs/superpowers/specs/**'
```

Expected: no matches.

- [ ] Scan the implementation and guidance for unfinished markers:

```bash
rg -n 'T[D]O|T[B]D|FIX[M]E|implement lat[e]r|place[h]older' \
  packages/dom-webgl-runtime/src packages/dom-webgl-runtime/test apps/example README.md docs/STATUS.md docs/agent docs/consumer-standard-usage.md docs/examples skills/viselora-dom-webgl
```

Expected: no newly introduced matches.

- [ ] Inspect final worktree state:

```bash
git status --short
git diff --stat HEAD
```

Expected: the known `apps/hero-next/next-env.d.ts` user modification remains untouched and unstaged; no generated junk, secrets, tarballs, or temporary files are included.

- [ ] Review the final diff for these acceptance criteria:

  - A first-time agent can choose `WebGLTarget`, `WebGLMesh`, or `WebGLModel` without learning plane/box-specific components.
  - A tetrahedron requires no raw Three.js.
  - A geometry outside the built-in catalog is possible through one typed `BufferGeometry` factory.
  - Raw scene, renderer, camera, object, and material ownership are still unavailable.
  - Runtime ownership and double-dispose safety are tested.
  - Existing interaction, effects, physics, screen-plane, render-pass, timeline, and scene inheritance behavior is preserved.
  - Old public Stage primitive symbols are removed from code, tests, generated API truth, examples, and active guidance.

- [ ] Full verification should not rewrite tracked files after Task 7. If it does, inspect the cause and return to the owning task instead of hiding the change in a catch-all commit. Do not create an empty commit, and do not stage `apps/hero-next/next-env.d.ts`.

---

## Definition of Done

- `WebGLMesh` is the sole public procedural mesh component and imperative registration model.
- Plane and box are geometry descriptors, not separate components.
- Sphere, cylinder, cone, and tetrahedron work through runtime-owned built-ins.
- Custom `BufferGeometry` works through a validated factory with explicit ownership/disposal semantics.
- Effect matching uses `"mesh"`; debug state uses `meshCount` / `meshes` / `geometryKind`.
- Existing visual-object behaviors remain covered by regression tests.
- Public examples, external consumer verification, active docs, the Viselora skill, and generated API truth all teach the same mental model.
- Full repository, package, tarball, skill, consumer, import-boundary, and diff checks pass.
- No publish/version bump is performed, and the user's existing `apps/hero-next/next-env.d.ts` edit is untouched.
