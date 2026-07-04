# Effect Authoring Example Report

Date: 2026-06-22
Updated: 2026-07-02 for the managed Three-like `example.modelFloatGlow`
dogfood on `/models/4.glb`, including Draco decoder asset serving,
runtime-owned loader config, material/mesh emissive plus light-based glow, and
the postprocess/model-fit pitfalls found during browser verification.
Historical note: this report records the pre-2026-07-02 effect context shape.
Mentions of `ctx.source.*`, `ctx.target`, or source handles below are historical
evidence, not current authoring guidance. Current public effects use
`ctx.object` modules for visual control and source-backed capabilities.

## Summary

`apps/example` was created as a React-only downstream consumer of
`@project/dom-webgl-runtime`. It imports only public package entrypoints,
defines application-owned effects locally, exercises `dom/element`,
`dom/text`, `media/image`, `media/video`, `media/image-sequence`, and
`model/glb` source handles through a
full-width vertical one-effect-per-row catalog, places user-facing explanations
in a reusable click-to-expand overlay component on each Chinese effect row while
keeping API identifiers in English. It applies optional Lenis + GSAP +
ScrollTrigger support through `@project/dom-webgl-scroll-adapters/react`:
`WebGLScrollRuntime` owns the built-in smooth stack from
`exampleSmoothScrollOptions`, while `ScrollEffectSection` owns bounded pinned
section progress. This makes `apps/example` the dogfood surface for the
higher-level pinned scroll React adapter.
The current `dom/element` bucket also includes app-owned video background,
ghost cursor, and waves examples implemented through `ctx.object.surface`
instead of ReactBits-owned canvases or secondary renderers.
The catalog now also includes taller text, image, and video specimens:
`example.textSpotlight`, `example.imageKenBurns`, `example.imageHoverReveal`,
and a runtime `media/image-sequence` pinned scrub row that consumes frames
loaded by the example app and composes a reusable media pointer parallax effect.
It also includes ReactBits Text Pressure and
Scrambled Text ports as app-owned `dom/text` effects: `example.textPressure`
and `example.textScramble` rewrite WebGL glyph commands through
`ctx.object.text` without changing package exports. Text Pressure uses
glyph scale plus line-level `x` reflow so nearby glyphs expand while the rest of
the row compresses around them. The combined
`example.textSpotlightPressureScrambleWave` specimen reuses the same app-owned
glyph transform helpers for spotlight color, pressure reflow, scramble
characters, and wave offsets, then writes the final glyph command list once per
frame.
The model bucket now includes `example.modelDarkScene` and
`example.modelFloatGlow` on `/models/4.glb`. The dark scene effect paints a
pure black, fully opaque WebGL surface backdrop, and the model effect uses the
managed `ctx.object` facade for rotation, material/mesh emissive color, a
runtime-owned point light keyed by effect id, without a canvas-scoped
postprocess request. The light is declared from `update` with the
projected layout center so `lightIntensity` changes update the existing
runtime-owned light while the runtime still owns GLB loading, Draco decoding,
model fit position/scale, light handles, and all raw Three.js objects.
The glowing model is kept smaller by narrowing its DOM target rect rather than
by writing target scale from the effect.

## What Worked

- The public `defineWebGLEffect(...)` API is enough to write small effects
  without importing package internals.
- React integration is straightforward once the runtime-level `effects` array is
  kept stable at module scope.
- Source handle narrowing is explicit and testable.
- `dom/text`, `media/image`, `media/video`, `media/image-sequence`, and
  `model/glb` handles expose enough basic
  controls for small examples.
- `dom/text` glyph commands are expressive enough for pointer-driven text
  output: `example.textSpotlight` can compute glyph-center distance from
  target-local pointer data and alter only color, opacity, and scale.
- The image/video texture handles cover richer media examples without new
  package API: `example.imageKenBurns` combines sampling drift with target scale,
  and `example.imageHoverReveal` uses the public media image material-layer host
  to mix the source texture with a consumer-owned second image texture through
  a target-local irregular eraser trail. The final hover reveal implementation
  keeps stroke shape in an app-owned mask canvas texture rather than a bounded
  `vec2[]` point trail, starts fading when pointer movement stops even if the
  pointer remains inside the target, and bakes partially faded mask opacity
  before drawing resumed strokes so old areas do not jump back to full reveal.
  The pinned scrub row uses runtime
  `source: { kind: "media", type: "image-sequence" }` to
  drive WebGL texture frames from adapter progress, while
  `example.mediaPointerParallax` applies a shared texture crop/offset effect
  that can also be reused by `media/image` and `media/video` targets.
- Image-sequence resource ownership is clearer when kept at the consumer
  boundary: the example loads static assets from app code, registers the target
  after the first usable frame, passes a full-length `frames` array, and
  backfills real frames in place while the runtime only selects and renders the
  current frame.
- `dom/element` is flexible enough for richer surface drawing: the example
  can paint a muted looping `/example/bg.mp4` background and ReactBits-inspired
  pointer/wave visuals without relaxing the strict media-source contract.
- ReactBits-style Ghost Cursor can be ported safely when only the algorithm is
  moved into app-owned shader data and trail uniforms. The raw ReactBits
  renderer, scene, camera, composer, passes, and render loop must not become
  package public API.
- ReactBits Text Pressure and Scrambled Text can be expressed with the existing
  text-layer capability when the port focuses on glyph output rather than raw
  DOM variable-font or GSAP plugin behavior. Keeping them in `apps/example`
  preserves the distinction between catalog references and package contracts.
- Text effects that all write `ctx.object.text.setGlyphs(...)` should share
  transform helpers instead of being stacked blindly on one target. The combined
  text specimen demonstrates reuse by composing app-owned glyph transforms into
  one final command list.
- Pointer-heavy `dom/element` examples need per-effect lifecycle decisions:
  Ghost Cursor can stop uniform updates after trail decay, while ReactBits-style
  Waves now keeps its ambient field moving through shader uniforms instead of
  per-frame CPU canvas drawing.
- Runtime pointer state is shared input, so target-scoped pointer effects need
  an explicit `ctx.layout` hit test and target-local coordinate conversion.
- A full-width vertical catalog makes it easier to compare multiple effects for
  the same source kind without mixing them into package implementation code.
- The package boundary remains understandable when `apps/example` is treated as
  downstream app code.
- Copying static assets into `apps/example/public` keeps the example runnable as
  an isolated downstream app.
- Draco-compressed model assets work as a downstream example when both pieces
  are present: declarative `loader.draco.decoderPath` on the model source and
  matching decoder files in the app's public directory.
- Model glow is clearer when the backdrop is a pure black WebGL surface and the
  bright source lives in the model effect: controlled material/mesh emissive
  values plus a keyed runtime-owned light.
- Runtime-owned lights are keyed requests. Dynamic light params should be
  redeclared with the same key from `update`; effects should not stash raw light
  objects or manually own their lifecycle.
- Leaving model fit position/scale to the runtime layout pass keeps the GLB
  visible and centered in its target rect; effects can still animate rotation,
  materials, lights, animation, and generated model-local points.
- The scroll boundary now has two valid consumer levels: low-level helpers where
  the app owns Lenis and cleanup, and the high-level React adapter where
  `WebGLScrollRuntime` owns a progress store and `ScrollEffectSection` owns one
  bounded trigger instance.

## Friction And Counterintuitive Points

- Managed timeline card dogfood should keep the card target inside the
  `WebGLScene`. Moving it outside the scene only proves the default target
  pipeline and defeats the scene-child inheritance dogfood. If the card is not
  visible, debug the scene-child target in place.
- For a scene-child `dom/element` card that still looks invisible or tiny, use
  this order of checks: confirm React markup nests the `WebGLTarget` under
  `WebGLScene`; confirm runtime debug state reports the target as `ready`,
  `active`, `visible`, `sceneId: example.managedStage.scene`,
  `projection: perspective-stage`, and `placementMode: screen-depth`; confirm
  fallback DOM and descendants are hidden with `hideMode: "subtree"`; inspect
  the `WebGLCamera` used by the scene (`default`/`defaultCameraId`) and keep it
  aligned with `WebGLScene render.camera`; inspect `screen-depth` projection
  against that camera's `position`/`target`; then inspect the effect for
  `ctx.object.position` or `ctx.object.scale` writes that override the
  runtime-projected plane layout.
- The 2026-07-04 managed card failure had two causes: `screen-depth` originally
  projected with a simplified `cameraZ - depth` formula instead of the
  `WebGLCamera` basis, and `example.managedTimelineCard` called
  `ctx.object.scale.setScalar(...)`, shrinking the projected surface to roughly
  one scene unit. The fix kept the card as a scene-child `WebGLTarget`, made
  `screen-depth` project through the active camera forward/right/up, kept the
  scene camera declared as the default render camera, used `size: "dom"`, hid
  the fallback subtree, and removed the effect scale write.
- Use these docs before changing this area again: `docs/STATUS.md` for current
  caveats, `docs/roadmap/managed-render-system.md` for phase scope,
  `docs/agent/package-usage.md` for scene/placement contracts,
  `docs/agent/effect-object-boundary.md` for `ctx.object` ownership,
  `docs/examples/effect-authoring.md` for the consumer tutorial, and this
  report for dogfood pitfalls.
- The relationship between target `webgl.effects` data and runtime-level
  executable `effects` needs repeated documentation. It is easy to assume target
  declarations execute by themselves.
- React runtime recreation from changing `effects` array identity is easy to
  miss. The docs need to keep showing module-scope effect arrays.
- Smooth scrolling adds another stable-reference concern. Use the high-level
  `smooth` prop for the common example path, or pass only a stable
  `smoothScroll.scrollAdapter` when the app intentionally owns a manual stack.
  Avoid constructing Lenis/GSAP bridges during render.
- Pinned scroll effects need an explicit `progressKey` mental model. The target
  effect declaration carries the stable key, while the effect reads progress via
  `ctx.progress.get(progressKey)` instead of changing `webgl.effects` on every
  scroll update.
- Scroll-scrubbed video is better modeled as frame-addressable media, not
  repeated video `currentTime` seeking: the pinned section owns the progress key,
  the app owns sequence loading/backfill, and runtime `image-sequence` maps that
  progress into texture updates while the page remains pinned.
- Image-sequence targets need a full-length `frames` array before registration.
  If the whole sequence is not ready yet, consumers can temporarily point later
  indexes at a decoded preview frame and replace those entries in place as real
  frames finish loading.
- Pinned examples must keep the pinned section background transparent when DOM
  fallback is hidden, otherwise the content layer can cover the fixed WebGL
  canvas and make a valid text renderable look blank.
- Scene gates are easy to over-apply because they also expose progress. They
  lock page scroll and are not the recommended pinned-scroll story path. Use
  `@project/dom-webgl-scroll-adapters/react`, GSAP ScrollTrigger `pin`/`scrub`,
  and stable `progressKey` data for ordinary pinned effects.
- Runtime replacement from a late-arriving `scrollAdapter` is handled inside the
  React adapter. Consumers should still avoid unnecessary adapter identity churn
  for performance, but they do not need a guard to prevent disposed-runtime
  registration crashes.
- Media source declarations now use `kind: "media"` plus `type`; old
  top-level `image`, `video`, and `image-sequence` declarations are removed.
- The video-background example is a useful distinction: a non-video element
  should not use a top-level video source declaration, but a `dom/element`
  effect may own a hidden `HTMLVideoElement` and draw it into
  `ctx.object.surface`.
- Pointer effects should use `ctx.targetPointer` for current-target layout-local
  state. `ctx.pointer` remains runtime/canvas pointer state.
- Text pointer effects compare `ctx.targetPointer.localX/localY` against glyph
  visual centers in text-layer coordinates, not against raw viewport pointer
  coordinates.
- Shader ports need explicit coordinate and uniform-name checks. DOM pointer
  `y` may need conversion before entering shader coordinates, and a shader that
  reads `iTime` will stay visually static if the effect only updates `uTime`.
- Named visual references should trigger source-level comparison early. When a
  user asks for a ReactBits effect, inspect the referenced implementation and
  port the reusable algorithm instead of hand-tuning an unrelated approximation.
- Product taste belongs in `apps/example`. Do not promote Ghost Cursor's exact
  key names, copy, assets, shader constants, trail length, or Waves shader
  tuning into the package unless they are first generalized into a tested public
  primitive.
- Hover feedback is separate from ambient animation speed. For Waves, keep the
  background motion subtle and make target-local hover responsive with shader
  pointer disturbance; do not speed up the ambient wave field to compensate for
  slow hover.
- Text effects need careful language: `textLayer.setGlyphs(...)` changes only
  the WebGL output, not DOM content or accessibility text.
- Model examples can rotate via `ctx.object`, but advanced model effects still
  need users to understand object ownership and cleanup.
- A Draco-compressed GLB can look like a runtime bug when the asset loads without
  decoder config. The fix is not a loader callback escape hatch; declare
  `loader: { draco: { decoderPath } }` and serve the decoder files.
- Postprocess requests are easy to over-scope. Current `ctx.object.postprocess`
  requests affect the runtime canvas. The model glow example avoids bloom so it
  does not dim or blur unrelated WebGL targets.
- A DOM background on a ready model target can occlude the fixed WebGL canvas.
  Use a WebGL `dom/element` surface backdrop when the model needs a darker
  stage.
- Model renderables already have a runtime-owned fit transform. A model effect
  that writes `ctx.object.position` or `ctx.object.scale` becomes responsible
  for placement and can move the loaded model out of the expected target area.

## Documentation Gaps Closed In This Pass

- `docs/agent/custom-effects.md` now explains React registration, source handle
  narrowing, resource ownership, media target rules, and validation.
- `docs/examples/effect-authoring.md` now gives a React-only consumer tutorial.
- README and package usage docs now point to `apps/example`.
- The managed model dogfood notes now document Draco static assets, pure black
  WebGL surface backdrops, localized model glow, and model fit ownership so
  future examples do not reintroduce the same invisible/blurred model failure
  mode.

## Boundaries To Preserve

- Do not export concrete example effects from the runtime package.
- Do not add an `effects` package subpath.
- Do not let downstream examples import package internals.
- Do not reintroduce legacy source declarations or silent compatibility paths.

## Follow-Up Candidates

- Add a browser smoke check for `apps/example` once visual tuning matters.
- Add a small vanilla runtime example later, after the React-only contract stays
  stable.
- Consider a helper for common numeric param clamping only if several real
  downstream examples repeat the same code enough to justify it.
