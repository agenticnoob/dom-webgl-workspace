# Current Status

**Last reviewed against:** Phase 8 interaction/picking implementation

This is the active current-truth summary. Completed execution plans and older
phase records are archived under [archive/](./archive/).

## Runtime Truth

- One runtime instance creates one fixed transparent WebGL canvas.
- The current default host owns one main internal Three.js scene, one main
  DOM-aligned orthographic camera, and one renderer.
- Internally, the default Level 1 render path is represented as generated
  `main` scene, `main` DOM-aligned camera, and `main` render pass entries.
  Additional managed scenes, cameras, and passes can be declared explicitly.
- Public effect authoring goes through `defineWebGLEffect(...)` and the managed
  `ctx.object` facade.
- Runtime internals remain private: renderer, scene, camera, Object3D, Mesh,
  Material, Texture, render targets, render loop, loader, mixer, raycaster, and
  pass ordering are not public API.
- Current source declaration is `source.kind: "dom" | "media" | "model"` plus
  `source.type`.
- `apps/example` is the only app workspace and is the downstream consumer
  dogfood/tutorial surface.

## Implemented Public Surface

- DOM, media, and model sources:
  - `dom/element`
  - `dom/text`
  - `media/image`
  - `media/video`
  - `media/image-sequence`
  - `model/glb`
- Managed `ctx.object` controls:
  - transform, visibility, opacity
  - material facade
  - runtime-owned lights
  - animation facade for GLB clips
  - surface, text, texture, video, model modules
  - model mesh/material handles
  - model point layers
  - material layer shaders
- Runtime scope controls:
  - `ctx.runtime.progress` for keyed progress signals
  - `ctx.runtime.postprocess.request(...)` for explicit canvas/pass-scoped
    bloom/grain/blur requests
- Target-scoped pointer contract:
  - declarations use `pointer: { hover, press, click, drag }`
  - `ctx.pointer` is runtime/canvas pointer state
  - `ctx.targetPointer` is target-local pointer state
- Transform groups:
  - `transformScope: "subtree"` creates an internal runtime group
  - no public scene graph, group, matrix, or raw Three.js handle is exposed
- Opt-in managed render declarations:
  - React exports `WebGLScene`, `WebGLCamera`, `WebGLRenderPass`, and
    `WebGLPassViewport`
  - React scene-owned rendering is declared on `WebGLScene` with `render`;
    `WebGLRenderPass` remains the advanced explicit pass descriptor
  - vanilla runtime exposes `registerScene`, `registerCamera`, and
    `registerRenderPass` plus matching unregister methods; DOM viewport
    anchors can be registered with `registerPassViewport`
  - `WebGLTarget` inherits the nearest React `WebGLScene` when `webgl.sceneId`
    is absent; vanilla targets can set `sceneId` explicitly
  - managed DOM-aligned scene cameras resize with the runtime viewport, and
    `transformScope: "subtree"` groups stay inside the target's scene adapter
  - explicit scene projections support `dom-aligned`, `screen`, and
    `perspective-stage`
  - managed cameras support orthographic DOM/screen modes and perspective-stage
    mode through descriptors, not raw `THREE.Camera` handles
  - target placement supports `dom-anchored`, `screen-anchored`,
    `screen-depth`, `stage-local`, and `screen-plane`
  - render passes can request runtime-owned `clear`, `clearDepth`, DOM-bound
    `viewport`/scissor, and descriptor-level `postprocess`
  - scene-owned render declarations wait until the referenced/default camera is
    registered; scenes that do not opt into rendering do not require cameras
  - unregistering a managed scene releases live targets still routed to that
    scene
  - debug summaries can expose descriptor-only target scene facts, render pass
    viewport facts, and postprocess request scopes, but not raw
    scene/camera/pass/renderer/composer/render-target objects
- Opt-in managed stage primitives and scene-owned lights:
  - React exports `WebGLStagePlane`, `WebGLStageBox`, and `WebGLLight`
  - vanilla runtime exposes `registerStagePrimitive`, `unregisterStagePrimitive`,
    `registerLight`, and `unregisterLight`
  - supported primitives are `plane` and `box`, with plane roles `floor`,
    `wall`, and `backdrop`
  - supported stage materials are descriptor-only `standard` and `basic`
    solid-color materials
  - supported scene-owned lights are `ambient`, `directional`, and `point`
  - stage meshes, geometry, materials, groups, light targets, and lights are
    runtime-owned and disposed by unregister, scene unregister, or runtime
    dispose
  - debug state can report descriptor-only stage primitive and light inventory
    counts/ids without exposing raw Three.js objects
- Opt-in scene-native managed models:
  - React exports `WebGLModel`; vanilla runtime exposes `registerModel` and
    `unregisterModel`
  - `WebGLModel` belongs to a managed scene, loads GLB sources through the
    runtime resource manager, and can declare scene-local `position`,
    `rotation`, `scale`, `visible`, `timeline`, and `loader` descriptors
  - `WebGLModel.animation` supports a default clip, explicit default clips,
    progress-driven clip scrubbing, timeline-weighted clip blending, and
    timeline/constant morph weights
  - `WebGLModel.prepare.renderWarmup` can request a descriptor-only internal
    first-render warmup after load, skeleton-safe clone, attachment, and
    animation setup
  - prepared scene-native model loading is viewport-proximity aware for
    DOM-bound managed model passes, with descriptor-only debug state for
    `prepare.load` and `prepare.renderWarmup`
  - `ctx.object.animation` keeps the controlled clip facade for DOM-backed
    `model/glb` targets, including `clips`, `play`, `scrub`, `blend`,
    `crossFade`, `stop`, `stopAll`, and `setTime`
  - `ctx.object.model` can expose controlled morph target names/weights and
    named rig bones when the loaded model provides them
  - debug state can report descriptor-only model inventory, resource status,
    timeline activity, available clips, active clips, morph names, bone names,
    and missing clip/morph diagnostics without exposing raw GLTF, mixer,
    action, mesh, skeleton, or morph arrays
  - `WebGLModel` and stage primitives can declare scene-object `effects` and
    `interaction.pickable`; these use explicit scene-object scope, not
    DOM-target layout/fallback semantics
  - scene-object effects are registered with `defineWebGLSceneObjectEffect(...)`
    and receive `ctx.objectPointer`, `ctx.object`, `ctx.scene`, and
    `ctx.runtime` without raw intersections, raycasters, cameras, or
    `ctx.targetPointer`
- Managed timeline bindings and effect scope metadata:
  - public declarations can bind `timeline` data on `WebGLTarget`,
    `WebGLScene`, `WebGLStagePlane`, `WebGLStageBox`, and `WebGLLight`
  - `WebGLCameraDeclaration` intentionally does not accept top-level
    `timeline`; managed perspective-stage cameras can declare one nested
    `controller` that reads progress and drives `position`, `target`, and `fov`
    before `screen-depth`/`screen-plane` projection and pass rendering
  - perspective-stage cameras can also declare a minimal
    `controller.pointer: { kind: "orbit", activation: "empty-space-drag" }`
    controller; object hover/press/drag has priority over camera drag
  - timeline bindings consume runtime `WebGLProgressSignalSource` values and
    normalize optional active ranges with `from`/`to`
  - `@project/dom-webgl-scroll-adapters/react` exports
    `WebGLScrollTimeline` as the broader named progress section, while
    `ScrollEffectSection` remains compatibility sugar for target/effect pinned
    sections
  - targets, render passes, and stage primitives/lights can activate from
    timeline ranges without React descriptor churn
  - debug state can report descriptor-only camera controller summaries without
    exposing raw camera objects, matrices, controls, or render-loop hooks
  - effect contexts expose `ctx.runtime.progress` and optional
    `ctx.scene` metadata/timeline snapshots; they do not expose raw scenes,
    cameras, passes, or a `ctx.camera` field

## Active Caveats

- Managed scenes/cameras/passes are opt-in. `WebGLTarget` alone remains the
  shortest and default DOM-first path.
- `screen-depth` projects DOM rect screen position/size through the active
  `WebGLCamera` basis at a fixed depth. `screen-plane` casts the DOM rect center
  through the active camera to a named stage plane and applies optional
  descriptor `offset`/`scale`; when the plane/camera intersection cannot be
  resolved, debug/layout diagnostics stay descriptor-only.
- `stage-local` placement sets explicit scene-local layout for a target.
  Scene-native `WebGLModel` is available for managed-scene GLB assets that do
  not need DOM fallback or target-local effects. Models that should follow DOM
  layout, fallback visibility, target-local pointer state, or target effects
  should remain `WebGLTarget` model sources.
- `ctx.object.postprocess` was removed in Phase 6 because its name implied
  object-local behavior. Effect-authored postprocess now uses
  `ctx.runtime.postprocess.request(...)` with `{ canvas: true }` or
  `{ passId }`.
- Model-local glow should use material/emissive controls and runtime-owned
  lights unless whole-pass bloom is intentional.
- `dom/element` surfaces are canvas texture planes and do not respond to Three.js
  lighting. Use managed stage primitives for lit floors, walls, and backdrops.
- `WebGLPassViewport` is only for opt-in managed scene/pass work. Level 1
  `WebGLTarget` usage does not need viewport anchors. Nesting a `WebGLScene`
  alone still does not create a local DOM viewport; the render pass must declare
  `viewport: { mode: "dom-rect" }` and resolve to a registered viewport anchor.
  The runtime clips that anchor rect to the visible canvas viewport each frame;
  the original anchor rect still defines the pass mapping, so partially visible
  passes are clipped rather than compressed into the visible slice. Fully
  offscreen pass viewports are skipped instead of drawing behind unrelated DOM
  sections.
- Managed stage primitives and scene-owned lights are stable descriptors. Use
  them to declare scene substrate; do not drive high-frequency animation through
  React prop churn. Use timeline bindings and managed effect/controller state
  for progress-driven scene, stage, and light activation.
- Scene-native `WebGLModel` descriptors are stable declarations. Use timeline
  bindings and model animation descriptors for progress-driven clip/morph
  updates rather than React prop churn. `animation.defaultClips` starts only the
  clips the app explicitly lists; it is not a `playAllClips` shortcut and does
  not infer meaningful clips from the GLB. `prepare.renderWarmup` is scoped to
  a tiny managed first-render warmup. For DOM-bound managed model passes, the
  runtime may keep prepared model loading queued until the pass viewport is
  close enough to be useful, then load and warm before the row enters view.
  The `prepare.load` debug state is descriptor-only; it is not a public loader
  callback, preload margin, render hook, or raw handle. This does not add
  `WebGLTarget.lifecycle`, DOM fallback, DOM rect fitting, target pointer state,
  target-local effects, or raw render hooks to `WebGLModel`. Scene-native model
  effects are available only through explicit scene-object effects; they do not
  receive DOM layout, fallback, or `ctx.targetPointer`.
- `model/glb` renderables are fitted to their DOM target by the runtime layout
  pass. Effects that write `ctx.object.position` or `ctx.object.scale` take over
  placement.
- Scene-gated scroll remains an optional advanced scroll-locking capability.
  Ordinary pinned scrub sections should use `@project/dom-webgl-scroll-adapters/react`,
  `ScrollEffectSection` or `WebGLScrollTimeline`, stable progress ids, and
  `ctx.progress.get(progressKey)` / `ctx.runtime.progress.get(progressKey)`.
- Timeline bindings can hide/skip targets, scenes, stage primitives, and lights
  by progress range. Active ranges do not override explicit effect visibility or
  `visible: false` declarations. They also do not make a nested `WebGLScene` a
  local clipped viewport; local pass clipping is the separate
  `WebGLPassViewport` + pass `viewport` contract.
- Camera motion/focus/framing is not part of target-local effects or Phase 5
  target/scene timeline bindings. Progress-driven perspective-stage camera
  motion now uses the Phase 6A nested `WebGLCamera.controller` descriptor.
  Controller framing is re-applied after managed camera resize so a scroll-held
  camera does not snap back to its declaration base frame when scroll progress
  stops changing. Phase 8 adds minimal empty-space orbit drag through
  `controller.pointer`; it is blocked by object hit/capture state.
  Orthographic zoom controllers, screen overlay camera controllers, complex
  framing boxes, and pass-bound camera controller scope are deferred possible
  camera-controller iterations. Phase 8 now scopes pointer-driven camera work to
  minimal empty-space orbit drag for object-vs-camera priority proof. Pan,
  dolly, wheel/pinch zoom, pointer parallax, damping, and richer orbit controls
  are deferred to Phase 8B.
- The managed timeline example uses the same named progress signal for a
  `WebGLCamera.controller` and the card effect, while the scene, stage
  primitives, lights, and visible scene-child `WebGLTarget` display directly.
  The card inherits the managed scene, uses `screen-depth` placement, and the
  scene pass uses `WebGLPassViewport` with
  `viewport: { mode: "dom-rect", scissor: true }` so the pinned section DOM rect
  clips the managed pass on the shared runtime canvas. The card effect enters
  from the named progress signal and holds its final visible state through the
  end of the pinned timeline. The separate managed stage primitive dogfood is
  ordered before this pinned timeline so the timeline exit does not hand off
  directly into another similar 3D stage pass.
- The managed stage primitive example is mounted in `apps/example` and dogfoods
  `WebGLPassViewport` with pass `viewport: { mode: "dom-rect", scissor: true }`
  and descriptor-level bloom/grain/blur postprocess. It remains one runtime
  canvas; the pass is clipped by the visible DOM rect without remapping into
  the visible slice, instead of becoming a second canvas or drawing as a
  full-canvas background while offscreen.
- The managed interaction example is mounted in `apps/example` and dogfoods
  Phase 8 public surface: pickable stage/model descriptors, scene-object effects
  registered with `defineWebGLSceneObjectEffect(...)`, a DOM `WebGLTarget` using
  `placement: { mode: "screen-plane", planeId }`, and minimal
  `WebGLCamera.controller.pointer` empty-space orbit drag.
- Batching remains profile-gated. The current example does not prove draw calls
  dominate enough compatible active planes to justify broad batching by default.

## Active Direction

The next roadmap is [roadmap/managed-render-system.md](./roadmap/managed-render-system.md).
Use that roadmap's `Roadmap Status` table as the source of truth for what has
not started, what has a focused plan, what is in progress, and what is verified.
Phase 1 internal render layer foundations are verified. Phase 2 opt-in
scene/camera/pass declarations are verified behind managed descriptors while
the default Level 1 path still flows through internal generated
scene/camera/pass entries. Phase 3 projection policies are verified through
explicit scene projections, managed camera modes, target placement descriptors,
and pass clear controls. Phase 4 managed stage primitives add scene-native
plane/box descriptors and scene-owned lights without raw Three.js handles:
[2026-07-04-managed-stage-primitives.md](./superpowers/plans/2026-07-04-managed-stage-primitives.md).
Phase 5 target routing, scroll timelines, and effect scope adds named timeline
bindings for targets/scenes/stage primitives/lights, the `WebGLScrollTimeline`
React adapter, and `ctx.runtime`/`ctx.scene` scope metadata while keeping camera
timeline control out of `WebGLCameraDeclaration`:
[2026-07-04-target-routing-scroll-timelines-effect-scope.md](./superpowers/plans/2026-07-04-target-routing-scroll-timelines-effect-scope.md).
Phase 6 pass viewport and postprocess scope correction is verified and adds
`WebGLPassViewport`, DOM-bound pass viewport/scissor, pass descriptor
postprocess, `ctx.runtime.postprocess` scope, and descriptor-only debug
summaries without adding raw Three.js access:
[2026-07-04-pass-viewport-postprocess-scope.md](./superpowers/plans/2026-07-04-pass-viewport-postprocess-scope.md).
Phase 6A managed camera controllers are verified and add a single optional
`WebGLCamera.controller` descriptor for progress-driven perspective-stage
`position`/`target`/`fov`, without adding top-level
`WebGLCameraDeclaration.timeline`, implicit `ctx.camera`, pass-bound controller
scope, raw camera handles, or pointer-driven interaction:
[2026-07-04-managed-camera-controllers.md](./superpowers/plans/2026-07-04-managed-camera-controllers.md).
Phase 7 established the scene-native `WebGLModel` descriptor path, runtime model
registry, descriptor animation/morph controls, and descriptor-only diagnostics
while keeping DOM-backed `WebGLTarget` model sources valid:
[2026-07-05-managed-model-animation.md](./superpowers/plans/2026-07-05-managed-model-animation.md).
Phase 7B is verified and corrects the model animation dogfood to play
`Sprint.glb`'s main skeleton clip, use skeleton-safe GLB scene cloning, and add
a minimal descriptor-only `WebGLModel.prepare.renderWarmup` path:
[2026-07-05-phase-7-model-animation-correction-model-prepare.md](./superpowers/plans/2026-07-05-phase-7-model-animation-correction-model-prepare.md).
Phase 7C is verified and adds explicit
`WebGLModel.animation.defaultClips` for intentional multi-clip defaults while
preserving `defaultClip`; the example dogfood frames `Sprint.glb` more directly
and uses explicit speed-line plane clips plus clip `timeScale` values so the
main skeleton, speed lines, and bag rig visibly move during browser validation.
It also uses the existing `animation.scrub` descriptor on its own pinned scroll
timeline, scrubbing the visible checkout control clip for interaction proof
without adding target-local `WebGLModel` effects:
[2026-07-06-phase-7c-explicit-default-clips.md](./superpowers/plans/2026-07-06-phase-7c-explicit-default-clips.md).
It does not add `playAllClips`, animation graphs, state machines, raw
mixer/action access, additive layers, bone attachments, IK, or retargeting.
Phase 7D is verified and keeps `WebGLModel.prepare.renderWarmup`
descriptor-only while making prepared scene-native model loading
viewport-proximity aware. The Sprint dogfood now stays queued while its
DOM-bound pass viewport is far from view, loads and render-warms inside the
prepare margin, and preserves visible-entry animation without reintroducing the
model-row scroll stall:
[2026-07-06-phase-7d-model-load-prepare-performance.md](./superpowers/plans/2026-07-06-phase-7d-model-load-prepare-performance.md).
Phase 8 implements the scene-native object/effect scope, `screen-plane`
placement against named stage planes, runtime-owned pick routing, descriptor-only
interaction debug state, object pointer/capture state, and minimal empty-space
orbit drag:
[2026-07-06-phase-8-interaction-picking.md](./superpowers/plans/2026-07-06-phase-8-interaction-picking.md).
Phase 8B is a planned roadmap slot, not a focused implementation plan yet, for
advanced managed camera gestures after Phase 8 input routing is stable.

The strategic direction is a DOM-first managed render system. `WebGLTarget`
remains the shortest and default authoring path; Level 1 usage must not require
user-authored scenes, cameras, or render passes. Managed scene/camera/stage APIs
are opt-in escalation for DOM-anchored scenes and advanced stage-local 3D
islands, not a replacement for DOM-driven authoring.

API design should stay agent-first, React-like, and Three-like: declarative
components and descriptors, explicit ownership and scope, familiar Three.js
vocabulary where it helps, runtime-owned lifecycle, and small cohesive modules
without premature generalized render-graph or raw Three.js escape hatches.

Relationship rules from the active roadmap:

- `WebGLTarget` remains the DOM-backed bridge for layout, fallback, lifecycle,
  target pointer state, and target-local effects.
- `WebGLScene` is an optional managed grouping/projection/pass boundary, not a
  raw `THREE.Scene` or a new default authoring requirement.
- `WebGLModel` is the opt-in scene-native model path for advanced 3D. Models
  that should follow DOM layout remain `WebGLTarget` model sources.
- One internal generated default scene, DOM-aligned camera, and generated pass
  preserve current behavior. The generated ids are reserved internally, so
  consumer ids such as `main` are ordinary managed ids.
- Scroll timelines and scoped effect routing are now the base for
  progress-driven model animation, later input routing/picking, and physics.
  Physics remains last, after managed stage/collider/input contracts exist.
- DOM-bound pass viewport/scissor is available for opt-in managed passes through
  `WebGLPassViewport` and pass `viewport` descriptors.

- managed scenes and cameras
- managed render passes
- managed lit stage primitives
- scoped effect contexts for object, scene, camera, and runtime
- managed scroll timelines/progress signals
- pass/runtime-scoped postprocess
- managed model animation
- managed input routing and picking
- advanced managed camera gestures after picking/router priority is stable
- dynamics/physics only after stage/collider contracts exist

## Active Docs

- [README.md](../README.md) - package overview and usage.
- [00-goal.md](./00-goal.md) - architecture principles.
- [roadmap/managed-render-system.md](./roadmap/managed-render-system.md) - next strategic roadmap.
- [agent/package-onboarding.md](./agent/package-onboarding.md) - agent starting point.
- [agent/package-usage.md](./agent/package-usage.md) - package contract reference.
- [agent/effect-object-boundary.md](./agent/effect-object-boundary.md) - current effect boundary.
- [examples/effect-authoring.md](./examples/effect-authoring.md) - consumer tutorial.
- [performance/profile-notes.md](./performance/profile-notes.md) - profiling notes.
