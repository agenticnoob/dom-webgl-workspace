# Target Routing Scroll Timelines And Effect Scope Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Phase 5 of the managed render roadmap by making timeline bindings and target/scene/runtime effect scopes explicit while keeping existing `WebGLTarget` and `ScrollEffectSection` usage compatible.

**Architecture:** Preserve the existing DOM-first Level 1 path and reuse the current `WebGLProgressSignalSource` channel. Add small descriptor normalizers and managed scope metadata, route timeline progress through runtime-owned state, and keep GSAP/ScrollTrigger ownership in the optional scroll-adapters package. Do not expose raw Three.js renderer, scene, camera, object, material, texture, render target, render loop, raycaster, or GSAP timeline objects.

**Tech Stack:** TypeScript, React, npm workspaces, Vitest, jsdom, existing DOM WebGL runtime descriptors, optional `@project/dom-webgl-scroll-adapters` React bridge.

---

## Current Truth

- Current branch before planning: `codex/managed-render-roadmap-iteration`.
- Current HEAD before planning: `40097a59`.
- Worktree was clean before writing this plan.
- `docs/roadmap/managed-render-system.md` marks Phase 1 through Phase 4 as `[verified]`.
- At planning start, the first `[not-started]` row in the active Roadmap Status
  table was Phase 5: Target Routing, Scroll Timelines, and Effect Scope.
- No Phase 5 focused plan exists under `docs/superpowers/plans/`.
- Existing React target routing already inherits nearest `WebGLScene` through `WebGLSceneContext` when `webgl.sceneId` is absent.
- Existing vanilla runtime routing already accepts `sceneId` on `registerTarget(...)`.
- Existing runtime options already accept `progressSignals?: WebGLProgressSignalSource`.
- Existing `WebGLScrollRuntime` already creates a stable scroll progress store and forwards `store.source` to `<WebGLRuntime progressSignals={...} />`.
- Existing `ScrollEffectSection` writes a `progressKey -> progress` value into that store.
- Existing effect context already exposes `ctx.progress.get(key)` and keeps reusable contexts in sync across updates.
- Existing debug state already reports target `sceneId`, `projection`, `placementMode`, and descriptor-only stage primitive/light inventories.
- Current effect context does not expose `ctx.scene`, `ctx.camera`, or `ctx.runtime`.

## Scope

In scope:

- Add a managed timeline binding declaration that can be used by targets,
  scenes, stage primitives, and scene-owned lights.
- Document that Phase 6A camera controllers should reuse the same timeline signal,
  but do not add `timeline` to `WebGLCameraDeclaration` in Phase 5.
- Add a runtime normalizer for timeline bindings with clear defaults.
- Preserve current `WebGLProgressSignalSource` as the only runtime progress input contract.
- Add descriptor-level scene/pass/stage/light activation from timeline progress without React prop churn.
- Add target effect context scopes for `ctx.runtime` and `ctx.scene`.
- Keep target-local effects on `ctx.object`; add scope metadata, not raw scene/camera handles.
- Add `WebGLScrollTimeline` as the broader React scroll-adapter component, while keeping `ScrollEffectSection` compatible.
- Add focused tests for timeline declaration normalization, React scroll timeline behavior, runtime timeline activation, effect scope context, and public export boundaries.
- Update README, package onboarding/usage docs, effect boundary docs, examples docs, `docs/STATUS.md`, and this roadmap after implementation.

Out of scope:

- No raw Three.js object exposure.
- No target-local implicit `ctx.camera`; camera-selected rendering remains pass-owned.
- No pass viewport/scissor or DOM-bound local clipping; Phase 6 owns it.
- No pass-scoped postprocess migration; Phase 6 owns it.
- No `screen-plane`; Phase 8 pre-step owns it.
- No scene-native `WebGLModel`; Phase 7 owns it.
- No model clip defaults, crossfade, morph, or rig diagnostics; Phase 7 owns them.
- No picking, raycasting, collider, object hit state, or physics.
- No generic render graph, plugin system, unsafe escape hatch, or R3F-style JSX mapping.
- No implementation commit unless the user explicitly asks after verification.

## API And Architecture Principles

- `WebGLTarget` remains the shortest and default path.
- Timeline authoring is descriptor-driven and uses stable ids.
- React composition owns DOM refs for scroll timelines; runtime core never queries DOM selectors for React consumers.
- Scroll libraries can produce progress signals but cannot own renderer, scene, camera, render loop, or internal objects.
- Scene/stage declarations stay stable. High-frequency progress changes update runtime-managed state, not React descriptor props.
- Camera declarations stay descriptor-only in Phase 5. Phase 6A owns future
  camera motion/focus/framing through an explicit camera controller or
  camera/pass-bound descriptor that consumes the same named timeline signal.
- `ctx.runtime` and `ctx.scene` expose managed metadata/facades only.
- Target effects do not receive an implicit active camera. Camera controls must be explicit descriptor/controller work, not a side effect of target ownership.
- All new public types must be exported through package entrypoints and covered by `publicExports.test.ts`.
- All new public tests must reject raw Three.js handles and raw GSAP timelines as declaration fields.

## Proposed Public Surface

Runtime timeline binding:

```ts
export type WebGLTimelineActiveRangeDeclaration = {
  readonly from?: number;
  readonly to?: number;
};

export type WebGLTimelineBindingDeclaration =
  | string
  | {
      readonly id: string;
      readonly progressKey?: string;
      readonly active?: WebGLTimelineActiveRangeDeclaration;
    };
```

Recommended semantics:

- `timeline: "hero.3d"` means `id: "hero.3d"` and `progressKey: "hero.3d"`.
- `progressKey` lets an external store use a different key while the descriptor keeps a stable public timeline id.
- `active.from` defaults to `0`; `active.to` defaults to `1`.
- A binding without `active` only exposes progress metadata; it does not toggle visibility or pass rendering.
- `active` toggles managed scene/pass rendering and stage/light visibility through runtime-owned state.

Descriptor extensions:

```ts
type WebGLSceneDeclaration = {
  id: string;
  projection?: WebGLSceneProjection;
  defaultCameraId?: string;
  defaultPass?: boolean;
  timeline?: WebGLTimelineBindingDeclaration;
};

type WebGLDeclaration = {
  key: string;
  sceneId?: string;
  timeline?: WebGLTimelineBindingDeclaration;
  source?: WebGLSourceDeclaration;
  effects?: WebGLEffectsDeclaration;
};
```

Phase 5 deliberately does not add `timeline` to `WebGLCameraDeclaration`.
Camera progress/motion/focus/framing remains Phase 6A explicit
camera-controller or camera/pass-bound descriptor work. This avoids shipping a
camera timeline field that has no behavior yet.

Effect context additions:

```ts
export type WebGLEffectTimelineScope = {
  readonly id: string;
  readonly progressKey: string;
  readonly progress: number;
  readonly active: boolean;
};

export type WebGLEffectRuntimeScope = {
  readonly progress: WebGLProgressSignalSource;
};

export type WebGLEffectSceneScope = {
  readonly id: string;
  readonly projection: WebGLSceneProjection;
  readonly timeline?: WebGLEffectTimelineScope;
};

export type WebGLEffectContext = {
  runtime: WebGLEffectRuntimeScope;
  scene?: WebGLEffectSceneScope;
  object: WebGLEffectObjectHandle;
};
```

React scroll timeline bridge:

```tsx
<WebGLScrollTimeline
  id="hero.3d"
  as="section"
  start="top top"
  end="+=300%"
  pin
  scrub
>
  <WebGLScene
    id="heroScene"
    projection="perspective-stage"
    timeline={{ id: "hero.3d", active: { from: 0, to: 1 } }}
    render={{ camera: "hero.camera" }}
  >
    <WebGLCamera id="hero.camera" sceneId="heroScene" default />
    <WebGLStagePlane id="floor" scene="heroScene" timeline="hero.3d" />
  </WebGLScene>
</WebGLScrollTimeline>
```

`ScrollEffectSection` remains available and should be implemented on top of the same internal scroll-trigger section helper.

## File Structure

- Create `packages/dom-webgl-runtime/src/lib/timeline/timelineDeclarations.ts`
  - Normalize timeline ids, progress keys, and active ranges.
- Create `packages/dom-webgl-runtime/test/lib/timeline/timelineDeclarations.test.ts`
  - Cover string/object bindings, defaults, trimming, invalid ids, invalid ranges, and clamping rules.
- Modify `packages/dom-webgl-runtime/src/lib/types.ts`
  - Add public timeline binding types and descriptor fields.
  - Add debug summary timeline fields only as descriptor data.
- Modify `packages/dom-webgl-runtime/src/index.ts`
  - Export new public timeline types.
- Modify `packages/dom-webgl-runtime/src/lib/renderer/renderLayerDeclarations.ts`
  - Normalize timeline fields on scenes.
- Modify `packages/dom-webgl-runtime/src/lib/renderer/renderLayerRegistry.ts`
  - Store normalized timeline metadata on scene entries.
  - Skip scene render passes when scene timeline active range is inactive.
- Modify `packages/dom-webgl-runtime/src/lib/renderer/stageDeclarations.ts`
  - Normalize timeline fields on stage primitives and lights.
- Modify `packages/dom-webgl-runtime/src/lib/renderer/stageObjectRegistry.ts`
  - Store timeline metadata and update scene object visibility from runtime progress.
- Modify `packages/dom-webgl-runtime/src/lib/effects/effectAuthoring.ts`
  - Add `WebGLEffectRuntimeScope`, `WebGLEffectSceneScope`, and `WebGLEffectTimelineScope`.
- Create `packages/dom-webgl-runtime/src/lib/effects/effectScopes.ts`
  - Build managed effect scope metadata from target descriptor, render layer scene entry, and progress source.
- Modify `packages/dom-webgl-runtime/src/lib/effects/effectContext.ts`
  - Add `runtime` and `scene` fields.
- Modify `packages/dom-webgl-runtime/src/lib/effects/effectController.ts`
  - Keep reusable effect contexts in sync with scope progress.
- Modify `packages/dom-webgl-runtime/src/lib/render/renderableFactory.ts`
  - Thread scope readers into renderable/effect controller creation.
- Modify `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`
  - Provide scope readers, call timeline activation updates, and keep debug state descriptor-only.
- Modify `packages/dom-webgl-runtime/src/react.ts`
  - Export no timeline component from runtime React entrypoint in this phase.
- Modify `packages/dom-webgl-runtime/src/lib/react/WebGLScene.tsx`
  - Forward `timeline` on scene registration.
- Modify `packages/dom-webgl-runtime/src/lib/react/WebGLStagePlane.tsx`, `WebGLStageBox.tsx`, and `WebGLLight.tsx`
  - Forward `timeline` descriptors.
- Modify `packages/dom-webgl-scroll-adapters/src/react.ts`
  - Export `WebGLScrollTimeline` and keep `ScrollEffectSection` compatible.
- Modify `packages/dom-webgl-scroll-adapters/test/react.test.ts`
  - Cover `WebGLScrollTimeline`, inherited store behavior, and compatibility wrapper behavior.
- Modify `packages/dom-webgl-runtime/test/lib/effects/effectController.test.ts`
  - Cover `ctx.runtime.progress` and `ctx.scene.timeline`.
- Modify `packages/dom-webgl-runtime/test/lib/renderer/renderLayerRegistry.test.ts`
  - Cover scene timeline metadata and inactive pass skipping.
- Modify `packages/dom-webgl-runtime/test/lib/renderer/stageObjectRegistry.test.ts`
  - Cover timeline-driven stage/light visibility.
- Modify `packages/dom-webgl-runtime/test/lib/renderer/runtimePipeline.test.ts`
  - Cover integrated target scene scope and timeline activation.
- Modify `packages/dom-webgl-runtime/test/lib/react/WebGLScene.test.tsx`, `WebGLStagePlane.test.tsx`, `WebGLStageBox.test.tsx`, and `WebGLLight.test.tsx`
  - Cover timeline prop forwarding.
- Modify `packages/dom-webgl-runtime/test/publicExports.test.ts`
  - Cover new public types and reject raw timeline/controller objects.
- Create or modify `apps/example/src/ManagedTimelineExample.tsx`
  - Dogfood `WebGLScrollTimeline` and timeline-bound managed scene/stage activation through public imports only.
- Modify `apps/example/test/ManagedTimelineExample.test.tsx`
  - Assert public imports and stable descriptor values.
- Modify docs:
  - `README.md`
  - `docs/STATUS.md`
  - `docs/agent/package-onboarding.md`
  - `docs/agent/package-usage.md`
  - `docs/agent/effect-object-boundary.md`
  - `docs/examples/effect-authoring.md`
  - `docs/roadmap/managed-render-system.md`

## Task 1: Timeline Declaration Contract

**Files:**
- Create: `packages/dom-webgl-runtime/src/lib/timeline/timelineDeclarations.ts`
- Create: `packages/dom-webgl-runtime/test/lib/timeline/timelineDeclarations.test.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/types.ts`
- Modify: `packages/dom-webgl-runtime/src/index.ts`
- Modify: `packages/dom-webgl-runtime/test/publicExports.test.ts`

- [ ] **Step 1: Write failing timeline normalizer tests**

Create `packages/dom-webgl-runtime/test/lib/timeline/timelineDeclarations.test.ts` with tests for these cases:

```ts
import { describe, expect, test } from "vitest";

import {
  normalizeTimelineBinding,
  readTimelineProgress,
} from "../../../src/lib/timeline/timelineDeclarations";

describe("normalizeTimelineBinding", () => {
  test("normalizes string bindings into id and progressKey", () => {
    expect(normalizeTimelineBinding(" hero.3d ")).toEqual({
      id: "hero.3d",
      progressKey: "hero.3d",
    });
  });

  test("normalizes object bindings with active ranges", () => {
    expect(
      normalizeTimelineBinding({
        id: "hero.3d",
        progressKey: "scroll.hero",
        active: { from: 0.2, to: 0.8 },
      }),
    ).toEqual({
      id: "hero.3d",
      progressKey: "scroll.hero",
      active: { from: 0.2, to: 0.8 },
    });
  });

  test("defaults active range boundaries", () => {
    expect(
      normalizeTimelineBinding({
        id: "hero.3d",
        active: {},
      }),
    ).toEqual({
      id: "hero.3d",
      progressKey: "hero.3d",
      active: { from: 0, to: 1 },
    });
  });

  test("rejects empty ids and reversed active ranges", () => {
    expect(() => normalizeTimelineBinding(" ")).toThrow(
      "WebGL timeline id must be a non-empty string.",
    );
    expect(() =>
      normalizeTimelineBinding({
        id: "hero.3d",
        active: { from: 0.9, to: 0.1 },
      }),
    ).toThrow("WebGL timeline active range must have from <= to.");
  });
});

describe("readTimelineProgress", () => {
  test("reads progress and active state from the runtime progress source", () => {
    const binding = normalizeTimelineBinding({
      id: "hero.3d",
      active: { from: 0.25, to: 0.75 },
    });

    expect(readTimelineProgress(binding, { get: () => 0.5 })).toEqual({
      id: "hero.3d",
      progressKey: "hero.3d",
      progress: 0.5,
      active: true,
    });
    expect(readTimelineProgress(binding, { get: () => 0.9 })).toEqual({
      id: "hero.3d",
      progressKey: "hero.3d",
      progress: 0.9,
      active: false,
    });
  });
});
```

- [ ] **Step 2: Run the failing normalizer tests**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/timeline/timelineDeclarations.test.ts
```

Expected: fail because `timelineDeclarations.ts` does not exist.

- [ ] **Step 3: Add public timeline types**

In `packages/dom-webgl-runtime/src/lib/types.ts`, add:

```ts
export type WebGLTimelineActiveRangeDeclaration = {
  readonly from?: number;
  readonly to?: number;
};

export type WebGLTimelineBindingDeclaration =
  | string
  | {
      readonly id: string;
      readonly progressKey?: string;
      readonly active?: WebGLTimelineActiveRangeDeclaration;
    };
```

Add optional `timeline?: WebGLTimelineBindingDeclaration` to `WebGLDeclaration`, `WebGLSceneDeclaration`, `WebGLStagePlaneDeclaration`, `WebGLStageBoxDeclaration`, and `WebGLLightDeclaration`.

Do not add `timeline` to `WebGLCameraDeclaration` in this phase. Add a
`@ts-expect-error` public export guard proving camera declarations reject a
timeline field until a later camera-controller plan gives it behavior.

- [ ] **Step 4: Implement the normalizer**

Create `packages/dom-webgl-runtime/src/lib/timeline/timelineDeclarations.ts`:

```ts
import type {
  WebGLProgressSignalSource,
  WebGLTimelineBindingDeclaration,
  WebGLTuple2,
} from "../types";

export type NormalizedTimelineBinding = {
  readonly id: string;
  readonly progressKey: string;
  readonly active?: {
    readonly from: number;
    readonly to: number;
  };
};

export type TimelineProgressSnapshot = {
  readonly id: string;
  readonly progressKey: string;
  readonly progress: number;
  readonly active: boolean;
};

export function normalizeTimelineBinding(
  declaration: WebGLTimelineBindingDeclaration | undefined,
): NormalizedTimelineBinding | undefined {
  if (declaration === undefined) {
    return undefined;
  }

  if (typeof declaration === "string") {
    const id = normalizeTimelineId(declaration);
    return { id, progressKey: id };
  }

  const id = normalizeTimelineId(declaration.id);
  const progressKey =
    declaration.progressKey === undefined
      ? id
      : normalizeTimelineId(declaration.progressKey);

  return {
    id,
    progressKey,
    ...(declaration.active
      ? { active: normalizeActiveRange(declaration.active) }
      : {}),
  };
}

export function readTimelineProgress(
  binding: NormalizedTimelineBinding,
  progressSignals: WebGLProgressSignalSource,
): TimelineProgressSnapshot {
  const progress = clampProgress(progressSignals.get(binding.progressKey));
  const active = binding.active
    ? progress >= binding.active.from && progress <= binding.active.to
    : true;

  return {
    id: binding.id,
    progressKey: binding.progressKey,
    progress,
    active,
  };
}

function normalizeTimelineId(value: string): string {
  const id = value.trim();
  if (!id) {
    throw new Error("WebGL timeline id must be a non-empty string.");
  }
  return id;
}

function normalizeActiveRange(
  range: NonNullable<
    Extract<WebGLTimelineBindingDeclaration, object>["active"]
  >,
): { from: number; to: number } {
  const from = normalizeRangeBoundary(range.from, 0, "from");
  const to = normalizeRangeBoundary(range.to, 1, "to");

  if (from > to) {
    throw new Error("WebGL timeline active range must have from <= to.");
  }

  return { from, to };
}

function normalizeRangeBoundary(
  value: number | undefined,
  fallback: number,
  label: "from" | "to",
): number {
  if (value === undefined) {
    return fallback;
  }
  if (!Number.isFinite(value)) {
    throw new Error(`WebGL timeline active range ${label} must be finite.`);
  }
  return clampProgress(value);
}

function clampProgress(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}
```

- [ ] **Step 5: Export and guard the public surface**

In `packages/dom-webgl-runtime/src/index.ts`, export:

```ts
type WebGLTimelineActiveRangeDeclaration,
type WebGLTimelineBindingDeclaration,
```

In `packages/dom-webgl-runtime/test/publicExports.test.ts`, add positive `satisfies` checks for timeline declarations and negative checks for raw timeline/controller objects:

```ts
const sceneTimeline =
  "hero.3d" satisfies WebGLTimelineBindingDeclaration;
const activeTimeline = {
  id: "hero.3d",
  progressKey: "scroll.hero",
  active: { from: 0.2, to: 0.8 },
} satisfies WebGLTimelineBindingDeclaration;

// @ts-expect-error raw GSAP timelines are not timeline declarations.
({ id: "hero.3d", timeline: { progress() { return 0; } } } satisfies WebGLSceneDeclaration);
```

- [ ] **Step 6: Verify Task 1**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/timeline/timelineDeclarations.test.ts packages/dom-webgl-runtime/test/publicExports.test.ts
```

Expected: pass.

## Task 2: React Scroll Timeline Bridge

**Files:**
- Modify: `packages/dom-webgl-scroll-adapters/src/react.ts`
- Modify: `packages/dom-webgl-scroll-adapters/test/react.test.ts`
- Modify: `packages/dom-webgl-scroll-adapters/test/reactSmooth.test.ts`
- Modify: `docs/agent/scroll-adapters.md` if existing wording references only `ScrollEffectSection`

- [ ] **Step 1: Add failing React tests**

In `packages/dom-webgl-scroll-adapters/test/react.test.ts`, add tests proving:

```ts
expect(reactEntry).toHaveProperty("WebGLScrollTimeline");
```

and that `<WebGLScrollTimeline id="hero.3d" ...>` writes progress under `"hero.3d"` while `<ScrollEffectSection progressKey="hero.reveal" ...>` still writes progress under `"hero.reveal"`.

- [ ] **Step 2: Run the failing React scroll tests**

Run:

```bash
npm test -- --run packages/dom-webgl-scroll-adapters/test/react.test.ts
```

Expected: fail because `WebGLScrollTimeline` is not exported yet.

- [ ] **Step 3: Add `WebGLScrollTimeline`**

In `packages/dom-webgl-scroll-adapters/src/react.ts`, add:

```ts
export type WebGLScrollTimelineProps = Omit<
  ScrollEffectSectionProps,
  "progressKey"
> & {
  readonly id: string;
  readonly progressKey?: string;
};

export function WebGLScrollTimeline({
  id,
  progressKey = id,
  ...props
}: WebGLScrollTimelineProps) {
  return createScrollTimelineElement({ ...props, progressKey });
}
```

Refactor the current `ScrollEffectSection` body into a shared `createScrollTimelineElement(...)` helper so the compatibility component stays behavior-identical:

```ts
export function ScrollEffectSection(props: ScrollEffectSectionProps) {
  return createScrollTimelineElement(props);
}
```

- [ ] **Step 4: Verify scroll bridge compatibility**

Run:

```bash
npm test -- --run packages/dom-webgl-scroll-adapters/test/react.test.ts packages/dom-webgl-scroll-adapters/test/reactSmooth.test.ts packages/dom-webgl-scroll-adapters/test/scrollEffectProgress.test.ts
```

Expected: pass.

## Task 3: Timeline Metadata In Render Layers And Stage Objects

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/renderLayerDeclarations.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/renderLayerRegistry.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/stageDeclarations.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/stageObjectRegistry.ts`
- Modify: `packages/dom-webgl-runtime/test/lib/renderer/renderLayerDeclarations.test.ts`
- Modify: `packages/dom-webgl-runtime/test/lib/renderer/renderLayerRegistry.test.ts`
- Modify: `packages/dom-webgl-runtime/test/lib/renderer/stageDeclarations.test.ts`
- Modify: `packages/dom-webgl-runtime/test/lib/renderer/stageObjectRegistry.test.ts`

- [ ] **Step 1: Write failing renderer/stage tests**

Add tests that assert:

- scene normalizers preserve normalized timeline metadata;
- render passes for an inactive timeline-bound scene are skipped;
- stage primitive and light controllers receive `setVisible(false)` when their active ranges are inactive;
- bindings without `active` never toggle visibility.

- [ ] **Step 2: Run failing tests**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/renderer/renderLayerDeclarations.test.ts packages/dom-webgl-runtime/test/lib/renderer/renderLayerRegistry.test.ts packages/dom-webgl-runtime/test/lib/renderer/stageDeclarations.test.ts packages/dom-webgl-runtime/test/lib/renderer/stageObjectRegistry.test.ts
```

Expected: fail because timeline metadata is not stored or applied.

- [ ] **Step 3: Store normalized timeline metadata**

Add `timeline?: NormalizedTimelineBinding` to normalized scene/stage/light declarations and internal scene/stage registry entries.

- [ ] **Step 4: Apply active scene render gating**

Add a render-layer method:

```ts
updateTimelineState(progressSignals: WebGLProgressSignalSource): void;
```

Store current scene active states in the registry, and skip inactive scene passes in `renderPasses(...)` before resolving camera render work.

- [ ] **Step 5: Apply active stage/light visibility**

Add `updateTimelineState(progressSignals)` to `StageObjectRegistry`, and call `controller.setVisible(snapshot.active)` for entries with an active binding.

- [ ] **Step 6: Verify Task 3**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/renderer/renderLayerDeclarations.test.ts packages/dom-webgl-runtime/test/lib/renderer/renderLayerRegistry.test.ts packages/dom-webgl-runtime/test/lib/renderer/stageDeclarations.test.ts packages/dom-webgl-runtime/test/lib/renderer/stageObjectRegistry.test.ts
```

Expected: pass.

## Task 4: Runtime Timeline Updates And Debug State

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/debug/debugState.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/types.ts`
- Modify: `packages/dom-webgl-runtime/test/lib/renderer/runtimePipeline.test.ts`
- Modify: `packages/dom-webgl-runtime/test/lib/debug/debugState.test.ts`

- [ ] **Step 1: Add failing runtime integration tests**

Add tests proving:

- `progressSignals.subscribe` still wakes the loop on progress changes;
- timeline-bound stage objects update visibility without remounting React descriptors;
- inactive timeline-bound scenes do not render their passes;
- debug state includes descriptor-only timeline metadata, not raw objects.

- [ ] **Step 2: Run failing runtime tests**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/renderer/runtimePipeline.test.ts packages/dom-webgl-runtime/test/lib/debug/debugState.test.ts
```

Expected: fail until runtime calls the new timeline update hooks.

- [ ] **Step 3: Update runtime frame sync**

In `syncFrame(...)` or immediately before `renderScene()`, call:

```ts
renderLayers.updateTimelineState(readProgressSignals());
stageObjects.updateTimelineState(readProgressSignals());
```

Use a single helper so `options.progressSignals` remains optional and missing keys read as `0`.

- [ ] **Step 4: Keep debug state descriptor-only**

Add optional summary fields such as:

```ts
timeline?: {
  id: string;
  progressKey: string;
  active?: boolean;
};
```

Do not include progress source objects, subscribers, GSAP timelines, DOM elements, Three scenes, cameras, meshes, lights, or materials.

- [ ] **Step 5: Verify Task 4**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/renderer/runtimePipeline.test.ts packages/dom-webgl-runtime/test/lib/debug/debugState.test.ts
```

Expected: pass.

## Task 5: Managed Effect Scopes

**Files:**
- Create: `packages/dom-webgl-runtime/src/lib/effects/effectScopes.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/effects/effectAuthoring.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/effects/effectContext.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/effects/effectController.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderableFactory.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`
- Modify: `packages/dom-webgl-runtime/test/lib/effects/effectController.test.ts`
- Modify: `packages/dom-webgl-runtime/test/lib/effects/effect-boundary.test.ts`
- Modify: `packages/dom-webgl-runtime/test/publicExports.test.ts`

- [ ] **Step 1: Add failing effect scope tests**

Add tests proving:

```ts
ctx.runtime.progress.get("hero.3d") satisfies number;
ctx.scene?.id satisfies string;
ctx.scene?.projection satisfies WebGLSceneProjection;
ctx.scene?.timeline?.progress satisfies number;
```

Also add a negative public export test:

```ts
// @ts-expect-error effect scene scope does not expose raw Three scene.
ctx.scene.scene;
// @ts-expect-error target-local effects do not receive implicit cameras.
ctx.camera.camera;
```

- [ ] **Step 2: Run failing effect scope tests**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/effects/effectController.test.ts packages/dom-webgl-runtime/test/lib/effects/effect-boundary.test.ts packages/dom-webgl-runtime/test/publicExports.test.ts
```

Expected: fail because `ctx.runtime` and `ctx.scene` do not exist yet.

- [ ] **Step 3: Add effect scope types**

In `effectAuthoring.ts`, add the `WebGLEffectTimelineScope`, `WebGLEffectRuntimeScope`, and `WebGLEffectSceneScope` types from the Proposed Public Surface section. Add `runtime` and optional `scene` to `WebGLEffectContext`.

- [ ] **Step 4: Build scope snapshots**

Create `effectScopes.ts` with a pure function that receives:

- target key;
- target scene id;
- internal scene projection;
- optional scene timeline binding;
- runtime progress source.

It returns only serializable metadata and progress values.

- [ ] **Step 5: Thread scopes into effect controllers**

Add a `readScopes?()` option to `WebGLEffectControllerOptions`. On every update, refresh `context.runtime` and `context.scene` just like `layout`, `input`, `pointer`, `targetPointer`, `scroll`, `scrollProgress`, `time`, `delta`, and `object` are refreshed today.

- [ ] **Step 6: Verify Task 5**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/effects/effectController.test.ts packages/dom-webgl-runtime/test/lib/effects/effect-boundary.test.ts packages/dom-webgl-runtime/test/publicExports.test.ts
```

Expected: pass.

## Task 6: React Descriptor Forwarding

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/react/WebGLScene.tsx`
- Modify: `packages/dom-webgl-runtime/src/lib/react/WebGLTarget.tsx`
- Modify: `packages/dom-webgl-runtime/src/lib/react/WebGLStagePlane.tsx`
- Modify: `packages/dom-webgl-runtime/src/lib/react/WebGLStageBox.tsx`
- Modify: `packages/dom-webgl-runtime/src/lib/react/WebGLLight.tsx`
- Modify tests under `packages/dom-webgl-runtime/test/lib/react/`

- [ ] **Step 1: Add failing React forwarding tests**

Scene, target, stage primitive, and light React descriptor tests should assert that `timeline` is forwarded unchanged to the runtime registration call:

```ts
expect(runtime.registerScene).toHaveBeenCalledWith({
  id: "world",
  projection: undefined,
  defaultCameraId: undefined,
  defaultPass: undefined,
  timeline: "hero.3d",
});
```

- [ ] **Step 2: Run failing React tests**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/react/WebGLScene.test.tsx packages/dom-webgl-runtime/test/lib/react/WebGLTarget.test.tsx packages/dom-webgl-runtime/test/lib/react/WebGLStagePlane.test.tsx packages/dom-webgl-runtime/test/lib/react/WebGLStageBox.test.tsx packages/dom-webgl-runtime/test/lib/react/WebGLLight.test.tsx
```

Expected: fail where non-camera timeline props are not yet forwarded.
`WebGLCamera.test.tsx` is intentionally not part of this forwarding loop because
camera declarations do not receive `timeline` in Phase 5.

- [ ] **Step 3: Forward timeline props**

Add `timeline` to the relevant non-camera prop destructuring and registration
payloads. Keep dependency arrays explicit and stable. Leave `WebGLCamera`
without a `timeline` prop in Phase 5.

- [ ] **Step 4: Verify Task 6**

Run the same React test command. Expected: pass.

## Task 7: Example Dogfood

**Files:**
- Create: `apps/example/src/ManagedTimelineExample.tsx`
- Create: `apps/example/test/ManagedTimelineExample.test.tsx`
- Modify: `apps/example/src/App.tsx`
- Modify: `apps/example/src/example.css`
- Modify: `apps/example/test/App.test.tsx`

- [ ] **Step 1: Add failing example test**

Mock public imports and assert the example uses:

- `WebGLScrollTimeline` from `@project/dom-webgl-scroll-adapters/react`;
- `WebGLScene`, `WebGLCamera`, `WebGLStagePlane`, and `WebGLLight` from `@project/dom-webgl-runtime/react`;
- stable timeline id `"example.managedTimeline"`;
- no package source imports.

- [ ] **Step 2: Run failing example tests**

Run:

```bash
npm test -- --run apps/example/test/ManagedTimelineExample.test.tsx apps/example/test/App.test.tsx apps/example/test/import-boundary.test.ts
```

Expected: fail until the example exists and is wired.

- [ ] **Step 3: Add the dogfood component**

Use a small public-import-only component with Chinese visible copy and stable descriptor constants at module scope. Do not imply DOM-bound clipping; visible text should describe a timeline-driven stage scene, not a locally clipped viewport.

- [ ] **Step 4: Verify Task 7**

Run the same example test command. Expected: pass.

## Task 8: Documentation And Roadmap Closeout

**Files:**
- Modify: `README.md`
- Modify: `docs/STATUS.md`
- Modify: `docs/agent/package-onboarding.md`
- Modify: `docs/agent/package-usage.md`
- Modify: `docs/agent/effect-object-boundary.md`
- Modify: `docs/examples/effect-authoring.md`
- Modify: `docs/roadmap/managed-render-system.md`

- [ ] **Step 1: Update active docs**

Document:

- `WebGLTarget` remains the shortest path.
- `WebGLScrollTimeline` is the broader timeline component.
- `ScrollEffectSection` remains compatibility sugar.
- Timeline bindings are descriptor data and consume `WebGLProgressSignalSource`.
- Phase 5 timeline bindings apply to targets, scenes, stage primitives, and
  scene-owned lights, not camera declarations.
- Phase 6A camera controllers should reuse named timeline signals through an
  explicit camera/pass-bound API instead of a Phase 5 camera `timeline` prop.
- `ctx.runtime` and `ctx.scene` are managed scopes, not raw runtime/scene handles.
- `ctx.camera` is not implicit for target-local effects.
- Phase 6 still owns DOM-bound pass viewport/scissor and pass-scoped postprocess.

- [ ] **Step 2: Update roadmap status after implementation**

Only after code, tests, docs, and commit are closed, change Phase 5 from `[planned]` to `[verified]`. Before commit, use `[implemented]` if code is done but verification or docs are not closed.

- [ ] **Step 3: Run docs whitespace check**

Run:

```bash
git diff --check README.md docs/STATUS.md docs/agent/package-onboarding.md docs/agent/package-usage.md docs/agent/effect-object-boundary.md docs/examples/effect-authoring.md docs/roadmap/managed-render-system.md
```

Expected: no output.

## Verification Strategy

Focused verification during implementation:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/timeline/timelineDeclarations.test.ts
npm test -- --run packages/dom-webgl-scroll-adapters/test/react.test.ts packages/dom-webgl-scroll-adapters/test/reactSmooth.test.ts packages/dom-webgl-scroll-adapters/test/scrollEffectProgress.test.ts
npm test -- --run packages/dom-webgl-runtime/test/lib/renderer/renderLayerDeclarations.test.ts packages/dom-webgl-runtime/test/lib/renderer/renderLayerRegistry.test.ts packages/dom-webgl-runtime/test/lib/renderer/stageDeclarations.test.ts packages/dom-webgl-runtime/test/lib/renderer/stageObjectRegistry.test.ts
npm test -- --run packages/dom-webgl-runtime/test/lib/renderer/runtimePipeline.test.ts packages/dom-webgl-runtime/test/lib/debug/debugState.test.ts
npm test -- --run packages/dom-webgl-runtime/test/lib/effects/effectController.test.ts packages/dom-webgl-runtime/test/lib/effects/effect-boundary.test.ts packages/dom-webgl-runtime/test/publicExports.test.ts
npm test -- --run packages/dom-webgl-runtime/test/lib/react/WebGLScene.test.tsx packages/dom-webgl-runtime/test/lib/react/WebGLTarget.test.tsx packages/dom-webgl-runtime/test/lib/react/WebGLStagePlane.test.tsx packages/dom-webgl-runtime/test/lib/react/WebGLStageBox.test.tsx packages/dom-webgl-runtime/test/lib/react/WebGLLight.test.tsx
npm test -- --run apps/example/test/ManagedTimelineExample.test.tsx apps/example/test/App.test.tsx apps/example/test/import-boundary.test.ts
```

Final verification before claiming completion:

```bash
npm run test -- --run
npm run typecheck
npm run build
npm run check:imports
git diff --check
```

## Exit Criteria

- Phase 5 public timeline binding types are exported and covered by type boundary tests.
- `WebGLScrollTimeline` exists and `ScrollEffectSection` remains compatible.
- Existing Level 1 `WebGLTarget` usage still works without scenes, cameras, passes, or timelines.
- React scene/target/stage/light descriptors forward `timeline` without descriptor churn.
- React camera descriptors do not accept `timeline` in Phase 5.
- Runtime scene/pass and stage/light activation can consume a named timeline progress signal.
- Target effects can read `ctx.runtime.progress` and `ctx.scene.timeline` without raw internals.
- Target-local effects do not get an implicit active camera.
- Debug state reports timeline metadata as descriptor-only summaries.
- Docs explain what Phase 5 added and what remains Phase 6/7/8 work.
- Full verification passes.

## Risks

- Adding `timeline` to too many descriptors can look like a generic controller system. Keep the initial binding narrow: progress metadata plus optional active range.
- Scene activation can be mistaken for DOM clipping. Docs and examples must clearly say Phase 6 owns viewport/scissor.
- `ctx.scene` can invite raw scene expectations. Public types and docs must state that it is managed metadata/facade only.
- Camera scope is tempting to add implicitly. Do not expose `ctx.camera` or
  `WebGLCameraDeclaration.timeline` until a Phase 6A explicit camera controller or
  pass binding gives camera timeline consumption concrete behavior.
- React `WebGLScrollTimeline` could duplicate `ScrollEffectSection`. Implement it as the shared primitive and leave `ScrollEffectSection` as compatibility sugar.
- Timeline progress changes can over-render if every update forces continuous frame mode. Keep using existing `progressSignals.subscribe` and dirty frame requests.
- Public debug summaries can leak internals if they include objects. Keep summaries to ids, progress keys, active state, projection, placement, and counts.

## Open Decision For User Confirmation

User decision: narrow Phase 5 so timeline bindings land for targets, scenes,
stage primitives, and scene-owned lights only. Do not add
`WebGLCameraDeclaration.timeline`, implicit `ctx.camera`, or camera motion in
this phase. Phase 6A owns progress-driven camera motion/focus/framing, any
future `WebGLCameraDeclaration.timeline`, and the explicit camera/pass-bound
controller API. Pointer parallax, orbit, pan, and empty-space drag camera
controllers remain Phase 8 work.
