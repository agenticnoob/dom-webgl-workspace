# DOM WebGL Workspace

DOM-first interactive WebGL runtime workspace.

## Status

Current implementation truth lives in `docs/STATUS.md`.

The next strategic direction is
`docs/roadmap/managed-render-system.md`: evolve the runtime from target-local
capabilities into managed scenes, cameras, projection policies, render passes,
stage primitives, model animation, scoped input, and scene-native dynamics/physics
while keeping raw Three.js internals private.

Completed phase plans and historical execution records are archived under
`docs/archive/`. Treat archived files as evidence, not current API truth or live
backlog.

Agent package onboarding starts at `docs/agent/package-onboarding.md`. Detailed
package usage rules live in `docs/agent/package-usage.md`. The current effect
authoring boundary lives in `docs/agent/effect-object-boundary.md`. React-only
consumer examples live in `apps/example` and `docs/examples/effect-authoring.md`.

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
  and GLB models now create runtime-owned visible scene objects in the internal
  generated default scene by default.
- Applications can opt into managed `WebGLScene`, `WebGLCamera`, and
  scene-owned `render` declarations for DOM-anchored scene/pass ownership.
  `WebGLRenderPass` remains available for advanced explicit pass descriptors.
  This does not replace the Level 1 `WebGLTarget` path, and it does not expose
  raw Three.js scene, camera, renderer, pass, or object handles.
- Applications can opt into scene-native `WebGLModel` descriptors inside
  managed scenes. The runtime loads GLB assets, owns cloned scene objects,
  mixers, clip playback, morph weights, debug summaries, and release on
  unregister/scene unregister/runtime dispose. DOM-following GLB content still
  uses `WebGLTarget` with `source: { kind: "model", type: "glb" }`.
- Scene-native `WebGLModel`, `WebGLStagePlane`, and `WebGLStageBox` descriptors
  can opt into scene-object effects and managed picking through
  `effects` plus `interaction.pickable`. Pickable descriptors can use coarse
  `hitTest: "bounds"` or visual `hitTest: "mesh"`; scene-object effects are
  registered with `defineWebGLSceneObjectEffect(...)` and receive managed object
  pointer state without raw raycaster/intersection/camera handles.
- Scene-native `WebGLModel`, `WebGLStagePlane`, and `WebGLStageBox` descriptors
  can also opt into descriptor-only `physics`. The runtime owns body state,
  simple gravity/velocity/damping integration, `static`/`dynamic`/`kinematic`
  bodies, `bounds`/`box`/`sphere`/`plane` colliders, `anchor`/`spring`
  constraints, direct 2D pointer-drag manipulation with release velocity,
  static plane/box collision response, transform writes, scheduling, debug
  summaries, and disposal. This is Level 3 scene-native physics only; it
  does not add Level 1 `WebGLTarget` physics, raw physics-engine handles,
  dynamic-vs-dynamic impulses, joints, or collision events.
- DOM targets in managed perspective-stage scenes can use
  `placement: { mode: "screen-plane", planeId }` to project their DOM rect
  center onto a named stage plane.
- Targets, managed scenes, stage primitives, and scene-owned lights can bind to
  named timeline descriptors backed by runtime progress signals. Timeline
  active ranges can activate or skip target, scene, stage, and light work
  without React prop churn. Cameras intentionally do not accept top-level
  `timeline`; managed perspective-stage cameras can declare a nested
  `controller` for progress-driven `position`, `target`, and `fov` changes.
  `controller.pointer` can add primary-drag orbit, pan, dolly, camera parallax,
  damping, and reset gestures. Hover/click-only object hits do not block camera
  drag; dragging suppresses object hover/click routing until release, and only
  explicit object drag capture blocks camera gestures. Hover/click picking reads
  the current-frame camera after managed camera gestures are applied, using the
  DOM-rect pass viewport when the pass is clipped to an anchor element.
- Nested `WebGLTarget` elements form an internal DOM-derived WebGL layer tree:
  the nearest registered ancestor target becomes the parent layer, child targets
  keep their own fallback lifecycle, and runtime ordering follows DOM ancestry
  and sibling order before applying local `renderRole` policy. This applies to
  runtime-owned layers from `dom/element`, `dom/text`, `media/image`,
  `media/video`, `media/image-sequence`, and `model/glb`; ordinary nested
  targets do not need `renderRole: "overlay"` to paint above their parent.
- A parent target may declare `transformScope: "subtree"` to create an internal
  transform group for its WebGL subtree. Effects on that parent write transform,
  visibility, and best-effort opacity to the group; child targets still own their
  own sources, effects, textures, fallback lifecycle, and offscreen policy.
  `ctx.pointer` remains runtime/canvas pointer state; `ctx.targetPointer` is the
  current target's layout-local pointer state. Target pointer is layout-local
  only, with no inverse-transformed picking for rotated groups, models, or
  custom meshes.
- Pointer declarations are target-semantic: use
  `pointer: { hover, press, click, drag }` to wake reactive effects for
  target-level pointer semantics. `ctx.targetPointer.isInside` is the current
  target hover check, `localX/localY` replace repeated
  `ctx.pointer.x - ctx.layout.left/top` math, and `normalizedX/Y` use the same
  -1..1 convention as runtime pointer coordinates. Long-press behavior belongs
  in effect params via `ctx.targetPointer.pressDuration`; runtime does not own a
  global threshold.
- The debug panel shows current scroll mode plus active gate key and
  `sceneProgress` while a gate is active, plus per-target layer diagnostics and
  runtime performance budget warnings when active target, snapshot, video,
  model, internal texture-size telemetry, renderer draw calls, renderer texture
  count, postprocess request count, or postprocess render-target size exceeds
  configured limits.
- Debug state can also report descriptor-only scene-native model inventory,
  resource status, timeline state, clips, active clips, morph names, bone names,
  and missing clip/morph diagnostics without exposing raw GLTF, mixers, actions,
  skeletons, or morph arrays.
- Debug state can report descriptor-only physics body counts, active body
  counts, collisions, positions, velocities, collider kind, constraint count,
  and pointer-drag activity without exposing raw body or engine handles.
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
- The example also dogfoods `WebGLScrollTimeline` with a pinned named managed
  timeline that feeds a `WebGLCamera.controller` and the card effect. The scene,
  stage planes, stage box, scene-owned lights, and visible scene-child
  `WebGLTarget` display directly; the card inherits the scene and uses
  `screen-depth` placement. The scene is wrapped in `WebGLPassViewport` and
  declares pass `viewport: { mode: "dom-rect", scissor: true }`, so the managed
  timeline pass is clipped to the pinned section DOM rect on the shared runtime
  canvas.
  The card effect enters from the named progress signal and then holds its final
  visible state until the viewport clips the pass away; it leaves
  `ctx.object.scale` untouched so the descriptor-projected surface size stays
  owned by the runtime. In the catalog, the separate managed stage primitive
  example is placed before this pinned timeline so the timeline does not exit
  directly into another similar 3D stage pass.
- The Phase 7 managed model animation dogfood is a separate catalog row between
  the stage primitive example and the pinned managed timeline. It mounts
  `/models/human_male_base.glb` through public `WebGLModel` in its own
  `example.managedModel.*` scene and uses an independent pinned scroll timeline
  to scrub `WalkCycle` through the existing `animation.scrub` descriptor. The
  example avoids `playAllClips`, target-local effects, and unrelated exported
  clips so browser QA has a clear proof that scroll progress controls the visible
  walking motion. It also requests
  `prepare={{ renderWarmup: "idle" }}` so the runtime performs a tiny managed
  first-render warmup after load, clone, attachment, and animation setup.
  For DOM-bound managed model passes, that prepare path is
  viewport-proximity aware: the model can remain queued while its pass viewport
  is far from the page viewport, then load and warm before the row reaches view.
  Model animation coverage is not mixed into the timeline/stage dogfood row.
- The managed stage primitive example is mounted in the current catalog and
  dogfoods `WebGLPassViewport` with pass `viewport: { mode: "dom-rect",
  scissor: true }` plus descriptor-level `bloom`/`grain`/`blur` postprocess.
  It still uses the same runtime canvas; the pass is clipped to the visible DOM
  rect without remapping or compressing the pass, and skipped while fully
  offscreen rather than rendered into a second local canvas.
- The Phase 8B managed interaction example is mounted in the current catalog
  and dogfoods one pickable `WebGLStagePlane` floor plus one pickable
  scene-native `/models/hero.glb` model while testing rich camera gestures on
  the same managed camera: primary-drag orbit, secondary-drag pan, Alt +
  primary-drag dolly, camera parallax, damping, and double-click reset. It
  still omits physics and `screen-plane` DOM targets.
- The Phase 9 managed dynamics example is a separate catalog row with its own
  `WebGLScene`, `WebGLCamera`, and `WebGLPassViewport`. It dogfoods the full
  Phase 9 v1 descriptor surface: static, dynamic, and kinematic bodies;
  plane, box, sphere, and bounds colliders; anchor and spring constraints;
  direct pointer-drag manipulation; stage primitive physics; and scene-native
  `WebGLModel` physics. The blue and yellow bodies visibly move from anchor/spring
  constraints, the model sweeps as a kinematic body, and the orange crate is
  pointer-draggable. The red block is the direct drag/release test body: drag it
  to generate velocity, then release it to bounce against the floor and static
  box colliders without adding dynamic-vs-dynamic impulses. Descriptor-owned
  physics stays separate from the Phase 8B camera gesture surface.
- Advanced examples can still pass a stable manual `scrollAdapter` when the app
  intentionally owns a third-party scroll lifecycle.
- The example effects are application-owned contract examples:
  `example.surfaceFill`, `example.surfacePulse`,
  `example.surfaceVideoBackground`, `example.surfaceGhostCursor`,
  `example.surfaceWaves`, `example.textWave`, `example.textReveal`,
  `example.textSpotlight`, `example.textPressure`, `example.textScramble`,
  `example.textSpotlightPressureScrambleWave`,
  `example.managedTimelineCard`, `example.imagePan`, `example.imageZoom`,
  `example.imageKenBurns`, `example.imageHoverReveal`, `example.mediaPointerParallax`,
  `example.videoPlayback`, `example.videoDrift`, `example.sequenceCardSlide`,
  `example.sequenceCardBorderGlow`, `example.modelSpin`, `example.modelFloat`,
  `example.modelFloatGlow`, and `example.sceneObjectHoverPulse`, plus the
  pinned-scroll `example.pinnedReveal`.
- Text Pressure and Scrambled Text are ported as app-owned `dom/text` WebGL
  effects. Text Pressure rewrites glyph scale and line positions through
  `ctx.object.text` so the hovered glyphs widen while the rest of the line
  compresses. `example.textSpotlightPressureScrambleWave` shows the same
  text-layer command path can combine spotlight color, scramble characters,
  pressure reflow, and wave offset in one application effect. They remain
  example code, not package exports or built-in package effects.
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
  updates after its trail decays. Waves dogfoods the same public material layer
  path with a GPU shader approximation of the ReactBits-style line field: the
  ambient wave stays subtle, and target-local hover applies an immediate pointer
  disturbance without per-frame CPU canvas drawing or moving the effect into
  packages.
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
  progress selects already-ready WebGL texture frames, then composes
  `example.mediaPointerParallax` to crop the media texture and offset it from
  target-local pointer position. The sequence specimen is a pinned scrub
  section: `ScrollEffectSection` owns the progress key, `pin`,
  and scrub duration, while the image sequence and card stay inside the pinned
  viewport and use effects for visual motion instead of DOM scrolling. The card
  is a nested `dom/element` child target inside the image-sequence DOM subtree,
  declares `transformScope: "subtree"`, and composes
  `example.sequenceCardSlide` for progress-keyed opacity/offset with
  `example.sequenceCardBorderGlow` for a ReactBits-style target-local pointer
  border glow. Its title and description are child `dom/text` targets that keep
  independent text source/effect ownership while inheriting the card WebGL group
  transform; their text reveal effects read the same pinned `progressKey`
  instead of page scroll. The scroll adapter progress store notifies the runtime
  when a progress key changes, so external ScrollTrigger scrub updates wake
  on-demand image-sequence renderables without requiring an app-owned no-op
  frame effect.
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
- The example-local GLB effects use `ctx.object` only: `example.modelSpin`
  rotates `/models/hero.glb`, `example.modelFloat` combines layout and runtime
  time for movement, `example.modelDarkScene` paints an opaque black WebGL
  surface backdrop, and `example.modelFloatGlow` dogfoods `/models/4.glb` with
  controlled rotation, material emissive color, and a restrained runtime-owned
  point light positioned at the projected layout center. It avoids
  canvas-scoped postprocess so the other WebGL targets stay visually stable.
  Model fit position/scale stays owned by the runtime layout pass; the example
  keeps the glowing model smaller by constraining the DOM target rect instead
  of writing `ctx.object.scale`.
  They do not create raw loaders, scenes, cameras, lights, materials, mixers,
  composers, render targets, or render loops.
- The scene-native `WebGLModel` dogfood is separate from those DOM-following GLB
  target examples: `ManagedModelAnimationExample` mounts
  `/models/human_male_base.glb` in its own managed scene, scrubs `WalkCycle`
  from pinned timeline progress, and does not use target-local effects.
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
- Managed scene/camera layers are resized only after the renderer viewport
  actually changes; timeline and pointer controller frames are then re-applied
  so scroll-held cameras and stopped/released camera drags do not snap back to
  their declaration base frame.
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
- `transformScope: "subtree"` is the only public v1 transform inheritance knob.
  It is parent-side and declarative; it does not expose a public scene graph,
  parent key, group object, matrix API, or raw Three.js object/scene/camera/
  material handle.
- DOM supplies layout and layer semantics. Effect code supplies pixels:
  `dom/element` is a transparent layout surface until an effect draws to
  `ctx.object.surface`, and the runtime does not clone CSS backgrounds,
  borders, shadows, or other decorative paint into WebGL.
- Scene-gated scroll, scroll lock, `sceneProgress`, and explicit reverse gate
  behavior remain available as optional advanced runtime behavior. They are
  historical Phase 2 output, not the recommended route for pinned effect
  sections.
- Concrete text animation effects, shader authoring APIs, core-provided
  particle systems, animation layers, and raw raycaster/intersection access
  remain intentionally out of scope. Third-party scroll integration now uses a small
  public `WebGLScrollAdapter` protocol in core plus the optional
  `@project/dom-webgl-scroll-adapters` package for Lenis, GSAP ticker, and
  ScrollTrigger glue. The optional scroll adapters package also exposes
  `@project/dom-webgl-scroll-adapters/react` for the recommended pinned scroll
  effect path, where `WebGLScrollRuntime` owns the progress store and
  `ScrollEffectSection` owns a bounded trigger instance. Progress sources may
  expose `subscribe(listener)`, and the runtime requests a scroll frame when
  those keyed progress values change. The lower-level
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
  flags, multiple canvases, and raw raycaster/intersection access remain out of
  core scope.
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

Effects are user-authored runtime definitions. They receive layout snapshots,
frame input, pointer and scroll state, the controlled `ctx.object` visual facade,
and managed resources. They do not scan DOM, mutate arbitrary DOM, create their
own renderer, or own independent asset loading.

The public authoring model is managed Three-like API: consumers use familiar
Three.js vocabulary such as `position`, `rotation`, `scale`, `material`,
`lights`, and `animation`, while the runtime owns raw Three.js renderer, scene,
camera, objects, materials, textures, loaders, mixers, lights, render targets,
scroll, pointer, lifecycle, disposal, and performance scheduling.

The effect context exposes managed source-backed modules through `ctx.object`.
Consumers can draw to canvas-backed element surfaces through
`ctx.object.surface`, control WebGL text and glyph layout through
`ctx.object.text`, transform image/video/sequence textures through
`ctx.object.texture`, control video playback through `ctx.object.video`, inspect
or manipulate GLB model mesh handles and managed point layers through
`ctx.object.model`, adjust controlled material fields through
`ctx.object.material`, request runtime-owned lights through `ctx.object.lights`,
drive model clips through `ctx.object.animation`, and request explicit
canvas/pass-scoped postprocess through `ctx.runtime.postprocess`. Current
postprocess support owns request/handle lifecycle and executes bounded internal
bloom/grain/blur passes without exposing composer, pass-order, or render-target
internals.
`ctx.object.position.set(...)` writes runtime scene-space coordinates, not DOM
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
| `model/glb` | controlled mesh handles, material facade, sampled vertices, managed point layers, animation facade, optional morph/rig facades |
| runtime lights | `ctx.object.lights` for keyed runtime-owned ambient/directional/point light requests |
| runtime/pass postprocess | `ctx.runtime.postprocess.request(...)` for explicit canvas/pass-scoped bloom/grain/blur requests |

Runtime owns material, texture, geometry, render-target, postprocess request,
and managed-object lifecycle. Effects update public handles/requests and
register their own cleanup through `ctx.resources`; they do not receive raw
renderer, scene, camera, `ShaderMaterial`, `Texture`, `EffectComposer`,
`WebGLRenderTarget`, render-loop, pass ordering, raw object3D/mesh/material/
texture fields, raw point-cloud objects, or renderer-state handles.

Source declarations use one top-level source family plus a subtype:
`{ kind: "dom", type: "element" | "text" }`,
`{ kind: "media", type: "image" | "video" | "image-sequence" }`, or
`{ kind: "model", type: "glb", src, loader? }`. Draco-compressed GLBs use
declarative `loader: { draco: { decoderPath } }`, and the consuming app must
serve the matching decoder files from that path; effects do not receive loader
callbacks or raw loader instances. Old explicit declarations
(`snapshot/mode`, `image`, `video`, `image-sequence`, `model/format`) are not
supported.

Scene-native models use managed scene descriptors instead of DOM target
descriptors:

```tsx
<WebGLScene
  id="hero.stage"
  projection="perspective-stage"
  render={{ camera: "hero.camera" }}
>
  <WebGLCamera id="hero.camera" default type="perspective" mode="perspective-stage" />
  <WebGLModel
    id="hero.character"
    src="/models/human_male_base.glb"
    position={[0, -92, -40]}
    scale={126}
    prepare={{ renderWarmup: "idle" }}
    animation={{
      scrub: {
        clip: "WalkCycle",
        timeline: { id: "hero.timeline", active: { from: 0.08, to: 0.92 } },
        durationSeconds: 2.4,
      },
    }}
  />
</WebGLScene>
```

Use `defaultClips` only for clips the app intentionally wants to start together.
It is not a `playAllClips` shortcut, and the runtime does not infer which
exported GLB clips are meaningful. The single `defaultClip` shorthand remains
valid for existing one-clip startup.

Use `WebGLModel` for managed-scene GLB assets that do not need DOM fallback,
target-local pointer state, or DOM layout. `prepare={{ renderWarmup: "idle" }}` is not
`WebGLTarget.lifecycle`: it does not create DOM fallback, DOM rect fitting,
target pointer state, or target-local effects. It only asks the runtime to
perform a tiny internal render after the GLB is loaded, cloned, attached, and
animation setup has run. For DOM-bound managed model passes, runtime
preparation is viewport-proximity aware: the model can stay queued while its
pass viewport is far below the page, then load and warm before the viewport
reaches the model row. The debug state reports descriptor-only
`prepare.load` and `prepare.renderWarmup` values; this is not a public loader
or render hook. Keep DOM-following models as `WebGLTarget` model sources.

`WebGLModel` can declare scene-object `effects` and `interaction.pickable`.
Those effects are defined with `defineWebGLSceneObjectEffect(...)`, receive
`ctx.objectPointer`, `ctx.object`, `ctx.scene`, and `ctx.runtime`, and do not
receive DOM `layout`, `ctx.targetPointer`, raw raycasters, raw intersections, or
raw camera/object handles. This is separate from target-local effects on
`WebGLTarget`.

`WebGLModel`, `WebGLStagePlane`, and `WebGLStageBox` can declare
descriptor-only `physics` for scene-native objects. Supported v1 descriptors are
`static`/`dynamic`/`kinematic` bodies, `bounds`/`box`/`sphere`/`plane`
colliders, `anchor`/`spring` constraints, and `pointerDrag` built from managed
press hits plus pointer drag deltas. While dragging, the runtime directly
translates the body in the scene XY plane and keeps Z stable; on release it
resumes physics with velocity derived from the last drag movement. The runtime
owns integration, simple static collision response, transform writes,
scheduling, debug summaries, and disposal. This does not add Level 1
`WebGLTarget` physics, raw physics-engine access, public body handles,
dynamic-vs-dynamic impulses, joints, or collision events.

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
  update(ctx, _state, params) {
    ctx.object.visible = true;
    ctx.object.opacity = params.opacity ?? 1;
  },
});

const appPointerTiltEffect = defineWebGLEffect({
  kind: "app.pointerTilt",
  update(ctx, _state, params) {
    const maxDegrees = params.maxDegrees ?? 6;
    const radians = (maxDegrees * Math.PI) / 180;

    ctx.object.rotation.set(
      -ctx.targetPointer.normalizedY * radians,
      ctx.targetPointer.normalizedX * radians * (params.strength ?? 1),
      0,
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
    const model = ctx.object.model;
    if (!model) {
      return undefined;
    }

    const points = model.points.create({
      positions: model.sampling.vertices({ maxPoints: 2048 }),
      color: "#7dd3fc",
      size: 0.026,
    });

    return { points };
  },
  update(ctx) {
    if (!ctx.object.model) {
      return;
    }

    ctx.object.rotation.set(0, ctx.time / 1600, 0);
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
import type {
  WebGLDeclaration,
  WebGLDebugState,
  WebGLProgressSignalSource,
  WebGLTimelineBindingDeclaration,
} from "@project/dom-webgl-runtime";
import {
  createWebGLRuntime,
  defineWebGLEffect,
} from "@project/dom-webgl-runtime";
import {
  ScrollEffectSection,
  WebGLScrollRuntime,
  WebGLScrollTimeline,
} from "@project/dom-webgl-scroll-adapters/react";
```

`apps/example` must not import from `packages/dom-webgl-runtime/src/*`.

Runtime source must not import app code or branch on app-only keys/assets.
Example-specific content belongs under `apps/example` and should reach the
package only through public declarations.

## Opt-In Managed Scenes

Use `WebGLTarget` alone for normal DOM-first effects. When a target needs
explicit scene/pass ownership, wrap it in a managed scene and camera:

```tsx
import {
  WebGLLight,
  WebGLCamera,
  WebGLModel,
  WebGLPassViewport,
  WebGLRuntime,
  WebGLScene,
  WebGLStageBox,
  WebGLStagePlane,
  WebGLTarget,
  useWebGLRuntime,
} from "@project/dom-webgl-runtime/react";

<WebGLRuntime effects={runtimeEffects}>
  <WebGLScene id="world" render={{ camera: "world.camera" }}>
    <WebGLCamera id="world.camera" default />
    <WebGLTarget
      webgl={{
        key: "world.model",
        source: { kind: "model", type: "glb", src: "/models/hero.glb" },
      }}
    >
      <div aria-label="World model fallback" />
    </WebGLTarget>
  </WebGLScene>
</WebGLRuntime>;
```

When a managed pass must render inside a DOM-owned rectangle, wrap the DOM owner
with `WebGLPassViewport` and let the pass resolve that anchor:

```tsx
<WebGLPassViewport id="hero.stage.viewport" as="section">
  <WebGLScene
    id="hero.stage"
    projection="perspective-stage"
    render={{
      camera: "hero.camera",
      viewport: { mode: "dom-rect" },
      postprocess: {
        bloom: { strength: 0.48, radius: 0.34, threshold: 0.42 },
        grain: { amount: 0.12 },
        blur: { radius: 0.06 },
      },
    }}
  >
    <WebGLCamera id="hero.camera" default type="perspective" />
  </WebGLScene>
</WebGLPassViewport>
```

The runtime intersects the DOM rect with the visible canvas viewport each frame.
The original pass viewport still defines the render mapping; the intersection
is only the scissor clip. If there is no intersection, the pass and its
descriptor-level postprocess are skipped for that frame.

Targets inside `WebGLScene` inherit that scene unless `webgl.sceneId` is set
explicitly. A scene only needs a camera when it opts into rendering with
`render` or `defaultPass`; the generated pass waits for the referenced/default
camera before drawing. Unregistering or unmounting a managed scene releases
targets still routed to that scene.

Managed scenes support explicit `projection: "dom-aligned" | "screen" |
"perspective-stage"` policies. Targets can opt into `placement` modes such as
`dom-anchored`, `screen-anchored`, `screen-depth`, and `stage-local`; render
passes can request `clear` or `clearDepth`. `screen-depth` uses the DOM rect for
screen position/size and projects that point along the active `WebGLCamera`
basis at the requested depth, so the scene default camera should stay aligned
  with the render pass camera. A managed perspective-stage camera can use a
  nested `controller` descriptor for timeline-driven `position`, `target`, and
  `fov`; the runtime applies that camera frame before `screen-depth` projection
  and pass rendering, and re-applies it after managed camera resize so a
  scroll-held camera does not snap back to its declaration base frame while
  progress is unchanged. Pointer gesture frames use the same persistence, so a
  stopped or released drag keeps the last managed orbit/pan/dolly frame instead
  of falling back to the declaration base frame. Render passes can also declare
  DOM-bound `viewport`/scissor and descriptor-level `postprocess`. These remain
  descriptor-driven and runtime-owned. Scene-native `WebGLModel` descriptors are
  available for managed-scene GLB assets and can request
`animation.defaultClips` for intentional multi-clip startup and
`prepare={{ renderWarmup: "idle" }}` for managed, viewport-proximity aware
first-render preparation on DOM-bound model passes. Phase 8 adds scene-object
effects, managed picking with bounds and mesh hit tests, `screen-plane`
placement, and primary-drag orbit that does not stack with hover/click object
routing. Phase 8B extends managed `controller.pointer` descriptors with
drag-based pan, dolly, camera pointer parallax, damping, reset, and richer orbit
constraints. Orthographic/screen camera controllers, mouse wheel zoom, touch
pinch zoom, pass-bound camera controller scope, and raw Three.js access remain
out of scope.

## Managed Timeline Bindings

Runtime progress signals are keyed by string. A timeline binding is descriptor
data that points a target, scene, stage primitive, or light at one of those
signals:

```tsx
import {
  WebGLScrollRuntime,
  WebGLScrollTimeline,
} from "@project/dom-webgl-scroll-adapters/react";
import {
  WebGLLight,
  WebGLCamera,
  WebGLScene,
  WebGLStagePlane,
} from "@project/dom-webgl-runtime/react";

<WebGLScrollRuntime effects={runtimeEffects}>
  <WebGLScrollTimeline id="hero.timeline" start="top bottom" end="bottom top" scrub>
    <WebGLScene
      id="hero.scene"
      projection="perspective-stage"
      render={{ camera: "hero.camera" }}
      timeline={{ id: "hero.timeline", active: { from: 0.1, to: 0.9 } }}
    >
      <WebGLCamera
        id="hero.camera"
        default
        type="perspective"
        mode="perspective-stage"
        fov={42}
        controller={{
          timeline: { id: "hero.timeline", range: { from: 0.15, to: 0.85 } },
          to: { position: [0, 80, 520], target: [0, 32, 0], fov: 36 },
          easing: "smoothstep",
        }}
      />
      <WebGLStagePlane
        id="hero.floor"
        role="floor"
        timeline={{ id: "hero.timeline", active: { from: 0.2, to: 1 } }}
      />
      <WebGLLight
        id="hero.key"
        kind="point"
        timeline={{ id: "hero.timeline", active: { from: 0.35, to: 1 } }}
      />
    </WebGLScene>
  </WebGLScrollTimeline>
</WebGLScrollRuntime>;
```

`timeline` accepts either a string id or `{ id, progressKey?, active? }`.
`active.from` and `active.to` are normalized 0..1 progress bounds.
`WebGLScrollTimeline` defaults `progressKey` to `id`; `ScrollEffectSection`
remains compatible sugar for existing target/effect pinned sections.
For targets, stage primitives, and lights, an inactive range hides the
runtime-owned object; entering the active range restores only the declaration or
effect-owned visibility, so `visible: false` and `ctx.object.visible = false`
remain authoritative.

Effects can read the same signal through `ctx.progress.get(key)` or
`ctx.runtime.progress.get(key)`. If an effect runs inside a managed scene,
`ctx.scene` exposes descriptor metadata and that scene timeline snapshot. These
scope objects are managed metadata, not raw scene/pass/camera handles, and there
is no implicit `ctx.camera`.

`WebGLCamera` still has no top-level `timeline` prop. Use the nested
`controller.timeline` descriptor on a managed `perspective-stage` camera for
camera motion/focus/framing, or `controller.pointer` for descriptor-driven
primary-drag orbit, pan, dolly, camera parallax, damping, and reset gestures.
Controller support is intentionally limited to one camera-owned descriptor per
camera and does not expose raw Three.js cameras, controls, matrices, wheel/pinch
capture, or pass-bound scope. Hover/click-only object hits do not block camera
drag, and dragging suppresses object hover/click routing until release; explicit
object drag capture still blocks camera gestures. Hover/click picking runs after
the current-frame managed camera gesture update so camera orbit, dolly,
parallax, damping, and reset do not leave hit regions in the previous view. The
active DOM-rect pass viewport is also used for gesture framing and managed
picking, so pass-clipped scenes do not interpret pointer input through the full
runtime canvas. The runtime preserves the currently applied controller frame
across managed camera resize/reframing passes for both timeline and pointer
gesture controllers, even when the source progress signal is unchanged or a
drag has stopped moving.

## Opt-In Managed Stage Primitives

Use managed stage primitives only when a scene needs lit, scene-native geometry.
They live under a `WebGLScene`, have no fallback DOM, and are registered as
runtime-owned descriptors:

```tsx
import {
  WebGLLight,
  WebGLCamera,
  WebGLRuntime,
  WebGLScene,
  WebGLStagePlane,
} from "@project/dom-webgl-runtime/react";

<WebGLRuntime effects={runtimeEffects}>
  <WebGLScene
    id="world"
    projection="perspective-stage"
    render={{ camera: "world.camera" }}
  >
    <WebGLCamera
      id="world.camera"
      default
      type="perspective"
      mode="perspective-stage"
    />
    <WebGLStagePlane
      id="floor"
      role="floor"
      material={{ kind: "standard", color: "#05070a" }}
    />
    <WebGLLight
      id="hero"
      kind="point"
      intensity={1.8}
      position={[0, 0, 160]}
    />
  </WebGLScene>
</WebGLRuntime>;
```

`WebGLStagePlane`, `WebGLStageBox`, and `WebGLLight` create internal Three.js
meshes, geometry, materials, and lights without exposing raw handles. Do not
pass raw Three.js meshes, materials, geometries, lights, scenes, cameras, or
renderers. DOM targets can use `screen-plane` placement to project their DOM
rect center to a named stage plane without exposing raw raycasters, planes,
meshes, intersections, or cameras.

React nesting communicates managed scene ownership; it does not create a local
DOM viewport for that scene. Managed stage primitives currently render through
the runtime canvas and can be activated or hidden by higher-level scroll state,
and DOM-bound viewport/scissor clipping is available through `WebGLPassViewport`
plus a pass `viewport: { mode: "dom-rect" }` descriptor. Fully offscreen
DOM-bound passes are skipped rather than drawn as canvas-wide backgrounds.
Partially visible passes are clipped, not compressed into the visible slice.

Treat `WebGLStagePlane`, `WebGLStageBox`, and `WebGLLight` props as stable
scene declarations. They can mount, unmount, or change in ordinary React flows,
but they are not the high-frequency animation path. For animated stage, scene,
or light behavior, keep descriptor identity stable and route activation through
timeline bindings or managed effects/controllers rather than recreating meshes
and lights every frame. Camera behavior uses the explicit nested
`WebGLCamera.controller` descriptor; pass-bound camera controller scope remains
deferred.

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

## Transform Scope

Nested targets are ordered as a DOM-derived WebGL tree by default. Add
`transformScope: "subtree"` when the parent target's effect should move, rotate,
scale, hide, or best-effort fade its WebGL subtree:

```tsx
<WebGLTarget
  as="aside"
  webgl={{
    key: "card",
    source: { kind: "dom", type: "element" },
    transformScope: "subtree",
    lifecycle: { hideWhenReady: true, hideMode: "self" },
    effects: [{ kind: "app.cardSlide" }],
  }}
>
  <WebGLTarget
    as="strong"
    webgl={{
      key: "card.title",
      source: { kind: "dom", type: "text" },
      lifecycle: { hideWhenReady: true, hideMode: "self" },
      effects: [{ kind: "app.titleReveal" }],
    }}
  >
    Card title
  </WebGLTarget>
</WebGLTarget>
```

The parent group affects only declared WebGL descendants. Child targets keep
their own source/effect/texture/lifecycle ownership; a parent offscreen policy or
fallback hide does not dispose child renderables. `ctx.targetPointer` remains
layout-local to the current target; it is not rotated or inverse-transformed
subtree picking.

## Scene Gates

Scene gates are the advanced scroll-locking behavior. They are a historical
Phase 2 capability and an optional escape hatch for products that intentionally
want wheel/touch input to stop page scroll and drive `sceneProgress`.

They are not the recommended way to build a pinned section that drives an
effect. For that story, use `@project/dom-webgl-scroll-adapters/react`,
`WebGLScrollRuntime`, `ScrollEffectSection`, GSAP ScrollTrigger `pin`/`scrub`,
`WebGLScrollTimeline`, and `ctx.progress.get(progressKey)` /
`ctx.runtime.progress.get(progressKey)`.

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
