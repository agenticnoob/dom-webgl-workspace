# Phase 7D Model Load And Prepare Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Prevent prepared scene-native `WebGLModel` assets from causing page-start long tasks by making model load and prepare work viewport-proximity aware, instrumented, and verified without losing the Phase 7B/7C guarantee that scrolling into the model row does not cause a multi-second stall.

**Architecture:** Keep the public authoring model unchanged: apps still declare `<WebGLModel prepare={{ renderWarmup: "idle" }} />` under a managed `WebGLScene` and `WebGLPassViewport`. Runtime owns the scheduling decision by combining model prepare intent with render-pass viewport distance; the model registry owns model state and debug summaries; a small renderer policy helper owns distance math. No raw loader, renderer, scene, camera, Object3D, Mesh, Material, Texture, render target, mixer, action, or render-loop handles are exposed.

**Tech Stack:** TypeScript, React descriptor components, runtime-owned Three.js model loading, existing `ResourceManager`, existing `WebGLPassViewport` DOM rect resolution, Vitest/jsdom, Playwright browser profiling, npm workspaces.

---

## Context Verified For This Plan

- Phase 7B is verified. It added `WebGLModel.prepare.renderWarmup`, skeleton-safe clone, and a 1x1 render warmup path.
- Phase 7C is verified. It added explicit `animation.defaultClips` and updated the Sprint dogfood to start the main skeleton, speed-line, checkout, and bag clips.
- The previous visible symptom was a stall when scrolling to the model row. Phase 7B moved that work earlier and browser notes showed the scroll-entry window no longer had a multi-second task.
- The current user-reported symptom is different: after page load, around 1-2 seconds later, the page stalls even before scrolling to the model row.
- Current code starts scene-native model loading from `managedModels.update(...)` for every registered `WebGLModel` whose controller is missing. Because React mounts the model row at page start, `Sprint.glb` can begin GLTF/Draco parse, scene instantiation, animation setup, and render warmup during startup idle.
- Current `renderWarmup: "idle"` only describes the warmup render intent. It does not budget or defer the earlier `GLTFLoader + Draco decode + clone + animation/morph setup` work.
- The fix should stay before Phase 8. This is model load/prepare performance, not picking, hit state, object effects, physics, or input routing.
- User constraints carried into this plan:
  - Keep React mental model: declarative components, props/descriptor driven, nesting communicates ownership.
  - API must be agent-first, clearly named, clearly scoped, and have clear defaults.
  - Prefer Three-like vocabulary where it improves comprehension: `position`, `rotation`, `scale`, `material`, `lights`, `camera`, `scene`, `animation`, `renderPass`.
  - Expose only managed descriptors and controlled facades, not raw Three.js ownership.
  - Keep modules small, low-coupled, cohesive, single-responsibility, and data flow explicit.
  - Do not over-design.

## Scope

Implement the smallest complete Phase 7D:

- Keep the public `prepare={{ renderWarmup: "idle" }}` descriptor.
- Stop prepared scene-native models from loading immediately at page start when their only render pass is a far-away DOM-bound viewport.
- Add an internal model prepare policy that allows prepared model load when:
  - the model scene has a canvas render pass; or
  - at least one DOM-bound pass viewport for that scene is within a conservative prepare margin; or
  - the DOM-bound pass viewport is already visible.
- Keep unprepared models on the existing eager load path for compatibility.
- Keep prepared models with no matching pass in a queued debug state until a pass exists.
- Keep render warmup as the final step after load/instantiate/animation setup.
- Add descriptor-only debug state so agents can see whether model load is queued, loading, or ready and whether render warmup is pending or complete.
- Use browser Long Task instrumentation in Playwright to prove whether startup and scroll-entry work stay inside the expected budget.
- Update `docs/performance/profile-notes.md` with a page-start profile and a model-row scroll profile.

## Non-Goals

- Do not add `WebGLTarget.lifecycle`, DOM fallback, `hideWhenReady`, target pointer state, or target-local effects to `WebGLModel`.
- Do not add public `preloadMargin`, public scheduler callbacks, public loader callbacks, or raw render hooks in this phase.
- Do not expose raw Three.js objects, renderer, render loop, render target, GLTFLoader, DRACOLoader, SkeletonUtils, AnimationMixer, or AnimationAction.
- Do not change `animation.defaultClips`, clip weights, action graphs, state machines, IK, retargeting, additive layers, or bone attachments.
- Do not make example asset names part of package runtime behavior.
- Do not move this work into Phase 8 interaction/picking.

## File Structure

- Create `packages/dom-webgl-runtime/src/lib/renderer/modelPreparePolicy.ts`
  - Owns scene/pass viewport proximity decisions for prepared model loading.
- Create `packages/dom-webgl-runtime/test/lib/renderer/modelPreparePolicy.test.ts`
  - Covers canvas pass, near DOM pass, far DOM pass, no pass, and invalid/zero viewport cases.
- Modify `packages/dom-webgl-runtime/src/lib/renderer/managedModelRegistry.ts`
  - Adds prepared model load deferral and prepare phase debug.
- Modify `packages/dom-webgl-runtime/test/lib/renderer/managedModelRegistry.test.ts`
  - Covers queued prepared models, eligible prepared models, eager unprepared models, and debug phase transitions.
- Modify `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`
  - Wires render-pass viewport proximity into `managedModels.update(...)` before model loading starts.
- Modify `packages/dom-webgl-runtime/test/lib/renderer/runtimePipeline.test.ts`
  - Verifies far DOM-bound prepared models stay queued at startup and load once their pass viewport enters the prepare margin.
- Modify `packages/dom-webgl-runtime/src/lib/types.ts`
  - Extends model debug prepare state only; no new public authoring descriptor is required.
- Modify `packages/dom-webgl-runtime/test/publicExports.test.ts`
  - Guards that debug prepare state is descriptor-only and no raw handles are exposed.
- Modify `README.md`, `docs/STATUS.md`, `docs/examples/effect-authoring.md`, `docs/agent/package-onboarding.md`, `docs/agent/package-usage.md`, and `docs/roadmap/managed-render-system.md`
  - Documents the Phase 7D behavior and keeps Phase 8 after 7D.
- Modify `docs/performance/profile-notes.md`
  - Records the before/after startup and scroll-entry browser evidence.

## Public API Direction

Do not add a new authoring prop in Phase 7D. Keep this shape:

```tsx
<WebGLModel
  id="example.managedModel.sprint"
  src="/models/Sprint.glb"
  loader={{ draco: { decoderPath: "/draco/gltf/", preload: true } }}
  position={[116, -86, -80]}
  rotation={[0, -0.58, 0]}
  scale={9.5}
  prepare={{ renderWarmup: "idle" }}
  animation={{
    defaultClips: [
      { clip: "MainSkeleton.001", loop: "repeat", fadeInMs: 160, timeScale: 2.4 },
      { clip: "SpeedLines.001", loop: "repeat", timeScale: 2.8 },
      { clip: "BagArmature.001", loop: "repeat", timeScale: 2.4 },
    ],
  }}
/>
```

Extend debug-only prepare state:

```ts
export type WebGLDebugModelPrepareLoadState =
  | "queued"
  | "loading"
  | "ready";

export type WebGLDebugModelPrepareSummary = {
  readonly load?: WebGLDebugModelPrepareLoadState;
  readonly renderWarmup?: "pending" | "complete";
};
```

Then use it inside `WebGLDebugModelSummary`:

```ts
export type WebGLDebugModelSummary = {
  id: string;
  sceneId: string;
  src: string;
  resourceStatus: WebGLResourceStatus;
  visible: boolean;
  timeline?: WebGLDebugTimelineSummary;
  prepare?: WebGLDebugModelPrepareSummary;
  clips: readonly string[];
  activeClips: readonly string[];
  morphs?: readonly string[];
  bones?: readonly string[];
  diagnostics?: readonly WebGLDebugModelDiagnostic[];
};
```

Defaults:

- `prepare` omitted: existing eager model load behavior remains unchanged.
- `prepare.renderWarmup: "idle"`: model load/instantiate/warmup is prepared by the runtime, but far DOM-bound pass viewports may keep the model queued until it is close enough to be useful.
- Canvas-pass scenes are considered eligible because there is no DOM viewport distance to use.
- DOM-bound pass scenes use an internal conservative margin. Start with `2.5 * viewportHeight`; tune only if browser verification proves it is too late or too early.

## Tasks

### Task 1: Add A Focused Model Prepare Policy

**Files:**
- Create: `packages/dom-webgl-runtime/src/lib/renderer/modelPreparePolicy.ts`
- Create: `packages/dom-webgl-runtime/test/lib/renderer/modelPreparePolicy.test.ts`

- [x] **Step 1: Write the policy tests**

Create `packages/dom-webgl-runtime/test/lib/renderer/modelPreparePolicy.test.ts`:

```ts
import { describe, expect, test } from "vitest";

import {
  readModelPrepareDecision,
  type ModelPreparePass,
} from "../../../src/lib/renderer/modelPreparePolicy";

describe("model prepare policy", () => {
  test("allows canvas-pass scenes immediately", () => {
    expect(
      readModelPrepareDecision({
        sceneId: "world",
        viewportHeight: 720,
        passes: [{ sceneId: "world", viewport: { mode: "canvas" } }],
      }),
    ).toEqual({ allowed: true, reason: "canvas-pass" });
  });

  test("allows DOM-bound scenes inside the prepare margin", () => {
    const passes: ModelPreparePass[] = [
      {
        sceneId: "world",
        viewport: {
          mode: "dom-rect",
          rect: { x: 0, y: 1600, width: 640, height: 420 },
        },
      },
    ];

    expect(
      readModelPrepareDecision({
        sceneId: "world",
        viewportHeight: 720,
        passes,
      }),
    ).toEqual({ allowed: true, reason: "near-dom-pass" });
  });

  test("queues DOM-bound scenes outside the prepare margin", () => {
    const passes: ModelPreparePass[] = [
      {
        sceneId: "world",
        viewport: {
          mode: "dom-rect",
          rect: { x: 0, y: 4200, width: 640, height: 420 },
        },
      },
    ];

    expect(
      readModelPrepareDecision({
        sceneId: "world",
        viewportHeight: 720,
        passes,
      }),
    ).toEqual({ allowed: false, reason: "far-dom-pass" });
  });

  test("queues scenes without a matching pass", () => {
    expect(
      readModelPrepareDecision({
        sceneId: "world",
        viewportHeight: 720,
        passes: [{ sceneId: "other", viewport: { mode: "canvas" } }],
      }),
    ).toEqual({ allowed: false, reason: "no-pass" });
  });
});
```

- [x] **Step 2: Run the policy tests and verify failure**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/renderer/modelPreparePolicy.test.ts
```

Expected: FAIL because `modelPreparePolicy.ts` does not exist.

- [x] **Step 3: Add the policy helper**

Create `packages/dom-webgl-runtime/src/lib/renderer/modelPreparePolicy.ts`:

```ts
export type ModelPreparePass = {
  readonly sceneId: string;
  readonly viewport:
    | { readonly mode: "canvas" }
    | {
        readonly mode: "dom-rect";
        readonly rect: {
          readonly x: number;
          readonly y: number;
          readonly width: number;
          readonly height: number;
        };
      };
};

export type ModelPrepareDecision =
  | { readonly allowed: true; readonly reason: "canvas-pass" | "near-dom-pass" }
  | { readonly allowed: false; readonly reason: "far-dom-pass" | "no-pass" };

const defaultPrepareMarginViewportMultiplier = 2.5;

export function readModelPrepareDecision(input: {
  readonly sceneId: string;
  readonly viewportHeight: number;
  readonly passes: readonly ModelPreparePass[];
  readonly marginPx?: number;
}): ModelPrepareDecision {
  const scenePasses = input.passes.filter((pass) => pass.sceneId === input.sceneId);
  if (scenePasses.length === 0) {
    return { allowed: false, reason: "no-pass" };
  }

  if (scenePasses.some((pass) => pass.viewport.mode === "canvas")) {
    return { allowed: true, reason: "canvas-pass" };
  }

  const viewportHeight = readPositiveNumber(input.viewportHeight, 1);
  const marginPx =
    input.marginPx ?? viewportHeight * defaultPrepareMarginViewportMultiplier;

  for (const pass of scenePasses) {
    if (pass.viewport.mode !== "dom-rect") {
      continue;
    }
    if (isDomRectInsidePrepareMargin(pass.viewport.rect, viewportHeight, marginPx)) {
      return { allowed: true, reason: "near-dom-pass" };
    }
  }

  return { allowed: false, reason: "far-dom-pass" };
}

function isDomRectInsidePrepareMargin(
  rect: { readonly y: number; readonly height: number },
  viewportHeight: number,
  marginPx: number,
): boolean {
  const top = readFiniteNumber(rect.y, Number.POSITIVE_INFINITY);
  const height = Math.max(0, readFiniteNumber(rect.height, 0));
  const bottom = top + height;

  return bottom >= -marginPx && top <= viewportHeight + marginPx;
}

function readPositiveNumber(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function readFiniteNumber(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}
```

- [x] **Step 4: Verify the policy helper**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/renderer/modelPreparePolicy.test.ts
```

Expected: PASS.

### Task 2: Defer Prepared Model Loading In The Registry

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/managedModelRegistry.ts`
- Modify: `packages/dom-webgl-runtime/test/lib/renderer/managedModelRegistry.test.ts`

- [x] **Step 1: Add failing registry coverage for queued prepared models**

In `packages/dom-webgl-runtime/test/lib/renderer/managedModelRegistry.test.ts`, add:

```ts
test("queues prepared model loading until runtime allows prepare work", async () => {
  const worldAdapter = createSceneAdapter();
  const loadModel = vi.fn(async () => ({
    scene: new Group(),
    animations: [new AnimationClip("MainSkeleton.001", 1, [])],
  }));
  const registry = createRegistry({ worldAdapter, loadModel });

  registry.registerModel({
    id: "character",
    sceneId: "world",
    src: "/models/Sprint.glb",
    animation: { defaultClip: "MainSkeleton.001" },
    prepare: { renderWarmup: "idle" },
  });

  await registry.update(
    { delta: 16 },
    { get: () => 0 },
    { canLoadPreparedModel: () => false },
  );

  expect(loadModel).not.toHaveBeenCalled();
  expect(worldAdapter.objects).toHaveLength(0);
  expect(registry.inspect().models[0]).toMatchObject({
    id: "character",
    resourceStatus: "idle",
    prepare: { load: "queued" },
    clips: [],
    activeClips: [],
  });
});

test("loads queued prepared models once runtime allows prepare work", async () => {
  const worldAdapter = createSceneAdapter();
  const loadModel = vi.fn(async () => ({
    scene: new Group(),
    animations: [new AnimationClip("MainSkeleton.001", 1, [])],
  }));
  const registry = createRegistry({ worldAdapter, loadModel });

  registry.registerModel({
    id: "character",
    sceneId: "world",
    src: "/models/Sprint.glb",
    animation: { defaultClip: "MainSkeleton.001" },
    prepare: { renderWarmup: "idle" },
  });

  await registry.update(
    { delta: 16 },
    { get: () => 0 },
    { canLoadPreparedModel: () => false },
  );
  await registry.update(
    { delta: 16 },
    { get: () => 0 },
    { canLoadPreparedModel: () => true },
  );

  expect(loadModel).toHaveBeenCalledTimes(1);
  expect(worldAdapter.objects).toHaveLength(1);
  expect(registry.inspect().models[0]).toMatchObject({
    resourceStatus: "ready",
    prepare: { load: "ready", renderWarmup: "pending" },
    activeClips: ["MainSkeleton.001"],
  });
});

test("keeps unprepared models on the eager loading path", async () => {
  const worldAdapter = createSceneAdapter();
  const loadModel = vi.fn(async () => ({ scene: new Group() }));
  const registry = createRegistry({ worldAdapter, loadModel });

  registry.registerModel({
    id: "unprepared",
    sceneId: "world",
    src: "/models/plain.glb",
  });

  await registry.update(
    { delta: 16 },
    { get: () => 0 },
    { canLoadPreparedModel: () => false },
  );

  expect(loadModel).toHaveBeenCalledTimes(1);
  expect(worldAdapter.objects).toHaveLength(1);
});
```

- [x] **Step 2: Run registry tests and verify failure**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/renderer/managedModelRegistry.test.ts
```

Expected: FAIL because `ManagedModelRegistry.update(...)` does not accept prepare policy context and debug state has no `prepare.load`.

- [x] **Step 3: Add registry prepare context types**

In `packages/dom-webgl-runtime/src/lib/renderer/managedModelRegistry.ts`, extend the exported registry types:

```ts
export type ManagedModelPreparePolicy = {
  canLoadPreparedModel(request: {
    readonly id: string;
    readonly sceneId: string;
  }): boolean;
};
```

Update the `update` signature:

```ts
update(
  input: { readonly delta: number },
  progressSignals: WebGLProgressSignalSource,
  preparePolicy?: ManagedModelPreparePolicy,
): boolean | Promise<boolean>;
```

Extend `ManagedModelEntry`:

```ts
readonly prepareLoad?: "queued" | "loading" | "ready";
```

- [x] **Step 4: Gate prepared model loading**

In the `update(...)` loop, replace the unconditional missing-controller load branch with:

```ts
if (!entry.controller) {
  if (!canStartModelLoad(entry, preparePolicy)) {
    Object.assign(entry, { prepareLoad: "queued" as const });
    continue;
  }

  Object.assign(entry, {
    prepareLoad: entry.declaration.prepare ? ("loading" as const) : undefined,
  });
  pendingLoads.push(loadEntry(entry, visible, progressSignals));
  continue;
}
```

Add the helper:

```ts
function canStartModelLoad(
  entry: ManagedModelEntry,
  preparePolicy: ManagedModelPreparePolicy | undefined,
): boolean {
  if (!entry.declaration.prepare) {
    return true;
  }

  return (
    preparePolicy?.canLoadPreparedModel({
      id: entry.declaration.id,
      sceneId: entry.declaration.sceneId,
    }) ?? true
  );
}
```

After successful `loadEntry(...)`, include `prepareLoad: "ready"` for prepared entries:

```ts
Object.assign(entry, {
  controller,
  modelHandle,
  morphControls,
  ...(animation ? { animation } : {}),
  ...(entry.declaration.prepare ? { prepareLoad: "ready" as const } : {}),
  ...(entry.declaration.prepare?.renderWarmup === "idle"
    ? { renderWarmup: "pending" as const }
    : {}),
});
```

- [x] **Step 5: Expose prepare load debug state**

In `inspectEntry(...)`, build prepare state with both load and render warmup:

```ts
const prepare =
  entry.prepareLoad || entry.renderWarmup
    ? {
        ...(entry.prepareLoad ? { load: entry.prepareLoad } : {}),
        ...(entry.renderWarmup
          ? {
              renderWarmup:
                entry.renderWarmup === "complete" ? "complete" : "pending",
            }
          : {}),
      }
    : undefined;
```

Then replace the existing inline `prepare` object with:

```ts
...(prepare ? { prepare } : {}),
```

- [x] **Step 6: Verify registry behavior**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/renderer/managedModelRegistry.test.ts
```

Expected: PASS.

### Task 3: Wire Runtime Viewport Proximity Into Model Prepare

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`
- Modify: `packages/dom-webgl-runtime/test/lib/renderer/runtimePipeline.test.ts`

- [x] **Step 1: Add failing runtime tests for far and near DOM pass viewports**

In `packages/dom-webgl-runtime/test/lib/renderer/runtimePipeline.test.ts`, add a test near the existing model warmup tests:

```ts
test("defers prepared scene-native model loading while its DOM-bound pass viewport is far from view", async () => {
  const loadModel = vi.fn(async () => ({
    scene: new Group(),
    animations: [new AnimationClip("MainSkeleton.001", 1, [])],
  }));
  const runtime = await createPipelineRuntime({
    loadModel,
    rendererHostFactory(container) {
      const host = createRendererHostStub(container);
      return {
        ...host,
        getViewportSize: () => ({ width: 800, height: 600 }),
      };
    },
  });
  const anchor = document.createElement("section");
  anchor.getBoundingClientRect = () =>
    ({
      left: 0,
      top: 2600,
      width: 640,
      height: 420,
      right: 640,
      bottom: 3020,
    }) as DOMRect;

  runtime.registerPassViewport({
    id: "model.viewport",
    element: anchor,
  });
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
  });
  runtime.registerRenderPass({
    id: "world.pass",
    sceneId: "world",
    cameraId: "world.camera",
    viewport: { mode: "dom-rect", anchorId: "model.viewport", scissor: true },
  });
  runtime.registerModel({
    id: "character",
    sceneId: "world",
    src: "/models/Sprint.glb",
    animation: { defaultClip: "MainSkeleton.001" },
    prepare: { renderWarmup: "idle" },
  });

  await runtime.sync();

  expect(loadModel).not.toHaveBeenCalled();
  expect(runtime.getDebugState().models?.[0]).toMatchObject({
    id: "character",
    resourceStatus: "idle",
    prepare: { load: "queued" },
  });

  runtime.dispose();
});

test("starts prepared scene-native model loading when its DOM-bound pass viewport enters the prepare margin", async () => {
  const loadModel = vi.fn(async () => ({
    scene: new Group(),
    animations: [new AnimationClip("MainSkeleton.001", 1, [])],
  }));
  const runtime = await createPipelineRuntime({
    loadModel,
    rendererHostFactory(container) {
      const host = createRendererHostStub(container);
      return {
        ...host,
        getViewportSize: () => ({ width: 800, height: 600 }),
      };
    },
  });
  const anchor = document.createElement("section");
  let top = 2600;
  anchor.getBoundingClientRect = () =>
    ({
      left: 0,
      top,
      width: 640,
      height: 420,
      right: 640,
      bottom: top + 420,
    }) as DOMRect;

  runtime.registerPassViewport({
    id: "model.viewport",
    element: anchor,
  });
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
  });
  runtime.registerRenderPass({
    id: "world.pass",
    sceneId: "world",
    cameraId: "world.camera",
    viewport: { mode: "dom-rect", anchorId: "model.viewport", scissor: true },
  });
  runtime.registerModel({
    id: "character",
    sceneId: "world",
    src: "/models/Sprint.glb",
    animation: { defaultClip: "MainSkeleton.001" },
    prepare: { renderWarmup: "idle" },
  });

  await runtime.sync();
  top = 1400;
  await runtime.sync();
  runtime.sync();

  expect(loadModel).toHaveBeenCalledTimes(1);
  expect(runtime.getDebugState().models?.[0]).toMatchObject({
    id: "character",
    resourceStatus: "ready",
    prepare: { load: "ready", renderWarmup: "complete" },
  });

  runtime.dispose();
});
```

- [x] **Step 2: Run runtime tests and verify failure**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/renderer/runtimePipeline.test.ts
```

Expected: FAIL because runtime always calls `managedModels.update(...)` without prepare proximity context.

- [x] **Step 3: Import and build model prepare pass summaries**

In `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`, import the helper:

```ts
import {
  readModelPrepareDecision,
  type ModelPreparePass,
} from "./modelPreparePolicy";
```

Add a helper near the pass viewport helpers:

```ts
function readModelPreparePasses(): ModelPreparePass[] {
  return renderLayers.getPasses().map((pass) => ({
    sceneId: pass.sceneId,
    viewport: readModelPrepareViewport(pass.viewport),
  }));
}

function readModelPrepareViewport(
  viewport: Parameters<typeof passViewports.resolve>[0],
): ModelPreparePass["viewport"] {
  const resolved = passViewports.resolve(viewport);
  if (resolved.mode === "canvas") {
    return { mode: "canvas" };
  }

  return {
    mode: "dom-rect",
    rect: resolved.rect,
  };
}
```

- [x] **Step 4: Pass prepare policy into `managedModels.update(...)`**

In `syncFrame(...)`, replace:

```ts
const modelUpdate = managedModels.update(frameInput, progressSignals);
```

with:

```ts
const modelPreparePasses = readModelPreparePasses();
const modelUpdate = managedModels.update(frameInput, progressSignals, {
  canLoadPreparedModel(request) {
    return readModelPrepareDecision({
      sceneId: request.sceneId,
      viewportHeight,
      passes: modelPreparePasses,
    }).allowed;
  },
});
```

Keep this after `const viewportHeight = window.innerHeight || 600;` so the same frame viewport basis is used for target lifecycle and model prepare.

- [x] **Step 5: Preserve existing warmup behavior once load is allowed**

Keep `renderModelWarmups()` unchanged except for any type fixes from the new debug state. It should still render a 1x1 warmup and mark `renderWarmup` complete after model load and scene attachment.

- [x] **Step 6: Verify runtime behavior**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/renderer/runtimePipeline.test.ts
```

Expected: PASS, including the existing warmup tests.

### Task 4: Add Debug Type Guards And Documentation Coverage

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/types.ts`
- Modify: `packages/dom-webgl-runtime/test/publicExports.test.ts`
- Modify: `packages/dom-webgl-runtime/test/lib/debug/debugState.test.ts`

- [x] **Step 1: Add failing public type guard samples**

In `packages/dom-webgl-runtime/test/publicExports.test.ts`, add source-string coverage near existing model debug samples:

```ts
const modelPrepareDebug = {
  load: "queued",
  renderWarmup: "pending",
} satisfies WebGLDebugModelPrepareSummary;

modelPrepareDebug.load;
modelPrepareDebug.renderWarmup;

// @ts-expect-error model prepare debug must not expose a loader handle
const invalidPrepareDebugLoader: WebGLDebugModelPrepareSummary = { loader: {} };

// @ts-expect-error model prepare debug must not expose a render callback
const invalidPrepareDebugRender: WebGLDebugModelPrepareSummary = { render: () => {} };
```

Adapt this to the file's existing compile-sample helper shape.

- [x] **Step 2: Run public export tests and verify failure**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/publicExports.test.ts
```

Expected: FAIL because `WebGLDebugModelPrepareSummary` is not exported yet.

- [x] **Step 3: Add debug prepare types**

In `packages/dom-webgl-runtime/src/lib/types.ts`, add:

```ts
export type WebGLDebugModelPrepareLoadState =
  | "queued"
  | "loading"
  | "ready";

export type WebGLDebugModelPrepareSummary = {
  readonly load?: WebGLDebugModelPrepareLoadState;
  readonly renderWarmup?: "pending" | "complete";
};
```

Then change `WebGLDebugModelSummary.prepare` to:

```ts
prepare?: WebGLDebugModelPrepareSummary;
```

- [x] **Step 4: Update debug state tests**

In `packages/dom-webgl-runtime/test/lib/debug/debugState.test.ts`, add a model entry fixture with:

```ts
prepare: { load: "queued", renderWarmup: "pending" },
```

Assert that the debug state preserves both fields:

```ts
expect(state.models?.[0]?.prepare).toEqual({
  load: "queued",
  renderWarmup: "pending",
});
```

- [x] **Step 5: Verify type/debug coverage**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/publicExports.test.ts packages/dom-webgl-runtime/test/lib/debug/debugState.test.ts
npm run typecheck -w @project/dom-webgl-runtime
```

Expected: PASS.

### Task 5: Update Roadmap, Usage Docs, And Performance Notes

**Files:**
- Modify: `README.md`
- Modify: `docs/STATUS.md`
- Modify: `docs/examples/effect-authoring.md`
- Modify: `docs/agent/package-onboarding.md`
- Modify: `docs/agent/package-usage.md`
- Modify: `docs/roadmap/managed-render-system.md`
- Modify: `docs/performance/profile-notes.md`

- [x] **Step 1: Update roadmap status and ordering**

In `docs/roadmap/managed-render-system.md`, add a row after Phase 7C:

```md
| Phase 7D: Model Load And Prepare Performance | `[planned]` | [2026-07-06-phase-7d-model-load-prepare-performance.md](../superpowers/plans/2026-07-06-phase-7d-model-load-prepare-performance.md) | Makes scene-native prepared model loading viewport-proximity aware and instrumented so `renderWarmup: "idle"` no longer shifts Sprint's heavy load/prepare work into a page-start long task. |
```

Update dependency order:

```text
Phase 7D -> model load and prepare performance
```

Update recommended next step so Phase 7D comes before Phase 8.

- [x] **Step 2: Add the Phase 7D roadmap section**

Add before Phase 8:

```md
### Phase 7D: Model Load And Prepare Performance

- **Status:** `[planned]`
- **Focused plan:** [2026-07-06-phase-7d-model-load-prepare-performance.md](../superpowers/plans/2026-07-06-phase-7d-model-load-prepare-performance.md)
- **Depends on:** Phase 7C
- **Last updated:** 2026-07-06
- **Exit criteria:** prepared scene-native `WebGLModel` loading is delayed while its DOM-bound render pass viewport is far from view, begins early enough before the model row becomes visible, records debug prepare state, and browser profiling shows no page-start 1-2 second stall and no reintroduced model-row scroll stall.

Rules:

- Keep `prepare.renderWarmup` descriptor-only.
- Use render-pass viewport proximity internally; do not copy `WebGLTarget.lifecycle` onto `WebGLModel`.
- Do not add public loader callbacks, raw render hooks, or raw Three.js handles.
- Keep Phase 8 interaction/picking separate.
```

- [x] **Step 3: Update status and usage docs**

In `docs/STATUS.md`, replace the direct Phase 8 next-step wording with:

```md
Phase 7D is planned next because Phase 7C moved the visible model stall away
from scroll-entry but now exposes a page-start load/prepare stall around 1-2
seconds after initial load. Phase 7D keeps `WebGLModel.prepare.renderWarmup`
descriptor-only and makes prepared model loading viewport-proximity aware before
Phase 8 picking/hit state begins:
[2026-07-06-phase-7d-model-load-prepare-performance.md](./superpowers/plans/2026-07-06-phase-7d-model-load-prepare-performance.md).
```

In `README.md`, `docs/examples/effect-authoring.md`, `docs/agent/package-onboarding.md`, and `docs/agent/package-usage.md`, add this explanation near the `WebGLModel.prepare.renderWarmup` documentation:

```md
`prepare={{ renderWarmup: "idle" }}` is still descriptor-only. For DOM-bound
managed model passes, runtime preparation is viewport-proximity aware: the model
can stay queued while its pass viewport is far below the page, then load and
warm before the viewport reaches the model row. It is not `WebGLTarget.lifecycle`
and does not add DOM fallback or raw loader/render hooks to `WebGLModel`.
```

- [x] **Step 4: Update performance notes after browser verification**

Append a section to `docs/performance/profile-notes.md` after running the browser checks in Task 6:

```md
## Phase 7D Model Load Prepare Browser Check

- Date: 2026-07-06
- Scenario: `apps/example` managed model dogfood after Phase 7D viewport-proximity prepare.
- Startup result: no page-start long task over 500 ms during the first 4 s after load before scrolling.
- Model debug before proximity: `example.managedModel.sprint` reported `resourceStatus: "idle"` and `prepare.load: "queued"` while the DOM-bound pass viewport was far below view.
- Model debug after proximity: `resourceStatus: "ready"`, `prepare.load: "ready"`, `prepare.renderWarmup: "complete"`, and all Phase 7C active clips were present.
- Scroll-entry result: scrolling into the managed model row did not reintroduce a multi-second main-thread task.
- Interpretation: Phase 7D keeps Phase 7B/7C visual correctness while moving heavy model work out of page-start startup and out of first-visible scroll-entry.
```

Replace the numeric thresholds with measured values from the run instead of leaving this text unchanged.

- [x] **Step 5: Verify docs text**

Run:

```bash
rg -n "Phase 7D|model load and prepare|renderWarmup|prepare\\.load|viewport-proximity|Phase 8" README.md docs packages/dom-webgl-runtime/src packages/dom-webgl-runtime/test apps/example/src apps/example/test
git diff --check
```

Expected:

- Phase 7D appears in roadmap/status/docs.
- `prepare.load` appears only in debug docs/tests/runtime code.
- `renderWarmup` remains descriptor-only.
- `git diff --check` reports no whitespace errors.

### Task 6: Browser Verification And Full Closeout

**Files:**
- No new implementation files.
- Uses app runtime and browser verification.

- [x] **Step 1: Run focused tests**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/renderer/modelPreparePolicy.test.ts packages/dom-webgl-runtime/test/lib/renderer/managedModelRegistry.test.ts packages/dom-webgl-runtime/test/lib/renderer/runtimePipeline.test.ts packages/dom-webgl-runtime/test/publicExports.test.ts
```

Expected: PASS.

- [x] **Step 2: Run full validation**

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

- [x] **Step 3: Run the example app**

Run:

```bash
npm run dev -w @project/dom-webgl-example
```

Open the local URL printed by Vite.

- [x] **Step 4: Verify startup no longer stalls**

Use Playwright to load the page and observe the first 4 seconds without scrolling:

- Console errors: 0.
- Console warnings: unchanged or 0.
- Long tasks over 500 ms: 0.
- `runtime.getDebugState().models` includes `example.managedModel.sprint`.
- Before the model pass viewport enters the prepare margin, its debug state contains:
  - `resourceStatus: "idle"`;
  - `prepare.load: "queued"`;
  - no `missing-clip` diagnostic.

Suggested browser snippet:

```ts
await page.goto("http://127.0.0.1:5173/", { waitUntil: "networkidle" });
await page.evaluate(() => {
  window.__phase7dLongTasks = [];
  new PerformanceObserver((list) => {
    window.__phase7dLongTasks.push(
      ...list.getEntries().map((entry) => ({
        name: entry.name,
        startTime: entry.startTime,
        duration: entry.duration,
      })),
    );
  }).observe({ type: "longtask", buffered: true });
});
await page.waitForTimeout(4000);
const longTasks = await page.evaluate(() => window.__phase7dLongTasks ?? []);
expect(longTasks.filter((entry) => entry.duration > 500)).toEqual([]);
```

- [x] **Step 5: Verify model-row scroll remains smooth**

Scroll toward the model row and verify:

- The model transitions from `prepare.load: "queued"` to `prepare.load: "ready"`.
- `prepare.renderWarmup` reaches `"complete"` before or by the time the row is visible.
- `activeClips` includes `MainSkeleton.001`, `SpeedLines.001`, the selected speed-line plane clips, `checkoutCTRL.001`, and `BagArmature.001`.
- Two screenshots separated by 700 ms have changed pixels in the model viewport.
- No scroll-entry long task over 500 ms occurs in the marked window.

- [x] **Step 6: Commit after verification**

Only after all checks pass:

```bash
git add \
  README.md \
  docs/STATUS.md \
  docs/examples/effect-authoring.md \
  docs/agent/package-onboarding.md \
  docs/agent/package-usage.md \
  docs/roadmap/managed-render-system.md \
  docs/performance/profile-notes.md \
  docs/superpowers/plans/2026-07-06-phase-7d-model-load-prepare-performance.md \
  packages/dom-webgl-runtime/src/lib/types.ts \
  packages/dom-webgl-runtime/src/lib/renderer/modelPreparePolicy.ts \
  packages/dom-webgl-runtime/src/lib/renderer/managedModelRegistry.ts \
  packages/dom-webgl-runtime/src/lib/renderer/runtime.ts \
  packages/dom-webgl-runtime/test/lib/renderer/modelPreparePolicy.test.ts \
  packages/dom-webgl-runtime/test/lib/renderer/managedModelRegistry.test.ts \
  packages/dom-webgl-runtime/test/lib/renderer/runtimePipeline.test.ts \
  packages/dom-webgl-runtime/test/lib/debug/debugState.test.ts \
  packages/dom-webgl-runtime/test/publicExports.test.ts
git commit -m "perf: defer prepared model loading by viewport proximity"
```

Expected: commit succeeds with only intentional files staged.

## Self-Review Checklist

- Spec coverage:
  - React authoring remains declarative: no new imperative loader/render API.
  - API remains agent-first: `prepare.renderWarmup` keeps a clear scope and debug state uses explicit state names.
  - Three-like vocabulary remains in the existing model/scene/renderPass terms.
  - Raw Three.js internals remain private.
  - Modules are split by responsibility: policy math, registry state, runtime wiring, docs/profile.
  - Scope excludes Phase 8 interaction/picking.
- Placeholder scan:
  - No placeholder markers or vague edge-case-only instructions.
- Type consistency:
  - Public authoring descriptor remains `prepare.renderWarmup`.
  - Debug load state is `prepare.load`.
  - Registry policy method is `canLoadPreparedModel`.
  - Runtime helper uses `readModelPrepareDecision`.
  - Browser evidence must cover both page-start and model-row scroll-entry windows.
