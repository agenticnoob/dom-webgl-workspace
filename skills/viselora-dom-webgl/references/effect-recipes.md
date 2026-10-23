# Native visual recipes

Copy a runnable recipe before writing a pattern from scratch. Each file
typechecks against the [template](../templates/react-vite/), uses only public
entrypoints and ends with a usage example.

| Recipe | Covers |
| --- | --- |
| [ModelTarget.tsx](../recipes/ModelTarget.tsx) | GLB loaded after mount, fit to a target's rect in a pixel-space orthographic camera, readiness against the captured target, load error keeps the fallback, owned geometry/material/texture disposal |
| [ScrollStory.tsx](../recipes/ScrollStory.tsx) | Story section progress from its live target rect, piecewise keyframes, no clock or damping, `frameloop: "demand"` |
| [TextWave.tsx](../recipes/TextWave.tsx) | `createDOMTextTexture` aligned with the DOM baseline, rebuild on polled `target.revision`, deferred disposal, vertex wave, reduced motion |

One-take recipes live in [one-take/](../recipes/one-take/) and share
`screenSpace.ts`; [OneTakeExample.tsx](../recipes/one-take/OneTakeExample.tsx)
composes them into one page. Each file's header states its budget at the
`medium` tier and its reduced-motion behavior.

| Recipe | Effect | Budget at `medium` |
| --- | --- | --- |
| [OneTakeRail.tsx](../recipes/one-take/OneTakeRail.tsx) | Camera on a spline driven by page progress; cell-dissolve veil at chapter boundaries | Veil: one full-screen quad, only near boundaries |
| [IntroReveal.tsx](../recipes/one-take/IntroReveal.tsx) | Page-coloured veil clears cell by cell once the first scene can draw | One full-screen quad until done |
| [GalleryReveal.tsx](../recipes/one-take/GalleryReveal.tsx) | CSS Grid cards replaced by planes; cell hover reveal and scroll bend | One draw call and two textures per card |
| [ParticleForm.tsx](../recipes/one-take/ParticleForm.tsx) | Points morph between shapes, including DOM text glyphs, and part around the pointer | One draw call, 60k points |
| [ProductTurntable.tsx](../recipes/one-take/ProductTurntable.tsx) | Scroll-driven turntable with stops and DOM hotspot labels projected from 3D | The model's draw calls, up to 300k triangles |

Rules they follow, which also apply to new effects:

- Each is a `WebGLSection` (by target or progress range) or states why not;
  the rail and veils follow the camera, so they are not sections.
- Suspense boundaries sit inside the section, so loading never suspends the
  section and warmup keeps running.
- Optional cost scales with `useRenderQuality().tier`; reduced motion is
  handled in the same file. Per-frame values go through refs and uniforms.
- Large images load with `ImageBitmapLoader` (decoded off the main thread and
  flipped while decoding). A texture exists before its material mounts: a
  material compiled without a map ignores one assigned later.
- Lights and the environment live outside sections.
- Chapter ranges come from the DOM blocks, measured after layout.
- PBR products need tone mapping: pass `canvas.flat: false`.

Adapting them:

- Several models: give every instance its own loaded or cloned Object3D. Do not
  dispose geometry/materials that another instance or a loader cache shares.
- GLB animation: create an `AnimationMixer` for the owned instance and advance it
  with `useFrame` delta (seconds); Drei `useGLTF`/`useAnimations` is fine when
  the consumer already depends on Drei.
- Scroll stories under `WebGLScrollRuntime` with ScrollTrigger sections: replace
  `sectionProgress` with `runtime.progress.get(progressKey)`; keep the mapping pure.
- Per-glyph text effects (scramble, pressure): build commands from
  `measureDOMText(...).glyphs` and draw them with `drawDOMText`, which places
  each glyph on its CSS baseline; set `texture.needsUpdate = true` after redraws.
- Images/video: native textures, DOM fallback until the texture has loaded.
- Scroll-scrubbed image sequences: decode frames with
  `createImageBitmap(blob, { imageOrientation: "flipY", resizeWidth, resizeHeight })`
  at the drawn size, set `texture.flipY = false`, and set `needsUpdate` only
  when the frame changes. Re-uploading `HTMLImageElement` frames measured about
  170 ms per frame on an integrated GPU with a slow CPU. Bitmaps hold decoded
  pixels, so keep a window around the current frame and `close()` the rest.

Keep application visual math and shaders in the consumer. Avoid wrapping every
native object in a new generic facade or recovering retired 0.1.x declarations.
