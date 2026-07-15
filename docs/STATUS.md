# Current Status

**Last reviewed against:** 2026-07-15 source and published alpha.1 registry

This is the current-truth summary. Completed execution plans and older
phase records are archived under [archive/](./archive/).

## Project State

Capability-stable, release-validation stage. Runtime capabilities are not
expanding during alpha release work; package hardening, public documentation,
skill authoring, and defect fixes remain valid upstream work. Independent
consumer implementation and acceptance stay in downstream repositories.

The lockstep `0.1.0-alpha.1` versions of `@viselora/dom-webgl` and
`@viselora/scroll-adapters` are public on npm with provenance. npm's `alpha`
dist-tag points to alpha.1, while `latest` remains on alpha.0. The
`skills/viselora-dom-webgl/` consumer skill is published in this repository.
That skill is now a general brief-to-browser development workflow rather than a
five-recipe requirement: it covers narrative directions, 4–8 beats, local asset
provenance, public capability mapping, selected-capability verification, and
downstream browser/narrative evidence. Versioned recommendations live in
`skills/viselora-dom-webgl/references/capability-status.md`, while
`skills/viselora-dom-webgl/references/api-surface.generated.md` indexes every
published value/type export. This work does not expand runtime capabilities or
claim that all public APIs are externally verified.
The remaining bootstrap action is to configure a Trusted Publisher for each npm
package, then delete the GitHub `NPM_TOKEN` Environment secret and revoke the
temporary granular token. See
[project-release-validation.md](./project-release-validation.md).

Alpha.1 fixes the cross-entrypoint scene-object effect registry defect whose
exact alpha.0 error was `Effect "<kind>" is not a scene-object effect.` The
published source passed packed root/React tarball unit and real-Chromium gates,
including `ready + attached`, progress/pointer transforms, managed Points,
reversible solid/points pixels, clean console/page errors and Canvas `1 -> 0 ->
1`. That installed-tarball fixture is release-gate evidence, not a claim that an
independent downstream application has completed its own implementation or
browser acceptance. Downstream consumer work is owned and reported separately.

## 2026-07-14 Next.js WebGLMesh Tetrahedron Hero

**Implemented:** `apps/hero-next` is a private Next.js App Router workspace that
consumes only the public Viselora package entrypoints. It keeps the reserved
default scene empty and places a public `WebGLMesh` tetrahedron in
`hero.tetrahedron.scene`, using a managed perspective camera, two declarative
directional lights, one effect-owned pointer light, a scene-object effect, and
the public Lenis/GSAP scroll stack. The ambient fill remains commented out;
directional key and rim lights are registered with the current user-tuned
positions and intensities. The previous `4.glb` and app-local Draco decoder assets were removed.
The foreground Ghost Cursor layer was removed, and the tetrahedron radius was
reduced from the initial `0.65` to `0.52`. The hero remains pure visual,
responsive, and static under `prefers-reduced-motion`.

**Verified:** focused Vitest contracts cover the workspace shell, stable scene
declarations, `WebGLMesh` geometry/material, managed motion/scale behavior,
legacy asset removal, and visual CSS. The hero workspace passes TypeScript and
a Next.js production build. Real-browser evidence at 1200×835 and 390×844
confirmed the initial `WebGLMesh` replacement, one managed canvas, no page
console errors, and no GLB or Draco resource requests. The later foreground-layer
removal and `radius: 0.52` adjustment were automated-test/typecheck/build
verified. The latest material, camera, fixed-light, non-spinning motion, and
pointer-light tuning is automated-verified in this closeout. The user has now
visually checked the `opacity: 0.92` experiment and reports that it appears
white/milky rather than transparent. The 2026-07-16 neutral grayscale palette
change is focused-test/typecheck/build verified and production-browser verified
at 1200×835 with one managed canvas, a full light-gray background, and no console
errors or warnings; the stable visual capture used reduced motion and synchronized
after two animation frames to avoid mid-frame WebGL screenshot artifacts.
The subsequent dark-gray smoke and dark-silver tetrahedron pass was also verified
against the production build with one managed canvas and no console errors or warnings.

**Implemented:** the tetrahedron no longer has time-driven self-rotation. Its
normal-motion base rotation is `[-0.6, 0.82, 0.08]`, with the existing damped
pointer tilt added on X/Y. It uses a subtle six-second `±1.2%` breathing scale
and eight-second `±0.018` Y float. Reduced motion remains static at
`[-0.6, 0.85, 0.08]`. The hero now uses a neutral grayscale palette with no
purple visual sources: the opaque background shader base is `vec3(0.72)`, its
smoke is `#3f3f3f`, the dark-silver standard material is `#5f5f5f`, and its emissive is
`#0d0d0d` at `0.06`. Opacity remains `0.92`, metalness `0.9`, and roughness `0.12`;
the opacity is ordinary alpha blending, not physical transmission or refraction.
Camera position is `[0, 0, 3.2]` with target `[0, 0.32, 0]`. The neutral
directional key uses `#f2f2f2`, position `[1.2, 1.2, 2]`, and intensity `4.8`;
the neutral rim uses `#b8b8b8`, position `[1.8, -1.4, 2]`, and intensity `2.2`.
The smoke composites by mixing the light-gray base toward its dark-gray tint;
it no longer uses the earlier additive path that made neutral smoke appear white.

**Implemented:** runtime render quality is now a controlled public declaration.
Existing consumers keep `antialias: false` and maximum DPR `1.5` by default;
`apps/hero-next` passes a stable `{ antialias: true, maxDevicePixelRatio: 2 }`
declaration through `WebGLScrollRuntime`. The runtime applies the same normalized
DPR cap to the managed renderer and layout snapshots, while DOM-backed texture
modules retain their stricter internal safety caps. This improves tilted geometry
edge sampling without changing tetrahedron `detail` or exposing raw renderer/context
handles, at the cost of additional GPU and memory work.

**Verified:** render-quality normalization, renderer construction, DPR capping,
runtime/React forwarding, public type exports, and the hero-next declaration are
covered by focused tests. The full repo tests, root typecheck, workspace build,
import boundary, skill/API surface, package tarball, and external consumer gates
pass. The external consumer gate also passes its Chromium final-canvas check;
hero-next edge smoothness remains user-owned visual QA rather than an agent claim.

**Open visual gap:** user QA does not accept the current alpha experiment as
light passing through the tetrahedron. With `metalness: 0.9`, `roughness: 0.12`,
and strong scene lights, the 92%-opaque standard material preserves bright
metallic highlights and reads as white/milky. Public `WebGLMesh` materials do
not currently expose physical transmission, thickness, or IOR, so a true
refractive treatment remains a package capability gap rather than an app-local
parameter adjustment.

**Implemented:** the existing background `WebGLTarget` effect owns a
mouse-follow point light through `ctx.object.lights.point(...)`. It maps the
full-screen target-local pointer into world coordinates near the tetrahedron,
updates the stable `hero.pointer-light` key with damped position and intensity,
fades intensity after pointer exit, keeps a static low-intensity light under
reduced motion, and removes the light through the managed facade on effect
dispose. Its current color is neutral `#f0f0f0`; the camera-side position uses `Z=1.1`,
active target intensity `10`, `distance: 1.8`, and `decay: 3` as an app-local
tighter-range approximation. The light remains omnidirectional and scene-scoped
rather than truly target-scoped. In the
current hero it is visually isolated to the standard-material tetrahedron
because the background Ghost Cursor uses an unlit custom shader; this does not
claim general per-target light isolation.

**Unchanged:** release versions, the managed-render roadmap, publication state,
and release gates were not changed by the hero render-quality opt-in.

## Product Boundary

The product remains a DOM-first managed WebGL runtime. It is not a React
Three Fiber replacement, not a raw Three.js wrapper, and not an R3F companion
runtime. R3F/Drei are better suited for free-form Three.js scene authoring and
agent-authored 3D applications; this repo stays focused on DOM targets,
runtime-owned layout projection, fallback visibility, lifecycle/offscreen
policy, scroll/pointer orchestration, resources, debug state, and controlled
effects.

Do not add R3F parity features just because R3F can express them. In particular,
do not add raw Three refs, full JSX mapping, `primitive`/`extend`, consumer-owned
scene graph mutation, raw controls, raw loaders, or raw render hooks to this
runtime. Free-form R3F applications remain a different ownership model, but
migration to R3F is not required to publish or consume Viselora.

The public visual choice tree is intentionally singular:

```text
DOM-backed visual -> WebGLTarget
Procedural 3D geometry -> WebGLMesh
GLB asset -> WebGLModel
```

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
- `apps/example` remains the public dogfood/tutorial surface.
- `apps/hero-next` is a private repo-local Next.js public-API consumer and does
  not change runtime/package behavior or release scope.

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
  - managed scene/camera layers are resized only after the renderer viewport
    actually changes, so unchanged frames do not reset controller-owned camera
    state
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
- Opt-in managed procedural meshes and scene-owned lights:
  - React exports `WebGLMesh` and `WebGLLight`
  - vanilla runtime exposes `registerMesh`, `unregisterMesh`,
    `registerLight`, and `unregisterLight`
  - `WebGLMesh.geometry` supports `plane`, `box`, `sphere`, `cylinder`, `cone`,
    and `tetrahedron`; plane roles are `floor`, `wall`, and `backdrop`
  - the advanced `custom` geometry descriptor accepts a stable factory that
    returns a fresh `BufferGeometry`; the consumer declares `three` directly,
    while runtime validation, ownership, and disposal remain managed
  - supported stage materials are descriptor-only `standard` and `basic`
    solid-color materials
  - supported scene-owned lights are `ambient`, `directional`, and `point`
  - stage meshes, geometry, materials, groups, light targets, and lights are
    runtime-owned and disposed by unregister, scene unregister, or runtime
    dispose
  - debug state reports `meshCount`, `meshes`, and each `geometryKind`, plus
    descriptor-only light inventory, without exposing raw Three.js objects
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
  - `WebGLModel` and procedural meshes can declare scene-object `effects` and
    `interaction.pickable`; these use explicit scene-object scope, not
    DOM-target layout/fallback semantics
  - scene-object effects are registered with `defineWebGLSceneObjectEffect(...)`
    and receive `ctx.objectPointer`, `ctx.object`, `ctx.scene`, and
    `ctx.runtime` without raw intersections, raycasters, cameras, or
    `ctx.targetPointer`
- Opt-in scene-native dynamics/physics:
  - `WebGLMesh` and `WebGLModel` can declare
    descriptor-only `physics`
  - supported body types are `static`, `dynamic`, and `kinematic`
  - supported collider descriptors are `bounds`, `box`, `sphere`, and `plane`
  - supported constraints are `anchor` and `spring`; `pointerDrag` uses Phase 8
    press-hit and drag-delta state for direct scene-XY manipulation, then
    resumes physics on release with velocity from the last drag movement
  - the runtime owns body state, integration, simple static collision response,
    transform writes, frame scheduling, debug summaries, and disposal
  - debug state can report descriptor-only physics body counts, active body
    counts, collisions, positions, velocities, collider kind, constraint count,
    and pointer-drag activity without exposing a physics engine or raw Three.js
    objects
- Managed timeline bindings and effect scope metadata:
  - public declarations can bind `timeline` data on `WebGLTarget`,
    `WebGLScene`, `WebGLMesh` and `WebGLLight`
  - `WebGLCameraDeclaration` intentionally does not accept top-level
    `timeline`; managed perspective-stage cameras can declare one nested
    `controller` that reads progress and drives `position`, `target`, and `fov`
    before `screen-depth`/`screen-plane` projection and pass rendering
  - perspective-stage cameras can also declare `controller.pointer` for
    primary-drag orbit, pan, dolly, camera pointer parallax, damping, and reset
    gestures; the legacy `{ kind: "orbit", activation: "empty-space-drag" }`
    shorthand remains supported
  - hover/click-only object hits do not block camera drag; dragging suppresses
    object hover/click routing until release, and explicit object drag capture
    still blocks camera gestures
  - hover/click picking runs after the current-frame managed camera gesture
    update, so hit regions follow the current orbit/dolly/parallax/reset camera
    and DOM-rect render passes use the pass-local viewport for gesture framing
    and managed picking rather than the previous view
  - timeline bindings consume runtime `WebGLProgressSignalSource` values and
    normalize optional active ranges with `from`/`to`
  - `@viselora/scroll-adapters/react` exports
    `WebGLScrollTimeline` as the broader named progress section, while
    `ScrollEffectSection` remains compatibility sugar for target/effect pinned
    sections
  - targets, render passes, and procedural meshes/lights can activate from
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
  `WebGLCamera` basis at a fixed depth, but it does not rotate the target plane
  into a camera-facing billboard. Fullscreen surfaces under a tilted camera
  must keep the camera aligned or apply app-owned effect overscan.
  `screen-plane` casts the DOM rect center through the active camera to a named
  stage plane and applies optional descriptor `offset`/`scale`; when the
  plane/camera intersection cannot be resolved, debug/layout diagnostics stay
  descriptor-only.
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
  lighting. Use managed procedural meshes for lit floors, walls, and backdrops.
- `WebGLPassViewport` is only for opt-in managed scene/pass work. Level 1
  `WebGLTarget` usage does not need viewport anchors. Nesting a `WebGLScene`
  alone still does not create a local DOM viewport; the render pass must declare
  `viewport: { mode: "dom-rect" }` and resolve to a registered viewport anchor.
  The runtime clips that anchor rect to the visible canvas viewport each frame;
  the original anchor rect still defines the pass mapping, so partially visible
  passes are clipped rather than compressed into the visible slice. Fully
  offscreen pass viewports are skipped instead of drawing behind unrelated DOM
  sections.
- Managed procedural meshes and scene-owned lights are stable descriptors. Use
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
- Scene-native physics descriptors are stable declarations on managed
  stage/model objects only. They are not Level 1 `WebGLTarget` physics, not a
  raw physics engine escape hatch, and not a full rigid-body solver. The v1
  implementation is intentionally small: gravity/velocity/damping,
  anchor/spring constraints, direct pointer-drag manipulation, static plane/box
  collision response, runtime-owned transform writes, and descriptor-only debug.
  Dynamic-vs-dynamic impulses, collision callbacks/events, joints, compound
  colliders, external physics adapters, wheel/pinch physics controls, and
  public body handles remain out of scope.
- `model/glb` renderables are fitted to their DOM target by the runtime layout
  pass. Effects that write `ctx.object.position` or `ctx.object.scale` take over
  placement.
- Scene-gated scroll remains an optional advanced scroll-locking capability.
  Ordinary pinned scrub sections should use `@viselora/scroll-adapters/react`,
  `ScrollEffectSection` or `WebGLScrollTimeline`, stable progress ids, and
  `ctx.progress.get(progressKey)` / `ctx.runtime.progress.get(progressKey)`.
- Timeline bindings can hide/skip targets, scenes, procedural meshes, and lights
  by progress range. Active ranges do not override explicit effect visibility or
  `visible: false` declarations. They also do not make a nested `WebGLScene` a
  local clipped viewport; local pass clipping is the separate
  `WebGLPassViewport` + pass `viewport` contract.
- Camera motion/focus/framing is not part of target-local effects or Phase 5
  target/scene timeline bindings. Progress-driven perspective-stage camera
  motion now uses the Phase 6A nested `WebGLCamera.controller` descriptor.
  Controller framing is re-applied after managed camera resize so a scroll-held
  camera does not snap back to its declaration base frame when scroll progress
  stops changing. Phase 8B adds drag-based primary orbit, pan, dolly,
  camera-scoped pointer parallax, kinematic damping, and reset through
  `controller.pointer`; hover/click-only object hits do not block camera drag,
  active camera drags continue until release, dragging suppresses object
  hover/click routing, and explicit object drag capture still blocks camera
  gestures. Hover/click picking reads the current-frame gesture-updated camera
  before resolving managed object hits, and DOM-rect render passes use the
  pass-local viewport for gesture framing and picking.
  Timeline and pointer gesture frames are both re-applied after true managed
  camera resize, so scroll-held cameras and stopped/released camera drags do
  not snap back to their declaration base frame.
  Orthographic zoom controllers, screen overlay camera controllers, complex
  framing boxes, and pass-bound camera controller scope are deferred possible
  camera-controller iterations. Mouse wheel zoom and touch pinch zoom are
  deferred out of Phase 8B v1 to avoid page scroll and mobile gesture ownership
  conflicts.
- The managed timeline example uses the same named progress signal for a
  `WebGLCamera.controller` and the card effect, while the scene, stage
  primitives, lights, and visible scene-child `WebGLTarget` display directly.
  The card inherits the managed scene, uses `screen-depth` placement, and the
  scene pass uses `WebGLPassViewport` with
  `viewport: { mode: "dom-rect", scissor: true }` so the pinned section DOM rect
  clips the managed pass on the shared runtime canvas. The card effect enters
  from the named progress signal and holds its final visible state through the
  end of the pinned timeline. The separate managed procedural mesh dogfood is
  ordered before this pinned timeline so the timeline exit does not hand off
  directly into another similar 3D stage pass.
- The managed procedural mesh example is mounted in `apps/example` and dogfoods
  `WebGLPassViewport` with pass `viewport: { mode: "dom-rect", scissor: true }`
  and descriptor-level bloom/grain/blur postprocess. It remains one runtime
  canvas; the pass is clipped by the visible DOM rect without remapping into
  the visible slice, instead of becoming a second canvas or drawing as a
  full-canvas background while offscreen.
- The managed interaction example is mounted in `apps/example` as the Phase 8B
  dogfood surface with a pickable `WebGLMesh` floor and one pickable
  scene-native `/models/hero.glb` model. It keeps the managed `WebGLScene`,
  `WebGLCamera`, `WebGLPassViewport`, minimal lights, floor/model scene-object
  effects registered with `defineWebGLSceneObjectEffect(...)`, pass-local
  DOM-rect gesture framing/picking, model press/drag capture, and rich
  `controller.pointer` camera gestures: primary-drag orbit, secondary-drag
  pan, Alt + primary-drag dolly, camera parallax, damping, and double-click
  reset. It does not declare physics and still omits `screen-plane` DOM
  targets.
- The managed physics example is mounted in `apps/example` as the separate
  Phase 9 dogfood surface. It uses its own managed `WebGLScene`,
  `WebGLCamera`, and `WebGLPassViewport` and covers the full Phase 9 v1
  descriptor surface: static, dynamic, and kinematic bodies; plane, box,
  sphere, and bounds colliders; anchor and spring constraints; direct
  pointer-drag manipulation; procedural mesh physics; and scene-native
  `WebGLModel` physics.
  The blue and yellow bodies visibly move from anchor/spring constraints, the
  model sweeps as a kinematic body, and the orange crate is pointer-draggable.
  The red block is the direct drag/release test body: drag it to generate
  velocity, then release it to bounce against the floor and static box
  colliders; dynamic-vs-dynamic impulses remain out of scope.
  `example.physicsKinematicSweep` is an app-owned scene-object effect used only
  to make the kinematic model motion visibly verifiable.
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
and pass clear controls. Phase 4 managed procedural meshes add scene-native
plane/box descriptors and scene-owned lights without raw Three.js handles:
[2026-07-04-managed-stage-primitives.md](./superpowers/plans/2026-07-04-managed-stage-primitives.md).
Phase 5 target routing, scroll timelines, and effect scope adds named timeline
bindings for targets/scenes/procedural meshes/lights, the `WebGLScrollTimeline`
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
Phase 7B is verified and corrects the model animation dogfood to play the human
base model's exported skeletal clips, use skeleton-safe GLB scene cloning, and
add a minimal descriptor-only `WebGLModel.prepare.renderWarmup` path:
[2026-07-05-phase-7-model-animation-correction-model-prepare.md](./superpowers/plans/2026-07-05-phase-7-model-animation-correction-model-prepare.md).
Phase 7C is verified and adds explicit
`WebGLModel.animation.defaultClips` for intentional multi-clip defaults while
preserving `defaultClip`; the example dogfood now frames
`human_male_base.glb` directly and uses pinned `WalkCycle` scrub so skeletal
animation remains visible during browser validation without the previous heavy
Sprint asset or unrelated exported clips.
It also uses the existing `animation.scrub` descriptor on its own pinned scroll
timeline, scrubbing the visible `WalkCycle` clip for interaction proof
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
Phase 8B verifies advanced managed camera gestures after Phase 8 input routing
is stable:
[2026-07-06-phase-8b-advanced-camera-gesture-controllers.md](./superpowers/plans/2026-07-06-phase-8b-advanced-camera-gesture-controllers.md).
Phase 9 adds a focused descriptor-only scene-native dynamics/physics slice with
runtime-owned body, collider, constraint, pointer-drag, transform, debug,
scheduling, and disposal semantics:
[2026-07-07-phase-9-dynamics-physics.md](./superpowers/plans/2026-07-07-phase-9-dynamics-physics.md).

The strategic direction is a DOM-first managed render system. `WebGLTarget`
remains the shortest and default authoring path; Level 1 usage must not require
user-authored scenes, cameras, or render passes. Managed scene/camera/stage APIs
are opt-in escalation for DOM-anchored scenes and advanced stage-local 3D
islands, not a replacement for DOM-driven authoring.

API design should stay agent-first, React-like, and Three-like: declarative
components and descriptors, explicit ownership and scope, familiar Three.js
vocabulary where it helps, runtime-owned lifecycle, and small cohesive modules
without premature generalized render-graph or raw Three.js escape hatches.
Agent-first does not mean R3F parity. The value of this runtime is higher-level
DOM/WebGL orchestration for page authors, not giving agents a second way to
write arbitrary Three.js scenes.

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
  progress-driven model animation, input routing/picking, and physics.
  Physics is opt-in Level 3 scene-native work built against verified managed
  stage, picking, object hit state, and camera gesture priority.
- DOM-bound pass viewport/scissor is available for opt-in managed passes through
  `WebGLPassViewport` and pass `viewport` descriptors.

- managed scenes and cameras
- managed render passes
- managed lit procedural meshes
- scoped effect contexts for object, scene, camera, and runtime
- managed scroll timelines/progress signals
- pass/runtime-scoped postprocess
- managed model animation
- managed input routing and picking
- advanced managed camera gestures
- scene-native dynamics/physics only through managed descriptors

## Active Docs

- [README.md](../README.md) - package overview and usage.
- [00-goal.md](./00-goal.md) - architecture principles.
- [roadmap/managed-render-system.md](./roadmap/managed-render-system.md) - next strategic roadmap.
- [agent/package-onboarding.md](./agent/package-onboarding.md) - agent starting point.
- [agent/package-usage.md](./agent/package-usage.md) - package contract reference.
- [agent/effect-object-boundary.md](./agent/effect-object-boundary.md) - current effect boundary.
- [examples/effect-authoring.md](./examples/effect-authoring.md) - consumer tutorial.
- [performance/profile-notes.md](./performance/profile-notes.md) - profiling notes.
