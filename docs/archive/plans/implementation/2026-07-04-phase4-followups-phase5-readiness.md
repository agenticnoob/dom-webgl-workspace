# Phase 4 Follow-Ups And Phase 5 Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the narrow Phase 4 review gaps without expanding Phase 4 scope, and make the project ready for a focused Phase 5 plan.

**Architecture:** Keep Phase 4 verified. Add only roadmap/doc truth corrections, a public-API example dogfood path, descriptor stability guidance, and small debug inventory support. Do not add `screen-plane`, stage material textures, scene-native `WebGLModel`, pass-scoped postprocess, scoped effect contexts, or generic stage abstractions in this loop.

**Tech Stack:** TypeScript, React, Vite example app, Vitest, jsdom, existing DOM WebGL runtime descriptors.

---

## Current Truth

- Current branch: `codex/managed-render-roadmap-iteration`.
- Current HEAD before planning: `4b6552dd feat: add managed stage primitives`.
- Worktree was clean before writing this plan.
- `docs/roadmap/managed-render-system.md` marks Phase 4 as `[verified]`.
- `docs/STATUS.md` says Phase 4 added `WebGLStagePlane`, `WebGLStageBox`, `WebGLLight`, and vanilla `registerStagePrimitive` / `registerLight` APIs.
- Phase 5 is still `[not-started]` and has no focused plan.
- Known review gaps to close:
  - Phase 5 dependency text should include Phase 4 because Phase 5 timelines/effect scopes will route stage objects.
  - `apps/example` should dogfood managed stage primitives through public imports.
  - Stage/light descriptor update semantics should be explicit: descriptors are stable declarations; high-frequency animation belongs in later scoped controllers/effects, not React prop churn.
  - Debug state should expose a small stage/light inventory without raw Three.js handles.

## Scope

In scope:

- Roadmap/status/docs corrections for the review findings.
- One minimal public-import example component that declares a lit managed scene with stage primitives and lights.
- Tests proving the example uses public stage APIs and does not use runtime internals.
- Docs and type/debug tests for descriptor stability guidance.
- Minimal debug inventory counts and ids for managed stage primitives and scene-owned lights.
- Full repo verification after implementation.

Out of scope:

- Do not implement Phase 5 target routing, scroll timelines, scoped `ctx.scene`, scoped `ctx.camera`, or scoped `ctx.runtime`.
- Do not implement `screen-plane`; it remains a Phase 8 pre-step.
- Do not implement stage material texture descriptors.
- Do not implement scene-native `WebGLModel`.
- Do not add raw Three.js handles to public debug state.
- Do not create a generic `<WebGLStage kind="...">` wrapper.
- Do not commit unless the user explicitly asks for a commit after verification.

## File Structure

- Modify `docs/roadmap/managed-render-system.md`
  - Correct Phase 5 dependency/status notes.
  - Add a short Phase 5 focused-plan reminder for stage descriptor stability and debug inventory.
- Modify `docs/STATUS.md`
  - Add active caveat for stable stage/light descriptors.
  - Mention stage/light debug inventory after the debug implementation lands.
- Modify `README.md`, `docs/agent/package-usage.md`, and `docs/agent/package-onboarding.md`
  - Add descriptor stability wording near the managed stage primitive sections.
- Create `apps/example/src/ManagedStagePrimitiveExample.tsx`
  - Public API dogfood component for a managed perspective-stage scene.
- Modify `apps/example/src/App.tsx`
  - Render the new example in the existing vertical catalog.
- Modify `apps/example/src/example.css`
  - Add a small layout wrapper for the stage dogfood row.
- Create `apps/example/test/ManagedStagePrimitiveExample.test.tsx`
  - Assert the example uses public React stage descriptors and stable descriptor values.
- Modify `apps/example/test/App.test.tsx`
  - Extend the runtime React mock to include stage APIs and assert the new component is present without changing target count expectations.
- Modify `packages/dom-webgl-runtime/src/lib/types.ts`
  - Add public debug summary types for managed stage primitives and lights.
- Modify `packages/dom-webgl-runtime/src/lib/debug/debugState.ts`
  - Copy stage/light summaries into public debug snapshots.
- Modify `packages/dom-webgl-runtime/src/lib/renderer/stageObjectRegistry.ts`
  - Add an `inspect()` method that returns descriptor-only stage/light summaries.
- Modify `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`
  - Include `stageObjects.inspect()` in `createCurrentDebugState()`.
- Modify tests:
  - `packages/dom-webgl-runtime/test/lib/debug/debugState.test.ts`
  - `packages/dom-webgl-runtime/test/lib/renderer/stageObjectRegistry.test.ts`
  - `packages/dom-webgl-runtime/test/lib/renderer/runtimePipeline.test.ts`
  - `packages/dom-webgl-runtime/test/publicExports.test.ts`

## Task 1: Roadmap And Status Truth Correction

**Files:**
- Modify: `docs/roadmap/managed-render-system.md`
- Modify: `docs/STATUS.md`

- [ ] **Step 1: Verify the old Phase 5 dependency wording exists**

Run:

```bash
rg -n "Phase 5: Target Routing|Depends on Phase 2 and Phase 3|\\*\\*Depends on:\\*\\* Phase 2, Phase 3|stage objects" docs/roadmap/managed-render-system.md docs/STATUS.md
```

Expected before this task:

```text
docs/roadmap/managed-render-system.md:750:| Phase 5: Target Routing, Scroll Timelines, and Effect Scope | `[not-started]` | none | Depends on Phase 2 and Phase 3; required before later scoped controls. |
docs/roadmap/managed-render-system.md:1073:- **Depends on:** Phase 2, Phase 3
```

- [ ] **Step 2: Update the Roadmap Status table**

In `docs/roadmap/managed-render-system.md`, replace the Phase 5 row with:

```markdown
| Phase 5: Target Routing, Scroll Timelines, and Effect Scope | `[not-started]` | none | Depends on Phase 2, Phase 3, and Phase 4; required before later scoped controls can route targets, stage objects, cameras, and timelines. |
```

- [ ] **Step 3: Update the Phase 5 section dependency**

In `docs/roadmap/managed-render-system.md`, replace:

```markdown
- **Depends on:** Phase 2, Phase 3
```

with:

```markdown
- **Depends on:** Phase 2, Phase 3, Phase 4
```

- [ ] **Step 4: Add Phase 5 focused-plan reminders**

In `docs/roadmap/managed-render-system.md`, add this block after the Phase 5 deliverables list and before `Rules:`:

```markdown
Focused plan reminders:

- Stage primitive and scene-owned light descriptors are stable declarations.
  React prop churn should not become the high-frequency animation path; Phase 5
  should route timeline/effect/controller state through managed runtime state
  instead of repeatedly unregistering and recreating stage meshes or lights.
- Phase 5 should preserve the Phase 4 debug inventory shape for stage
  primitives and lights, and add deeper routing diagnostics only when the
  focused scope needs them.
```

- [ ] **Step 5: Add the active status caveat**

In `docs/STATUS.md`, add this bullet after the stage primitive caveat block:

```markdown
- Managed stage primitives and scene-owned lights are stable descriptors. Use
  them to declare scene substrate; do not drive high-frequency animation through
  React prop churn. Phase 5 owns timeline/effect/controller routing for dynamic
  stage, scene, and camera behavior.
```

- [ ] **Step 6: Verify the roadmap/status edits**

Run:

```bash
rg -n "Depends on Phase 2, Phase 3, and Phase 4|\\*\\*Depends on:\\*\\* Phase 2, Phase 3, Phase 4|stable declarations|React prop churn|debug inventory" docs/roadmap/managed-render-system.md docs/STATUS.md
```

Expected: all new phrases appear once or more, and no Phase 5 dependency line still says only `Phase 2, Phase 3`.

- [ ] **Step 7: Run docs whitespace check**

Run:

```bash
git diff --check docs/roadmap/managed-render-system.md docs/STATUS.md
```

Expected: no output.

## Task 2: Example Dogfood For Managed Stage Primitives

**Files:**
- Create: `apps/example/src/ManagedStagePrimitiveExample.tsx`
- Create: `apps/example/test/ManagedStagePrimitiveExample.test.tsx`
- Modify: `apps/example/src/App.tsx`
- Modify: `apps/example/src/example.css`
- Modify: `apps/example/test/App.test.tsx`

- [ ] **Step 1: Write the failing example component test**

Create `apps/example/test/ManagedStagePrimitiveExample.test.tsx`:

```tsx
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

const sceneProps: SceneMockProps[] = [];
const cameraProps: CameraMockProps[] = [];
const stagePlaneProps: StagePlaneMockProps[] = [];
const stageBoxProps: StageBoxMockProps[] = [];
const lightProps: LightMockProps[] = [];

type SceneMockProps = {
  readonly id: string;
  readonly projection?: string;
  readonly render?: Record<string, unknown>;
  readonly children?: ReactNode;
};

type CameraMockProps = {
  readonly id: string;
  readonly default?: boolean;
  readonly type?: string;
  readonly mode?: string;
  readonly position?: readonly [number, number, number];
  readonly target?: readonly [number, number, number];
};

type StagePlaneMockProps = {
  readonly id: string;
  readonly role?: string;
  readonly size?: readonly [number, number];
  readonly position?: readonly [number, number, number];
  readonly rotation?: readonly [number, number, number];
  readonly material?: Record<string, unknown>;
};

type StageBoxMockProps = {
  readonly id: string;
  readonly size?: readonly [number, number, number];
  readonly position?: readonly [number, number, number];
  readonly material?: Record<string, unknown>;
};

type LightMockProps = {
  readonly id: string;
  readonly kind: string;
  readonly intensity?: number;
  readonly position?: readonly [number, number, number];
  readonly color?: string;
};

vi.mock("@project/dom-webgl-runtime/react", () => ({
  WebGLScene: ({ children, ...props }: SceneMockProps) => {
    sceneProps.push({ ...props, children });
    return createElement("div", { "data-webgl-scene": props.id }, children);
  },
  WebGLCamera: (props: CameraMockProps) => {
    cameraProps.push(props);
    return null;
  },
  WebGLStagePlane: (props: StagePlaneMockProps) => {
    stagePlaneProps.push(props);
    return null;
  },
  WebGLStageBox: (props: StageBoxMockProps) => {
    stageBoxProps.push(props);
    return null;
  },
  WebGLLight: (props: LightMockProps) => {
    lightProps.push(props);
    return null;
  },
}));

describe("ManagedStagePrimitiveExample", () => {
  test("declares a lit managed scene with public stage descriptors", async () => {
    const { ManagedStagePrimitiveExample } = await import(
      "../src/ManagedStagePrimitiveExample"
    );

    const markup = renderToStaticMarkup(createElement(ManagedStagePrimitiveExample));

    expect(markup).toContain("example-stage-dogfood");
    expect(sceneProps).toHaveLength(1);
    expect(sceneProps[0]).toMatchObject({
      id: "example.stage.world",
      projection: "perspective-stage",
      render: { camera: "example.stage.camera", clearDepth: true },
    });
    expect(cameraProps).toEqual([
      expect.objectContaining({
        id: "example.stage.camera",
        default: true,
        type: "perspective",
        mode: "perspective-stage",
        position: [0, 120, 520],
        target: [0, -80, 0],
      }),
    ]);
    expect(stagePlaneProps).toEqual([
      expect.objectContaining({
        id: "example.stage.floor",
        role: "floor",
        size: [900, 520],
        position: [0, -180, 0],
        material: { kind: "standard", color: "#111827", roughness: 0.84 },
      }),
      expect.objectContaining({
        id: "example.stage.backdrop",
        role: "backdrop",
        size: [900, 420],
        position: [0, 20, -260],
        material: { kind: "standard", color: "#172554", roughness: 0.72 },
      }),
    ]);
    expect(stageBoxProps).toEqual([
      expect.objectContaining({
        id: "example.stage.plinth",
        size: [180, 96, 180],
        position: [0, -128, -40],
        material: { kind: "standard", color: "#475569", roughness: 0.58 },
      }),
    ]);
    expect(lightProps).toEqual([
      { id: "example.stage.ambient", kind: "ambient", intensity: 0.28 },
      {
        id: "example.stage.key",
        kind: "point",
        color: "#7dd3fc",
        intensity: 1.8,
        position: [120, 80, 160],
      },
    ]);
  });
});
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
npm test -- --run apps/example/test/ManagedStagePrimitiveExample.test.tsx
```

Expected before implementation: FAIL because `../src/ManagedStagePrimitiveExample` does not exist.

- [ ] **Step 3: Create the public API dogfood component**

Create `apps/example/src/ManagedStagePrimitiveExample.tsx`:

```tsx
import {
  WebGLLight,
  WebGLCamera,
  WebGLScene,
  WebGLStageBox,
  WebGLStagePlane,
} from "@project/dom-webgl-runtime/react";

export function ManagedStagePrimitiveExample() {
  return (
    <section className="example-row example-stage-dogfood">
      <div className="example-stage-copy">
        <p className="example-kicker">managed stage</p>
        <h2>声明式灯光和舞台几何</h2>
        <p>
          这个例子只通过公共 React 描述符声明 floor、backdrop、box 和 scene-owned
          lights；runtime 仍拥有 Three.js mesh、material、light 和 dispose。
        </p>
      </div>

      <div className="example-stage-viewport" aria-hidden="true">
        <WebGLScene
          id="example.stage.world"
          projection="perspective-stage"
          render={{ camera: "example.stage.camera", clearDepth: true }}
        >
          <WebGLCamera
            id="example.stage.camera"
            default
            type="perspective"
            mode="perspective-stage"
            position={[0, 120, 520]}
            target={[0, -80, 0]}
          />
          <WebGLStagePlane
            id="example.stage.floor"
            role="floor"
            size={[900, 520]}
            position={[0, -180, 0]}
            material={{ kind: "standard", color: "#111827", roughness: 0.84 }}
          />
          <WebGLStagePlane
            id="example.stage.backdrop"
            role="backdrop"
            size={[900, 420]}
            position={[0, 20, -260]}
            material={{ kind: "standard", color: "#172554", roughness: 0.72 }}
          />
          <WebGLStageBox
            id="example.stage.plinth"
            size={[180, 96, 180]}
            position={[0, -128, -40]}
            material={{ kind: "standard", color: "#475569", roughness: 0.58 }}
          />
          <WebGLLight id="example.stage.ambient" kind="ambient" intensity={0.28} />
          <WebGLLight
            id="example.stage.key"
            kind="point"
            color="#7dd3fc"
            intensity={1.8}
            position={[120, 80, 160]}
          />
        </WebGLScene>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Wire the component into the app**

In `apps/example/src/App.tsx`, add the import:

```tsx
import { ManagedStagePrimitiveExample } from "./ManagedStagePrimitiveExample";
```

Then render it after `<SnapshotElementExamples />`:

```tsx
          <SnapshotElementExamples />
          <ManagedStagePrimitiveExample />
```

- [ ] **Step 5: Add minimal CSS for the dogfood row**

Append this block to `apps/example/src/example.css`:

```css
.example-stage-dogfood {
  align-items: stretch;
  min-height: 520px;
}

.example-stage-copy {
  display: grid;
  align-content: center;
  gap: 16px;
  max-width: 420px;
}

.example-stage-copy h2 {
  margin: 0;
  max-width: 12ch;
  color: var(--color-text-primary);
  font-size: clamp(2rem, 6vw, 4.25rem);
  line-height: 0.95;
}

.example-stage-copy p {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 1rem;
  line-height: 1.6;
}

.example-stage-viewport {
  min-height: 420px;
  flex: 1 1 420px;
}
```

- [ ] **Step 6: Update `App.test.tsx` runtime mock exports**

In `apps/example/test/App.test.tsx`, add arrays near existing `targetProps`:

```tsx
const sceneProps: SceneMockProps[] = [];
const cameraProps: CameraMockProps[] = [];
const stagePlaneProps: StagePlaneMockProps[] = [];
const stageBoxProps: StageBoxMockProps[] = [];
const lightProps: LightMockProps[] = [];
```

Add these types after `TargetMockProps`:

```tsx
type SceneMockProps = {
  readonly id: string;
  readonly projection?: string;
  readonly render?: Record<string, unknown>;
  readonly children?: ReactNode;
};

type CameraMockProps = {
  readonly id: string;
  readonly default?: boolean;
  readonly type?: string;
  readonly mode?: string;
  readonly position?: readonly [number, number, number];
  readonly target?: readonly [number, number, number];
};

type StagePlaneMockProps = {
  readonly id: string;
  readonly role?: string;
  readonly size?: readonly [number, number];
  readonly position?: readonly [number, number, number];
  readonly material?: Record<string, unknown>;
};

type StageBoxMockProps = {
  readonly id: string;
  readonly size?: readonly [number, number, number];
  readonly position?: readonly [number, number, number];
  readonly material?: Record<string, unknown>;
};

type LightMockProps = {
  readonly id: string;
  readonly kind: string;
  readonly intensity?: number;
  readonly position?: readonly [number, number, number];
  readonly color?: string;
};
```

Extend the `@project/dom-webgl-runtime/react` mock with:

```tsx
  WebGLScene: ({ children, ...props }: SceneMockProps) => {
    sceneProps.push({ ...props, children });
    return createElement("div", { "data-webgl-scene": props.id }, children);
  },
  WebGLCamera: (props: CameraMockProps) => {
    cameraProps.push(props);
    return null;
  },
  WebGLStagePlane: (props: StagePlaneMockProps) => {
    stagePlaneProps.push(props);
    return null;
  },
  WebGLStageBox: (props: StageBoxMockProps) => {
    stageBoxProps.push(props);
    return null;
  },
  WebGLLight: (props: LightMockProps) => {
    lightProps.push(props);
    return null;
  },
```

Clear the arrays in `afterEach()`:

```tsx
    sceneProps.length = 0;
    cameraProps.length = 0;
    stagePlaneProps.length = 0;
    stageBoxProps.length = 0;
    lightProps.length = 0;
```

- [ ] **Step 7: Add app-level assertions**

In the existing app test, after the intro DOM assertions and before `finalTargetProps`, add:

```tsx
    expect(host.querySelector(".example-stage-dogfood")).toBeInstanceOf(HTMLElement);
    expect(sceneProps).toContainEqual(
      expect.objectContaining({
        id: "example.stage.world",
        projection: "perspective-stage",
        render: { camera: "example.stage.camera", clearDepth: true },
      }),
    );
    expect(cameraProps).toContainEqual(
      expect.objectContaining({
        id: "example.stage.camera",
        mode: "perspective-stage",
      }),
    );
    expect(stagePlaneProps.map(({ id }) => id)).toEqual([
      "example.stage.floor",
      "example.stage.backdrop",
    ]);
    expect(stageBoxProps.map(({ id }) => id)).toEqual(["example.stage.plinth"]);
    expect(lightProps.map(({ id }) => id)).toEqual([
      "example.stage.ambient",
      "example.stage.key",
    ]);
```

Do not change `finalTargetProps.slice(-26)` or the expected target key list; managed stage primitives are scene-native and should not add `WebGLTarget` entries.

- [ ] **Step 8: Run focused example tests**

Run:

```bash
npm test -- --run apps/example/test/ManagedStagePrimitiveExample.test.tsx apps/example/test/App.test.tsx apps/example/test/import-boundary.test.ts
```

Expected: PASS. The new component does not use `EffectDescription`, so the
existing effect pill counts and `finalTargetProps.slice(-26)` expectations should
remain unchanged.

## Task 3: Descriptor Stability Documentation

**Files:**
- Modify: `README.md`
- Modify: `docs/agent/package-usage.md`
- Modify: `docs/agent/package-onboarding.md`
- Modify: `packages/dom-webgl-runtime/test/publicExports.test.ts`

- [ ] **Step 1: Add a public type fixture comment for stable descriptor usage**

In `packages/dom-webgl-runtime/test/publicExports.test.ts`, inside the React entrypoint type-check fixture near the stage component declarations, add this accepted stable descriptor example:

```tsx
        const stableStageMaterial = {
          kind: "standard",
          color: "#05070a",
          roughness: 0.8,
        } satisfies WebGLStagePlaneProps["material"];

        const stableStagePlane = (
          <WebGLStagePlane
            id="stable.floor"
            scene="world.stage"
            role="floor"
            material={stableStageMaterial}
          />
        );

        stableStagePlane satisfies unknown;
```

- [ ] **Step 2: Add a rejected raw mutation fixture**

In the same fixture, after raw Three rejection tests, add:

```tsx
        // @ts-expect-error Stage components do not expose an imperative update callback.
        const updateCallbackPlaneProps = {
          id: "raw.update",
          onUpdate() {},
        } satisfies WebGLStagePlaneProps;
```

- [ ] **Step 3: Run the public export test**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/publicExports.test.ts
```

Expected: PASS after the fixture additions. If it fails because the comments are outside the generated fixture string, move the additions inside the existing template literal that type-checks React public exports.

- [ ] **Step 4: Update README stage primitive rules**

In `README.md`, add this paragraph after the managed stage primitive rule paragraph:

```markdown
Treat `WebGLStagePlane`, `WebGLStageBox`, and `WebGLLight` props as stable
scene declarations. They can mount, unmount, or change in ordinary React flows,
but they are not the high-frequency animation path. For animated stage, scene,
or camera behavior, keep descriptor identity stable and route motion through
managed effects/controllers or future Phase 5 timeline scope rather than
recreating meshes and lights every frame.
```

- [ ] **Step 5: Update package usage stage primitive rules**

In `docs/agent/package-usage.md`, add this bullet under the stage primitive `Rules:` list:

```markdown
- Treat stage primitive and light props as stable scene declarations. Ordinary
  React updates are supported through mount/unmount registration, but
  high-frequency animation should use managed runtime state, effects, or future
  Phase 5 timeline/controller scope instead of prop churn.
```

- [ ] **Step 6: Update onboarding stage primitive rules**

In `docs/agent/package-onboarding.md`, add this bullet under the stage integration rules:

```markdown
- Keep stage primitive and light descriptor identity stable. Do not animate
  floor, box, or light values by rebuilding React descriptors every frame; use
  managed runtime/effect/controller state or wait for Phase 5 scope where the
  dynamic behavior belongs.
```

- [ ] **Step 7: Verify docs mention stability**

Run:

```bash
rg -n "stable scene declarations|descriptor identity stable|prop churn|high-frequency animation" README.md docs/agent/package-usage.md docs/agent/package-onboarding.md packages/dom-webgl-runtime/test/publicExports.test.ts
```

Expected: all four files contain the new stability guidance or fixtures.

## Task 4: Debug Inventory For Stage Primitives And Scene Lights

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/types.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/debug/debugState.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/stageObjectRegistry.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`
- Modify: `packages/dom-webgl-runtime/test/lib/debug/debugState.test.ts`
- Modify: `packages/dom-webgl-runtime/test/lib/renderer/stageObjectRegistry.test.ts`
- Modify: `packages/dom-webgl-runtime/test/lib/renderer/runtimePipeline.test.ts`
- Modify: `docs/STATUS.md`

- [ ] **Step 1: Write failing debug state unit test**

In `packages/dom-webgl-runtime/test/lib/debug/debugState.test.ts`, add this test after `includes managed scene ids without exposing scene objects`:

```ts
  test("copies managed stage and light inventory without raw handles", () => {
    const state = createDebugState({
      targetCount: 0,
      renderableCount: 0,
      currentScrollMode: "page",
      pointer: createPointerState(),
      stagePrimitives: [
        { id: "floor", sceneId: "world", kind: "plane" },
        { id: "plinth", sceneId: "world", kind: "box" },
      ],
      lights: [
        { id: "ambient", sceneId: "world", kind: "ambient" },
        { id: "hero", sceneId: "world", kind: "point" },
      ],
      targets: [],
    });

    expect(state.stagePrimitiveCount).toBe(2);
    expect(state.lightCount).toBe(2);
    expect(state.stagePrimitives).toEqual([
      { id: "floor", sceneId: "world", kind: "plane" },
      { id: "plinth", sceneId: "world", kind: "box" },
    ]);
    expect(state.lights).toEqual([
      { id: "ambient", sceneId: "world", kind: "ambient" },
      { id: "hero", sceneId: "world", kind: "point" },
    ]);
    expect(state.stagePrimitives[0]).not.toHaveProperty("object3D");
    expect(state.lights[0]).not.toHaveProperty("light");
  });
```

- [ ] **Step 2: Run the failing debug unit test**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/debug/debugState.test.ts
```

Expected before implementation: FAIL because `stagePrimitives`, `lights`, `stagePrimitiveCount`, and `lightCount` are not part of `DebugRuntimeState` / `WebGLDebugState`.

- [ ] **Step 3: Add public debug summary types**

In `packages/dom-webgl-runtime/src/lib/types.ts`, add these types before `WebGLDebugState`:

```ts
export type WebGLDebugStagePrimitiveSummary = {
  id: string;
  sceneId: string;
  kind: WebGLStagePrimitiveKind;
};

export type WebGLDebugLightSummary = {
  id: string;
  sceneId: string;
  kind: WebGLLightKind;
};
```

Then add these fields to `WebGLDebugState`:

```ts
  stagePrimitiveCount?: number;
  lightCount?: number;
  stagePrimitives?: WebGLDebugStagePrimitiveSummary[];
  lights?: WebGLDebugLightSummary[];
```

- [ ] **Step 4: Extend debug runtime state and copy summaries**

In `packages/dom-webgl-runtime/src/lib/debug/debugState.ts`, add type imports:

```ts
  WebGLDebugLightSummary,
  WebGLDebugStagePrimitiveSummary,
```

Extend `DebugRuntimeState`:

```ts
  stagePrimitives?: readonly WebGLDebugStagePrimitiveSummary[];
  lights?: readonly WebGLDebugLightSummary[];
```

Inside `createDebugState`, after the base `state` object is created and before warnings are assigned, add:

```ts
  if (runtimeState.stagePrimitives && runtimeState.stagePrimitives.length > 0) {
    state.stagePrimitiveCount = runtimeState.stagePrimitives.length;
    state.stagePrimitives = runtimeState.stagePrimitives.map((entry) => ({
      id: entry.id,
      sceneId: entry.sceneId,
      kind: entry.kind,
    }));
  }

  if (runtimeState.lights && runtimeState.lights.length > 0) {
    state.lightCount = runtimeState.lights.length;
    state.lights = runtimeState.lights.map((entry) => ({
      id: entry.id,
      sceneId: entry.sceneId,
      kind: entry.kind,
    }));
  }
```

- [ ] **Step 5: Add registry inspection test**

In `packages/dom-webgl-runtime/test/lib/renderer/stageObjectRegistry.test.ts`, add this test:

```ts
  test("inspects descriptor-only stage and light summaries", () => {
    const registry = createRegistry({
      worldAdapter: createSceneAdapter(),
      primitiveObject: createSceneObject("primitive:floor"),
      lightObject: createSceneObject("light:hero"),
    });

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

    expect(registry.inspect()).toEqual({
      stagePrimitives: [{ id: "floor", sceneId: "world", kind: "plane" }],
      lights: [{ id: "hero", sceneId: "world", kind: "point" }],
    });
  });
```

- [ ] **Step 6: Implement registry inspection**

In `packages/dom-webgl-runtime/src/lib/renderer/stageObjectRegistry.ts`, import the debug summary types:

```ts
  WebGLDebugLightSummary,
  WebGLDebugStagePrimitiveSummary,
```

Add this type:

```ts
export type StageObjectRegistryDebugState = {
  stagePrimitives: WebGLDebugStagePrimitiveSummary[];
  lights: WebGLDebugLightSummary[];
};
```

Extend `StageObjectRegistry`:

```ts
  inspect(): StageObjectRegistryDebugState;
```

Replace the existing `StageRegistryEntry` type with two specific entry types:

```ts
type StagePrimitiveRegistryEntry = {
  sceneId: string;
  kind: WebGLStagePrimitiveDeclaration["kind"];
  controller: WebGLSceneObjectController;
};

type LightRegistryEntry = {
  sceneId: string;
  kind: WebGLLightDeclaration["kind"];
  controller: WebGLSceneObjectController;
};
```

Then update the maps:

```ts
  const primitiveEntries = new Map<string, StagePrimitiveRegistryEntry>();
  const lightEntries = new Map<string, LightRegistryEntry>();
```

When storing primitive entries, include:

```ts
        kind: normalized.kind,
```

When storing light entries, include:

```ts
        kind: normalized.kind,
```

Add this method before `dispose()`:

```ts
    inspect(): StageObjectRegistryDebugState {
      return {
        stagePrimitives: Array.from(primitiveEntries, ([id, entry]) => ({
          id,
          sceneId: entry.sceneId,
          kind: entry.kind,
        })),
        lights: Array.from(lightEntries, ([id, entry]) => ({
          id,
          sceneId: entry.sceneId,
          kind: entry.kind,
        })),
      };
    },
```

Update `unregisterEntry`, `unregisterEntriesForScene`, and `disposeEntries` to
use a generic entry constraint so `Map<string, StagePrimitiveRegistryEntry>` and
`Map<string, LightRegistryEntry>` both type-check without casts:

```ts
type RegistryEntry = {
  sceneId: string;
  controller: WebGLSceneObjectController;
};

function unregisterEntry<TEntry extends RegistryEntry>(
  entries: Map<string, TEntry>,
  id: string,
): void {
  const normalizedId = id.trim();
  const entry = entries.get(normalizedId);

  if (!entry) {
    return;
  }

  entry.controller.dispose();
  entries.delete(normalizedId);
}

function unregisterEntriesForScene<TEntry extends RegistryEntry>(
  entries: Map<string, TEntry>,
  sceneId: string,
): void {
  for (const [id, entry] of [...entries]) {
    if (entry.sceneId !== sceneId) {
      continue;
    }

    entry.controller.dispose();
    entries.delete(id);
  }
}

function disposeEntries<TEntry extends RegistryEntry>(
  entries: Map<string, TEntry>,
): void {
  for (const entry of entries.values()) {
    entry.controller.dispose();
  }

  entries.clear();
}
```

Do not use `as` casts for this inspect path; keep primitive and light entry maps
typed separately.

- [ ] **Step 7: Wire debug inventory into runtime state**

In `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`, inside `createCurrentDebugState()`, read:

```ts
    const stageObjectDebugState = stageObjects.inspect();
```

Pass these fields into both disposed and active `createDebugState(...)` calls:

```ts
        stagePrimitives: stageObjectDebugState.stagePrimitives,
        lights: stageObjectDebugState.lights,
```

For the disposed path this should be called before the returned state. If disposed state should always report no stage objects after `stageObjects.dispose()`, pass empty arrays in that branch:

```ts
        stagePrimitives: [],
        lights: [],
```

- [ ] **Step 8: Add runtime pipeline assertion**

In `packages/dom-webgl-runtime/test/lib/renderer/runtimePipeline.test.ts`, extend the test `registering stage primitives and lights attaches scene-native objects` with:

```ts
    expect(runtime.getDebugState()).toMatchObject({
      stagePrimitiveCount: 1,
      lightCount: 1,
      stagePrimitives: [{ id: "floor", sceneId: "world", kind: "plane" }],
      lights: [{ id: "hero", sceneId: "world", kind: "point" }],
    });
```

After unregistering both entries, add:

```ts
    expect(runtime.getDebugState().stagePrimitiveCount).toBeUndefined();
    expect(runtime.getDebugState().lightCount).toBeUndefined();
    expect(runtime.getDebugState().stagePrimitives).toBeUndefined();
    expect(runtime.getDebugState().lights).toBeUndefined();
```

- [ ] **Step 9: Update status docs for debug inventory**

In `docs/STATUS.md`, under the managed stage primitives bullet list, add:

```markdown
  - debug state can report descriptor-only stage primitive and light inventory
    counts/ids without exposing raw Three.js objects
```

- [ ] **Step 10: Run focused debug/runtime tests**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/debug/debugState.test.ts packages/dom-webgl-runtime/test/lib/renderer/stageObjectRegistry.test.ts packages/dom-webgl-runtime/test/lib/renderer/runtimePipeline.test.ts packages/dom-webgl-runtime/test/publicExports.test.ts
```

Expected: PASS.

## Task 5: Final Verification And Handoff

**Files:**
- Verify all changed files.
- Do not commit unless the user explicitly asks.

- [ ] **Step 1: Run the project verification sequence**

Run:

```bash
npm run test -- --run && npm run typecheck && npm run build && npm run check:imports && git diff --check
```

Expected: PASS. `npm run build` may print the existing Vite chunk-size warning; that warning is non-blocking if the build exits 0.

- [ ] **Step 2: Check changed files**

Run:

```bash
git status --short
```

Expected changed files include only docs, example files, runtime debug/type files, and tests touched by this plan.

- [ ] **Step 3: Review for forbidden scope creep**

Run:

```bash
rg -n "screen-plane|material\\.map|WebGLModel|ctx\\.scene|ctx\\.camera|ctx\\.runtime|THREE\\.|Raycaster|render target" packages/dom-webgl-runtime/src apps/example/src docs/roadmap/managed-render-system.md docs/STATUS.md README.md docs/agent/package-usage.md docs/agent/package-onboarding.md
```

Expected:

- Existing docs may mention these as deferred/future/non-public.
- No new source implementation should expose raw `THREE.*`, `Raycaster`, render targets, `screen-plane`, `WebGLModel`, or scoped effect context APIs.

- [ ] **Step 4: Prepare handoff summary**

Report:

```text
Completed:
- Roadmap/status dependency and scope corrections.
- Managed stage primitive example dogfood through public React imports.
- Stage/light descriptor stability docs and public type fixtures.
- Descriptor-only debug inventory for stage primitives and lights.

Verification:
- npm run test -- --run
- npm run typecheck
- npm run build
- npm run check:imports
- git diff --check

Known caveat:
- Phase 5 itself is still not implemented; this only closes Phase 4 follow-up gaps and prepares the next focused plan.
```

- [ ] **Step 5: Commit only after explicit user approval**

If the user asks for a commit after reviewing verification, run:

```bash
git add README.md docs/STATUS.md docs/agent/package-onboarding.md docs/agent/package-usage.md docs/roadmap/managed-render-system.md apps/example/src/App.tsx apps/example/src/ManagedStagePrimitiveExample.tsx apps/example/src/example.css apps/example/test/App.test.tsx apps/example/test/ManagedStagePrimitiveExample.test.tsx packages/dom-webgl-runtime/src/lib/types.ts packages/dom-webgl-runtime/src/lib/debug/debugState.ts packages/dom-webgl-runtime/src/lib/renderer/stageObjectRegistry.ts packages/dom-webgl-runtime/src/lib/renderer/runtime.ts packages/dom-webgl-runtime/test/lib/debug/debugState.test.ts packages/dom-webgl-runtime/test/lib/renderer/stageObjectRegistry.test.ts packages/dom-webgl-runtime/test/lib/renderer/runtimePipeline.test.ts packages/dom-webgl-runtime/test/publicExports.test.ts
git commit -m "chore: close phase 4 follow-up gaps"
```

Expected: commit succeeds. Do not push unless the user explicitly asks.

## Self-Review

- Spec coverage:
  - Phase 5 dependency metadata is covered by Task 1.
  - Example dogfood is covered by Task 2.
  - React descriptor update/stability semantics are covered by Task 3.
  - Debug inventory is covered by Task 4.
  - Full verification and no-scope-creep review are covered by Task 5.
- Placeholder scan:
  - No placeholder markers or deferred-fill instructions are present.
  - Each implementation task includes exact files, exact code snippets, and exact commands.
- Type consistency:
  - Public debug summary names are `WebGLDebugStagePrimitiveSummary` and `WebGLDebugLightSummary`.
  - Public debug state fields are `stagePrimitiveCount`, `lightCount`, `stagePrimitives`, and `lights`.
  - Runtime registry method is `inspect()`, returning descriptor-only summaries.
