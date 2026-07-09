# Pass Viewport And Postprocess Scope Correction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Phase 6 DOM-bound render-pass viewport/scissor and pass/runtime-scoped postprocess naming while removing the misleading `ctx.object.postprocess` object-local surface, without exposing raw Three.js renderer, scene, camera, render target, composer, or pass objects.

**Architecture:** Keep Level 1 `WebGLTarget` unchanged. Add managed pass viewport anchors and pass postprocess descriptors to the existing render-layer pipeline, then route effect-authored runtime postprocess requests by explicit canvas/pass scope. `WebGLPassViewport` owns DOM rect measurement and can wrap arbitrary React children; render pass declarations consume that anchor directly or through nearest React context. Renderer state changes stay internal and are applied/restored around each managed pass.

**Tech Stack:** TypeScript, React adapter components, Three.js renderer adapter, Vitest/jsdom, npm workspaces.

---

## Context Verified For This Plan

- At creation time, the Roadmap Status first `[not-started]` phase was Phase 6,
  `Pass Viewport And Postprocess Scope Correction`.
- Current roadmap ownership after planning: Phase 6 is `[planned]`; Phase 6A
  `Managed Camera Controllers` is `[not-started]` and owns progress-driven
  camera motion/focus/framing, any future `WebGLCameraDeclaration.timeline`, and
  explicit camera/pass-bound controller APIs.
- This file is the focused plan for Phase 6.
- Current git branch while planning: `codex/managed-render-roadmap-iteration`.
- Current code truth:
  - `WebGLRenderPassDeclaration` has `id`, `sceneId`, `cameraId`, `order`, `clear`, and `clearDepth` only.
  - React `WebGLRenderPassProps` forwards only `id`, `scene`, `camera`, `order`, `clear`, and `clearDepth`.
  - `renderLayerRegistry.renderPasses(...)` returns ordered pass/scene/camera entries, with no viewport or postprocess scope.
  - `runtime.renderScene()` clears once, loops passes, and calls a single `postprocessController.render(() => scene.sceneAdapter.render(camera.camera))`.
  - `createPostprocessController(...)` stores named requests globally and sizes the internal low-res target from full runtime viewport size.
  - `ctx.object.postprocess` is public and currently canvas-scoped even though the name reads object-local; there is no known app/example usage that needs preservation.
  - `WebGLDebugState` does not expose postprocess request/pass summaries, only budget warnings derived from internal stats.
- Phase 6A camera work depends on stable Phase 5 timeline ownership and stable
  Phase 6 pass scope, but Phase 6 must not add camera behavior.
- No status/code/docs/git inconsistency was found before this plan was created.

## Scope

Implement the smallest useful Phase 6 slice:

- A managed DOM viewport anchor that can provide a measured DOM rect to the runtime.
- A render pass `viewport` descriptor with `canvas` default and `dom-rect` mode; React pass declarations may omit `anchorId` when nested inside a `WebGLPassViewport`.
- Renderer-owned viewport/scissor application and restoration per pass.
- A pass descriptor `postprocess` field for pass-scoped bloom/grain/blur.
- A new runtime-scoped effect facade, `ctx.runtime.postprocess`, whose requests explicitly target `{ canvas: true }` or `{ passId: string }`.
- Removal of `ctx.object.postprocess` from the public object facade and public type tests, because keeping it would preserve the misleading object-local name.
- Debug state summaries that report descriptor-only pass viewport and postprocess request scope without exposing raw render targets, composer passes, renderer state, or Three.js objects.
- Docs and example updates that stop presenting `ctx.object.postprocess` as the forward API for whole-pass/canvas effects.
- A clear Phase 6A handoff: Phase 6 preserves stable pass ids, scene ids, camera
  ids, viewport summaries, and pass-scoped postprocess state as descriptor data
  that a later managed camera controller can target without raw camera access.

## Non-Goals

- Do not expose raw `WebGLRenderer`, `THREE.Scene`, `THREE.Camera`, `Object3D`, `Mesh`, `Material`, `Texture`, `WebGLRenderTarget`, composer, raycaster, or renderer state mutation.
- Do not add arbitrary render graphs, custom framebuffers, custom composer plugin chains, or user-owned render loops.
- Do not solve target-local postprocess. Model-local glow remains material/emissive plus runtime-owned lights.
- Do not implement `screen-plane`, picking, colliders, camera controls, physics,
  or `WebGLModel`; progress-driven camera controllers are Phase 6A work, and
  pointer-driven camera interaction is Phase 8 work.
- Do not make `WebGLTarget` users author scenes, cameras, passes, viewport anchors, or postprocess descriptors for Level 1 usage.
- Do not add stage material texture descriptors in this phase.

## API And Architecture Principles

- DOM-first: `WebGLTarget` remains the default and shortest path. Phase 6 is opt-in and only needed when a managed pass must render into a DOM-owned rectangle or when pass/canvas postprocess scope matters.
- React mental model: React components own DOM refs and compile to stable runtime registrations. Component nesting communicates ownership where it is natural.
- Agent-first names:
  - `WebGLPassViewport` registers a DOM rect anchor for pass viewport/scissor.
  - `viewport: { mode: "dom-rect", anchorId: "..." }` says exactly which DOM anchor owns the pass rectangle.
  - In React, `viewport: { mode: "dom-rect" }` inside a `WebGLPassViewport`
    uses the nearest viewport anchor from context.
  - `ctx.runtime.postprocess` says the request is runtime/pass scoped.
  - `ctx.object.postprocess` is removed instead of retained.
- Three-like where useful: keep `camera`, `scene`, `renderPass`, `viewport`, `scissor`, `bloom`, `grain`, and `blur` vocabulary close to Three.js, but public values are managed descriptors.
- Renderer state is internal: runtime applies viewport/scissor and restores canvas-wide state around each pass.
- Explicit data flow: pass declarations hold viewport/postprocess descriptors; runtime render loop resolves them to measured rectangles and controller calls.
- Camera behavior stays out of Phase 6: pass entries may carry `cameraId` as
  identity, but no Phase 6 task should mutate camera position/focus/framing or
  add `timeline` to `WebGLCameraDeclaration`.

## Phase 6A Handoff Contract

Phase 6 should leave the next camera-focused phase with stable scope facts, not
camera behavior:

- Stable pass identity: every explicit/generated pass keeps a descriptor id that
  can later be targeted by a camera/pass-bound controller.
- Stable camera identity: pass summaries and internal render entries continue to
  refer to cameras by `cameraId`; no public raw camera handle is introduced.
- Stable viewport ownership: DOM-bound viewport/scissor belongs to the pass, so
  later camera framing can know which pass rectangle it is framing without
  reading DOM or renderer state directly.
- Stable timeline input: Phase 6 must keep using Phase 5 named progress signals
  as data, not raw GSAP timelines or imperative animation callbacks.
- Explicit non-behavior: Phase 6 does not implement camera dolly, look-at,
  focus target, framing box, scroll dolly, orbit, pan, drag, pointer parallax,
  or `WebGLCameraDeclaration.timeline`.

This means Phase 6A can later choose between a separate camera-controller
descriptor and a camera declaration extension with concrete behavior, instead of
having to undo Phase 6 side effects.

## File Structure

Modify:

- `packages/dom-webgl-runtime/src/lib/types.ts`
  - Add pass viewport, postprocess declaration, postprocess scope, debug postprocess summary, and viewport anchor declaration types.
  - Extend `WebGLRenderPassDeclaration`, `WebGLRuntime`, and `WebGLDebugState`.
- `packages/dom-webgl-runtime/src/lib/effects/effectAuthoring.ts`
  - Add `WebGLPostprocessScopeDeclaration`, scoped request type, and runtime scope postprocess facade.
- `packages/dom-webgl-runtime/src/lib/effects/effectContext.ts`
  - Attach `ctx.runtime.postprocess` while preserving progress metadata.
- `packages/dom-webgl-runtime/src/lib/effects/effectScopes.ts`
  - Create runtime scope snapshots with scoped postprocess facade.
- `packages/dom-webgl-runtime/src/lib/effects/effectObject.ts`
  - Remove `postprocess` from the public `ctx.object` facade.
- `packages/dom-webgl-runtime/src/lib/renderer/renderLayerDeclarations.ts`
  - Normalize pass viewport and pass postprocess declarations.
- `packages/dom-webgl-runtime/src/lib/renderer/renderLayerRegistry.ts`
  - Store normalized viewport/postprocess data on pass entries.
- `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`
  - Own viewport anchor registry, expose registration methods, resolve pass viewports, apply renderer viewport/scissor, and call postprocess per pass scope.
- `packages/dom-webgl-runtime/src/lib/renderer/threeRenderer.ts`
  - Extend renderer adapter shape with optional viewport/scissor methods and add an internal helper for CSS-pixel-to-device-pixel pass viewport state.
- `packages/dom-webgl-runtime/src/lib/renderer/postprocessController.ts`
  - Support scoped requests and descriptor postprocess for pass/canvas render paths.
- `packages/dom-webgl-runtime/src/lib/debug/debugState.ts`
  - Add descriptor-only postprocess summary and pass viewport summary to debug state.
- `packages/dom-webgl-runtime/src/lib/react/WebGLRenderPass.tsx`
  - Forward `viewport` and `postprocess`, filling a missing DOM viewport `anchorId` from nearest `WebGLPassViewport` context when available.
- `packages/dom-webgl-runtime/src/lib/react/WebGLScene.tsx`
  - Allow scene-owned `render` to include `viewport` and `postprocess`, using nearest `WebGLPassViewport` context for `dom-rect` viewport defaults.
- `packages/dom-webgl-runtime/src/react.ts`
  - Export `WebGLPassViewport`.
- `packages/dom-webgl-runtime/src/index.ts`
  - Export new public types.
- `packages/dom-webgl-runtime/test/publicExports.test.ts`
  - Type boundary and raw internals rejection tests.
- `packages/dom-webgl-runtime/test/lib/react/WebGLRenderPass.test.tsx`
  - React forwarding tests.
- `packages/dom-webgl-runtime/test/lib/react/WebGLScene.test.tsx`
  - Scene `render` forwarding tests.
- `packages/dom-webgl-runtime/test/lib/renderer/renderLayerRegistry.test.ts`
  - Pass normalization/storage/order tests.
- `packages/dom-webgl-runtime/test/lib/renderer/runtimePipeline.test.ts`
  - Runtime viewport/scissor and pass-scoped postprocess behavior tests.
- `packages/dom-webgl-runtime/test/lib/renderer/postprocessController.test.ts`
  - Scoped postprocess request/descriptor tests.
- `packages/dom-webgl-runtime/test/lib/debug/debugState.test.ts`
  - Debug summaries and no raw internals tests.
- `apps/example/src/ManagedStagePrimitiveExample.tsx`
  - Dogfood DOM-bound pass viewport for the managed stage card/section.
- `apps/example/src/App.tsx` and related CSS only if needed by the dogfood.
- `docs/STATUS.md`, `README.md`, `docs/agent/package-onboarding.md`, `docs/agent/package-usage.md`, `docs/examples/effect-authoring.md`, and `docs/roadmap/managed-render-system.md`
  - Document Phase 6 truth and postprocess migration.

Create:

- `packages/dom-webgl-runtime/src/lib/react/passViewportContext.ts`
  - Internal React context that carries the nearest `WebGLPassViewport` id to `WebGLScene` and `WebGLRenderPass`.
- `packages/dom-webgl-runtime/src/lib/react/WebGLPassViewport.tsx`
  - React DOM owner component that registers an anchor id and element with the runtime and can wrap arbitrary React children.
- `packages/dom-webgl-runtime/src/lib/renderer/passViewportRegistry.ts`
  - Small registry for DOM viewport anchors and measured CSS-pixel rectangles.
- `packages/dom-webgl-runtime/test/lib/react/WebGLPassViewport.test.tsx`
  - React anchor registration lifecycle tests.
- `packages/dom-webgl-runtime/test/lib/renderer/passViewportRegistry.test.ts`
  - Pure registry tests.

## Public API Direction

Use this shape unless implementation reveals a concrete issue:

```ts
export type WebGLPassViewportDeclaration =
  | {
      mode?: "canvas";
    }
  | {
      mode: "dom-rect";
      anchorId?: string;
      scissor?: boolean;
    };

export type WebGLPostprocessDeclaration = {
  bloom?: { strength?: number; radius?: number; threshold?: number };
  grain?: { amount?: number };
  blur?: { radius?: number };
};

export type WebGLPostprocessScopeDeclaration =
  | { canvas: true; passId?: never }
  | { passId: string; canvas?: never };

export type WebGLRenderPassDeclaration = {
  id?: string;
  sceneId: string;
  cameraId?: string;
  order?: number;
  clear?: boolean;
  clearDepth?: boolean;
  viewport?: WebGLPassViewportDeclaration;
  postprocess?: WebGLPostprocessDeclaration;
};
```

React:

```tsx
<WebGLPassViewport id="hero.stage.viewport" as="section" className="hero-stage">
  <HeroCopy />

  <WebGLScene
    id="hero.stage"
    projection="perspective-stage"
    render={{
      camera: "hero.camera",
      viewport: {
        mode: "dom-rect",
        scissor: true,
      },
      postprocess: {
        grain: { amount: 0.04 },
      },
    }}
  >
    <WebGLCamera id="hero.camera" default type="perspective" />
    <WebGLStagePlane id="hero.floor" role="floor" />
  </WebGLScene>
</WebGLPassViewport>
```

Effect authoring:

```ts
defineWebGLEffect({
  kind: "app.cinematicPass",
  setup(ctx) {
    return ctx.runtime.postprocess.request({
      key: "app.cinematicPass",
      scope: { passId: "hero.stage:hero.camera:pass" },
      bloom: { strength: 0.35 },
      grain: { amount: 0.04 },
    });
  },
  update(_ctx, handle) {
    handle.update({
      key: "app.cinematicPass",
      scope: { passId: "hero.stage:hero.camera:pass" },
      grain: { amount: 0.03 },
    });
  },
});
```

Breaking cleanup:

```ts
// @ts-expect-error postprocess moved to ctx.runtime.postprocess in Phase 6.
ctx.object.postprocess.request({
  key: "old.canvasSoftness",
  blur: { radius: 0.2 },
});
```

New code must use `ctx.runtime.postprocess.request(...)` with explicit
`scope: { canvas: true }` or `scope: { passId: "..." }`.

## Confirmed Design Decisions

These Phase 6 API decisions are confirmed for implementation:

1. `WebGLPassViewport` as the React DOM-owner component.
   - Keep a dedicated component that owns the DOM ref and registers
     `{ id, element }` with the runtime.
   - It may wrap arbitrary React children, including ordinary DOM content,
     controls, one or more scenes, render passes, or no scene at all.
   - It avoids DOM selectors, imperative refs in examples, and the false
     implication that `WebGLScene` nesting creates a local viewport by itself.

2. Pass viewport descriptor shape.
   - Use:

     ```ts
     viewport: {
       mode: "dom-rect";
       anchorId?: "hero.stage.viewport";
       scissor?: boolean;
     }
     ```

   - Default remains canvas when `viewport` is absent.
   - In React, `anchorId` may be omitted when `WebGLScene render` or
     `WebGLRenderPass` is nested under `WebGLPassViewport`; the nearest viewport
     context supplies the id before registering the runtime descriptor.
   - In vanilla/runtime descriptor usage, `dom-rect` still needs a concrete
     anchor id by registration time.

3. Postprocess scope naming.
   - Use `passId`, not `pass`, for effect-authored requests:

     ```ts
     scope: { passId: "hero.pass" }
     ```

     and

     ```ts
     scope: { canvas: true }
     ```

   - `passId` targets the concrete managed render pass id, not a scene id,
     camera id, or ambiguous pass label.

4. `ctx.runtime.postprocess` as the forward effect API.
   - Add `ctx.runtime.postprocess.request(...)` for explicit canvas/pass scope.
   - Remove `ctx.object.postprocess` from the public object facade instead of
     preserving the old surface.
   - Update public type tests so `ctx.object.postprocess` is rejected.

5. Descriptor-level postprocess surface.
   - Support only the existing `bloom`, `grain`, and `blur` descriptor data on
     `WebGLRenderPass` / `WebGLScene render`.
   - Do not add arbitrary composer chains, custom pass plugins, custom
     framebuffers, render-target descriptors, or target-local postprocess.

6. Phase 6A boundary.
   - Phase 6 does not add camera motion, focus, framing,
     `WebGLCameraDeclaration.timeline`, `ctx.camera`, orbit, pan, pointer
     parallax, or camera controller descriptors.
   - Phase 6 only leaves stable descriptor facts for Phase 6A: pass ids, scene
     ids, camera ids, pass viewport summaries, and scoped postprocess summaries.

7. Debug-state exposure.
   - Expose descriptor-only summaries such as pass id, scene id, optional
     camera id, viewport mode/anchor id, and postprocess request scope.
   - Do not expose renderer state, raw cameras, render targets, composer passes,
     internal scene objects, or viewport/scissor mutator handles.

---

### Task 1: Public Types And React Pass Declarations

**Files:**

- Modify: `packages/dom-webgl-runtime/src/lib/types.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/effects/effectAuthoring.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/react/WebGLRenderPass.tsx`
- Modify: `packages/dom-webgl-runtime/src/lib/react/WebGLScene.tsx`
- Modify: `packages/dom-webgl-runtime/src/index.ts`
- Modify: `packages/dom-webgl-runtime/src/react.ts`
- Test: `packages/dom-webgl-runtime/test/publicExports.test.ts`
- Test: `packages/dom-webgl-runtime/test/lib/react/WebGLRenderPass.test.tsx`
- Test: `packages/dom-webgl-runtime/test/lib/react/WebGLScene.test.tsx`

- [x] **Step 1: Write failing public type tests**

Add this to the public types acceptance section in `packages/dom-webgl-runtime/test/publicExports.test.ts`:

```ts
const passViewport = {
  mode: "dom-rect",
  anchorId: "hero.stage.viewport",
  scissor: true,
} satisfies WebGLPassViewportDeclaration;

const passPostprocess = {
  bloom: { strength: 0.35, radius: 0.18, threshold: 0.82 },
  grain: { amount: 0.04 },
  blur: { radius: 0.12 },
} satisfies WebGLPostprocessDeclaration;

const passScopedPostprocess = {
  key: "hero.pass.fx",
  scope: { passId: "hero.pass" },
  grain: { amount: 0.04 },
} satisfies WebGLRuntimePostprocessRequest;

const canvasScopedPostprocess = {
  key: "runtime.fx",
  scope: { canvas: true },
  blur: { radius: 0.1 },
} satisfies WebGLRuntimePostprocessRequest;

const scopedPass = {
  id: "hero.pass",
  sceneId: "hero.scene",
  cameraId: "hero.camera",
  viewport: passViewport,
  postprocess: passPostprocess,
} satisfies WebGLRenderPassDeclaration;

passViewport satisfies WebGLPassViewportDeclaration;
passPostprocess satisfies WebGLPostprocessDeclaration;
passScopedPostprocess satisfies WebGLRuntimePostprocessRequest;
canvasScopedPostprocess satisfies WebGLRuntimePostprocessRequest;
scopedPass satisfies WebGLRenderPassDeclaration;
```

Add raw internals rejection tests in the same generated type program:

```ts
// @ts-expect-error pass viewport accepts managed descriptors, not renderer state.
({ mode: "dom-rect", renderer: {} } satisfies WebGLPassViewportDeclaration);

// @ts-expect-error pass-scoped postprocess accepts descriptor data, not composer passes.
({ composer: {} } satisfies WebGLPostprocessDeclaration);

// @ts-expect-error postprocess scope names a managed pass, not a render target.
({ key: "bad", scope: { renderTarget: {} } } satisfies WebGLRuntimePostprocessRequest);

// @ts-expect-error runtime postprocess requests must declare canvas/pass scope.
({ key: "missing.scope", grain: { amount: 0.04 } } satisfies WebGLRuntimePostprocessRequest);
```

Add an effect-context type assertion that `ctx.object.postprocess` is gone:

```ts
defineWebGLEffect({
  kind: "type.postprocessScope",
  update(ctx) {
    ctx.runtime.postprocess.request({
      key: "type.runtime.postprocess",
      scope: { canvas: true },
      grain: { amount: 0.04 },
    });

    // @ts-expect-error postprocess moved from ctx.object to ctx.runtime in Phase 6.
    ctx.object.postprocess.request({
      key: "type.object.postprocess",
      grain: { amount: 0.04 },
    });
  },
});
```

- [x] **Step 2: Run the failing type boundary test**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/publicExports.test.ts
```

Expected: FAIL with missing exports such as `WebGLPassViewportDeclaration`, `WebGLPostprocessDeclaration`, or `WebGLRuntimePostprocessRequest`.

- [x] **Step 3: Add public types**

In `packages/dom-webgl-runtime/src/lib/types.ts`, add:

```ts
export type WebGLPassViewportDeclaration =
  | {
      mode?: "canvas";
    }
  | {
      mode: "dom-rect";
      anchorId?: string;
      scissor?: boolean;
    };

export type WebGLPostprocessDeclaration = {
  bloom?: { strength?: number; radius?: number; threshold?: number };
  grain?: { amount?: number };
  blur?: { radius?: number };
};

export type WebGLPostprocessScopeDeclaration =
  | { canvas: true; passId?: never }
  | { passId: string; canvas?: never };
```

Extend `WebGLRenderPassDeclaration`:

```ts
export type WebGLRenderPassDeclaration = {
  id?: string;
  sceneId: string;
  cameraId?: string;
  order?: number;
  clear?: boolean;
  clearDepth?: boolean;
  viewport?: WebGLPassViewportDeclaration;
  postprocess?: WebGLPostprocessDeclaration;
};
```

In `packages/dom-webgl-runtime/src/lib/effects/effectAuthoring.ts`, add runtime-scoped request types near the existing postprocess request:

```ts
export type WebGLRuntimePostprocessRequest = WebGLEffectPostprocessRequest & {
  scope: WebGLPostprocessScopeDeclaration;
};

export type WebGLEffectRuntimePostprocessFacade = {
  request(request: WebGLRuntimePostprocessRequest): WebGLEffectPostprocessHandle;
};

export type WebGLEffectRuntimeScope = {
  readonly progress: WebGLProgressSignalSource;
  readonly postprocess: WebGLEffectRuntimePostprocessFacade;
};
```

Import `WebGLPostprocessScopeDeclaration` as a type from `../types`.

- [x] **Step 4: Forward React render pass props with viewport context defaults**

Extend `WebGLRenderPassProps` in `packages/dom-webgl-runtime/src/lib/react/WebGLRenderPass.tsx`:

```ts
export type WebGLRenderPassProps = {
  id?: string;
  scene?: string;
  camera?: string;
  order?: number;
  clear?: boolean;
  clearDepth?: boolean;
  viewport?: WebGLRenderPassDeclaration["viewport"];
  postprocess?: WebGLRenderPassDeclaration["postprocess"];
};
```

Read the nearest pass viewport id:

```ts
const inheritedPassViewportId = useContext(WebGLPassViewportContext);
```

Add a helper in the component file:

```ts
function resolveReactPassViewport(
  viewport: WebGLRenderPassDeclaration["viewport"],
  inheritedAnchorId: string | undefined,
): WebGLRenderPassDeclaration["viewport"] {
  if (!viewport || viewport.mode !== "dom-rect" || viewport.anchorId) {
    return viewport;
  }

  return inheritedAnchorId
    ? { ...viewport, anchorId: inheritedAnchorId }
    : viewport;
}
```

Include normalized `viewport` and `postprocess` in the declaration object and effect dependency array:

```ts
const normalizedViewport = resolveReactPassViewport(
  viewport,
  inheritedPassViewportId,
);

const declaration: WebGLRenderPassDeclaration = {
  id,
  sceneId,
  cameraId: camera,
  order,
  clear,
  clearDepth,
  viewport: normalizedViewport,
  postprocess,
};
```

- [x] **Step 5: Forward scene-owned render props with viewport context defaults**

In `packages/dom-webgl-runtime/src/lib/react/WebGLScene.tsx`, extend the scene render prop type so `render={{ camera, order, clear, clearDepth, viewport, postprocess }}` compiles into the generated pass declaration. Use the same `viewport` and `postprocess` types as `WebGLRenderPassDeclaration`.

Read `WebGLPassViewportContext` inside `WebGLScene` and apply the same `resolveReactPassViewport(...)` behavior before calling `runtime.registerRenderPass(...)`.

- [x] **Step 6: Add React forwarding tests**

In `packages/dom-webgl-runtime/test/lib/react/WebGLRenderPass.test.tsx`, add:

```tsx
test("forwards viewport and postprocess render pass declarations", async () => {
  const { WebGLRenderPass, WebGLRuntimeProvider } = await import("../../../src/react");
  const runtime = createRuntimeStub();
  const { root } = createTestRoot();

  await act(async () => {
    root.render(
      createElement(
        WebGLRuntimeProvider,
        { runtime },
        createElement(WebGLRenderPass, {
          id: "hero.pass",
          scene: "hero.scene",
          camera: "hero.camera",
          viewport: {
            mode: "dom-rect",
            anchorId: "hero.viewport",
            scissor: true,
          },
          postprocess: {
            grain: { amount: 0.04 },
          },
        }),
      ),
    );
  });

  expect(runtime.registerRenderPass).toHaveBeenCalledWith({
    id: "hero.pass",
    sceneId: "hero.scene",
    cameraId: "hero.camera",
    order: undefined,
    clear: undefined,
    clearDepth: undefined,
    viewport: {
      mode: "dom-rect",
      anchorId: "hero.viewport",
      scissor: true,
    },
    postprocess: {
      grain: { amount: 0.04 },
    },
  });
});
```

Add a matching `WebGLScene` test proving scene-owned `render` forwards the same fields.

- [x] **Step 7: Export public types**

In `packages/dom-webgl-runtime/src/index.ts`, export:

```ts
type WebGLPassViewportDeclaration,
type WebGLPostprocessDeclaration,
type WebGLPostprocessScopeDeclaration,
type WebGLRuntimePostprocessRequest,
type WebGLEffectRuntimePostprocessFacade,
```

Do not export renderer adapter internals.

- [x] **Step 8: Run targeted tests**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/publicExports.test.ts packages/dom-webgl-runtime/test/lib/react/WebGLRenderPass.test.tsx packages/dom-webgl-runtime/test/lib/react/WebGLScene.test.tsx
```

Expected: PASS.

### Task 2: DOM Pass Viewport Anchor Registration

**Files:**

- Create: `packages/dom-webgl-runtime/src/lib/renderer/passViewportRegistry.ts`
- Create: `packages/dom-webgl-runtime/src/lib/react/passViewportContext.ts`
- Create: `packages/dom-webgl-runtime/src/lib/react/WebGLPassViewport.tsx`
- Modify: `packages/dom-webgl-runtime/src/lib/types.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`
- Modify: `packages/dom-webgl-runtime/src/react.ts`
- Test: `packages/dom-webgl-runtime/test/lib/renderer/passViewportRegistry.test.ts`
- Test: `packages/dom-webgl-runtime/test/lib/react/WebGLPassViewport.test.tsx`

- [x] **Step 1: Write failing registry tests**

Create `packages/dom-webgl-runtime/test/lib/renderer/passViewportRegistry.test.ts`:

```ts
import { describe, expect, test } from "vitest";

import { createPassViewportRegistry } from "../../../src/lib/renderer/passViewportRegistry";

describe("pass viewport registry", () => {
  test("measures registered DOM anchors as CSS-pixel rectangles", () => {
    const registry = createPassViewportRegistry();
    const element = {
      getBoundingClientRect() {
        return {
          left: 24,
          top: 48,
          width: 320,
          height: 180,
          right: 344,
          bottom: 228,
        };
      },
    } as HTMLElement;

    registry.register({ id: "hero.viewport", element });

    expect(registry.resolve({ mode: "dom-rect", anchorId: "hero.viewport" })).toEqual({
      mode: "dom-rect",
      anchorId: "hero.viewport",
      scissor: true,
      rect: { x: 24, y: 48, width: 320, height: 180 },
    });
  });

  test("returns canvas mode for missing or canvas viewport declarations", () => {
    const registry = createPassViewportRegistry();

    expect(registry.resolve(undefined)).toEqual({ mode: "canvas" });
    expect(registry.resolve({ mode: "canvas" })).toEqual({ mode: "canvas" });
  });

  test("throws a controlled error for unknown DOM anchors", () => {
    const registry = createPassViewportRegistry();

    expect(() =>
      registry.resolve({ mode: "dom-rect", anchorId: "missing" }),
    ).toThrow('Unknown WebGL pass viewport anchor "missing".');
  });

  test("throws a controlled error when dom-rect reaches runtime without an anchor id", () => {
    const registry = createPassViewportRegistry();

    expect(() =>
      registry.resolve({ mode: "dom-rect" }),
    ).toThrow(
      "WebGL pass viewport dom-rect mode requires an anchorId after React context normalization.",
    );
  });
});
```

- [x] **Step 2: Run failing registry tests**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/renderer/passViewportRegistry.test.ts
```

Expected: FAIL because `passViewportRegistry.ts` does not exist.

- [x] **Step 3: Implement the registry**

Create `packages/dom-webgl-runtime/src/lib/renderer/passViewportRegistry.ts`:

```ts
import type { WebGLPassViewportDeclaration } from "../types";

export type PassViewportAnchorDeclaration = {
  id: string;
  element: HTMLElement;
};

export type ResolvedPassViewport =
  | { mode: "canvas" }
  | {
      mode: "dom-rect";
      anchorId: string;
      scissor: boolean;
      rect: { x: number; y: number; width: number; height: number };
    };

export type PassViewportRegistry = {
  register(declaration: PassViewportAnchorDeclaration): void;
  unregister(id: string): void;
  resolve(declaration: WebGLPassViewportDeclaration | undefined): ResolvedPassViewport;
  dispose(): void;
};

export function createPassViewportRegistry(): PassViewportRegistry {
  const anchorsById = new Map<string, HTMLElement>();
  let disposed = false;

  return {
    register({ id, element }) {
      if (disposed) {
        throw new Error("Cannot register a WebGL pass viewport after runtime disposal.");
      }
      const normalizedId = normalizeViewportAnchorId(id);
      if (anchorsById.has(normalizedId)) {
        throw new Error(`WebGL pass viewport anchor id "${normalizedId}" is already registered.`);
      }
      anchorsById.set(normalizedId, element);
    },
    unregister(id) {
      anchorsById.delete(id.trim());
    },
    resolve(declaration) {
      if (!declaration || declaration.mode === undefined || declaration.mode === "canvas") {
        return { mode: "canvas" };
      }

      if (!declaration.anchorId) {
        throw new Error(
          "WebGL pass viewport dom-rect mode requires an anchorId after React context normalization.",
        );
      }

      const anchorId = normalizeViewportAnchorId(declaration.anchorId);
      const element = anchorsById.get(anchorId);
      if (!element) {
        throw new Error(`Unknown WebGL pass viewport anchor "${anchorId}".`);
      }

      const rect = element.getBoundingClientRect();
      return {
        mode: "dom-rect",
        anchorId,
        scissor: declaration.scissor ?? true,
        rect: {
          x: normalizeViewportNumber(rect.left),
          y: normalizeViewportNumber(rect.top),
          width: normalizeViewportNumber(rect.width),
          height: normalizeViewportNumber(rect.height),
        },
      };
    },
    dispose() {
      if (disposed) {
        return;
      }
      disposed = true;
      anchorsById.clear();
    },
  };
}

function normalizeViewportAnchorId(id: string): string {
  const normalized = id.trim();
  if (!normalized) {
    throw new Error("WebGL pass viewport anchor id must be a non-empty string.");
  }
  return normalized;
}

function normalizeViewportNumber(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}
```

- [x] **Step 4: Add runtime registration API**

Extend `WebGLRuntime` in `packages/dom-webgl-runtime/src/lib/types.ts`:

```ts
registerPassViewport(declaration: {
  id: string;
  element: HTMLElement;
}): void;
unregisterPassViewport(id: string): void;
```

In `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`, create a registry:

```ts
const passViewports = createPassViewportRegistry();
```

Add runtime methods:

```ts
registerPassViewport(declaration) {
  if (disposed) {
    throw new Error("Cannot register a WebGL pass viewport after runtime disposal.");
  }
  passViewports.register(declaration);
  rendererLoopRequestFrame("target-register");
  emitDebugState(true);
},
unregisterPassViewport(id) {
  passViewports.unregister(id);
  rendererLoopRequestFrame("target-unregister");
  emitDebugState(true);
},
```

Dispose it with the rest of runtime-owned state:

```ts
passViewports.dispose();
```

- [x] **Step 5: Add React `WebGLPassViewport`**

Create `packages/dom-webgl-runtime/src/lib/react/passViewportContext.ts`:

```tsx
import { createContext } from "react";

export const WebGLPassViewportContext = createContext<string | undefined>(
  undefined,
);
```

Create `packages/dom-webgl-runtime/src/lib/react/WebGLPassViewport.tsx`:

```tsx
import {
  createElement,
  type ReactNode,
  useEffect,
  useRef,
  type ComponentPropsWithoutRef,
  type ElementType,
} from "react";

import { useWebGLRuntime } from "./useWebGLRuntime";
import { WebGLPassViewportContext } from "./passViewportContext";

type WebGLPassViewportProps<TElement extends ElementType = "div"> = {
  id: string;
  as?: TElement;
  children?: ReactNode;
} & Omit<ComponentPropsWithoutRef<TElement>, "as" | "id">;

export function WebGLPassViewport<TElement extends ElementType = "div">({
  id,
  as,
  children,
  ...props
}: WebGLPassViewportProps<TElement>) {
  const runtime = useWebGLRuntime();
  const elementRef = useRef<HTMLElement | null>(null);
  const Component = as ?? "div";

  useEffect(() => {
    const element = elementRef.current;
    if (!element) {
      return;
    }

    runtime.registerPassViewport({ id, element });
    return () => {
      runtime.unregisterPassViewport(id.trim());
    };
  }, [runtime, id]);

  return createElement(
    WebGLPassViewportContext.Provider,
    { value: id.trim() },
    createElement(
      Component,
      {
        ...props,
        ref: elementRef,
      },
      children,
    ),
  );
}
```

Export it from `packages/dom-webgl-runtime/src/react.ts`.

- [x] **Step 6: Add React lifecycle tests**

Create `packages/dom-webgl-runtime/test/lib/react/WebGLPassViewport.test.tsx` with tests that mount, register the actual element, and unregister on unmount:

```tsx
test("registers and unregisters a pass viewport anchor", async () => {
  const { WebGLPassViewport, WebGLRuntimeProvider } = await import("../../../src/react");
  const runtime = createRuntimeStub();
  const { root } = createTestRoot();

  await act(async () => {
    root.render(
      createElement(
        WebGLRuntimeProvider,
        { runtime },
        createElement(WebGLPassViewport, {
          id: "hero.viewport",
          as: "section",
          className: "hero-stage",
        }),
      ),
    );
  });

  expect(runtime.registerPassViewport).toHaveBeenCalledWith({
    id: "hero.viewport",
    element: expect.any(HTMLElement),
  });

  act(() => {
    root.unmount();
  });

expect(runtime.unregisterPassViewport).toHaveBeenCalledWith("hero.viewport");
});
```

Add a second test proving arbitrary children render under the DOM owner:

```tsx
test("renders arbitrary children inside the DOM viewport owner", async () => {
  const { WebGLPassViewport, WebGLRuntimeProvider } = await import("../../../src/react");
  const runtime = createRuntimeStub();
  const { root, host } = createTestRoot();

  await act(async () => {
    root.render(
      createElement(
        WebGLRuntimeProvider,
        { runtime },
        createElement(
          WebGLPassViewport,
          { id: "hero.viewport", as: "section" },
          createElement("p", null, "普通 DOM 内容"),
        ),
      ),
    );
  });

  expect(host.textContent).toContain("普通 DOM 内容");
});
```

In `packages/dom-webgl-runtime/test/lib/react/WebGLRenderPass.test.tsx`, add a context-default test:

```tsx
test("uses the nearest pass viewport context when dom-rect anchorId is omitted", async () => {
  const { WebGLPassViewport, WebGLRenderPass, WebGLRuntimeProvider } =
    await import("../../../src/react");
  const runtime = createRuntimeStub();
  const { root } = createTestRoot();

  await act(async () => {
    root.render(
      createElement(
        WebGLRuntimeProvider,
        { runtime },
        createElement(
          WebGLPassViewport,
          { id: "hero.viewport" },
          createElement(WebGLRenderPass, {
            id: "hero.pass",
            scene: "hero.scene",
            camera: "hero.camera",
            viewport: { mode: "dom-rect" },
          }),
        ),
      ),
    );
  });

  expect(runtime.registerRenderPass).toHaveBeenCalledWith(
    expect.objectContaining({
      viewport: {
        mode: "dom-rect",
        anchorId: "hero.viewport",
      },
    }),
  );
});
```

- [x] **Step 7: Run targeted tests**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/renderer/passViewportRegistry.test.ts packages/dom-webgl-runtime/test/lib/react/WebGLPassViewport.test.tsx
```

Expected: PASS.

### Task 3: Render-Layer Pass Viewport And Renderer Scissor

**Files:**

- Modify: `packages/dom-webgl-runtime/src/lib/renderer/renderLayerDeclarations.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/renderLayerRegistry.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/threeRenderer.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`
- Test: `packages/dom-webgl-runtime/test/lib/renderer/renderLayerRegistry.test.ts`
- Test: `packages/dom-webgl-runtime/test/lib/renderer/runtimePipeline.test.ts`
- Test: `packages/dom-webgl-runtime/test/lib/renderer/threeRenderer.test.ts`

- [x] **Step 1: Write failing pass normalization tests**

In `packages/dom-webgl-runtime/test/lib/renderer/renderLayerRegistry.test.ts`, add a test that registers a pass with viewport:

```ts
test("stores pass viewport descriptors without exposing renderer state", () => {
  const registry = createRegistry();

  registry.registerScene({ id: "hero.scene" });
  registry.registerCamera({
    id: "hero.camera",
    sceneId: "hero.scene",
    default: true,
  });
  registry.registerRenderPass({
    id: "hero.pass",
    sceneId: "hero.scene",
    cameraId: "hero.camera",
    viewport: {
      mode: "dom-rect",
      anchorId: "hero.viewport",
      scissor: true,
    },
  });

  expect(registry.getPasses()).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        id: "hero.pass",
        viewport: {
          mode: "dom-rect",
          anchorId: "hero.viewport",
          scissor: true,
        },
      }),
    ]),
  );
});
```

- [x] **Step 2: Implement pass normalization**

Add normalized viewport helpers in `renderLayerDeclarations.ts`:

```ts
function normalizePassViewport(
  viewport: WebGLPassViewportDeclaration | undefined,
): WebGLPassViewportDeclaration | undefined {
  if (!viewport || viewport.mode === undefined || viewport.mode === "canvas") {
    return undefined;
  }

  if (!viewport.anchorId) {
    throw new Error(
      "WebGL render pass dom-rect viewport requires an anchorId.",
    );
  }

  const anchorId = normalizePublicId(viewport.anchorId, "pass viewport anchor");
  return {
    mode: "dom-rect",
    anchorId,
    scissor: viewport.scissor ?? true,
  };
}
```

Return it from `normalizeRenderLayerPassDeclaration(...)`:

```ts
return {
  id,
  sceneId,
  ...(cameraId ? { cameraId } : {}),
  order: normalizeOrder(declaration.order),
  clear: declaration.clear ?? false,
  clearDepth: declaration.clearDepth ?? false,
  ...(normalizePassViewport(declaration.viewport)
    ? { viewport: normalizePassViewport(declaration.viewport) }
    : {}),
  ...(declaration.postprocess ? { postprocess: clonePostprocessDeclaration(declaration.postprocess) } : {}),
};
```

Use a local variable to avoid calling `normalizePassViewport(...)` twice.

- [x] **Step 3: Extend internal pass entry type**

In `renderLayerRegistry.ts`, add readonly fields to `InternalRenderPassEntry`:

```ts
readonly viewport?: WebGLPassViewportDeclaration;
readonly postprocess?: WebGLPostprocessDeclaration;
```

The generated default pass should leave both fields absent.

- [x] **Step 4: Add renderer viewport/scissor adapter methods**

In `threeRenderer.ts`, extend `ThreeRendererAdapter`:

```ts
setViewport?(x: number, y: number, width: number, height: number): void;
setScissor?(x: number, y: number, width: number, height: number): void;
setScissorTest?(enabled: boolean): void;
```

Do not export a public renderer state API.

- [x] **Step 5: Add runtime pass viewport apply/restore helper**

In `runtime.ts`, add an internal helper:

```ts
function withResolvedPassViewport(
  pass: InternalRenderPassEntry,
  render: () => void,
): void {
  const viewport = passViewports.resolve(pass.viewport);
  if (viewport.mode === "canvas") {
    render();
    return;
  }

  const runtimeViewport = rendererHost.getViewportSize();
  const dpr = window.devicePixelRatio || 1;
  const x = Math.round(viewport.rect.x * dpr);
  const width = Math.round(viewport.rect.width * dpr);
  const height = Math.round(viewport.rect.height * dpr);
  const y = Math.round((runtimeViewport.height - viewport.rect.y - viewport.rect.height) * dpr);

  rendererHost.renderer.setViewport?.(x, y, width, height);
  rendererHost.renderer.setScissor?.(x, y, width, height);
  rendererHost.renderer.setScissorTest?.(viewport.scissor);

  try {
    render();
  } finally {
    const fullWidth = Math.round(runtimeViewport.width * dpr);
    const fullHeight = Math.round(runtimeViewport.height * dpr);
    rendererHost.renderer.setScissorTest?.(false);
    rendererHost.renderer.setViewport?.(0, 0, fullWidth, fullHeight);
    rendererHost.renderer.setScissor?.(0, 0, fullWidth, fullHeight);
  }
}
```

Keep this helper internal to the renderer runtime. If tests reveal the DPR conversion already belongs in `threeRenderer.ts`, move the math into an internal helper there, but do not expose it publicly.

- [x] **Step 6: Use the helper in render loop**

Change `renderScene()` so every pass renders inside `withResolvedPassViewport(...)`:

```ts
renderLayers.renderPasses((pass, scene, camera) => {
  if (pass.clear) {
    rendererHost.renderer.clear?.();
  }
  if (pass.clearDepth) {
    rendererHost.renderer.clearDepth?.();
  }

  withResolvedPassViewport(pass, () => {
    postprocessController.render(
      {
        passId: pass.id,
        viewport: passViewports.resolve(pass.viewport),
        descriptor: pass.postprocess,
      },
      () => {
        scene.sceneAdapter.render(camera.camera);
      },
    );
  });
});
```

This snippet assumes Task 4 updates `postprocessController.render(...)` to accept a render context. If implementing Task 3 before Task 4, temporarily keep `postprocessController.render(() => scene.sceneAdapter.render(camera.camera))` inside the helper and update it in Task 4.

- [x] **Step 7: Add runtime viewport/scissor behavior test**

In `runtimePipeline.test.ts`, add:

```ts
test("renders a pass inside a DOM-bound viewport with scissor and restores canvas viewport", async () => {
  const sceneAdapter = createRecordingSceneAdapter();
  const setViewport = vi.fn();
  const setScissor = vi.fn();
  const setScissorTest = vi.fn();
  const runtime = await createPipelineRuntime({
    rendererHostFactory(container) {
      const host = createRendererHostStub(container, sceneAdapter);
      return {
        ...host,
        getViewportSize: () => ({ width: 800, height: 600 }),
        renderer: {
          ...host.renderer,
          setViewport,
          setScissor,
          setScissorTest,
        },
      };
    },
  });
  const anchor = document.createElement("section");
  anchor.getBoundingClientRect = () =>
    ({
      left: 20,
      top: 40,
      width: 320,
      height: 180,
      right: 340,
      bottom: 220,
    }) as DOMRect;

  runtime.registerScene({ id: "hero.scene" });
  runtime.registerCamera({
    id: "hero.camera",
    sceneId: "hero.scene",
    default: true,
  });
  runtime.registerPassViewport({ id: "hero.viewport", element: anchor });
  runtime.registerRenderPass({
    id: "hero.pass",
    sceneId: "hero.scene",
    cameraId: "hero.camera",
    viewport: {
      mode: "dom-rect",
      anchorId: "hero.viewport",
      scissor: true,
    },
  });

  await runtime.sync();

  expect(setScissorTest).toHaveBeenNthCalledWith(1, true);
  expect(setViewport).toHaveBeenNthCalledWith(1, 20, 380, 320, 180);
  expect(setScissor).toHaveBeenNthCalledWith(1, 20, 380, 320, 180);
  expect(sceneAdapter.render).toHaveBeenCalledTimes(1);
  expect(setScissorTest).toHaveBeenLastCalledWith(false);
  expect(setViewport).toHaveBeenLastCalledWith(0, 0, 800, 600);
  expect(setScissor).toHaveBeenLastCalledWith(0, 0, 800, 600);

  runtime.dispose();
});
```

- [x] **Step 8: Run targeted renderer tests**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/renderer/renderLayerRegistry.test.ts packages/dom-webgl-runtime/test/lib/renderer/runtimePipeline.test.ts packages/dom-webgl-runtime/test/lib/renderer/threeRenderer.test.ts
```

Expected: PASS.

### Task 4: Pass And Runtime Scoped Postprocess

**Files:**

- Modify: `packages/dom-webgl-runtime/src/lib/renderer/postprocessController.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/effects/effectAuthoring.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/effects/effectContext.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/effects/effectScopes.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/effects/effectObject.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`
- Test: `packages/dom-webgl-runtime/test/lib/renderer/postprocessController.test.ts`
- Test: `packages/dom-webgl-runtime/test/lib/effects/effectController.test.ts`
- Test: `packages/dom-webgl-runtime/test/lib/effects/effectObjectContext.test.ts`
- Test: `packages/dom-webgl-runtime/test/lib/renderer/runtimePipeline.test.ts`
- Test: `packages/dom-webgl-runtime/test/publicExports.test.ts`

- [x] **Step 1: Write failing controller tests for scoped requests**

In `postprocessController.test.ts`, add:

```ts
test("renders only requests scoped to the current pass plus canvas requests", () => {
  const rendered: Array<{
    bloom?: { strength: number; radius: number; threshold: number };
    grain?: { amount: number };
  }> = [];
  const controller = createPostprocessController(
    createPostprocessOptions({
      effectPass: {
        render(input) {
          rendered.push(input.request);
        },
        dispose() {},
      },
    }),
  );

  controller.requestPostprocess({
    key: "canvas.grain",
    scope: { canvas: true },
    grain: { amount: 0.04 },
  });
  controller.requestPostprocess({
    key: "hero.bloom",
    scope: { passId: "hero.pass" },
    bloom: { strength: 0.4 },
  });
  controller.requestPostprocess({
    key: "other.bloom",
    scope: { passId: "other.pass" },
    bloom: { strength: 0.6 },
  });

  controller.render({ passId: "hero.pass" }, () => {
    return;
  });

  expect(rendered).toEqual([
    expect.objectContaining({
      bloom: expect.objectContaining({ strength: 0.4 }),
      grain: expect.objectContaining({ amount: 0.04 }),
    }),
  ]);
  expect(rendered).not.toEqual([
    expect.objectContaining({
      bloom: expect.objectContaining({ strength: 0.6 }),
    }),
  ]);
});
```

Adjust expected names if `compilePostprocessRequest(...)` combines requests into one render. The invariant is that `other.pass` must not affect `hero.pass`.

- [x] **Step 2: Write failing runtime effect tests**

In `runtimePipeline.test.ts`, add:

```ts
test("routes ctx.runtime.postprocess requests by explicit pass scope", async () => {
  const requestPostprocess = vi.fn(() => ({
    update: vi.fn(),
    dispose: vi.fn(),
  }));
  const postprocessController = createStubPostprocessController({
    requestPostprocess,
  });
  const runtime = await createPipelineRuntime({
    postprocessController,
    effects: [
      defineWebGLEffect({
        kind: "custom.passPostprocess",
        setup(ctx) {
          return ctx.runtime.postprocess.request({
            key: "hero.pass.fx",
            scope: { passId: "hero.pass" },
            grain: { amount: 0.04 },
          });
        },
        update() {},
      }),
    ],
  });

  runtime.registerTarget(document.createElement("section"), {
    key: "hero.target",
    effects: [{ kind: "custom.passPostprocess" }],
  });

  await runtime.sync();

  expect(requestPostprocess).toHaveBeenCalledWith({
    key: "hero.pass.fx",
    scope: { passId: "hero.pass" },
    grain: { amount: 0.04 },
  });

  runtime.dispose();
});
```

- [x] **Step 3: Update postprocess request storage**

In `postprocessController.ts`, store scoped requests. Runtime-authored requests must carry explicit scope:

```ts
type StoredPostprocessRequest = {
  token: symbol;
  request: WebGLRuntimePostprocessRequest;
};

function cloneRequest(
  request: WebGLRuntimePostprocessRequest,
): WebGLRuntimePostprocessRequest {
  return {
    key: request.key,
    scope: { ...request.scope },
    ...(request.bloom ? { bloom: { ...request.bloom } } : {}),
    ...(request.grain ? { grain: { ...request.grain } } : {}),
    ...(request.blur ? { blur: { ...request.blur } } : {}),
  };
}
```

Descriptor-level pass postprocess can still compile internally without a stored
public request handle because it is not effect-authored.

- [x] **Step 4: Change render to accept a context**

Use this shape:

```ts
export type PostprocessRenderContext = {
  passId?: string;
  viewport?: { width: number; height: number };
  descriptor?: WebGLPostprocessDeclaration;
};

render(context: PostprocessRenderContext, renderBase: () => void): void;
```

Filter requests:

```ts
function requestMatchesPass(
  request: WebGLRuntimePostprocessRequest,
  passId: string | undefined,
): boolean {
  if ("canvas" in request.scope) {
    return true;
  }
  return request.scope.passId === passId;
}
```

Compile the descriptor as an anonymous pass-scoped request:

```ts
const request = compilePostprocessRequest([
  ...Array.from(requestsByKey.values(), (entry) => entry.request).filter((entry) =>
    requestMatchesPass(entry, context.passId),
  ),
  ...(context.descriptor
    ? [{ key: `pass:${context.passId ?? "canvas"}:descriptor`, ...context.descriptor }]
    : []),
]);
```

Use `context.viewport` for output size when present; otherwise use full runtime viewport.

- [x] **Step 5: Add `ctx.runtime.postprocess` facade**

In `effectScopes.ts` or `effectContext.ts`, create runtime scope with postprocess:

```ts
runtime: {
  progress: progressSignals,
  postprocess: {
    request(request) {
      return visual.requestPostprocess(request);
    },
  },
},
```

- [x] **Step 6: Remove `ctx.object.postprocess` from the object facade**

In `packages/dom-webgl-runtime/src/lib/effects/effectObject.ts`, remove
`postprocess` from `WebGLEffectObjectHandle` and from the object returned by the
factory.

In `packages/dom-webgl-runtime/test/lib/effects/effectObjectContext.test.ts`,
replace the existing "transform and postprocess" expectation with a runtime
scope test in `effectController.test.ts` or `runtimePipeline.test.ts`.

In `packages/dom-webgl-runtime/test/publicExports.test.ts`, keep the
`@ts-expect-error` assertion from Task 1 proving `ctx.object.postprocess` is no
longer part of the public object facade.

- [x] **Step 7: Update runtime render loop for pass descriptors**

In `runtime.ts`, pass pass id, resolved viewport dimensions, and descriptor:

```ts
const resolvedViewport = passViewports.resolve(pass.viewport);
withResolvedPassViewport(pass, resolvedViewport, () => {
  postprocessController.render(
    {
      passId: pass.id,
      viewport: readPostprocessViewport(resolvedViewport),
      descriptor: pass.postprocess,
    },
    () => {
      scene.sceneAdapter.render(camera.camera);
    },
  );
});
```

For canvas mode, `readPostprocessViewport(...)` should return `rendererHost.getViewportSize()`. For DOM rect mode, use `resolvedViewport.rect.width` and `resolvedViewport.rect.height`.

- [x] **Step 8: Run targeted postprocess tests**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/renderer/postprocessController.test.ts packages/dom-webgl-runtime/test/lib/effects/effectController.test.ts packages/dom-webgl-runtime/test/lib/effects/effectObjectContext.test.ts packages/dom-webgl-runtime/test/lib/renderer/runtimePipeline.test.ts packages/dom-webgl-runtime/test/publicExports.test.ts
```

Expected: PASS.

### Task 5: Debug State For Pass Viewport And Postprocess Scope

**Files:**

- Modify: `packages/dom-webgl-runtime/src/lib/types.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/debug/debugState.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/postprocessController.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`
- Test: `packages/dom-webgl-runtime/test/lib/debug/debugState.test.ts`
- Test: `packages/dom-webgl-runtime/test/lib/renderer/runtimePipeline.test.ts`
- Test: `packages/dom-webgl-runtime/test/publicExports.test.ts`

- [x] **Step 1: Write failing debug tests**

In `debugState.test.ts`, add:

```ts
test("reports postprocess request scopes without exposing render targets", () => {
  const state = createDebugState({
    targetCount: 0,
    renderableCount: 0,
    currentScrollMode: "page",
    pointer: createPointerState(),
    postprocessStats: {
      activeRequests: 2,
      passCount: 1,
      maxRenderTargetSize: 320,
      requests: [
        { key: "hero.pass.fx", scope: { passId: "hero.pass" } },
        { key: "legacy.canvas", scope: { canvas: true } },
      ],
    },
    targets: [],
  });

  expect(state.postprocessRequests).toEqual([
    { key: "hero.pass.fx", scope: { passId: "hero.pass" } },
    { key: "legacy.canvas", scope: { canvas: true } },
  ]);
  expect(state).not.toHaveProperty("renderTarget");
  expect(state).not.toHaveProperty("composer");
});
```

- [x] **Step 2: Add public debug summary types**

In `types.ts`:

```ts
export type WebGLDebugPostprocessRequestSummary = {
  key: string;
  scope: WebGLPostprocessScopeDeclaration;
};

export type WebGLDebugRenderPassSummary = {
  id: string;
  sceneId: string;
  cameraId?: string;
  viewportMode: "canvas" | "dom-rect";
  viewportAnchorId?: string;
  postprocess: boolean;
};
```

Extend `WebGLDebugState`:

```ts
renderPasses?: WebGLDebugRenderPassSummary[];
postprocessRequests?: WebGLDebugPostprocessRequestSummary[];
```

- [x] **Step 3: Return scoped summaries from postprocess controller**

Extend `PostprocessControllerStats`:

```ts
requests: WebGLDebugPostprocessRequestSummary[];
```

When inspecting, map absent scope to `{ canvas: true }`:

```ts
requests: requests.map((request) => ({
  key: request.key,
  scope: request.scope ?? { canvas: true },
})),
```

- [x] **Step 4: Add render pass summaries in runtime debug state**

Use `renderLayers.getPasses()` in `createCurrentDebugState()`:

```ts
renderPasses: renderLayers.getPasses().map((pass) => ({
  id: pass.id,
  sceneId: pass.sceneId,
  ...(pass.cameraId ? { cameraId: pass.cameraId } : {}),
  viewportMode: pass.viewport?.mode === "dom-rect" ? "dom-rect" : "canvas",
  ...(pass.viewport?.mode === "dom-rect"
    ? { viewportAnchorId: pass.viewport.anchorId }
    : {}),
  postprocess: Boolean(pass.postprocess),
})),
postprocessRequests: postprocessController.inspect().requests,
```

- [x] **Step 5: Run targeted debug tests**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/debug/debugState.test.ts packages/dom-webgl-runtime/test/lib/renderer/runtimePipeline.test.ts packages/dom-webgl-runtime/test/publicExports.test.ts
```

Expected: PASS.

### Task 6: Example Dogfood And Public Docs

**Files:**

- Modify: `apps/example/src/ManagedStagePrimitiveExample.tsx`
- Modify: `apps/example/src/App.tsx` only if the example route needs a stable wrapper or copy update.
- Modify: `README.md`
- Modify: `docs/STATUS.md`
- Modify: `docs/agent/package-onboarding.md`
- Modify: `docs/agent/package-usage.md`
- Modify: `docs/examples/effect-authoring.md`
- Modify: `docs/roadmap/managed-render-system.md`
- Test: `apps/example/test/App.test.tsx`
- Test: `packages/dom-webgl-runtime/test/publicExports.test.ts`

- [x] **Step 1: Update example to dogfood DOM-bound pass viewport**

In `apps/example/src/ManagedStagePrimitiveExample.tsx`, wrap the managed stage section with `WebGLPassViewport` and bind the scene render pass:

```tsx
<WebGLPassViewport
  id="example.managed-stage.viewport"
  as="section"
  className="example-stage-viewport"
  aria-hidden="true"
>
  <WebGLScene
    id="example.managed-stage"
    projection="perspective-stage"
    render={{
      camera: "example.managed-stage.camera",
      viewport: {
        mode: "dom-rect",
        scissor: true,
      },
      postprocess: {
        grain: { amount: 0.025 },
      },
    }}
    timeline={{ id: managedTimelineId, active: { from: 0.05, to: 0.95 } }}
  >
    {/* existing camera, stage primitives, lights, and child WebGLTarget stay here */}
  </WebGLScene>
</WebGLPassViewport>
```

Keep visible copy honest: it may now say the managed stage pass is clipped to the DOM viewport. Do not claim `screen-plane`, picking, physics, or target-local postprocess.

- [x] **Step 2: Update README package overview**

Change the capability table entry:

```md
| runtime/pass postprocess | `ctx.runtime.postprocess.request(...)` for explicit canvas/pass-scoped requests; `ctx.object.postprocess` is removed in Phase 6 |
```

Add a short pass viewport example:

```tsx
<WebGLPassViewport id="hero.stage.viewport" as="section">
  <WebGLScene
    id="hero.stage"
    projection="perspective-stage"
    render={{
      camera: "hero.camera",
      viewport: { mode: "dom-rect" },
    }}
  >
    <WebGLCamera id="hero.camera" default type="perspective" />
  </WebGLScene>
</WebGLPassViewport>
```

- [x] **Step 3: Update package docs**

In `docs/agent/package-onboarding.md` and `docs/agent/package-usage.md`, replace statements that say DOM-bound pass viewport/scissor and pass-scoped postprocess are future work. New wording:

```md
`WebGLPassViewport` registers a DOM rect anchor for a managed render pass. Use it only for opt-in managed scene/pass work; Level 1 `WebGLTarget` usage does not need it.
```

```md
Pass postprocess belongs on `WebGLRenderPass` / `WebGLScene render`, or in effects through `ctx.runtime.postprocess.request(...)` with an explicit `{ canvas: true }` or `{ passId }` scope. `ctx.object.postprocess` was removed because the name implied object-local behavior while the implementation was canvas scoped.
```

- [x] **Step 4: Update effect tutorial**

In `docs/examples/effect-authoring.md`, change the managed timeline/stage section so it no longer says DOM-bound viewport/scissor is Phase 6 work. Add the actual `WebGLPassViewport` example and keep the caution that postprocess is pass/canvas scoped.

- [x] **Step 5: Update status and roadmap**

After implementation and verification are complete, update:

```md
Phase 6: Pass Viewport And Postprocess Scope Correction | `[verified]` | [2026-07-04-pass-viewport-postprocess-scope.md](../superpowers/plans/2026-07-04-pass-viewport-postprocess-scope.md)
```

Do this only after tests, docs, and commit are closed. During implementation, use `[in-progress]` once tests/code begin and `[implemented]` if code is complete but verification/docs/commit are not closed.

- [x] **Step 6: Run example and docs tests**

Run:

```bash
npm test -- --run apps/example/test/App.test.tsx packages/dom-webgl-runtime/test/publicExports.test.ts
```

Expected: PASS.

### Task 7: Verification And Closeout

**Files:**

- Modify: `docs/roadmap/managed-render-system.md`
- Modify: `docs/STATUS.md`
- No source files should remain with unrelated changes.

- [x] **Step 1: Run full verification**

Run:

```bash
npm run test -- --run && npm run typecheck && npm run build && npm run check:imports && git diff --check
```

Expected: PASS.

- [x] **Step 2: Inspect public import boundary**

Run:

```bash
npm run check:imports
```

Expected: PASS and no `apps/example` imports from `packages/dom-webgl-runtime/src`.

- [x] **Step 3: Review changed docs for scope language**

Check:

```bash
rg -n "object-local|ctx\\.object\\.postprocess|DOM-bound pass viewport/scissor is Phase 6 work|future Phase 6|WebGLCameraDeclaration\\.timeline|camera controls" README.md docs/STATUS.md docs/agent docs/examples apps/example/src
```

Expected:

- No active docs recommend `ctx.object.postprocess`.
- No active docs still say DOM-bound pass viewport/scissor is future work.
- Any remaining active-doc mention of `ctx.object.postprocess` says it was
  removed in Phase 6 because it was not object-local.
- Any active docs that mention camera controls say progress-driven camera
  controllers are Phase 6A work and pointer-driven camera interaction is Phase
  8 work.

- [x] **Step 4: Update roadmap status**

Only after full verification and docs closeout:

```md
| Phase 6: Pass Viewport And Postprocess Scope Correction | `[verified]` | [2026-07-04-pass-viewport-postprocess-scope.md](../superpowers/plans/2026-07-04-pass-viewport-postprocess-scope.md) | DOM-bound pass viewport/scissor, pass descriptors, runtime/pass postprocess scope, debug summaries, tests, docs, and commit are closed. |
```

- [x] **Step 5: Commit**

```bash
git add packages/dom-webgl-runtime apps/example README.md docs
git commit -m "feat: add pass viewport and scoped postprocess"
```

Expected: commit succeeds. Do not push unless explicitly asked.

## Testing Strategy

Targeted tests by behavior:

- Public API and no raw internals:
  - `npm test -- --run packages/dom-webgl-runtime/test/publicExports.test.ts`
  - Include a type-boundary assertion that Phase 6 does not add
    `timeline` to `WebGLCameraDeclaration`.
- React descriptor forwarding:
  - `npm test -- --run packages/dom-webgl-runtime/test/lib/react/WebGLRenderPass.test.tsx packages/dom-webgl-runtime/test/lib/react/WebGLScene.test.tsx packages/dom-webgl-runtime/test/lib/react/WebGLPassViewport.test.tsx`
- Registry and render-layer behavior:
  - `npm test -- --run packages/dom-webgl-runtime/test/lib/renderer/passViewportRegistry.test.ts packages/dom-webgl-runtime/test/lib/renderer/renderLayerRegistry.test.ts`
- Runtime render flow:
  - `npm test -- --run packages/dom-webgl-runtime/test/lib/renderer/runtimePipeline.test.ts`
- Postprocess internals:
  - `npm test -- --run packages/dom-webgl-runtime/test/lib/renderer/postprocessController.test.ts`
- Debug state:
  - `npm test -- --run packages/dom-webgl-runtime/test/lib/debug/debugState.test.ts`
- Example dogfood:
  - `npm test -- --run apps/example/test/App.test.tsx`

Full closeout:

```bash
npm run test -- --run && npm run typecheck && npm run build && npm run check:imports && git diff --check
```

## Documentation Updates

Update active docs only. Do not use archive files as current truth.

- `README.md`
  - Add `WebGLPassViewport` / pass viewport example.
  - Rename forward postprocess guidance to runtime/pass scoped.
  - Remove `ctx.object.postprocess` from forward capability tables and document
    `ctx.runtime.postprocess` as the only effect-authored postprocess API.
- `docs/STATUS.md`
  - Move Phase 6 from planned/in-progress to verified only after closeout.
  - Mention DOM-bound pass viewport/scissor and scoped postprocess in implemented surface.
  - Keep the camera split explicit: progress-driven camera controllers are Phase
    6A work, while pointer-driven camera interaction is Phase 8 work.
- `docs/agent/package-onboarding.md`
  - Add shortest route guidance: Level 1 does not need pass viewport.
  - Add managed pass viewport route for advanced scenes.
- `docs/agent/package-usage.md`
  - Add `WebGLPassViewport`, pass `viewport`, pass `postprocess`, and `ctx.runtime.postprocess` contract.
  - Remove future-work wording for Phase 6 after implementation.
- `docs/examples/effect-authoring.md`
  - Update managed timeline/stage section and postprocess warnings.
- `docs/roadmap/managed-render-system.md`
  - Keep Roadmap Status as source of truth.
  - During execution set Phase 6 to `[in-progress]`; after full closeout set it to `[verified]`.
  - Do not change Phase 6A from `[not-started]` unless a separate focused
    camera-controller plan is created.

## Exit Criteria

Phase 6 is done only when all are true:

- Level 1 `WebGLTarget` examples and tests remain unchanged in required setup.
- `WebGLPassViewport` registers a DOM rect anchor and unregisters on unmount.
- A managed render pass can render into that DOM rect with renderer-owned viewport/scissor and restore canvas viewport after the pass.
- Pass descriptor postprocess works without raw composer/render-target exposure.
- `ctx.runtime.postprocess.request(...)` accepts explicit canvas/pass scope.
- `ctx.object.postprocess` is removed from public effect-object types and public
  type tests reject it.
- Debug state reports pass viewport and postprocess request scope by descriptor-only summaries.
- Active docs no longer say DOM-bound pass viewport/scissor is future work.
- Active docs do not imply Phase 6 implements camera motion/focus/framing,
  `WebGLCameraDeclaration.timeline`, or camera controls.
- Phase 6A has enough stable handoff data to start later: pass ids, scene ids,
  camera ids, pass viewport summaries, and scoped postprocess summaries are
  descriptor-only and do not expose raw Three.js handles.
- Tests, typecheck, build, import guard, and `git diff --check` pass.
- Roadmap Phase 6 is `[verified]` only after tests, docs, and commit are closed.

## Risks And Mitigations

- Renderer state leakage between passes.
  - Mitigation: apply viewport/scissor in a `try/finally` helper and test restore calls.
- DPR and coordinate inversion mistakes.
  - Mitigation: unit test CSS rect `(left, top, width, height)` to WebGL viewport `(x, canvasHeight - top - height, width, height)` conversion.
- Postprocess target size mismatch for DOM-bound pass.
  - Mitigation: pass resolved viewport dimensions into `postprocessController.render(...)` and keep render-target pooling keyed by output size.
- Scope confusion between pass and object.
  - Mitigation: docs and examples use `ctx.runtime.postprocess`; public types
    reject `ctx.object.postprocess`.
- Scope creep into camera behavior.
  - Mitigation: public tests should reject `WebGLCameraDeclaration.timeline` in
    Phase 6, and docs should route progress-driven camera controls to Phase 6A
    and pointer-driven camera controls to Phase 8.
- Over-expanding into render graph/composer API.
  - Mitigation: only add `bloom`, `grain`, and `blur` descriptor data already supported by current controller.
- Requiring viewport anchors for Level 1 users.
  - Mitigation: default pass viewport remains canvas; `WebGLTarget` path is unchanged.
- Stale docs after implementation.
  - Mitigation: run the `rg` closeout check in Task 7 Step 3 before marking verified.

## Implementation Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-04-pass-viewport-postprocess-scope.md`.

Recommended execution option: Subagent-Driven for isolated tasks with main-agent review after each task. Inline Execution is also acceptable because this phase crosses runtime, React, tests, example, and docs but has a clear task order.
