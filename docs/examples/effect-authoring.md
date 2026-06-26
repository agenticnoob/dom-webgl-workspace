# Effect Authoring Example

This example shows the recommended React-only downstream usage pattern for the
DOM WebGL runtime. It deliberately lives in `apps/example`, not `apps/demo`, so
it behaves like consumer application code. The page uses Chinese visible copy
for effect explanations while keeping source kinds and effect kind strings in
English as API data.

## Install And Run

From the workspace root:

```bash
npm install
npm run dev --workspace @project/dom-webgl-example
```

Build the example:

```bash
npm run build --workspace @project/dom-webgl-example
```

The example ships its own static assets under `apps/example/public`, copied from
the demo asset set for convenience. The React app references
`/example/bg.png`, `/example/bg.mp4`, `/example/image.png`,
`/example/video.mp4`, and `/models/hero.glb` from that example public
directory.

## Layout Contract

The example page is a full-width vertical catalog. Each effect occupies one row
that spans the viewport width, with no outer shell padding around the catalog.
The explanatory copy is a reusable collapsible component over the row's WebGL
effect surface: it starts as a compact debug-panel-style pill and expands on
click to show the source kind, effect name, and explanation.

## Imports

Use public package entrypoints only:

```tsx
import { defineWebGLEffect } from "@project/dom-webgl-runtime";
import { WebGLRuntime, WebGLTarget } from "@project/dom-webgl-runtime/react";
import {
  ScrollEffectSection,
  WebGLScrollRuntime,
} from "@project/dom-webgl-scroll-adapters/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
```

Do not import:

```ts
import ... from "<runtime-package>/effects";
import ... from "packages/dom-webgl-runtime/src";
import ... from "../demo/src/demoEffects";
```

## Pinned Scroll Effect Path

For the normal "pinned section drives a WebGL effect" path, use the optional
React adapter from `@project/dom-webgl-scroll-adapters/react`. It hides the
bounded trigger lifecycle from ordinary example code, owns one trigger per
`ScrollEffectSection`, and exposes progress to effects through a stable key:

```tsx
<WebGLScrollRuntime effects={exampleEffects} smooth={false}>
  <ScrollEffectSection
    progressKey="example.pinned.reveal"
    ScrollTrigger={ScrollTrigger}
    pin
    scrub
  >
    <WebGLTarget
      webgl={{
        key: "example.pinned.surface",
        source: { kind: "snapshot", mode: "element" },
        effects: [
          {
            kind: "example.pinnedReveal",
            progressKey: "example.pinned.reveal",
          },
        ],
      }}
    >
      滚动这一屏时，进度会驱动 WebGL 效果。
    </WebGLTarget>
  </ScrollEffectSection>
</WebGLScrollRuntime>
```

The effect reads the progress key rather than mutating the target declaration on
every scroll update:

```ts
const progress = ctx.progress.get(params.progressKey);
```

This path is not a scene gate. The page remains in normal page scroll mode while
ScrollTrigger handles pin/scrub behavior for its own section.
The current `apps/example` app centralizes Lenis/GSAP/ScrollTrigger setup in
`exampleSmoothScrollOptions` and passes it through
`<WebGLScrollRuntime smooth={exampleSmoothScrollOptions}>`, so child
`ScrollEffectSection` components can inherit `ScrollTrigger` instead of passing
it repeatedly.

Use a manual `scrollAdapter` only for advanced integrations where the
application intentionally owns a third-party scroll instance lifecycle. Core
still receives only the public `WebGLScrollAdapter`, not raw Lenis, GSAP, or
ScrollTrigger objects.

Rules:

- Keep `progressKey` stable and pass it as target effect data.
- Do not drive pinned effect progress with `scroll: { type: "gate" }`; gates are
  for advanced scroll-locking scenes.
- Do not read Lenis directly from effects; effects keep using `ctx.scroll` and
  `ctx.scrollProgress`, or `ctx.progress.get(progressKey)` for keyed section
  progress.

## Register Effects Once

Define application-owned effects in local app code:

```ts
import { defineWebGLEffect } from "@project/dom-webgl-runtime";

export const textWaveEffect = defineWebGLEffect<{
  kind: "example.textWave";
  amplitude?: number;
}>({
  kind: "example.textWave",
  source: "snapshot/text",
  update(ctx, _state, params) {
    if (ctx.source.kind !== "snapshot/text") {
      return;
    }

    const amplitude = params.amplitude ?? 6;
    ctx.source.textLayer?.setGlyphs((glyphs) =>
      glyphs.map((glyph) => ({
        index: glyph.index,
        char: glyph.char,
        y: glyph.y + Math.sin(ctx.time / 450 + glyph.index * 0.42) * amplitude,
      })),
    );
  },
});

export const exampleEffects = [textWaveEffect] as const;
```

Then pass the stable array to React:

```tsx
<WebGLRuntime effects={exampleEffects}>{children}</WebGLRuntime>
```

For shader/material effects, keep the same authoring model and use public
handles:

```ts
const ghostCursorEffect = defineWebGLEffect({
  kind: "example.surfaceGhostCursor",
  source: "snapshot/element",
  setup(ctx) {
    if (ctx.source.kind !== "snapshot/element") return;

    return ctx.source.surface?.createMaterialLayer({
      key: "example.surfaceGhostCursor",
      mode: "replace-source",
      sourceTextureUniform: "uSource",
      program: {
        fragmentShader: "...",
        uniforms: {
          uSource: { kind: "source-texture" },
          uPointer: [ctx.layout.width / 2, ctx.layout.height / 2],
        },
      },
    });
  },
  update(ctx, layer) {
    layer?.setUniforms({
      uPointer: [ctx.pointer.x - ctx.layout.left, ctx.pointer.y - ctx.layout.top],
      uTime: ctx.time,
    });
  },
  dispose(_ctx, layer) {
    layer?.dispose();
  },
});
```

`apps/example` uses this pattern for Ghost Cursor: no-pointer smoke stays nearly
invisible on the dark stage, and pointer input only activates target-local
emissive smoke around the cursor.

## Declare Targets

Target declarations carry data only:

```tsx
<WebGLTarget
  as="p"
  webgl={{
    key: "example.text",
    source: { kind: "snapshot", mode: "text" },
    lifecycle: { hideWhenReady: true, hideMode: "self" },
    effects: [{ kind: "example.textWave", amplitude: 7 }],
  }}
>
  Text remains DOM-authored while glyph output becomes effect-owned.
</WebGLTarget>
```

The runtime matches `example.textWave` against the registered definition. If the
definition is missing, the target declaration has no executable effect.

## Source Examples In `apps/example`

`apps/example/src/exampleEffects.ts` covers the current public source handles:

- `example.surfaceFill`: draws `/example/bg.png` onto the element snapshot
  surface and applies opacity only to that surface layer.
- `example.surfacePulse`: draws a visible pulse on the element snapshot surface
  without changing the target or DOM child opacity.
- `example.surfaceVideoBackground`: draws `/example/bg.mp4` onto the element
  snapshot surface as a muted looping effect-owned background texture.
- `example.surfaceGhostCursor`: draws a ReactBits-inspired dark smoke stage on
  the element snapshot surface. The no-pointer smoke field is intentionally
  nearly invisible; the current target's local pointer activates cursor-local
  emissive smoke that fades at the last local position after leaving the target.
- `example.surfaceWaves`: draws a ReactBits-inspired pointer-reactive line wave
  background on the element snapshot surface. Pointer displacement applies only
  while the pointer is inside that target rect.
- `example.textWave`: rewrites text glyph output.
- `example.textReveal`: maps scroll progress into per-glyph opacity and scale.
- `example.imagePan`: applies an image texture transform.
- `example.imageZoom`: drives target scale for an image renderable.
- `example.videoPlayback`: mutes, slows, and starts a video texture.
- `example.videoDrift`: applies a live transform to a video texture.
- `example.modelSpin`: rotates a GLB target through target controls.
- `example.modelFloat`: combines layout data and runtime time for GLB movement.

These are intentionally small. They are examples of the contract, not official
package effects.

## Common Pitfalls

- Recreating the `effects` array inside a React component can recreate the
  runtime.
- Declaring `{ kind: "image" }` on a `div` is invalid; use a real `img`.
- Declaring `{ kind: "video" }` on a `div` is invalid; use a real `video`.
- `ctx.source.textLayer` affects WebGL output only; it does not mutate DOM text.
- Effects should no-op when `ctx.source.kind` is not compatible.
- Effect-owned objects and listeners need `ctx.resources` disposal.
