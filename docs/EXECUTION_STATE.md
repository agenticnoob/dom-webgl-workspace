# Execution State

## Current Status
Task 35 complete. Follow-up demo preview fixes and assets are staged for commit; stop before Task 36 / Full Check.

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
- `npm test -- --run apps/demo/src/main-entry-build.test.ts` (red: built demo bundle emitted an unbound `React.createElement` from the JSX entrypoint)
- `npm test -- --run apps/demo/src/main-entry-build.test.ts` (green after binding the React namespace in `apps/demo/src/main.tsx`)
- `npm run check` (green after fixing the new test type import)
- `npm test -- --run apps/demo/src/App.test.tsx` (red after updating expected image source to `/demo/image.png`, while implementation still used `/demo/image.jpg`)
- `npm test -- --run apps/demo/src/App.test.tsx && npm run check` (green after updating the demo image DOM src and WebGL source to `/demo/image.png`)

## Last Result
Follow-up demo preview fixes completed after Task 35. The browser runtime error `React is not defined` was reproduced with a new Vite-build regression test, then fixed by binding the React namespace in `apps/demo/src/main.tsx`. The user-provided demo assets were added under `apps/demo/public`, and the demo image target was updated from `/demo/image.jpg` to `/demo/image.png` with a red/green `App.test.tsx` update. A new README documents setup, LAN demo access, public API imports, demo asset paths, verification commands, and the current Phase 1 visual boundary: DOM targets are registered and resource lifecycle/debug state are wired, but visible Three.js image/video/model scene output is not yet implemented. Task 36 was not started.

## Files Changed
- `README.md`
- `apps/demo/public/demo/image.png`
- `apps/demo/public/demo/video.mp4`
- `apps/demo/public/models/hero.glb`
- `apps/demo/src/main.tsx`
- `apps/demo/src/main-entry-build.test.ts`
- `apps/demo/src/App.tsx`
- `apps/demo/src/App.test.tsx`
- `docs/EXECUTION_STATE.md`

## Known Issues
No blocking issues are open based on the latest targeted and root `npm run check` verification. Remaining scope boundary: the Phase 1 demo registers targets and loads resources, but does not yet render DOM snapshots, image/video planes, or GLB objects as visible Three.js scene content. Non-blocking review notes from M11 remain deferred: stronger no-DOM SSR import coverage for the React public entrypoint, and git history cannot independently prove test-first beyond the recorded red/green command logs.

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
