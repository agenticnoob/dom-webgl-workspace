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
Phase 4 has been narrowed to DOM layout/content mapping and responsive
projection in
`docs/superpowers/plans/2026-06-18-phase-4-dom-style-fidelity-responsive-mapping.md`;
the forward architecture is now DOM layout/content driven WebGL effects, not
general CSS-to-WebGL fidelity.
Phase 5 adds the first public minimum effect/material layer in
`docs/superpowers/plans/2026-06-19-phase-5-effect-material-layer.md`: declared
targets may opt into the built-in `solid` material and `pointer-tilt` motion
without exposing Three.js render flags or a custom effect registry.
Phase 6.1 in
`docs/superpowers/plans/2026-06-19-phase-6-modular-surface-materials.md`
modularizes that effect layer without changing public API or visible behavior;
it does not add the planned `surface` material yet.
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
  layout/content harness for transparent anchors, multiline text, object-fit
  media, narrow viewport layout, and a Phase 5 effect/material harness.
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
- DOM is the source for layout, content, accessibility, and interaction state.
  WebGL effects/materials are the source for final visual styling. The runtime
  should not try to clone all browser CSS into WebGL.
- Declared targets can opt into the first built-in effect/material declarations:
  `effects.material: { kind: "solid" }` and
  `effects.motion: { kind: "pointer-tilt" }`.
- Runtime CSS reads should stay limited to fields needed for layout/content
  mapping: rects, content boxes, padding when it affects placement, text metrics,
  media object-fit/object-position, visibility, and lifecycle state.
- Backgrounds, borders, radii, shadows, gradients, filters, decorative opacity,
  and other visual styling should be expressed by future effect/material
  declarations instead of treated as DOM visual truth.
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
- Runtime pointer input is captured from the document and normalized against the
  fixed viewport canvas, so shared pointer effects are not limited by the
  `WebGLRuntime` container's document-flow box.
- Renderer viewport and orthographic camera sizing use the fixed canvas's actual
  rendered CSS box, so scrollbar gutters do not put DOM rects and WebGL
  projection in different coordinate spaces.
- Renderer defaults keep the stage transparent over the page background and cap
  device pixel ratio.
- Snapshot content rebuilds are driven by layout, size, DPR, content, and
  resource boundaries. Computed-style capture is limited to placement-critical
  layout/content fields, not DOM visual paint cloning.
- Text snapshots build their internal canvas from the measured DOM text box and
  computed font, line height, padding, alignment, and DPR so the WebGL plane
  does not stretch a fixed-size text texture. DOM text color is not treated as
  WebGL material truth.
- Element snapshots are transparent DOM anchors for future effects/materials;
  they do not render CSS backgrounds, borders, radii, shadows, opacity, or
  transforms.
- Element snapshots with an explicit `solid` material are visibly WebGL-owned
  surfaces. The default element snapshot path remains a transparent layout
  anchor.
- `pointer-tilt` consumes the shared runtime pointer frame input and writes a
  small target rotation; it does not add DOM listeners or own pointer state.
- Text snapshots consume only the style information required to place and render
  text content, such as font, line height, padding, alignment, and DPR.
- Image and video renderables place their media texture planes inside the CSS
  content box before applying common `object-fit` / `object-position` mapping;
  they do not keep a CSS-painted backing plane.
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
- Phase 4 now keeps the foundation focused on cached resize/DPR adaptation,
  geometry/layout alignment, placement-only style snapshots, transparent DOM
  anchors, media content-box object-fit mapping, and a responsive demo harness.
  Do not expand this into full CSS fidelity; the next architecture step is an
  effect/material layer consuming DOM layout, content, scroll, pointer, and
  lifecycle state.
- Phase 5 starts that effect/material layer with two built-ins only. Custom
  effect registration, shader authoring, particles, public Three.js render
  flags, multiple canvases, raycast picking, and third-party scroll adapters
  remain out of scope.
- Phase 6.1 keeps Phase 5 behavior intact while splitting pure effect
  normalization, compatibility, target capability types, pointer motion, and
  Three.js element-plane adapters across explicit internal module boundaries.
  The `surface` material remains a planned Phase 6.2 addition, not current API.

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
apps/demo/public/demo/layout-cover.png
apps/demo/public/demo/video.mp4
apps/demo/public/models/hero.glb
```

The demo references them as:

```txt
/demo/image.png
/demo/layout-cover.png
/demo/video.mp4
/models/hero.glb
```

The GLB demo target hides its DOM fallback subtree after the model is ready. Runtime
model layout contains the loaded model bounds inside the target DOM rect with a
uniform XYZ scale so model depth is not flattened or stretched independently.
The default runtime scene includes a low-cost ambient plus directional light rig
so GLB/PBR materials are not rendered unlit by default.
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

Targets may opt into the first built-in effect/material declarations:

```ts
type WebGLEffectsDeclaration = {
  material?: { kind: "solid"; color?: number; opacity?: number };
  motion?: { kind: "pointer-tilt"; strength?: number; maxDegrees?: number };
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
