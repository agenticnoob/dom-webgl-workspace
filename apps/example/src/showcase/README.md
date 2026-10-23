# One-take showcase recipes

`showcase.html` composes five copyable effects into one scroll page. Each
recipe is one file you can copy into a project and edit; it uses only the
public Viselora entrypoints, React, R3F and Three.js.

These recipes need 0.3.0-alpha.0 (`WebGLSection`, `useRenderQuality`). The
consumer skill ships identical copies in
[`skills/viselora-dom-webgl/recipes/one-take/`](../../../../skills/viselora-dom-webgl/recipes/one-take/)
with a composed `OneTakeExample.tsx`; `test/skill.test.ts` fails when the
copies drift, so edit here and copy.

| Recipe | File | Effect | Budget at `medium` |
| --- | --- | --- | --- |
| R1 | `OneTakeRail.tsx` | Camera on a spline driven by page progress; cell-dissolve veil at chapter boundaries | Veil: one full-screen quad, only near boundaries |
| R2 | `IntroReveal.tsx` | Page-coloured veil clears cell by cell from the centre once the first scene can draw | One full-screen quad until done |
| R3 | `GalleryReveal.tsx` | CSS Grid gallery; cards replaced by planes with a cell hover reveal and scroll bend | One draw call and two textures per card |
| R4 | `ParticleForm.tsx` | Points morph between shapes (sphere, torus knot, DOM text glyphs) and part around the pointer | One draw call, 60k points |
| R5 | `ProductTurntable.tsx` | Scroll-driven turntable with stops and DOM hotspot labels projected from 3D | The model's draw calls, up to 300k triangles |

`screenSpace.ts` holds the shared helpers: covering a CSS rect in front of a
moving perspective camera, frame-rate independent damping, and the cell hash.

## Rules every recipe follows

- It is a `WebGLSection` (by target or progress range) or states why not; the
  rail and veils must follow the camera, so they are not sections.
- Its Suspense boundary is inside its section, so loading never suspends the
  section and warmup keeps running.
- Optional cost scales with `useRenderQuality().tier`; reduced motion is
  handled in the same file.
- Per-frame values go through refs and uniforms, never React state.
- Large images load with `ImageBitmapLoader` (decoded off the main thread and
  flipped while decoding); loader assets are shared, Textures are owned.
- Textures exist before a material is mounted: a material compiled without a
  map ignores one assigned later.
- Lights and the environment live outside sections; lit materials outside a
  section would recompile when a light inside it hides.
- Chapter ranges come from where the DOM blocks are, measured after layout,
  not from assumed heights.
- PBR products need tone mapping: the page passes `canvas.flat: false`.

## Run and measure

```bash
npm run dev -w @viselora/example        # then open /showcase.html
npm run build
node scripts/bench-one-take.mjs --serve --page showcase.html --gpu low-power
```

`?bench=1` adds the benchmark panel; `?diagnostics=1` turns on the runtime's
development warnings in a production build. Results are in the
[benchmark notes](../../docs/benchmark.md#showcase-2026-10-23-unreleased-source).
