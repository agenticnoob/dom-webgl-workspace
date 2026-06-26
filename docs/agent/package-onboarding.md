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
  effect authoring primitives, source handles, target handles, scroll state,
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
  `<scroll-adapters-package>/react`.
- Existing Lenis/GSAP/ScrollTrigger lifecycle already owned by the app: pass a
  stable `WebGLScrollAdapter` into the runtime.

Do not use a scene gate for ordinary pinned sections. Gates lock page scroll and
are for advanced scroll-locking scenes.

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
  WebGLRuntime,
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
import ... from "../demo/src/demoEffects";
```

The runtime package does not export concrete effects or an `effects` preset
subpath. Demo/example effects are consumer examples, not package API.

## Minimal React Integration

Define effects at module scope, pass them once to the runtime, and declare target
effect data on each target.

```tsx
import { defineWebGLEffect } from "<runtime-package>";
import { WebGLRuntime, WebGLTarget } from "<runtime-package>/react";

type AppSurfaceParams = {
  kind: "app.surface";
  opacity?: number;
};

const appSurfaceEffect = defineWebGLEffect<AppSurfaceParams>({
  kind: "app.surface",
  source: "snapshot/element",
  update(ctx, _state, params) {
    ctx.target?.setOpacity(clampNumber(params.opacity, 0, 1, 1));
  },
});

const runtimeEffects = [appSurfaceEffect] as const;

export function App() {
  return (
    <WebGLRuntime effects={runtimeEffects}>
      <WebGLTarget
        webgl={{
          key: "hero.surface",
          source: { kind: "snapshot", mode: "element" },
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

## Minimal Vanilla Integration

```ts
import { createWebGLRuntime } from "<runtime-package>";

const runtime = createWebGLRuntime({
  container,
  effects: [appSurfaceEffect],
});

runtime.registerTarget(element, {
  key: "hero.surface",
  source: { kind: "snapshot", mode: "element" },
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
| `div`, `section`, `article`, card, panel | `{ kind: "snapshot", mode: "element" }` |
| text-bearing `p`, `span`, `h1`, `h2` | `{ kind: "snapshot", mode: "text" }` |
| real `img` element | `{ kind: "image" }` or `{ kind: "image", src }` |
| real `video` element | `{ kind: "video" }` or `{ kind: "video", src }` |
| GLB model target | `{ kind: "model", format: "glb", src }` |

Do not declare `image` or `video` on non-media elements. Use `snapshot` for
normal DOM.

Effect code must narrow `ctx.source.kind` before using source-specific handles:

```ts
if (ctx.source.kind !== "snapshot/text") {
  return;
}

ctx.source.textLayer?.setGlyphs((glyphs) =>
  glyphs.map((glyph) => ({
    index: glyph.index,
    char: glyph.char,
    y: glyph.y + Math.sin(ctx.time / 450 + glyph.index * 0.42) * 7,
  })),
);
```

Available handles:

- `snapshot/element`: `ctx.source.surface`
- `snapshot/text`: `ctx.source.textLayer`
- `image`: `ctx.source.image`
- `video`: `ctx.source.video`
- `model/glb`: `ctx.source.model`

Current visual capability surface:

- Element and text snapshot handles can draw to their canvas surface and create
  runtime-owned material layers over the source texture.
- Text, image, and video handles expose shader input metadata such as size,
  glyph layout, natural media size, content box, source texture availability,
  and object-fit UV transform.
- Image/video handles keep object-fit and playback controls public without
  exposing raw Three textures.
- GLB handles expose controlled mesh handles, material restore, vertex samples,
  and managed point layers.
- `ctx.visual.requestPostprocess(...)` submits named bloom/grain/blur requests
  owned by the runtime.

DOM text remains the source of content and accessibility. Text-layer methods
change WebGL output only.

## Lifecycle And Ownership

Default target lifecycle is `hideWhenReady: true`. Use:

- `hideMode: "self"` for mixed DOM/WebGL panels where children can stay DOM.
- `hideMode: "subtree"` only when the whole subtree should be replaced by WebGL.
- `hideWhenReady: false` when fallback DOM must remain visible.

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

Use this when a bounded section should pin/scrub and feed progress to an effect:

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
    ctx.target?.setOpacity(progress);
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
            source: { kind: "snapshot", mode: "element" },
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
- Do not mutate mounted `webgl.effects` on every scroll update.
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
- Text confusion: `textLayer.setGlyphs(...)` changes WebGL output, not DOM text.
- Pointer offset: an effect compares runtime normalized pointer coordinates
  directly to target-local coordinates.
- Resource leak: an effect creates objects or listeners without `ctx.resources`.
- Boundary violation: app imports package internals, demo code, or example code.

## Where To Look Next

- `docs/agent/package-usage.md`: full package contract and edge cases.
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
