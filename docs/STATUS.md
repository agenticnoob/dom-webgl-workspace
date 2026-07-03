# Current Status

**Last reviewed against:** Phase 3 projection policies implementation

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

## Active Caveats

- Managed scenes/cameras/passes are opt-in. `WebGLTarget` alone remains the
  shortest and default DOM-first path.
- `screen-depth` is the first perspective-stage DOM bridge. `screen-plane`
  remains deferred until named managed stage planes exist.
- `stage-local` placement sets explicit scene-local layout for a target, but
  named lit stage primitives and scene-native `WebGLModel` declarations remain
  future roadmap work.
- `ctx.object.postprocess` is currently runtime-canvas scoped. It can affect the
  full WebGL canvas and should not be treated as target/model-local glow.
- Model-local glow should use material/emissive controls and runtime-owned
  lights unless whole-pass bloom is intentional.
- `dom/element` surfaces are canvas texture planes and do not respond to Three.js
  lighting. Lit floors, walls, and backdrops require future managed stage
  primitives.
- `model/glb` renderables are fitted to their DOM target by the runtime layout
  pass. Effects that write `ctx.object.position` or `ctx.object.scale` take over
  placement.
- Scene-gated scroll remains an optional advanced scroll-locking capability.
  Ordinary pinned scrub sections should use `@project/dom-webgl-scroll-adapters/react`,
  `ScrollEffectSection`, stable `progressKey` values, and
  `ctx.progress.get(progressKey)`.
- Batching remains profile-gated. The current example does not prove draw calls
  dominate enough compatible active planes to justify broad batching by default.

## Active Direction

The next roadmap is [roadmap/managed-render-system.md](./roadmap/managed-render-system.md).
Use that roadmap's `Roadmap Status` table as the source of truth for what has
not started, what has a focused plan, what is in progress, and what is verified.
Phase 1 internal render layer foundations are verified. Phase 2 opt-in
scene/camera/pass declarations are verified behind managed descriptors while
the default Level 1 path still flows through internal generated
scene/camera/pass entries. Phase 3 projection policies are implemented through
explicit scene projections, managed camera modes, target placement descriptors,
and pass clear controls:
[2026-07-03-projection-policies.md](./superpowers/plans/2026-07-03-projection-policies.md).

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
- Scroll timelines and scoped effect routing should land before progress-driven
  model animation, input routing/picking, and physics. Physics remains last,
  after managed stage/collider/input contracts exist.

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
