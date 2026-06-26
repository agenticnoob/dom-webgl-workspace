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
Phase 5 historically added the first public minimum effect/material declaration
shapes in `docs/superpowers/plans/2026-06-19-phase-5-effect-material-layer.md`;
those concrete package-owned effects are superseded by the Phase 8 package
boundary cleanup.
Phase 6.2 in
`docs/superpowers/plans/2026-06-19-phase-6-modular-surface-materials.md`
historically added a minimal `surface` material declaration on top of the
modular Phase 6.1 effect boundaries; it is now historical input, not a
package-provided concrete visual effect.
Phase 7 is implemented in
`docs/superpowers/plans/2026-06-19-phase-7-effect-runtime-primitives.md`:
it historically preserved the Phase 6 object-form declarations as compatibility
input while moving internal effect dispatch to registry primitives. Its built-in
plugin and public registry authoring model is superseded by Phase 8 and the
package boundary cleanup; the selected forward contract removes object-form
target effects and keeps only array-form effect declarations.
Phase 8 is implemented in
`docs/superpowers/plans/2026-06-19-phase-8-custom-effect-authoring-api.md`:
`defineWebGLEffect(...)` and runtime-level `effects` are the public authoring
API. Core registers no default visual effects, the package exports no concrete
effect implementations, and demo/example effects are consumer-owned code.
Unified source capability handles are implemented in
`docs/superpowers/plans/2026-06-21-unified-source-capability-handles.md`:
custom effects can now control runtime-owned output handles for
`snapshot/element`, `snapshot/text`, `image`, `video`, and `model/glb` without
mutating source DOM or reaching into renderer internals.
The visual capability API in
`docs/superpowers/plans/2026-06-26-visual-effect-capability-api.md` is
implemented: the same `defineWebGLEffect(...)` model now covers controlled
material layers, source texture uniforms, text/media shader inputs, GLB mesh
material handles, managed point layers, and named postprocess requests while
keeping renderer, scene, camera, composer, render targets, raw textures, and
raw materials internal.
Agent package onboarding starts at `docs/agent/package-onboarding.md`; agents
should read that file first when integrating the package from zero.
Detailed package usage rules live in `docs/agent/package-usage.md`.
React-only effect authoring examples live in `apps/example` and
`docs/examples/effect-authoring.md`; they are downstream consumer examples, not
runtime package exports.
Reusable architecture lessons from the sibling `codex-web` project are captured
in `docs/CODEX_WEB_REFERENCE_LEARNINGS.md`.

Project boundary:

- This workspace implements a reusable open-source DOM WebGL runtime.
- `apps/demo` is a public API consumer and validation surface, not a privileged
  runtime input.
- `apps/example` is a downstream consumer-style example for package usage and
  effect authoring. It must not import demo source code or runtime internals.
- Runtime/package implementation code must not hardcode demo target keys, demo
  asset paths, demo DOM structure, demo layout, or demo copy.
- `packages/dom-webgl-runtime/src/open-source-boundary.test.ts` guards runtime
  source against demo-only literals.

Current demo behavior:

- React demo declares five base target categories through public APIs: element
  snapshot, text snapshot, image, video, and GLB model. It also includes a
  layout/content harness for transparent anchors, multiline text, object-fit
  media, narrow viewport layout, a Phase 8 effect authoring harness, and extra
  scroll-event marker targets for testing effect behavior across longer page
  travel.
- The first scroll marker uses a demo-owned `ScrollZoomImage` component:
  `/demo/bg.png` is rendered as a full-bleed sticky image target, the demo's
  opt-in Lenis + GSAP ticker stack feeds normalized page progress through the
  local `useDemoSmoothScrollStack(...)` hook, and an overlaid gallery moves
  horizontally while its image and caption items are declared as WebGL targets.
  The demo owns the Lenis instance lifecycle, passes it to
  `createLenisGsapScrollStack(...)` with `manageLenis: false`, and keeps the
  optional adapter stack responsible only for runtime adapter subscriptions,
  GSAP ticker wiring, and ScrollTrigger updates.
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

Current example behavior:

- `apps/example` is a React-only Vite app that uses
  `@project/dom-webgl-runtime`, `@project/dom-webgl-runtime/react`, and the
  optional `@project/dom-webgl-scroll-adapters` package through public
  entrypoints only.
- The example registers a stable module-scope `exampleEffects` array and
  declares a full-width vertical catalog of targets across the public source
  kinds: `snapshot/element`, `snapshot/text`, `image`, `video`, and `model/glb`.
- The example page uses Chinese visible copy in reusable click-to-expand
  explanation overlays while keeping source kinds and effect kind identifiers in
  English as API data.
- The example is the dogfood surface for the high-level pinned scroll React
  adapter: ordinary pinned sections use `WebGLScrollRuntime`,
  `ScrollEffectSection`, stable `progressKey` data, and
  `ctx.progress.get(progressKey)` instead of manual per-scroll target mutation
  or scene gates. The current pinned example renders the visible
  `example.pinnedReveal` text effect and keeps the section background
  transparent so the WebGL canvas remains visible.
- Advanced examples can still pass a stable manual `scrollAdapter` when the app
  intentionally owns a third-party scroll lifecycle.
- The example effects are application-owned contract examples:
  `example.surfaceFill`, `example.surfacePulse`,
  `example.surfaceVideoBackground`, `example.surfaceGhostCursor`,
  `example.surfaceWaves`, `example.textWave`, `example.textReveal`,
  `example.imagePan`, `example.imageZoom`, `example.videoPlayback`,
  `example.videoDrift`, `example.modelSpin`, and `example.modelFloat`, plus the
  pinned-scroll `example.pinnedReveal`.
- In the current example, `example.surfaceFill` paints `/example/bg.png` onto
  the element snapshot surface without changing the target opacity, and
  `example.surfacePulse` draws the pulse on the surface layer without changing
  the target or DOM child opacity. The same `snapshot/element` surface bucket
  also includes `example.surfaceVideoBackground`, which draws `/example/bg.mp4`
  as a muted looping effect-owned background texture, plus ReactBits-inspired
  `example.surfaceGhostCursor` and `example.surfaceWaves` effects implemented
  through runtime effect handles rather than separate ReactBits canvases or
  renderers. Ghost Cursor dogfoods the public material layer API: no-pointer
  smoke stays nearly invisible on the dark stage, and the pointer only activates
  target-local emissive smoke around the cursor.
- Example static assets are copied into `apps/example/public`; the example does
  not rely on `apps/demo/public` being served at runtime.
- `docs/agent/effect-authoring-example-report.md` records friction found while
  using the public docs as a downstream consumer.

Current visual behavior:

- DOM-authored targets compile into source descriptors, render roles, internal
  render policy ordering, and runtime-owned scene objects.
- DOM is the source for layout, content, accessibility, and interaction state.
  WebGL effects/materials are the source for final visual styling. The runtime
  should not try to clone all browser CSS into WebGL.
- Declared targets can request ordered effect declarations such as
  `effects: [{ kind: "demo.surface" }, { kind: "demo.pointerTilt" }]` or a
  demo-local GLB stack such as `{ kind: "demo.glbRotate" }` plus
  `{ kind: "demo.glbVertexParticles" }`.
  Effects only run when the runtime receives matching definitions through
  runtime-level `effects`.
- The demo-local GLB vertex particle effect hides the original GLB meshes after
  sampling their vertices, renders only the point cloud, and uses pointer motion
  to scatter particles only after the pointer hits a particle-sized local radius,
  then springs them back to their source vertices. Pointer hits are mapped through
  the current model target layout, so scrolling or a non-centered model rect does
  not shift interaction toward the viewport center. The hit projection and
  horizontal scatter impulse also account for the model's current y-axis
  rotation, so interaction follows the visible rotating particle model.
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
- The canvas is explicitly stacked below the React-owned DOM content layer while
  remaining `pointer-events: none`, so native DOM can stay visually and
  interactively on top when it is not taken over by WebGL.
- The React runtime adapter owns the DOM content layer, so app children remain
  above the runtime canvas without app-authored `z-index` rules.
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
  computed font, line height, padding, alignment, letter spacing, word spacing,
  white-space handling, and DPR so the WebGL plane does not stretch a fixed-size
  text texture. DOM text color is not treated as WebGL material truth.
- Element snapshots are transparent DOM anchors for future effects/materials;
  they do not render CSS backgrounds, borders, radii, shadows, opacity, or
  transforms.
- Element snapshots remain transparent layout anchors unless an application or
  consumer-owned effect makes the target visibly WebGL-owned.
- The demo's local `demoSurfaceEffect` renders a WebGL-owned surface from
  declaration-owned opacity, and `demoPointerTiltEffect` consumes shared runtime
  pointer frame input. They are examples in `apps/demo`, not package exports.
- Text snapshots consume only the style information required to place and render
  text content, such as font, line height, padding, alignment, text spacing,
  white-space handling, and DPR.
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
  Viewport lifecycle disposal also restores fallback visibility before releasing
  a ready renderable, so targets that were hidden after WebGL readiness do not
  disappear when their offscreen renderable is unloaded.
- `hideMode: "subtree"` hides the target and descendants after readiness.
- `hideMode: "self"` hides only the target's own fallback paint while preserving
  child DOM visibility; nested managed WebGL targets keep their own fallback
  visibility state.
- WebGL-owned text should not sit behind a native semi-transparent DOM panel.
  For a WebGL-owned card or marker, make the parent an element snapshot surface
  target with `hideMode: "self"` and put `snapshot/text` on the actual
  text-bearing child element so the surface and text render in the same WebGL
  canvas ownership layer.
- Phase 2 includes scene-gated scroll, scroll lock, `sceneProgress`, and
  explicit reverse gate behavior.
- Concrete text animation effects, shader authoring APIs, core-provided
  particle systems, animation layers, and WebGL raycast picking remain
  intentionally out of scope. Third-party scroll integration now uses a small
  public `WebGLScrollAdapter` protocol in core plus the optional
  `@project/dom-webgl-scroll-adapters` package for Lenis, GSAP ticker, and
  ScrollTrigger glue. The optional scroll adapters package also exposes
  `@project/dom-webgl-scroll-adapters/react` for the recommended pinned scroll
  effect path, where `WebGLScrollRuntime` owns the progress store and
  `ScrollEffectSection` owns a bounded trigger instance. The lower-level
  `createLenisGsapScrollStack(...)` remains the advanced manual entry for apps
  that own third-party scroll lifecycle directly; omitting `scrollAdapter` still
  uses native browser scroll.
  Offscreen resource policy is target-scoped: active targets own renderables;
  near-offscreen parked targets pause effects and hide WebGL scene objects;
  far-offscreen targets restore native DOM fallback and dispose WebGL resources,
  and re-entry from disposal rebuilds from source while re-entry from park
  resumes existing renderables.
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
- Phase 5 historically started that effect/material layer with two built-in
  declarations. Phase 8 boundary cleanup supersedes package-owned concrete
  effects: applications now provide their own effect implementations.
  Shader authoring APIs, core-provided particle systems, public Three.js render
  flags, multiple canvases, and raycast picking remain out of core scope.
  Third-party scroll libraries integrate through `WebGLScrollAdapter` and the
  optional scroll adapters package, not through direct core dependencies. The
  recommended Lenis + GSAP ticker + ScrollTrigger route is the opt-in
  `createLenisGsapScrollStack(...)` stack; applications that create a Lenis
  instance should keep `manageLenis: false` and destroy Lenis from their own
  lifecycle cleanup.
- Phase 6.1/6.2 are now historical implementation phases. Their legacy
  `effects.material` / `effects.motion` declaration shapes no longer type-check
  or compile. Target effects use array-form declarations only.
- Phase 7's registry primitives remain internal dispatch machinery. Public
  authoring no longer uses `effectRegistry`, and package built-in plugins are
  not registered or exported.
- Phase 8 replaces the public registry mental model with
  `defineWebGLEffect(...)` plus runtime-level `effects`, stops registering
  default visual effects in core, and keeps concrete effect implementations out
  of the package.

### Effect model

Effects are user-authored runtime definitions. They receive the target source
handle, layout snapshot, frame input, pointer and scroll state, target controls
such as position/rotation/scale/opacity, and managed resources. They do not
scan DOM, mutate arbitrary DOM, create their own renderer, or own independent
asset loading.

The effect context exposes low-level runtime output handles for every supported
source kind. Consumers can draw to canvas-backed element surfaces, control
WebGL text layers and glyph layout, transform image/video texture planes,
control video playback, create controlled material layers over source textures,
read source-specific shader input metadata, inspect or manipulate GLB model
mesh handles, create managed point layers, and request named runtime-owned
postprocess passes through public effect context. Target `setPosition(...)`
writes runtime scene-space coordinates, not DOM `left`/`top`. Concrete effects
remain application-owned.

Capability matrix:

| Source | Public capability |
| --- | --- |
| `snapshot/element` | canvas surface drawing plus `createMaterialLayer(...)` over the source texture |
| `snapshot/text` | text/glyph controls, text shader inputs, and `createMaterialLayer(...)` over the text texture |
| `image` | object-fit aware texture controls, media shader inputs, and `createMaterialLayer(...)` |
| `video` | image capabilities plus playback controls |
| `model/glb` | controlled mesh handles, material restore, sampled vertices, managed point layers |
| runtime visual context | `ctx.visual.requestPostprocess(...)` for named bloom/grain/blur requests |

Runtime owns material, texture, geometry, render-target, postprocess, and
managed-object lifecycle. Effects update public handles/requests and register
their own cleanup through `ctx.resources`; they do not receive raw renderer,
scene, camera, `ShaderMaterial`, `Texture`, `EffectComposer`,
`WebGLRenderTarget`, render-loop, pass ordering, or renderer-state handles.

Source declarations keep media sources tied to their real DOM media element:
`{ kind: "image" }` is for actual `<img>` targets, and `{ kind: "video" }` is
for actual `<video>` targets. Non-media elements should use `snapshot`,
`snapshot/text`, or `model/glb`; explicitly declaring `image` or `video` on a
non-media element throws instead of falling back to a snapshot.

Preferred declaration form:

```ts
effects: [
  { kind: "app.surface", opacity: 0.75 },
  { kind: "app.pointerTilt", strength: 0.6, maxDegrees: 6 },
]
```

This array form is the target effects contract. Do not use legacy object-form
declarations such as `effects.material` or `effects.motion` in new code.

Matching effect definitions are supplied to the runtime:

```ts
import { createWebGLRuntime, defineWebGLEffect } from "@project/dom-webgl-runtime";

const appSurfaceEffect = defineWebGLEffect({
  kind: "app.surface",
  source: "snapshot/element",
  update(context, _state, params) {
    context.target?.setVisible(true);
    context.target?.setOpacity(params.opacity ?? 1);
  },
});

const appPointerTiltEffect = defineWebGLEffect({
  kind: "app.pointerTilt",
  update(context, _state, params) {
    const maxDegrees = params.maxDegrees ?? 6;
    const radians = (maxDegrees * Math.PI) / 180;

    context.target?.setRotation(
      -context.pointer.normalizedY * radians,
      context.pointer.normalizedX * radians * (params.strength ?? 1),
    );
  },
});

createWebGLRuntime({
  container,
  effects: [appSurfaceEffect, appPointerTiltEffect],
});
```

React target declarations are registration-time static. Keep a given
`WebGLTarget` key's `webgl` declaration stable after mount; do not dynamically
change `source`, `effects`, `scroll`, `pointer`, or `lifecycle` under the same
key. When a target needs a different declaration, use a different key or remount
that target.

Application effects use the same API:

```ts
import { defineWebGLEffect } from "@project/dom-webgl-runtime";

const modelProbeEffect = defineWebGLEffect({
  kind: "modelProbe",
  source: "model/glb",
  update(context) {
    context.source.model.sampleVertices({ maxPoints: 256 });
    context.target?.setPosition(
      context.layout.left + context.layout.width / 2,
      context.layout.viewport.height - (context.layout.top + context.layout.height / 2),
      0,
    );
    context.target?.setRotation(0, context.pointer.normalizedX * 0.25, 0);
  },
});

const modelRotateEffect = defineWebGLEffect({
  kind: "modelRotate",
  source: "model/glb",
  update(context) {
    const rotation = (context.source.model.object3D as {
      rotation?: { x?: number; y?: number; z?: number };
    }).rotation;

    if (rotation) {
      rotation.x = 0;
      rotation.y = (context.time / 1000) * 0.015;
      rotation.z = 0;
    }
  },
});

const modelVertexParticlesEffect = defineWebGLEffect({
  kind: "modelVertexParticles",
  source: "model/glb",
  setup(context) {
    if (context.source.kind !== "model/glb") {
      return;
    }

    const points = context.source.model.createPointCloud({
      density: 2.5,
      color: "rgb(255, 0, 0)",
      size: 0.026,
    });
    const add = (context.source.model.object3D as {
      add?: (child: unknown) => void;
    }).add;

    add?.call(context.source.model.object3D, points);

    return { points };
  },
});
```

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

The GLB demo target hides its DOM fallback subtree after the model is ready.
Runtime model layout contains the loaded model bounds inside the target DOM rect
with a uniform XYZ scale so model depth is not flattened or stretched
independently. The local demo effect then hides the original GLB meshes and
renders the model as vertex particles. Pointer movement scatters particles near
the cursor only when the pointer is over a particle hit radius, using the mouse
movement direction, damping, and spring return to pull them back to the sampled
vertices. The default runtime scene includes a low-cost ambient plus directional
light rig so GLB/PBR materials are not rendered unlit by default.
The demo also reserves a stable scrollbar gutter so DOM anchor rects do not
reflow horizontally while the runtime tracks page scroll.

## Public API Imports

Use only public package entrypoints:

```ts
import type { WebGLDeclaration, WebGLDebugState } from "@project/dom-webgl-runtime";
import {
  createWebGLRuntime,
  defineWebGLEffect,
} from "@project/dom-webgl-runtime";
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

Targets declare effect data; matching effect definitions are provided through
runtime-level `effects`:

```ts
type WebGLEffectsDeclaration = readonly {
  kind: string;
  [key: string]: unknown;
}[];

createWebGLRuntime({
  container,
  effects: [
    appSurfaceEffect,
    appPointerTiltEffect,
    modelProbeEffect,
    modelRotateEffect,
    modelVertexParticlesEffect,
  ],
});
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

Scene gates are the advanced scroll-locking behavior. They are not the
recommended way to build a pinned section that drives an effect; use
`@project/dom-webgl-scroll-adapters/react`, `ScrollEffectSection`, and
`ctx.progress.get(progressKey)` for that story.

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
