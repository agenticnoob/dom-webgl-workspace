# Current Status

**Last reviewed against:** Phase 5 target routing, scroll timelines, and effect scope implementation

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
  - postprocess requests
- Target-scoped pointer contract:
  - declarations use `pointer: { hover, press, click, drag }`
  - `ctx.pointer` is runtime/canvas pointer state
  - `ctx.targetPointer` is target-local pointer state
- Transform groups:
  - `transformScope: "subtree"` creates an internal runtime group
  - no public scene graph, group, matrix, or raw Three.js handle is exposed
- Opt-in managed render declarations:
  - React exports `WebGLScene`, `WebGLCamera`, and `WebGLRenderPass`
  - React scene-owned rendering is declared on `WebGLScene` with `render`;
    `WebGLRenderPass` remains the advanced explicit pass descriptor
  - vanilla runtime exposes `registerScene`, `registerCamera`, and
    `registerRenderPass` plus matching unregister methods
  - `WebGLTarget` inherits the nearest React `WebGLScene` when `webgl.sceneId`
    is absent; vanilla targets can set `sceneId` explicitly
  - managed DOM-aligned scene cameras resize with the runtime viewport, and
    `transformScope: "subtree"` groups stay inside the target's scene adapter
  - explicit scene projections support `dom-aligned`, `screen`, and
    `perspective-stage`
  - managed cameras support orthographic DOM/screen modes and perspective-stage
    mode through descriptors, not raw `THREE.Camera` handles
  - target placement supports `dom-anchored`, `screen-anchored`,
    `screen-depth`, and `stage-local`
  - render passes can request runtime-owned `clear` and `clearDepth`
  - scene-owned render declarations wait until the referenced/default camera is
    registered; scenes that do not opt into rendering do not require cameras
  - unregistering a managed scene releases live targets still routed to that
    scene
  - target debug summaries can expose `sceneId`, `projection`, and
    `placementMode`, but not raw scene/camera/pass objects
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
- Managed timeline bindings and effect scope metadata:
  - public declarations can bind `timeline` data on `WebGLTarget`,
    `WebGLScene`, `WebGLStagePlane`, `WebGLStageBox`, and `WebGLLight`
  - `WebGLCameraDeclaration` intentionally does not accept `timeline`; camera
    motion/focus/framing remains future explicit camera/pass-bound controller
    work
  - timeline bindings consume runtime `WebGLProgressSignalSource` values and
    normalize optional active ranges with `from`/`to`
  - `@project/dom-webgl-scroll-adapters/react` exports
    `WebGLScrollTimeline` as the broader named progress section, while
    `ScrollEffectSection` remains compatibility sugar for target/effect pinned
    sections
  - targets, render passes, and stage primitives/lights can activate from
    timeline ranges without React descriptor churn
  - effect contexts expose `ctx.runtime.progress` and optional
    `ctx.scene` metadata/timeline snapshots; they do not expose raw scenes,
    cameras, passes, or a `ctx.camera` field

## Active Caveats

- Managed scenes/cameras/passes are opt-in. `WebGLTarget` alone remains the
  shortest and default DOM-first path.
- `screen-depth` is the first perspective-stage DOM bridge. `screen-plane`
  remains deferred to the Phase 8 pre-step for screen-plane placement against
  named stage planes.
- `stage-local` placement sets explicit scene-local layout for a target.
  Scene-native `WebGLModel` declarations remain future roadmap work.
- `ctx.object.postprocess` is currently runtime-canvas scoped. It can affect the
  full WebGL canvas and should not be treated as target/model-local glow.
- Model-local glow should use material/emissive controls and runtime-owned
  lights unless whole-pass bloom is intentional.
- `dom/element` surfaces are canvas texture planes and do not respond to Three.js
  lighting. Use managed stage primitives for lit floors, walls, and backdrops.
- Nesting a `WebGLScene` or managed stage primitive section in React does not
  create a local DOM viewport. DOM-bound pass viewport/scissor is future Phase 6
  work; current examples should not present stage primitives as clipped to a
  section unless they are only controlling visibility/activation.
- Managed stage primitives and scene-owned lights are stable descriptors. Use
  them to declare scene substrate; do not drive high-frequency animation through
  React prop churn. Use timeline bindings and managed effect/controller state
  for progress-driven scene, stage, and light activation.
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
  local clipped viewport. DOM-bound pass viewport/scissor remains Phase 6 work.
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
- DOM-bound pass viewport/scissor belongs after Phase 5 scope/timeline ownership
  and before local pinned stage examples are treated as complete.

- managed scenes and cameras
- managed render passes
- managed lit stage primitives
- scoped effect contexts for object, scene, camera, and runtime
- managed scroll timelines/progress signals
- pass/runtime-scoped postprocess
- managed model animation
- managed input routing and picking
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
