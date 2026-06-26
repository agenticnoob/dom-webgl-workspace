# Execution State

## Current Status
Phase 1 is complete through Task 37. Phase 2 is complete through Task 56: scene-gated scroll, scroll lock, `sceneProgress`, explicit reverse gate behavior, full verification, and final documentation alignment. Phase 3 is complete through Task 72: element snapshots, text snapshots, images, videos, and GLB models create runtime-owned visible scene objects; fallback visibility is tied to scene object readiness; demo coverage, public import boundaries, and final documentation alignment are complete. Phase 3.5 runtime performance and stage correction is implemented: the canvas is a fixed transparent internal WebGL viewport stage layer, the renderer owns the loop, layout reads are batched, snapshot/resource updates follow dirty/lifecycle boundaries, viewport lifecycle classification skips non-active work, and render target pooling is available behind an internal resource boundary. Phase 4 is now narrowed to DOM layout/content mapping: layout snapshots carry viewport/DPR signatures, renderer resize is cached, DOM invalidation observes target resize and viewport changes, placement-only style snapshots feed text/media layout, element snapshots are transparent anchors, media renderables use content-box texture placement with object-fit mapping, and the demo includes a public-API-only responsive harness. Phase 4.1 mapping takeover semantics are implemented: registered WebGL targets default to `hideWhenReady: true` plus `hideMode: "self"`, `hideWhenReady: false` is the opt-out, `hideMode: "subtree"` is an explicit subtree replacement request, and the fixed pointer-transparent canvas is inserted before author DOM with explicit canvas-below-DOM stacking instead of using a global DOM wrapper layer. Runtime viewport lifecycle disposal now restores fallback visibility before releasing a ready offscreen renderable, so hidden fallback DOM is not left invisible when WebGL resources are unloaded. Phase 5/6 historically added legacy effect/material declaration shapes and concrete package-owned visuals. Phase 7 historically introduced registry primitives. Phase 8 custom effect authoring and package boundary cleanup supersede those concrete package effects: user-authored effects are defined with `defineWebGLEffect(...)`, passed to the vanilla runtime or React adapter through runtime-level `effects`, receive managed layout/input/source/target/resource context, and core no longer auto-registers default visual effects. The 2026-06-22 runtime contract and modularity optimization is implemented: target effects are array-form only, legacy object-form `effects.material` / `effects.motion` compatibility is removed, image/video declarations are tied to real `<img>` / `<video>` targets, and explicit image/video declarations on non-media elements throw instead of silently falling back to snapshots. The same pass globally caps model vertex sampling, indexes text glyph command lookup by glyph id, extracts shared object3D controls, splits source-kind scene renderable controllers behind the existing compatibility export path, and moves per-target runtime bookkeeping into `targetRuntimeState.ts`. Unified source capability handles expose runtime-owned output handles for `snapshot/element`, `snapshot/text`, `image`, `video`, and `model/glb` while keeping concrete effects application-owned. Public target/model/common renderable handles include `setPosition(...)` scene-space control alongside visibility, rotation, scale, and opacity. The package exports no concrete effect implementations and no `@project/dom-webgl-runtime/effects` subpath; demo effects are local validation examples, while `apps/example` is the isolated React-only downstream consumer example for effect authoring. Current architecture direction remains explicit: DOM is the source for layout, content, accessibility, and interaction state; WebGL effects/materials are the source for final visual styling. The runtime should not expand CSS-to-WebGL paint fidelity. Offscreen resource policy is target-scoped. Far-offscreen targets restore native DOM fallback and dispose WebGL resources by default; near-offscreen parking is available through lifecycle offscreen policy for short warm resumes. Third-party scroll support now exposes a public adapter protocol in core and optional Lenis/GSAP/ScrollTrigger glue in `@project/dom-webgl-scroll-adapters`, while core keeps native scroll as the default and owns no direct third-party scroll dependency. `apps/demo` keeps its demo-local `useDemoSmoothScrollStack(...)` hook for the scroll gallery. `apps/example` dogfoods the high-level React adapter instead: `WebGLScrollRuntime` receives `exampleSmoothScrollOptions`, owns the built-in smooth stack, and `ScrollEffectSection` writes keyed pinned-section progress for `example.pinnedReveal`. The package boundary review fix keeps `createInitialPointerState` internal to the package rather than exporting it from the root public API, preserves query-string and hash variants in resource cache keys, and removes unused async/lifecycle helper state from `runtime.ts`.

Phase 2 plan file: `docs/PHASE2_SCENE_GATE_PLAN.md`.
Phase 3 visible renderables plan file: `docs/PHASE3_VISIBLE_RENDERABLE_PLAN.md`.
Phase 3.5 runtime performance and stage plan file: `docs/superpowers/plans/2026-06-18-phase-3-5-runtime-performance-and-stage.md`.
Phase 4 layout/content mapping plan file: `docs/superpowers/plans/2026-06-18-phase-4-dom-style-fidelity-responsive-mapping.md`.
Phase 5 effect/material layer plan file: `docs/superpowers/plans/2026-06-19-phase-5-effect-material-layer.md`.
Phase 6 modular surface materials plan file: `docs/superpowers/plans/2026-06-19-phase-6-modular-surface-materials.md`.
Phase 7 effect runtime primitives plan file: `docs/superpowers/plans/2026-06-19-phase-7-effect-runtime-primitives.md`.
Phase 8 custom effect authoring API plan file: `docs/superpowers/plans/2026-06-19-phase-8-custom-effect-authoring-api.md`.
Agent-facing package usage contract: `docs/agent/package-usage.md`.
React-only effect authoring example plan: `docs/superpowers/plans/2026-06-22-effect-authoring-examples.md`.
React-only effect authoring example guide: `docs/examples/effect-authoring.md`.
Cross-project reference notes: `docs/CODEX_WEB_REFERENCE_LEARNINGS.md`.

## Last Completed Task
Package boundary review fixes, documentation alignment, and commit-ready
verification.

## Latest Documentation Note
Package boundary review fixes keep pointer-state construction internal:
`createInitialPointerState` remains available to package internals such as the
React adapter, but is not exported from the root public API. Resource URL cache
keys now preserve query-string and hash variants, so app-local URLs such as
`/models/hero.glb?tenant=a`, `/models/hero.glb?tenant=b`, and
`/models/hero.glb#preview` acquire distinct records. The older absolute-origin
cache-key ambiguity remains tracked separately in `docs/REVIEW_BACKLOG.md`.
Runtime cleanup also removed unused async/lifecycle helper state that did not
participate in scheduling, debug state, or lifecycle decisions. Phase 8 makes
user-authored effects the public model. Core does not register
default visual effects; consumers pass `defineWebGLEffect(...)` definitions
through runtime-level `effects`. The package exports no concrete effect
implementations or effect preset subpath. The internal registry remains an
implementation detail. `docs/agent/package-usage.md` is the agent-first entry
for downstream package integration and custom effect authoring. Source
capability handles expose stable WebGL output controls for `snapshot/element`,
`snapshot/text`, `image`, `video`, and `model/glb`; target/model/common
renderable handles include scene-space `setPosition(...)`. Concrete visual
effects remain consumer-owned. Target effects use array-form declarations only;
legacy object-form `effects.material` / `effects.motion` is removed from the
public contract and runtime compiler. Explicit `image` and `video` source
declarations are reserved for real `img` and `video` targets; non-media elements
should use snapshot or model sources, and invalid media declarations now throw
clearly. Third-party scroll integration now uses the
public `WebGLScrollAdapter` protocol plus the optional
`@project/dom-webgl-scroll-adapters` package. Core keeps native page/gate scroll
as the default and does not import Lenis, GSAP, or ScrollTrigger. The optional
adapter package now exposes `createLenisGsapScrollStack(...)` to compose Lenis
metrics, GSAP ticker driving, and ScrollTrigger update/refresh/proxy bridging
behind one opt-in lifecycle object. `apps/demo` still uses that manual route for
`ScrollZoomImage` through `useDemoSmoothScrollStack(...)`, where the demo owns
the Lenis instance lifecycle and passes it to the adapter stack with
`manageLenis: false`; the hook currently uses `lerp: 0.055` and
`wheelMultiplier: 0.85` for a more responsive smooth-scroll feel. `apps/example`
uses the high-level `WebGLScrollRuntime smooth={exampleSmoothScrollOptions}`
route instead, so the React adapter owns the built-in smooth stack and each
`ScrollEffectSection` owns only its bounded pinned trigger. The gallery moves
through the local `demo.scrollGallery` effect rather than CSS transform
animation or CSS progress variables. Runtime lifecycle disposal
restores fallback visibility before unloading ready offscreen renderables.
Offscreen resource policy is target-scoped: far-offscreen targets restore native
DOM fallback and dispose resources by default; near-offscreen parking enables
short warm resumes before fallback restore or disposal. `apps/example` now
serves as the React-only downstream consumer example for effect authoring. It
uses only public runtime, React, and optional scroll-adapter entrypoints,
dogfoods the high-level pinned scroll React adapter surface with
`WebGLScrollRuntime`, `ScrollEffectSection`, stable `progressKey` data, and
effect reads through `ctx.progress.get(progressKey)`, defines a full-width
vertical catalog of local `example.surfaceFill`, `example.surfacePulse`,
`example.textWave`, `example.textReveal`, `example.imagePan`,
`example.imageZoom`, `example.videoPlayback`, `example.videoDrift`,
`example.modelSpin`, `example.modelFloat`, and `example.pinnedReveal` effects,
presents the example
page with Chinese visible copy while keeping source/effect identifiers in
English as API data, keeps each effect in one viewport-wide row with a reusable
click-to-expand explanation overlay on the effect surface and no outer catalog
shell padding, uses `/example/bg.png` for
the element surface-fill
example without applying opacity to the whole target, keeps surface-pulse
visibility in surface-layer drawing without changing target or DOM child
opacity, and does not rely on app CSS to keep real DOM children above WebGL
surfaces because the React adapter owns the DOM content layer above the canvas.
It also records current authoring friction in
`docs/agent/effect-authoring-example-report.md`.

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
- Task 36: Full Check.
- Task 37: Documentation Alignment.
- Task 38: Public Scene Gate Types.
- Task 39: Scroll Declaration Normalization.
- Task 40: Scene Gate Start Matching.
- Task 41: Forward Gate Progress State.
- Task 42: Reverse Gate Behavior.
- Task 43: Scroll Delta Normalization.
- Task 44: Scroll Lock Controller.
- Task 45: Scene Gate Scroll Controller.
- Task 46: Browser Scroll Event Routing.
- Task 47: Frame Input Carries Gate State.
- Task 48: Runtime Registers Gate Targets.
- Task 49: Debug State Reports Gate Mode.
- Task 50: Runtime Cleanup Releases Scroll Lock.
- Task 51: React Gate Declaration Smoke.
- Task 52: Demo Declares A Scene Gate.
- Task 53: Demo Debug Panel Shows Gate State.
- Task 54: SSR And Import Boundary Regression.
- Task 55: Phase 2 Full Verification.
- Task 56: Phase 2 Documentation Alignment.
- Task 57: Internal Scene Object Contract.
- Task 58: DOM Rect Projection.
- Task 59: Lifecycle Hide Mode Types.
- Task 60: DOM Fallback Visibility Controller.
- Task 61: Runtime Applies Fallback Visibility Only After WebGL Ready.
- Task 62: Element Snapshot Scene Plane.
- Task 63: Text Snapshot Scene Plane.
- Task 64: Image Scene Plane.
- Task 65: Video Scene Plane.
- Task 66: GLB Model Scene Object.
- Task 67: Internal Render Policy Ordering.
- Task 68: Runtime Renders Scene On Sync.
- Task 69: React And Demo Visible Smoke.
- Task 70: SSR And Public Boundary Regression.
- Task 71: Phase 3 Full Verification.
- Task 72: Phase 3 Documentation Alignment.
- Task 73: Public Effect/Material Declaration Types.
- Task 74: Internal Effect Normalization And Controller.
- Task 75: Scene Object Effect Target Surface.
- Task 76: Runtime Effect Pipeline Integration.
- Task 77: Demo Effect/Material Harness.
- Task 78: Phase 5 Documentation Alignment.
- Task 79: Viewport Pointer Input Correction.
- Task 80: Phase 7 Effect Runtime Primitives.
- Task 81: Phase 8 Custom Effect Authoring API.
- Task 82: Phase 8 Package Effect Boundary Cleanup.

## Current Task
React-only effect authoring examples are implemented as an isolated downstream
consumer pass in `apps/example`. Package exports still provide only
authoring/runtime primitives and runtime-owned output handles; concrete effects
remain owned by applications, demos, or documentation examples. `apps/example`
must stay separate from `apps/demo`: demo remains the package validation surface,
while example is the package usage surface. The current example layout is a
full-width vertical effect catalog where each effect occupies one viewport-wide
row with a reusable click-to-expand explanation overlay on the effect surface
and no outer catalog shell padding. Phase 6.3
remains a decision gate only and should not start unless a specific surface
detail such as border, shadow, texture quality, or cache tuning is explicitly
approved.

## Phase 8 Package Effect Boundary Cleanup
- Completed work: Removed the `@project/dom-webgl-runtime/effects` package
  subpath, deleted package-owned concrete effect preset implementations and
  unused pointer/effect-normalization helpers, moved demo visual effects into
  local `apps/demo/src/demoEffects.ts` consumer code, updated runtime/demo tests
  to use inline or demo-owned effect definitions, and tightened the demo import
  boundary so `@project/dom-webgl-runtime/effects` is rejected.
- Verification: `npm run typecheck` passed; `npm test -- --run` passed with 60
  test files / 293 tests; `npm run build` passed with the existing non-blocking
  Vite chunk-size warning; `npm run check:imports` passed with `Demo import
  boundary OK`; `git diff --check` passed.
- Boundary notes: `@project/dom-webgl-runtime` keeps `defineWebGLEffect(...)`,
  runtime-level `effects`, context/source/target/resource types, and lifecycle
  dispatch. It does not export concrete effect implementations or an official
  effect preset subpath.
- Demo update: The GLB demo target currently consumes a local
  `demo.glbRotate` plus `demo.glbVertexParticles` from
  `apps/demo/src/demoEffects.ts`. The rotate effect rotates the model object on
  the y axis using seconds-based timing, so the demo avoids a flat screen-plane
  spin. The vertex particle effect samples the GLB vertices, hides the original
  source meshes, renders only the attached point cloud, and uses pointer movement
  to scatter particles only after the pointer hits a particle-sized local radius,
  then damps and springs them back to their source vertices. Core still does not
  ship a concrete particle system. The public GLB `createPointCloud(...)` helper
  now samples mesh vertices in the model root coordinate space, so child mesh
  transforms are preserved, and accepts numeric Three.js color values plus CSS
  color strings such as `rgb(125, 211, 252)`.

## Phase 8 Custom Effect Authoring API
- Completed work: Added `defineWebGLEffect(...)`, public effect context/source/
  target/resource types, runtime-level `effects`, React `<WebGLRuntime
  effects={...}>`, definition-based internal registry dispatch, setup/update/
  dispose lifecycle state, renderable source handles, GLB model source handles,
  managed effect resources, generic target handles, and demo usage through
  local consumer-owned effect examples. Post-implementation demo hardening made the demo's runtime
  effect definition array stable across debug-state re-renders, preventing
  `<WebGLTarget />` children from registering against a disposed runtime.
- Verification: `npm run typecheck` passed; `npm test -- --run` passed with 62
  test files / 299 tests; `npm run build` passed with the existing non-blocking
  Vite chunk-size warning; `npm run check:imports` passed with `Demo import
  boundary OK`; `git diff --check` passed.
- Boundary notes: Core registers no default visual effects and the package
  exports no concrete effects. The Three-backed model source handle lives beside
  the GLB renderable adapter to preserve the pure effects boundary. No
  demo-specific runtime branch, public renderer/camera/scene mutation, multiple
  canvas path, picking path, third-party scroll adapter, or CSS paint cloning was
  added.

## Phase 7 Effect Runtime Primitives
- Historical completed work: Added ordered effect declarations, a legacy
  declaration compiler, registry and capability primitives, package-owned
  built-in plugin experiments, runtime-level `effectRegistry` injection, React
  `<WebGLRuntime effectRegistry={registry}>` forwarding, root public
  registry/plugin exports, and demo array-effect declarations.
- Verification: Focused effect/runtime/demo tests passed during implementation.
  Superseded by Phase 8 final verification: 62 test files / 299 tests passed,
  typecheck passed, build passed, demo import boundary passed, and
  `git diff --check` passed.
- Boundary notes: This public registry/built-in plugin model is superseded by
  Phase 8 authoring plus package boundary cleanup. The internal registry remains
  dispatch machinery, but consumers provide definitions through runtime-level
  `effects`. The forward target declaration contract keeps array-form effects
  only; legacy object-form effect compatibility has been removed.

## Phase 6.1 Effect Core Boundary Refactor
- Historical completed work: Extracted effect normalization, compatibility,
  target capability types, pointer tilt motion, and element-plane effect target
  adapter without changing public behavior.
- Verification: `npm run test -- --run` passed with 58 test files / 275 tests;
  `npm run typecheck` passed; `npm run build` passed with the existing
  non-blocking Vite chunk-size warning; `npm run check:imports` passed with
  `Demo import boundary OK`; `git diff --check` passed.
- Boundary notes: The package boundary cleanup later removed the unused
  package-owned normalization and pointer-motion helpers. Legacy declaration
  compatibility is historical and has been removed; matching concrete effects
  must be user-provided through array-form target declarations.

## Phase 6.2 Minimal Surface Material
- Historical completed work: Added public minimal `surface` material declaration
  shape, normalization, compatibility checks, controller dispatch,
  element-plane surface texture rendering, demo harness, and documentation
  alignment.
- Verification: `npm run test -- --run`, `npm run typecheck`,
  `npm run build`, `npm run check:imports`, and `git diff --check` passed.
- Boundary notes: The declaration shape is historical input removed from the
  current public contract, and the package no longer exports or auto-registers a
  concrete `surface` effect.

## Phase 5 Public Minimum Effect/Material Checklist
- Historical checklist, superseded by Phase 8 package boundary cleanup:
  `WebGLDeclaration.effects` and `WebGLEffectsDeclaration` continue as the
  public array-form target effect surface. Legacy `WebGLMaterialDeclaration`
  and `WebGLMotionDeclaration` are removed public compatibility artifacts.
  Package-owned `solid`, `surface`, and `pointer-tilt` implementations were
  removed.
- Legacy object-form declarations are not the forward contract and no longer
  compile into effect entries. Consumers pass matching `defineWebGLEffect(...)`
  definitions through runtime-level `effects`.
- Effect targets remain internal renderable/scene object state and are not
  exported from root or React public entrypoints.
- Demo effect usage now goes through local consumer-owned definitions in
  `apps/demo/src/demoEffects.ts`, including the GLB original-model rotation and
  pointer-scattered vertex-particle model replacement on `demo.model`.
- Still out of scope: shader authoring API, core-provided particle systems,
  core-owned Lenis/GSAP/ScrollTrigger integrations, WebGL raycast picking,
  multiple canvases, public Three.js render flags, and CSS-to-WebGL fidelity
  expansion.

## Phase 5 Completed Task Record
- Historical completed work: Added public effect/material declaration types, an
  internal built-in effect normalizer/controller, internal scene object effect
  targets, runtime effect pipeline updates, target-scoped incompatible-source
  errors, a public-API-only demo effect harness, and Phase 5 documentation
  alignment.
- Files changed: public types/exports, internal effect controller, renderable
  interfaces, scene renderable object helpers, runtime pipeline, demo app/CSS
  and tests, README, goal docs, execution state, and the Phase 5 plan.
- Verification: `npm run test -- --run` passed with 53 test files / 266 tests;
  `npm run typecheck` passed; `npm run build` passed with the existing
  non-blocking Vite chunk-size warning; `npm run check:imports` passed with
  `Demo import boundary OK`; `git diff --check` passed.
- Boundary notes: The package-owned concrete effect implementation from this
  phase is superseded and removed. No demo keys, demo asset paths, demo DOM
  structure, shader authoring API, particle system, Lenis/GSAP/ScrollTrigger
  adapter, WebGL raycast picking, multiple-canvas path, public Three.js render
  flags, or CSS-to-WebGL fidelity expansion were introduced into runtime/package
  implementation.

## Post-Phase 5 Pointer Input Correction
- Completed work: Split pointer event listening from pointer coordinate
  normalization. The default runtime now listens through the owning document and
  normalizes pointer coordinates against the fixed viewport canvas instead of the
  runtime container element.
- Files changed: `pointerController.ts`, `runtime.ts`, runtime pipeline tests,
  README, goal docs, and execution state.
- Verification: The regression test first failed because document-level
  `pointermove` events did not update runtime pointer state. After the fix,
  `npm run test -- --run` passed with 53 test files / 267 tests;
  `npm run typecheck` passed; `npm run build` passed with the existing
  non-blocking Vite chunk-size warning; `npm run check:imports` passed with
  `Demo import boundary OK`; `git diff --check` passed.
- Boundary notes: No per-renderable pointer listeners, picking path, custom
  effect registry, public Three.js render flags, third-party scroll adapter,
  multiple-canvas path, or demo-specific runtime branch was added.

## Phase 4.2 DOM Layout/Content And Effect-Owned Visuals Checklist
- DOM is the source for layout, content, accessibility, and interaction state.
- WebGL effects/materials are the source for final visual styling.
- Runtime DOM reads should prioritize border boxes, content boxes, text/media/model
  sources, ordering, visibility, lifecycle, scroll, pointer, and placement-only
  style data such as padding, object-fit/object-position, font metrics, line
  height, and text alignment.
- Background color, borders, border radius, shadows, gradients, filters, blend
  modes, decorative opacity, transitions, deformations, and shader appearance
  should be represented by effect/material declarations instead of arbitrary CSS
  cloning.
- The former Phase 4 CSS box canvas paint path has been removed from the active
  runtime; it remains only as historical context in the Phase 4 plan.
- `apps/demo` remains a public API consumer and must not drive runtime behavior
  through demo keys, class names, asset paths, or DOM structure.

## Phase 4 DOM Layout/Content And Responsive Mapping Checklist
- Layout snapshots include CSS rect, viewport size, capped DPR, and layout signatures.
- DOM projection preserves fractional CSS-pixel coordinates.
- Renderer host caches viewport size, DPR, and orthographic projection updates.
- Renderer projection uses the fixed canvas's actual rendered CSS box, not raw
  `window.innerWidth`, so scrollbar gutters do not introduce DOM/WebGL drift.
- DOM invalidation is target-scoped to resize and viewport changes; DOM
  `style` / `class` mutations are intentionally not tracked after initial style
  capture.
- Element snapshots are transparent DOM anchors and do not render CSS box paint.
- Transparent layout-only element snapshots remain invisible instead of painting
  black or opaque planes.
- Text snapshots consume initial DOM style snapshots only for placement-critical
  font, line height, padding, alignment, letter spacing, word spacing,
  white-space handling, and DPR. DOM text color is ignored by the runtime paint
  path.
- Image and video renderables place media texture planes in the CSS content box
  and apply common `object-fit` and `object-position` mapping inside that
  content box. They do not keep CSS-painted backing planes.
- Registered WebGL targets default to `hideWhenReady: true` and
  `hideMode: "self"` after visual readiness.
- `hideWhenReady: false` keeps mapped DOM fallback visible, and
  `hideMode: "subtree"` explicitly hides descendants.
- The fixed WebGL canvas remains `pointer-events: none`; the renderer keeps it
  below native DOM, and the React adapter owns a stable content layer above the
  canvas so unregistered DOM keeps native visual order and pointer interaction.
- Parent `hideMode: "self"` containers preserve ordinary child DOM but do not
  override nested WebGL targets that already manage fallback visibility.
- WebGL-owned text should not be placed behind native semi-transparent DOM
  surfaces. A WebGL-owned marker or card should use an element snapshot parent
  with `hideMode: "self"` for the surface and put `snapshot/text` on the actual
  text-bearing child element so surface and text share the same WebGL ownership
  layer.
- Demo layout/content targets use only public `WebGLTarget` declarations.
- Deferred and no longer preferred as the primary roadmap: full DOM subtree
  rasterization, pseudo-elements, gradients, filters, backdrop filters, masks,
  clip paths, blend modes, multiple shadows, matrix-level transform reproduction,
  and full browser CSS cloning. Future visual work should favor effect/material
  declarations over CSS fidelity expansion.
- Still deferred as implementation features: effect registry, animation layer,
  third-party scroll adapters, raycast picking, multiple canvases, and public
  Three.js render flags.

## Phase 4 Completed Task Record
- Completed work: Added layout snapshots with viewport/DPR signatures, cached renderer resize, target-scoped resize/viewport invalidation, placement-only DOM style snapshots, transparent element anchors, text placement style consumption including spacing and white-space handling, media content-box placement/object-fit mapping, runtime dirty-key invalidation, a responsive demo layout/content harness, and Phase 4.1 mapped-target default fallback takeover semantics.
- Files changed: runtime DOM/renderer/renderable internals, renderable tests, runtime pipeline tests, demo app/CSS/tests, README, goal docs, execution state, and the Phase 4 plan checklist.
- Verification: `npm test -- --run` passed with 53 test files / 253 tests; `npm run typecheck` passed; `npm run build` passed with the existing non-blocking Vite chunk-size warning; `npm run check:imports` passed with `Demo import boundary OK`; `git diff --check` passed.
- Boundary notes: No demo keys, demo asset paths, demo DOM structure, effect registry, animation/effect layer, Lenis/GSAP/ScrollTrigger adapter, WebGL raycast picking, multiple-canvas path, or public Three.js render flags were introduced into runtime/package implementation.

## Phase 3.5 Runtime Performance And Stage Checklist
- Canvas is a fixed transparent internal viewport stage layer, not document-flow content.
- Renderer uses transparent stage defaults and a DPR cap.
- Runtime owns one renderer loop through `setAnimationLoop`.
- React does not own a frame loop.
- Layout reads are batched.
- Snapshot content rebuilds only on dirty invalidation.
- Text snapshot canvases are sized from measured DOM text boxes and use
  computed font, line height, padding, alignment, text spacing, and white-space
  handling to avoid stretched fixed-size text textures.
- Lifecycle state separates resource status from target activity.
- Hidden/inactive targets skip high-cost updates.
- Resources and render targets dispose deterministically.

## Phase 3.5 Completed Task Record
- Completed work: Fixed transparent canvas stage placement, renderer performance defaults, renderer-owned loop, batched layout pass, dirty snapshot content boundary, text snapshot style/texture sizing, lifecycle debug state, viewport lifecycle classification, render target pool, demo stage CSS, and documentation alignment.
- Files changed: runtime renderer, React runtime wrapper, renderables, resources, demo CSS/tests, public/debug types, and status docs.
- Verification: targeted Phase 3.5 tests passed with 16 files / 75 tests; full Vitest suite passed with 45 files / 212 tests; `npm run typecheck` passed; `npm run build` passed with the existing Vite chunk-size warning; `npm run check:imports` passed with `Demo import boundary OK`; `git diff --check` passed.
- Boundary notes: No effect registry, animation/effect layer, Lenis/GSAP/ScrollTrigger adapter, WebGL raycast picking, multiple-canvas path, or public Three.js render flags were introduced.

## Completed Task Record
- Completed task: Task 37: Documentation Alignment.
- Files changed: `README.md`, `docs/00-goal.md`, `docs/IMPLEMENTATION_PLAN.md`, `docs/EXECUTION_STATE.md`
- Commands run: `npm run check && git diff --check` (pre-doc baseline); `npm run check && git diff --check` (post-doc verification)
- Test result: verification command passed before and after the doc edits; the task-specific RED condition was documentation drift captured by the checklist recorded before editing.
- Next task: None. Phase 1 implementation plan is fully checked off.
- Known issues at Phase 1 completion: no blocking issues introduced. Existing non-blocking limitations remained: the demo still used DOM fallback as the visible surface, and scene-gated scroll/effects were future work at that point.

## Phase 2 Planning Record
- Phase 2 scope now allows planning and implementation of scene-gated scroll, scroll lock, `sceneProgress`, and explicit reverse gate behavior.
- Phase 2 plan starts at Task 38 in `docs/PHASE2_SCENE_GATE_PLAN.md`.
- Phase 2 public type contract is complete through Task 38.
- Next task: Task 39: Scroll Declaration Normalization.

## Phase 2 Completed Task Record
- Completed task: Task 38: Public Scene Gate Types.
- Files changed: `packages/dom-webgl-runtime/src/lib/types.ts`, `packages/dom-webgl-runtime/src/lib/types.test.ts`, `packages/dom-webgl-runtime/src/lib/runtime-state.test.ts`, `packages/dom-webgl-runtime/src/publicExports.test.ts`, `packages/dom-webgl-runtime/src/index.ts`, `packages/dom-webgl-runtime/src/lib/input/frameInput.test.ts`, `docs/PHASE2_SCENE_GATE_PLAN.md`, `docs/EXECUTION_STATE.md`.
- Commands run: `npm test -- --run packages/dom-webgl-runtime/src/lib/types.test.ts packages/dom-webgl-runtime/src/lib/runtime-state.test.ts packages/dom-webgl-runtime/src/publicExports.test.ts` (RED before implementation); `npm test -- --run packages/dom-webgl-runtime/src/lib/types.test.ts packages/dom-webgl-runtime/src/lib/runtime-state.test.ts packages/dom-webgl-runtime/src/publicExports.test.ts && npm run typecheck` (GREEN after implementation and review fix).
- Review: spec review required removing gate `pageProgress` and exporting `WebGLGateScrollBehavior`; code quality review approved with no issues.
- Next task: Task 39: Scroll Declaration Normalization.
- Completed task: Task 39: Scroll Declaration Normalization.
- Files changed: `packages/dom-webgl-runtime/src/lib/input/scrollDeclaration.ts`, `packages/dom-webgl-runtime/src/lib/input/scrollDeclaration.test.ts`, `packages/dom-webgl-runtime/src/lib/dom/targetDescriptor.ts`, `packages/dom-webgl-runtime/src/lib/dom/targetDescriptor.test.ts`, `docs/PHASE2_SCENE_GATE_PLAN.md`, `docs/EXECUTION_STATE.md`.
- Commands run: `npm test -- --run packages/dom-webgl-runtime/src/lib/input/scrollDeclaration.test.ts packages/dom-webgl-runtime/src/lib/dom/targetDescriptor.test.ts` (RED before implementation); `npm test -- --run packages/dom-webgl-runtime/src/lib/input/scrollDeclaration.test.ts packages/dom-webgl-runtime/src/lib/dom/targetDescriptor.test.ts && npm run typecheck` (GREEN after implementation and review follow-up).
- Review checkpoint: spec review approved; code quality review approved with minor non-blocking notes. Added `Infinity` duration coverage after review.
- Next task: Task 40: Scene Gate Start Matching.
- Completed task: Task 40: Scene Gate Start Matching.
- Files changed: `packages/dom-webgl-runtime/src/lib/input/sceneGate.ts`, `packages/dom-webgl-runtime/src/lib/input/sceneGate.test.ts`, `docs/PHASE2_SCENE_GATE_PLAN.md`, `docs/EXECUTION_STATE.md`.
- Commands run: `npm test -- --run packages/dom-webgl-runtime/src/lib/input/sceneGate.test.ts` (RED before implementation; GREEN after implementation).
- Review: spec review and code quality review approved with no issues.
- Next task: Task 41: Forward Gate Progress State.
- Completed task: Task 41: Forward Gate Progress State.
- Files changed: `packages/dom-webgl-runtime/src/lib/input/sceneGate.ts`, `packages/dom-webgl-runtime/src/lib/input/sceneGate.test.ts`, `docs/PHASE2_SCENE_GATE_PLAN.md`, `docs/EXECUTION_STATE.md`.
- Commands run: `npm test -- --run packages/dom-webgl-runtime/src/lib/input/sceneGate.test.ts` (RED before implementation; GREEN after implementation and review follow-up).
- Review: initial spec review requested explicit inactive state coverage; code quality review suggested locking the no-reverse boundary. Added inactive and negative-delta no-op tests; re-review approved.
- Next task: Task 42: Reverse Gate Behavior.
- Completed task: Task 42: Reverse Gate Behavior.
- Files changed: `packages/dom-webgl-runtime/src/lib/input/sceneGate.ts`, `packages/dom-webgl-runtime/src/lib/input/sceneGate.test.ts`, `docs/PHASE2_SCENE_GATE_PLAN.md`, `docs/EXECUTION_STATE.md`.
- Commands run: `npm test -- --run packages/dom-webgl-runtime/src/lib/input/sceneGate.test.ts` (RED before implementation; GREEN after implementation and review follow-up).
- Review: spec review approved; code quality review approved with minor notes. Kept `releaseDirection: "backward"` to match the task wording and added reverse-active positive-delta no-op coverage.
- Next task: Task 43: Scroll Delta Normalization.
- Completed task: Task 43: Scroll Delta Normalization.
- Files changed: `packages/dom-webgl-runtime/src/lib/input/scrollDelta.ts`, `packages/dom-webgl-runtime/src/lib/input/scrollDelta.test.ts`, `docs/PHASE2_SCENE_GATE_PLAN.md`, `docs/EXECUTION_STATE.md`.
- Commands run: `npm test -- --run packages/dom-webgl-runtime/src/lib/input/scrollDelta.test.ts` (RED before implementation; GREEN after implementation and review follow-up).
- Review: spec review approved; code quality review approved with minor note. Replaced raw wheel `deltaMode` numbers with local constants.
- Next task: Task 44: Scroll Lock Controller.
- Completed task: Task 44: Scroll Lock Controller.
- Files changed: `packages/dom-webgl-runtime/src/lib/input/scrollLock.ts`, `packages/dom-webgl-runtime/src/lib/input/scrollLock.test.ts`, `docs/PHASE2_SCENE_GATE_PLAN.md`, `docs/EXECUTION_STATE.md`.
- Commands run: `npm test -- --run packages/dom-webgl-runtime/src/lib/input/scrollLock.test.ts` (RED before implementation; GREEN after implementation).
- Review checkpoint: spec review approved; code quality review approved with no issues.
- Next task: Task 45: Scene Gate Scroll Controller.
- Completed task: Task 45: Scene Gate Scroll Controller.
- Files changed: `packages/dom-webgl-runtime/src/lib/input/scrollController.ts`, `packages/dom-webgl-runtime/src/lib/input/scrollController.test.ts`, `packages/dom-webgl-runtime/src/lib/input/pageScroll.ts`, `packages/dom-webgl-runtime/src/lib/input/pageScroll.test.ts`, `packages/dom-webgl-runtime/src/lib/input/frameInput.ts`, `docs/PHASE2_SCENE_GATE_PLAN.md`, `docs/EXECUTION_STATE.md`.
- Commands run: `npm test -- --run packages/dom-webgl-runtime/src/lib/input/pageScroll.test.ts packages/dom-webgl-runtime/src/lib/input/scrollController.test.ts` (RED before implementation for missing controller/helpers; GREEN after implementation); `npm run typecheck` (RED during review fix for missing generic `ScrollStateController`, GREEN after fix); `git diff --check` (GREEN).
- Review checkpoint: spec review approved. Code quality review requested a generic `ScrollStateController` frame-input port and stronger controller boundary tests; re-review approved with no remaining issues.
- Next task: Task 46: Browser Scroll Event Routing.
- Completed task: Task 46: Browser Scroll Event Routing.
- Files changed: `packages/dom-webgl-runtime/src/lib/input/scrollController.ts`, `packages/dom-webgl-runtime/src/lib/input/scrollController.test.ts`, `packages/dom-webgl-runtime/src/lib/input/scrollDelta.ts`, `packages/dom-webgl-runtime/src/lib/input/scrollDelta.test.ts`, `docs/PHASE2_SCENE_GATE_PLAN.md`, `docs/EXECUTION_STATE.md`.
- Commands run: `npm test -- --run packages/dom-webgl-runtime/src/lib/input/scrollDelta.test.ts packages/dom-webgl-runtime/src/lib/input/scrollController.test.ts` (RED before implementation for missing touch helper and browser listener routing; GREEN after implementation); `npm test -- --run packages/dom-webgl-runtime/src/lib/input/scrollDelta.test.ts packages/dom-webgl-runtime/src/lib/input/scrollController.test.ts && npm run typecheck` (RED once for listener option typing, GREEN after fix).
- Review checkpoint: self-review kept browser event routing inside the input layer, with optional injected event target wiring, no third-party scroll adapter, no effect layer, no picking, and no renderer/public Three.js policy exposure.
- Next task: Task 47: Frame Input Carries Gate State.
- Completed task: Task 47: Frame Input Carries Gate State.
- Files changed: `packages/dom-webgl-runtime/src/lib/input/frameInput.test.ts`, `docs/PHASE2_SCENE_GATE_PLAN.md`, `docs/EXECUTION_STATE.md`.
- Commands run: `npm test -- --run packages/dom-webgl-runtime/src/lib/input/frameInput.test.ts` (new gate snapshot coverage passed against the existing frame input clone behavior); `npm test -- --run packages/dom-webgl-runtime/src/lib/input/frameInput.test.ts && npm run typecheck` (green Task 47 verification).
- Review checkpoint: existing frame input cloning already preserved the page/gate scroll union immutably, so no production code change was needed. The new test locks gate `mode`, `activeGateKey`, `sceneProgress`, and snapshot immutability while keeping existing page-mode coverage.
- Next task: Task 48: Runtime Registers Gate Targets.
- Completed task: Task 48: Runtime Registers Gate Targets.
- Files changed: `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`, `packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts`, `docs/PHASE2_SCENE_GATE_PLAN.md`, `docs/EXECUTION_STATE.md`.
- Commands run: `npm test -- --run packages/dom-webgl-runtime/src/lib/renderer/runtime.test.ts packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts packages/dom-webgl-runtime/src/lib/input/scrollController.test.ts && npm run typecheck` (RED before implementation for missing runtime gate target registration; GREEN after implementation and test type fix).
- Review checkpoint: runtime now creates the Phase 2 scroll controller by default, forwards gate target registration/unregistration from normalized target descriptors, and keeps the existing injected scroll-state test seam compatible.
- Next task: Task 49: Debug State Reports Gate Mode.
- Completed task: Task 49: Debug State Reports Gate Mode.
- Files changed: `packages/dom-webgl-runtime/src/lib/debug/debugState.ts`, `packages/dom-webgl-runtime/src/lib/debug/debugState.test.ts`, `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`, `packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts`, `docs/PHASE2_SCENE_GATE_PLAN.md`, `docs/EXECUTION_STATE.md`.
- Commands run: `npm test -- --run packages/dom-webgl-runtime/src/lib/debug/debugState.test.ts packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts && npm run typecheck` (RED before implementation for missing `activeGateKey` and `sceneProgress` in debug state; GREEN after implementation and type fix).
- Review checkpoint: debug state now copies gate-only fields from `frameInput.scroll` when current scroll mode is `gate`, omits them in page mode, and does not expose effect or renderer internals.
- Next task: Task 50: Runtime Cleanup Releases Scroll Lock.
- Completed task: Task 50: Runtime Cleanup Releases Scroll Lock.
- Files changed: `packages/dom-webgl-runtime/src/lib/input/scrollController.ts`, `packages/dom-webgl-runtime/src/lib/input/scrollController.test.ts`, `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`, `packages/dom-webgl-runtime/src/lib/renderer/runtime.test.ts`, `docs/PHASE2_SCENE_GATE_PLAN.md`, `docs/EXECUTION_STATE.md`.
- Commands run: `npm test -- --run packages/dom-webgl-runtime/src/lib/renderer/runtime.test.ts packages/dom-webgl-runtime/src/lib/input/scrollController.test.ts packages/dom-webgl-runtime/src/lib/debug/debugState.test.ts && npm run typecheck` (RED before implementation for active gate unregister/cleanup release gaps; GREEN after adding the shared release path and debug scroll-state refresh).
- Review checkpoint: active gate release is now idempotent across gate unregister, visibility hidden, runtime disposal, and renderable update errors. Debug error reporting remains intact, and the implementation adds no effect registry, animation/effect layer, third-party scroll adapter, picking, multiple canvas, or public Three.js render flags.
- Next task: Task 51: React Gate Declaration Smoke.
- Completed task: Task 51: React Gate Declaration Smoke.
- Files changed: `packages/dom-webgl-runtime/src/lib/react/WebGLTarget.test.tsx`, `docs/PHASE2_SCENE_GATE_PLAN.md`, `docs/EXECUTION_STATE.md`.
- Commands run: `npm test -- --run packages/dom-webgl-runtime/src/lib/react/WebGLTarget.test.tsx` (new React gate declaration smoke coverage passed against existing adapter behavior); `npm test -- --run packages/dom-webgl-runtime/src/lib/react/WebGLTarget.test.tsx && npm run typecheck` (green Task 51 verification).
- Review checkpoint: React remains a thin public adapter. `WebGLTarget` forwards the public `webgl` prop unchanged to the runtime, and the runtime descriptor normalization preserves the gate declaration with trimmed `start`, positive `duration`, and explicit release policy. No React-specific gate behavior or internal imports were added.
- Next task: Task 52: Demo Declares A Scene Gate.
- Completed task: Task 52: Demo Declares A Scene Gate.
- Files changed: `apps/demo/src/App.tsx`, `apps/demo/src/App.test.tsx`, `docs/PHASE2_SCENE_GATE_PLAN.md`, `docs/EXECUTION_STATE.md`.
- Commands run: `npm test -- --run apps/demo/src/App.test.tsx apps/demo/src/demo-import-boundary.test.ts` (RED before implementation: no demo target had a gate scroll declaration); `npm test -- --run apps/demo/src/App.test.tsx apps/demo/src/demo-import-boundary.test.ts && npm run check:imports` (green Task 52 verification).
- Review checkpoint: the demo now declares one scene gate on `demo.surface` through the public `WebGLTarget` `webgl` prop, with `start: "top top"`, positive `duration`, and explicit `release`. Demo imports still use only public package entrypoints, with no internal runtime imports or effect code.
- Next task: Task 53: Demo Debug Panel Shows Gate State.
- Completed task: Task 53: Demo Debug Panel Shows Gate State.
- Files changed: `apps/demo/src/debugPanel.tsx`, `apps/demo/src/debugPanel.test.tsx`, `docs/PHASE2_SCENE_GATE_PLAN.md`, `docs/EXECUTION_STATE.md`.
- Commands run: `npm test -- --run apps/demo/src/debugPanel.test.tsx apps/demo/src/App.test.tsx` (RED before implementation: gate mode did not render active gate key or scene progress); `npm test -- --run apps/demo/src/debugPanel.test.tsx apps/demo/src/App.test.tsx && npm run typecheck` (green Task 53 verification).
- Review checkpoint: the demo debug panel now renders current scroll mode, active gate key, and two-decimal scene progress from public `WebGLDebugState` only. Page mode suppresses gate-only fields to avoid stale active gate display. No internal imports or runtime behavior changes were added.
- Next task: Task 54: SSR And Import Boundary Regression.
- Completed task: Task 54: SSR And Import Boundary Regression.
- Files changed: `packages/dom-webgl-runtime/src/lib/renderer/runtime.test.ts`, `packages/dom-webgl-runtime/src/publicExports.test.ts`, `docs/PHASE2_SCENE_GATE_PLAN.md`, `docs/EXECUTION_STATE.md`.
- Commands run: `npm test -- --run packages/dom-webgl-runtime/src/lib/renderer/runtime.test.ts packages/dom-webgl-runtime/src/publicExports.test.ts apps/demo/src/demo-import-boundary.test.ts` (new React public import SSR regression passed against existing production code; one added type fixture initially failed due test temp-directory React resolution, then the fixture was corrected); `npm test -- --run packages/dom-webgl-runtime/src/lib/renderer/runtime.test.ts packages/dom-webgl-runtime/src/publicExports.test.ts apps/demo/src/demo-import-boundary.test.ts && npm run check:imports && npm run typecheck` (green Task 54 verification).
- Review checkpoint: public root and React entrypoint imports remain SSR-safe under throwing browser-global getters, the React public type surface accepts gate declarations without exposing runtime internals, and the demo import-boundary check remains green. No browser-only scroll listener or lock creation moved because no import-time side effects were found.
- Next task: Task 55: Phase 2 Full Verification. Do not start until explicitly requested.
- Completed task: Task 55: Phase 2 Full Verification.
- Files changed: `docs/PHASE2_SCENE_GATE_PLAN.md`, `docs/EXECUTION_STATE.md`.
- Commands run: `npm run test -- --run && npm run typecheck && npm run build && npm run check:imports && git diff --check` (green full Phase 2 verification: 38 Vitest files / 171 tests passed, typecheck passed, build passed with the existing non-blocking Vite chunk-size warning, demo import boundary passed, diff check passed).
- Review checkpoint: pending final Phase 2 review after Task 56 documentation alignment.
- Next task: Task 56: Phase 2 Documentation Alignment.
- Completed task: Task 56: Phase 2 Documentation Alignment.
- Files changed: `README.md`, `docs/00-goal.md`, `docs/PHASE2_SCENE_GATE_PLAN.md`, `docs/EXECUTION_STATE.md`.
- Commands run: `npm run check && npm run build && npm run check:imports && git diff --check` (green post-documentation verification: typecheck passed, 38 Vitest files / 171 tests passed, build passed with the existing non-blocking Vite chunk-size warning, demo import boundary passed, diff check passed).
- Documentation checklist result: README now documents setup/verification commands, public gate declaration shape, debug state fields, forward and reverse gate release behavior, and deferred Phase 3 scope. `docs/00-goal.md` and this execution state now reflect Phase 2 completion through Task 56.
- Review checkpoint: pending final Phase 2 review.
- Next task: none in Phase 2. Do not start Phase 3 work unless explicitly requested.

## Phase 2 Documentation Checklist
- Pre-edit Task 56 checklist recorded after Task 55 verification and before user-facing doc edits.
- Document implemented gate behavior: public `webgl.scroll` gate declarations, start matching, viewport-multiple `duration`, scroll lock while active, `sceneProgress`, `activeGateKey`, and completion release.
- Document reverse policy: `release: "forward-complete"` does not trap reverse scrolling; `release: "both-directions-complete"` supports reverse entry from below and backward release at `sceneProgress: 0`.
- Document debug state fields: `currentScrollMode`, `activeGateKey`, and `sceneProgress`, with gate-only fields omitted in page mode.
- Document setup and verification commands: `npm run check`, `npm run build`, `npm run check:imports`, and `git diff --check`.
- Keep still-forbidden Phase 3 scope explicit: no effect registry, animation/effect layer, Lenis/GSAP/ScrollTrigger adapter, WebGL raycast picking, multiple canvas, or public Three.js `renderOrder`, `transparent`, or `depthWrite`.

## Phase 2 Review Checkpoint
- Review scope: completed Phase 2 tasks only (Task 38 through Task 50), current git status/diff, `docs/EXECUTION_STATE.md`, `docs/PHASE2_SCENE_GATE_PLAN.md`, and relevant tests.
- Current diff before this checkpoint record: empty working tree.
- Contract reviewer result: no blocking or non-blocking issues. Public API remains within the Phase 2 contract; no public Three.js `renderOrder`, `transparent`, or `depthWrite` flags were introduced; no effect registry or animation/effect layer was added; demo imports use only public package exports; public imports remain SSR-safe.
- Runtime safety reviewer result: no blocking or non-blocking issues. Scroll lock is idempotent; active gate cleanup releases scroll lock on completion, active gate unregister, runtime disposal/unmount, document visibility hidden, and fatal update errors; repeated cleanup is harmless; reverse gate behavior is explicit and policy-driven; frame/debug gate state matches the plan; browser-only APIs are not touched at module import time. Boundary note: the async renderable rejection release path exists in source, while the dedicated Task 50 lock-release test focuses on synchronous update errors.
- Blocking issues fixed: none. No blocking issues were found, and implementation code was not changed.
- Remaining non-blocking issues: none for the completed Task 38-50 review scope.
- Verification after checkpoint: contract reviewer ran `npm run check:imports`, `npm run typecheck`, `git diff --check`, a Task 38-50 targeted suite (15 files / 87 tests), and React adapter tests (3 files / 10 tests), all green. Runtime safety reviewer ran `npm test -- --run packages/dom-webgl-runtime/src/lib/renderer/runtime.test.ts packages/dom-webgl-runtime/src/lib/input/scrollController.test.ts packages/dom-webgl-runtime/src/lib/debug/debugState.test.ts packages/dom-webgl-runtime/src/lib/input/scrollLock.test.ts packages/dom-webgl-runtime/src/lib/input/sceneGate.test.ts packages/dom-webgl-runtime/src/lib/input/frameInput.test.ts` (6 files / 48 tests), `npm run typecheck`, and `git diff --check`, all green.
- Next task at this checkpoint: Task 51: React Gate Declaration Smoke. Do not proceed until explicitly requested.

## Phase 2 Batch C Review Checkpoint
- Review scope: completed Phase 2 Batch C tasks only (Task 51 through Task 54), current git status/diff, `docs/EXECUTION_STATE.md`, `docs/PHASE2_SCENE_GATE_PLAN.md`, and relevant tests.
- Contract reviewer result: approved with no blocking or non-blocking issues. Phase 2 remains scene-gated scroll only; no animation/effect layer, effect registry, Lenis/GSAP/ScrollTrigger adapter, raycast picking, multiple canvas, or public Three.js render flags were added. Demo imports still use only public package exports, SSR-safe import coverage is present, and Task 55 remains unchecked.
- Runtime safety reviewer result: approved with no blocking or non-blocking issues. No production runtime changes alter the scene gate state machine, scroll lock behavior, renderer ownership, canvas count, or event routing. React public entrypoint imports remain safe under throwing browser-global getters.
- Demo/API reviewer result: approved with no blocking or non-blocking issues. React gate declaration smoke uses the public adapter, the demo declares a gate through public `WebGLTarget`, the debug panel renders gate state from public `WebGLDebugState`, page mode does not render stale gate keys, and React public exports accept gate declarations without exposing runtime internals.
- Blocking issues fixed: none. No blocking issues were found.
- Remaining non-blocking issues: none for the completed Task 51-54 review scope.
- Verification after checkpoint: reviewers ran the Batch C targeted suite (`packages/dom-webgl-runtime/src/lib/react/WebGLTarget.test.tsx`, `apps/demo/src/App.test.tsx`, `apps/demo/src/debugPanel.test.tsx`, `packages/dom-webgl-runtime/src/lib/renderer/runtime.test.ts`, `packages/dom-webgl-runtime/src/publicExports.test.ts`, `apps/demo/src/demo-import-boundary.test.ts`) with 6 files / 24 tests passing; `npm run check:imports`, `npm run typecheck`, and `git diff --check` passed. Contract reviewer also reran `packages/dom-webgl-runtime/src/lib/input/sceneGate.test.ts` and `packages/dom-webgl-runtime/src/lib/input/scrollController.test.ts` to confirm explicit reverse gate behavior remained green.
- Next task at this checkpoint: Task 55: Phase 2 Full Verification. Do not start until explicitly requested.

## Final Phase 2 Review Checkpoint
- Review scope: entire completed Phase 2 diff, `docs/EXECUTION_STATE.md`, `docs/PHASE2_SCENE_GATE_PLAN.md`, relevant tests, public API exports, demo imports, and SSR safety.
- Contract reviewer result: approved after blocking public API boundary fixes. `WebGLRuntime` and `WebGLRuntimeOptions` now live on the public/shared `types.ts` boundary, root exports those types from `lib/types`, public `registerTarget()` returns `void`, React context imports the runtime type from `../types`, and public export regressions cover the boundary.
- Runtime safety reviewer result: approved with no blocking or non-blocking issues. Scroll lock release, active gate cleanup, reverse gate behavior, event listener cleanup, SSR import safety, one renderer/canvas ownership, and Phase 3 scope boundaries remain intact.
- Test coverage reviewer result: approved with no blocking or non-blocking issues. Coverage is sufficient for the delivered Task 38-56 contract.
- Docs/state reviewer result: approved after blocking doc fixes. `docs/00-goal.md` now matches delivered public gate, frame input, and debug state shapes.
- Blocking issues fixed: stale `docs/00-goal.md` type sketches for optional gate `release`, page/gate `WebGLFrameInput.scroll`, and debug `sceneProgress`; public API leak where `WebGLRuntime.registerTarget()` exposed internal `TargetDescriptor`; React provider/runtime component type imports pointed at the internal renderer module instead of the public/shared type boundary.
- Remaining non-blocking issues: none from the final Phase 2 review checkpoint.
- Verification after fixes: `npm run check && npm run build && npm run check:imports && git diff --check` passed after the docs fixes. `npm test -- --run packages/dom-webgl-runtime/src/publicExports.test.ts packages/dom-webgl-runtime/src/lib/react/WebGLRuntime.test.tsx packages/dom-webgl-runtime/src/lib/react/WebGLTarget.test.tsx packages/dom-webgl-runtime/src/lib/react/useWebGLRuntime.test.tsx packages/dom-webgl-runtime/src/lib/renderer/runtime.test.ts packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts && npm run typecheck && npm run check:imports && git diff --check` passed after the public API boundary fixes.
- Next task at this checkpoint: none in Phase 2. Do not start Phase 3 work unless explicitly requested.

## Phase 3 Batch A Completed Task Record
- Completed tasks: Task 57 Internal Scene Object Contract; Task 58 DOM Rect Projection; Task 59 Lifecycle Hide Mode Types; Task 60 DOM Fallback Visibility Controller; Task 61 Runtime Applies Fallback Visibility Only After WebGL Ready.
- Files changed: `packages/dom-webgl-runtime/src/lib/renderer/sceneObject.ts`, `packages/dom-webgl-runtime/src/lib/renderer/sceneObject.test.ts`, `packages/dom-webgl-runtime/src/lib/renderer/domProjection.ts`, `packages/dom-webgl-runtime/src/lib/renderer/domProjection.test.ts`, `packages/dom-webgl-runtime/src/lib/renderer/threeRenderer.ts`, `packages/dom-webgl-runtime/src/lib/renderer/threeRenderer.test.ts`, `packages/dom-webgl-runtime/src/lib/render/renderable.ts`, `packages/dom-webgl-runtime/src/lib/render/renderable.test.ts`, `packages/dom-webgl-runtime/src/lib/render/renderableFactory.ts`, `packages/dom-webgl-runtime/src/lib/render/renderableFactory.test.ts`, `packages/dom-webgl-runtime/src/lib/dom/fallbackVisibility.ts`, `packages/dom-webgl-runtime/src/lib/dom/fallbackVisibility.test.ts`, `packages/dom-webgl-runtime/src/lib/dom/targetDescriptor.test.ts`, `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`, `packages/dom-webgl-runtime/src/lib/renderer/runtime.test.ts`, `packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts`, `packages/dom-webgl-runtime/src/lib/debug/debugState.test.ts`, `packages/dom-webgl-runtime/src/lib/types.ts`, `packages/dom-webgl-runtime/src/lib/types.test.ts`, `packages/dom-webgl-runtime/src/publicExports.test.ts`, `docs/PHASE3_VISIBLE_RENDERABLE_PLAN.md`, `docs/EXECUTION_STATE.md`.
- RED evidence: `npm test -- --run packages/dom-webgl-runtime/src/lib/renderer/sceneObject.test.ts packages/dom-webgl-runtime/src/lib/renderer/domProjection.test.ts packages/dom-webgl-runtime/src/lib/dom/fallbackVisibility.test.ts packages/dom-webgl-runtime/src/lib/types.test.ts packages/dom-webgl-runtime/src/publicExports.test.ts packages/dom-webgl-runtime/src/lib/dom/targetDescriptor.test.ts packages/dom-webgl-runtime/src/lib/renderer/threeRenderer.test.ts packages/dom-webgl-runtime/src/lib/renderer/runtime.test.ts packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts` failed before implementation because `sceneObject`, `domProjection`, and `fallbackVisibility` modules were missing, `hideMode` was not accepted by public lifecycle types, and runtime fallback hiding was not wired to visual scene object readiness.
- GREEN verification: `npm test -- --run packages/dom-webgl-runtime/src/lib/renderer/sceneObject.test.ts packages/dom-webgl-runtime/src/lib/renderer/domProjection.test.ts packages/dom-webgl-runtime/src/lib/dom/fallbackVisibility.test.ts packages/dom-webgl-runtime/src/lib/types.test.ts packages/dom-webgl-runtime/src/publicExports.test.ts packages/dom-webgl-runtime/src/lib/dom/targetDescriptor.test.ts packages/dom-webgl-runtime/src/lib/render/renderable.test.ts packages/dom-webgl-runtime/src/lib/render/renderableFactory.test.ts packages/dom-webgl-runtime/src/lib/renderer/threeRenderer.test.ts packages/dom-webgl-runtime/src/lib/renderer/runtime.test.ts packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts` passed with 11 files / 54 tests; `npm run typecheck` passed; `git diff --check` passed.
- Contract reviewer result: approved with no blocking or non-blocking issues. Public Three.js `renderOrder`, `transparent`, and `depthWrite` remain rejected; scene object/adapter types remain internal and are not root or React exports; lifecycle `hideMode?: "subtree" | "self"` stays high-level; public imports remain SSR-safe; no forbidden effect/adapters/picking/multiple-canvas scope was added.
- Runtime safety reviewer result: initially requested fixes for subtree descendant hiding, visual readiness coupling, async same-key stale readiness, and scene adapter attached ordering. Fixes landed and re-review approved with no blocking or non-blocking issues.
- Remaining non-blocking issues: none from Batch A review. Batch A is a foundation slice only; supported source types still do not create visible scene planes/textures/models until Batch B.
- Next batch: Batch B Tasks 62-66, visible renderable scene paths for element snapshot, text snapshot, image, video, and GLB model sources.

## Phase 3 Batch B Completed Task Record
- Completed tasks: Task 62 Element Snapshot Scene Plane; Task 63 Text Snapshot Scene Plane; Task 64 Image Scene Plane; Task 65 Video Scene Plane; Task 66 GLB Model Scene Object.
- Files changed: `packages/dom-webgl-runtime/src/lib/render/renderables/sceneRenderableObject.ts`, `packages/dom-webgl-runtime/src/lib/render/renderables/elementSnapshotRenderable.ts`, `packages/dom-webgl-runtime/src/lib/render/renderables/elementSnapshotRenderable.test.ts`, `packages/dom-webgl-runtime/src/lib/render/renderables/textSnapshotRenderable.ts`, `packages/dom-webgl-runtime/src/lib/render/renderables/textSnapshotRenderable.test.ts`, `packages/dom-webgl-runtime/src/lib/render/renderables/imageRenderable.ts`, `packages/dom-webgl-runtime/src/lib/render/renderables/imageRenderable.test.ts`, `packages/dom-webgl-runtime/src/lib/render/renderables/videoRenderable.ts`, `packages/dom-webgl-runtime/src/lib/render/renderables/videoRenderable.test.ts`, `packages/dom-webgl-runtime/src/lib/render/renderables/modelRenderable.ts`, `packages/dom-webgl-runtime/src/lib/render/renderables/modelRenderable.test.ts`, `packages/dom-webgl-runtime/src/lib/render/renderableFactory.ts`, `packages/dom-webgl-runtime/src/lib/render/renderableFactory.test.ts`, `packages/dom-webgl-runtime/src/lib/renderer/threeRenderer.ts`, `packages/dom-webgl-runtime/src/lib/renderer/threeRenderer.test.ts`, `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`, `docs/PHASE3_VISIBLE_RENDERABLE_PLAN.md`, `docs/EXECUTION_STATE.md`.
- RED evidence: `npm test -- --run packages/dom-webgl-runtime/src/lib/render/renderables/elementSnapshotRenderable.test.ts packages/dom-webgl-runtime/src/lib/render/renderables/textSnapshotRenderable.test.ts packages/dom-webgl-runtime/src/lib/render/renderables/imageRenderable.test.ts packages/dom-webgl-runtime/src/lib/render/renderables/videoRenderable.test.ts packages/dom-webgl-runtime/src/lib/render/renderables/modelRenderable.test.ts packages/dom-webgl-runtime/src/lib/render/renderableFactory.test.ts` failed before implementation because renderables did not create or attach scene objects.
- GREEN verification: `npm test -- --run packages/dom-webgl-runtime/src/lib/render/renderables/elementSnapshotRenderable.test.ts packages/dom-webgl-runtime/src/lib/render/renderables/textSnapshotRenderable.test.ts packages/dom-webgl-runtime/src/lib/render/renderables/imageRenderable.test.ts packages/dom-webgl-runtime/src/lib/render/renderables/videoRenderable.test.ts packages/dom-webgl-runtime/src/lib/render/renderables/modelRenderable.test.ts packages/dom-webgl-runtime/src/lib/render/renderableFactory.test.ts packages/dom-webgl-runtime/src/lib/renderer/threeRenderer.test.ts packages/dom-webgl-runtime/src/lib/renderer/runtime.test.ts packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts packages/dom-webgl-runtime/src/lib/debug/debugState.test.ts` passed with 10 files / 59 tests; `npm run typecheck` passed; `npm run check:imports` passed; `git diff --check` passed.
- Contract reviewer result: initially found blocking issues because the first pass used metadata-only scene objects and model layout/visibility did not affect the loaded object. Fixes landed: element/text/image/video now create internal Three plane/texture objects, model renderables apply layout/visibility to the actual object, clone cached GLB scenes per renderable, and runtime passes real viewport size for DOM-pixel projection. Re-review approved with no blocking or spec-relevant issues.
- Code quality reviewer result: initially found blocking issues for CSS-pixel camera/frustum mismatch, repeated GLB clone leaks on later updates, and unsafe same-src GLB shared geometry/material disposal. Fixes landed: default renderer configures a CSS-pixel orthographic camera and renderer size, model renderables clone only once per renderable, and model disposal no longer recursively disposes shared geometry/material. Final re-review found no Critical or Important issues.
- Remaining non-blocking issues: none from Batch B review. Batch B intentionally stops before Task 67 internal render policy ordering, Task 68 render-on-sync, Task 69 React/demo visible smoke, Task 70 SSR/public boundary regression, Task 71 full verification, and Task 72 documentation alignment.
- Next task: Task 67: Internal Render Policy Ordering. Do not start until explicitly requested.

## Phase 3 Batch C Completed Task Record
- Completed tasks: Task 67 Internal Render Policy Ordering; Task 68 Runtime Renders Scene On Sync.
- Files changed: `packages/dom-webgl-runtime/src/lib/render/renderPolicy.ts`, `packages/dom-webgl-runtime/src/lib/render/renderPolicy.test.ts`, `packages/dom-webgl-runtime/src/lib/render/renderable.test.ts`, `packages/dom-webgl-runtime/src/lib/render/renderableFactory.test.ts`, `packages/dom-webgl-runtime/src/lib/render/renderables/elementSnapshotRenderable.ts`, `packages/dom-webgl-runtime/src/lib/render/renderables/textSnapshotRenderable.ts`, `packages/dom-webgl-runtime/src/lib/render/renderables/imageRenderable.ts`, `packages/dom-webgl-runtime/src/lib/render/renderables/videoRenderable.ts`, `packages/dom-webgl-runtime/src/lib/render/renderables/modelRenderable.ts`, `packages/dom-webgl-runtime/src/lib/render/renderables/sceneRenderableObject.ts`, `packages/dom-webgl-runtime/src/lib/renderer/sceneObject.ts`, `packages/dom-webgl-runtime/src/lib/renderer/sceneObject.test.ts`, `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`, `packages/dom-webgl-runtime/src/lib/renderer/runtime.test.ts`, `packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts`, `packages/dom-webgl-runtime/src/lib/debug/debugState.test.ts`, `docs/PHASE3_VISIBLE_RENDERABLE_PLAN.md`, `docs/EXECUTION_STATE.md`.
- RED evidence: `npm test -- --run packages/dom-webgl-runtime/src/lib/render/renderPolicy.test.ts packages/dom-webgl-runtime/src/lib/renderer/sceneObject.test.ts` failed before Task 67 implementation because `toSceneObjectOrdering` did not exist and scene objects had no internal ordering applied before attach. `npm test -- --run packages/dom-webgl-runtime/src/lib/render/renderableFactory.test.ts` then failed until the actual visible renderable pipeline passed `context.policy` ordering into scene objects. `npm test -- --run packages/dom-webgl-runtime/src/lib/renderer/runtime.test.ts packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts packages/dom-webgl-runtime/src/lib/debug/debugState.test.ts` failed before Task 68 implementation because sync/async updates did not call `sceneAdapter.render()` and debug target visibility did not read scene object visibility. Runtime review also found a mixed sync+async RED case where synchronous visible updates were not rendered before async completion.
- GREEN verification: `npm test -- --run packages/dom-webgl-runtime/src/lib/render/renderPolicy.test.ts packages/dom-webgl-runtime/src/lib/renderer/sceneObject.test.ts packages/dom-webgl-runtime/src/lib/types.test.ts && npm run typecheck` passed. `npm test -- --run packages/dom-webgl-runtime/src/lib/renderer/runtime.test.ts packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts packages/dom-webgl-runtime/src/lib/debug/debugState.test.ts && npm run typecheck` passed after the mixed sync+async render fix with 3 files / 34 tests. Batch C extended checkpoint `npm test -- --run packages/dom-webgl-runtime/src/lib/render/renderPolicy.test.ts packages/dom-webgl-runtime/src/lib/renderer/sceneObject.test.ts packages/dom-webgl-runtime/src/lib/types.test.ts packages/dom-webgl-runtime/src/lib/render/renderableFactory.test.ts packages/dom-webgl-runtime/src/lib/renderer/runtime.test.ts packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts packages/dom-webgl-runtime/src/lib/debug/debugState.test.ts && npm run typecheck && git diff --check` passed with 7 files / 50 tests.
- Ordering reviewer result: approved with no blocking issues. Deterministic internal ordering covers `surface`, `content`, `media`, `model`, and `overlay`; ordering flows from `renderRole` to `RenderPolicy` to scene object ordering and into actual renderable scene controllers; public declarations still reject `renderOrder`, `transparent`, and `depthWrite`; package root and React entrypoints do not export ordering or scene object types.
- Runtime render reviewer result: initially found a blocking mixed sync+async render gap. Fix landed by tracking synchronous updates and rendering them before returning the pending async promise; re-review approved with no blocking or non-blocking issues. The runtime still uses the single internal scene adapter render path, adds no `requestAnimationFrame` loop, no extra renderer/canvas, no effect layer, and no public Three.js policy knobs.
- Debug/tests/docs reviewer result: code/test scope approved with non-blocking note that the debug visibility test uses an injected scene controller seam while the production scene object chain supports the behavior. The reviewer required docs synchronization, which this record and the Task 67-68 checkboxes complete. README and `docs/00-goal.md` do not need Batch C updates because no public API or product contract changed.
- Blocking issues fixed: actual visible renderables initially did not pass internal ordering from `RenderPolicy` into their scene object controllers; mixed sync+async runtime sync initially delayed synchronous visible scene renders until async completion; docs initially still showed Batch C as pending.
- Remaining non-blocking issues: none for Batch C. The existing non-blocking Vite production build chunk-size warning remains outside this batch because Batch C did not run a production build.
- Next batch: Batch D Tasks 69-70: React And Demo Visible Smoke; SSR And Public Boundary Regression. Do not start until explicitly requested.

## Phase 3 Batch D Completed Task Record
- Completed tasks: Task 69 React And Demo Visible Smoke; Task 70 SSR And Public Boundary Regression.
- Files changed: `apps/demo/src/App.tsx`, `apps/demo/src/App.test.tsx`, `apps/demo/src/debugPanel.tsx`, `apps/demo/src/debugPanel.test.tsx`, `packages/dom-webgl-runtime/src/lib/react/WebGLTarget.test.tsx`, `packages/dom-webgl-runtime/src/lib/renderer/runtime.test.ts`, `packages/dom-webgl-runtime/src/publicExports.test.ts`, `docs/PHASE3_VISIBLE_RENDERABLE_PLAN.md`, `docs/EXECUTION_STATE.md`.
- RED evidence: `npm test -- --run apps/demo/src/App.test.tsx apps/demo/src/debugPanel.test.tsx packages/dom-webgl-runtime/src/lib/react/WebGLTarget.test.tsx apps/demo/src/demo-import-boundary.test.ts` failed before Task 69 implementation because the demo surface target did not declare `lifecycle: { hideWhenReady: true, hideMode: "self" }`, the child-preserving fallback smoke was not demonstrated, and the debug panel did not show WebGL-visible readiness. Task 70 regression tests were added before implementation and passed against the existing code, confirming no production boundary fix was needed.
- GREEN verification: Task 69 verification `npm test -- --run apps/demo/src/App.test.tsx apps/demo/src/debugPanel.test.tsx packages/dom-webgl-runtime/src/lib/react/WebGLTarget.test.tsx apps/demo/src/demo-import-boundary.test.ts && npm run check:imports && npm run typecheck` passed. Task 70 verification `npm test -- --run packages/dom-webgl-runtime/src/publicExports.test.ts packages/dom-webgl-runtime/src/lib/renderer/runtime.test.ts apps/demo/src/demo-import-boundary.test.ts && npm run check:imports && npm run typecheck` passed. Batch D checkpoint `npm test -- --run apps/demo/src/App.test.tsx apps/demo/src/debugPanel.test.tsx packages/dom-webgl-runtime/src/lib/react/WebGLTarget.test.tsx apps/demo/src/demo-import-boundary.test.ts packages/dom-webgl-runtime/src/publicExports.test.ts packages/dom-webgl-runtime/src/lib/renderer/runtime.test.ts && npm run check:imports && npm run typecheck && git diff --check` passed with 6 files / 34 tests.
- Demo/API reviewer result: approved with no blocking or non-blocking issues. The demo imports only public package entrypoints, declares element snapshot, text snapshot, image, video, and GLB model targets through `WebGLTarget`, demonstrates `hideWhenReady` with `hideMode: "self"`, and reads debug readiness from public `WebGLDebugState`.
- SSR/public boundary reviewer result: approved with no blocking or non-blocking issues. Root and React entrypoints remain SSR-safe with expanded browser-global import guards, and internal scene object, controller, projection, adapter, render policy, and render ordering types remain absent from public root and React exports.
- Phase scope reviewer result: approved with no blocking or non-blocking issues. Batch D added no effect registry, animation/effect layer, Lenis/GSAP/ScrollTrigger adapter, WebGL raycast picking, multiple canvas path, or public Three.js `renderOrder`, `transparent`, or `depthWrite` flags. Phase 2 scene-gate behavior was not changed.
- Blocking issues fixed: none found by review. During local verification, a React test mock warning from cloned children without key handling was fixed by using `Children.map`.
- Remaining non-blocking issues: none for Batch D.
- Next batch: Batch E Tasks 71-72: Phase 3 Full Verification and Phase 3 Documentation Alignment. Do not start until explicitly requested.

## Phase 3 Documentation Checklist
- Visible element snapshot path.
- Visible text snapshot path.
- Visible image path.
- Visible video path.
- Visible GLB model path.
- Internal scene object ownership.
- DOM rect projection.
- Internal render policy ordering.
- Render-on-sync behavior.
- Fallback visibility semantics.
- `hideWhenReady`.
- `hideMode: "subtree"`.
- `hideMode: "self"`.
- Child-preserving fallback visibility.
- Public API boundary.
- Demo public imports only.
- SSR-safe public imports.
- Still-forbidden effect registry.
- Still-forbidden animation/effect layer.
- Still-forbidden Lenis / GSAP / ScrollTrigger adapter.
- Still-forbidden WebGL raycast picking.
- Still-forbidden multiple canvas.
- Still-forbidden public Three.js `renderOrder`, `transparent`, and `depthWrite`.

## Phase 3 Batch E Completed Task Record
- Completed tasks: Task 71 Phase 3 Full Verification; Task 72 Phase 3 Documentation Alignment.
- Files changed: `README.md`, `docs/00-goal.md`, `docs/EXECUTION_STATE.md`, `docs/PHASE3_VISIBLE_RENDERABLE_PLAN.md`, `packages/dom-webgl-runtime/src/publicExports.test.ts`, `vitest.config.ts`.
- Commands run: `npm test -- --run packages/dom-webgl-runtime/src/publicExports.test.ts -t "React entrypoint type-checks public gate declarations only"` reproduced the public export typecheck as passing in isolation. `npm test -- --run packages/dom-webgl-runtime/src/publicExports.test.ts` passed after the timeout fix. `npm run test -- --run && npm run typecheck && npm run build && npm run check:imports && git diff --check` passed for Task 71 full verification after increasing the test timeout budget for compile/build-heavy tests. Post-doc verification command is recorded below after docs alignment.
- Verification results: full Phase 3 verification passed with 41 Vitest files / 202 tests, typecheck passed, build passed, demo import boundary passed, and `git diff --check` passed. The build emitted the existing non-blocking Vite chunk-size warning.
- Supported source paths verified: element snapshot, text snapshot, image, video, and GLB model all have visible scene path coverage through renderable tests and demo smoke coverage. GLB model layout now contains loaded model bounds inside the DOM anchor with uniform XYZ scale, the default runtime scene has baseline ambient plus directional lighting for lit GLB/PBR materials, and the demo model target hides its DOM fallback subtree once ready so model content does not cover fallback text.
- Scroll stability correction: renderer viewport sizing now follows the fixed
  canvas stage's actual rendered CSS box, and the demo keeps a stable scrollbar
  gutter so DOM anchor widths do not reflow during runtime scroll.
- Demo scroll-lock correction: the default demo no longer declares a scene gate
  on `demo.surface`, because that validation target could enter gate mode during
  ordinary page scroll and leave `documentElement` locked with
  `overflow: hidden` at the bottom of the page. Scene-gate behavior remains
  covered by dedicated runtime, React adapter, and public type tests.
- Blocking issues fixed: the first full verification run exposed Vitest default 5 second timeout failures in TypeScript/Vite compile-heavy boundary tests under full-suite parallel load. Fixes landed by adding a 30 second global Vitest timeout and explicit timeout coverage for the public export typecheck tests. No runtime or public API behavior changed.
- Review results by subagent: final contract reviewer approved with no blocking issues; runtime safety reviewer approved with no blocking issues; test coverage reviewer approved with no blocking issues; docs/state reviewer approved with no blocking issues.
- Remaining non-blocking issues: demo production build still emits Vite's default chunk-size warning for a large demo bundle.
- Final commit hash: pending until commit.
- Next recommended phase at Phase 3 completion was Phase 3.5 runtime performance and stage correction; that correction is now implemented and verified in the current branch.

## Last Commands Run
- `npm run check && git diff --check` (green pre-doc baseline: root typecheck passed, 33 Vitest files / 107 tests passed, diff check passed)
- `npm run check && git diff --check` (green post-doc verification: root typecheck passed, 33 Vitest files / 107 tests passed, diff check passed)
- `npm test -- --run packages/dom-webgl-runtime/src/lib/types.test.ts packages/dom-webgl-runtime/src/lib/runtime-state.test.ts packages/dom-webgl-runtime/src/publicExports.test.ts && npm run typecheck` (green Task 38 verification)
- `npm test -- --run packages/dom-webgl-runtime/src/lib/input/scrollDeclaration.test.ts packages/dom-webgl-runtime/src/lib/dom/targetDescriptor.test.ts && npm run typecheck` (green Task 39 verification)
- `npm test -- --run packages/dom-webgl-runtime/src/lib/input/sceneGate.test.ts` (green Task 40 verification)
- `npm test -- --run packages/dom-webgl-runtime/src/lib/input/sceneGate.test.ts` (green Task 41 verification, 12 tests)
- `npm test -- --run packages/dom-webgl-runtime/src/lib/input/sceneGate.test.ts` (green Task 42 verification, 15 tests)
- `npm test -- --run packages/dom-webgl-runtime/src/lib/input/scrollDelta.test.ts` (green Task 43 verification, 8 tests)
- `npm test -- --run packages/dom-webgl-runtime/src/lib/input/scrollLock.test.ts` (green Task 44 verification, 5 tests)
- `npm test -- --run packages/dom-webgl-runtime/src/lib/types.test.ts packages/dom-webgl-runtime/src/lib/runtime-state.test.ts packages/dom-webgl-runtime/src/publicExports.test.ts packages/dom-webgl-runtime/src/lib/dom/targetDescriptor.test.ts packages/dom-webgl-runtime/src/lib/input/scrollDeclaration.test.ts packages/dom-webgl-runtime/src/lib/input/sceneGate.test.ts packages/dom-webgl-runtime/src/lib/input/scrollDelta.test.ts packages/dom-webgl-runtime/src/lib/input/scrollLock.test.ts packages/dom-webgl-runtime/src/lib/renderer/runtime.test.ts apps/demo/src/demo-import-boundary.test.ts` (green Phase 2 checkpoint verification, 10 files / 49 tests)
- `npm run check:imports` (green Phase 2 checkpoint verification)
- `npm run typecheck` (green Phase 2 checkpoint verification)
- `git diff --check` (green Phase 2 checkpoint verification)
- `npm test -- --run packages/dom-webgl-runtime/src/lib/input/pageScroll.test.ts packages/dom-webgl-runtime/src/lib/input/scrollController.test.ts` (green Task 45 verification, 2 files / 7 tests)
- `npm run typecheck` (green Task 45 review-fix verification)
- `git diff --check` (green Task 45 review-fix verification)
- `npm test -- --run packages/dom-webgl-runtime/src/lib/input/scrollDelta.test.ts packages/dom-webgl-runtime/src/lib/input/scrollController.test.ts && npm run typecheck` (green Task 46 verification, 2 files / 18 tests)
- `npm test -- --run packages/dom-webgl-runtime/src/lib/input/frameInput.test.ts && npm run typecheck` (green Task 47 verification, 1 file / 3 tests)
- `npm test -- --run packages/dom-webgl-runtime/src/lib/renderer/runtime.test.ts packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts packages/dom-webgl-runtime/src/lib/input/scrollController.test.ts && npm run typecheck` (green Task 48 verification, 3 files / 18 tests)
- `npm test -- --run packages/dom-webgl-runtime/src/lib/debug/debugState.test.ts packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts && npm run typecheck` (green Task 49 verification, 2 files / 17 tests)
- `npm test -- --run packages/dom-webgl-runtime/src/lib/renderer/runtime.test.ts packages/dom-webgl-runtime/src/lib/input/scrollController.test.ts packages/dom-webgl-runtime/src/lib/debug/debugState.test.ts && npm run typecheck` (green Task 50 verification, 3 files / 25 tests)
- `npm test -- --run packages/dom-webgl-runtime/src/lib/react/WebGLTarget.test.tsx && npm run typecheck` (green Task 51 verification, 1 file / 4 tests)
- `npm test -- --run apps/demo/src/App.test.tsx apps/demo/src/demo-import-boundary.test.ts && npm run check:imports` (green Task 52 verification, 2 files / 5 tests)
- `npm test -- --run apps/demo/src/debugPanel.test.tsx apps/demo/src/App.test.tsx && npm run typecheck` (green Task 53 verification, 2 files / 5 tests)
- `npm test -- --run packages/dom-webgl-runtime/src/lib/renderer/runtime.test.ts packages/dom-webgl-runtime/src/publicExports.test.ts apps/demo/src/demo-import-boundary.test.ts && npm run check:imports && npm run typecheck` (green Task 54 verification, 3 files / 15 tests)
- `npm run check:imports` (green Phase 2 Task 38-50 review checkpoint verification by contract reviewer)
- `npm run typecheck` (green Phase 2 Task 38-50 review checkpoint verification by contract and runtime safety reviewers)
- `git diff --check` (green Phase 2 Task 38-50 review checkpoint verification by contract and runtime safety reviewers)
- `npm test -- --run packages/dom-webgl-runtime/src/lib/types.test.ts packages/dom-webgl-runtime/src/lib/runtime-state.test.ts packages/dom-webgl-runtime/src/publicExports.test.ts packages/dom-webgl-runtime/src/lib/dom/targetDescriptor.test.ts packages/dom-webgl-runtime/src/lib/input/scrollDeclaration.test.ts packages/dom-webgl-runtime/src/lib/input/sceneGate.test.ts packages/dom-webgl-runtime/src/lib/input/scrollDelta.test.ts packages/dom-webgl-runtime/src/lib/input/scrollLock.test.ts packages/dom-webgl-runtime/src/lib/input/pageScroll.test.ts packages/dom-webgl-runtime/src/lib/input/scrollController.test.ts packages/dom-webgl-runtime/src/lib/input/frameInput.test.ts packages/dom-webgl-runtime/src/lib/renderer/runtime.test.ts packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts packages/dom-webgl-runtime/src/lib/debug/debugState.test.ts apps/demo/src/demo-import-boundary.test.ts` (green Phase 2 Task 38-50 contract review verification, 15 files / 87 tests)
- `npm test -- --run packages/dom-webgl-runtime/src/lib/react/WebGLRuntime.test.tsx packages/dom-webgl-runtime/src/lib/react/WebGLTarget.test.tsx packages/dom-webgl-runtime/src/lib/react/useWebGLRuntime.test.tsx` (green React adapter boundary verification, 3 files / 10 tests)
- `npm test -- --run packages/dom-webgl-runtime/src/lib/renderer/runtime.test.ts packages/dom-webgl-runtime/src/lib/input/scrollController.test.ts packages/dom-webgl-runtime/src/lib/debug/debugState.test.ts packages/dom-webgl-runtime/src/lib/input/scrollLock.test.ts packages/dom-webgl-runtime/src/lib/input/sceneGate.test.ts packages/dom-webgl-runtime/src/lib/input/frameInput.test.ts` (green Phase 2 Task 38-50 runtime safety review verification, 6 files / 48 tests)
- `npm test -- --run packages/dom-webgl-runtime/src/lib/react/WebGLTarget.test.tsx apps/demo/src/App.test.tsx apps/demo/src/demo-import-boundary.test.ts apps/demo/src/debugPanel.test.tsx packages/dom-webgl-runtime/src/lib/renderer/runtime.test.ts packages/dom-webgl-runtime/src/publicExports.test.ts` (green Phase 2 Batch C local checkpoint verification, 6 files / 24 tests)
- `git diff --check` (green Phase 2 Batch C local checkpoint verification)
- `npm run check` (green pre-commit verification after docs alignment: typecheck passed, 38 Vitest files / 171 tests passed)
- `npm run check:imports` (green pre-commit verification after docs alignment)
- `git diff --check` (green pre-commit verification after docs alignment)
- Credential scan over changed docs, demo source, and runtime source found no matches.
- `npm run test -- --run && npm run typecheck && npm run build && npm run check:imports && git diff --check` (green Task 55 full Phase 2 verification: 38 Vitest files / 171 tests passed, typecheck passed, build passed with the existing non-blocking Vite chunk-size warning, demo import boundary passed, diff check passed)
- `npm run check && npm run build && npm run check:imports && git diff --check` (green Task 56 post-documentation verification: typecheck passed, 38 Vitest files / 171 tests passed, build passed with the existing non-blocking Vite chunk-size warning, demo import boundary passed, diff check passed)
- `npm run check && npm run build && npm run check:imports && git diff --check` (green after final docs/state review fixes: typecheck passed, 38 Vitest files / 171 tests passed, build passed with the existing non-blocking Vite chunk-size warning, demo import boundary passed, diff check passed)
- `npm test -- --run packages/dom-webgl-runtime/src/publicExports.test.ts packages/dom-webgl-runtime/src/lib/react/WebGLRuntime.test.tsx packages/dom-webgl-runtime/src/lib/react/WebGLTarget.test.tsx packages/dom-webgl-runtime/src/lib/react/useWebGLRuntime.test.tsx packages/dom-webgl-runtime/src/lib/renderer/runtime.test.ts packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts && npm run typecheck && npm run check:imports && git diff --check` (green after final contract review fixes: 6 Vitest files / 32 tests passed, typecheck passed, demo import boundary passed, diff check passed)
- `npm run test -- --run && npm run typecheck && npm run build && npm run check:imports && git diff --check` (green final full Phase 2 verification after review fixes: 38 Vitest files / 172 tests passed, typecheck passed, build passed with the existing non-blocking Vite chunk-size warning, demo import boundary passed, diff check passed)
- `npm test -- --run packages/dom-webgl-runtime/src/lib/renderer/sceneObject.test.ts packages/dom-webgl-runtime/src/lib/renderer/domProjection.test.ts packages/dom-webgl-runtime/src/lib/dom/fallbackVisibility.test.ts packages/dom-webgl-runtime/src/lib/types.test.ts packages/dom-webgl-runtime/src/publicExports.test.ts packages/dom-webgl-runtime/src/lib/dom/targetDescriptor.test.ts packages/dom-webgl-runtime/src/lib/render/renderable.test.ts packages/dom-webgl-runtime/src/lib/render/renderableFactory.test.ts packages/dom-webgl-runtime/src/lib/renderer/threeRenderer.test.ts packages/dom-webgl-runtime/src/lib/renderer/runtime.test.ts packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts` (green Phase 3 Batch A verification after review fixes: 11 Vitest files / 54 tests passed)
- `npm run typecheck` (green Phase 3 Batch A verification)
- `git diff --check` (green Phase 3 Batch A verification)
- `npm test -- --run packages/dom-webgl-runtime/src/lib/render/renderables/elementSnapshotRenderable.test.ts packages/dom-webgl-runtime/src/lib/render/renderables/textSnapshotRenderable.test.ts packages/dom-webgl-runtime/src/lib/render/renderables/imageRenderable.test.ts packages/dom-webgl-runtime/src/lib/render/renderables/videoRenderable.test.ts packages/dom-webgl-runtime/src/lib/render/renderables/modelRenderable.test.ts packages/dom-webgl-runtime/src/lib/render/renderableFactory.test.ts packages/dom-webgl-runtime/src/lib/renderer/threeRenderer.test.ts packages/dom-webgl-runtime/src/lib/renderer/runtime.test.ts packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts packages/dom-webgl-runtime/src/lib/debug/debugState.test.ts` (green Phase 3 Batch B targeted verification after review fixes: 10 files / 59 tests passed)
- `npm run typecheck` (green Phase 3 Batch B verification)
- `npm run check:imports` (green Phase 3 Batch B verification)
- `git diff --check` (green Phase 3 Batch B verification)
- `npm test -- --run packages/dom-webgl-runtime/src/lib/render/renderPolicy.test.ts packages/dom-webgl-runtime/src/lib/renderer/sceneObject.test.ts packages/dom-webgl-runtime/src/lib/types.test.ts && npm run typecheck` (green Task 67 verification)
- `npm test -- --run packages/dom-webgl-runtime/src/lib/renderer/runtime.test.ts packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts packages/dom-webgl-runtime/src/lib/debug/debugState.test.ts && npm run typecheck` (green Task 68 verification after mixed sync+async render fix: 3 files / 34 tests passed)
- `npm test -- --run packages/dom-webgl-runtime/src/lib/render/renderPolicy.test.ts packages/dom-webgl-runtime/src/lib/renderer/sceneObject.test.ts packages/dom-webgl-runtime/src/lib/types.test.ts packages/dom-webgl-runtime/src/lib/render/renderableFactory.test.ts packages/dom-webgl-runtime/src/lib/renderer/runtime.test.ts packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts packages/dom-webgl-runtime/src/lib/debug/debugState.test.ts && npm run typecheck && git diff --check` (green Phase 3 Batch C checkpoint verification: 7 files / 50 tests passed)
- `npm test -- --run apps/demo/src/App.test.tsx apps/demo/src/debugPanel.test.tsx packages/dom-webgl-runtime/src/lib/react/WebGLTarget.test.tsx apps/demo/src/demo-import-boundary.test.ts` (RED before Task 69 implementation: 3 expected failures for missing self lifecycle fallback and WebGL-visible readiness display)
- `npm test -- --run apps/demo/src/App.test.tsx apps/demo/src/debugPanel.test.tsx packages/dom-webgl-runtime/src/lib/react/WebGLTarget.test.tsx apps/demo/src/demo-import-boundary.test.ts && npm run check:imports && npm run typecheck` (green Task 69 verification: 4 files / 17 tests passed, demo import boundary passed, typecheck passed)
- `npm test -- --run packages/dom-webgl-runtime/src/publicExports.test.ts packages/dom-webgl-runtime/src/lib/renderer/runtime.test.ts apps/demo/src/demo-import-boundary.test.ts && npm run check:imports && npm run typecheck` (green Task 70 verification: 3 files / 20 tests passed, demo import boundary passed, typecheck passed)
- `npm test -- --run apps/demo/src/App.test.tsx apps/demo/src/debugPanel.test.tsx packages/dom-webgl-runtime/src/lib/react/WebGLTarget.test.tsx apps/demo/src/demo-import-boundary.test.ts packages/dom-webgl-runtime/src/publicExports.test.ts packages/dom-webgl-runtime/src/lib/renderer/runtime.test.ts && npm run check:imports && npm run typecheck && git diff --check` (green Phase 3 Batch D checkpoint verification: 6 files / 34 tests passed)
- `npm test -- --run packages/dom-webgl-runtime/src/publicExports.test.ts -t "React entrypoint type-checks public gate declarations only"` (green Batch E timeout investigation: targeted public React entrypoint typecheck passed in isolation)
- `npm test -- --run packages/dom-webgl-runtime/src/publicExports.test.ts` (green Batch E targeted verification after timeout fix: 5 tests passed)
- `npm run test -- --run && npm run typecheck && npm run build && npm run check:imports && git diff --check` (green Task 71 full verification: 41 Vitest files / 202 tests passed, typecheck passed, build passed with the existing non-blocking Vite chunk-size warning, demo import boundary passed, diff check passed)
- `npm run check && npm run build && npm run check:imports && git diff --check` (green final post-review verification: typecheck passed, 41 Vitest files / 202 tests passed, build passed with the existing non-blocking Vite chunk-size warning, demo import boundary passed, diff check passed)
- `npm test -- --run packages/dom-webgl-runtime/src/lib/types.test.ts packages/dom-webgl-runtime/src/publicExports.test.ts` (RED before implementation: `effects` and public effect/material types were missing; GREEN after public type updates)
- `npm test -- --run packages/dom-webgl-runtime/src/lib/effects/effectController.test.ts` (RED before implementation: `effectController.ts` missing; GREEN after internal effect controller implementation, 6 tests)
- `npm test -- --run packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts -t "effects"` (RED before runtime integration: effects were not applied/reported; GREEN after runtime effect pipeline integration)
- `npm test -- --run apps/demo/src/App.test.tsx -t "effect harness|visible renderable"` (RED before demo implementation: `demo.effects.surface` missing; GREEN after public-API-only demo effect harness)
- `npm run test -- --run && npm run typecheck && npm run build && npm run check:imports && git diff --check` (green Phase 5 full verification: 53 Vitest files / 266 tests passed, typecheck passed, build passed with the existing Vite chunk-size warning, demo import boundary passed, diff check passed)
- `npm run test -- --run`, `npm run typecheck`, `npm run build`, `npm run check:imports`, and `git diff --check` (green post-Phase 5 pointer correction verification: 53 Vitest files / 267 tests passed, typecheck passed, build passed with the existing Vite chunk-size warning, demo import boundary passed, diff check passed)
- `npm run typecheck` (green Phase 8 final verification)
- `npm test -- --run` (green Phase 8 final verification: 62 Vitest files / 299 tests passed)
- `npm run build` (green Phase 8 final verification: runtime type build passed; demo Vite production build passed with the existing non-blocking chunk-size warning)
- `npm run check:imports` (green Phase 8 final verification: `Demo import boundary OK`)
- `git diff --check` (green Phase 8 final verification)
- `npm test -- --run apps/demo/src/App.test.tsx -t "keeps runtime effect definitions stable"` (RED before fix: inline demo `effects` array changed identity after debug re-render; GREEN after moving demo effects to a module-level constant)
- `npm test -- --run apps/demo/src/App.test.tsx packages/dom-webgl-runtime/src/lib/react/WebGLRuntime.test.tsx` (green post-bugfix focused verification: 22 tests passed)
- `npm test -- --run apps/demo/src/App.test.tsx` (green post-bugfix focused verification: 11 tests passed)
- `npm run typecheck`, `npm run build`, `npm run check:imports`, and `git diff --check` (green post-bugfix verification; build passed with the existing non-blocking Vite chunk-size warning)
- `npm run check` (green unified source capability final verification: 63 test files / 321 tests passed)
- `npm run build` (green final verification; build passed with the existing non-blocking Vite chunk-size warning)
- `npm run check:imports` (green final verification: `Demo import boundary OK`)
- `git diff --check` (green final verification)
- `npm test -- --run packages/dom-webgl-runtime/src/index.test.ts packages/dom-webgl-runtime/src/lib/resources/resourceManager.test.ts packages/dom-webgl-runtime/src/lib/renderer/runtime.test.ts packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts` (green package-boundary review focused verification: 4 files / 57 tests passed)
- `git diff --check` (green package-boundary review doc/code verification)
- `npm run check` (green package-boundary review full verification: 76 test files / 408 tests passed)
- `npm run build` (green package-boundary review build verification; build passed with the existing non-blocking Vite chunk-size warnings)
- `npm run check:imports` (green package-boundary review import-boundary verification: `Demo and example import boundaries OK`)

## Last Result
Package boundary review fixes are implemented. Root package exports no longer
include `createInitialPointerState`; that helper remains package-internal for
pointer controller and React adapter reuse. Resource URL normalization preserves
query-string and hash variants so app-local URLs with different params or hash
fragments do not share one resource record. `runtime.ts` no longer carries the
unused `pendingAsyncTargets` state or `readVisibleLifecycleState` helper; the
current async behavior is still expressed through `pendingUpdates`, stale
completion guards, renderable status, and debug/fallback synchronization.

## Files Changed
- `docs/REVIEW_BACKLOG.md`
- `docs/EXECUTION_STATE.md`
- `docs/agent/package-usage.md`
- `packages/dom-webgl-runtime/src/index.test.ts`
- `packages/dom-webgl-runtime/src/index.ts`
- `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`
- `packages/dom-webgl-runtime/src/lib/resources/resourceManager.test.ts`
- `packages/dom-webgl-runtime/src/lib/resources/resourceManager.ts`

## Known Issues
No blocking package boundary issue remains after this review fix. The existing
non-blocking Vite production build chunk-size warning remains. Resource cache
keys still collapse absolute HTTP(S) URLs from different origins when the path,
query, and hash are identical; that separate non-blocking issue remains tracked
as R-002 in `docs/REVIEW_BACKLOG.md`.

## Important Constraints
- Public effect authoring should stay on `defineWebGLEffect(...)` plus
  runtime-level `effects`; the internal registry is not the primary public
  authoring model.
- Core must not auto-register visual effects and the package must not export
  concrete effect implementations. Consumers define effects in application,
  demo, or docs example code.
- Effects must use managed context, source handles, target handles, and
  resources. They must not create their own renderer, scan DOM, install global
  pointer listeners, or own independent source loading.
- GLB/model helpers that need Three.js internals belong beside renderable
  adapters, not inside pure effect modules.
- Do not create multiple WebGL canvases.
- Do not implement WebGL raycast picking.
- Do not add Lenis, GSAP, or ScrollTrigger as core runtime dependencies; route
  third-party scroll integrations through `WebGLScrollAdapter` and the optional
  scroll adapter package.
- Do not add class-based compatibility layer.
- Do not expose Three.js renderOrder, transparent, or depthWrite in the public API.
- Public package imports must be SSR-safe.
- Runtime/package implementation must stay reusable for an open-source package
  and must not hardcode demo-only keys, assets, DOM structure, layout, or copy.
- apps/demo must import only public package APIs:
  `@project/dom-webgl-runtime` and `@project/dom-webgl-runtime/react`.
- Phase 3 visible renderables must keep scene object and render policy details internal.
- `lifecycle.hideWhenReady` may hide DOM fallback only after the WebGL renderable is visually ready.
- Phase 3 must support child-preserving fallback hiding for container targets.

## Next Step
If resource cache correctness is revisited, fix R-002 by preserving origin for
absolute HTTP(S) URLs while keeping stable app-local relative URL
normalization. Keep the boundary explicit: no package effect presets, no public
renderer/camera/scene mutation, no multiple-canvas path, no picking path, no
core-owned third-party scroll dependency, no CSS paint cloning, and no
demo-specific runtime branch.
