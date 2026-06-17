# Phase 3 Visible Renderables Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every supported DOM-authored source type enter the runtime-owned Three.js scene as visible WebGL content, with verified DOM fallback hiding that can preserve child DOM visibility.

**Architecture:** Phase 3 adds internal scene-object ownership beneath the existing DOM -> source descriptor -> renderRole -> renderable -> single renderer pipeline. Renderables create and update runtime-owned scene objects through internal adapters; public declarations stay DOM-first and still do not expose Three.js render flags. DOM fallback visibility is handled by a runtime lifecycle controller so `hideWhenReady` can hide replaced DOM after WebGL is ready while preserving child DOM when requested.

**Tech Stack:** npm workspaces, TypeScript, Vitest, jsdom, React, Vite, Three.js.

---

## Baseline Before Phase 3

Current verified baseline:

- Phase 1 is complete through Task 37.
- Phase 2 is complete through Task 56.
- `npm run check && git diff --check` passed after Phase 2 final verification.
- The demo registers targets and loads resources, but does not yet render DOM snapshots, image/video planes, or GLB objects as visible Three.js scene content.

## Hard Scope Rules

Allowed in Phase 3:

- Runtime-owned scene object adapter.
- DOM rect projection into the internal Three.js scene.
- Visible scene objects for:
  - element snapshot targets,
  - text snapshot targets,
  - image targets,
  - video targets,
  - GLB model targets.
- Internal render loop or render-on-sync path.
- DOM fallback lifecycle for `hideWhenReady`.
- A child-preserving hide mode for container/self paint replacement.
- Demo coverage proving every public target category becomes WebGL-visible.

Still forbidden:

- Effect registry.
- Animation/effect layer.
- Lenis / GSAP ScrollTrigger adapter.
- WebGL raycast picking.
- Multiple canvas.
- Public Three.js `renderOrder`, `transparent`, or `depthWrite`.
- Demo imports from runtime internals.

## Behavior Contract

- A renderable is not considered visually ready until it has a scene object attached to the runtime scene.
- `setVisible(false)` hides the runtime-owned scene object, not only a debug record.
- `setVisible(true)` restores the runtime-owned scene object if the renderable is not disposed.
- `dispose()` removes scene objects from the runtime scene and releases owned GPU resources.
- `lifecycle.hideWhenReady: true` hides the target DOM fallback only after its WebGL renderable is visually ready.
- Failed or loading renderables keep the DOM fallback visible.
- Runtime disposal and target unregister restore DOM fallback visibility.
- Child DOM can remain visible when a target uses child-preserving fallback hiding.
- Public API remains DOM-first. Any lifecycle extension must stay high level and must not expose Three.js implementation details.

## Proposed Lifecycle Shape

Keep the existing boolean valid:

```ts
type WebGLLifecycleDeclaration = {
  hideWhenReady?: boolean;
  hideMode?: "subtree" | "self";
};
```

Default behavior:

- `hideWhenReady: false | undefined`: never hide DOM fallback.
- `hideWhenReady: true` with no `hideMode`: use `"subtree"` for leaf/media-like targets and `"self"` for element snapshot containers.
- `hideMode: "subtree"`: hide the target element and its descendants after the WebGL replacement is ready.
- `hideMode: "self"`: hide only the target element's own paint while forcing child elements back to visible, so nested DOM remains usable and visible.

The implementation may choose class-based styles or inline styles, but it must restore previous DOM styles/classes exactly on unregister and disposal.

## File Map

Public contract:

- Modify: `packages/dom-webgl-runtime/src/lib/types.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/types.test.ts`
- Modify: `packages/dom-webgl-runtime/src/publicExports.test.ts`

Renderer scene boundary:

- Modify: `packages/dom-webgl-runtime/src/lib/renderer/threeRenderer.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/threeRenderer.test.ts`
- Create: `packages/dom-webgl-runtime/src/lib/renderer/sceneObject.ts`
- Create: `packages/dom-webgl-runtime/src/lib/renderer/sceneObject.test.ts`
- Create: `packages/dom-webgl-runtime/src/lib/renderer/domProjection.ts`
- Create: `packages/dom-webgl-runtime/src/lib/renderer/domProjection.test.ts`

Renderable integration:

- Modify: `packages/dom-webgl-runtime/src/lib/render/renderable.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderable.test.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderableFactory.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderableFactory.test.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/elementSnapshotRenderable.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/elementSnapshotRenderable.test.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/textSnapshotRenderable.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/textSnapshotRenderable.test.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/imageRenderable.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/imageRenderable.test.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/videoRenderable.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/videoRenderable.test.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/modelRenderable.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/modelRenderable.test.ts`

DOM fallback lifecycle:

- Create: `packages/dom-webgl-runtime/src/lib/dom/fallbackVisibility.ts`
- Create: `packages/dom-webgl-runtime/src/lib/dom/fallbackVisibility.test.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/dom/targetDescriptor.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/dom/targetDescriptor.test.ts`

Runtime and debug:

- Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtime.test.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/debug/debugState.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/debug/debugState.test.ts`

React and demo:

- Modify: `packages/dom-webgl-runtime/src/lib/react/WebGLTarget.test.tsx`
- Modify: `apps/demo/src/App.tsx`
- Modify: `apps/demo/src/App.test.tsx`
- Modify: `apps/demo/src/debugPanel.tsx`
- Modify: `apps/demo/src/debugPanel.test.tsx`
- Keep verifying: `apps/demo/src/demo-import-boundary.test.ts`

Docs and state:

- Update after each completed implementation task: `docs/EXECUTION_STATE.md`
- Check off tasks here as Phase 3 progresses: `docs/PHASE3_VISIBLE_RENDERABLE_PLAN.md`
- Final Phase 3 docs task updates `README.md` and `docs/00-goal.md`.

---

## Tasks

- [x] **Task 57: Internal Scene Object Contract**

  **Goal:** Add an internal scene object abstraction that renderables can own without exposing Three.js types publicly.

  **Files:**
  - Create: `packages/dom-webgl-runtime/src/lib/renderer/sceneObject.ts`
  - Create: `packages/dom-webgl-runtime/src/lib/renderer/sceneObject.test.ts`
  - Modify: `packages/dom-webgl-runtime/src/lib/renderer/threeRenderer.ts`
  - Modify: `packages/dom-webgl-runtime/src/lib/renderer/threeRenderer.test.ts`

  **Test first:** Add tests for an injected scene adapter that records `add`, `remove`, `render`, and object visibility calls. Prove one object can be added, hidden, shown, removed idempotently, and that `render()` is callable without a real GPU.

  **Implementation:** Introduce internal types similar to:

  ```ts
  export type WebGLSceneObject = {
    readonly key: string;
    setVisible(visible: boolean): void;
    updateLayout(rect: DOMRectReadOnly): void;
    dispose(): void;
  };

  export type WebGLSceneAdapter = {
    addObject(object: WebGLSceneObject): void;
    removeObject(object: WebGLSceneObject): void;
    render(): void;
  };
  ```

  Extend `ThreeRendererHost` with an internal `sceneAdapter` field. Keep this adapter internal to `src/lib`; do not export it from package root or React entrypoints.

  **Verification command:** `npm test -- --run packages/dom-webgl-runtime/src/lib/renderer/sceneObject.test.ts packages/dom-webgl-runtime/src/lib/renderer/threeRenderer.test.ts && npm run typecheck`

  **Completion condition:** Runtime code has a testable internal scene-object boundary and no public API leak.

- [x] **Task 58: DOM Rect Projection**

  **Goal:** Define a deterministic internal mapping from DOM rects to scene object layout.

  **Files:**
  - Create: `packages/dom-webgl-runtime/src/lib/renderer/domProjection.ts`
  - Create: `packages/dom-webgl-runtime/src/lib/renderer/domProjection.test.ts`
  - Modify: `packages/dom-webgl-runtime/src/lib/renderer/threeRenderer.ts`
  - Modify: `packages/dom-webgl-runtime/src/lib/renderer/threeRenderer.test.ts`

  **Test first:** Test that a rect `{ left: 20, top: 40, width: 200, height: 100 }` in an `800 x 600` viewport maps to centered scene layout `{ x: 120, y: 510, width: 200, height: 100 }` when using a top-left DOM origin and bottom-left scene origin. Test zero-size rects stay zero-size and do not throw.

  **Implementation:** Add a pure helper that accepts a DOM rect and viewport size. Configure the default Three camera internally so scene coordinates can match CSS pixels. Prefer an orthographic camera internally if needed; this remains an implementation detail.

  **Verification command:** `npm test -- --run packages/dom-webgl-runtime/src/lib/renderer/domProjection.test.ts packages/dom-webgl-runtime/src/lib/renderer/threeRenderer.test.ts && npm run typecheck`

  **Completion condition:** Renderables can update scene layout from DOM measurements with deterministic tests.

- [x] **Task 59: Lifecycle Hide Mode Types**

  **Goal:** Add child-preserving fallback hiding to the public lifecycle declaration without exposing implementation details.

  **Files:**
  - Modify: `packages/dom-webgl-runtime/src/lib/types.ts`
  - Modify: `packages/dom-webgl-runtime/src/lib/types.test.ts`
  - Modify: `packages/dom-webgl-runtime/src/publicExports.test.ts`

  **Test first:** Extend type tests to accept `lifecycle: { hideWhenReady: true, hideMode: "self" }` and `hideMode: "subtree"`, while rejecting unknown modes and any Three.js render flags.

  **Implementation:** Extend `WebGLLifecycleDeclaration` with `hideMode?: "subtree" | "self"`. Keep existing `hideWhenReady?: boolean` behavior valid.

  **Verification command:** `npm test -- --run packages/dom-webgl-runtime/src/lib/types.test.ts packages/dom-webgl-runtime/src/publicExports.test.ts && npm run typecheck`

  **Completion condition:** Public lifecycle can request child-preserving DOM fallback hiding in a high-level way.

- [x] **Task 60: DOM Fallback Visibility Controller**

  **Goal:** Add a DOM fallback visibility controller that can hide a whole subtree or only the target element's own paint, then restore exactly.

  **Files:**
  - Create: `packages/dom-webgl-runtime/src/lib/dom/fallbackVisibility.ts`
  - Create: `packages/dom-webgl-runtime/src/lib/dom/fallbackVisibility.test.ts`
  - Modify: `packages/dom-webgl-runtime/src/lib/dom/targetDescriptor.ts`
  - Modify: `packages/dom-webgl-runtime/src/lib/dom/targetDescriptor.test.ts`

  **Test first:** Test four cases:
  - `hideWhenReady` omitted leaves DOM unchanged.
  - `hideMode: "subtree"` hides the target and descendants.
  - `hideMode: "self"` hides the target fallback while a child element remains visible.
  - `restore()` returns previous inline styles/classes after unregister/dispose.

  **Implementation:** Implement `createFallbackVisibilityController(element, lifecycle)` with `hide()` and `restore()`. Use a class or inline styles, but store previous state before mutation. The `"self"` mode must force child visibility back to visible through a scoped marker so child DOM remains visible.

  **Verification command:** `npm test -- --run packages/dom-webgl-runtime/src/lib/dom/fallbackVisibility.test.ts packages/dom-webgl-runtime/src/lib/dom/targetDescriptor.test.ts && npm run typecheck`

  **Completion condition:** DOM fallback visibility is independently testable and reversible.

- [x] **Task 61: Runtime Applies Fallback Visibility Only After WebGL Ready**

  **Goal:** Wire fallback hiding into runtime lifecycle so DOM hides only after a renderable has a visible scene object.

  **Files:**
  - Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`
  - Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtime.test.ts`
  - Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts`

  **Test first:** Add runtime tests proving:
  - DOM is not hidden before `sync()`.
  - DOM is not hidden while an async renderable is loading.
  - DOM hides after the renderable reaches `ready` and owns a scene object.
  - DOM restores on `unregisterTarget()` and `dispose()`.
  - Error state keeps DOM visible and releases any active gate.

  **Implementation:** Create and store one fallback visibility controller per target. Call `hide()` only after `syncDebugRecordFromRenderable()` sees the renderable is ready and visually attached. Call `restore()` on unregister, disposal, and renderable error.

  **Verification command:** `npm test -- --run packages/dom-webgl-runtime/src/lib/renderer/runtime.test.ts packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts && npm run typecheck`

  **Completion condition:** Runtime controls DOM fallback visibility from renderable readiness, not from registration timing.

- [x] **Task 62: Element Snapshot Scene Plane**

  **Goal:** Make element snapshot renderables create a visible scene plane from the measured DOM element.

  **Files:**
  - Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/elementSnapshotRenderable.ts`
  - Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/elementSnapshotRenderable.test.ts`
  - Modify: `packages/dom-webgl-runtime/src/lib/render/renderableFactory.ts`
  - Modify: `packages/dom-webgl-runtime/src/lib/render/renderableFactory.test.ts`

  **Test first:** Add tests proving an element snapshot renderable:
  - creates one scene object through the injected scene adapter,
  - updates scene layout from `measureElement`,
  - marks itself ready after the scene object is attached,
  - toggles scene object visibility through `setVisible()`,
  - removes the scene object on dispose.

  **Implementation:** Pass the internal scene adapter/projection context through `RenderableFactoryContext`. For this first slice, render a deterministic element plane using computed fallback color/box data that can be tested without browser rasterization. Do not pull in external DOM rasterization dependencies.

  **Verification command:** `npm test -- --run packages/dom-webgl-runtime/src/lib/render/renderables/elementSnapshotRenderable.test.ts packages/dom-webgl-runtime/src/lib/render/renderableFactory.test.ts && npm run typecheck`

  **Completion condition:** Element snapshot targets enter the Three scene as visible runtime-owned objects.

- [x] **Task 63: Text Snapshot Scene Plane**

  **Goal:** Make text snapshot renderables create visible text content in the scene.

  **Files:**
  - Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/textSnapshotRenderable.ts`
  - Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/textSnapshotRenderable.test.ts`
  - Modify: `packages/dom-webgl-runtime/src/lib/render/renderableFactory.test.ts`

  **Test first:** Add tests proving a text snapshot renderable:
  - creates one scene object with the element text content,
  - updates when text content changes before the next sync,
  - preserves upstream `renderRole` and policy,
  - toggles visibility and disposes its scene object.

  **Implementation:** Use an internal canvas-text texture or testable text-scene-object adapter. Keep the behavior inside the renderable and do not add an effect layer.

  **Verification command:** `npm test -- --run packages/dom-webgl-runtime/src/lib/render/renderables/textSnapshotRenderable.test.ts packages/dom-webgl-runtime/src/lib/render/renderableFactory.test.ts && npm run typecheck`

  **Completion condition:** Text DOM targets can become visible WebGL scene content.

- [x] **Task 64: Image Scene Plane**

  **Goal:** Make image renderables create visible textured scene planes.

  **Files:**
  - Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/imageRenderable.ts`
  - Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/imageRenderable.test.ts`
  - Modify: `packages/dom-webgl-runtime/src/lib/render/renderableFactory.test.ts`

  **Test first:** Add tests proving image renderables:
  - keep `fallbackVisible` true while image decode/load is pending,
  - create a scene object after the resource is ready,
  - set `fallbackVisible` false after the scene object is attached,
  - update layout from DOM rect,
  - remove and dispose texture/object on dispose.

  **Implementation:** Use the loaded `HTMLImageElement` as the internal texture source. Keep resource loading through the existing resource manager.

  **Verification command:** `npm test -- --run packages/dom-webgl-runtime/src/lib/render/renderables/imageRenderable.test.ts packages/dom-webgl-runtime/src/lib/render/renderableFactory.test.ts && npm run typecheck`

  **Completion condition:** Image DOM targets can become visible WebGL scene content and hide their DOM fallback when ready.

- [x] **Task 65: Video Scene Plane**

  **Goal:** Make video renderables create visible video-textured scene planes and preserve video lifecycle safety.

  **Files:**
  - Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/videoRenderable.ts`
  - Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/videoRenderable.test.ts`
  - Modify: `packages/dom-webgl-runtime/src/lib/render/renderableFactory.test.ts`

  **Test first:** Add tests proving video renderables:
  - wait for the existing video resource readiness path,
  - create one scene object using the loaded video element,
  - pause the source element when hidden,
  - pause and remove scene object on dispose,
  - keep fallback visible on video load error.

  **Implementation:** Use an internal video texture scene object after resource readiness. Do not add playback controls or effect code.

  **Verification command:** `npm test -- --run packages/dom-webgl-runtime/src/lib/render/renderables/videoRenderable.test.ts packages/dom-webgl-runtime/src/lib/render/renderableFactory.test.ts && npm run typecheck`

  **Completion condition:** Video DOM targets can become visible WebGL scene content without losing existing pause/dispose behavior.

- [x] **Task 66: GLB Model Scene Object**

  **Goal:** Make GLB model renderables add the loaded model scene/object to the runtime scene.

  **Files:**
  - Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/modelRenderable.ts`
  - Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/modelRenderable.test.ts`
  - Modify: `packages/dom-webgl-runtime/src/lib/render/renderableFactory.test.ts`

  **Test first:** Add tests proving model renderables:
  - keep fallback visible while model loading is pending,
  - add the loaded GLTF scene/object after readiness,
  - position/scale from the anchor DOM rect,
  - toggle visibility through `setVisible()`,
  - remove and dispose the object on dispose.

  **Implementation:** Accept the default GLTFLoader result and injected `loadModel()` results through a small internal reader that supports `{ scene: object }` and direct object results. Do not expose GLTF or Three.js object types publicly.

  **Verification command:** `npm test -- --run packages/dom-webgl-runtime/src/lib/render/renderables/modelRenderable.test.ts packages/dom-webgl-runtime/src/lib/render/renderableFactory.test.ts && npm run typecheck`

  **Completion condition:** GLB model targets can become visible scene objects instead of only loaded resources.

- [x] **Task 67: Internal Render Policy Ordering**

  **Goal:** Apply renderRole ordering internally so all visible scene objects draw predictably without public Three.js flags.

  **Files:**
  - Modify: `packages/dom-webgl-runtime/src/lib/render/renderPolicy.ts`
  - Modify: `packages/dom-webgl-runtime/src/lib/render/renderPolicy.test.ts`
  - Modify: `packages/dom-webgl-runtime/src/lib/renderer/sceneObject.ts`
  - Modify: `packages/dom-webgl-runtime/src/lib/renderer/sceneObject.test.ts`

  **Test first:** Add tests proving the internal adapter receives deterministic ordering for `surface`, `content`, `media`, `model`, and `overlay`, while public declarations still reject `renderOrder`, `transparent`, and `depthWrite`.

  **Implementation:** Map existing `RenderPolicy` to internal scene object ordering fields. Keep those fields internal.

  **Verification command:** `npm test -- --run packages/dom-webgl-runtime/src/lib/render/renderPolicy.test.ts packages/dom-webgl-runtime/src/lib/renderer/sceneObject.test.ts packages/dom-webgl-runtime/src/lib/types.test.ts && npm run typecheck`

  **Completion condition:** Ordering works through renderRole/policy, not public Three.js knobs.

- [x] **Task 68: Runtime Renders Scene On Sync**

  **Goal:** Ensure runtime sync creates, updates, and renders the scene after visible objects change.

  **Files:**
  - Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`
  - Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtime.test.ts`
  - Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts`
  - Modify: `packages/dom-webgl-runtime/src/lib/debug/debugState.ts`
  - Modify: `packages/dom-webgl-runtime/src/lib/debug/debugState.test.ts`

  **Test first:** Add runtime tests proving:
  - `sync()` calls the scene adapter `render()` after synchronous visible updates,
  - async resource completion triggers a later render after objects attach,
  - `debugState.targets[].visible` reflects scene object visibility,
  - disposed runtime does not render again.

  **Implementation:** Call the internal scene adapter render path after renderable updates and after async resource completion. Keep this render-on-sync first; do not add a requestAnimationFrame loop unless tests prove it is needed.

  **Verification command:** `npm test -- --run packages/dom-webgl-runtime/src/lib/renderer/runtime.test.ts packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts packages/dom-webgl-runtime/src/lib/debug/debugState.test.ts && npm run typecheck`

  **Completion condition:** Scene content is rendered through the single runtime renderer whenever sync changes visible state.

- [x] **Task 69: React And Demo Visible Smoke**

  **Goal:** Prove the public React demo can declare every source type and have each one enter the WebGL scene through public APIs only.

  **Files:**
  - Modify: `apps/demo/src/App.tsx`
  - Modify: `apps/demo/src/App.test.tsx`
  - Modify: `apps/demo/src/debugPanel.tsx`
  - Modify: `apps/demo/src/debugPanel.test.tsx`
  - Modify: `packages/dom-webgl-runtime/src/lib/react/WebGLTarget.test.tsx`
  - Keep verifying: `apps/demo/src/demo-import-boundary.test.ts`

  **Test first:** Add demo tests proving:
  - element snapshot, text snapshot, image, video, and GLB targets are declared through public `WebGLTarget`,
  - at least one container target uses `lifecycle: { hideWhenReady: true, hideMode: "self" }`,
  - a child DOM element remains visible after the parent fallback is hidden,
  - demo imports still use only public package entrypoints.

  **Implementation:** Update the demo declarations and debug panel copy only as needed to show WebGL-visible readiness. Do not import runtime internals in the demo.

  **Verification command:** `npm test -- --run apps/demo/src/App.test.tsx apps/demo/src/debugPanel.test.tsx packages/dom-webgl-runtime/src/lib/react/WebGLTarget.test.tsx apps/demo/src/demo-import-boundary.test.ts && npm run check:imports && npm run typecheck`

  **Completion condition:** The demo exercises every visible renderable path through public APIs and preserves child DOM visibility.

- [x] **Task 70: SSR And Public Boundary Regression**

  **Goal:** Prove Phase 3 visible scene work does not break SSR-safe imports or public API boundaries.

  **Files:**
  - Modify: `packages/dom-webgl-runtime/src/publicExports.test.ts`
  - Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtime.test.ts`
  - Keep verifying: `apps/demo/src/demo-import-boundary.test.ts`

  **Test first:** Add or extend tests proving root and React entrypoint imports remain safe when browser globals throw, and that new internal scene object types are not exported publicly.

  **Implementation:** Move any browser-only object creation behind runtime execution if tests expose import-time side effects.

  **Verification command:** `npm test -- --run packages/dom-webgl-runtime/src/publicExports.test.ts packages/dom-webgl-runtime/src/lib/renderer/runtime.test.ts apps/demo/src/demo-import-boundary.test.ts && npm run check:imports && npm run typecheck`

  **Completion condition:** Visible renderable internals stay internal and SSR/public import guarantees remain intact.

- [ ] **Task 71: Phase 3 Full Verification**

  **Goal:** Run full workspace verification after all visible renderable paths are complete.

  **Files:**
  - Modify only if verification exposes a Phase 3 bug.

  **Test first:** This is a verification-only task after Task 57 through Task 70 pass individually.

  **Implementation:** Fix only failures related to visible renderables, fallback visibility, public boundaries, or docs drift. Do not add effect registry, animation/effect layer, third-party scroll adapters, raycast picking, multiple canvas, or public Three.js render flags.

  **Verification command:** `npm run test -- --run && npm run typecheck && npm run build && npm run check:imports && git diff --check`

  **Completion condition:** Full verification passes and every supported source type has a verified visible scene path.

- [ ] **Task 72: Phase 3 Documentation Alignment**

  **Goal:** Align user-facing docs with delivered visible renderable and fallback visibility behavior.

  **Files:**
  - Modify: `README.md`
  - Modify: `docs/00-goal.md`
  - Modify: `docs/EXECUTION_STATE.md`
  - Modify: `docs/PHASE3_VISIBLE_RENDERABLE_PLAN.md`

  **Test first:** Record a documentation checklist in `docs/EXECUTION_STATE.md` before editing docs, naming all visible source types, fallback hiding behavior, child-preserving mode, public boundary constraints, and still-forbidden effect scope.

  **Implementation:** Document setup/verification commands, public lifecycle shape, fallback visibility semantics, demo behavior, and deferred effect/adapters/picking scope.

  **Verification command:** `npm run check && npm run build && npm run check:imports && git diff --check`

  **Completion condition:** Docs describe implemented Phase 3 behavior accurately and do not claim an effect layer, Lenis/GSAP adapter, picking, multiple canvas, or exposed Three.js render flags.

## Suggested Next Round

Batch D is complete through Task 70. Next start Batch E Tasks 71-72 only after an explicit request.
