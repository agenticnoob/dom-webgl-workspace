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

- [x] **Task 16: Element Snapshot Renderable**

  **Goal:** Add minimal element snapshot renderable.

  **Files:**
  - Create: `packages/dom-webgl-runtime/src/lib/render/renderables/elementSnapshotRenderable.ts`
  - Create: `packages/dom-webgl-runtime/src/lib/render/renderables/elementSnapshotRenderable.test.ts`

  **Test first:** Test element snapshot renderable creates a renderable with role `surface`, update reads target DOM rect through a provided measurement callback, and dispose marks status disposed.

  **Implementation:** Implement a lightweight plane renderable backed by internal metadata; keep high-fidelity DOM rasterization out of Phase 1.

  **Verification command:** `npm test -- --run packages/dom-webgl-runtime/src/lib/render/renderables/elementSnapshotRenderable.test.ts`

  **Completion condition:** Element snapshot participates in renderable lifecycle and measurement update path.

- [x] **Task 17: Text Snapshot Renderable**

  **Goal:** Add minimal text snapshot renderable.

  **Files:**
  - Create: `packages/dom-webgl-runtime/src/lib/render/renderables/textSnapshotRenderable.ts`
  - Create: `packages/dom-webgl-runtime/src/lib/render/renderables/textSnapshotRenderable.test.ts`

  **Test first:** Test text snapshot renderable uses role `content`, captures text content from the target element, and dispose is idempotent.

  **Implementation:** Implement text snapshot renderable with text metadata and shared renderable lifecycle.

  **Verification command:** `npm test -- --run packages/dom-webgl-runtime/src/lib/render/renderables/textSnapshotRenderable.test.ts`

  **Completion condition:** Text snapshot renderable is separate from element surface renderable.

  **Execution record:**
  - Files changed: `packages/dom-webgl-runtime/src/lib/render/renderables/textSnapshotRenderable.ts`; `packages/dom-webgl-runtime/src/lib/render/renderables/textSnapshotRenderable.test.ts`
  - Commands run: `npm test -- --run packages/dom-webgl-runtime/src/lib/render/renderables/textSnapshotRenderable.test.ts`; `npm test -- --run packages/dom-webgl-runtime/src/lib/render/renderables/elementSnapshotRenderable.test.ts packages/dom-webgl-runtime/src/lib/render/renderables/textSnapshotRenderable.test.ts`; `npm run typecheck -w @project/dom-webgl-runtime`; `git diff --check`
  - Test results: targeted test passed after implementation; nearby element snapshot + text snapshot tests passed; package typecheck passed; diff check passed.
  - Review results: spec review passed; code quality review found one minor test-strength issue, fixed by updating the dispose test to assert previously captured text is cleared.

- [x] **Task 18: Image Renderable**

  **Goal:** Add image renderable backed by resource manager.

  **Files:**
  - Create: `packages/dom-webgl-runtime/src/lib/render/renderables/imageRenderable.ts`
  - Create: `packages/dom-webgl-runtime/src/lib/render/renderables/imageRenderable.test.ts`

  **Test first:** Test image renderable uses role `media`, acquires image resource through resource manager, and failed resource keeps fallback visible in state.

  **Implementation:** Implement image renderable lifecycle with resource acquisition; do not issue duplicate fetches for DOM image elements.

  **Verification command:** `npm test -- --run packages/dom-webgl-runtime/src/lib/render/renderables/imageRenderable.test.ts`

  **Completion condition:** Image renderable reports loading/ready/error through resource status.

  **Execution record:**
  - Files changed: `packages/dom-webgl-runtime/src/lib/render/renderables/imageRenderable.ts`; `packages/dom-webgl-runtime/src/lib/render/renderables/imageRenderable.test.ts`
  - Commands run: `npx vitest packages/dom-webgl-runtime/src/lib/render/renderables/imageRenderable.test.ts --run`; `npm test -- --run packages/dom-webgl-runtime/src/lib/render/renderables/imageRenderable.test.ts`; `npm test -- --run packages/dom-webgl-runtime/src/lib/render/renderables/imageRenderable.test.ts packages/dom-webgl-runtime/src/lib/resources/resourceManager.test.ts`; `npm run typecheck --workspace @project/dom-webgl-runtime`
  - Test results: targeted image renderable test passed after implementation; resource manager + image renderable nearby tests passed; package typecheck passed.
  - Review results: spec review passed; code quality review found no issues.

- [x] **Task 19: Video Renderable**

  **Goal:** Add video renderable backed by resource manager.

  **Files:**
  - Create: `packages/dom-webgl-runtime/src/lib/render/renderables/videoRenderable.ts`
  - Create: `packages/dom-webgl-runtime/src/lib/render/renderables/videoRenderable.test.ts`

  **Test first:** Test video renderable uses role `media`, adopts existing video element resource, and inactive/dispose path pauses or releases video references.

  **Implementation:** Implement video renderable lifecycle with adopted media resource; keep autoplay policy handling out of Phase 1 beyond explicit state.

  **Verification command:** `npm test -- --run packages/dom-webgl-runtime/src/lib/render/renderables/videoRenderable.test.ts`

  **Completion condition:** Video renderable uses shared lifecycle and releases references on dispose.

  **Execution record:**
  - Files changed: `packages/dom-webgl-runtime/src/lib/render/renderables/videoRenderable.ts`; `packages/dom-webgl-runtime/src/lib/render/renderables/videoRenderable.test.ts`
  - Commands run: `npm test -- --run packages/dom-webgl-runtime/src/lib/render/renderables/videoRenderable.test.ts`; `npm test -- --run packages/dom-webgl-runtime/src/lib/render/renderables/videoRenderable.test.ts packages/dom-webgl-runtime/src/lib/resources/resourceManager.test.ts`; `npm run typecheck`; `git diff --check`
  - Test results: targeted video renderable test passed after implementation and after review fixes; resource manager + video renderable nearby tests passed; typecheck and diff check passed in implementer verification.
  - Review results: spec review passed; code quality review found an important production video error handling gap, fixed by making the adopted DOM video loader reject on existing or emitted media errors while keeping fallback visible.

- [x] **Task 20: GLB Model Renderable**

  **Goal:** Add GLB model renderable with minimal loader boundary.

  **Files:**
  - Create: `packages/dom-webgl-runtime/src/lib/render/renderables/modelRenderable.ts`
  - Create: `packages/dom-webgl-runtime/src/lib/render/renderables/modelRenderable.test.ts`

  **Test first:** Test model renderable uses role `model`, requests a `model/glb` resource, and loader failure sets status `error` while fallback remains visible.

  **Implementation:** Implement model renderable with a loader adapter boundary; use Three.js GLTFLoader behind the adapter; defer custom resolvers and complex asset dependency handling.

  **Verification command:** `npm test -- --run packages/dom-webgl-runtime/src/lib/render/renderables/modelRenderable.test.ts`

  **Completion condition:** GLB renderable exists, is ordered as `model`, and has visible error state.

  **Execution record:**
  - Files changed: `packages/dom-webgl-runtime/src/lib/render/renderables/modelRenderable.ts`; `packages/dom-webgl-runtime/src/lib/render/renderables/modelRenderable.test.ts`; `packages/dom-webgl-runtime/src/lib/resources/resourceManager.ts`
  - Commands run: `npm test -- --run packages/dom-webgl-runtime/src/lib/render/renderables/modelRenderable.test.ts`; `npm test -- --run packages/dom-webgl-runtime/src/lib/resources/resourceManager.test.ts`; `npm test -- --run packages/dom-webgl-runtime/src/lib/render/renderable.test.ts packages/dom-webgl-runtime/src/lib/render/renderables/elementSnapshotRenderable.test.ts packages/dom-webgl-runtime/src/lib/render/renderables/textSnapshotRenderable.test.ts packages/dom-webgl-runtime/src/lib/render/renderables/imageRenderable.test.ts packages/dom-webgl-runtime/src/lib/render/renderables/videoRenderable.test.ts packages/dom-webgl-runtime/src/lib/render/renderables/modelRenderable.test.ts packages/dom-webgl-runtime/src/lib/resources/resourceManager.test.ts`; `npm run typecheck --workspace @project/dom-webgl-runtime`
  - Test results: targeted model renderable test passed after implementation and after the `model/glb` resource-kind fix; resource manager tests passed; M7 renderables + resource manager suite passed; package typecheck passed.
  - Review results: initial spec review found model resources were recorded as `model` instead of `model/glb`; fixed by adding an internal `WebGLResourceKind` mapping. Spec re-review passed. Final M8 review later found the default GLB path still used a missing-adapter fallback, so a runtime pipeline regression test was added and the default adapter now dynamically imports Three.js `GLTFLoader` only during model loading.

- [x] **Task 21: Renderable Factory**

  **Goal:** Compile descriptors into concrete renderables.

  **Files:**
  - Create: `packages/dom-webgl-runtime/src/lib/render/renderableFactory.ts`
  - Create: `packages/dom-webgl-runtime/src/lib/render/renderableFactory.test.ts`

  **Test first:** Test each source descriptor kind creates the expected renderable type; unsupported descriptor kind throws a visible runtime error.

  **Implementation:** Implement `createRenderable(targetDescriptor, sourceDescriptor, role, policy, context)`.

  **Verification command:** `npm test -- --run packages/dom-webgl-runtime/src/lib/render/renderableFactory.test.ts`

  **Completion condition:** The pipeline can produce renderables without demo-specific logic.

  **Execution record:**
  - Files changed: `packages/dom-webgl-runtime/src/lib/render/renderableFactory.ts`; `packages/dom-webgl-runtime/src/lib/render/renderableFactory.test.ts`; `packages/dom-webgl-runtime/src/lib/render/renderables/textSnapshotRenderable.ts`; `packages/dom-webgl-runtime/src/lib/render/renderables/textSnapshotRenderable.test.ts`; `packages/dom-webgl-runtime/src/lib/render/renderables/imageRenderable.ts`; `packages/dom-webgl-runtime/src/lib/render/renderables/imageRenderable.test.ts`; `packages/dom-webgl-runtime/src/lib/render/renderables/videoRenderable.ts`; `packages/dom-webgl-runtime/src/lib/render/renderables/videoRenderable.test.ts`; `packages/dom-webgl-runtime/src/lib/render/renderables/modelRenderable.ts`; `packages/dom-webgl-runtime/src/lib/render/renderables/modelRenderable.test.ts`
  - Commands run: `npm test -- --run packages/dom-webgl-runtime/src/lib/render/renderableFactory.test.ts`; `npm test -- --run packages/dom-webgl-runtime/src/lib/render/renderableFactory.test.ts packages/dom-webgl-runtime/src/lib/render/renderables/textSnapshotRenderable.test.ts packages/dom-webgl-runtime/src/lib/render/renderables/imageRenderable.test.ts packages/dom-webgl-runtime/src/lib/render/renderables/videoRenderable.test.ts packages/dom-webgl-runtime/src/lib/render/renderables/modelRenderable.test.ts`; `npm test -- --run packages/dom-webgl-runtime/src/lib/render/renderable.test.ts packages/dom-webgl-runtime/src/lib/render/renderableFactory.test.ts packages/dom-webgl-runtime/src/lib/render/renderables/elementSnapshotRenderable.test.ts packages/dom-webgl-runtime/src/lib/render/renderables/textSnapshotRenderable.test.ts packages/dom-webgl-runtime/src/lib/render/renderables/imageRenderable.test.ts packages/dom-webgl-runtime/src/lib/render/renderables/videoRenderable.test.ts packages/dom-webgl-runtime/src/lib/render/renderables/modelRenderable.test.ts packages/dom-webgl-runtime/src/lib/resources/resourceManager.test.ts`; `npm run typecheck --workspace @project/dom-webgl-runtime`
  - Test results: targeted factory test passed after implementation and after role/policy preservation fixes; concrete renderable tests passed after preserving upstream role/policy; M7 renderables + resource manager suite passed; package typecheck passed.
  - Review results: spec review passed; code quality review found that factory tests were blessing hidden role inference and missed unsupported snapshot/model branches. Fixed by preserving provided role/policy in concrete renderables, adding an explicit overlay preservation test, and adding unsupported snapshot mode/model format tests. Re-review found no issues.

---

## M8: Single Renderer

- [x] **Task 22: Runtime Creation Is SSR-Safe**

  **Goal:** Ensure imports are SSR-safe and browser work is execution-only.

  **Files:**
  - Create: `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`
  - Create: `packages/dom-webgl-runtime/src/lib/renderer/runtime.test.ts`
  - Modify: `packages/dom-webgl-runtime/src/index.ts`

  **Test first:** Test importing public runtime APIs in a node-like environment does not access `window` or `document`; test executing browser-only runtime creation without a DOM throws a clear error.

  **Implementation:** Implement `createWebGLRuntime(options)` and defer all DOM/canvas/Three.js renderer work until client execution.

  **Verification command:** `npm test -- --run packages/dom-webgl-runtime/src/lib/renderer/runtime.test.ts`

  **Completion condition:** Package import is SSR-safe; client-only execution fails visibly outside browser.

  **Execution record:**
  - Files changed: `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`; `packages/dom-webgl-runtime/src/lib/renderer/runtime.test.ts`; `packages/dom-webgl-runtime/src/index.ts`
  - Commands run: `npm test -- --run packages/dom-webgl-runtime/src/lib/renderer/runtime.test.ts`; `npm run typecheck`
  - Test results: targeted runtime test failed first because `createWebGLRuntime` was not exported/implemented; after implementation, targeted runtime test passed with 3 tests. Root typecheck passed.
  - Review results: quality review found the no-canvas test only proved no appended canvas, not that detached canvas creation was avoided. Fixed by spying on `document.createElement` after creating the test container and asserting no `"canvas"` creation; reran targeted runtime test and root typecheck.
  - Notes: runtime creation now performs the DOM guard only when `createWebGLRuntime(options)` is called. Public import stays SSR-safe and does not create a canvas or instantiate Three.js renderer work at module import time.

- [x] **Task 23: Single Three.js Renderer**

  **Goal:** Create exactly one renderer/canvas per runtime instance.

  **Files:**
  - Create: `packages/dom-webgl-runtime/src/lib/renderer/threeRenderer.ts`
  - Create: `packages/dom-webgl-runtime/src/lib/renderer/threeRenderer.test.ts`
  - Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`

  **Test first:** Test runtime mount appends one canvas, repeated sync/register does not create additional canvases, and dispose removes canvas and releases renderables.

  **Implementation:** Implement `createThreeRendererHost(container)`; runtime owns one scene, one camera, one renderer, and one canvas.

  **Verification command:** `npm test -- --run packages/dom-webgl-runtime/src/lib/renderer/threeRenderer.test.ts`

  **Completion condition:** A runtime instance never creates multiple canvases.

  **Execution record:**
  - Files changed: `packages/dom-webgl-runtime/src/lib/renderer/threeRenderer.ts`; `packages/dom-webgl-runtime/src/lib/renderer/threeRenderer.test.ts`; `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`; `packages/dom-webgl-runtime/src/lib/renderer/runtime.test.ts`; `packages/dom-webgl-runtime/package.json`; `package-lock.json`
  - Commands run: `npm test -- --run packages/dom-webgl-runtime/src/lib/renderer/threeRenderer.test.ts`; `npm test -- --run packages/dom-webgl-runtime/src/lib/renderer/runtime.test.ts packages/dom-webgl-runtime/src/lib/renderer/threeRenderer.test.ts`; `npm test -- --run packages/dom-webgl-runtime/src/lib/types.test.ts`; `npm test -- --run`; `npm run typecheck`; `git diff --check`
  - Test results: targeted Task 23 test first failed because `./threeRenderer` did not exist. After the initial implementation, targeted Task 23 test passed with 3 tests and nearby Task 22+23 renderer tests passed with 6 tests. Spec review then found the default host used a no-op adapter instead of a real Three.js renderer. Added failing tests proving the default path constructs `WebGLRenderer`, `Scene`, and `PerspectiveCamera` through mocked Three modules, and proving injected object creation keeps jsdom tests GPU-free; those tests failed against the no-op adapter. After the real-renderer fix, targeted Task 23 test passed with 4 tests and nearby Task 22+23 renderer tests passed with 7 tests. Code quality review then found a full-suite public type regression: the first deep-import fix used a local `three-src.d.ts` sidecar that was brittle for public type compilation. With `@types/three` installed, kept SSR-safe `three/src/*` imports and removed the local sidecar declaration so public type tests use package-provided Three declarations. Final targeted host test passed with 4 tests; nearby runtime+host tests passed with 7 tests; public types test passed; full suite passed with 21 files / 67 tests; root typecheck passed; diff check passed.
  - Notes: `three` is a runtime dependency and `@types/three` is a runtime-package devDependency. `createThreeRendererHost(container)` now owns one canvas, a real default Three.js renderer adapter, one scene, and one perspective camera per host through SSR-safe direct Three.js module imports. Tests mock those direct modules or inject `createObjects` so no real GPU/WebGL context is required. Runtime creation still mounts exactly one host/canvas per runtime instance; repeated placeholder `registerTarget` and `sync` calls do not create extra canvases; `dispose()` is idempotent, removes the canvas, disposes the host renderer, and releases internally tracked renderables. No Three-specific types are exported from the public root API.

- [x] **Task 24: Runtime Pipeline Sync**

  **Goal:** Connect registry, source inference, role inference, policy, and renderable factory.

  **Files:**
  - Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`
  - Create: `packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts`

  **Test first:** Test registering an element produces one renderable; registering image/video/model declarations produces expected role counts; unregister disposes the matching renderable.

  **Implementation:** Implement runtime `registerTarget`, `unregisterTarget`, and `sync`; store renderables by target key; update debug state after sync.

  **Verification command:** `npm test -- --run packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts`

  **Completion condition:** The full Phase 1 compile pipeline works without React.

  **Execution record:**
  - Files changed: `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`; `packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts`; `packages/dom-webgl-runtime/src/lib/render/renderables/modelRenderable.ts`; `docs/IMPLEMENTATION_PLAN.md`
  - Commands run: `npm test -- --run packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts`; `npm test -- --run packages/dom-webgl-runtime/src/lib/render/renderables/modelRenderable.test.ts packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts`; `npm test -- --run packages/dom-webgl-runtime/src/lib/renderer/runtime.test.ts packages/dom-webgl-runtime/src/lib/renderer/threeRenderer.test.ts packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts`; `npm test -- --run packages/dom-webgl-runtime/src/lib/dom/registry.test.ts packages/dom-webgl-runtime/src/lib/source/inferSource.test.ts packages/dom-webgl-runtime/src/lib/render/renderRole.test.ts packages/dom-webgl-runtime/src/lib/render/renderPolicy.test.ts packages/dom-webgl-runtime/src/lib/render/renderableFactory.test.ts`; `npm run typecheck`; `git diff --check`
  - Test results: Task 24 test was written first and failed RED with three expected missing-behavior failures: `sync()` created no renderable, image/video/model role counts were empty, and `runtime.unregisterTarget` did not exist. After the minimal runtime pipeline implementation, targeted Task 24 test passed with 3 tests, nearby renderer runtime tests passed with 3 files / 10 tests, previous registry/source/role/policy/factory pipeline tests passed with 5 files / 27 tests, root typecheck passed, and diff check passed. Final M8 review then found public model sync without an injected loader failed; the added regression failed RED with the missing-adapter error, then passed after the default dynamic GLTFLoader adapter fix.
  - Review results: final M8 code review found one Important issue: public runtime model declarations could fail because tests only covered internally injected `loadModel`. Fixed by adding the default GLB loader path while keeping it execution-time and SSR-safe.
  - Notes: Runtime now owns a target registry and resource manager, returns `TargetDescriptor` from `registerTarget`, stores created renderables by target key, creates renderables on `sync()` through source inference, role inference, render policy compilation, and the existing renderable factory, and disposes the matching renderable once on `unregisterTarget(key)`. `sync()` updates current renderables and returns a simple promise only when renderable updates are async. The implementation remains non-React, preserves one renderer host/canvas per runtime, dynamically imports the GLTFLoader only when a model renderable loads, and does not expose Three policy fields or full debug state.

---

## M9: Frame Input, Page Scroll, Pointer State

- [x] **Task 25: Basic Page Scroll State**

  **Goal:** Provide page scroll mode for frame input.

  **Files:**
  - Create: `packages/dom-webgl-runtime/src/lib/input/pageScroll.ts`
  - Create: `packages/dom-webgl-runtime/src/lib/input/pageScroll.test.ts`

  **Test first:** Test default scroll mode is `page`, page progress clamps from `0` to `1`, and direction/velocity update from scroll deltas.

  **Implementation:** Implement `createPageScrollState(getScrollMetrics)`; do not implement gate mode behavior.

  **Verification command:** `npm test -- --run packages/dom-webgl-runtime/src/lib/input/pageScroll.test.ts`

  **Completion condition:** Frame input can report page scroll only.

  **Execution record:**
  - Files changed: `packages/dom-webgl-runtime/src/lib/input/pageScroll.ts`; `packages/dom-webgl-runtime/src/lib/input/pageScroll.test.ts`
  - Commands run: `npm test -- --run packages/dom-webgl-runtime/src/lib/input/pageScroll.test.ts`; `npm run typecheck`
  - Test results: targeted page scroll test failed RED because `./pageScroll` did not exist, then passed with 2 tests after implementation; root typecheck passed.
  - Review results: spec review passed; code quality review passed with one non-blocking suggestion to add a future no-scrollable-range test. No gate mode, scroll lock, `sceneProgress`, reverse gate, scene-gated scroll, or React work was introduced.

- [x] **Task 26: Pointer Move/Click/Drag State**

  **Goal:** Normalize pointer state in one runtime-owned controller.

  **Files:**
  - Create: `packages/dom-webgl-runtime/src/lib/input/pointerController.ts`
  - Create: `packages/dom-webgl-runtime/src/lib/input/pointerController.test.ts`

  **Test first:** Test pointer move updates x/y and normalized coordinates, pointer down/up records click count, and drag starts after down + movement and reports drag deltas.

  **Implementation:** Implement `createPointerController(targetElement)` with centralized listeners, `getState()`, and `dispose()`.

  **Verification command:** `npm test -- --run packages/dom-webgl-runtime/src/lib/input/pointerController.test.ts`

  **Completion condition:** Pointer state is centralized and frame-readable.

  **Execution record:**
  - Files changed: `packages/dom-webgl-runtime/src/lib/input/pointerController.ts`; `packages/dom-webgl-runtime/src/lib/input/pointerController.test.ts`
  - Commands run: `npm test -- --run packages/dom-webgl-runtime/src/lib/input/pointerController.test.ts`; `npm run typecheck`; `git diff --check`
  - Test results: targeted pointer controller test failed RED because `./pointerController` did not exist, then passed after implementation. Code review regressions for stale drag state and mutable `getState()` snapshots failed RED, then passed with 6 tests after fixes. Root typecheck and diff check passed in implementation verification.
  - Review results: spec review passed; code quality review found stale `isDragging` after pointer up and externally mutable state snapshots. Fixed by clearing `isDragging` on `pointerup`, returning a shallow state snapshot from `getState()`, and adding regression tests. Re-review passed.
  - Scope notes: implemented runtime-owned pointer event listeners on the target element only; no runtime, frame input, debug state, React, renderable-level, or Task 27+ files were changed.

- [x] **Task 27: Shared WebGLFrameInput**

  **Goal:** Compose time, delta, scroll, and pointer into one frame input.

  **Files:**
  - Create: `packages/dom-webgl-runtime/src/lib/input/frameInput.ts`
  - Create: `packages/dom-webgl-runtime/src/lib/input/frameInput.test.ts`
  - Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`

  **Test first:** Test frame input includes monotonic time/delta, page scroll state, and pointer state.

  **Implementation:** Implement `createFrameInputSource(scrollState, pointerController, clock)`; runtime passes frame input to renderables on update.

  **Verification command:** `npm test -- --run packages/dom-webgl-runtime/src/lib/input/frameInput.test.ts`

  **Completion condition:** Renderables receive one normalized frame input.

  **Execution record:**
  - Files changed: `packages/dom-webgl-runtime/src/lib/input/frameInput.ts`; `packages/dom-webgl-runtime/src/lib/input/frameInput.test.ts`; `packages/dom-webgl-runtime/src/lib/render/renderable.ts`; `packages/dom-webgl-runtime/src/lib/render/renderable.test.ts`; `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`; `packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts`
  - Commands run: `npm test -- --run packages/dom-webgl-runtime/src/lib/input/frameInput.test.ts`; `npm test -- --run packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts`; `npm test -- --run packages/dom-webgl-runtime/src/lib/input/frameInput.test.ts packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts packages/dom-webgl-runtime/src/lib/render/renderable.test.ts`; `npm run typecheck`; `git diff --check`; `npm test -- --run`
  - Test results: targeted frame input test failed RED because `./frameInput` did not exist, then passed after implementation. Code quality review regression for mutable frame snapshots failed RED, then passed after defensive-copy fixes. Final nearby frame input + runtime pipeline + renderable tests passed with 3 files / 9 tests; implementation verification also ran the full suite with 25 files / 81 tests.
  - Review results: spec review passed; code quality review found frame input snapshots could be mutated by renderables and leak into later reads. Fixed by copying scroll/pointer into internal state and returning defensive frame snapshots while preserving runtime's one shared input per `sync()` call. Re-review passed.
  - Scope notes: implemented the shared frame input source and runtime handoff only; no effect consumers, scene animation, scene gate progress, debug state, React changes, Task 28, or Task 29 work was added.

---

## M10: Debug State

- [x] **Task 28: Lightweight Debug State**

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

  **Execution record:**
  - Files changed: `packages/dom-webgl-runtime/src/lib/debug/debugState.ts`; `packages/dom-webgl-runtime/src/lib/debug/debugState.test.ts`; `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`; `packages/dom-webgl-runtime/src/index.ts`; `docs/IMPLEMENTATION_PLAN.md`; `docs/EXECUTION_STATE.md`
  - Commands run: `npm test -- --run packages/dom-webgl-runtime/src/lib/debug/debugState.test.ts`; `npm test -- --run packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts`; `npm run typecheck`; `npm test -- --run packages/dom-webgl-runtime/src/lib/renderer/runtime.test.ts packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts packages/dom-webgl-runtime/src/lib/renderer/threeRenderer.test.ts packages/dom-webgl-runtime/src/lib/debug/debugState.test.ts`; `npm test -- --run packages/dom-webgl-runtime/src/lib/input/pageScroll.test.ts packages/dom-webgl-runtime/src/lib/input/pointerController.test.ts packages/dom-webgl-runtime/src/lib/input/frameInput.test.ts packages/dom-webgl-runtime/src/lib/debug/debugState.test.ts`; `npm test -- --run`; `git diff --check`
  - Test results: targeted debug state test failed RED because `./debugState` did not exist, then passed after implementation. Code quality review regressions for disposed debug snapshots, async error notification, pending `loading` status, and sync error notification failed RED, then passed after fixes. Final debug state test passed with 7 tests; nearby renderer/debug suite passed with 4 files / 19 tests; M9/M10 input/debug suite passed with 4 files / 17 tests; full suite passed with 26 files / 89 tests; root typecheck and diff check passed.
  - Review results: spec review passed; code quality review found missing final empty debug snapshot on dispose, missing error notification on failed updates, and missing pending `loading` status. Fixed with lightweight runtime debug bookkeeping and regression tests. Final re-review passed.
  - Scope notes: implemented lightweight debug snapshots, runtime `getDebugState()`, and optional `onDebugStateChange` only. No devtools layer, performance budgets, viewport lifecycle ranges, React adapter, Task 29 work, or Three.js render-order/depth policy fields were added.

---

## M11: React Adapter

- [x] **Task 29: React Runtime Context**

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

  **Execution record:**
  - Files changed: `packages/dom-webgl-runtime/src/lib/react/runtimeContext.tsx`; `packages/dom-webgl-runtime/src/lib/react/useWebGLRuntime.ts`; `packages/dom-webgl-runtime/src/lib/react/useWebGLRuntime.test.tsx`; `packages/dom-webgl-runtime/src/react.ts`
  - Commands run: `npm test -- --run packages/dom-webgl-runtime/src/lib/react/useWebGLRuntime.test.tsx`; `npm test -- --run packages/dom-webgl-runtime/src/lib/react/useWebGLRuntime.test.tsx`; `npm run typecheck`; `git diff --check`
  - Test results: targeted React runtime hook test failed first because `@project/dom-webgl-runtime/react` did not export the provider or hook, then passed with 1 file / 2 tests after the minimal context implementation; root typecheck passed; diff check passed.
  - Review results: not run.

- [x] **Task 30: React WebGLRuntime Component**

  **Goal:** Mount runtime behind a client boundary.

  **Files:**
  - Create: `packages/dom-webgl-runtime/src/lib/react/WebGLRuntime.tsx`
  - Create: `packages/dom-webgl-runtime/src/lib/react/WebGLRuntime.test.tsx`
  - Modify: `packages/dom-webgl-runtime/src/react.ts`

  **Test first:** Test component creates runtime after mount, disposes runtime on unmount, and renders children inside provider.

  **Implementation:** Implement `WebGLRuntime` component with runtime events; avoid browser work at module import time.

  **Verification command:** `npm test -- --run packages/dom-webgl-runtime/src/lib/react/WebGLRuntime.test.tsx`

  **Completion condition:** React runtime component owns runtime lifecycle and is SSR-safe at import time.

  **Execution record:**
  - Files changed: `packages/dom-webgl-runtime/src/lib/react/WebGLRuntime.tsx`; `packages/dom-webgl-runtime/src/lib/react/WebGLRuntime.test.tsx`; `packages/dom-webgl-runtime/src/react.ts`
  - Commands run: `npm test -- --run packages/dom-webgl-runtime/src/lib/react/WebGLRuntime.test.tsx`; `npm run typecheck`; `git diff --check`
  - Test results: targeted React runtime component test failed RED because `WebGLRuntime` was not exported/implemented, then passed with 1 file / 4 tests after the minimal component implementation; root typecheck passed; diff check passed.
  - Review results: not run.

- [x] **Task 31: React WebGLTarget Component**

  **Goal:** Register DOM targets from React refs.

  **Files:**
  - Create: `packages/dom-webgl-runtime/src/lib/react/WebGLTarget.tsx`
  - Create: `packages/dom-webgl-runtime/src/lib/react/WebGLTarget.test.tsx`
  - Modify: `packages/dom-webgl-runtime/src/react.ts`

  **Test first:** Test `WebGLTarget` renders the requested `as` element, registers on mount with `webgl` declaration, unregisters on unmount, and does not expose internal runtime modules.

  **Implementation:** Implement polymorphic `WebGLTarget`; register using runtime context and DOM ref; keep declaration grouped under `webgl`.

  **Verification command:** `npm test -- --run packages/dom-webgl-runtime/src/lib/react/WebGLTarget.test.tsx`

  **Completion condition:** React target maps ordinary DOM to runtime declarations.

  **Execution record:**
  - Files changed: `packages/dom-webgl-runtime/src/lib/react/WebGLTarget.tsx`; `packages/dom-webgl-runtime/src/lib/react/WebGLTarget.test.tsx`; `packages/dom-webgl-runtime/src/react.ts`
  - Commands run: `npm test -- --run packages/dom-webgl-runtime/src/lib/react/WebGLTarget.test.tsx`; `npm run typecheck`; `git diff --check`
  - Test results: targeted React target test failed RED because `WebGLTarget` was not exported/implemented, then passed with 1 file / 3 tests after the minimal component implementation; root typecheck passed after narrowing the test fixture to standard DOM props; diff check passed.
  - Review results: not run.

---

## M12: Demo

- [x] **Task 32: Demo Uses Public API Only**

  **Goal:** Enforce app/package boundary.

  **Files:**
  - Create: `scripts/assert-demo-public-imports.mjs`
  - Create: `apps/demo/src/demo-import-boundary.test.ts`
  - Modify: `package.json`

  **Test first:** Test fails if `apps/demo` imports `packages/dom-webgl-runtime/src/lib/*`; test allows only `@project/dom-webgl-runtime` and `@project/dom-webgl-runtime/react`.

  **Implementation:** Implement static import scanner for `apps/demo/src/**/*`; add root script `check:imports`.

  **Verification command:** `npm test -- --run apps/demo/src/demo-import-boundary.test.ts && npm run check:imports`

  **Completion condition:** Demo cannot consume runtime internals.

  **Execution record:**
  - Files changed: `scripts/assert-demo-public-imports.mjs`; `apps/demo/src/demo-import-boundary.test.ts`; `package.json`
  - Commands run: `npm test -- --run apps/demo/src/demo-import-boundary.test.ts`; `npm run check:imports`
  - Test results: targeted import-boundary test failed RED because the scanner was unimplemented, then failed RED on missing side-effect import parsing and on test-file scanning, then passed GREEN with 3 tests after the scanner covered public imports, runtime source-path escapes, and ignored colocated `*.test.*` files. `npm run check:imports` initially failed because the scanner counted the test fixture itself, then passed after excluding test files. Follow-up review found bypasses via `packages/dom-webgl-runtime/src/index`, `src/react`, and CommonJS `require(...)`; regression tests were added first, then the scanner was tightened from `src/lib/**` to all `packages/dom-webgl-runtime/src/**` source-path imports and expanded to parse `require(...)`.
  - Review results: spec review passed. Code quality review found real public-boundary bypasses through workspace `src` entry files, matching relative escapes, and CommonJS `require(...)`; fixed with additional red tests and a narrower allowlist that only permits `@project/dom-webgl-runtime` and `@project/dom-webgl-runtime/react`.

- [x] **Task 33: Demo DOM Scene**

  **Goal:** Build a demo scene that declares Phase 1 targets.

  **Files:**
  - Modify: `apps/demo/src/App.tsx`
  - Modify: `apps/demo/src/demo.css`
  - Create: `apps/demo/src/App.test.tsx`

  **Test first:** Test demo renders `WebGLRuntime`, an element snapshot target, text target, image target, video target, and GLB model target, all through `webgl` declarations.

  **Implementation:** Use `WebGLRuntime` and `WebGLTarget`; import only from `@project/dom-webgl-runtime/react`.

  **Verification command:** `npm test -- --run apps/demo/src/App.test.tsx && npm run check:imports`

  **Completion condition:** Demo exercises every Phase 1 source category through public React API.

  **Execution record:**
  - Files changed: `apps/demo/src/App.tsx`; `apps/demo/src/demo.css`; `apps/demo/src/App.test.tsx`
  - Commands run: `npm test -- --run apps/demo/src/App.test.tsx`; `npm run check:imports`
  - Test results: the new scene test failed RED because `App` did not use the public React runtime entrypoint yet, then failed again because the test was not flushing React work, then failed on the existing classic JSX runtime requirement (`React is not defined`). After importing `React` explicitly in `App.tsx`, wrapping render/unmount in `act`, and setting `IS_REACT_ACT_ENVIRONMENT`, the targeted test passed GREEN with 1 test and `npm run check:imports` stayed green with no warnings.
  - Review results: no separate review run yet; Task 34 final review will cover the integrated M12 demo surface.

- [x] **Task 34: Demo Debug Panel**

  **Goal:** Show lightweight debug state in the demo.

  **Files:**
  - Create: `apps/demo/src/debugPanel.tsx`
  - Modify: `apps/demo/src/App.tsx`
  - Create: `apps/demo/src/debugPanel.test.tsx`

  **Test first:** Test debug panel renders target count, renderable count, scroll mode, and pointer coordinates; test panel accepts `WebGLDebugState` from the public package type.

  **Implementation:** Render a compact debug panel from runtime debug state; keep UI operational rather than marketing-oriented.

  **Verification command:** `npm test -- --run apps/demo/src/debugPanel.test.tsx && npm run typecheck`

  **Completion condition:** Demo exposes debug state without internal imports.

  **Execution record:**
  - Files changed: `apps/demo/src/debugPanel.tsx`; `apps/demo/src/debugPanel.test.tsx`; `apps/demo/src/App.tsx`; `apps/demo/src/demo.css`; `apps/demo/src/demo-import-boundary.test.ts`; `apps/demo/src/App.test.tsx`; `tsconfig.base.json`
  - Commands run: `npm test -- --run apps/demo/src/debugPanel.test.tsx`; `npm test -- --run apps/demo/src/demo-import-boundary.test.ts apps/demo/src/App.test.tsx apps/demo/src/debugPanel.test.tsx packages/dom-webgl-runtime/src/lib/react/useWebGLRuntime.test.tsx packages/dom-webgl-runtime/src/lib/react/WebGLRuntime.test.tsx packages/dom-webgl-runtime/src/lib/react/WebGLTarget.test.tsx`; `npm run check:imports`; `npm run typecheck`; `git diff --check`
  - Test results: the new debug-panel test failed RED because `./debugPanel` did not exist, then passed GREEN after the minimal component implementation. Follow-up typecheck failed on test-only ReactNode typings and on importing the `.mjs` scanner helper from TypeScript tests. Those blocking M12 integration regressions were fixed by tightening test prop types, switching the boundary test to a typed dynamic import with an explicit `@ts-expect-error`, and broadening root tsconfig includes to `scripts/**/*.d.ts`. Final M12 demo tests (5 total), React adapter tests (10 total), `check:imports`, `typecheck`, and `git diff --check` all passed.
  - Review results: integrated code review found one blocking gap in Task 32 (`require(...)` was not scanned) and one stale-doc issue while Task 34 was in flight. The import-boundary gap was fixed and re-verified; the docs were already brought up to date in the same rollout. No Task 35/M13 work was started.

---

## M13: Final Verification

- [x] **Task 35: Public Export Contract**

  **Goal:** Verify all intended public exports exist and no internal exports leak.

  **Files:**
  - Modify: `packages/dom-webgl-runtime/src/index.ts`
  - Modify: `packages/dom-webgl-runtime/src/react.ts`
  - Create: `packages/dom-webgl-runtime/src/publicExports.test.ts`

  **Test first:** Test root export includes runtime APIs and public types; React export includes `WebGLRuntime`, `WebGLTarget`, and `useWebGLRuntime`; internal helpers are not exported from root.

  **Implementation:** Adjust public export files only.

  **Verification command:** `npm test -- --run packages/dom-webgl-runtime/src/publicExports.test.ts && npm run typecheck`

  **Completion condition:** Public API is small and matches Phase 1 scope.

  **Execution record:**
  - Files changed: `packages/dom-webgl-runtime/src/publicExports.test.ts`; `packages/dom-webgl-runtime/src/index.ts`; `packages/dom-webgl-runtime/src/lib/react/WebGLTarget.test.tsx`
  - Commands run: `npm test -- --run packages/dom-webgl-runtime/src/publicExports.test.ts && npm run typecheck`
  - Test results: the new public export test failed RED because the root entrypoint still exposed `createTargetRegistry` and `TargetDescriptor`. After removing those internal root re-exports, the targeted test passed, then `typecheck` exposed an old React adapter test that still imported `TargetDescriptor` from the root public entrypoint. That test was updated to import the internal stub type from the internal path, and the full Task 35 verification command passed.
  - Review results: not run. Scope stayed limited to public export contract testing, root export cleanup, and one test import correction required by the public contract.

- [x] **Task 36: Full Check**

  **Goal:** Run final project verification.

  **Files:**
  - No new files unless a verification failure exposes a missing test.

  **Test first:** This task is verification-only after all behavior tasks are complete.

  **Implementation:** Fix only failures discovered by verification; do not add scene-gated scroll or effect behavior while fixing.

  **Verification command:** `npm run test -- --run && npm run typecheck && npm run build && npm run check:imports && git diff --check`

  **Completion condition:** All commands pass; demo import boundary passes; runtime package builds; no second-stage scope slipped into Phase 1.

  **Execution record:**
  - Files changed: `docs/IMPLEMENTATION_PLAN.md`; `docs/EXECUTION_STATE.md`
  - Commands run: `npm run test -- --run && npm run typecheck && npm run build && npm run check:imports && git diff --check`
  - Test results: full verification passed with 33 Vitest files / 107 tests, root typecheck passed, workspace build passed, demo import boundary passed, and diff check passed.
  - Notes: This was a verification-only task; no runtime, React, demo behavior, scene-gated scroll, scroll lock, `sceneProgress`, effect registry, multiple canvas, or picking behavior was added.

- [x] **Task 37: Documentation Alignment**

  **Goal:** Ensure docs match the delivered Phase 1 behavior.

  **Files:**
  - Modify: `docs/00-goal.md` only if it needs a Phase 1 status note
  - Create or modify: `README.md`

  **Test first:** Add or update a documentation checklist in execution notes before editing docs.

  **Implementation:** Document setup commands, public API import paths, Phase 1 exclusions, and future status of scene-gated scroll and effects.

  **Verification command:** `npm run check && git diff --check`

  **Completion condition:** Documentation matches implemented Phase 1 scope and does not claim gated scroll or effects.

  **Execution record:**
  - Files changed: `README.md`; `docs/00-goal.md`; `docs/IMPLEMENTATION_PLAN.md`; `docs/EXECUTION_STATE.md`
  - Commands run: `npm run check && git diff --check`; `npm run check && git diff --check`
  - Test results: Task 37 used a documentation checklist recorded in `docs/EXECUTION_STATE.md` as the required test-first artifact. The verification command stayed green before and after the doc edits because runtime behavior was already verified in Task 36; the actual RED condition was documentation drift (`README.md` still pointed at Task 35/36 status and `docs/00-goal.md` lacked a Phase 1 status note).
  - Notes: Documentation now reflects the completed Phase 1 scope, the public import paths, setup/verification commands, and the explicit exclusion of scene-gated scroll and effect work from the delivered runtime.

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
