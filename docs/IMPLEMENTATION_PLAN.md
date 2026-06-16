# DOM-First Interactive WebGL Runtime Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first-phase DOM-first interactive WebGL runtime MVP with a reusable runtime package, React adapter, and demo app, without scene-gated scroll or an effect system.

**Architecture:** The runtime compiles declarations through a strict pipeline: DOM target -> target descriptor -> source descriptor -> renderRole -> render policy -> renderable -> one Three.js renderer. Core runtime code lives in `packages/dom-webgl-runtime/src/lib/*`; public consumers use only `@project/dom-webgl-runtime` and `@project/dom-webgl-runtime/react`. The demo app is a consumer, not a privileged internal test bed.

**Tech Stack:** npm workspaces, TypeScript, Vitest, jsdom, React, Vite, Three.js.

---

## Hard Scope Rules

- Phase 1 must not implement scene-gated scroll, scroll lock, `sceneProgress`, or reverse gate behavior.
- Phase 1 must not implement a general effect registry or advanced animation/effect layer.
- Phase 1 must not create multiple WebGL canvases.
- Phase 1 must not implement WebGL raycast picking or mesh-level interaction.
- Phase 1 must not add Lenis / GSAP ScrollTrigger adapters.
- Phase 1 must not add a class-based compatibility layer.
- Public API must not expose Three.js `renderOrder`, `transparent`, or `depthWrite`.
- `apps/demo` must import only public package APIs: `@project/dom-webgl-runtime` and `@project/dom-webgl-runtime/react`.
- Package imports must be SSR-safe: importing public package entrypoints must not touch `window`, `document`, `HTMLElement`, canvas, or WebGL at module import time.

## Phase 1 Scope

Phase 1 implements:

- monorepo workspace
- `packages/dom-webgl-runtime`
- `apps/demo`
- package public exports
- `WebGLDeclaration` type
- target descriptor
- source descriptor inference
- `renderRole` inference
- render policy compilation
- minimal resource manager
- base `Renderable` abstraction
- element snapshot renderable
- text snapshot renderable
- image renderable
- video renderable
- GLB model renderable
- single Three.js renderer
- shared `WebGLFrameInput`
- basic page scroll mode
- basic pointer move/click/drag state
- React `WebGLRuntime` / `WebGLTarget` / `useWebGLRuntime`
- lightweight `WebGLDebugState`
- demo import-boundary verification
- SSR-safe public package import verification

## File Map

Root:

- Create: `package.json`
- Create: `tsconfig.base.json`
- Create: `vitest.config.ts`
- Create: `scripts/assert-demo-public-imports.mjs`
- Create or modify: `README.md`

Runtime package:

- Create: `packages/dom-webgl-runtime/package.json`
- Create: `packages/dom-webgl-runtime/tsconfig.json`
- Create: `packages/dom-webgl-runtime/src/index.ts`
- Create: `packages/dom-webgl-runtime/src/react.ts`
- Create: `packages/dom-webgl-runtime/src/lib/types.ts`
- Create: `packages/dom-webgl-runtime/src/lib/dom/targetDescriptor.ts`
- Create: `packages/dom-webgl-runtime/src/lib/dom/registry.ts`
- Create: `packages/dom-webgl-runtime/src/lib/source/sourceDescriptor.ts`
- Create: `packages/dom-webgl-runtime/src/lib/source/inferSource.ts`
- Create: `packages/dom-webgl-runtime/src/lib/render/renderRole.ts`
- Create: `packages/dom-webgl-runtime/src/lib/render/renderPolicy.ts`
- Create: `packages/dom-webgl-runtime/src/lib/resources/resourceManager.ts`
- Create: `packages/dom-webgl-runtime/src/lib/render/renderable.ts`
- Create: `packages/dom-webgl-runtime/src/lib/render/renderableFactory.ts`
- Create: `packages/dom-webgl-runtime/src/lib/render/renderables/elementSnapshotRenderable.ts`
- Create: `packages/dom-webgl-runtime/src/lib/render/renderables/textSnapshotRenderable.ts`
- Create: `packages/dom-webgl-runtime/src/lib/render/renderables/imageRenderable.ts`
- Create: `packages/dom-webgl-runtime/src/lib/render/renderables/videoRenderable.ts`
- Create: `packages/dom-webgl-runtime/src/lib/render/renderables/modelRenderable.ts`
- Create: `packages/dom-webgl-runtime/src/lib/input/pageScroll.ts`
- Create: `packages/dom-webgl-runtime/src/lib/input/pointerController.ts`
- Create: `packages/dom-webgl-runtime/src/lib/input/frameInput.ts`
- Create: `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`
- Create: `packages/dom-webgl-runtime/src/lib/renderer/threeRenderer.ts`
- Create: `packages/dom-webgl-runtime/src/lib/debug/debugState.ts`
- Create: `packages/dom-webgl-runtime/src/lib/react/runtimeContext.tsx`
- Create: `packages/dom-webgl-runtime/src/lib/react/WebGLRuntime.tsx`
- Create: `packages/dom-webgl-runtime/src/lib/react/WebGLTarget.tsx`
- Create: `packages/dom-webgl-runtime/src/lib/react/useWebGLRuntime.ts`

Demo app:

- Create: `apps/demo/package.json`
- Create: `apps/demo/index.html`
- Create: `apps/demo/src/main.tsx`
- Create: `apps/demo/src/App.tsx`
- Create: `apps/demo/src/demo.css`
- Create: `apps/demo/src/debugPanel.tsx`

Tests:

- Create colocated `*.test.ts` / `*.test.tsx` files beside runtime modules.
- Create: `apps/demo/src/demo-import-boundary.test.ts`

---

## M1: Project Skeleton

- [x] **Task 1: Root Workspace Skeleton**

  **Goal:** Create the npm workspace and shared TypeScript/Vitest setup.

  **Files:**
  - Create: `package.json`
  - Create: `tsconfig.base.json`
  - Create: `vitest.config.ts`
  - Create: `workspace.test.ts`

  **Test first:** Add a workspace structure test that expects root workspace entries for `packages/*` and `apps/*`.

  **Implementation:** Add root `package.json` with `private: true`, workspaces, and scripts for `test`, `typecheck`, `build`, and `check`; add shared TypeScript and Vitest config.

  **Verification command:** `npm test -- --run workspace.test.ts`

  **Completion condition:** The workspace structure test fails before root config exists, then passes after config exists.

- [x] **Task 2: Runtime Package Skeleton**

  **Goal:** Create the runtime package shell and package export surface.

  **Files:**
  - Create: `packages/dom-webgl-runtime/package.json`
  - Create: `packages/dom-webgl-runtime/tsconfig.json`
  - Create: `packages/dom-webgl-runtime/src/index.ts`
  - Create: `packages/dom-webgl-runtime/src/react.ts`
  - Create: `packages/dom-webgl-runtime/src/index.test.ts`

  **Test first:** Test that `packages/dom-webgl-runtime/package.json` exposes `.` and `./react`.

  **Implementation:** Add package metadata for `@project/dom-webgl-runtime`; add empty public entrypoints that compile.

  **Verification command:** `npm test -- --run packages/dom-webgl-runtime/src/index.test.ts`

  **Completion condition:** Package has stable public export entries and TypeScript can resolve both public entrypoints.

- [x] **Task 3: Demo Package Skeleton**

  **Goal:** Create a Vite React demo app that depends on the runtime package.

  **Files:**
  - Create: `apps/demo/package.json`
  - Create: `apps/demo/index.html`
  - Create: `apps/demo/src/main.tsx`
  - Create: `apps/demo/src/App.tsx`
  - Create: `apps/demo/src/demo.css`
  - Create: `apps/demo/src/App.test.tsx`

  **Test first:** Add a demo smoke test that imports `apps/demo/src/App.tsx`.

  **Implementation:** Add minimal React app with placeholder DOM scene; depend on `@project/dom-webgl-runtime` through the workspace.

  **Verification command:** `npm test -- --run apps/demo/src/App.test.tsx`

  **Completion condition:** Demo compiles and imports the runtime package as a workspace dependency.

---

## M2: Public Types

- [x] **Task 4: WebGLDeclaration Types**

  **Goal:** Define the public declaration schema.

  **Files:**
  - Create: `packages/dom-webgl-runtime/src/lib/types.ts`
  - Modify: `packages/dom-webgl-runtime/src/index.ts`
  - Create: `packages/dom-webgl-runtime/src/lib/types.test.ts`

  **Test first:** Type-level tests verify `WebGLDeclaration` accepts `key`, `source`, `renderRole`, `scroll`, `pointer`, and `lifecycle`, and rejects direct Three.js policy fields.

  **Implementation:** Define `WebGLDeclaration`, `WebGLSourceDeclaration`, `WebGLRenderRole`, Phase 1 page-only `WebGLScrollBehavior`, `WebGLPointerDeclaration`, and `WebGLLifecycleDeclaration`.

  **Verification command:** `npm test -- --run packages/dom-webgl-runtime/src/lib/types.test.ts`

  **Completion condition:** Public declaration types compile and do not expose `renderOrder`, `transparent`, or `depthWrite`.

- [x] **Task 5: Frame, Pointer, Debug Types**

  **Goal:** Define shared runtime state types.

  **Files:**
  - Modify: `packages/dom-webgl-runtime/src/lib/types.ts`
  - Modify: `packages/dom-webgl-runtime/src/index.ts`
  - Create: `packages/dom-webgl-runtime/src/lib/runtime-state.test.ts`

  **Test first:** Type-level test verifies `WebGLPointerState`, `WebGLFrameInput`, and `WebGLDebugState` are exported from the public entrypoint.

  **Implementation:** Add `WebGLPointerState`, `WebGLFrameInput`, `WebGLDebugState`, and `WebGLResourceStatus`; export only public types from `src/index.ts`.

  **Verification command:** `npm test -- --run packages/dom-webgl-runtime/src/lib/runtime-state.test.ts`

  **Completion condition:** Public runtime state types are available without importing internal paths.

---

## M3: Target Descriptor

- [x] **Task 6: Target Descriptor Normalization**

  **Goal:** Convert a DOM element and declaration into a normalized target descriptor.

  **Files:**
  - Create: `packages/dom-webgl-runtime/src/lib/dom/targetDescriptor.ts`
  - Create: `packages/dom-webgl-runtime/src/lib/dom/targetDescriptor.test.ts`

  **Test first:** Test that descriptor includes key, element reference, scan order, and declaration; test that missing key throws a visible error.

  **Implementation:** Implement `createTargetDescriptor(element, declaration, scanOrder)`; preserve the element reference; normalize default declaration fields.

  **Verification command:** `npm test -- --run packages/dom-webgl-runtime/src/lib/dom/targetDescriptor.test.ts`

  **Completion condition:** Descriptor creation is deterministic and validates `key`.

- [x] **Task 7: Runtime Target Registry**

  **Goal:** Register and unregister DOM targets by stable key.

  **Files:**
  - Create: `packages/dom-webgl-runtime/src/lib/dom/registry.ts`
  - Create: `packages/dom-webgl-runtime/src/lib/dom/registry.test.ts`
  - Modify: `packages/dom-webgl-runtime/src/index.ts`

  **Test first:** Test that registering returns a descriptor, duplicate keys throw, and unregister removes the descriptor.

  **Implementation:** Implement `createTargetRegistry()` independent from Three.js.

  **Verification command:** `npm test -- --run packages/dom-webgl-runtime/src/lib/dom/registry.test.ts`

  **Completion condition:** Registry owns descriptors and enforces stable key uniqueness.

---

## M4: Source Descriptor Inference

- [x] **Task 8: Source Descriptor Types**

  **Goal:** Define internal source descriptor variants.

  **Files:**
  - Create: `packages/dom-webgl-runtime/src/lib/source/sourceDescriptor.ts`
  - Create: `packages/dom-webgl-runtime/src/lib/source/sourceDescriptor.test.ts`

  **Test first:** Test descriptor variants for element snapshot, text snapshot, image, video, and GLB model.

  **Implementation:** Define internal `WebGLSourceDescriptor` union; keep it internal unless a later public test proves export is needed.

  **Verification command:** `npm test -- --run packages/dom-webgl-runtime/src/lib/source/sourceDescriptor.test.ts`

  **Completion condition:** Internal source descriptor union represents all Phase 1 source kinds.

- [x] **Task 9: DOM Source Inference**

  **Goal:** Infer sources from DOM elements.

  **Files:**
  - Create: `packages/dom-webgl-runtime/src/lib/source/inferSource.ts`
  - Create: `packages/dom-webgl-runtime/src/lib/source/inferSource.test.ts`

  **Test first:** Test image source from `IMG`, video source from `VIDEO`, text snapshot when requested, and element snapshot fallback.

  **Implementation:** Implement `inferSourceDescriptor(targetDescriptor)`; prefer explicit declaration source over DOM inference.

  **Verification command:** `npm test -- --run packages/dom-webgl-runtime/src/lib/source/inferSource.test.ts`

  **Completion condition:** Source inference handles DOM-native image/video and snapshot fallback.

- [x] **Task 10: Explicit Model Source**

  **Goal:** Support explicit GLB model source declaration.

  **Files:**
  - Modify: `packages/dom-webgl-runtime/src/lib/source/inferSource.ts`
  - Modify: `packages/dom-webgl-runtime/src/lib/source/inferSource.test.ts`

  **Test first:** Declaration `{ source: { kind: "model", format: "glb", src } }` returns a model descriptor anchored to the target element.

  **Implementation:** Add explicit model source inference; reject unsupported model formats with a visible error.

  **Verification command:** `npm test -- --run packages/dom-webgl-runtime/src/lib/source/inferSource.test.ts`

  **Completion condition:** GLB source descriptor is created only from explicit declaration.

---

## M5: renderRole + Render Policy

- [x] **Task 11: renderRole Inference**

  **Goal:** Infer semantic render roles from source descriptors.

  **Files:**
  - Create: `packages/dom-webgl-runtime/src/lib/render/renderRole.ts`
  - Create: `packages/dom-webgl-runtime/src/lib/render/renderRole.test.ts`

  **Test first:** Test element snapshot -> `surface`, text snapshot -> `content`, image/video -> `media`, model/glb -> `model`, and explicit declaration override wins.

  **Implementation:** Implement `inferRenderRole(sourceDescriptor, declaration)`.

  **Verification command:** `npm test -- --run packages/dom-webgl-runtime/src/lib/render/renderRole.test.ts`

  **Completion condition:** Role inference matches the goal document and supports explicit overrides.

- [x] **Task 12: Render Policy Compilation**

  **Goal:** Compile role into internal render policy without exposing Three.js flags publicly.

  **Files:**
  - Create: `packages/dom-webgl-runtime/src/lib/render/renderPolicy.ts`
  - Create: `packages/dom-webgl-runtime/src/lib/render/renderPolicy.test.ts`

  **Test first:** Test stable band order `surface < content < media < model < overlay`; test public declaration cannot set policy fields directly.

  **Implementation:** Implement `compileRenderPolicy(renderRole)` using internal policy fields such as `band`, `depthMode`, and `opacityMode`.

  **Verification command:** `npm test -- --run packages/dom-webgl-runtime/src/lib/render/renderPolicy.test.ts`

  **Completion condition:** Render ordering is deterministic and policy remains internal.

---

## M6: Resource Manager

- [x] **Task 13: Resource Record Lifecycle**

  **Goal:** Add minimal shared resource records.

  **Files:**
  - Create: `packages/dom-webgl-runtime/src/lib/resources/resourceManager.ts`
  - Create: `packages/dom-webgl-runtime/src/lib/resources/resourceManager.test.ts`

  **Test first:** Test initial status `idle`, `load()` transitions through `loading` to `ready`, failed load transitions to `error`, and `dispose()` is idempotent.

  **Implementation:** Implement `createResourceManager()` with cache keys by resource kind and normalized URL or snapshot key; add reference counting.

  **Verification command:** `npm test -- --run packages/dom-webgl-runtime/src/lib/resources/resourceManager.test.ts`

  **Completion condition:** Resources are shared by key and expose inspectable status.

- [x] **Task 14: DOM-Native Resource Adoption**

  **Goal:** Avoid duplicate image/video acquisition for DOM-native media.

  **Files:**
  - Modify: `packages/dom-webgl-runtime/src/lib/resources/resourceManager.ts`
  - Modify: `packages/dom-webgl-runtime/src/lib/resources/resourceManager.test.ts`

  **Test first:** Test image resource uses the existing image element source; test video resource uses the existing media element identity.

  **Implementation:** Add resource acquisition paths for image and video descriptors; store adopted DOM element references in internal records.

  **Verification command:** `npm test -- --run packages/dom-webgl-runtime/src/lib/resources/resourceManager.test.ts`

  **Completion condition:** DOM-native image/video resources can be adopted instead of duplicated.

---

## M7: Renderables

- [x] **Task 15: Base Renderable Interface**

  **Goal:** Define a uniform renderable abstraction.

  **Files:**
  - Create: `packages/dom-webgl-runtime/src/lib/render/renderable.ts`
  - Create: `packages/dom-webgl-runtime/src/lib/render/renderable.test.ts`

  **Test first:** Test a renderable has key, descriptor, role, policy, status, update, setVisible, and dispose; test dispose is idempotent.

  **Implementation:** Define `Renderable`, `RenderableContext`, and helper lifecycle status transitions.

  **Verification command:** `npm test -- --run packages/dom-webgl-runtime/src/lib/render/renderable.test.ts`

  **Completion condition:** All concrete renderables can implement the same lifecycle contract.

- [ ] **Task 16: Element Snapshot Renderable**

  **Goal:** Add minimal element snapshot renderable.

  **Files:**
  - Create: `packages/dom-webgl-runtime/src/lib/render/renderables/elementSnapshotRenderable.ts`
  - Create: `packages/dom-webgl-runtime/src/lib/render/renderables/elementSnapshotRenderable.test.ts`

  **Test first:** Test element snapshot renderable creates a renderable with role `surface`, update reads target DOM rect through a provided measurement callback, and dispose marks status disposed.

  **Implementation:** Implement a lightweight plane renderable backed by internal metadata; keep high-fidelity DOM rasterization out of Phase 1.

  **Verification command:** `npm test -- --run packages/dom-webgl-runtime/src/lib/render/renderables/elementSnapshotRenderable.test.ts`

  **Completion condition:** Element snapshot participates in renderable lifecycle and measurement update path.

- [ ] **Task 17: Text Snapshot Renderable**

  **Goal:** Add minimal text snapshot renderable.

  **Files:**
  - Create: `packages/dom-webgl-runtime/src/lib/render/renderables/textSnapshotRenderable.ts`
  - Create: `packages/dom-webgl-runtime/src/lib/render/renderables/textSnapshotRenderable.test.ts`

  **Test first:** Test text snapshot renderable uses role `content`, captures text content from the target element, and dispose is idempotent.

  **Implementation:** Implement text snapshot renderable with text metadata and shared renderable lifecycle.

  **Verification command:** `npm test -- --run packages/dom-webgl-runtime/src/lib/render/renderables/textSnapshotRenderable.test.ts`

  **Completion condition:** Text snapshot renderable is separate from element surface renderable.

- [ ] **Task 18: Image Renderable**

  **Goal:** Add image renderable backed by resource manager.

  **Files:**
  - Create: `packages/dom-webgl-runtime/src/lib/render/renderables/imageRenderable.ts`
  - Create: `packages/dom-webgl-runtime/src/lib/render/renderables/imageRenderable.test.ts`

  **Test first:** Test image renderable uses role `media`, acquires image resource through resource manager, and failed resource keeps fallback visible in state.

  **Implementation:** Implement image renderable lifecycle with resource acquisition; do not issue duplicate fetches for DOM image elements.

  **Verification command:** `npm test -- --run packages/dom-webgl-runtime/src/lib/render/renderables/imageRenderable.test.ts`

  **Completion condition:** Image renderable reports loading/ready/error through resource status.

- [ ] **Task 19: Video Renderable**

  **Goal:** Add video renderable backed by resource manager.

  **Files:**
  - Create: `packages/dom-webgl-runtime/src/lib/render/renderables/videoRenderable.ts`
  - Create: `packages/dom-webgl-runtime/src/lib/render/renderables/videoRenderable.test.ts`

  **Test first:** Test video renderable uses role `media`, adopts existing video element resource, and inactive/dispose path pauses or releases video references.

  **Implementation:** Implement video renderable lifecycle with adopted media resource; keep autoplay policy handling out of Phase 1 beyond explicit state.

  **Verification command:** `npm test -- --run packages/dom-webgl-runtime/src/lib/render/renderables/videoRenderable.test.ts`

  **Completion condition:** Video renderable uses shared lifecycle and releases references on dispose.

- [ ] **Task 20: GLB Model Renderable**

  **Goal:** Add GLB model renderable with minimal loader boundary.

  **Files:**
  - Create: `packages/dom-webgl-runtime/src/lib/render/renderables/modelRenderable.ts`
  - Create: `packages/dom-webgl-runtime/src/lib/render/renderables/modelRenderable.test.ts`

  **Test first:** Test model renderable uses role `model`, requests a `model/glb` resource, and loader failure sets status `error` while fallback remains visible.

  **Implementation:** Implement model renderable with a loader adapter boundary; use Three.js GLTFLoader behind the adapter; defer custom resolvers and complex asset dependency handling.

  **Verification command:** `npm test -- --run packages/dom-webgl-runtime/src/lib/render/renderables/modelRenderable.test.ts`

  **Completion condition:** GLB renderable exists, is ordered as `model`, and has visible error state.

- [ ] **Task 21: Renderable Factory**

  **Goal:** Compile descriptors into concrete renderables.

  **Files:**
  - Create: `packages/dom-webgl-runtime/src/lib/render/renderableFactory.ts`
  - Create: `packages/dom-webgl-runtime/src/lib/render/renderableFactory.test.ts`

  **Test first:** Test each source descriptor kind creates the expected renderable type; unsupported descriptor kind throws a visible runtime error.

  **Implementation:** Implement `createRenderable(targetDescriptor, sourceDescriptor, role, policy, context)`.

  **Verification command:** `npm test -- --run packages/dom-webgl-runtime/src/lib/render/renderableFactory.test.ts`

  **Completion condition:** The pipeline can produce renderables without demo-specific logic.

---

## M8: Single Renderer

- [ ] **Task 22: Runtime Creation Is SSR-Safe**

  **Goal:** Ensure imports are SSR-safe and browser work is execution-only.

  **Files:**
  - Create: `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`
  - Create: `packages/dom-webgl-runtime/src/lib/renderer/runtime.test.ts`
  - Modify: `packages/dom-webgl-runtime/src/index.ts`

  **Test first:** Test importing public runtime APIs in a node-like environment does not access `window` or `document`; test executing browser-only runtime creation without a DOM throws a clear error.

  **Implementation:** Implement `createWebGLRuntime(options)` and defer all DOM/canvas/Three.js renderer work until client execution.

  **Verification command:** `npm test -- --run packages/dom-webgl-runtime/src/lib/renderer/runtime.test.ts`

  **Completion condition:** Package import is SSR-safe; client-only execution fails visibly outside browser.

- [ ] **Task 23: Single Three.js Renderer**

  **Goal:** Create exactly one renderer/canvas per runtime instance.

  **Files:**
  - Create: `packages/dom-webgl-runtime/src/lib/renderer/threeRenderer.ts`
  - Create: `packages/dom-webgl-runtime/src/lib/renderer/threeRenderer.test.ts`
  - Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`

  **Test first:** Test runtime mount appends one canvas, repeated sync/register does not create additional canvases, and dispose removes canvas and releases renderables.

  **Implementation:** Implement `createThreeRendererHost(container)`; runtime owns one scene, one camera, one renderer, and one canvas.

  **Verification command:** `npm test -- --run packages/dom-webgl-runtime/src/lib/renderer/threeRenderer.test.ts`

  **Completion condition:** A runtime instance never creates multiple canvases.

- [ ] **Task 24: Runtime Pipeline Sync**

  **Goal:** Connect registry, source inference, role inference, policy, and renderable factory.

  **Files:**
  - Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`
  - Create: `packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts`

  **Test first:** Test registering an element produces one renderable; registering image/video/model declarations produces expected role counts; unregister disposes the matching renderable.

  **Implementation:** Implement runtime `registerTarget`, `unregisterTarget`, and `sync`; store renderables by target key; update debug state after sync.

  **Verification command:** `npm test -- --run packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts`

  **Completion condition:** The full Phase 1 compile pipeline works without React.

---

## M9: Frame Input, Page Scroll, Pointer State

- [ ] **Task 25: Basic Page Scroll State**

  **Goal:** Provide page scroll mode for frame input.

  **Files:**
  - Create: `packages/dom-webgl-runtime/src/lib/input/pageScroll.ts`
  - Create: `packages/dom-webgl-runtime/src/lib/input/pageScroll.test.ts`

  **Test first:** Test default scroll mode is `page`, page progress clamps from `0` to `1`, and direction/velocity update from scroll deltas.

  **Implementation:** Implement `createPageScrollState(getScrollMetrics)`; do not implement gate mode behavior.

  **Verification command:** `npm test -- --run packages/dom-webgl-runtime/src/lib/input/pageScroll.test.ts`

  **Completion condition:** Frame input can report page scroll only.

- [ ] **Task 26: Pointer Move/Click/Drag State**

  **Goal:** Normalize pointer state in one runtime-owned controller.

  **Files:**
  - Create: `packages/dom-webgl-runtime/src/lib/input/pointerController.ts`
  - Create: `packages/dom-webgl-runtime/src/lib/input/pointerController.test.ts`

  **Test first:** Test pointer move updates x/y and normalized coordinates, pointer down/up records click count, and drag starts after down + movement and reports drag deltas.

  **Implementation:** Implement `createPointerController(targetElement)` with centralized listeners, `getState()`, and `dispose()`.

  **Verification command:** `npm test -- --run packages/dom-webgl-runtime/src/lib/input/pointerController.test.ts`

  **Completion condition:** Pointer state is centralized and frame-readable.

- [ ] **Task 27: Shared WebGLFrameInput**

  **Goal:** Compose time, delta, scroll, and pointer into one frame input.

  **Files:**
  - Create: `packages/dom-webgl-runtime/src/lib/input/frameInput.ts`
  - Create: `packages/dom-webgl-runtime/src/lib/input/frameInput.test.ts`
  - Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`

  **Test first:** Test frame input includes monotonic time/delta, page scroll state, and pointer state.

  **Implementation:** Implement `createFrameInputSource(scrollState, pointerController, clock)`; runtime passes frame input to renderables on update.

  **Verification command:** `npm test -- --run packages/dom-webgl-runtime/src/lib/input/frameInput.test.ts`

  **Completion condition:** Renderables receive one normalized frame input.

---

## M10: Debug State

- [ ] **Task 28: Lightweight Debug State**

  **Goal:** Expose runtime state for tests and demo inspection.

  **Files:**
  - Create: `packages/dom-webgl-runtime/src/lib/debug/debugState.ts`
  - Create: `packages/dom-webgl-runtime/src/lib/debug/debugState.test.ts`
  - Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`
  - Modify: `packages/dom-webgl-runtime/src/index.ts`

  **Test first:** Test debug state includes target count, renderable count, current scroll mode, pointer state, and target summaries with key, source kind, renderRole, resource status, visible, and error.

  **Implementation:** Implement `createDebugState(runtimeState)`, `runtime.getDebugState()`, and optional `onDebugStateChange`.

  **Verification command:** `npm test -- --run packages/dom-webgl-runtime/src/lib/debug/debugState.test.ts`

  **Completion condition:** Debug state is public and stable enough for demo and tests.

---

## M11: React Adapter

- [ ] **Task 29: React Runtime Context**

  **Goal:** Provide React context and hook for runtime access.

  **Files:**
  - Create: `packages/dom-webgl-runtime/src/lib/react/runtimeContext.tsx`
  - Create: `packages/dom-webgl-runtime/src/lib/react/useWebGLRuntime.ts`
  - Create: `packages/dom-webgl-runtime/src/lib/react/useWebGLRuntime.test.tsx`
  - Modify: `packages/dom-webgl-runtime/src/react.ts`

  **Test first:** Test hook returns runtime inside provider and throws a clear error outside provider.

  **Implementation:** Implement context provider and `useWebGLRuntime`.

  **Verification command:** `npm test -- --run packages/dom-webgl-runtime/src/lib/react/useWebGLRuntime.test.tsx`

  **Completion condition:** React consumers can access runtime safely.

- [ ] **Task 30: React WebGLRuntime Component**

  **Goal:** Mount runtime behind a client boundary.

  **Files:**
  - Create: `packages/dom-webgl-runtime/src/lib/react/WebGLRuntime.tsx`
  - Create: `packages/dom-webgl-runtime/src/lib/react/WebGLRuntime.test.tsx`
  - Modify: `packages/dom-webgl-runtime/src/react.ts`

  **Test first:** Test component creates runtime after mount, disposes runtime on unmount, and renders children inside provider.

  **Implementation:** Implement `WebGLRuntime` component with runtime events; avoid browser work at module import time.

  **Verification command:** `npm test -- --run packages/dom-webgl-runtime/src/lib/react/WebGLRuntime.test.tsx`

  **Completion condition:** React runtime component owns runtime lifecycle and is SSR-safe at import time.

- [ ] **Task 31: React WebGLTarget Component**

  **Goal:** Register DOM targets from React refs.

  **Files:**
  - Create: `packages/dom-webgl-runtime/src/lib/react/WebGLTarget.tsx`
  - Create: `packages/dom-webgl-runtime/src/lib/react/WebGLTarget.test.tsx`
  - Modify: `packages/dom-webgl-runtime/src/react.ts`

  **Test first:** Test `WebGLTarget` renders the requested `as` element, registers on mount with `webgl` declaration, unregisters on unmount, and does not expose internal runtime modules.

  **Implementation:** Implement polymorphic `WebGLTarget`; register using runtime context and DOM ref; keep declaration grouped under `webgl`.

  **Verification command:** `npm test -- --run packages/dom-webgl-runtime/src/lib/react/WebGLTarget.test.tsx`

  **Completion condition:** React target maps ordinary DOM to runtime declarations.

---

## M12: Demo

- [ ] **Task 32: Demo Uses Public API Only**

  **Goal:** Enforce app/package boundary.

  **Files:**
  - Create: `scripts/assert-demo-public-imports.mjs`
  - Create: `apps/demo/src/demo-import-boundary.test.ts`
  - Modify: `package.json`

  **Test first:** Test fails if `apps/demo` imports `packages/dom-webgl-runtime/src/lib/*`; test allows only `@project/dom-webgl-runtime` and `@project/dom-webgl-runtime/react`.

  **Implementation:** Implement static import scanner for `apps/demo/src/**/*`; add root script `check:imports`.

  **Verification command:** `npm test -- --run apps/demo/src/demo-import-boundary.test.ts && npm run check:imports`

  **Completion condition:** Demo cannot consume runtime internals.

- [ ] **Task 33: Demo DOM Scene**

  **Goal:** Build a demo scene that declares Phase 1 targets.

  **Files:**
  - Modify: `apps/demo/src/App.tsx`
  - Modify: `apps/demo/src/demo.css`
  - Create: `apps/demo/src/App.test.tsx`

  **Test first:** Test demo renders `WebGLRuntime`, an element snapshot target, text target, image target, video target, and GLB model target, all through `webgl` declarations.

  **Implementation:** Use `WebGLRuntime` and `WebGLTarget`; import only from `@project/dom-webgl-runtime/react`.

  **Verification command:** `npm test -- --run apps/demo/src/App.test.tsx && npm run check:imports`

  **Completion condition:** Demo exercises every Phase 1 source category through public React API.

- [ ] **Task 34: Demo Debug Panel**

  **Goal:** Show lightweight debug state in the demo.

  **Files:**
  - Create: `apps/demo/src/debugPanel.tsx`
  - Modify: `apps/demo/src/App.tsx`
  - Create: `apps/demo/src/debugPanel.test.tsx`

  **Test first:** Test debug panel renders target count, renderable count, scroll mode, and pointer coordinates; test panel accepts `WebGLDebugState` from the public package type.

  **Implementation:** Render a compact debug panel from runtime debug state; keep UI operational rather than marketing-oriented.

  **Verification command:** `npm test -- --run apps/demo/src/debugPanel.test.tsx && npm run typecheck`

  **Completion condition:** Demo exposes debug state without internal imports.

---

## M13: Final Verification

- [ ] **Task 35: Public Export Contract**

  **Goal:** Verify all intended public exports exist and no internal exports leak.

  **Files:**
  - Modify: `packages/dom-webgl-runtime/src/index.ts`
  - Modify: `packages/dom-webgl-runtime/src/react.ts`
  - Create: `packages/dom-webgl-runtime/src/publicExports.test.ts`

  **Test first:** Test root export includes runtime APIs and public types; React export includes `WebGLRuntime`, `WebGLTarget`, and `useWebGLRuntime`; internal helpers are not exported from root.

  **Implementation:** Adjust public export files only.

  **Verification command:** `npm test -- --run packages/dom-webgl-runtime/src/publicExports.test.ts && npm run typecheck`

  **Completion condition:** Public API is small and matches Phase 1 scope.

- [ ] **Task 36: Full Check**

  **Goal:** Run final project verification.

  **Files:**
  - No new files unless a verification failure exposes a missing test.

  **Test first:** This task is verification-only after all behavior tasks are complete.

  **Implementation:** Fix only failures discovered by verification; do not add scene-gated scroll or effect behavior while fixing.

  **Verification command:** `npm run test -- --run && npm run typecheck && npm run build && npm run check:imports && git diff --check`

  **Completion condition:** All commands pass; demo import boundary passes; runtime package builds; no second-stage scope slipped into Phase 1.

- [ ] **Task 37: Documentation Alignment**

  **Goal:** Ensure docs match the delivered Phase 1 behavior.

  **Files:**
  - Modify: `docs/00-goal.md` only if it needs a Phase 1 status note
  - Create or modify: `README.md`

  **Test first:** Add or update a documentation checklist in execution notes before editing docs.

  **Implementation:** Document setup commands, public API import paths, Phase 1 exclusions, and future status of scene-gated scroll and effects.

  **Verification command:** `npm run check && git diff --check`

  **Completion condition:** Documentation matches implemented Phase 1 scope and does not claim gated scroll or effects.

---

## Execution Rules

- Use TDD for every behavior task.
- For each behavior task:
  - write the failing test first
  - run targeted test and confirm failure
  - write minimal implementation
  - run targeted test and confirm pass
  - run relevant typecheck when public types change
- Do not implement scene-gated scroll in Phase 1.
- Do not implement effect registry or effect layer in Phase 1.
- Do not expose Three.js `renderOrder`, `transparent`, or `depthWrite` as public declaration fields.
- Keep package public imports SSR-safe.
- Keep demo imports limited to package public APIs.
- After each milestone, request code review using `superpowers:requesting-code-review`.
- Before final completion, use `superpowers:verification-before-completion`.
- At branch finish, use `superpowers:finishing-a-development-branch`.

## Self-Review

- Scope coverage: all requested Phase 1 items map to M1-M13.
- Exclusions: scene-gated scroll and effect system are explicitly excluded.
- Dependency order: workspace -> types -> descriptors -> inference -> policies -> resources -> renderables -> renderer -> input -> React -> demo -> verification.
- Public boundary: enforced by package exports and demo import scanner.
- SSR boundary: enforced by runtime import and React import tests.
- Risk controls: SSR safety, single canvas, fallback state, resource sharing, and public API constraints each have dedicated tests.
