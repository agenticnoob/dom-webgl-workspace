# Performance Profile Notes

## Baseline
- Date: 2026-06-30T16:59:46+08:00
- Branch: codex/runtime-performance-roadmap-implementation
- Scenario: idle page, scroll page, pinned section, GLB model, image sequence
- Observed bottleneck: no dominant bottleneck

## Decision
- Implemented follow-up: Internal texture ownership now centralizes texture dirty state, source/size telemetry, dirty reasons, and on-demand frame wakeups for runtime-owned canvas/text/media/material-layer texture paths.
- Deferred optimization: Plane batching for same-source/same-material renderables.
- Reason: The profile showed low normalized draw-call volume, higher DOM rect read activity, texture-upload activity, and one scroll/long-task-heavy sample, so batching is not the next justified optimization. The implemented response is texture upload ownership and measurement, not a renderer rewrite.

## Texture Ownership Follow-Up

- Texture dirty writes now flow through an internal ownership helper for runtime-created canvas/text/media source textures and material-layer texture uniforms.
- `WebGLDebugState.warnings` can emit existing `performance-budget-exceeded` records with `target: "textureSize"` when internal texture telemetry exceeds `performanceBudget.maxTextureSize`.
- Texture invalidation outside the active sync pass wakes the existing on-demand renderer loop for one follow-up frame through the internal dirty-frame path.
- Public API is unchanged: no raw Three.js textures, texture lists, render targets, renderer info, batching API, WebGPU path, or multiple-canvas path were added.

## Profiling Method

- Started the example with `npm run dev -w @project/dom-webgl-example`.
- Browser: Playwright CLI wrapper using headless Chrome 149 at 1280x720.
- Runtime data came from the example `WebGLDebugPanel`, which receives `WebGLDebugState`.
- Browser instrumentation was injected before page load and counted:
  - `Element.prototype.getBoundingClientRect`
  - WebGL `drawArrays`, `drawElements`, and instanced draw variants
  - WebGL `texImage2D`, `texSubImage2D`, `texImage3D`, and `texSubImage3D`
  - Long Task entries, when available
- Frame time used `requestAnimationFrame` deltas during each scenario window.

## Limitations

- Chrome Performance panel / WebGL inspector UI was not available in this terminal subagent environment, so the profile used injected browser counters and Performance APIs instead.
- Exact Three.js `renderer.info.render.calls` is not exposed through the public runtime or debug panel. Draw calls below are from patched WebGL draw functions, so they are available as browser-level call counts rather than Three.js renderer-info values.
- Injected monkey-patch counters can perturb frame-time and long-task measurements; treat the numbers as directional local-dev evidence, not production profiler-grade data.
- `WebGLDebugState` contains target lifecycle states, but the rendered debug panel only exposes target count, renderable count, and visible target count. The table records active renderables as the debug panel's visible/renderable state proxy.
- Local dev server module loading contributes resource timing noise; resource timing is used only to identify loading pressure, not to compare production bundle cost.

## Scenario Notes

Window totals are counters accumulated during each sampling window. Per-frame values are normalized by the measured frame count for that same window.

| Scenario | Scroll position | Targets | Active renderables | Frames | Frame time avg / p95 / max | Draw calls total / frame | Texture uploads total / frame | DOM rect reads total / frame | Long tasks | Notes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| idle page | 0 | 21 | 4 visible / 4 renderables | 144 | 16.67 / 16.80 / 16.80 ms | 580 / 4.03 | 299 / 2.08 | 1337 / 9.28 | 0 | Idle page still rendered continuously during the sample window. |
| scroll page | 7102 | 21 | 4 visible / 4 renderables | 23 | 105.79 / 116.70 / 133.30 ms | 104 / 4.52 | 52 / 2.26 | 339 / 14.74 | 26 | Slowest sample; dominated by scroll/long-task behavior, not high draw-call volume. |
| image sequence | 12006 | 21 | 3 visible / 3 renderables | 167 | 16.77 / 16.70 / 33.30 ms | 504 / 3.02 | 239 / 1.43 | 1428 / 8.55 | 0 | Image sequence produced `texImage2D` and `texSubImage2D` activity while draw calls stayed near active-renderable count. |
| GLB model | 17335 | 21 | 4 visible / 4 renderables | 144 | 16.67 / 16.70 / 16.80 ms | 435 / 3.02 | 145 / 1.01 | 1461 / 10.15 | 0 | Model section stayed frame-stable; no evidence that model draw calls dominate. |
| pinned section | 19159 | 21 | 4 visible / 4 renderables | 156 | 16.67 / 16.80 / 16.80 ms | 471 / 3.02 | 157 / 1.01 | 1566 / 10.04 | 0 | Pinned text section stayed frame-stable; batching would not address the observed texture/measurement activity. |

## Resource Notes

- Browser resource entries: 250 total.
- Image sequence frame entries observed during the run: 79.
- GLB entries observed during the run: 1.
- Total local-dev transfer size reported by Resource Timing: 37,327,025 bytes.
- Slow resource entries were mostly Vite-served source modules plus large example media; this is not enough evidence to select resource loading over texture-refresh gating as the next runtime optimization.

## Batching Gate

Batching is not needed for this task. The profile does not show draw calls as the main bottleneck, and the active scene shape is not many same-source/same-material planes. A future batching plan should only be reopened if a profile shows many active compatible plane renderables and draw calls dominate over DOM measurement, texture upload, resource loading, and postprocess cost.

## Verification

- `npm run test -- --run`: passed (89 files / 509 tests).
- `npm run typecheck`: passed.
- `npm run build`: passed; existing Vite chunk-size warning only.
- `npm run check:imports`: passed (`Example import boundary OK`).
- `git diff --check`: passed.
