# Architecture

Viselora is a DOM-first managed WebGL runtime. The DOM remains the source of
layout, semantic content, fallback, and accessibility; WebGL is a runtime-owned
visual projection of declared targets and scene objects.

## Core flow

```text
DOM element
  -> target declaration
  -> source declaration
  -> layout/content measurement
  -> render role
  -> runtime-owned renderable
  -> scene object
  -> runtime-owned renderer
```

Each runtime owns one fixed, transparent canvas. It batches DOM measurements,
projects them into scene coordinates, synchronizes sources and effects, renders,
and publishes descriptor-only debug state.

## Ownership model

The application owns:

- semantic DOM and fallback content;
- stable target, scene, mesh, model, and effect declarations;
- app-specific effect definitions and parameters;
- assets and asset provenance;
- the lifecycle of app-created external instances such as Lenis when explicitly
  configured that way.

The runtime owns:

- canvas, renderer, scenes, cameras, passes, scene objects, and frame scheduling;
- DOM measurement and projection;
- resource loading, caching, cloning, texture updates, and release;
- material, light, animation, postprocess, picking, and bounded physics state;
- scroll/pointer normalization, interaction priority, offscreen policy, and
  fallback visibility;
- idempotent disposal.

The public API does not transfer raw Three.js ownership to the application.

## Authoring levels

### DOM-backed targets

`WebGLTarget` is the default path. It connects a DOM element to a source,
layout, fallback, lifecycle, pointer state, and target effect declarations.

Sources use one strict shape:

```ts
type SourceKind = "dom" | "media" | "model";
```

The subtype is declared with `type`, for example:

- `{ kind: "dom", type: "element" }`
- `{ kind: "dom", type: "text" }`
- `{ kind: "media", type: "image" }`
- `{ kind: "media", type: "video" }`
- `{ kind: "media", type: "image-sequence" }`
- `{ kind: "model", type: "glb" }`

Default render roles are inferred from the source: DOM elements become
surfaces, DOM text becomes content, media becomes media, and GLB becomes model.
DOM text snapshots preserve the source element's computed typography and color
so runtime rasterization follows the active semantic theme.

### Managed scenes

`WebGLScene`, `WebGLCamera`, `WebGLRenderPass`, `WebGLPassViewport`, and
`WebGLLight` are opt-in declarations for explicit projection, pass, viewport,
camera, and lighting ownership. They refine the managed model; they do not
expose raw scene graph handles.

### Scene-native objects

`WebGLMesh` declares procedural geometry. `WebGLModel` declares a scene-native
GLB. Use these for 3D objects that do not require a DOM target's fallback and
layout semantics.

Use `WebGLTarget` with a model source when the GLB must follow a DOM rect or keep
DOM fallback behavior.

## Effect model

Target effects are defined with `defineWebGLEffect(...)`. Scene-native mesh and
model effects are defined with `defineWebGLSceneObjectEffect(...)`.

Declarations always use array form:

```ts
effects: [{ kind: "app.effect", intensity: 0.5 }]
```

Effects receive controlled context. `ctx.object` exposes managed Three-like
vocabulary for transforms and supported visual modules while the runtime owns
the underlying renderer, objects, materials, textures, lights, loaders, mixers,
passes, and cleanup.

Important boundaries:

- `ctx.object.position` is scene-space, not DOM `left`/`top`.
- Writing model position/scale takes over runtime DOM-fit placement.
- Postprocess requests are canvas/pass scoped.
- Effects do not scan DOM or create their own resource pipeline.
- Effect-owned resources must be released through their managed facades.
- Runtime and scene-object effect definition lists remain referentially stable.

## React model

The React adapter registers stable declarations with the runtime:

- `WebGLRuntime` owns the runtime lifetime.
- `WebGLTarget` owns a DOM-backed declaration.
- managed scene components register optional advanced declarations.
- hooks expose runtime/progress stores without transferring render-loop
  ownership.

A mounted target declaration is immutable in practice. If source, effects,
scroll, pointer, or lifecycle semantics must change, remount with a new React
key. High-frequency visual state belongs in effects/progress stores, not React
prop churn.

## Layout and hierarchy

DOM rects are read in a batched layout pass. Nested registered targets form an
internal layer tree based on DOM ancestry and sibling order.

`transformScope: "subtree"` gives a parent target a managed group transform.
Children keep independent source, texture, effects, fallback, lifecycle, and
offscreen ownership. Inverse-transformed picking is not part of this contract.

Managed scenes support DOM-aligned, screen, and perspective-stage projection
policies. Pass viewports clip rendering to a registered DOM rect without
creating a second canvas.

## Lifecycle and resources

Fallback DOM stays visible while a renderable is loading or in error. Once
ready, `hideWhenReady` and `hideMode` control fallback visibility. Unregistering
a target or disposing the runtime restores fallback state.

Offscreen policy is explicit:

- `restore-dom` releases WebGL resources and restores fallback;
- `park` pauses effect work while retaining WebGL resources.

Image, video, image-sequence, and GLB resources are normalized and cached by
resource key. Draco decoder paths are declarative and app-hosted.

## Scroll and pointer

Native page scroll is the default. Optional adapters connect Lenis, GSAP, and
ScrollTrigger without giving them renderer ownership.

Progress signals are shared runtime inputs. Scene gates are a separate advanced
feature that can temporarily lock page scroll and map delta to scene progress.

PointerEvents are normalized once. Target pointer state is layout-local;
scene-object picking and managed camera gestures follow explicit interaction
priority. Raw raycasters and intersections remain private.

## Repository boundaries

```text
packages/  reusable public implementation
apps/      public-entrypoint consumers
skills/    versioned consumer workflow and generated API navigation
docs/      current project truth and task guides
scripts/   build, release, and boundary tooling
test/      repository-level guards
```

Applications never import package source paths. Package implementation never
imports or branches on application details.

## Non-goals

- raw Three.js renderer/scene/camera/object/material ownership;
- multiple runtime canvases for one page experience;
- a React Three Fiber compatibility or parity layer;
- consumer-owned render loops, loaders, mixers, raycasters, or disposal;
- unrestricted shader, render-graph, physics-engine, or scene-graph escape
  hatches;
- app-specific behavior in public packages.

Current implementation and evidence belong in [STATUS.md](./STATUS.md), not in
this architecture document.
