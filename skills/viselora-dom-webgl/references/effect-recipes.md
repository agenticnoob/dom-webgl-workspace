# Optional Effect Recipes

Compatible package version: 0.1.0-alpha.1

These five recipes are optional examples, not the skill's capability boundary.
Read [capability-status.md](capability-status.md) before copying one. Never put
blocked or experimental recipes into a normal default project.

## Surface pulse

- **Compatible version:** `0.1.0-alpha.1`.
- **Status:** `surface-pulse-visible-output` is `blocked`.
- **Required exports:** `defineWebGLEffect`, `WebGLTarget`.
- **Assets and fallback:** semantic DOM element/copy; no external asset.
- **Ownership:** runtime canvas/frame loop; effect uses managed surface only.
- **Mobile and reduced motion:** keep copy static and meaningful.
- **Required evidence:** retained effect-surface pixels and final-canvas pixel
  threshold reproduction.
- **Limitations:** effect-owned surface pixels change while visible runtime
  canvas output remains a defect candidate in this version.

Use [`templates/effects/surface-pulse.ts`](../templates/effects/surface-pulse.ts)
only in `retained-defect-reproduction` mode. Use DOM/CSS or verified media for
normal production output.

## Video background texture

- **Compatible version:** `0.1.0-alpha.1`.
- **Status:** `managed-video` is `verified`.
- **Required exports:** `defineWebGLEffect`, `WebGLTarget`.
- **Assets and fallback:** local video, local poster, semantic/native video
  fallback and license record.
- **Ownership:** managed `ctx.object.video`/texture; no `VideoTexture` or custom
  playback/render loop.
- **Mobile and reduced motion:** muted/playsInline; replace unnecessary motion
  with the poster.
- **Required evidence:** playback, autoplay rejection, network failure and
  offscreen re-entry.
- **Limitations:** autoplay policy may require a user gesture.

See
[`templates/effects/video-background-texture.ts`](../templates/effects/video-background-texture.ts).

## Image hover overlay

- **Compatible version:** `0.1.0-alpha.1`.
- **Status:** `managed-image-hover` is `verified` only for explicit source
  sampling.
- **Required exports:** `defineWebGLEffect`, `WebGLTarget`, managed material
  layer handle.
- **Assets and fallback:** local licensed image and semantic `<img alt>`.
- **Ownership:** target `pointer.hover`, `ctx.targetPointer`, disposable
  source-backed material layer.
- **Mobile and reduced motion:** hover meaning must have touch or scroll parity;
  the source image remains readable.
- **Required evidence:** loading/error fallback and clipped final-canvas pixel
  change on hover plus the alternative path.
- **Limitations:** overlay mode did not preserve the source in external alpha
  validation.

The verified shader declares `uniform sampler2D uSourceTexture`, samples
`texture2D(uSourceTexture, vUv)`, and creates the layer with
`sourceTextureUniform: "uSourceTexture"` plus `mode: "replace-source"`. See
[`templates/effects/image-hover-overlay.ts`](../templates/effects/image-hover-overlay.ts).

## Pinned model glow

- **Compatible version:** `0.1.0-alpha.1`.
- **Status:** `glb-loading-lifecycle` is `verified`, while
  `dom-anchored-glb-visible-output` is `blocked`.
- **Required exports:** `defineWebGLEffect`, `WebGLTarget`,
  `WebGLScrollTimeline`.
- **Assets and fallback:** local licensed GLB, clip metadata, decoder assets when
  needed, and poster/text fallback.
- **Ownership:** runtime loader/mixer/lights; one timeline/progress source.
- **Mobile and reduced motion:** freeze scrub and keep poster/text meaningful.
- **Required evidence:** ready/active and network fallback are not sufficient;
  require a clipped final-canvas model pixel threshold.
- **Limitations:** default DOM-anchored visible model output remains a blocked
  defect candidate in this version.

Use
[`templates/effects/pinned-model-glow.tsx`](../templates/effects/pinned-model-glow.tsx)
only as a lifecycle example or retained reproduction, never as copy-and-ship
visible-output guidance.

## Scroll image sequence

- **Compatible version:** `0.1.0-alpha.1`.
- **Status:** `image-sequence` is `experimental`.
- **Required exports:** `defineWebGLEffect`, `WebGLTarget`,
  `WebGLScrollTimeline`, image-sequence frame types.
- **Assets and fallback:** complete local sequence, first frame, naming/frame
  metadata, license and bounded cache budget.
- **Ownership:** one timeline/progress source; mount only a stable complete
  frame declaration.
- **Mobile and reduced motion:** retain the first frame and shorten/freeze scrub.
- **Required evidence:** first-frame fallback, bounded cache, forward/reverse
  scroll and final-canvas pixel change.
- **Limitations:** external consumer browser validation is incomplete.

Use
[`templates/effects/scroll-image-sequence.tsx`](../templates/effects/scroll-image-sequence.tsx)
only with `acknowledgement: "experimental"` and the required evidence plan.
