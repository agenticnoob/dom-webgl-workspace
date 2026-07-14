# Next.js Tetrahedron Hero Design

**Date:** 2026-07-13
**Status:** Implemented baseline; visual direction and GLB details superseded by the later Ghost Cursor and `WebGLMesh` hero designs

> Current implementation truth lives in
> `2026-07-14-hero-next-webglmesh-tetrahedron-design.md`. This document remains
> historical evidence for the initial application shell and pure-visual hero boundary.

## Goal

Create a new Next.js application under `apps/` that consumes the current
workspace packages through their public entrypoints and establishes the visual
foundation for a future scroll-driven site.

The first implementation is a single, full-viewport visual hero: a black,
mirror-like tetrahedron breathing at the center of a frosted gray-white space.
The viewport contains no visible copy, navigation, controls, branding, or CTA.

## Application Boundary

- Create `apps/hero-next` using the Next.js App Router and TypeScript.
- Keep the app inside the existing npm workspace; do not publish it.
- Consume runtime features only through `@viselora/dom-webgl` and
  `@viselora/dom-webgl/react`.
- Consume smooth-scroll integration only through
  `@viselora/scroll-adapters` and its public React entrypoint where applicable.
- Use `gsap` and `lenis` as app dependencies.
- Do not import package source files or raw runtime internals.
- Do not add app-specific behavior to runtime or package source code.

## Visual Direction

The hero fills `100svh` and reads as a quiet architectural studio rather than a
marketing page.

- Background: cool gray-white, matte, and softly frosted.
- Illumination: a restrained bright center with subtly darker edges.
- Texture: extremely fine monochrome grain; no visible decorative pattern.
- Subject: one black tetrahedron centered in the viewport and occupying about
  38% of the shorter viewport dimension on desktop.
- Surface: black obsidian or smoked mirror, reflective enough to separate its
  planes without becoming chrome.
- Edges: visible through grazing light and face-to-face tonal separation, not
  through an artificial wireframe overlay.
- Lighting: one cool side strip, one slightly warm opposing strip, and a weak
  top/fill light. The palette remains effectively monochrome.
- Composition: no text, navigation, logo, badges, buttons, cursor labels, or
  loading copy may appear in the hero.

The scene must remain legible on both bright and dim displays. The model must
not collapse into a flat black silhouette, and the background must not become
pure white.

## Runtime Architecture

Use the package's scene-native managed model path:

1. A client component owns Lenis and the GSAP integration lifecycle.
2. `WebGLRuntime` receives a stable effect registry and the scroll adapter.
3. An explicit `WebGLScene` owns the hero scene and render pass.
4. `WebGLCamera` defines a stable perspective composition.
5. `WebGLLight` declarations create runtime-owned studio lighting.
6. `WebGLModel` loads the copied tetrahedron GLB as a scene-native object.
7. A `defineWebGLSceneObjectEffect(...)` effect owns continuous model motion
   and managed material adjustments.

The internal reserved default scene remains empty. Hero content belongs to an
explicit scene such as `hero.tetrahedron.scene`.

The source asset is copied from `apps/example/public/models/4.glb`. Because the
asset is Draco-compressed, copy the required decoder files from
`apps/example/public/draco/gltf/` into the new app and declare the public decoder
path through the managed model loader configuration.

## Motion

Motion should feel organic and nearly still:

- Breath cycle: approximately five seconds, scaling by no more than 2%.
- Float: a small vertical displacement with a phase offset from the scale.
- Rotation: very slow movement around more than one axis so the loop does not
  read as a turntable.
- GSAP owns the breath timing and Lenis owns smooth page scrolling.
- Runtime-facing visual mutation remains inside the managed scene-object effect;
  React props remain stable and are not updated every frame.

For this first screen there is no scroll choreography beyond initializing the
shared Lenis/GSAP stack correctly. The integration must be reusable by future
scroll sections without restructuring the hero runtime.

When `prefers-reduced-motion: reduce` is active, stop continuous float,
rotation, and scale animation. Preserve the static centered composition.

## Responsive Behavior

- Desktop and landscape tablet: tetrahedron occupies about 38% of the shorter
  viewport dimension.
- Portrait mobile: reduce the model to approximately 52% of viewport width while
  preserving clear negative space.
- Use `svh` sizing to avoid mobile browser chrome jumps.
- Keep the model visually centered after viewport resize and orientation change.
- The canvas and page must not create horizontal overflow.

## Component Boundaries

- `app/layout.tsx`: document shell and global metadata only.
- `app/page.tsx`: renders the hero client component.
- Hero client component: composes the runtime, scene, camera, lights, and model.
- Smooth-scroll hook/component: owns Lenis, GSAP ticker, ScrollTrigger bridge,
  cleanup, and the stable runtime scroll adapter.
- Effect module: exports the stable scene-object effect registry and contains
  material/motion behavior.
- Global styles: viewport reset, frosted spatial background, grain treatment,
  canvas containment, and responsive sizing.

No component should reach into raw Three.js renderer, scene, camera, loader, or
object handles.

## Loading And Failure Behavior

- Keep the visual background visible while the model loads.
- Do not show textual loading UI in the hero.
- If the GLB or Draco decoder fails, preserve the empty frosted space without
  crashing the Next.js route.
- Development diagnostics may use `onDebugStateChange`, but no debug overlay or
  console spam should ship in the final screen.
- Dispose Lenis, GSAP bridges, ScrollTrigger bindings, and the runtime through
  their owning lifecycle cleanup paths.

## Verification

Implementation is complete only when all of the following pass:

1. Focused tests cover stable declarations, effect behavior, and cleanup where
   practical without a GPU context.
2. The new workspace passes its Next.js production build and TypeScript checks.
3. Repository verification passes in this order:
   `npm run test -- --run`, `npm run typecheck`, `npm run build`,
   `npm run check:imports`, and `git diff --check`.
4. Browser verification confirms the real GLB and Draco decoder load, the model
   is visible, the faces and edges remain legible, the breath is subtle, and no
   visible text or UI is present.
5. Desktop and mobile-sized screenshots confirm centering, scale, palette,
   absence of overflow, and acceptable reduced-motion behavior.

## Out Of Scope

- Additional sections or scroll chapters.
- Visible copy, navigation, branding, CTA, or controls.
- Pointer parallax or direct manipulation.
- Bloom, depth of field, or other postprocessing unless later browser evidence
  proves that the requested edge legibility cannot be achieved with managed
  materials and lights alone.
- Runtime/package API changes.
- Raw Three.js escape hatches.
- Deployment, publishing, pushing, or release version changes.
