# Effect Authoring Example

This example shows the recommended React-only downstream usage pattern for the
DOM WebGL runtime. It lives in `apps/example`, so it behaves like consumer
application code. The page uses Chinese visible copy
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

The example ships its own static assets under `apps/example/public`. The React
app references
`/example/bg.png`, `/example/bg.mp4`, `/example/bg-sequence/frame_*.webp`,
`/example/image.png`, `/example/show.png`, `/example/mask.png`,
`/example/video.mp4`, and `/models/hero.glb` from that example public
directory. `/example/bg-sequence` is the compressed image sequence used by the
pinned runtime `image-sequence` source; the current checked-in sequence is 454
WebP frames at 1600x900, 12fps extraction, and about 141MB total.

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
import ... from "../example/src/someEffect";
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
        source: { kind: "dom", type: "element" },
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

`ScrollEffectSection` should wrap the full pinned row that owns the effect. Do
not add an extra post-pinned runway sibling just to release scroll; let the
bounded section own the pin lifecycle directly.
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
  source: "dom/text",
  update(ctx, _state, params) {
    if (ctx.source.kind !== "dom" || ctx.source.type !== "text") {
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

Public handles are capability handles: use methods such as `draw`, `setGlyphs`,
`setTextureTransform`, `createMaterialLayer`, `forEachMesh`, `sampleVertices`,
and `createPointLayer`; do not rely on `object3D`, `mesh`, `material`, or
`texture` fields. Material programs are Three-inspired shader declarations, not
raw Three.js materials; public fields are `vertexShader`, `fragmentShader`,
`uniforms`, `defines`, and `blend`.

```ts
const ghostCursorEffect = defineWebGLEffect({
  kind: "example.surfaceGhostCursor",
  source: "dom/element",
  setup(ctx) {
    if (ctx.source.kind !== "dom" || ctx.source.type !== "element") return;

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
      uPointer: [ctx.targetPointer.localX, ctx.targetPointer.localY],
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
emissive smoke around the cursor. The example stops sending material uniforms
after the trail decays to idle, so the effect remains interactive without
keeping a settled target hot every frame.

Pointer contract:

- `ctx.pointer` is runtime/canvas pointer state.
- `ctx.targetPointer` is current-target layout-local pointer state.
- `ctx.targetPointer.isInside` is the hover check for the current target.
- `ctx.targetPointer.localX/localY` replace repeated
  `ctx.pointer.x - ctx.layout.left/top` math in effects.
- `ctx.targetPointer.normalizedX/Y` are target-local values in the same -1..1
  convention as runtime pointer coordinates.
- `pointer: { hover, press, click, drag }` declares which target-level pointer
  semantics should wake reactive effects.
- `longPress` is effect-level behavior built from
  `ctx.targetPointer.pressDuration`; runtime does not own a global threshold.
- Target pointer is layout-local only. It does not perform inverse-transformed
  picking for rotated groups, models, or custom meshes.

## Declare Targets

Target declarations carry data only:

```tsx
<WebGLTarget
  as="p"
  webgl={{
    key: "example.text",
    source: { kind: "dom", type: "text" },
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
- `example.surfaceWaves`: creates a ReactBits-inspired GPU material layer over
  the element snapshot source texture. Pointer displacement applies only while
  the pointer is inside that target rect; the shader keeps the ambient line field
  moving without per-frame CPU canvas drawing.
- `example.textWave`: rewrites text glyph output.
- `example.textReveal`: maps target viewport progress into per-glyph opacity
  and scale, with page scroll progress as an additional driver; when a
  `progressKey` is provided, it reads `ctx.progress.get(progressKey)` so pinned
  children can follow their owning section instead of page scroll.
- `example.textSpotlight`: maps target-local pointer distance into per-glyph
  color, opacity, and scale.
- `example.textPressure`: ports the ReactBits Text Pressure idea through the
  runtime text layer by mapping target-local pointer distance into WebGL glyph
  scale and line reflow: nearby glyphs widen while other glyphs compress and
  shift into the pressure layout.
- `example.textScramble`: ports the ReactBits Scrambled Text idea through the
  runtime text layer by replacing nearby WebGL glyph characters with
  deterministic scramble characters before returning to the source text.
- `example.textSpotlightPressureScrambleWave`: combines spotlight color,
  pressure reflow, scramble characters, and wave offset in one app-owned
  `dom/text` effect so the final glyph command list is written once per frame.
- `example.imagePan`: applies an image texture transform from target viewport/page progress.
- `example.imageZoom`: drives target scale for an image renderable.
- `example.imageKenBurns`: combines image texture sampling drift with target
  scale for a slow camera move.
- `example.imageHoverReveal`: creates a media image material layer that samples
  the current source texture and a second image texture at matching UVs, then
  leaves a short-lived irregular eraser trail that reveals the second image
  before the whole trail fades back to the base texture together. The example
  stores the brush result in an app-owned mask canvas texture instead of a
  finite point-uniform trail, so long strokes do not lose their oldest segment.
  It only restarts the fade timer after real pointer movement, not merely while
  the pointer is stationary inside the target, and it bakes the current fade
  into the mask before drawing a resumed stroke so old reveal areas do not snap
  back to full opacity.
- `example.mediaPointerParallax`: applies the same target-local pointer
  parallax to `media/image`, `media/video`, and `media/image-sequence` handles
  by cropping the texture sample area slightly before offsetting it.
- `example.videoPlayback`: mutes, slows, and starts a video texture.
- `example.videoDrift`: applies a live transform to a video texture.
- `example.sequenceCardSlide`: drives a `dom/element` card target from the
  image-sequence pinned progress key, sliding it in from the side and back out.
- `example.sequenceCardBorderGlow`: draws the card surface and a ReactBits-style
  border glow from target-local pointer proximity. When paired with slide, it
  reads the same progress key/travel values so pointer hit math follows the
  WebGL-translated card position.
- `example.modelSpin`: rotates a GLB target through target controls.
- `example.modelFloat`: combines layout data and runtime time for GLB movement.

### Image Hover Reveal Implementation Notes

`example.imageHoverReveal` is intentionally consumer-owned. It uses only the
public `media/image` source handle, `createMaterialLayer(...)`, and texture
uniform declarations:

- `uBaseTexture` is the runtime-owned source image texture.
- `uRevealTexture` is a second app image (`/example/mask.png`).
- `uMaskTexture` is an app-owned canvas texture updated by the effect.

The mask canvas records pointer strokes in target-local coordinates. The shader
does not receive `uTrailPoints`/`uTrailCount`, because a bounded point array
acts like a sliding window and makes long strokes disappear from the tail. The
canvas brush draws layered irregular polygons instead of a radial circle
gradient, which keeps the eraser edge from reading as a perfect round cursor.

Fade behavior is part of the consuming effect contract:

- the fade starts when pointer movement stops, even if the pointer remains
  inside the target;
- when movement resumes during a fade, the effect first applies the current
  opacity to the existing mask with `destination-in`, then draws the new full
  strength stroke;
- once the fade reaches zero, the mask canvas is cleared.

The pinned scrub row now dogfoods runtime `source: { kind: "media", type: "image-sequence" }`.
`ScrollEffectSection` owns the progress key, and the WebGL target declares
`frameCount`, consumer-owned `frames`, and `progressKey` so the runtime selects
usable frames and updates the texture plane without owning the sequence loader.
The image-sequence parent composes `example.mediaPointerParallax`, so scrub
progress still selects frames while pointer position only adjusts the current
frame's texture transform.
The example uses a pinned scrub layout: the section owns `pin`, scrub duration,
and progress, while the image sequence and WebGL card stay inside the pinned
viewport. The card is a nested `dom/element` child target inside the
image-sequence DOM subtree with `transformScope: "subtree"`. It composes
`example.sequenceCardSlide` and `example.sequenceCardBorderGlow`; the
image-sequence parent does not manually add card objects through an effect, and
the card does not declare
`renderRole: "overlay"`. DOM supplies the card's layout anchor. The card pixels
come from `ctx.source.surface.draw(...)`; runtime core does not clone the DOM
card's CSS background, border, shadow, or other decorative paint.
The card title and description are child `dom/text` targets, so their text
source/effect/fallback ownership remains independent while the parent card's
group transform moves the WebGL subtree. Their `example.textReveal` effects use
the same image-sequence `progressKey`, so the text reveal is driven by the pinned
scrub section rather than global page scroll.
`WebGLScrollRuntime` receives a notifying progress source from the scroll
adapter, so ScrollTrigger scrub progress wakes the on-demand image-sequence
renderable even when no card effect is active in the viewport.

These are intentionally small. They are examples of the contract, not official
package effects.

## Common Pitfalls

- Recreating the `effects` array inside a React component can recreate the
  runtime.
- Old explicit declarations such as top-level media kinds and `snapshot/mode`
  are removed.
- `ctx.source.textLayer` affects WebGL output only; it does not mutate DOM text.
- Effects should no-op when `ctx.source.kind` or `ctx.source.type` is not compatible.
- Effect-owned objects and listeners need `ctx.resources` disposal.
