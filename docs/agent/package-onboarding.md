# Agent Onboarding: Package Usage

Purpose: let an AI agent start from zero and integrate the DOM WebGL packages
without reading the whole repository first. Read this file first. Use
`docs/agent/package-usage.md` as the deeper contract reference when a decision
needs more detail.

## What This Package Is

The runtime lets normal DOM elements enter one shared WebGL scene. Applications
declare targets in DOM/React, register application-owned effects, and keep DOM as
the source for layout, content, accessibility, and interaction state.

Package split:

- `<runtime-package>`: runtime creation, React adapter, target declarations,
  effect authoring primitives, controlled `ctx.object` facade, scroll state,
  pointer state, and managed resources.
- `<scroll-adapters-package>`: optional Lenis, GSAP ticker, ScrollTrigger, and
  React pinned-scroll glue.
- Application code: all concrete visual effects, product copy, assets, layouts,
  third-party instance lifecycle, and visual tuning.

Workspace names before publication:

- `<runtime-package>` is `@project/dom-webgl-runtime`.
- `<scroll-adapters-package>` is `@project/dom-webgl-scroll-adapters`.

## First Decision

Choose the simplest supported route:

- Normal DOM-to-WebGL effects: use `<runtime-package>` only.
- React app: use `<runtime-package>/react`.
- Pinned section drives WebGL progress: use
  `<scroll-adapters-package>/react` with GSAP ScrollTrigger `pin`/`scrub` and
  a stable `progressKey`.
- Existing Lenis/GSAP/ScrollTrigger lifecycle already owned by the app: pass a
  stable `WebGLScrollAdapter` into the runtime.

Do not use a scene gate for ordinary pinned sections. Gates lock page scroll and
are historical advanced scroll-locking behavior, not the recommended pinned
effect route.

## Public Imports

Use only public package entrypoints:

```ts
import {
  createEffectDeclarations,
  createWebGLRuntime,
  defineWebGLEffect,
  type WebGLEffectsDeclarationOf,
  type WebGLDeclaration,
  type WebGLEffectContext,
  type WebGLEffectDefinition,
  type WebGLRuntimeOptions,
  type WebGLScrollAdapter,
} from "<runtime-package>";
```

```tsx
import {
  WebGLCamera,
  WebGLRuntime,
  WebGLScene,
  WebGLTarget,
  useWebGLRuntime,
} from "<runtime-package>/react";
```

```tsx
import {
  ScrollEffectSection,
  WebGLScrollRuntime,
} from "<scroll-adapters-package>/react";
```

Never import:

```ts
import ... from "<runtime-package>/effects";
import ... from "<runtime-package>/src";
import ... from "packages/dom-webgl-runtime/src";
import ... from "packages/dom-webgl-scroll-adapters/src";
import ... from "../example/src/someEffect";
```

The runtime package does not export concrete effects or an `effects` preset
subpath. Example effects are consumer examples, not package API.

When porting from Three.js, keep the mental model and port the algorithm, not
the ownership. Do not create a renderer, scene, camera, loader, light, mesh,
material, texture, mixer, composer, pass, render target, or render loop in
consumer effects. Ask for or use a managed facade under `ctx.object`.

## Minimal React Integration

Define effects at module scope, pass them once to the runtime, and declare target
effect data on each target. The snippet below shows the current implemented
handle surface. When designing new package capabilities, read
`docs/agent/effect-object-boundary.md` first and target the current managed
`ctx.object` facade instead of adding more source-specific public handles.

```tsx
import { defineWebGLEffect } from "<runtime-package>";
import { WebGLRuntime, WebGLTarget } from "<runtime-package>/react";

type AppSurfaceParams = {
  kind: "app.surface";
  opacity?: number;
};

const appSurfaceEffect = defineWebGLEffect<AppSurfaceParams>({
  kind: "app.surface",
  source: "dom/element",
  update(ctx, _state, params) {
    ctx.object.opacity = clampNumber(params.opacity, 0, 1, 1);
  },
});

const runtimeEffects = [appSurfaceEffect] as const;

export function App() {
  return (
    <WebGLRuntime effects={runtimeEffects}>
      <WebGLTarget
        webgl={{
          key: "hero.surface",
          source: { kind: "dom", type: "element" },
          lifecycle: { hideWhenReady: true, hideMode: "self" },
          effects: [{ kind: "app.surface", opacity: 0.82 }],
        }}
      >
        Hero content stays DOM-authored.
      </WebGLTarget>
    </WebGLRuntime>
  );
}

function clampNumber(
  value: number | undefined,
  min: number,
  max: number,
  fallback: number,
): number {
  if (value === undefined || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, value));
}
```

Rules:

- `runtimeEffects` is executable effect code. Keep the array reference stable.
- Target `webgl.effects` is data only. It names effect kinds and params.
- Definition `kind` must exactly match target declaration `kind`.
- Target `key` must be stable and unique inside one runtime.
- Treat `webgl` declaration contents as registration-time static. If `source`,
  `effects`, `scroll`, `pointer`, or `lifecycle` needs to change, use a new key
  or remount the target.
- Target effects are array-form only:
  `effects: [{ kind: "app.effect", ...params }]`.
- Nested `WebGLTarget` children are valid. Use them when a WebGL-owned panel,
  card, caption, or marker has its own WebGL child layer.

## Opt-In Managed Scene Integration

Use `WebGLTarget` alone for normal DOM-first effects. Use `WebGLScene` only
when targets need explicit managed scene/pass ownership:

```tsx
import {
  WebGLCamera,
  WebGLRuntime,
  WebGLScene,
  WebGLTarget,
} from "<runtime-package>/react";

export function App() {
  return (
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
    </WebGLRuntime>
  );
}
```

Rules:

- `WebGLTarget` inside `WebGLScene` inherits that scene unless
  `webgl.sceneId` is explicit.
- A scene only needs a camera when it opts into rendering with `render` or
  `defaultPass`; the generated pass waits until the referenced/default camera
  is registered.
- Unmounting `WebGLScene` or calling `runtime.unregisterScene(id)` releases
  live targets still routed to that scene.
- Non-React consumers can call `runtime.registerScene(...)`,
  `runtime.registerCamera(...)`, `runtime.registerRenderPass(...)`, and use
  `sceneId` on target declarations for the same routing.
- Managed scenes support `projection: "dom-aligned" | "screen" |
  "perspective-stage"`.
- Managed cameras support orthographic `dom-aligned`/`screen` modes and
  perspective `perspective-stage` mode. Camera descriptors own framing values;
  raw `THREE.Camera` handles are not public.
- Targets can declare `placement: { mode: "dom-anchored" }`,
  `screen-anchored`, `screen-depth`, or `stage-local` depending on the scene
  projection.
- `WebGLRenderPass` can request runtime-owned `clear` or `clearDepth`.
- Scene-native models, named stage primitives, `screen-plane`, pass-scoped
  postprocess, and raw Three.js scene/camera/renderer handles remain future or
  non-public.

## Minimal Vanilla Integration

```ts
import { createWebGLRuntime } from "<runtime-package>";

const runtime = createWebGLRuntime({
  container,
  effects: [appSurfaceEffect],
});

runtime.registerTarget(element, {
  key: "hero.surface",
  source: { kind: "dom", type: "element" },
  lifecycle: { hideWhenReady: true, hideMode: "self" },
  effects: [{ kind: "app.surface", opacity: 0.82 }],
});

runtime.sync();
```

Dispose the runtime from the application lifecycle that owns the container.

## Source Selection

Choose the source from the actual DOM element:

| DOM target | Declaration |
| --- | --- |
| `div`, `section`, `article`, card, panel | `{ kind: "dom", type: "element" }` |
| text-bearing `p`, `span`, `h1`, `h2` | `{ kind: "dom", type: "text" }` |
| real `img` element or media anchor | `{ kind: "media", type: "image" }` or `{ kind: "media", type: "image", src }` |
| real `video` element or media anchor | `{ kind: "media", type: "video" }` or `{ kind: "media", type: "video", src }` |
| frame-addressable media anchor | `{ kind: "media", type: "image-sequence", frameCount, frames }` |
| GLB model target | `{ kind: "model", type: "glb", src, loader? }` |

Do not use old explicit declarations. `snapshot/mode`, top-level `image`,
top-level `video`, top-level `image-sequence`, and `model/format` are removed.

For Draco-compressed GLBs, declare `loader: { draco: { decoderPath } }` and
serve the matching decoder files from the app public/static directory. The
runtime owns loader instances; effects do not receive loader callbacks.

Effect authors use `ctx.object` for visual control and source-backed
capabilities. Source, target, and visual handles are internal runtime assembly
details, not public effect authoring API.

For text output, use the object text facade:

```ts
if (!ctx.object.text) {
  return;
}

ctx.object.text.setGlyphs((glyphs) =>
  glyphs.map((glyph) => ({
    index: glyph.index,
    char: glyph.char,
    y: glyph.y + Math.sin(ctx.time / 450 + glyph.index * 0.42) * 7,
  })),
);
```

Object modules:

- `ctx.object.surface`: canvas draw/clear/invalidate/material-layer controls.
- `ctx.object.text`: text, style, shader inputs, glyph read/write, and
  material-layer controls.
- `ctx.object.texture`: media src/frame metadata, shader inputs, texture
  transform, invalidate, and material-layer controls.
- `ctx.object.video`: video playback controls.
- `ctx.object.model`: model src, mesh list, vertex sampling, and managed point
  layers.
- `ctx.object.lights`: keyed runtime-owned ambient, directional, and point light
  requests. Reusing a key updates the existing light.
- `ctx.object.postprocess`: named postprocess requests.

Current visual capability surface:

- Element and text object modules can draw to their canvas surface and create
  runtime-owned material layers over the source texture.
- Text, media texture, and video modules expose shader input metadata such as size,
  glyph layout, natural media size, content box, source texture availability,
  and object-fit UV transform.
- Texture/video modules keep object-fit and playback controls public without
  exposing raw Three textures.
- GLB object modules expose controlled mesh handles, material restore, vertex samples,
  and managed point layers.
- Public handles are capability handles: use methods such as `draw`,
  `setGlyphs`, `setTransform`, `createMaterialLayer`, `meshes.forEach`,
  `sampling.vertices`, and `points.create`; do not rely on `object3D`, `mesh`,
  `material`, or `texture` fields.
- `ctx.object.postprocess.request(...)` submits named bloom/grain/blur requests
  owned by the runtime.
- `ctx.object.lights?.point(...)`, `.directional(...)`, and `.ambient(...)`
  submit keyed runtime-owned light requests. Dynamic light params should be
  redeclared with the same key from `update`.
- Material uniforms are controlled data, not raw Three.js objects. Numeric
  tuples and supported arrays such as pointer-trail `vec2[]` are acceptable;
  renderer, scene, camera, composer, raw texture, raw material, and pass objects
  are not public effect inputs.
- Material programs are Three-inspired shader declarations, not raw Three.js
  materials. Public fields are `vertexShader`, `fragmentShader`, `uniforms`,
  `defines`, and `blend`; runtime-owned defaults decide transparency, depth,
  tone mapping, allocation, restoration, and disposal.

DOM text remains the source of content and accessibility. Text-layer methods
change WebGL output only.

## Lifecycle And Ownership

Default target lifecycle is `hideWhenReady: true`. Use:

- `hideMode: "self"` for mixed DOM/WebGL panels where children can stay DOM.
- `hideMode: "subtree"` only when the whole subtree should be replaced by WebGL.
- `hideWhenReady: false` when fallback DOM must remain visible.
- A parent target does not own a nested target root's fallback lifecycle. Nested
  targets hide and restore their own fallback after their own renderable
  readiness.
- Use `transformScope: "subtree"` only when a parent target's effect should
  move, rotate, scale, hide, or best-effort fade its declared WebGL subtree.
  This creates an internal runtime transform group, not a public scene graph.
  Child targets keep their own source, effects, textures, fallback lifecycle,
  resources, and offscreen policy.
- Transform groups do not expose raw Three.js `Group`, `Object3D`, scene,
  camera, material, matrix, or parent-key APIs. `ctx.pointer` is runtime/canvas
  pointer state; `ctx.targetPointer` is current-target layout-local pointer
  state and does not perform inverse-transformed picking for rotated groups,
  models, or custom meshes.
- Pointer declarations are target-semantic: use
  `pointer: { hover, press, click, drag }` to wake reactive effects for
  target-level pointer semantics. `ctx.targetPointer.isInside` is the current
  target hover check, `localX/localY` replace repeated
  `ctx.pointer.x - ctx.layout.left/top` math, and `normalizedX/Y` use the same
  -1..1 convention as runtime pointer coordinates. Long-press behavior belongs
  in effect params via `ctx.targetPointer.pressDuration`; runtime does not own a
  global threshold.

Effect ownership rules:

- Create expensive resources in `setup`, not `update`.
- Put effect-owned listeners, geometries, materials, textures, handles, and
  restoration cleanup into `ctx.resources`.
- Never own the renderer, runtime, runtime canvas, main animation loop, global
  scroll/pointer systems, or package-internal registries.
- Never expose or depend on raw Three renderer, scene, camera, `ShaderMaterial`,
  `Texture`, `EffectComposer`, `WebGLRenderTarget`, render-loop, pass ordering,
  or renderer-state mutation.
- If an effect mutates a source model or generated object, restore or dispose it
  on cleanup unless the effect explicitly owns it for the target lifetime.

## Pinned Scroll Route

Use this when a bounded section should pin/scrub and feed progress to an effect.
This is the current recommended pinned-scroll route:

```tsx
import { defineWebGLEffect } from "<runtime-package>";
import { WebGLTarget } from "<runtime-package>/react";
import {
  ScrollEffectSection,
  WebGLScrollRuntime,
} from "<scroll-adapters-package>/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";

const pinnedRevealEffect = defineWebGLEffect<{
  kind: "app.pinnedReveal";
  progressKey: string;
}>({
  kind: "app.pinnedReveal",
  update(ctx, _state, params) {
    const progress = ctx.progress.get(params.progressKey);
    ctx.object.opacity = progress;
  },
});

const runtimeEffects = [pinnedRevealEffect] as const;

export function App() {
  return (
    <WebGLScrollRuntime effects={runtimeEffects} smooth={false}>
      <ScrollEffectSection
        progressKey="article.hero.reveal"
        ScrollTrigger={ScrollTrigger}
        pin
        scrub
      >
        <WebGLTarget
          webgl={{
            key: "article.hero",
            source: { kind: "dom", type: "element" },
            effects: [
              {
                kind: "app.pinnedReveal",
                progressKey: "article.hero.reveal",
              },
            ],
          }}
        >
          Section content
        </WebGLTarget>
      </ScrollEffectSection>
    </WebGLScrollRuntime>
  );
}
```

Rules:

- Keep `progressKey` stable.
- Effects read progress with `ctx.progress.get(progressKey)`.
- Let GSAP ScrollTrigger own `pin` and `scrub` through `ScrollEffectSection`.
- Do not mutate mounted `webgl.effects` on every scroll update.
- Let `ScrollEffectSection` be the full pinned row. Do not append a synthetic
  post-pinned runway sibling just to release scroll.
- Do not read Lenis, GSAP, or ScrollTrigger directly from effects.

## Manual Scroll Adapter Route

Use this only when application code intentionally owns the third-party scroll
instance lifecycle:

```ts
import { createLenisGsapScrollStack } from "<scroll-adapters-package>";

const smoothScroll = createLenisGsapScrollStack({
  lenis,
  gsap,
  ScrollTrigger,
  manageLenis: false,
});

const runtime = createWebGLRuntime({
  container,
  scrollAdapter: smoothScroll.scrollAdapter,
});
```

Keep `scrollAdapter` stable. Dispose adapter-owned listeners from app cleanup.
Destroy consumer-owned Lenis explicitly from the same cleanup when appropriate.

## Type-Safe Target Effects

For compile-time checking of target effect params, keep an app-level type map:

```ts
interface AppEffectParams {
  "app.surface": { opacity?: number };
  "app.pinnedReveal": { progressKey: string };
}
```

Use `createEffectDeclarations()`:

```ts
import { createEffectDeclarations } from "<runtime-package>";

const effects = createEffectDeclarations<AppEffectParams>()([
  { kind: "app.surface", opacity: 0.82 },
]);
```

Or use `satisfies`:

```ts
import type { WebGLEffectsDeclarationOf } from "<runtime-package>";

const effects = [
  { kind: "app.surface", opacity: 0.82 },
] as const satisfies WebGLEffectsDeclarationOf<AppEffectParams>;
```

This catches misspelled params and unknown kinds at compile time. It does not
replace runtime registration; the matching executable effect must still be
passed to the runtime.

## Validation

For downstream integration:

```bash
npm run typecheck
npm test -- --run <changed-test-files>
```

When changing this repository:

```bash
npm test -- --run <changed-test-files>
npm run typecheck
npm run check:imports
git diff --check
npm run build
```

Run a browser smoke check for visual work when the change affects a rendered app.

## Common Failures

- Unknown effect: target declares `{ kind: "x" }`, but runtime `effects` omits
  `defineWebGLEffect({ kind: "x" })`.
- Runtime churn: React recreates the runtime because `effects` or
  `scrollAdapter` identity changes every render.
- Invalid media source: `image` or `video` is declared on a non-media element.
- Text confusion: `ctx.object.text.setGlyphs(...)` changes WebGL output, not DOM text.
- Pointer offset: an effect compares `ctx.pointer` runtime/canvas coordinates
  directly to target-local coordinates instead of reading `ctx.targetPointer`.
- Draco GLB loading failure: compressed models need declarative
  `source.loader.draco.decoderPath` and matching decoder files served by the
  app. The runtime owns the loader instance, but the app owns static asset
  placement.
- Canvas-wide blur/dimming: `ctx.object.postprocess` is currently
  runtime-canvas scoped, not target-scoped. Do not use it for a single model glow
  unless affecting the whole WebGL canvas is intended.
- Invisible model after an effect update: `ctx.object.position` and
  `ctx.object.scale` override the runtime model fit transform. Leave model
  placement to the runtime unless the effect intentionally owns it.
- Light intensity appears unchanged: for runtime-fit models, declare the light
  from `update` with the same key and an explicit projected layout-center
  position. A one-time `setup` request will not reflect later parameter changes.
- Shader coordinate mismatch: DOM pointer `y` is top-down, while shader
  coordinates may be bottom-up. Convert at the effect boundary and test it.
- Shader uniform name mismatch: a visual can look static when the effect updates
  `uTime` but the ported shader reads `iTime`.
- Resource leak: an effect creates objects or listeners without `ctx.resources`.
- Boundary violation: app imports package internals or example-only code.
- Nested target workaround: a parent effect manually creates child Object3D
  layers instead of declaring nested `WebGLTarget` children.
- App target confusion: `apps/example` is the downstream dogfood surface and the
  only app workspace. Do not add package API for an example-only visual tuning
  issue.
- Visual-port boundary drift: do not move Ghost Cursor, Waves, ReactBits
  constants, effect keys, assets, copy, or product shader/canvas tuning into
  packages. Packages should only gain generic controlled primitives.
- Pointer-heavy effects stay hot while idle: add decay/caching only after frames
  become identical. ReactBits Waves keeps animating through Perlin time even
  without pointer input, so pointer-out frames should still redraw.

## Where To Look Next

- `docs/agent/package-usage.md`: full package contract and edge cases.
- `docs/agent/effect-object-boundary.md`: forward effect authoring boundary;
  read before designing new package visual capabilities.
- `docs/agent/custom-effects.md`: custom effect writing checklist.
- `docs/agent/scroll-adapters.md`: Lenis, GSAP ticker, and ScrollTrigger rules.
- `docs/examples/effect-authoring.md`: React-only downstream tutorial.
- `apps/example`: current consumer-style example app.
- `docs/agent/effect-authoring-example-report.md`: known friction points from
  dogfooding the public package surface.

## Completion Report Template

When an agent finishes package usage work, report:

- package entrypoints used;
- runtime registration location;
- target declaration location;
- effect kind(s);
- supported source kind(s);
- resource ownership and cleanup behavior;
- verification commands run;
- remaining visual tuning or known limits.
