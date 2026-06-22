# Agent Contract: Package Usage

Purpose: guide AI agents that integrate the published DOM WebGL runtime package
into downstream applications. This is package-consumer documentation, not a
workspace example guide and not a human tutorial. Treat every rule below as
implementation policy.

## Package Truth

- Use public package entrypoints only.
- Root entrypoint owns vanilla runtime creation and effect authoring.
- React entrypoint owns React runtime/provider/target components.
- Applications own concrete visual effects.
- The package owns layout measurement, runtime lifecycle, source handles, target
  handles, frame input, pointer state, scroll state, and managed resources.
- Native page/gate scroll is the default. Third-party smooth-scroll systems use
  `WebGLScrollAdapter`; optional Lenis/GSAP/ScrollTrigger glue lives outside
  core in `<scroll-adapters-package>`.
- The package does not provide default visual effects or an official
  `effects` preset subpath.
- Target effects use array-form declarations only:
  `effects: [{ kind: "app.effect", ...params }]`. Do not use legacy
  object-form `effects.material` or `effects.motion`.

## Public Imports

Replace `<runtime-package>` with the actual published npm package name. In this
workspace before publication, the package name is `@project/dom-webgl-runtime`.

Use:

```ts
import {
  createWebGLRuntime,
  defineWebGLEffect,
  type WebGLDeclaration,
  type WebGLEffectContext,
  type WebGLEffectDefinition,
  type WebGLRuntimeOptions,
  type WebGLScrollAdapter,
} from "<runtime-package>";
```

Use for React:

```tsx
import {
  WebGLRuntime,
  WebGLTarget,
  useWebGLRuntime,
} from "<runtime-package>/react";
```

Do not use:

```ts
import ... from "<runtime-package>/effects";
import ... from "<runtime-package>/src";
import ... from "packages/dom-webgl-runtime/src";
import ... from "packages/dom-webgl-scroll-adapters/src";
```

## Runtime Setup

React:

```tsx
import { WebGLRuntime, WebGLTarget } from "<runtime-package>/react";

const runtimeEffects = [appSurfaceEffect, appPointerEffect] as const;
const scrollAdapter: WebGLScrollAdapter | undefined = undefined;

export function App() {
  return (
    <WebGLRuntime effects={runtimeEffects} scrollAdapter={scrollAdapter}>
      <WebGLTarget
        webgl={{
          key: "hero.surface",
          source: { kind: "snapshot", mode: "element" },
          effects: [{ kind: "app.surface", opacity: 0.82 }],
        }}
      >
        Hero content
      </WebGLTarget>
    </WebGLRuntime>
  );
}
```

Vanilla:

```ts
import { createWebGLRuntime } from "<runtime-package>";

const runtime = createWebGLRuntime({
  container,
  effects: [appSurfaceEffect, appPointerEffect],
  scrollAdapter,
});

runtime.registerTarget(element, {
  key: "hero.surface",
  source: { kind: "snapshot", mode: "element" },
  effects: [{ kind: "app.surface", opacity: 0.82 }],
});

runtime.sync();
```

Rules:

- Keep the runtime-level `effects` array reference stable. In React, define it at
  module scope or memoize it.
- Keep `scrollAdapter` reference stable. In React, define the adapter at module
  scope, in a stable ref, or in a memoized integration component that owns the
  third-party instance lifecycle.
- Every target key must be stable and unique inside one runtime.
- Treat each target `webgl` declaration as registration-time static. Do not
  dynamically change `source`, `effects`, `scroll`, `pointer`, or `lifecycle`
  under the same key; use a new key or remount the target when the declaration
  must change.
- Target `webgl.effects` contains data only. The executable effect definition is
  registered at runtime level.
- Use array-form target effects only. Legacy object-form declarations such as
  `effects: { material: ..., motion: ... }` are outside the forward package
  contract.
- Do not create nested runtimes unless the application intentionally needs
  independent canvases and lifecycle ownership.

## Scroll Adapter Setup

Use no adapter for normal browser scroll:

```tsx
<WebGLRuntime effects={runtimeEffects}>{children}</WebGLRuntime>
```

Use a scroll adapter only when the application already owns a third-party
scroll system:

```ts
import { createWebGLRuntime, type WebGLScrollAdapter } from "<runtime-package>";

declare const lenisBackedAdapter: WebGLScrollAdapter;

const runtime = createWebGLRuntime({
  container,
  scrollAdapter: lenisBackedAdapter,
});
```

Rules:

- Core receives only `WebGLScrollAdapter`; it must not receive a raw Lenis,
  GSAP, or ScrollTrigger instance.
- Effects keep reading `ctx.scroll` and `ctx.scrollProgress`; they should not
  read third-party scroll instances directly.
- Adapter cleanup owns only listeners, ticker callbacks, and proxy hooks created
  by the adapter. Destroying a consumer-owned Lenis instance must be explicit.
- See `docs/agent/scroll-adapters.md` for optional Lenis, GSAP ticker, and
  ScrollTrigger bridge rules.

### Official Smooth Scroll Stack

The recommended third-party route is the opt-in Lenis + GSAP ticker +
ScrollTrigger stack from `<scroll-adapters-package>`.

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

Rules:

- This stack is not the core runtime default; native scroll remains the default
  when `scrollAdapter` is omitted.
- Configure Lenis with `autoRaf: false` when GSAP drives `lenis.raf(...)`.
- When the application creates Lenis, keep `manageLenis: false`, call
  `smoothScroll.dispose()` from the application lifecycle, and explicitly call
  `lenis.destroy()` from that same cleanup.
- Use `smoothScroll.refresh(true)` after layout changes that should force
  ScrollTrigger to recalculate positions.

## Target Declaration

Minimum target:

```ts
const declaration: WebGLDeclaration = {
  key: "card.primary",
  source: { kind: "snapshot", mode: "element" },
};
```

Effect target:

```ts
const declaration: WebGLDeclaration = {
  key: "model.hero",
  source: { kind: "model", format: "glb", src: "/models/hero.glb" },
  lifecycle: { hideWhenReady: true, hideMode: "subtree" },
  effects: [
    { kind: "app.modelRotate", speed: 0.15 },
    { kind: "app.modelParticles", color: "rgb(255, 0, 0)", density: 2 },
  ],
};
```

Supported source declarations:

- `{ kind: "snapshot", mode?: "element" | "text" }`
- `{ kind: "image", src?: string }` on an actual `img` target only.
- `{ kind: "video", src?: string }` on an actual `video` target only.
- `{ kind: "model", format: "glb", src: string }`

Do not declare image/video sources on non-media elements. A `div`, `section`,
or text node target should use `snapshot` or `model`; explicit `image` and
`video` declarations are reserved for real `img` and `video` elements and throw
when used on non-media elements.

Lifecycle rules:

- `hideWhenReady: true` is the default for registered targets.
- `hideWhenReady: false` keeps DOM fallback visible.
- `hideMode: "self"` is the safe default for mixed DOM/WebGL targets; children stay native DOM unless they register their own target.
- `hideMode: "subtree"` hides the target subtree after WebGL readiness and is only for explicitly WebGL-owned subtrees.
- Failed or pending renderables keep fallback DOM visible.
- `lifecycle.offscreen.strategy: "restore-dom"` is the default far-offscreen
  policy: restore native DOM fallback before disposing offscreen renderables.
- `lifecycle.offscreen.strategy: "park"` enables near-offscreen parking: keep
  renderables briefly, pause effects, and hide the WebGL scene object.
- `lifecycle.offscreen.warmTtlMs` sets how long parking is retained before the
  runtime restores DOM fallback and disposes resources.

## WebGL-Owned Text And Surface

Use one visual ownership layer for a card, panel, or marker. If a text target is
rendered by WebGL but its DOM parent keeps a semi-transparent background above
the runtime canvas, the WebGL text will be seen through that DOM background and
can look faded.

Preferred pattern for a WebGL-owned panel:

```tsx
<WebGLTarget
  className="marker"
  webgl={{
    key: "marker.surface",
    source: { kind: "snapshot", mode: "element" },
    lifecycle: { hideWhenReady: true, hideMode: "self" },
    effects: [{ kind: "app.surface", opacity: 0.72 }],
  }}
>
  <strong>Native heading can stay DOM-visible</strong>
  <WebGLTarget
    as="p"
    className="marker-copy"
    webgl={{
      key: "marker.copy",
      source: { kind: "snapshot", mode: "text" },
    }}
  >
    Text that should be rendered in the same WebGL canvas as the surface.
  </WebGLTarget>
</WebGLTarget>
```

Rules:

- Put `snapshot/text` on the actual text-bearing element, such as `p`, `span`,
  `h1`, or `h2`; do not put it on a complex container just because the container
  contains text somewhere inside.
- If text and its panel background should both be WebGL-owned, make the parent
  an element snapshot surface target and use `hideMode: "self"` so its DOM
  background does not cover the WebGL text.
- If the DOM parent background, gradients, opacity, or filters must remain
  visible above the runtime canvas, keep that text as native DOM or make the
  entire visual treatment WebGL-owned.
- Do not rely on core text snapshots to inherit DOM `color`, background,
  opacity, shadow, or other visual styling. Text color and opacity should be
  explicit effect/material data when the application needs WebGL-owned text
  styling.

## Custom Effect Contract

Define effects with `defineWebGLEffect(...)`:

```ts
import { defineWebGLEffect } from "<runtime-package>";

type AppSurfaceParams = {
  kind: "app.surface";
  opacity?: number;
};

export const appSurfaceEffect = defineWebGLEffect<AppSurfaceParams>({
  kind: "app.surface",
  source: "snapshot/element",
  update(ctx, _state, params) {
    ctx.target?.setVisible(true);
    ctx.target?.setOpacity(clampNumber(params.opacity, 0, 1, 1));
  },
});

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

Stateful effect:

```ts
type AppPulseParams = {
  kind: "app.pulse";
  strength?: number;
};

type AppPulseState = {
  phase: number;
};

export const appPulseEffect = defineWebGLEffect<AppPulseParams, AppPulseState>({
  kind: "app.pulse",
  setup(ctx) {
    ctx.resources.addDisposable(() => {
      // Dispose effect-owned listeners, objects, or handles.
    });

    return { phase: 0 };
  },
  update(ctx, state, params) {
    state.phase += ctx.delta / 1000;
    const strength = clampNumber(params.strength, 0, 2, 1);
    ctx.target?.setScale(1 + Math.sin(state.phase) * 0.04 * strength);
  },
});
```

Rules:

- `kind` in the definition must exactly match target declaration `kind`.
- Use namespaced kinds such as `app.surface`, `brand.heroParticles`, or
  `product.galleryTilt`.
- Do not use generic global names such as `fade`, `rotate`, or `particles`.
- Use `source` on the definition to restrict compatible source handles.
- Always tolerate `ctx.target === undefined`.
- Always narrow `ctx.source.kind` before using source-specific fields.
- Clamp all untrusted numeric params.
- Use `ctx.delta` for motion. Do not rely on frame count.
- Create expensive resources in `setup`, not `update`.
- Dispose effect-owned resources through `ctx.resources`.

## Effect Context

Use context fields as the single runtime truth:

- `ctx.key`: target key.
- `ctx.layout`: current DOM layout snapshot and viewport size.
- `ctx.input`: full frame input.
- `ctx.pointer`: pointer state for the runtime coordinate element.
- `ctx.scroll`: page or gate scroll state.
- `ctx.scrollProgress`: active progress value for current scroll mode.
- `ctx.time`: runtime time in milliseconds.
- `ctx.delta`: frame delta in milliseconds.
- `ctx.source`: source handle.
- `ctx.target`: runtime target controls, if available.
- `ctx.resources`: effect-owned resource scope.

Pointer rule:

- `ctx.pointer.normalizedX/Y` are runtime-coordinate values.
- If an effect needs target-local hit testing, map pointer coordinates through
  `ctx.layout`.
- If an effect hit-tests a transformed model, project through the model's current
  transform before comparing positions.

## Source Handles

Narrow by `ctx.source.kind`:

```ts
if (ctx.source.kind !== "model/glb") {
  return;
}

const model = ctx.source.model;
```

Available source handles:

| Source kind | Public output handle | Main controls |
| --- | --- | --- |
| `snapshot/element` | `ctx.source.surface` | canvas draw, clear, invalidate, object/material controls |
| `snapshot/text` | `ctx.source.textLayer` | canvas draw, style, glyph layout, `setText`, `setGlyphs`, object/material controls |
| `image` | `ctx.source.image` | texture, material, mesh, texture transform, invalidate |
| `video` | `ctx.source.video` | texture controls plus play, pause, muted, playback rate |
| `model/glb` | `ctx.source.model` | object controls, mesh traversal, vertex samples, point cloud creation |

DOM text remains the source of content, accessibility, and fallback.
`textLayer.setText(...)` and `textLayer.setGlyphs(...)` affect only the WebGL
output layer. Effects should not mutate DOM text for visual animation.

Glyph coordinates are text-layer local CSS-pixel coordinates. `glyph.x` and
`glyph.y` describe the glyph's top-left drawing position, and `glyph.height`
matches the line height. For pointer-local text effects such as scrambled text
or text pressure, compute the visual center as:

```ts
const centerX = glyph.x + glyph.width / 2;
const centerY = glyph.y + glyph.height / 2;
```

Do not treat `glyph.y` as a baseline or subtract half the glyph height; doing so
shifts the effect radius away from the cursor.

The package core does not include scrambled text, text pressure, image
distortion, media playback, or model particle effects. Those are application
effects built on these primitives.

Model helper rules:

- `model.object3D` is the loaded model object exposed as `unknown`.
- `model.setVisible`, `model.setPosition`, `model.setRotation`,
  `model.setScale`, and `model.setOpacity` provide common object controls.
- `model.traverseMeshes(visitor)` visits model meshes.
- `model.sampleVertices({ maxPoints })` returns model-root local vertex samples.
- `model.createPointCloud({ density, color, size })` returns a point cloud object.
- Child mesh transforms are applied when sampling vertices.
- `color` accepts numeric Three.js color values and CSS color strings such as
  `"rgb(255, 0, 0)"`.

## Target Handles

Use optional chaining:

`setPosition(...)` writes the runtime scene-object position. When deriving it
from a DOM layout snapshot, project the DOM center into scene coordinates as
shown below.

```ts
ctx.target?.setVisible(true);
ctx.target?.setPosition(
  ctx.layout.left + ctx.layout.width / 2,
  ctx.layout.viewport.height - (ctx.layout.top + ctx.layout.height / 2),
  0,
);
ctx.target?.setRotation(0, ctx.pointer.normalizedX * 0.2, 0);
ctx.target?.setScale(1.05);
ctx.target?.setOpacity(0.8);
```

When adding object3D content:

```ts
const handle = ctx.target?.addObject3D?.(object3D, {
  dispose(object) {
    // Dispose object-owned geometry/material/texture if this effect owns it.
  },
});

ctx.resources.addDisposable(() => handle?.dispose());
```

Do not mutate target internals that are not exposed by the handle.

## Resource Ownership

Effects may own:

- temporary Three.js objects created by the effect;
- event listeners created by the effect;
- generated geometries/materials/textures;
- per-effect mutable state.

Effects must not own:

- the renderer;
- the runtime;
- the runtime canvas;
- the main animation loop;
- global scroll/pointer systems;
- package-internal registries.

If an effect mutates a source model's mesh visibility, material, rotation, scale,
or position, store previous values and restore them on dispose unless the effect
is explicitly the long-term owner of that mutation.

## Package Boundary

MUST:

- Treat the package as a reusable open-source runtime.
- Keep app-specific visual effects in the downstream application.
- Ask for a generic public API before relying on package internals.
- Keep DOM as the source for layout, content, accessibility, and interaction
  state.

DO NOT:

- Depend on example app code, example assets, example target keys, or workspace
  paths.
- Import private source files from the package.
- Add concrete app visual behavior to package core.
- Add CSS-to-WebGL browser paint cloning unless explicitly requested.
- Expose raw Three.js renderer flags as declaration API without package-level
  tests, docs, and compatibility decisions.

## Validation

Minimum for downstream integration:

```bash
npm run typecheck
npm test -- --run <changed-test-files>
```

When working in this repository:

```bash
npm test -- --run <changed-test-files>
npm run typecheck
npm run check:imports
git diff --check
npm run build
```

Effect-specific tests should cover:

- unknown effect kind fails at registration or is caught by tests;
- definition `kind` matches declaration `kind`;
- unsupported `ctx.source.kind` no-ops safely;
- `setup` creates resources once;
- `update` uses `ctx.delta` for motion;
- target-local pointer math maps through `ctx.layout`;
- text glyph pointer effects use `glyph.y + glyph.height / 2` for visual
  center proximity;
- transformed model picking accounts for current object transform;
- `dispose` releases effect-owned resources and restores source mutations.

Effect-specific behavior such as whether a hover animation decays while the
pointer is stationary, or whether all glyphs or only nearby glyphs react, belongs
to the consuming effect contract. Do not record those product choices as package
pitfalls unless they expose a reusable coordinate, lifecycle, or ownership bug.

## Common Failures

- Unknown effect: target declares `{ kind: "x" }`, but runtime `effects` omits
  `defineWebGLEffect({ kind: "x" })`.
- Legacy object-form effects: use `effects: [{ kind: "app.effect" }]`, not
  `effects: { material, motion }`.
- Invalid media source: target declares `{ kind: "image" }` or
  `{ kind: "video" }` on a non-`img` / non-`video` element.
- Runtime recreates in React: `effects` array identity changes on render.
- Pointer offset: effect compares runtime normalized pointer coordinates directly
  to target-local coordinates.
- Text effect vertical drift: effect treats `glyph.y` as a baseline and uses
  `glyph.y - glyph.height / 2`; glyph `y` is already the top drawing position.
- Rotating model interaction drift: effect hit-tests unrotated model-local
  vertices while visible model is transformed.
- Resource leak: effect creates objects/listeners without `ctx.resources`.
- Boundary violation: app imports package internals or example-only code.

## Agent Completion Report

When finishing package usage or custom effect work, report:

- package entrypoints used;
- runtime registration location;
- target declaration location;
- effect kind(s);
- supported source kind(s);
- resource ownership and dispose behavior;
- tests and verification commands run;
- remaining visual tuning parameters, if any.
