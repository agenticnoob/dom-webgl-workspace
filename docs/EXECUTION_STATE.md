# Execution State

## Current Status
Task 35 complete. Public export contract is tightened; stop before Task 36 / Full Check.

## Last Completed Task
Task 35: Public Export Contract.

## Completed Tasks
- Task 1: Root Workspace Skeleton.
- Task 2: Runtime Package Skeleton.
- Task 3: Demo Package Skeleton.
- Task 4: WebGLDeclaration Types.
- Task 5: Frame, Pointer, Debug Types.
- Task 6: Target Descriptor Normalization.
- Task 7: Runtime Target Registry.
- Task 8: Source Descriptor Types.
- Task 9: DOM Source Inference.
- Task 10: Explicit Model Source.
- Task 11: renderRole Inference.
- Task 12: Render Policy Compilation.
- Task 13: Resource Record Lifecycle.
- Task 14: DOM-Native Resource Adoption.
- Task 15: Base Renderable Interface.
- Task 16: Element Snapshot Renderable.
- Task 17: Text Snapshot Renderable.
- Task 18: Image Renderable.
- Task 19: Video Renderable.
- Task 20: GLB Model Renderable.
- Task 21: Renderable Factory.
- Task 22: Runtime Creation Is SSR-Safe.
- Task 23: Single Three.js Renderer.
- Task 24: Runtime Pipeline Sync.
- Task 25: Basic Page Scroll State.
- Task 26: Pointer Move/Click/Drag State.
- Task 27: Shared WebGLFrameInput.
- Task 28: Lightweight Debug State.
- Task 29: React Runtime Context.
- Task 30: React WebGLRuntime Component.
- Task 31: React WebGLTarget Component.
- Task 32: Demo Uses Public API Only.
- Task 33: Demo DOM Scene.
- Task 34: Demo Debug Panel.
- Task 35: Public Export Contract.

## Current Task
None.

## Last Commands Run
- `npm test -- --run packages/dom-webgl-runtime/src/publicExports.test.ts && npm run typecheck` (red: root entrypoint still exposed `createTargetRegistry`; type fixture also showed `TargetDescriptor` was still importable from root)
- `npm test -- --run packages/dom-webgl-runtime/src/publicExports.test.ts && npm run typecheck` (partial green: public export test passed; typecheck failed because `WebGLTarget.test.tsx` still imported `TargetDescriptor` from root)
- `npm test -- --run packages/dom-webgl-runtime/src/publicExports.test.ts && npm run typecheck` (green: public export test passed with 3 tests; root typecheck passed)
- `git diff --check` (green)

## Last Result
Task 35 completed with strict TDD. Added `packages/dom-webgl-runtime/src/publicExports.test.ts` to verify the root public entrypoint exposes `createWebGLRuntime` and public runtime/types while hiding internal registry/descriptor exports, and to verify the React entrypoint exposes `WebGLRuntime`, `WebGLTarget`, and `useWebGLRuntime`. The new test failed first because root still exported `createTargetRegistry` and `TargetDescriptor`. The fix removed those root re-exports from `packages/dom-webgl-runtime/src/index.ts`. Root typecheck then exposed an old React adapter test importing `TargetDescriptor` from the public root, so that test now imports the internal stub type from the internal path. Final targeted Task 35 verification and `git diff --check` passed. Task 36 was not started.

## Files Changed
- `packages/dom-webgl-runtime/src/publicExports.test.ts`
- `packages/dom-webgl-runtime/src/index.ts`
- `packages/dom-webgl-runtime/src/lib/react/WebGLTarget.test.tsx`
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/EXECUTION_STATE.md`

## Known Issues
No Task 35 blocking issues are open based on current verification. Non-blocking review notes from M11 remain deferred: stronger no-DOM SSR import coverage for the React public entrypoint, and git history cannot independently prove test-first beyond the recorded red/green command logs.

## Important Constraints
- Do not implement scene-gated scroll.
- Do not implement scroll lock.
- Do not implement sceneProgress.
- Do not implement reverse gate behavior.
- Do not implement an effect registry.
- Do not create multiple WebGL canvases.
- Do not implement WebGL raycast picking.
- Do not add Lenis / GSAP ScrollTrigger adapters.
- Do not add class-based compatibility layer.
- Do not expose Three.js renderOrder, transparent, or depthWrite in the public API.
- Public package imports must be SSR-safe.
- apps/demo must import only public package APIs:
  - @project/dom-webgl-runtime
  - @project/dom-webgl-runtime/react

## Next Step
Start Task 36: Full Check.
