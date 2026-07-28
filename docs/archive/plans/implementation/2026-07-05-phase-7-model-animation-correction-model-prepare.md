# Phase 7 Model Animation Correction And Model Prepare Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the Phase 7 managed model animation verification gap by making `Sprint.glb` visibly animate through `WebGLModel`, cloning skinned GLB scenes safely, and adding a minimal managed model prepare path that reduces first-visible render stalls without exposing raw Three.js objects.

**Architecture:** Keep the React authoring model declarative: `WebGLModel` remains a null descriptor component nested under `WebGLScene`, with props compiling into runtime descriptors. Correctness is split across three small seams: app dogfood declares the correct clip, model scene instantiation chooses a skeleton-safe clone internally, and the model registry/runtime coordinate a descriptor-only render warmup. Public API stays agent-first and managed: no renderer, scene, camera, Object3D, Mesh, Material, Texture, render target, mixer, action, skeleton, or render-loop handles escape.

**Tech Stack:** TypeScript, React descriptor adapters, Three.js internals hidden behind runtime modules, Vitest/jsdom, Playwright browser smoke, npm workspaces, existing managed scene/pass/model registries.

---

## Context Verified For This Plan

- Current `apps/example/src/ManagedModelAnimationExample.tsx` used `Sprint.glb` with a non-representative sub-rig default clip.
- `Sprint.glb` contains 222 animation clips. The previous sub-rig clip has 5 channels and mostly covers the bag rig. `MainSkeleton.001` has 100 channels and covers the main character skeleton.
- Current `packages/dom-webgl-runtime/src/lib/render/renderables/modelSceneObjects.ts` clones model scenes with `scene.clone()`. For skinned GLB assets this is not sufficient because cloned skinned meshes can remain coupled to the wrong skeleton unless cloned through Three's skeleton-safe clone helper.
- Current `WebGLModel` has descriptor animation support, but no `WebGLTarget` lifecycle. That boundary is intentional. This plan must not copy `WebGLTarget.lifecycle` semantics onto scene-native models.
- Current resource warming in `apps/example/src/exampleResourceScheduler.ts` only `fetch(...)`-warms `/models/hero.glb` and `/models/4.glb`. It does not warm `/models/Sprint.glb`, and byte-cache warming alone does not perform GLTF parse, Draco decode, model clone, animation/morph setup, or GPU first render.
- Current roadmap says Phase 8 should begin with scene-native object/effect scope for `WebGLModel`, but the animation correctness and prepare behavior here are Phase 7 follow-up work and should close before picking/hit state work starts.
- User constraints for this plan:
  - Keep React mental model: declarative components, props/descriptor driven, nesting communicates ownership.
  - API must be agent-first, clearly named, clearly scoped, and have clear defaults.
  - Prefer Three-like vocabulary where it improves comprehension: `position`, `rotation`, `scale`, `material`, `lights`, `camera`, `scene`, `animation`, `renderPass`.
  - Expose only managed descriptors and controlled facades, not raw Three.js ownership.
  - Keep modules small, low-coupled, cohesive, single-responsibility, and data flow explicit.
  - Do not over-design.

## Scope

Implement a focused Phase 7B correction:

- Correct app dogfood so `WebGLModel` plays the main `Sprint.glb` skeleton clip by default.
- Add an app asset contract test so the selected dogfood clip cannot drift back to a non-representative sub-rig clip.
- Use a skeleton-safe clone path for skinned GLB scenes while preserving the existing ordinary `scene.clone()` path for non-skinned models.
- Add a minimal `WebGLModel.prepare` descriptor that requests render warmup for scene-native models without adding DOM fallback, DOM rect lifecycle, target pointer state, or raw renderer access.
- Add descriptor-only debug state for model prepare status so agents can tell whether bytes are loaded, clip is active, and render warmup has completed.
- Update docs and roadmap truth so Phase 8 does not start until this correction is verified.

## Non-Goals

- Do not replace `WebGLTarget` model sources.
- Do not add `lifecycle`, `preloadMargin`, DOM fallback, DOM rect fitting, target pointer state, or target-local effects to `WebGLModel`.
- Do not expose `SkeletonUtils`, `AnimationMixer`, `AnimationAction`, `Object3D`, `Group`, `Mesh`, `Material`, `Texture`, `Bone`, `Skeleton`, renderer, scene, camera, render pass, render target, composer, or animation-loop handles.
- Do not add broad animation graphs, additive layers, IK, retargeting, bone attachments, or state machines.
- Do not add picking, raycasting, object hit regions, pointer drag, orbit, pan, pointer parallax, or physics.
- Do not make `apps/example` asset names or layout assumptions part of package runtime behavior.
- Do not build a generic render graph or broad preload scheduler. The prepare API here is for scene-native model first-render warmup only.

## File Structure

- Modify `apps/example/src/ManagedModelAnimationExample.tsx`
  - Owns the app-level Phase 7 model dogfood declaration.
  - Will declare `MainSkeleton.001`, Draco decoder preload, and render warmup.
- Modify `apps/example/test/ManagedModelAnimationExample.test.tsx`
  - Verifies the React descriptor props for the dogfood component.
- Create `apps/example/test/managedModelAssetContract.test.ts`
  - Parses `apps/example/public/models/Sprint.glb` JSON and asserts the selected default clip is representative of the main skeleton.
- Modify `packages/dom-webgl-runtime/src/lib/render/renderables/modelSceneObjects.ts`
  - Keeps model scene instantiation and disposal in one renderable-owned module.
  - Adds internal skeleton-safe clone selection.
- Create `packages/dom-webgl-runtime/test/lib/render/renderables/modelSceneObjects.test.ts`
  - Covers ordinary clone path and skinned clone path.
- Modify `packages/dom-webgl-runtime/src/lib/types.ts`
  - Adds `WebGLModelPrepareDeclaration` and `WebGLModelDeclaration.prepare`.
- Modify `packages/dom-webgl-runtime/src/lib/react/WebGLModel.tsx`
  - Passes `prepare` through as descriptor data and includes it in hook dependencies.
- Modify `packages/dom-webgl-runtime/src/lib/renderer/managedModelRegistry.ts`
  - Normalizes model prepare descriptors.
  - Tracks descriptor-only prepare status.
  - Exposes pending render warmup requests to runtime.
- Modify `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`
  - Performs a tiny managed render warmup for model scenes after load, without exposing renderer handles.
- Modify `packages/dom-webgl-runtime/test/lib/renderer/managedModelRegistry.test.ts`
  - Covers prepare normalization, pending/completed warmup status, and debug summaries.
- Modify `packages/dom-webgl-runtime/test/lib/react/WebGLModel.test.tsx`
  - Covers React `prepare` prop passthrough.
- Modify `packages/dom-webgl-runtime/test/publicExports.test.ts`
  - Ensures new prepare type is public descriptor-only and no raw handles leak.
- Modify `README.md`, `docs/STATUS.md`, `docs/examples/effect-authoring.md`, and `docs/roadmap/managed-render-system.md`
  - Documents the correction and the `WebGLModel.prepare.renderWarmup` boundary.

## Public API Direction

Use the smallest explicit descriptor:

```ts
export type WebGLModelPrepareDeclaration = {
  readonly renderWarmup?: "idle";
};

export type WebGLModelDeclaration = {
  readonly id: string;
  readonly sceneId: string;
  readonly src: string;
  readonly loader?: WebGLModelLoaderDeclaration;
  readonly position?: WebGLTuple3;
  readonly rotation?: WebGLTuple3;
  readonly scale?: number | WebGLTuple3;
  readonly visible?: boolean;
  readonly timeline?: WebGLTimelineBindingDeclaration;
  readonly animation?: WebGLModelAnimationDeclaration;
  readonly prepare?: WebGLModelPrepareDeclaration;
};
```

Defaults:

- `prepare` omitted means current behavior: load/register normally and let the first visible render upload GPU resources.
- `prepare.renderWarmup: "idle"` means: after the model is loaded, cloned, attached, and animation setup has run, the runtime should perform one tiny managed render for a pass that sees the model's scene before the user scrolls to the full DOM-bound viewport.
- The descriptor does not add DOM lifecycle, DOM fallback, `preloadMargin`, or raw render hooks.

Example target shape:

```tsx
<WebGLModel
  id="example.managedModel.sprint"
  src="/models/Sprint.glb"
  loader={{ draco: { decoderPath: "/draco/gltf/", preload: true } }}
  position={[240, -60, -80]}
  rotation={[0, 0, 0]}
  scale={8}
  animation={{
    defaultClip: { clip: "MainSkeleton.001", loop: "repeat", fadeInMs: 160 },
  }}
  prepare={{ renderWarmup: "idle" }}
/>
```

## Tasks

### Task 1: Lock The Example Clip And Asset Contract

**Files:**
- Modify: `apps/example/src/ManagedModelAnimationExample.tsx`
- Modify: `apps/example/test/ManagedModelAnimationExample.test.tsx`
- Create: `apps/example/test/managedModelAssetContract.test.ts`

- [x] **Step 1: Add the failing dogfood prop expectation**

In `apps/example/test/ManagedModelAnimationExample.test.tsx`, update the model expectation to require the main skeleton clip, Draco decoder preload, and warmup descriptor:

```tsx
expect(modelProps).toEqual([
  expect.objectContaining({
    id: "example.managedModel.sprint",
    src: "/models/Sprint.glb",
    loader: { draco: { decoderPath: "/draco/gltf/", preload: true } },
    position: [240, -60, -80],
    rotation: [0, 0, 0],
    scale: 8,
    animation: {
      defaultClip: { clip: "MainSkeleton.001", loop: "repeat", fadeInMs: 160 },
    },
    prepare: { renderWarmup: "idle" },
  }),
]);
```

Extend `ModelMockProps` in the same file:

```tsx
type ModelMockProps = {
  readonly id: string;
  readonly src: string;
  readonly loader?: Record<string, unknown>;
  readonly position?: readonly [number, number, number];
  readonly rotation?: readonly [number, number, number];
  readonly scale?: number | readonly [number, number, number];
  readonly animation?: Record<string, unknown>;
  readonly prepare?: Record<string, unknown>;
  readonly timeline?: Record<string, unknown>;
};
```

- [x] **Step 2: Add a GLB asset contract test**

Create `apps/example/test/managedModelAssetContract.test.ts`:

```ts
import { readFileSync } from "node:fs";

import { describe, expect, test } from "vitest";

describe("managed model dogfood asset contract", () => {
  test("uses the Sprint main skeleton clip for visible animation dogfood", () => {
    const glb = readGLBJSON("apps/example/public/models/Sprint.glb");
    const mainSkeleton = readAnimation(glb, "MainSkeleton.001");
    const subRig = readAnimation(glb, "<previous sub-rig clip>");

    expect(mainSkeleton.channels.length).toBeGreaterThanOrEqual(80);
    expect(subRig.channels.length).toBeLessThan(mainSkeleton.channels.length);
    expect(
      mainSkeleton.channels.some((channel) =>
        readNodeName(glb, channel.target.node).startsWith("mixamorig:"),
      ),
    ).toBe(true);
  });
});

type GLBJSON = {
  readonly nodes?: readonly { readonly name?: string }[];
  readonly animations?: readonly {
    readonly name?: string;
    readonly channels: readonly {
      readonly target: { readonly node: number; readonly path: string };
    }[];
  }[];
};

function readGLBJSON(path: string): GLBJSON {
  const buffer = readFileSync(path);
  if (buffer.toString("utf8", 0, 4) !== "glTF") {
    throw new Error(`Expected ${path} to be a GLB file.`);
  }

  let offset = 12;
  while (offset < buffer.length) {
    const length = buffer.readUInt32LE(offset);
    offset += 4;
    const type = buffer.toString("utf8", offset, offset + 4);
    offset += 4;
    const chunk = buffer.subarray(offset, offset + length);
    offset += length;

    if (type === "JSON") {
      return JSON.parse(chunk.toString("utf8").replace(/\0+$/, "")) as GLBJSON;
    }
  }

  throw new Error(`Expected ${path} to contain a GLB JSON chunk.`);
}

function readAnimation(
  glb: GLBJSON,
  name: string,
): NonNullable<GLBJSON["animations"]>[number] {
  const animation = glb.animations?.find((candidate) => candidate.name === name);
  if (!animation) {
    throw new Error(`Expected Sprint.glb to include animation ${name}.`);
  }
  return animation;
}

function readNodeName(glb: GLBJSON, index: number): string {
  return glb.nodes?.[index]?.name ?? "";
}
```

- [x] **Step 3: Run the focused failing tests**

Run:

```bash
npm test -- --run apps/example/test/ManagedModelAnimationExample.test.tsx apps/example/test/managedModelAssetContract.test.ts
```

Expected:

- `ManagedModelAnimationExample.test.tsx` fails because current code still declares the previous sub-rig clip, no Draco preload, and no `prepare`.
- `managedModelAssetContract.test.ts` passes and proves `MainSkeleton.001` is the representative main skeleton clip.

- [x] **Step 4: Update the example descriptor**

In `apps/example/src/ManagedModelAnimationExample.tsx`, change:

```tsx
const sprintModelLoader = {
  draco: { decoderPath: "/draco/gltf/", preload: true },
} satisfies NonNullable<WebGLModelProps["loader"]>;
const sprintModelAnimation = {
  defaultClip: { clip: "MainSkeleton.001", loop: "repeat", fadeInMs: 160 },
} satisfies NonNullable<WebGLModelProps["animation"]>;
const sprintModelPrepare = {
  renderWarmup: "idle",
} satisfies NonNullable<WebGLModelProps["prepare"]>;
```

Pass it to the component:

```tsx
<WebGLModel
  id="example.managedModel.sprint"
  src="/models/Sprint.glb"
  loader={sprintModelLoader}
  position={sprintModelPosition}
  rotation={sprintModelRotation}
  scale={8}
  animation={sprintModelAnimation}
  prepare={sprintModelPrepare}
/>
```

- [x] **Step 5: Verify Task 1 passes**

Run:

```bash
npm test -- --run apps/example/test/ManagedModelAnimationExample.test.tsx apps/example/test/managedModelAssetContract.test.ts
```

Expected: both test files pass.

### Task 2: Add Skeleton-Safe Model Scene Cloning

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/modelSceneObjects.ts`
- Create: `packages/dom-webgl-runtime/test/lib/render/renderables/modelSceneObjects.test.ts`

- [x] **Step 1: Write failing clone-path tests**

Create `packages/dom-webgl-runtime/test/lib/render/renderables/modelSceneObjects.test.ts`:

```ts
import { afterEach, describe, expect, test, vi } from "vitest";
import { Group } from "three/src/objects/Group.js";

describe("instantiateModelSceneObject", () => {
  afterEach(() => {
    vi.doUnmock("three/addons/utils/SkeletonUtils.js");
    vi.resetModules();
  });

  test("uses ordinary Object3D clone for non-skinned model scenes", async () => {
    const { instantiateModelSceneObject } = await importModelSceneObjects();
    const source = new Group();
    const cloned = new Group();
    const clone = vi.spyOn(source, "clone").mockReturnValue(cloned);

    expect(instantiateModelSceneObject({ scene: source })).toBe(cloned);
    expect(clone).toHaveBeenCalledTimes(1);
  });

  test("uses skeleton-safe clone for skinned model scenes", async () => {
    const skeletonClone = new Group();
    const skeletonCloneFn = vi.fn(() => skeletonClone);
    vi.doMock("three/addons/utils/SkeletonUtils.js", () => ({
      clone: skeletonCloneFn,
    }));
    const { instantiateModelSceneObject } = await importModelSceneObjects();
    const source = new Group();
    const child = new Group() as Group & { isSkinnedMesh?: boolean };
    child.isSkinnedMesh = true;
    source.add(child);
    const ordinaryClone = vi.spyOn(source, "clone");

    expect(instantiateModelSceneObject({ scene: source })).toBe(skeletonClone);
    expect(skeletonCloneFn).toHaveBeenCalledWith(source);
    expect(ordinaryClone).not.toHaveBeenCalled();
  });
});

function importModelSceneObjects() {
  return import("../../../../src/lib/render/renderables/modelSceneObjects");
}
```

- [x] **Step 2: Run tests to verify the skinned path fails**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/render/renderables/modelSceneObjects.test.ts
```

Expected: the skinned test fails because current implementation always calls ordinary `scene.clone()`.

- [x] **Step 3: Implement the skeleton-safe clone selection**

Modify `packages/dom-webgl-runtime/src/lib/render/renderables/modelSceneObjects.ts`:

```ts
import type { Object3D } from "three/src/core/Object3D.js";
import { Group } from "three/src/objects/Group.js";
import { clone as cloneSkeletonHierarchy } from "three/addons/utils/SkeletonUtils.js";
```

Replace `instantiateModelSceneObject(...)` with:

```ts
export function instantiateModelSceneObject(model: unknown): unknown {
  const sceneObject = readModelSceneObject(model);

  if (!isCloneableObject3D(sceneObject)) {
    return sceneObject;
  }

  if (containsSkinnedMesh(sceneObject)) {
    return cloneSkeletonHierarchy(sceneObject);
  }

  return sceneObject.clone();
}
```

Add focused helpers:

```ts
function isCloneableObject3D(
  object: unknown,
): object is Object3D & { clone(): Object3D } {
  return (
    isObject3D(object) &&
    "clone" in object &&
    typeof (object as { clone?: unknown }).clone === "function"
  );
}

function containsSkinnedMesh(object: Object3D): boolean {
  let found = false;

  object.traverse((child) => {
    if ((child as { isSkinnedMesh?: unknown }).isSkinnedMesh === true) {
      found = true;
    }
  });

  return found;
}
```

- [x] **Step 4: Verify clone-path tests pass**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/render/renderables/modelSceneObjects.test.ts
```

Expected: both tests pass.

### Task 3: Add The Minimal WebGLModel Prepare Descriptor

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/types.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/react/WebGLModel.tsx`
- Modify: `packages/dom-webgl-runtime/test/lib/react/WebGLModel.test.tsx`
- Modify: `packages/dom-webgl-runtime/test/publicExports.test.ts`

- [x] **Step 1: Add failing React passthrough coverage**

In `packages/dom-webgl-runtime/test/lib/react/WebGLModel.test.tsx`, add a test matching the existing runtime mock style:

```tsx
test("passes prepare descriptors through to the runtime", async () => {
  const runtime = createRuntimeHarness();

  render(
    createElement(
      RuntimeContext.Provider,
      { value: runtime },
      createElement(WebGLSceneContext.Provider, { value: "world" },
        createElement(WebGLModel, {
          id: "character",
          src: "/models/Sprint.glb",
          prepare: { renderWarmup: "idle" },
        }),
      ),
    ),
  );

  expect(runtime.registerModel).toHaveBeenCalledWith(
    expect.objectContaining({
      id: "character",
      sceneId: "world",
      src: "/models/Sprint.glb",
      prepare: { renderWarmup: "idle" },
    }),
  );
});
```

Use the exact local harness names already present in `WebGLModel.test.tsx`; keep the assertion shape above.

- [x] **Step 2: Run the React test to verify it fails**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/react/WebGLModel.test.tsx
```

Expected: TypeScript/test failure because `WebGLModelProps` does not yet accept or pass `prepare`.

- [x] **Step 3: Add the public descriptor type**

In `packages/dom-webgl-runtime/src/lib/types.ts`, add near the existing model animation declarations:

```ts
export type WebGLModelPrepareDeclaration = {
  readonly renderWarmup?: "idle";
};
```

Add to `WebGLModelDeclaration`:

```ts
readonly prepare?: WebGLModelPrepareDeclaration;
```

- [x] **Step 4: Pass `prepare` through React**

In `packages/dom-webgl-runtime/src/lib/react/WebGLModel.tsx`, destructure and register `prepare`:

```tsx
export function WebGLModel({
  id,
  scene,
  src,
  loader,
  position,
  rotation,
  scale,
  visible,
  timeline,
  animation,
  prepare,
}: WebGLModelProps) {
```

Inside `runtime.registerModel(...)`:

```tsx
...(prepare !== undefined ? { prepare } : {}),
```

Add `prepare` to the dependency array.

- [x] **Step 5: Add public export guard coverage**

In `packages/dom-webgl-runtime/test/publicExports.test.ts`, add a compile sample that imports `WebGLModelPrepareDeclaration` and rejects raw handles:

```ts
import type { WebGLModelPrepareDeclaration } from "@project/dom-webgl-runtime";

const prepare = {
  renderWarmup: "idle",
} satisfies WebGLModelPrepareDeclaration;

prepare.renderWarmup;

// @ts-expect-error prepare descriptors must not expose raw render hooks
const invalidPrepare: WebGLModelPrepareDeclaration = { renderLoop: () => {} };
```

Use the file's existing sample-string pattern and keep the assertion close to other public type boundary checks.

- [x] **Step 6: Verify descriptor tests**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/react/WebGLModel.test.tsx packages/dom-webgl-runtime/test/publicExports.test.ts
npm run typecheck -w @project/dom-webgl-runtime
```

Expected: tests and package typecheck pass.

### Task 4: Track Model Prepare State In The Registry

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/managedModelRegistry.ts`
- Modify: `packages/dom-webgl-runtime/test/lib/renderer/managedModelRegistry.test.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/types.ts`

- [x] **Step 1: Add failing registry coverage for warmup requests**

In `packages/dom-webgl-runtime/test/lib/renderer/managedModelRegistry.test.ts`, add:

```ts
test("tracks render warmup requests for prepared models", async () => {
  const worldAdapter = createSceneAdapter();
  const registry = createRegistry({
    worldAdapter,
    loadModel: async () => ({
      scene: new Group(),
      animations: [new AnimationClip("MainSkeleton.001", 1, [])],
    }),
  });

  registry.registerModel({
    id: "character",
    sceneId: "world",
    src: "/models/Sprint.glb",
    animation: { defaultClip: "MainSkeleton.001" },
    prepare: { renderWarmup: "idle" },
  });

  await registry.update({ delta: 16 }, { get: () => 0 });

  expect(registry.inspect().models[0]).toMatchObject({
    id: "character",
    prepare: { renderWarmup: "pending" },
    activeClips: ["MainSkeleton.001"],
  });
  expect(registry.consumeRenderWarmupRequests()).toEqual([
    { id: "character", sceneId: "world" },
  ]);

  registry.markRenderWarmupComplete("character");

  expect(registry.inspect().models[0]).toMatchObject({
    prepare: { renderWarmup: "complete" },
  });
  expect(registry.consumeRenderWarmupRequests()).toEqual([]);
});
```

- [x] **Step 2: Run the registry test to verify it fails**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/renderer/managedModelRegistry.test.ts
```

Expected: compile/test failure because the registry has no prepare state or warmup request methods.

- [x] **Step 3: Add descriptor-only debug type**

In `packages/dom-webgl-runtime/src/lib/types.ts`, extend `WebGLDebugModelSummary` with:

```ts
prepare?: {
  readonly renderWarmup?: "pending" | "complete";
};
```

Keep this descriptor-only. Do not include pass objects, cameras, render targets, renderer handles, or timing callbacks.

- [x] **Step 4: Add registry warmup API and state**

In `packages/dom-webgl-runtime/src/lib/renderer/managedModelRegistry.ts`, extend the public registry type:

```ts
export type ManagedModelPrepareRequest = {
  readonly id: string;
  readonly sceneId: string;
};

export type ManagedModelRegistry = {
  registerModel(declaration: WebGLModelDeclaration): void;
  unregisterModel(id: string): void;
  unregisterScene(sceneId: string): void;
  update(
    input: { readonly delta: number },
    progressSignals: WebGLProgressSignalSource,
  ): boolean | Promise<boolean>;
  consumeRenderWarmupRequests(): ManagedModelPrepareRequest[];
  markRenderWarmupComplete(id: string): void;
  inspect(): ManagedModelRegistryDebugState;
  dispose(): void;
};
```

Add normalized state:

```ts
type NormalizedModelPrepareDeclaration = {
  readonly renderWarmup?: "idle";
};

type ManagedModelEntry = {
  readonly declaration: NormalizedModelDeclaration;
  readonly resource: ResourceHandle<unknown>;
  readonly controller?: WebGLSceneObjectController;
  readonly modelHandle?: WebGLModelEffectHandle;
  readonly morphControls?: ModelMorphControls;
  readonly animation?: ModelAnimationController;
  readonly loadPromise?: Promise<boolean>;
  readonly timelineSnapshot?: TimelineProgressSnapshot;
  readonly defaultClipStarted?: boolean;
  readonly renderWarmup?: "pending" | "complete";
  readonly disposed?: boolean;
  readonly error?: unknown;
};
```

Normalize the descriptor:

```ts
function normalizeModelPrepareDeclaration(
  declaration: WebGLModelPrepareDeclaration | undefined,
): NormalizedModelPrepareDeclaration | undefined {
  if (!declaration?.renderWarmup) {
    return undefined;
  }

  return { renderWarmup: "idle" };
}
```

When `loadEntry(...)` finishes attaching the controller, set pending warmup:

```ts
Object.assign(entry, {
  controller,
  modelHandle,
  morphControls,
  ...(animation ? { animation } : {}),
  ...(entry.declaration.prepare?.renderWarmup === "idle"
    ? { renderWarmup: "pending" as const }
    : {}),
});
```

Add the two methods:

```ts
consumeRenderWarmupRequests(): ManagedModelPrepareRequest[] {
  const requests: ManagedModelPrepareRequest[] = [];

  for (const entry of entries.values()) {
    if (entry.renderWarmup !== "pending") {
      continue;
    }
    if (!entry.controller || !readEffectiveVisibility(entry)) {
      continue;
    }

    requests.push({
      id: entry.declaration.id,
      sceneId: entry.declaration.sceneId,
    });
  }

  return requests;
},
markRenderWarmupComplete(id): void {
  const entry = entries.get(id.trim());
  if (entry?.renderWarmup === "pending") {
    Object.assign(entry, { renderWarmup: "complete" as const });
  }
},
```

Expose descriptor-only debug state in `inspectEntry(...)`:

```ts
...(entry.renderWarmup
  ? {
      prepare: {
        renderWarmup:
          entry.renderWarmup === "complete" ? "complete" : "pending",
      },
    }
  : {}),
```

- [x] **Step 5: Verify registry prepare behavior**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/renderer/managedModelRegistry.test.ts
```

Expected: registry tests pass.

### Task 5: Perform Runtime-Owned Render Warmup

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`
- Modify: `packages/dom-webgl-runtime/test/lib/renderer/runtimePipeline.test.ts`

- [x] **Step 1: Add failing runtime coverage for model warmup**

In `packages/dom-webgl-runtime/test/lib/renderer/runtimePipeline.test.ts`, add a focused test using the existing renderer host factory test harness:

```ts
test("performs a tiny render warmup for prepared scene-native models", async () => {
  const harness = createRuntimePipelineHarness();
  const runtime = createWebGLRuntime({
    container: harness.container,
    rendererHostFactory: harness.rendererHostFactory,
    loadModel: async () => ({
      scene: new Group(),
      animations: [new AnimationClip("MainSkeleton.001", 1, [])],
    }),
  });

  runtime.registerScene({
    id: "world",
    projection: "perspective-stage",
    render: { camera: "world.camera", viewport: { mode: "canvas" } },
  });
  runtime.registerCamera({
    id: "world.camera",
    sceneId: "world",
    default: true,
    type: "perspective",
    mode: "perspective-stage",
  });
  runtime.registerModel({
    id: "character",
    sceneId: "world",
    src: "/models/Sprint.glb",
    animation: { defaultClip: "MainSkeleton.001" },
    prepare: { renderWarmup: "idle" },
  });

  await runtime.sync();
  runtime.sync();

  expect(harness.sceneAdapters.world.render).toHaveBeenCalled();
  expect(runtime.getDebugState().models[0]).toMatchObject({
    id: "character",
    prepare: { renderWarmup: "complete" },
  });

  runtime.dispose();
});
```

Adapt the harness names to the existing `runtimePipeline.test.ts` helpers. The assertion must prove a render happened before the user-visible scroll event, not expose any raw renderer handle publicly.

- [x] **Step 2: Run the runtime test to verify it fails**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/renderer/runtimePipeline.test.ts
```

Expected: failure because runtime does not consume model warmup requests.

- [x] **Step 3: Add internal warmup rendering**

In `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`, after normal `renderLayers.renderPasses(...)` in `renderScene()`, consume pending model warmups:

```ts
renderModelWarmups();
```

Add:

```ts
function renderModelWarmups(): void {
  const requests = managedModels.consumeRenderWarmupRequests();
  if (requests.length === 0) {
    return;
  }

  const pending = new Set(requests.map((request) => request.sceneId));

  renderLayers.renderPasses((pass, scene, camera) => {
    if (!pending.has(pass.sceneId)) {
      return;
    }

    withResolvedPassViewport(readWarmupViewport(), () => {
      scene.sceneAdapter.render(camera.camera);
    });

    for (const request of requests) {
      if (request.sceneId === pass.sceneId) {
        managedModels.markRenderWarmupComplete(request.id);
      }
    }
    pending.delete(pass.sceneId);
  });
}

function readWarmupViewport(): ActiveResolvedPassViewport {
  return {
    mode: "dom-rect",
    scissor: true,
    viewportRect: { x: 0, y: 0, width: 1, height: 1 },
    scissorRect: { x: 0, y: 0, width: 1, height: 1 },
  };
}
```

Keep this internal. Do not add public renderer callbacks.

- [x] **Step 4: Verify runtime warmup behavior**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/renderer/runtimePipeline.test.ts packages/dom-webgl-runtime/test/lib/renderer/managedModelRegistry.test.ts
```

Expected: both test files pass.

### Task 6: Update Docs And Roadmap Truth

**Files:**
- Modify: `README.md`
- Modify: `docs/STATUS.md`
- Modify: `docs/examples/effect-authoring.md`
- Modify: `docs/roadmap/managed-render-system.md`

- [x] **Step 1: Update roadmap status**

In `docs/roadmap/managed-render-system.md`, keep Phase 7 as the implemented model-descriptor foundation, add a Phase 7B row before Phase 8:

```md
| Phase 7B: Model Animation Correction And Prepare | `[planned]` | [2026-07-05-phase-7-model-animation-correction-model-prepare.md](../superpowers/plans/2026-07-05-phase-7-model-animation-correction-model-prepare.md) | Corrects Phase 7 dogfood to animate the main Sprint skeleton, adds skeleton-safe GLB scene cloning, and adds a minimal descriptor-only render warmup path for scene-native models before Phase 8 picking starts. |
```

Update the recommended next step to say Phase 7B is next before Phase 8.

- [x] **Step 2: Update active status**

In `docs/STATUS.md`, replace the sentence that says Phase 7 is fully verified in this working branch with:

```md
Phase 7 established the scene-native `WebGLModel` descriptor path, runtime model
registry, descriptor animation/morph controls, and debug summaries:
[2026-07-05-managed-model-animation.md](./superpowers/plans/2026-07-05-managed-model-animation.md).
Before Phase 8 picking starts, Phase 7B must correct the model animation dogfood
to play `Sprint.glb`'s main skeleton clip, use skeleton-safe GLB scene cloning,
and add a minimal descriptor-only `WebGLModel.prepare.renderWarmup` path:
[2026-07-05-phase-7-model-animation-correction-model-prepare.md](./superpowers/plans/2026-07-05-phase-7-model-animation-correction-model-prepare.md).
```

- [x] **Step 3: Update example docs**

In `README.md` and `docs/examples/effect-authoring.md`, document this boundary:

```md
Scene-native `WebGLModel` can request a managed first-render warmup with
`prepare={{ renderWarmup: "idle" }}`. This is not `WebGLTarget.lifecycle`: it
does not create DOM fallback, DOM rect fitting, target pointer state, or
target-local effects. It only asks the runtime to perform a tiny internal render
after the GLB is loaded, cloned, attached, and animation setup has run.
```

Also update dogfood references from the previous sub-rig clip to `MainSkeleton.001`.

- [x] **Step 4: Verify docs text**

Run:

```bash
rg -n "MainSkeleton\\.001|renderWarmup|Phase 7B" README.md docs apps/example/src apps/example/test packages/dom-webgl-runtime/src packages/dom-webgl-runtime/test
```

Expected:

- The previous sub-rig clip no longer appears in source/docs/tests except in the asset contract test where it proves the old clip is not representative.
- `MainSkeleton.001` appears in the dogfood descriptor and tests.
- `renderWarmup` appears only in descriptor/docs/test/runtime code, not as raw renderer access.

### Task 7: Browser Verification And Full Closeout

**Files:**
- No new implementation files.
- Uses app runtime and browser verification.

- [x] **Step 1: Run package-level checks**

Run:

```bash
npm run test -- --run
npm run typecheck
npm run build
npm run check:imports
git diff --check
```

Expected:

- All tests pass.
- Typecheck passes.
- Build passes. Existing Vite chunk-size warnings are acceptable if unchanged.
- `Example import boundary OK`.
- `git diff --check` reports no whitespace errors.

- [x] **Step 2: Run the example app**

Run:

```bash
npm run dev -w @project/dom-webgl-example
```

Open the local URL printed by Vite.

- [x] **Step 3: Verify model dogfood in browser**

Use Playwright to scroll to the Phase 7 model row and verify:

- Console errors: 0.
- The model viewport renders non-background pixels.
- `runtime.getDebugState().models` contains `example.managedModel.sprint`.
- The model debug record includes:
  - `resourceStatus: "ready"`;
  - `clips` containing `MainSkeleton.001`;
  - `activeClips` containing `MainSkeleton.001`;
  - `prepare.renderWarmup: "complete"`;
  - no `missing-clip` diagnostic for `MainSkeleton.001`.

Use a short pixel-diff or two screenshots separated by at least 500 ms to confirm visible animation:

```ts
const before = await page.screenshot({ path: "/tmp/phase7b-model-before.png" });
await page.waitForTimeout(700);
const after = await page.screenshot({ path: "/tmp/phase7b-model-after.png" });
// Compare cropped viewport pixels in the script. Expected: changed pixels > 0.
```

- [x] **Step 4: Profile scroll-entry stall**

Record a quick Chrome Performance trace while scrolling into the model row.

Expected:

- No multi-second main-thread stall when the row first enters view.
- If there is still a long stall, note whether it is GLTF parse, Draco decode, skeleton clone, animation setup, or GPU upload. Do not guess. Add the result to `docs/performance/profile-notes.md` if this file already has current profiling notes in the branch; otherwise add a short note to the Phase 7B plan closeout section.

- [x] **Step 5: Commit after verification**

Only after all checks pass:

```bash
git add \
  README.md \
  docs/STATUS.md \
  docs/examples/effect-authoring.md \
  docs/roadmap/managed-render-system.md \
  docs/superpowers/plans/2026-07-05-phase-7-model-animation-correction-model-prepare.md \
  apps/example/src/ManagedModelAnimationExample.tsx \
  apps/example/test/ManagedModelAnimationExample.test.tsx \
  apps/example/test/managedModelAssetContract.test.ts \
  packages/dom-webgl-runtime/src/lib/types.ts \
  packages/dom-webgl-runtime/src/lib/react/WebGLModel.tsx \
  packages/dom-webgl-runtime/src/lib/render/renderables/modelSceneObjects.ts \
  packages/dom-webgl-runtime/src/lib/renderer/managedModelRegistry.ts \
  packages/dom-webgl-runtime/src/lib/renderer/runtime.ts \
  packages/dom-webgl-runtime/test/lib/react/WebGLModel.test.tsx \
  packages/dom-webgl-runtime/test/lib/render/renderables/modelSceneObjects.test.ts \
  packages/dom-webgl-runtime/test/lib/renderer/managedModelRegistry.test.ts \
  packages/dom-webgl-runtime/test/lib/renderer/runtimePipeline.test.ts \
  packages/dom-webgl-runtime/test/publicExports.test.ts
git commit -m "fix: correct managed model animation prepare"
```

Expected: commit succeeds with only intentional files staged.

## Self-Review Checklist

- Spec coverage:
  - React mental model is preserved through `WebGLModel` props and scene nesting.
  - API remains descriptor-driven and agent-first through `prepare.renderWarmup`.
  - Three-like naming is retained for existing `position`, `rotation`, `scale`, `animation`, `scene`, and `renderPass` concepts.
  - No raw renderer, scene, camera, Object3D, Mesh, Material, Texture, render target, render loop, mixer, action, bone, or skeleton is public.
  - Modules remain focused: app dogfood, model scene cloning, model registry prepare state, runtime warmup render, docs.
  - Scope does not include Phase 8 picking or physics.
- Placeholder scan:
  - No placeholder markers, deferred-fill instructions, or broad edge-case-only
    steps.
  - Each code-changing task includes exact files, code shape, command, and expected result.
- Type consistency:
  - Public descriptor name is `WebGLModelPrepareDeclaration`.
  - Public prop is `prepare`.
  - Only supported prepare option is `renderWarmup: "idle"`.
  - Debug state uses `prepare.renderWarmup: "pending" | "complete"`.
  - Dogfood clip is `MainSkeleton.001`.

## Closeout

- Status: verified in source, tests, docs, browser smoke, and local commit flow.
- Roadmap: Phase 7B moved to `[verified]`; next suggested phase is Phase 8.
- Browser smoke:
  - Console errors/warnings/issues: 0.
  - `example.managedModel.sprint` debug record reached `resourceStatus: "ready"`.
  - `clips` and `activeClips` include `MainSkeleton.001`.
  - `prepare.renderWarmup` reached `"complete"`.
  - No `missing-clip` diagnostic for `MainSkeleton.001`.
  - Cropped model viewport contained 84,655 non-background pixels and 233
    changed pixels across screenshots separated by 700 ms.
- Scroll-entry profile: the marked 2.69 s scroll-entry window had no
  multi-second main-thread task; longest main-thread task was 308.51 ms.
- Verification:
  - `npm run test -- --run`
  - `npm run typecheck`
  - `npm run build`
  - `npm run check:imports`
  - `git diff --check`
