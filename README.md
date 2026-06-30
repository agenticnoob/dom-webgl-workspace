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
effect implementations, and example effects are consumer-owned code.
Unified source capability handles are implemented in
`docs/superpowers/plans/2026-06-21-unified-source-capability-handles.md`:
custom effects can now control runtime-owned output handles for
`dom/element`, `dom/text`, `media/image`, `media/video`, `media/image-sequence`,
and `model/glb` without
mutating source DOM or reaching into renderer internals.
The visual capability API in
`docs/superpowers/plans/2026-06-26-visual-effect-capability-api.md` is
implemented: the same `defineWebGLEffect(...)` model now covers controlled
material layers, source texture uniforms, text/media shader inputs, GLB mesh
material handles, managed point layers, and named postprocess request handles
while keeping renderer, scene, camera, composer, render targets, raw object3D/mesh/
material/texture fields, and raw materials internal.
The runtime performance roadmap in
`docs/superpowers/plans/2026-06-30-runtime-performance-roadmap.md`: profile and
budget first, then demand-driven scheduling, resource/load pressure controls,
bounded postprocess, and only then targeted batching if profiling proves it is
needed. Runtime Performance Ownership V2 is implemented in
`docs/superpowers/plans/2026-06-30-runtime-performance-ownership-v2.md`:
texture upload dirtiness is split from frame-only dirtiness; material uniforms
update incrementally; effects can declare static/reactive/frame scheduling
intent; renderer draw-call/texture stats, postprocess request count, and
render-target size feed debug budget warnings without exposing raw renderer
objects; resource loads are queue-limited and viewport-prioritized; plane
renderables share internal geometry; animated model mixers are updated only
while visible; and `docs/performance/profile-notes.md` records that batching
remains profile-gated rather than implemented by default.
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
- `apps/example` is a downstream consumer-style example for package usage and
  effect authoring. It must not import runtime internals.
- Runtime/package implementation code must not hardcode example target keys,
  example asset paths, example DOM structure, example layout, or example copy.
- Tests live outside production source directories: package/app tests use their
  workspace `test/` directory, and repo-level structure/workspace tests live in
  the root `test/` directory.
- `packages/dom-webgl-runtime/test/open-source-boundary.test.ts` guards runtime
  source against app-specific coupling.

Current runtime behavior:

- Runtime registration, source inference, render role inference, renderable
  creation, resource lifecycle, debug state, page scroll state, scene gate state,
  scroll lock, and pointer state are wired.
- The runtime owns one renderer-driven frame loop through the renderer host;
  React creates and disposes the runtime but does not own an animation-frame
  sync loop.
- DOM element surfaces, DOM text surfaces, media images/videos/image sequences,
  and GLB models now create
  runtime-owned visible scene objects in the single internal Three.js scene.
- Nested `WebGLTarget` elements form an internal DOM-derived WebGL layer tree:
  the nearest registered ancestor target becomes the parent layer, child targets
  keep their own fallback lifecycle, and runtime ordering follows DOM ancestry
  and sibling order before applying local `renderRole` policy. This applies to
  runtime-owned layers from `dom/element`, `dom/text`, `media/image`,
  `media/video`, `media/image-sequence`, and `model/glb`; ordinary nested
  targets do not need `renderRole: "overlay"` to paint above their parent.
- The debug panel shows current scroll mode plus active gate key and
  `sceneProgress` while a gate is active, plus per-target layer diagnostics and
  runtime performance budget warnings when active target, snapshot, video,
  model, internal texture-size telemetry, renderer draw calls, renderer texture
  count, postprocess request count, or postprocess render-target size exceeds
  configured limits.
- Image, video, and model resources are cached by normalized resource key.
  Relative/app-local URLs keep path/search/hash normalization; absolute
  HTTP(S) and protocol-relative URLs preserve origin to avoid cross-origin
  collisions. Resource loading is queue-limited by
  `performanceBudget.maxConcurrentResourceLoads`; loads initiated during active
  viewport updates carry the highest runtime priority, with lower priority
  states reserved for future eager preloading paths.
- The runtime creates one Three.js renderer/canvas per runtime instance.

Current example behavior:

- `apps/example` is a React-only Vite app that uses
  `@project/dom-webgl-runtime`, `@project/dom-webgl-runtime/react`, and the
  optional `@project/dom-webgl-scroll-adapters` package through public
  entrypoints only.
- The example registers a stable module-scope `exampleEffects` array and
  declares a full-width vertical catalog of targets across the public source
  handles: `dom/element`, `dom/text`, `media/image`, `media/video`,
  `media/image-sequence`, and `model/glb`.
- The example page uses Chinese visible copy in reusable click-to-expand
  explanation overlays while keeping source kinds and effect kind identifiers in
  English as API data.
- The example is the dogfood surface for the high-level pinned scroll React
  adapter: ordinary pinned sections use `WebGLScrollRuntime`,
  `ScrollEffectSection`, stable `progressKey` data, and
  `ctx.progress.get(progressKey)` instead of manual per-scroll target mutation
  or scene gates. The current pinned example renders the visible
  `example.pinnedReveal` text effect and keeps the section background
  transparent so the WebGL canvas remains visible. The pinned row itself is the
  whole trigger section; the example no longer appends a synthetic post-pinned
  runway sibling just to hand scroll control back.
- Advanced examples can still pass a stable manual `scrollAdapter` when the app
  intentionally owns a third-party scroll lifecycle.
- The example effects are application-owned contract examples:
  `example.surfaceFill`, `example.surfacePulse`,
  `example.surfaceVideoBackground`, `example.surfaceGhostCursor`,
  `example.surfaceWaves`, `example.textWave`, `example.textReveal`,
  `example.textSpotlight`, `example.textPressure`, `example.textScramble`,
  `example.imagePan`, `example.imageZoom`, `example.imageKenBurns`, `example.imageHoverReveal`,
  `example.videoPlayback`, `example.videoDrift`, `example.sequenceCard`,
  `example.modelSpin`, and `example.modelFloat`, plus the pinned-scroll
  `example.pinnedReveal`.
- Text Pressure and Scrambled Text are ported as app-owned `dom/text` WebGL
  effects. Text Pressure rewrites glyph scale and line positions through
  `ctx.source.textLayer` so the hovered glyphs widen while the rest of the line
  compresses. They remain example code, not package exports or built-in package
  effects.
- In the current example, `example.surfaceFill` paints `/example/bg.png` onto
  the element snapshot surface without changing the target opacity, and
  `example.surfacePulse` draws the pulse on the surface layer without changing
  the target or DOM child opacity. The same `dom/element` surface bucket
  also includes `example.surfaceVideoBackground`, which draws `/example/bg.mp4`
  as a muted looping effect-owned background texture, plus ReactBits-inspired
  `example.surfaceGhostCursor` and `example.surfaceWaves` effects implemented
  through runtime effect handles rather than separate ReactBits canvases or
  renderers. Ghost Cursor dogfoods the public material layer API: no-pointer
  smoke stays nearly invisible on the dark stage, and the pointer only activates
  target-local emissive smoke around the cursor. Ghost Cursor stops uniform
  updates after its trail decays. Waves uses the snapshot surface path for a
  ReactBits-style Canvas2D Perlin point grid: the ambient wave stays subtle, and
  target-local hover applies an immediate pointer impulse without moving the
  effect into packages.
- The text, image, video, and image-sequence buckets include taller specimen rows for richer
  motion examples: `example.textSpotlight` uses target-local pointer distance
  to recolor glyph output, `example.imageKenBurns` combines image texture
  sampling drift with target scale, `example.imageHoverReveal` uses a media
  image material layer and an app-owned mask canvas texture as an irregular
  eraser trail that reveals `/example/mask.png` over `/example/show.png`.
  The trail fades after pointer movement stops, even while the pointer remains
  inside the target, and resumed movement bakes the current fade into the mask
  before drawing the next stroke so older restored regions do not snap back to
  full reveal. The pinned scrub specimen dogfoods
  runtime `source: { kind: "media", type: "image-sequence" }` with
  consumer-preloaded `/example/bg-sequence/frame_*.webp` resources so scroll
  progress selects already-ready WebGL texture frames. The image-sequence target
  also contains a nested WebGL-owned card target driven by the same
  `progressKey`, proving child target ordering and fallback boundaries without
  manually adding card objects from the parent effect.
- Runtime supports `source: { kind: "media", type: "image-sequence" }` for frame-addressable media:
  a target declares `frameCount`, `frames`, and optional `progressKey`.
  Consumers pass a full-length frame array; early frames may initially point to
  a ready preview frame while the app backfills real frames in place. Runtime
  only selects frames, updates the WebGL texture, and disposes its own scene
  object. The example uses an app-local resource scheduler to kick off static
  assets in DOM order, limit image-sequence concurrency, then register the
  image-sequence target after the first usable frame is ready.
- Example static assets are copied into `apps/example/public`; the example does
  not rely on any other app's public assets being served at runtime.
- `docs/agent/effect-authoring-example-report.md` records friction found while
  using the public docs as a downstream consumer.

Current visual behavior:

- DOM-authored targets compile into source descriptors, render roles, an
  internal DOM-derived target layer tree, local render policy ordering, and
  runtime-owned scene objects.
- DOM is the source for layout, content, accessibility, and interaction state.
  WebGL effects/materials are the source for final visual styling. The runtime
  should not try to clone all browser CSS into WebGL.
- Declared targets can request ordered effect declarations such as
  `effects: [{ kind: "example.surfaceFill" }, { kind: "example.textWave" }]`.
  Effects only run when the runtime receives matching definitions through
  runtime-level `effects`.
- The example-local GLB vertex particle effect hides the original GLB meshes
  after sampling their vertices, renders only the point cloud, and uses pointer
  motion to scatter particles only after the pointer hits a particle-sized local
  radius, then springs them back to their source vertices. Pointer hits are
  mapped through the current model target layout, so scrolling or a non-centered
  model rect does not shift interaction toward the viewport center. The hit
  projection and horizontal scatter impulse also account for the model's current
  y-axis rotation, so interaction follows the visible rotating particle model.
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
  content below the DOM scene or a layer constrained by application content
  width.
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
- Example effects render WebGL-owned surfaces, text, media, and models through
  public effect handles. They are examples in `apps/example`, not package
  exports.
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
- Nested `WebGLTarget` children are valid WebGL children, not fallback-only DOM.
  Use nested targets when a panel, card, marker, or caption needs its own
  WebGL-owned child layer. The parent owns its source layer; each child owns its
  own source layer and fallback lifecycle. Do not add child Object3D instances
  from a parent effect to simulate target children.
- DOM supplies layout and layer semantics. Effect code supplies pixels:
  `dom/element` is a transparent layout surface until an effect draws to
  `ctx.source.surface`, and the runtime does not clone CSS backgrounds,
  borders, shadows, or other decorative paint into WebGL.
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
  geometry/layout alignment, placement-only DOM snapshots, transparent DOM
  anchors, media content-box object-fit mapping, and the example harness.
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
postprocess handles through public effect context. Current postprocess support
owns request/handle lifecycle and executes bounded internal bloom/grain/blur
passes without exposing composer, pass-order, or render-target internals.
Target `setPosition(...)` writes runtime scene-space coordinates, not DOM
`left`/`top`. Concrete effects remain application-owned.
Material programs are Three-inspired shader declarations, not raw Three.js
materials; public fields are `vertexShader`, `fragmentShader`, `uniforms`,
`defines`, and `blend`.

Capability matrix:

| Source | Public capability |
| --- | --- |
| `dom/element` | canvas surface drawing plus `createMaterialLayer(...)` over the source texture |
| `dom/text` | text/glyph controls, text shader inputs, and `createMaterialLayer(...)` over the text texture |
| `media/image` | object-fit aware texture controls, media shader inputs, and `createMaterialLayer(...)` |
| `media/video` | image capabilities plus playback controls |
| `media/image-sequence` | frame-addressable media texture controls |
| `model/glb` | controlled mesh handles, material restore, sampled vertices, managed point layers |
| runtime visual context | `ctx.visual.requestPostprocess(...)` for named bloom/grain/blur request handles |

Runtime owns material, texture, geometry, render-target, postprocess request,
and managed-object lifecycle. Effects update public handles/requests and
register their own cleanup through `ctx.resources`; they do not receive raw
renderer, scene, camera, `ShaderMaterial`, `Texture`, `EffectComposer`,
`WebGLRenderTarget`, render-loop, pass ordering, raw object3D/mesh/material/
texture fields, raw point-cloud objects, or renderer-state handles.

Source declarations use one top-level source family plus a subtype:
`{ kind: "dom", type: "element" | "text" }`,
`{ kind: "media", type: "image" | "video" | "image-sequence" }`, or
`{ kind: "model", type: "glb", src }`. Old explicit declarations
(`snapshot/mode`, `image`, `video`, `image-sequence`, `model/format`) are not
supported.

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
  source: "dom/element",
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

const modelParticleEffect = defineWebGLEffect<{
  kind: "app.modelParticles";
}>({
  kind: "app.modelParticles",
  source: "model/glb",
  setup(ctx) {
    if (ctx.source.kind !== "model" || ctx.source.type !== "glb") {
      return undefined;
    }

    const points = ctx.source.model.createPointLayer({
      positions: ctx.source.model.sampleVertices({ maxPoints: 2048 }),
      color: "#7dd3fc",
      size: 0.026,
    });

    return { points };
  },
  update(ctx) {
    if (ctx.source.kind !== "model" || ctx.source.type !== "glb") {
      return;
    }

    ctx.source.model.setRotation?.(0, ctx.time / 1600, 0);
  },
  dispose(_ctx, state) {
    state?.points.dispose();
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

## Example

Run locally:

```bash
npm run dev -w @project/dom-webgl-example
```

Run for LAN access:

```bash
npm run dev -w @project/dom-webgl-example -- --host 0.0.0.0
```

Example assets live under `apps/example/public` and are referenced through
`/example/...`.

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

`apps/example` must not import from `packages/dom-webgl-runtime/src/*`.

Runtime source must not import app code or branch on app-only keys/assets.
Example-specific content belongs under `apps/example` and should reach the
package only through public declarations.

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
- A parent target hiding its own fallback does not hide, restore, or otherwise
  take ownership of a nested managed target root. Nested targets decide their
  own readiness and fallback visibility.
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
    key: "app.surface",
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
`activeGateKey`, `sceneProgress`, and per-target layer diagnostics:
`parentKey`, `layerDepth`, `siblingIndex`, and `computedRenderOrder`.
Gate-only fields are omitted in page mode.

## Verification

Common checks:

```bash
npm run check
npm run build
npm run check:imports
git diff --check
```

Current non-blocking build note: the example production build may emit Vite's
default chunk-size warning for the example bundle because the app intentionally
dogfoods rich media/model specimens. This is not a runtime package failure.
