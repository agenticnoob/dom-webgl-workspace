# Phase 2 Scene Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add scene-gated scroll to the Phase 1 DOM-first runtime, including scroll lock, `sceneProgress`, and explicit reverse gate behavior.

**Architecture:** Scene gates live in the runtime input layer and feed the existing `WebGLFrameInput` path. The DOM remains the authoring model, renderables remain consumers of frame input, and the runtime keeps one Three.js renderer/canvas. No effect system, third-party scroll adapter, WebGL picking, or Three.js low-level public render flags are introduced in Phase 2.

**Tech Stack:** npm workspaces, TypeScript, Vitest, jsdom, React, Vite, Three.js.

---

## Baseline Before Planning

Run on 2026-06-17 before writing this plan:

- `npm run test -- --run`: passed, 33 files / 107 tests.
- `npm run typecheck`: passed.
- `npm run build`: passed. Existing Vite chunk-size warning remains non-blocking.
- `npm run check:imports`: passed, demo import boundary OK.
- `git diff --check`: passed.

No Phase 1 regression blocks Phase 2 planning.

## Hard Scope Rules

Allowed in Phase 2:

- Scene-gated scroll.
- Scroll lock while a gate is active.
- `sceneProgress` in frame/debug state.
- Explicit reverse gate behavior.

Still forbidden:

- Effect registry.
- Animation/effect layer.
- Lenis / GSAP ScrollTrigger adapter.
- WebGL raycast picking.
- Multiple canvas.
- Public Three.js `renderOrder`, `transparent`, or `depthWrite`.
- Demo imports from runtime internals.

## Phase 2 Behavior Contract

- Page scroll mode keeps existing Phase 1 behavior.
- A gate declaration is authored through `WebGLDeclaration.scroll`.
- Forward entry starts a gate at `sceneProgress: 0`; forward scroll delta advances it toward `1`.
- Completion at `1` releases the scroll lock and returns to page scroll.
- Reverse entry is deliberate:
  - `release: "forward-complete"` does not trap reverse scrolling.
  - `release: "both-directions-complete"` may enter from below at `sceneProgress: 1`, then reverse delta drives toward `0` and releases backward.
- `duration` is interpreted as a viewport-multiple scroll budget. With viewport height `1000` and duration `1`, a wheel delta of `250` advances progress by `0.25`.
- The runtime must always release scroll lock on completion, active gate unregister, runtime disposal, route/runtime unmount, document visibility hidden, or fatal runtime update error.

## File Map

Public contract:

- Modify: `packages/dom-webgl-runtime/src/lib/types.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/types.test.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/runtime-state.test.ts`
- Modify: `packages/dom-webgl-runtime/src/publicExports.test.ts`

Input layer:

- Create: `packages/dom-webgl-runtime/src/lib/input/scrollDeclaration.ts`
- Create: `packages/dom-webgl-runtime/src/lib/input/scrollDeclaration.test.ts`
- Create: `packages/dom-webgl-runtime/src/lib/input/sceneGate.ts`
- Create: `packages/dom-webgl-runtime/src/lib/input/sceneGate.test.ts`
- Create: `packages/dom-webgl-runtime/src/lib/input/scrollDelta.ts`
- Create: `packages/dom-webgl-runtime/src/lib/input/scrollDelta.test.ts`
- Create: `packages/dom-webgl-runtime/src/lib/input/scrollLock.ts`
- Create: `packages/dom-webgl-runtime/src/lib/input/scrollLock.test.ts`
- Create: `packages/dom-webgl-runtime/src/lib/input/scrollController.ts`
- Create: `packages/dom-webgl-runtime/src/lib/input/scrollController.test.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/input/pageScroll.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/input/pageScroll.test.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/input/frameInput.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/input/frameInput.test.ts`

Runtime and debug:

- Modify: `packages/dom-webgl-runtime/src/lib/dom/targetDescriptor.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/dom/targetDescriptor.test.ts`
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
- Check off tasks here as Phase 2 progresses: `docs/PHASE2_SCENE_GATE_PLAN.md`
- Do not reopen `docs/IMPLEMENTATION_PLAN.md`; it is the completed Phase 1 plan.
- Final Phase 2 docs task updates `README.md` if behavior is implemented.

---

## Tasks

- [x] **Task 38: Public Scene Gate Types**

  **Goal:** Expand the public scroll/frame/debug type contract for Phase 2 without adding runtime behavior.

  **Files:**
  - Modify: `packages/dom-webgl-runtime/src/lib/types.ts`
  - Modify: `packages/dom-webgl-runtime/src/lib/types.test.ts`
  - Modify: `packages/dom-webgl-runtime/src/lib/runtime-state.test.ts`
  - Modify: `packages/dom-webgl-runtime/src/publicExports.test.ts`

  **Test first:** Add type-level tests that accept `{ scroll: { type: "gate", start: "top top", duration: 1, release: "both-directions-complete" } }`, accept gate-mode `WebGLFrameInput.scroll` with `sceneProgress` and `activeGateKey`, accept debug state with `currentScrollMode: "gate"`, and still reject `renderOrder`, `transparent`, `depthWrite`, `effect`, or `effects`.

  **Implementation:** Add `WebGLGateScrollBehavior`, extend `WebGLScrollBehavior`, change `WebGLFrameInput["scroll"]` into a page/gate union, and add optional `activeGateKey` and `sceneProgress` to `WebGLDebugState`.

  **Verification command:** `npm test -- --run packages/dom-webgl-runtime/src/lib/types.test.ts packages/dom-webgl-runtime/src/lib/runtime-state.test.ts packages/dom-webgl-runtime/src/publicExports.test.ts && npm run typecheck`

  **Completion condition:** Public types describe scene gates and gate frame state, while the public API still exposes no effect or Three.js policy fields.

- [x] **Task 39: Scroll Declaration Normalization**

  **Goal:** Normalize and validate page/gate scroll declarations at the target descriptor boundary.

  **Files:**
  - Create: `packages/dom-webgl-runtime/src/lib/input/scrollDeclaration.ts`
  - Create: `packages/dom-webgl-runtime/src/lib/input/scrollDeclaration.test.ts`
  - Modify: `packages/dom-webgl-runtime/src/lib/dom/targetDescriptor.ts`
  - Modify: `packages/dom-webgl-runtime/src/lib/dom/targetDescriptor.test.ts`

  **Test first:** Test that omitted scroll normalizes to `{ type: "page" }`; explicit page stays page; gate declarations trim `start`, preserve positive `duration`, default omitted `release` to `"forward-complete"`, and reject blank `start`, non-positive `duration`, and unknown `release`.

  **Implementation:** Implement `normalizeScrollBehavior(declaration.scroll)` and call it from `createTargetDescriptor`; keep pointer and lifecycle defaulting unchanged.

  **Verification command:** `npm test -- --run packages/dom-webgl-runtime/src/lib/input/scrollDeclaration.test.ts packages/dom-webgl-runtime/src/lib/dom/targetDescriptor.test.ts && npm run typecheck`

  **Completion condition:** Registered targets carry a validated scroll declaration, and invalid gate declarations fail before runtime scroll state is created.

- [x] **Task 40: Scene Gate Start Matching**

  **Goal:** Add a pure gate start matcher for DOM anchor geometry.

  **Files:**
  - Create: `packages/dom-webgl-runtime/src/lib/input/sceneGate.ts`
  - Create: `packages/dom-webgl-runtime/src/lib/input/sceneGate.test.ts`

  **Test first:** Test `top top`, `center center`, and `bottom bottom` start strings against injected element rects and viewport height; test unsupported start strings throw a clear error; test forward crossing and reverse crossing are reported separately.

  **Implementation:** Add parser and helpers that compute anchor and viewport lines from `DOMRect`-like input. Keep this module pure and independent from event listeners, renderables, React, and Three.js.

  **Verification command:** `npm test -- --run packages/dom-webgl-runtime/src/lib/input/sceneGate.test.ts`

  **Completion condition:** Gate activation can be tested from geometry and direction without touching browser scroll events.

- [x] **Task 41: Forward Gate Progress State**

  **Goal:** Implement the pure forward scene gate state machine.

  **Files:**
  - Modify: `packages/dom-webgl-runtime/src/lib/input/sceneGate.ts`
  - Modify: `packages/dom-webgl-runtime/src/lib/input/sceneGate.test.ts`

  **Test first:** Test that forward entry starts at `sceneProgress: 0`, positive delta advances by `deltaY / (duration * viewportHeight)`, progress clamps to `1`, and reaching `1` returns a release decision.

  **Implementation:** Add `createSceneGateStateMachine()` or equivalent pure helper that accepts gate metadata, viewport height, and scroll delta. Return explicit states for inactive, active gate, and released.

  **Verification command:** `npm test -- --run packages/dom-webgl-runtime/src/lib/input/sceneGate.test.ts`

  **Completion condition:** Forward gate progress works without scroll lock, DOM event listeners, runtime wiring, or animation/effect code.

- [x] **Task 42: Reverse Gate Behavior**

  **Goal:** Make reverse direction behavior explicit and covered by tests.

  **Files:**
  - Modify: `packages/dom-webgl-runtime/src/lib/input/sceneGate.ts`
  - Modify: `packages/dom-webgl-runtime/src/lib/input/sceneGate.test.ts`

  **Test first:** Test that `release: "forward-complete"` does not lock reverse entry; test that `release: "both-directions-complete"` enters from below at `sceneProgress: 1`, negative delta reduces progress, progress clamps to `0`, and reaching `0` returns a backward release decision.

  **Implementation:** Extend the pure state machine with entry direction and release policy handling. Do not infer reverse behavior from sign mistakes; make the branch explicit.

  **Verification command:** `npm test -- --run packages/dom-webgl-runtime/src/lib/input/sceneGate.test.ts`

  **Completion condition:** Reverse behavior is deterministic, policy-driven, and impossible to confuse with forward completion.

- [x] **Task 43: Scroll Delta Normalization**

  **Goal:** Normalize wheel and touch input into signed pixel-like scroll deltas.

  **Files:**
  - Create: `packages/dom-webgl-runtime/src/lib/input/scrollDelta.ts`
  - Create: `packages/dom-webgl-runtime/src/lib/input/scrollDelta.test.ts`

  **Test first:** Test wheel `deltaY` in pixel mode, line mode using a fixed line height, page mode using viewport height, and touch move deltas derived from the previous touch Y position.

  **Implementation:** Add pure helpers for wheel and touch delta extraction. Keep browser listener installation out of this task.

  **Verification command:** `npm test -- --run packages/dom-webgl-runtime/src/lib/input/scrollDelta.test.ts`

  **Completion condition:** Gate progress can consume normalized deltas consistently from wheel and touch inputs.

- [x] **Task 44: Scroll Lock Controller**

  **Goal:** Add an idempotent scroll lock side-effect boundary.

  **Files:**
  - Create: `packages/dom-webgl-runtime/src/lib/input/scrollLock.ts`
  - Create: `packages/dom-webgl-runtime/src/lib/input/scrollLock.test.ts`

  **Test first:** Test that locking stores and replaces the previous root overflow style, repeated `lock()` calls are idempotent, `unlock()` restores the previous style, and `dispose()` always unlocks.

  **Implementation:** Implement `createScrollLockController(rootElement)` with `lock`, `unlock`, `isLocked`, and `dispose`. Do not add wheel/touch listeners here.

  **Verification command:** `npm test -- --run packages/dom-webgl-runtime/src/lib/input/scrollLock.test.ts`

  **Completion condition:** Scroll lock is isolated, restorable, and safe to call from runtime cleanup paths.

- [x] **Task 45: Scene Gate Scroll Controller**

  **Goal:** Compose page scroll state, gate targets, pure gate progress, normalized deltas, and scroll lock behind one controller interface.

  **Files:**
  - Create: `packages/dom-webgl-runtime/src/lib/input/scrollController.ts`
  - Create: `packages/dom-webgl-runtime/src/lib/input/scrollController.test.ts`
  - Modify: `packages/dom-webgl-runtime/src/lib/input/pageScroll.ts`
  - Modify: `packages/dom-webgl-runtime/src/lib/input/pageScroll.test.ts`

  **Test first:** Test that the controller returns page mode with no active gate, enters gate mode when a gate target crosses its start, locks while active, updates `sceneProgress` after `consumeScrollDelta(deltaY)`, and unlocks when completion releases the gate.

  **Implementation:** Introduce a generic scroll-state controller type compatible with `createFrameInputSource`. Reuse the existing page scroll behavior for page mode, and layer scene gate state on top without changing renderables.

  **Verification command:** `npm test -- --run packages/dom-webgl-runtime/src/lib/input/pageScroll.test.ts packages/dom-webgl-runtime/src/lib/input/scrollController.test.ts`

  **Completion condition:** A non-DOM test can drive page mode and gate mode through one scroll controller.

- [ ] **Task 46: Browser Scroll Event Routing**

  **Goal:** Route browser wheel/touch input into the scene gate scroll controller and prevent page scroll only while a gate consumes the input.

  **Files:**
  - Modify: `packages/dom-webgl-runtime/src/lib/input/scrollController.ts`
  - Modify: `packages/dom-webgl-runtime/src/lib/input/scrollController.test.ts`
  - Modify: `packages/dom-webgl-runtime/src/lib/input/scrollDelta.ts`
  - Modify: `packages/dom-webgl-runtime/src/lib/input/scrollDelta.test.ts`

  **Test first:** Test that wheel events call `preventDefault()` only when the active gate consumes the delta; test that inactive page-mode wheel events are not prevented; test touch start/move drives the same controller path; test `dispose()` removes listeners and unlocks.

  **Implementation:** Add browser listener wiring with injected target element and lock controller. Use passive `false` only where prevention is required; keep all behavior inside runtime input modules.

  **Verification command:** `npm test -- --run packages/dom-webgl-runtime/src/lib/input/scrollDelta.test.ts packages/dom-webgl-runtime/src/lib/input/scrollController.test.ts && npm run typecheck`

  **Completion condition:** Runtime-owned input can gate wheel/touch scroll without Lenis, GSAP, or effect-layer code.

- [ ] **Task 47: Frame Input Carries Gate State**

  **Goal:** Ensure `WebGLFrameInput` snapshots preserve gate scroll fields immutably.

  **Files:**
  - Modify: `packages/dom-webgl-runtime/src/lib/input/frameInput.ts`
  - Modify: `packages/dom-webgl-runtime/src/lib/input/frameInput.test.ts`

  **Test first:** Test that a scroll controller returning gate mode produces frame input with `mode: "gate"`, `activeGateKey`, and `sceneProgress`; mutating the returned frame does not mutate later frames; page mode remains unchanged.

  **Implementation:** Adjust frame input cloning only if needed for the page/gate union. Keep one shared frame input per runtime `sync()`.

  **Verification command:** `npm test -- --run packages/dom-webgl-runtime/src/lib/input/frameInput.test.ts && npm run typecheck`

  **Completion condition:** Renderables can consume gate progress through the existing frame input contract.

- [ ] **Task 48: Runtime Registers Gate Targets**

  **Goal:** Wire gate declarations from target descriptors into the runtime scroll controller.

  **Files:**
  - Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`
  - Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts`
  - Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtime.test.ts`

  **Test first:** Test that registering a target with gate scroll passes the descriptor to the scroll controller, unregistering removes it, and a renderable update receives gate-mode frame input after the controller enters a gate.

  **Implementation:** Replace the default `createPageScrollState(...)` path with the Phase 2 scroll controller, while preserving internal test injection for custom scroll controllers.

  **Verification command:** `npm test -- --run packages/dom-webgl-runtime/src/lib/renderer/runtime.test.ts packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts packages/dom-webgl-runtime/src/lib/input/scrollController.test.ts && npm run typecheck`

  **Completion condition:** Gate configuration flows from public declarations into runtime frame input without changing renderable creation or renderer ownership.

- [ ] **Task 49: Debug State Reports Gate Mode**

  **Goal:** Expose active gate and progress through debug state.

  **Files:**
  - Modify: `packages/dom-webgl-runtime/src/lib/debug/debugState.ts`
  - Modify: `packages/dom-webgl-runtime/src/lib/debug/debugState.test.ts`
  - Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`
  - Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts`

  **Test first:** Test `createDebugState` includes `currentScrollMode: "gate"`, `activeGateKey`, and `sceneProgress` when frame input is gated, and omits gate-only fields in page mode.

  **Implementation:** Pass gate fields from `frameInput.scroll` into debug state. Do not expose effect or renderer internals.

  **Verification command:** `npm test -- --run packages/dom-webgl-runtime/src/lib/debug/debugState.test.ts packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts && npm run typecheck`

  **Completion condition:** Demo and tests can inspect gate state without importing internal scroll modules.

- [ ] **Task 50: Runtime Cleanup Releases Scroll Lock**

  **Goal:** Guarantee scroll lock release on active gate removal, visibility loss, runtime disposal, and fatal update errors.

  **Files:**
  - Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`
  - Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtime.test.ts`
  - Modify: `packages/dom-webgl-runtime/src/lib/input/scrollController.test.ts`

  **Test first:** Test runtime `dispose()` calls scroll controller cleanup and unlocks an active gate; test unregistering the active gate target releases the lock and returns to page mode; test `document.visibilityState === "hidden"` / `visibilitychange` releases the lock; test a renderable update error while a gate is active releases the lock before the error is rethrown; test cleanup is idempotent when unregister, visibility hidden, and runtime `dispose()` happen in any order.

  **Implementation:** Add a single idempotent cleanup/release path for active gate teardown, unregister, visibility hidden, runtime disposal, and error paths. Preserve existing debug error reporting.

  **Verification command:** `npm test -- --run packages/dom-webgl-runtime/src/lib/renderer/runtime.test.ts packages/dom-webgl-runtime/src/lib/input/scrollController.test.ts packages/dom-webgl-runtime/src/lib/debug/debugState.test.ts && npm run typecheck`

  **Completion condition:** Removing, hiding, failing, or unmounting a runtime with an active gate cannot leave the page locked, and repeated cleanup calls are harmless.

- [ ] **Task 51: React Gate Declaration Smoke**

  **Goal:** Verify React targets can author gate declarations through the public `webgl` prop.

  **Files:**
  - Modify: `packages/dom-webgl-runtime/src/lib/react/WebGLTarget.test.tsx`

  **Test first:** Add a React test rendering `WebGLTarget` with `webgl.scroll.type: "gate"` and assert the runtime receives the exact normalized gate declaration through public React APIs.

  **Implementation:** Only adjust React types or prop forwarding if the test exposes a gap. Do not add React-specific gate behavior.

  **Verification command:** `npm test -- --run packages/dom-webgl-runtime/src/lib/react/WebGLTarget.test.tsx && npm run typecheck`

  **Completion condition:** React remains a thin public adapter over the runtime declaration object.

- [ ] **Task 52: Demo Declares A Scene Gate**

  **Goal:** Add one demo gate target using only public package APIs.

  **Files:**
  - Modify: `apps/demo/src/App.tsx`
  - Modify: `apps/demo/src/App.test.tsx`
  - Verify: `apps/demo/src/demo-import-boundary.test.ts`

  **Test first:** Test the demo renders at least one target with `scroll.type: "gate"`, `start: "top top"`, positive `duration`, and a declared release policy; test the demo still imports only `@project/dom-webgl-runtime` and `@project/dom-webgl-runtime/react`.

  **Implementation:** Add a gate declaration to an existing demo section or target. Do not import runtime internals and do not add animation/effect code.

  **Verification command:** `npm test -- --run apps/demo/src/App.test.tsx apps/demo/src/demo-import-boundary.test.ts && npm run check:imports`

  **Completion condition:** The demo exercises scene-gated scroll declarations through the same public API a real app would use.

- [ ] **Task 53: Demo Debug Panel Shows Gate State**

  **Goal:** Surface gate mode and progress in the existing debug panel.

  **Files:**
  - Modify: `apps/demo/src/debugPanel.tsx`
  - Modify: `apps/demo/src/debugPanel.test.tsx`
  - Modify: `apps/demo/src/App.tsx` only if wiring is required

  **Test first:** Test the panel renders `currentScrollMode`, `activeGateKey` when present, and `sceneProgress` as a stable numeric value; test page mode does not render a stale active gate key.

  **Implementation:** Extend the debug panel rendering from public `WebGLDebugState` only.

  **Verification command:** `npm test -- --run apps/demo/src/debugPanel.test.tsx apps/demo/src/App.test.tsx && npm run typecheck`

  **Completion condition:** Gate state is inspectable in the demo without internal imports or marketing-style UI changes.

- [ ] **Task 54: SSR And Import Boundary Regression**

  **Goal:** Prove Phase 2 scroll modules do not break SSR-safe public imports or demo import boundaries.

  **Files:**
  - Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtime.test.ts`
  - Modify: `packages/dom-webgl-runtime/src/publicExports.test.ts`
  - Verify: `apps/demo/src/demo-import-boundary.test.ts`

  **Test first:** Add regression coverage that importing `@project/dom-webgl-runtime` and `@project/dom-webgl-runtime/react` does not touch `window`, `document`, canvas, or WebGL, even with gate types exported.

  **Implementation:** Move any browser-only scroll listener or lock creation behind runtime execution if tests expose import-time side effects.

  **Verification command:** `npm test -- --run packages/dom-webgl-runtime/src/lib/renderer/runtime.test.ts packages/dom-webgl-runtime/src/publicExports.test.ts apps/demo/src/demo-import-boundary.test.ts && npm run check:imports && npm run typecheck`

  **Completion condition:** Phase 2 keeps the Phase 1 SSR and public import guarantees.

- [ ] **Task 55: Phase 2 Full Verification**

  **Goal:** Run the complete project check after behavior tasks are complete.

  **Files:**
  - No source files unless verification exposes a bug.
  - Update: `docs/EXECUTION_STATE.md`
  - Check off completed tasks in: `docs/PHASE2_SCENE_GATE_PLAN.md`

  **Test first:** This is a verification-only task after Task 38 through Task 54 pass individually.

  **Implementation:** Fix only verification failures related to Phase 2 scene gate behavior. Do not add effect registry, animation/effect layer, third-party scroll adapters, WebGL picking, multiple canvas, or public Three.js render flags.

  **Verification command:** `npm run test -- --run && npm run typecheck && npm run build && npm run check:imports && git diff --check`

  **Completion condition:** Full verification passes and Phase 2 behavior remains within this plan's scope.

- [ ] **Task 56: Phase 2 Documentation Alignment**

  **Goal:** Align user-facing docs with the delivered Phase 2 scene gate behavior.

  **Files:**
  - Modify: `README.md`
  - Modify: `docs/00-goal.md` only if final behavior differs from the current Phase 2 milestone wording
  - Modify: `docs/EXECUTION_STATE.md`
  - Modify: `docs/PHASE2_SCENE_GATE_PLAN.md`

  **Test first:** Record a documentation checklist in `docs/EXECUTION_STATE.md` before editing docs, naming the implemented gate behavior and still-forbidden Phase 3 effect scope.

  **Implementation:** Document setup/verification commands, public gate declaration shape, debug state fields, reverse gate policy, and still-deferred effect/adapters/picking scope.

  **Verification command:** `npm run check && npm run build && npm run check:imports && git diff --check`

  **Completion condition:** Docs describe implemented Phase 2 behavior accurately and do not claim an effect layer, Lenis/GSAP adapter, picking, multiple canvas, or exposed Three.js render flags.

---

## Suggested Next Round

Start with Task 38 only. It is the smallest useful Phase 2 entry point and forces the public contract before any runtime behavior.

If Task 38 passes cleanly, the next tight TDD sequence is Task 39, Task 40, and Task 41. Stop after each task to update `docs/EXECUTION_STATE.md` and this plan checkbox before continuing.

Do not start Task 52 or demo work until Task 48 and Task 49 prove gate state reaches runtime frame input and debug state.
