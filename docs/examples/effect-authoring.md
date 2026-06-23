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
`/example/image.png`, `/example/video.mp4`, and `/models/hero.glb` from that
example public directory.

## Imports

Use public package entrypoints only:

```tsx
import { defineWebGLEffect } from "@project/dom-webgl-runtime";
import { WebGLRuntime, WebGLTarget } from "@project/dom-webgl-runtime/react";
import { createLenisGsapScrollStack } from "@project/dom-webgl-scroll-adapters";
```

Do not import:

```ts
import ... from "@project/dom-webgl-runtime/effects";
import ... from "packages/dom-webgl-runtime/src";
import ... from "../demo/src/demoEffects";
```

## Optional Smooth Scroll Stack

`apps/example` also applies the optional Lenis + GSAP + ScrollTrigger stack so
the example validates the package's downstream scroll adapter path:

```tsx
const smoothScroll = useExampleSmoothScrollStack();

<WebGLRuntime
  effects={exampleEffects}
  scrollAdapter={smoothScroll?.scrollAdapter}
>
  {children}
</WebGLRuntime>
```

The example owns the Lenis instance. Core receives only the public
`WebGLScrollAdapter`, not raw Lenis, GSAP, or ScrollTrigger objects.

Rules:

- Configure Lenis with `autoRaf: false` when GSAP drives `lenis.raf(...)`.
- Keep `manageLenis: false` when the app creates Lenis.
- Call `smoothScroll.dispose()` and `lenis.destroy()` in the same app cleanup.
- Do not read Lenis directly from effects; effects keep using `ctx.scroll` and
  `ctx.scrollProgress`.

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
