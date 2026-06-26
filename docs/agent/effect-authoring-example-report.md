# Effect Authoring Example Report

Date: 2026-06-22
Updated: 2026-06-27 for taller rows, added text/image/video specimens, and the pinned image-sequence scrub row.

## Summary

`apps/example` was created as a React-only downstream consumer of
`@project/dom-webgl-runtime`. It imports only public package entrypoints,
defines application-owned effects locally, exercises `snapshot/element`,
`snapshot/text`, `image`, `video`, and `model/glb` source handles through a
full-width vertical one-effect-per-row catalog, places user-facing explanations
in a reusable click-to-expand overlay component on each Chinese effect row while
keeping API identifiers in English. It applies optional Lenis + GSAP +
ScrollTrigger support through `@project/dom-webgl-scroll-adapters/react`:
`WebGLScrollRuntime` owns the built-in smooth stack from
`exampleSmoothScrollOptions`, while `ScrollEffectSection` owns bounded pinned
section progress. This makes `apps/example` the dogfood surface for the
higher-level pinned scroll React adapter rather than `apps/demo`.
The current `snapshot/element` bucket also includes app-owned video background,
ghost cursor, and waves examples implemented through `ctx.source.surface`
instead of ReactBits-owned canvases or secondary renderers.
The catalog now also includes taller text, image, and video specimens:
`example.textSpotlight`, `example.imageKenBurns`, and
an `ImageSequenceScrub` pinned canvas row.

## What Worked

- The public `defineWebGLEffect(...)` API is enough to write small effects
  without importing package internals.
- React integration is straightforward once the runtime-level `effects` array is
  kept stable at module scope.
- Source handle narrowing is explicit and testable.
- `snapshot/text`, `image`, `video`, and `model/glb` handles expose enough basic
  controls for small examples.
- `snapshot/text` glyph commands are expressive enough for pointer-driven text
  output: `example.textSpotlight` can compute glyph-center distance from
  target-local pointer data and alter only color, opacity, and scale.
- The image/video texture handles cover richer media examples without new
  package API: `example.imageKenBurns` combines sampling drift with target scale,
  while the pinned scrub row uses adapter progress outside the effect catalog to
  drive a canvas image sequence.
- `snapshot/element` is flexible enough for richer surface drawing: the example
  can paint a muted looping `/example/bg.mp4` background and ReactBits-inspired
  pointer/wave visuals without relaxing the strict media-source contract.
- ReactBits-style Ghost Cursor can be ported safely when only the algorithm is
  moved into app-owned shader data and trail uniforms. The raw ReactBits
  renderer, scene, camera, composer, passes, and render loop must not become
  package public API.
- Pointer-heavy `snapshot/element` examples need per-effect lifecycle decisions:
  Ghost Cursor can stop uniform updates after trail decay, while ReactBits-style
  Waves must keep drawing because its ambient Perlin field keeps moving.
- Runtime pointer state is shared input, so target-scoped pointer effects need
  an explicit `ctx.layout` hit test and target-local coordinate conversion.
- A full-width vertical catalog makes it easier to compare multiple effects for
  the same source kind without mixing them into the package validation demo.
- The package boundary remains understandable when `apps/example` is treated as
  downstream app code and `apps/demo` remains package validation code.
- Copying static assets into `apps/example/public` keeps the example runnable as
  an isolated downstream app instead of depending on `apps/demo/public`.
- The scroll boundary now has two valid consumer levels: low-level helpers where
  the app owns Lenis and cleanup, and the high-level React adapter where
  `WebGLScrollRuntime` owns a progress store and `ScrollEffectSection` owns one
  bounded trigger instance.

## Friction And Counterintuitive Points

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
  and `ImageSequenceScrub` maps that progress into
  `/example/bg-sequence/frame_*.webp` canvas draws while the page remains pinned.
- Pinned examples must keep the pinned section background transparent when DOM
  fallback is hidden, otherwise the content layer can cover the fixed WebGL
  canvas and make a valid text renderable look blank.
- Scene gates are easy to over-apply because they also expose progress. They
  lock page scroll and are not the recommended pinned-scroll story path.
- Runtime replacement from a late-arriving `scrollAdapter` is handled inside the
  React adapter. Consumers should still avoid unnecessary adapter identity churn
  for performance, but they do not need a guard to prevent disposed-runtime
  registration crashes.
- Media source declarations are stricter than a new user may expect:
  `image` requires `img`, and `video` requires `video`.
- The video-background example is a useful distinction: a non-video element
  still cannot declare `source: { kind: "video" }`, but a `snapshot/element`
  effect may own a hidden `HTMLVideoElement` and draw it into
  `ctx.source.surface`.
- Pointer effects can look subtly wrong if they use only `ctx.pointer.isInside`:
  that flag belongs to the runtime canvas. Example effects that should respond
  only inside one target must subtract `ctx.layout.left/top` and reject pointers
  outside the current target rect.
- Text pointer effects have the same local-coordinate requirement as surface
  pointer effects. Compare against glyph visual centers in text-layer
  coordinates, not against raw viewport pointer coordinates.
- Shader ports need explicit coordinate and uniform-name checks. DOM pointer
  `y` may need conversion before entering shader coordinates, and a shader that
  reads `iTime` will stay visually static if the effect only updates `uTime`.
- Named visual references should trigger source-level comparison early. When a
  user asks for a ReactBits effect, inspect the referenced implementation and
  port the reusable algorithm instead of hand-tuning an unrelated approximation.
- Product taste belongs in `apps/example`. Do not promote Ghost Cursor's exact
  key names, copy, assets, shader constants, trail length, or Waves point-grid
  tuning into the package unless they are first generalized into a tested public
  primitive.
- Hover feedback is separate from ambient animation speed. For Waves, keep the
  background motion subtle and make target-local hover responsive with pointer
  follow plus a minimum hover impulse; do not speed up the ambient wave field to
  compensate for slow hover.
- Text effects need careful language: `textLayer.setGlyphs(...)` changes only
  the WebGL output, not DOM content or accessibility text.
- Model examples can rotate via `ctx.target`, but advanced model effects still
  need users to understand object ownership and cleanup.

## Documentation Gaps Closed In This Pass

- `docs/agent/custom-effects.md` now explains React registration, source handle
  narrowing, resource ownership, media target rules, and validation.
- `docs/examples/effect-authoring.md` now gives a React-only consumer tutorial.
- README and package usage docs now point to `apps/example`.

## Boundaries To Preserve

- Do not export concrete example effects from the runtime package.
- Do not add an `effects` package subpath.
- Do not make `apps/demo` the consumer tutorial surface.
- Do not let downstream examples import package internals.
- Do not relax media declarations to silently accept non-media elements.

## Follow-Up Candidates

- Add a browser smoke check for `apps/example` once visual tuning matters.
- Add a small vanilla runtime example later, after the React-only contract stays
  stable.
- Consider a helper for common numeric param clamping only if several real
  downstream examples repeat the same code enough to justify it.
