# Managed Lit-Material Shader Extension Design

**Date:** 2026-07-17
**Status:** Approved; implementation plan requested
**Scope:** `@viselora/dom-webgl` managed material capability plus the `hero-next` radial-transition dogfood

## Summary

Expose a small, Three-like shader extension API on runtime-owned Basic, Standard,
and Physical materials. Effect authors may modify a controlled shader draft and
update managed uniforms, while the runtime continues to own the real Three
material, renderer, compilation invalidation, program caching, viewport data,
resource lifetime, and disposal.

The first consumer is `hero-next`: the tetrahedron will use the same captured
mesh-hit origin and the same coverage/radius state as the background. Its visible
fragments will mix committed and target color/emissive values through the same
screen-space radial circle, eliminating the current whole-material color cut.

This is a general package capability. No hero keys, signals, palettes, or
application-specific branches belong in the package.

## Product Direction

The package is a managed shell over Three.js, not a second graphics language.
An agent writing an effect should be able to use familiar Three.js concepts and
shader-chunk knowledge while delegating operational concerns to the runtime.

The public mental model is deliberately small:

1. Register a managed `onBeforeCompile` extension once.
2. Update its uniforms while the effect runs.
3. Let the runtime manage compilation, performance, viewport state, and cleanup.

```ts
const radialShader = {
  key: "app.radial",
  uniforms: {
    radialOrigin: [0.5, 0.5],
    radialRadiusPx: 0,
    radialEdgePx: 1.5,
  },
  compile(shader) {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <emissivemap_fragment>",
      `
        #include <emissivemap_fragment>
        // Consumer-authored screen-space mix.
      `,
    );
  },
} satisfies WebGLEffectMaterialShaderDefinition;

ctx.object.material?.shader?.onBeforeCompile(radialShader);
ctx.object.material?.shader?.setUniforms("app.radial", {
  radialOrigin: origin,
  radialRadiusPx: radius,
});
```

## Public API

Add an optional managed shader facade to `WebGLEffectMaterialFacade`:

```ts
export type WebGLEffectMaterialShaderDefinition = {
  key: string;
  uniforms?: Record<string, WebGLEffectUniformValue>;
  defines?: Record<string, string | number | boolean>;
  compile(draft: WebGLEffectMaterialShaderDraft): void;
};

export type WebGLEffectMaterialShaderDraft = {
  readonly materialKind: "basic" | "standard" | "physical";
  vertexShader: string;
  fragmentShader: string;
  uniforms: Record<string, WebGLEffectUniformValue>;
  defines: Record<string, string | number | boolean>;
};

export type WebGLEffectMaterialShaderFacade = {
  onBeforeCompile(definition: WebGLEffectMaterialShaderDefinition): void;
  setUniforms(
    key: string,
    values: Record<string, WebGLEffectUniformValue>,
  ): void;
  remove(key: string): void;
};

export type WebGLEffectMaterialFacade = {
  // Existing fields remain unchanged.
  readonly shader?: WebGLEffectMaterialShaderFacade;
};
```

`compile()` receives strings and managed uniform values, not a raw Three
`Shader`, `Material`, renderer, scene, camera, or WebGL context. Consumers may
use familiar chunk replacement such as `.replace("#include <...>", ...)`.

`onBeforeCompile()` is the managed equivalent of Three.js
`material.onBeforeCompile`. It is intended for effect setup. `setUniforms()` is
intended for frame updates and must not recompile the shader. `remove()` removes
a visual extension at runtime; it is not a disposal or ownership API.

The definition should normally be a module-level stable object. Registering the
same definition under the same key is idempotent. Registering a different
definition under an occupied key is an error.

## Runtime Ownership

Each runtime-created Basic, Standard, or Physical mesh material receives one
internal extension host. The host owns the real Three integration:

- composition with the material's built-in shader;
- internal `onBeforeCompile` and `customProgramCacheKey` wiring;
- `needsUpdate` decisions;
- ordered extension application;
- live uniform objects;
- viewport and device-pixel-ratio updates;
- program-cache identity;
- texture resources referenced by managed uniforms;
- teardown and exactly-once disposal.

Uniform changes update existing uniform values in place. They do not affect the
program cache key and do not request recompilation. Registering or removing an
extension changes the internal program revision and requests recompilation.
Defines are fixed for one registered definition; changing them requires an
explicit `remove()` followed by `onBeforeCompile()`.

Multiple definitions on one material are applied in registration order. Each
definition receives the shader text produced by the previous definition.

The compile callback may be invoked more than once when Three compiles different
program variants. A definition must therefore make deterministic, repeatable
changes and must not use the callback for application state or resource
ownership.

## Screen-Space Runtime Inputs

The extension host provides runtime-owned viewport inputs so effect authors do
not need renderer access:

```glsl
uniform vec2 domWebGLViewportSize; // CSS pixels
uniform float domWebGLPixelRatio;
```

The names are reserved and cannot be supplied by consumer definitions. The host
keeps them current when the renderer viewport or DPR changes.

This supports CSS-pixel screen-space calculations without leaking renderer
ownership:

```glsl
vec2 fragmentCssPx = gl_FragCoord.xy / domWebGLPixelRatio;
vec2 originCssPx = radialOrigin * domWebGLViewportSize;
float distancePx = distance(fragmentCssPx, originCssPx);
```

Existing managed uniform value types remain the public input format. For this
extension host, string uniform values are compiled as managed Three colors so
hex palette values enter the material's working color space correctly. Numeric
and vector values keep their existing scalar/vector meaning.

## Lit-Material Integration

The capability extends the built-in material shader; it never replaces the
material with an unlit standalone `ShaderMaterial`.

For the hero Standard material, the radial code is inserted after:

```glsl
#include <emissivemap_fragment>
```

At that point the built-in shader has prepared `diffuseColor` and
`totalEmissiveRadiance`, while lighting has not yet been evaluated. The
extension mixes the committed and target values there. The normal Standard
pipeline then continues through lighting, outgoing light, tone mapping, and
color-space conversion.

The same host exists for Basic and Physical materials. A definition may inspect
`draft.materialKind` when the available built-in chunks or variables differ.
No extension means the three existing material kinds behave exactly as they do
today.

## Hero Integration

### Existing Transition State Remains Authoritative

The tetrahedron must consume the existing transition state and signals:

- `origin` captured from the real mesh-hit frame;
- `coverage` and the radius produced by `resolveHeroRadialGeometry()`;
- committed and target schemes from `HeroHoldTransitionState`;
- the current phase machine, including retract/resume and awaiting-release.

No second transition clock, radius, origin, or completion state is introduced.

### Fragment Mask

The mesh extension uses the same mask shape as the background:

```glsl
float radialMask = 1.0 - smoothstep(
  radialRadiusPx - radialEdgePx,
  radialRadiusPx + radialEdgePx,
  radialDistancePx
);
```

`radialEdgePx` remains `1.5` CSS pixels. Version 1 adds no noise to the edge.

Visible fragments use `radialMask` to mix:

- committed foreground color → target foreground color;
- committed emissive color/intensity → target emissive color/intensity.

The material's existing metalness, roughness, opacity, lights, and Standard
shading remain unchanged.

### Removing the Hard Cut

`resolveHeroTransitionVisual()` must stop selecting the target tetrahedron color
for every non-idle phase. `applyHeroFrame()` must stop changing the entire
material to the target color when expansion begins.

Instead:

- the base material represents the committed scheme;
- the shader extension receives both committed and target values;
- the radial mask selects the visible per-fragment mixture;
- after geometric far-corner completion, the committed scheme advances without
  a visual discontinuity because the radial mask already covers the mesh and
  viewport.

Early release decreases the same radius and reveals the original committed
values along the same path. Re-press resumes from the current coverage.

### Preserved Behavior

The following behavior is unchanged:

- real mesh-hit origin capture;
- `1000ms` expansion and `300ms` retraction timing;
- far-corner geometric commit;
- awaiting-release gate;
- bidirectional toggle semantics;
- pointer, key, and rim lights;
- palette, camera, material kind, opacity, motion, scroll runtime, and single
  canvas architecture;
- reduced motion keeps the color diffusion while disabling shake and fast
  geometric movement.

## Lifecycle and Errors

The material owns its extension host. Destroying or recreating the managed mesh
automatically tears down all registered extensions and their owned uniform
resources. Consumers receive no disposal method. Repeated runtime cleanup is
safe, and the underlying material remains exactly-once disposed.

The facade reports contextual errors for invalid keys, conflicting duplicate
definitions, unsupported uniform values, reserved uniform names, missing
extensions/uniforms, and exceptions thrown by a compile callback. Errors include
the extension key and material kind. They are not silently replaced with a base
material, because a silent fallback would make a broken effect appear valid.

GLSL syntax and link failures remain Three/WebGL compiler diagnostics. Runtime
debug context should include the active extension keys without exposing the
renderer or WebGL objects.

## Public Boundary

This design does not expose:

- raw Three Mesh, Material, Shader, renderer, scene, or camera;
- the real `onBeforeCompile` callback or `needsUpdate` flag;
- WebGL context, render targets, or program objects;
- consumer-owned disposal or material replacement;
- private package imports;
- app-specific package branches.

It also does not add CSS masks, duplicate meshes, a second canvas/renderer,
postprocessing of the whole canvas, or a change from Standard to Physical.

## Verification Strategy

Implementation follows TDD.

### RED Evidence

First prove both current gaps:

1. hero transition tests show the tetrahedron selects the whole target material
   as soon as the phase leaves idle;
2. package tests show a managed mesh material has no per-fragment shader
   extension facade.

### Package Tests

Cover:

- public types and normalization;
- Basic, Standard, and Physical material preservation;
- actual runtime registration on the default managed mesh factory;
- real `createPipelineRuntime` plus real Three lit materials;
- uniform updates without material replacement or recompilation;
- internal program-cache revision for compile-time changes;
- multiple extension ordering and key conflicts;
- viewport/DPR managed uniforms;
- raw Three/renderer/material replacement/disposal remaining inaccessible;
- exactly-once resource and material disposal;
- existing material layer/program behavior remaining unchanged.

### Hero Tests

Cover:

- shared origin/coverage/radius inputs;
- committed/target color and emissive uniforms;
- no whole-material target switch during expanding or retracting;
- forward, early reverse, re-press resume, commit, awaiting-release, and reverse
  toggle semantics;
- reduced-motion color diffusion with shake disabled;
- `1.5px` edge and no noise.

### Browser Evidence

The packed-tarball consumer must run in real Chromium and prove that a target
mesh region contains both committed and target pixels in an intermediate frame,
with zero page and console errors.

The production `hero-next` runtime must capture:

- initial;
- first-direction intermediate expansion;
- committed target;
- reverse-direction intermediate expansion during the second toggle;
- committed initial-return;
- exactly one canvas throughout.

Early-release retraction must also be exercised in browser QA to prove that the
same spatial boundary shrinks rather than producing a material cut.

### Final Verification Order

```bash
npm test -- --run packages/dom-webgl-runtime/test
npm test -- --run apps/hero-next/test
npm run typecheck
npm run build
npm run check:imports
npm run skill:api:generate
npm run skill:api:check
npm run verify:tarballs
npm run verify:consumer
npm run verify:skill
git diff --check
```

## Workspace Protection

`apps/hero-next/next-env.d.ts` is a pre-existing user diff. Its required SHA-256
is:

```text
7ad303e40d4fddf44f156129e397511953a71481c5cfd86b1862649aaaf240cc
```

Build-like commands may rewrite it. Any restoration must use a focused patch;
`git reset`, `git checkout`, and `git restore` are prohibited.

The existing untracked `.playwright-cli/`, `output/`, and
`docs/superpowers/plans/2026-07-16-hero-next-two-tone-tetrahedron-cover.md`
must be preserved. No broad `git add`, commit, or push is authorized.

## Documentation

This document is a new capability-and-dogfood specification. The completed
2026-07-16 hold-transition specification remains unchanged as historical design
truth for the existing state machine.

Implementation must update active package/API documentation and generated skill
API surfaces where the new public capability is exposed. Files under
`docs/archive/` are not modified.
