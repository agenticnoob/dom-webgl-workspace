# Execution State

## Current Status
Task 4 complete.

## Last Completed Task
Task 4: WebGLDeclaration Types.

## Completed Tasks
- Task 1: Root Workspace Skeleton.
- Task 2: Runtime Package Skeleton.
- Task 3: Demo Package Skeleton.
- Task 4: WebGLDeclaration Types.

## Current Task
None.

## Last Commands Run
- `npm test -- --run packages/dom-webgl-runtime/src/lib/types.test.ts` (initial test shape was invalid: passed because Vitest erased type-only imports)
- `npm test -- --run packages/dom-webgl-runtime/src/lib/types.test.ts` (red: failed because public WebGL declaration types were not exported)
- `npm test -- --run packages/dom-webgl-runtime/src/lib/types.test.ts` (green)
- `npm run typecheck` (green)
- `git diff --check` (green)

## Last Result
Targeted Task 4 verification passed: `packages/dom-webgl-runtime/src/lib/types.test.ts` ran with 1 passing test. `npm run typecheck` passed. `git diff --check` passed.

## Files Changed
- `packages/dom-webgl-runtime/src/lib/types.ts`
- `packages/dom-webgl-runtime/src/lib/types.test.ts`
- `packages/dom-webgl-runtime/src/index.ts`
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/EXECUTION_STATE.md`

## Known Issues
None.

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
Start Task 5: Frame, Pointer, Debug Types.
