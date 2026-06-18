# DOM WebGL Workspace

DOM-first interactive WebGL runtime workspace.

## Status

Phase 1 is complete through Task 37 in `docs/IMPLEMENTATION_PLAN.md`.
Phase 2 scene-gated scroll work is complete through Task 56 in
`docs/PHASE2_SCENE_GATE_PLAN.md`.
Phase 3 visible renderables are complete through Task 72 in
`docs/PHASE3_VISIBLE_RENDERABLE_PLAN.md`.
Phase 3.5 runtime performance and stage correction is implemented in
`docs/superpowers/plans/2026-06-18-phase-3-5-runtime-performance-and-stage.md`.
Phase 4 DOM style fidelity and responsive mapping is implemented in
`docs/superpowers/plans/2026-06-18-phase-4-dom-style-fidelity-responsive-mapping.md`.
Reusable architecture lessons from the sibling `codex-web` project are captured
in `docs/CODEX_WEB_REFERENCE_LEARNINGS.md`.

Project boundary:

- This workspace implements a reusable open-source DOM WebGL runtime.
- `apps/demo` is a public API consumer and validation surface, not a privileged
  runtime input.
- Runtime/package implementation code must not hardcode demo target keys, demo
  asset paths, demo DOM structure, demo layout, or demo copy.
- `packages/dom-webgl-runtime/src/open-source-boundary.test.ts` guards runtime
  source against demo-only literals.

Current demo behavior:

- React demo declares five base target categories through public APIs: element
  snapshot, text snapshot, image, video, and GLB model. It also includes a
  Phase 4 fidelity harness for rounded box paint, multiline text, object-fit
  media, and narrow viewport layout.
- The default demo does not enable scene gates, so normal page scrolling cannot
  be trapped by a demo gate lock. Scene-gate declarations remain covered by
  dedicated runtime, React adapter, and public type tests.
- Runtime registration, source inference, render role inference, renderable
  creation, resource lifecycle, debug state, page scroll state, scene gate state,
  scroll lock, and pointer state are wired.
- The runtime owns one renderer-driven frame loop through the renderer host;
  React creates and disposes the runtime but does not own an animation-frame
  sync loop.
- Element snapshots, text snapshots, images, videos, and GLB models now create
  runtime-owned visible scene objects in the single internal Three.js scene.
- The debug panel shows current scroll mode plus active gate key and
  `sceneProgress` while a gate is active.
- The runtime creates one Three.js renderer/canvas per runtime instance.
- Demo assets are loaded from `apps/demo/public`.

Current visual behavior:

- DOM-authored targets compile into source descriptors, render roles, internal
  render policy ordering, and runtime-owned scene objects.
- Unregistered DOM remains ordinary page DOM: it stays visible, keeps native
  interaction, and is not blocked by the transparent WebGL stage.
- DOM rects are measured in a batched runtime layout pass and projected into
  scene layout before renderables receive layout updates.
- The internal canvas is a fixed viewport WebGL stage layer, not document-flow
  content below the DOM scene or a layer constrained by the demo content width.
- The runtime inserts the fixed canvas as the first child of its container and
  leaves author DOM after it, so `hideWhenReady: false` and undeclared DOM can
  remain visually native without an extra global DOM layer.
- The canvas is explicitly stacked below author DOM (`z-index: 0` for the
  canvas, `z-index: 1` for direct DOM children) while remaining
  `pointer-events: none`, so native DOM can stay visually and interactively on
  top when it is not taken over by WebGL.
- Renderer viewport and orthographic camera sizing use the fixed canvas's actual
  rendered CSS box, so scrollbar gutters do not put DOM rects and WebGL
  projection in different coordinate spaces.
- Renderer defaults keep the stage transparent over the page background and cap
  device pixel ratio.
- Snapshot content rebuilds are driven by layout, size, DPR, content, and
  resource boundaries; computed CSS style is captured at initial renderable
  creation and later DOM CSS changes are intentionally not tracked.
- Text snapshots build their internal canvas from the measured DOM text box and
  computed text color/font/alignment so the WebGL plane does not stretch a
  fixed-size text texture.
- Element snapshots render a canvas-backed CSS box texture for supported common
  2D box paint: opacity, solid background color, solid borders, border radius,
  and one outer box shadow.
- Text snapshots consume the initial DOM style snapshot for box paint, font,
  color, line height, padding, alignment, and DPR-aware canvas sizing.
- Image and video renderables keep an initial border-box CSS backing plane, then
  place their media texture planes inside the CSS content box before applying
  common `object-fit` / `object-position` mapping.
- Renderer resize, DPR, and orthographic camera projection are cached and update
  on viewport changes without reconfiguring unchanged frames.
- Runtime invalidation observes target resize and viewport changes, then routes
  dirty keys to renderable content invalidation where needed.
- Target lifecycle state is reported separately from resource load status.
- Mapped targets default to WebGL visual replacement: after the matching scene
  object is visually ready, the target's fallback paint is hidden with
  `hideMode: "self"` unless lifecycle options opt out or request subtree hiding.
- Loading and error renderables keep fallback DOM visible.
- Unregistering a target or disposing the runtime restores fallback visibility.
- `hideMode: "subtree"` hides the target and descendants after readiness.
- `hideMode: "self"` hides only the target's own fallback paint while preserving
  child DOM visibility; nested managed WebGL targets keep their own fallback
  visibility state.
- Phase 2 includes scene-gated scroll, scroll lock, `sceneProgress`, and
  explicit reverse gate behavior.
- Effect registry, animation/effect layers, WebGL raycast picking, Lenis, GSAP,
  and ScrollTrigger adapters remain intentionally out of scope.
- The runtime keeps one WebGL canvas per runtime instance and does not expose
  Three.js `renderOrder`, `transparent`, or `depthWrite` in the public API.
- Phase 3.5 replaced the bridge sync with a renderer-owned loop, made the canvas
  a fixed transparent internal stage layer, added renderer performance defaults
  and a DPR cap, batched layout reads, and separated layout, content, resource,
  and lifecycle boundaries before effect or animation work starts.
- Phase 4 improves DOM-to-WebGL fidelity with a narrow performance-first slice:
  cached resize/DPR adaptation, geometry/layout alignment, initial style
  snapshots, canvas-backed CSS box snapshots for common 2D styles, object-fit
  mapping, and a responsive demo harness.

## Setup

```bash
npm install
```

Workspace checks:

```bash
npm run check
npm run build
npm run check:imports
```

Full verification:

```bash
npm run test -- --run
npm run typecheck
npm run build
npm run check:imports
git diff --check
```

## Demo

Run locally:

```bash
npm run dev -w @project/dom-webgl-demo
```

Run for LAN access:

```bash
npm run dev -w @project/dom-webgl-demo -- --host 0.0.0.0
```

Demo assets must exist at:

```txt
apps/demo/public/demo/image.png
apps/demo/public/demo/fidelity-cover.png
apps/demo/public/demo/video.mp4
apps/demo/public/models/hero.glb
```

The demo references them as:

```txt
/demo/image.png
/demo/fidelity-cover.png
/demo/video.mp4
/models/hero.glb
```

The GLB demo target hides its DOM fallback subtree after the model is ready. Runtime
model layout contains the loaded model bounds inside the target DOM rect with a
uniform XYZ scale so model depth is not flattened or stretched independently.
The demo also reserves a stable scrollbar gutter so DOM anchor rects do not
reflow horizontally while the runtime tracks page scroll.

## Public API Imports

Use only public package entrypoints:

```ts
import type { WebGLDeclaration, WebGLDebugState } from "@project/dom-webgl-runtime";
import {
  WebGLRuntime,
  WebGLTarget,
  useWebGLRuntime,
} from "@project/dom-webgl-runtime/react";
```

`apps/demo` must not import from `packages/dom-webgl-runtime/src/*`.

Runtime source must not import demo code or branch on demo-only keys/assets.
Demo-specific content belongs under `apps/demo` and should reach the package only
through public declarations.

## Lifecycle And Fallback Visibility

Targets may tune fallback hiding through the public lifecycle declaration:

```ts
type WebGLLifecycleDeclaration = {
  hideWhenReady?: boolean;
  hideMode?: "subtree" | "self";
};
```

Behavior:

- Registered WebGL targets default to `hideWhenReady: true` and
  `hideMode: "self"`.
- `hideWhenReady: false` opts out and leaves the DOM fallback visible.
- Visible fallback DOM remains in the author DOM after the canvas stage; this
  option is for native DOM visual/interaction ownership.
- Fallback hiding only happens after the WebGL scene object is ready and
  attached.
- Pending or failed image, video, model, element snapshot, and text snapshot
  renderables keep fallback DOM visible.
- `hideMode: "subtree"` hides the target subtree.
- `hideMode: "self"` preserves ordinary child DOM visibility for container
  targets without overriding nested WebGL targets that already own fallback
  visibility.
- Runtime disposal and target unregister restore previous fallback visibility.

## Scene Gates

Declare a scene gate through the same public `webgl` object used by regular
targets:

```tsx
<WebGLTarget
  as="section"
  webgl={{
    key: "demo.surface",
    scroll: {
      type: "gate",
      start: "top top",
      duration: 1,
      release: "both-directions-complete",
    },
  }}
/>
```

Gate behavior:

- `start` supports the Phase 2 geometry anchors covered by tests, including
  `top top`, `center center`, and `bottom bottom`.
- `duration` is a viewport-multiple scroll budget. With a 1000px viewport and
  `duration: 1`, a 250px wheel delta advances `sceneProgress` by `0.25`.
- While a gate is active, the runtime locks page scroll, consumes wheel/touch
  deltas, and emits frame input with `mode: "gate"`, `activeGateKey`, and
  `sceneProgress`.
- Completion releases scroll lock and returns to page scroll mode.
- `release: "forward-complete"` does not trap reverse scrolling.
- `release: "both-directions-complete"` supports reverse entry from below,
  starts at `sceneProgress: 1`, and releases backward at `sceneProgress: 0`.

The debug panel and public `WebGLDebugState` expose `currentScrollMode`,
`activeGateKey`, and `sceneProgress`. Gate-only fields are omitted in page mode.

## Verification

Common checks:

```bash
npm run check
npm run build
npm run check:imports
git diff --check
```

Current non-blocking build note: the demo production build emits Vite's default
chunk-size warning for the demo bundle. This is not a Phase 3 runtime failure.
