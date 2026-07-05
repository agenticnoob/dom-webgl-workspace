# Effect Object Boundary

Date: 2026-07-02

This document is the forward public API boundary for custom effect authoring. It
exists to prevent the package from drifting into a growing collection of
source-specific effect handles.

## Current Truth

The current public effect context exposes `ctx.object`, `ctx.resources`,
`ctx.pointer`, `ctx.targetPointer`, `ctx.progress`, `ctx.runtime`,
`ctx.scene`, `ctx.layout`, `ctx.input`, `ctx.scroll`, `ctx.scrollProgress`,
`ctx.time`, `ctx.delta`, `ctx.key`, and `ctx.sourceKind`.

`ctx.object` is the public authoring handle for transform, visibility, opacity,
material, lights, animation, and surface/text/texture/video/model source-backed
capabilities. `ctx.runtime.postprocess` owns explicit canvas/pass-scoped
postprocess requests. Source, target, and visual handles are internal runtime
assembly details. They are not part of the public effect context and are not
exported from the package root as effect authoring API.

The public authoring model is managed Three-like API: consumers use familiar
Three.js vocabulary such as `position`, `rotation`, `scale`, `material`,
`lights`, and `animation`, while the runtime owns raw Three.js renderer, scene,
camera, objects, materials, textures, loaders, mixers, lights, render targets,
scroll, pointer, lifecycle, disposal, and performance scheduling.

`ctx.runtime` and `ctx.scene` are managed scope metadata, not raw handles.
`ctx.runtime.progress.get(key)` reads the same keyed progress source as
`ctx.progress.get(key)`. `ctx.scene` is optional and exposes descriptor
metadata plus the scene timeline snapshot when the current target/update is
routed through a managed scene. There is no implicit `ctx.camera`; camera
motion/focus/framing uses explicit managed camera descriptors such as nested
`WebGLCamera.controller`, not target-local effect context. Pass-bound and
pointer-driven camera controllers remain future work.

## Product Thesis

The package should own:

- one runtime canvas and renderer loop;
- DOM layout projection and target registration;
- scroll, keyed progress, and pointer input monitoring;
- source loading, fallback visibility, resource lifetime, disposal, and
  performance scheduling;
- internal Three.js objects, materials, textures, render targets, lights,
  animation mixers, raycasters, and renderer state.

Consumers should own:

- target declarations;
- effect definitions;
- effect params;
- product visuals, assets, copy, and visual tuning.

Effect authors should write visual logic with a Three.js-like mental model while
staying inside a controlled runtime facade. The public authoring center should
be a single controlled object:

```ts
defineWebGLEffect({
  kind: "app.hero",
  update(ctx) {
    const object = ctx.object;

    object.position.y = Math.sin(ctx.time / 1000) * 24;
    object.rotation.y += ctx.delta / 1000;
    object.scale.setScalar(1.08);
    object.opacity = 0.82;

    object.model?.meshes.forEach((mesh) => {
      mesh.material.opacity = 0.9;
    });
    ctx.runtime.postprocess.request({
      key: "app.heroPassBloom",
      scope: { passId: "hero.pass" },
      bloom: { strength: 0.35 },
    });
  },
});
```

The object above is not a raw Three.js object. It is a controlled Three-like
facade owned by the runtime.

## Why This Is The Right Boundary

Most downstream consumers are expected to be AI agents. AI agents already know
common Three.js authoring patterns such as `position`, `rotation`, `scale`,
`visible`, `material`, `uniforms`, animation clips, and hit tests. They are less
likely to reliably remember the old package-specific split between source
layers, target transforms, and visual postprocess handles.

The package should therefore reuse Three.js vocabulary where it improves
authoring accuracy, but keep raw Three.js ownership internal.

## Hard Public Boundary

Do not expose any of these public objects:

- raw `WebGLRenderer`;
- raw `Scene`;
- raw `Camera`;
- raw `Object3D`, `Group`, `Mesh`, `Material`, `Texture`, `Geometry`, `Light`;
- raw `AnimationMixer` or `AnimationAction`;
- raw `Raycaster` or intersection objects;
- raw `EffectComposer`, passes, render targets, or renderer state;
- loader instances or loader callbacks such as `configureLoader(loader)`,
  `onGLTFLoaded(gltf)`, or `onObject3D(object)`.

The package may expose controlled facades whose naming and mutation style feel
familiar to Three.js users. The facade must translate all mutations into
runtime-owned operations.

## Forward Object Shape

The exact TypeScript shape should be designed and tested in the implementation
plan, but the public hierarchy should stay centered on one object:

```ts
ctx.object
ctx.object.position
ctx.object.rotation
ctx.object.scale
ctx.object.visible
ctx.object.opacity
ctx.object.material
ctx.object.texture
ctx.object.surface
ctx.object.text
ctx.object.model
ctx.object.animation
ctx.object.lights
ctx.object.hitTest
ctx.runtime.postprocess
```

Capabilities that do not apply to the current source should be absent or return
a clear controlled diagnostic. They should not force users back into a separate
source-handle mental model.

Scope metadata sits beside `ctx.object`:

```ts
ctx.runtime.progress.get("hero.timeline");
ctx.scene?.timeline?.progress;
ctx.scene?.timeline?.active;
```

These scopes are read-only runtime facts and managed routing metadata today.
They do not expose raw scene, camera, pass, renderer, composer, or object
instances.

## Direction For Existing Handles

Source, target, and visual handles should be treated as internal implementation
substrate, not the place to keep expanding the public API.

New public visual capabilities should be designed for `ctx.object` first. If a
capability requires source-specific internals, implement those internals behind
the facade.

Do not continue this pattern:

```ts
ctx.source.model.animations
ctx.source.model.requestLight
ctx.source.model.hitTest
ctx.source.model.materialVariants
ctx.source.model.getNodes
```

Prefer this pattern:

```ts
ctx.object.animation?.play("Idle");
ctx.object.animation?.crossFade("Idle", "Walk", { fadeMs: 180 });
ctx.object.model?.morphs?.set("Smile", 0.65);
ctx.object.lights?.directional("rim", { intensity: 1.5 });
ctx.object.hitTest?.({ mode: "mesh" });
ctx.object.model?.variants.apply("Dark");
ctx.object.model?.meshes.select({ nameIncludes: "Body" });
```

## Relationship To Model Capability Work

Model asset loading, decoder configuration, GLB diagnostics, and fit/pivot
policy are still valid runtime-owned asset capabilities. They are not replaced
by `ctx.object`.

Compressed models use declarative loader config, not loader callbacks. A source
or scene-native `WebGLModel` can declare
`loader: { draco: { decoderPath } }`; the app still serves matching decoder
files from its public/static asset root.

DOM-backed `model/glb` targets still use `WebGLTarget` for DOM layout,
fallback, lifecycle, target pointer state, and target-local effects.
Scene-native `WebGLModel` is separate: it belongs to a managed scene, can
declare scene-local transform/timeline/animation descriptors, and does not
accept target-local `effects` in Phase 7 v1.

`ctx.object.animation` exposes controlled clip methods (`clips`, `play`,
`scrub`, `blend`, `crossFade`, `stop`, `stopAll`, `setTime`). `ctx.object.model`
can expose controlled mesh handles, point layers, morph names/weights, and
named rig bones. Effects still do not receive raw mixers, actions, bones,
skeletons, meshes, or morph arrays.

Model renderables are fit to their target rect by the runtime layout pass.
`ctx.object.position` and `ctx.object.scale` remain valid managed transform
controls, but writing them means the effect intentionally owns model placement
and overrides the runtime fit transform.

The same ownership rule applies to projected DOM surfaces. A `dom/element`
target with `screen-depth` or `stage-local` placement receives a runtime-owned
plane layout from the descriptor. Writing `ctx.object.scale` replaces that plane
size; use it only when the effect intentionally owns surface sizing.

`ctx.runtime.postprocess` is a managed runtime request facade. Requests must
declare explicit `{ canvas: true }` or `{ passId }` scope and are not
target-local. Target-local model glow should use material or mesh emissive
controls plus runtime-owned lights unless a future target-scoped postprocess
capability is explicitly designed.
Runtime-owned lights are keyed requests; repeated calls with the same key update
the existing light and stay under runtime disposal ownership.

Model authoring controls such as animations, picking, mesh selection, material
variants, lights, and sampling should not be added as a growing
`WebGLModelEffectHandle` public API. They should be exposed through the
controlled object facade.

## Acceptance Criteria

The effect object refactor is correct when:

- simple effects can be written by mutating `ctx.object.position`,
  `ctx.object.rotation`, `ctx.object.scale`, `ctx.object.visible`, and
  `ctx.object.opacity`;
- text, media, model, shader, postprocess, and generated-object operations are
  available through optional modules below `ctx.object`;
- examples and docs teach `ctx.object` as the primary effect authoring model;
- public tests reject raw Three.js imports, raw renderer/scene/camera/object
  access, implicit `ctx.camera`, and loader escape hatches;
- existing runtime ownership of canvas, scroll, pointer, resources, render loop,
  fallback visibility, and performance scheduling remains intact.
