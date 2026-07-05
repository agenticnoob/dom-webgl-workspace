# Performance Profile Notes

## Runtime Performance Ownership V2

- Date: 2026-06-30T22:00:11+08:00
- Branch: `codex/runtime-performance-roadmap-implementation`
- Scenario set: idle page, scroll page, pinned section, image sequence, GLB model, current-app postprocess proxy, current-app plane-stack proxy
- Observed bottleneck: no single dominant bottleneck in the current example

## Decision

- Implemented ownership follow-up: split texture upload dirtiness from frame-only dirtiness, incremental material uniform updates, effect scheduling hints, renderer budget warnings, viewport-priority resource queueing, postprocess request/target-size warnings, shared plane geometry, and internal model animation scheduling.
- Deferred optimization: automatic batching/instancing.
- Reason: the current example still does not show draw calls dominating many compatible active planes. Texture uploads and DOM rect reads remain visible in several windows, while draw calls track active renderable count. Batching should stay gated until a dedicated stress profile proves draw calls dominate.

## Profiling Method

- Started the example with `npm run dev -w @project/dom-webgl-example -- --host 127.0.0.1`.
- Browser: Playwright CLI wrapper using headless Chromium at 1280x720.
- Runtime panel data came from `WebGLDebugPanel` text (`targetCount`, `renderableCount`, visible count).
- Browser instrumentation was injected before reload and counted:
  - `Element.prototype.getBoundingClientRect`
  - WebGL `drawArrays`, `drawElements`, and instanced draw variants
  - WebGL `texImage2D`, `texSubImage2D`, `texImage3D`, and `texSubImage3D`
  - WebGL `createTexture`, `createProgram`, and `createBuffer` as browser-level renderer resource proxies
  - Long Task entries when available
- Frame time used `requestAnimationFrame` deltas during each scenario window.

## Limitations

- The current `apps/example` uses descriptor-level pass postprocess in the
  managed stage dogfood, but does not include an effect-authored
  `ctx.runtime.postprocess.request(...)` scenario; the postprocess scenario
  below is a current-app proxy and records `activePostprocessRequests: 0`.
- The current `apps/example` does not include a dedicated many-plane stress fixture; the stress row below samples the existing top-of-page plane stack and records the largest visible compatible family proxy as `2`.
- Raw Three.js renderer info, render targets, composer passes, textures, and geometry objects remain internal by design. Renderer texture/program/buffer counts below are browser-level WebGL proxy counters, not exposed runtime API.
- Injected monkey patches can perturb timing; treat these numbers as local-dev directional evidence, not production profiler output.

## Scenario Notes

Window totals are counters accumulated during each sampling window. Per-frame values are normalized by the measured frame count for that same window.

| Scenario | Scroll position | Targets | Visible / renderables | Frames | Frame time avg / p95 / max | Draw calls total / frame | Texture uploads total / frame | DOM rect reads total / frame | Renderer proxy textures / programs / buffers | Active postprocess requests | Largest batch family | Long tasks | Notes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| idle page | 0 | 21 | 4 / 2 | 97 | 16.67 / 16.70 / 16.80 ms | 196 / 2.02 | 98 / 1.01 | 900 / 9.28 | 14 / 1 / 4 | 0 | n/a | 0 | Stable frame time; draw calls match visible renderables. |
| scroll page | 6651 | 21 | 5 / 5 | 96 | 16.84 / 16.80 / 33.30 ms | 417 / 4.34 | 95 / 0.99 | 1240 / 12.92 | 19 / 2 / 8 | 0 | n/a | 0 | Scroll window increases rect reads more than draw pressure. |
| pinned section | 18254 | 21 | 3 / 3 | 96 | 16.67 / 16.80 / 16.80 ms | 194 / 2.02 | 97 / 1.01 | 966 / 10.06 | 21 / 4 / 15 | 0 | n/a | 0 | Pinned section stays frame-stable. |
| image sequence | 12736 | 21 | 2 / 2 | 43 | 37.99 / 50.00 / 50.10 ms | 88 / 2.05 | 86 / 2.00 | 364 / 8.47 | 23 / 5 / 19 | 0 | n/a | 0 | Texture upload activity is the main visible counter in this window. |
| GLB model | 15820 | 21 | 2 / 2 | 97 | 16.66 / 16.70 / 16.80 ms | 196 / 2.02 | 98 / 1.01 | 898 / 9.26 | 23 / 5 / 19 | 0 | n/a | 0 | Model section stays frame-stable; no draw-call dominance. |
| postprocess active target proxy | 9127 | 21 | 5 / 5 | 39 | 41.45 / 50.10 / 83.30 ms | 200 / 5.13 | 144 / 3.69 | 460 / 11.79 | 29 / 6 / 19 | 0 | n/a | 1 | Historical proxy captured before the managed stage pass dogfood; this image hover-reveal area is not a true postprocess-active target. |
| many plane targets stress proxy | 0 | 21 | 2 / 2 | 96 | 16.67 / 16.70 / 16.80 ms | 194 / 2.02 | 97 / 1.01 | 900 / 9.38 | 31 / 7 / 19 | 0 | 2 | 0 | Existing page is not a many-plane stress fixture; batching remains unproven. |

## Resource Notes

- Browser resource entries: 250 total.
- Image sequence frame entries observed: 77.
- GLB entries observed: 1.
- Local-dev transfer size reported by Resource Timing: 10,994,800 bytes.

## Runtime Ownership Closeout

- Texture upload/frame dirtiness is now split: transform-only changes request a frame without forcing `texture.needsUpdate`.
- Runtime-owned material layer uniforms update in place for compatible primitive/vector/texture uniforms; shader material replacement is reserved for shader/program shape changes.
- Effects can declare `schedule: "static" | "reactive" | "frame"`; runtime no longer keeps static/reactive effect targets continuous when no dirty work exists.
- Renderer draw-call and texture-count stats feed budget warnings without exposing raw `renderer.info`.
- Resource loads remain queue-limited and now read viewport-priority context from the runtime.
- Named postprocess requests expose internal cost inspection and budget warnings for request count and render-target size.
- Plane renderables share one internal `PlaneGeometry(1, 1)` with ref-counted disposal.
- Model animation mixers are updated by the runtime only when an internal animated model shape is present and the target remains visible.

## React Doctor Hygiene Pass

- Date: 2026-07-01
- Scope: conservative internal cleanup only; no new profiling run and no public
  API change.
- Runtime package score moved from 52/100 to 87/100 after fixing safe findings:
  passive viewport scroll invalidation, one-pass debug/stage collection, and
  non-security cache-key naming for render/material reuse.
- Root workspace scan moved from 5 warnings to 4 warnings after removing the
  loop-await shape from bounded example image-sequence loading.
- Deferred findings are compatibility or architecture calls rather than runtime
  profile blockers: `useContext` remains for compatibility instead of
  React 19-only `use(...)`, `toSorted()` is not used while the workspace target
  is ES2022, the example `App` is not split solely to improve a heuristic score,
  and `WebGLRuntime` keeps latest-runtime dispose semantics.
- This pass does not change the previous batching decision: automatic
  batching/instancing remains profile-gated until a dedicated stress fixture or
  production-mobile profile proves draw calls dominate.

## Phase 7B Model Prepare Browser Check

- Date: 2026-07-06
- Branch: `codex/managed-render-roadmap-iteration`
- Scenario: `apps/example` managed model dogfood row, 1280x720 headless Chromium
  at device pixel ratio 2, local Vite dev server.
- Debug state result: `example.managedModel.sprint` reached
  `resourceStatus: "ready"`, `activeClips: ["MainSkeleton.001"]`, and
  `prepare.renderWarmup: "complete"` with no `MainSkeleton.001` missing-clip
  diagnostic.
- Pixel result: cropped model viewport contained 84,655 non-background pixels
  and 233 changed pixels across screenshots separated by 700 ms.
- Scroll-entry trace result: 2.69 s scripted scroll-entry window had no
  multi-second main-thread task; longest main-thread task in the marked window
  was 308.51 ms.
- Interpretation: Phase 7B removes the obvious first-visible model stall for
  the current dogfood row. The remaining sub-second tasks should be treated as
  local-dev profile evidence, not a production-mobile budget.

## Verification

- `npm run test -- --run`: passed (91 files / 541 tests).
- `npm run typecheck`: passed.
- `npm run build`: passed; existing Vite chunk-size warning only.
- `npm run check:imports`: passed (`Example import boundary OK`).
- `git diff --check`: passed.
