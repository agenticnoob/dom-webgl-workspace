# Hero Next Agent Rules

This file is required reading before editing any file under `apps/hero-next/`.
Its rules apply to the entire `apps/hero-next` subtree.

## Hard Visual Boundary

`hero-next` is a strict downstream dogfood consumer of the current public
Viselora packages.

```text
DOM-backed visual -> WebGLTarget
Procedural 3D geometry -> WebGLMesh
GLB asset -> WebGLModel
```

- CSS may only perform document reset, sizing, positioning, layout, stacking,
  overflow control, and pointer-event routing.
- CSS must not create any visible artwork or visual treatment. Do not use CSS
  backgrounds, gradients, colors, borders, shadows, filters, opacity,
  blend modes, masks, clipping, generated content, visual transforms, or CSS
  animation for the hero image.
- Do not use pseudo-elements as visual layers.
- Every visible hero object, material, light, texture, postprocess operation,
  and motion effect must be produced through public APIs from
  `@viselora/dom-webgl`, `@viselora/dom-webgl/react`, or
  `@viselora/scroll-adapters`.
- App-owned effects created with `defineWebGLEffect(...)` or
  `defineWebGLSceneObjectEffect(...)` are allowed when they use only the
  package-managed effect context and public capability facades.
- Do not import React Three Fiber, package `src/` files, or private renderer,
  scene, camera, material, loader, or object handles. A direct `three` geometry
  constructor import is allowed only for a stable `WebGLMesh`
  `geometry: { kind: "custom", create }` descriptor whose factory returns a
  fresh `BufferGeometry`; runtime owns validation and disposal.

The CSS allowlist is intentionally narrow. New declarations should be limited
to properties such as `box-sizing`, `margin`, `width`, `height`, `min-height`,
`position`, `inset`, `display`, `isolation`, `z-index`, `overflow`,
`overflow-x`, and `pointer-events`. If a visual requirement cannot be expressed
without leaving that boundary, it is not a CSS task.

## Package Freeze And Capability Gaps

Do not modify anything under `packages/` while working on a `hero-next`
downstream effect unless the user separately authorizes package work.

When the current public package cannot express a required effect:

1. Stop before adding a workaround.
2. Report the missing capability with current source/type evidence.
3. Explain the visible limitation it causes in `hero-next`.
4. Describe the smallest general public capability that would unblock it.
5. Wait for explicit authorization before changing package code.

Never bypass a capability gap with CSS artwork, raw Three.js ownership, a private import,
DOM scanning, a second renderer, or an app-specific branch in runtime code.

Known current limits relevant to the studio hero:

- Mesh materials expose basic/standard color and PBR scalar properties, but
  no gradient, texture mask, stage material program, physical transmission,
  thickness, or index-of-refraction controls.
- Stage-plane effects do not currently expose a managed material facade.
- Managed light declarations do not expose cast/receive shadow configuration.
- `WebGLMesh` provides `plane`, `box`, `sphere`, `cylinder`, `cone`, and
  `tetrahedron` descriptors plus the controlled custom `BufferGeometry`
  factory; scene fog is not a public declaration.

Use the capabilities that exist—managed scenes, cameras, `WebGLMesh` geometry,
models, basic/standard materials, lights, transforms, timelines,
postprocessing, and app-owned public effects—and report the boundary when they
are insufficient.

## Current Implementation Truth

The previous CSS-owned studio artwork has been removed. The current hero uses
one managed scene, camera, render pass, canvas, and renderer for the background
Ghost Cursor, `WebGLMesh` tetrahedron, and managed lights. The foreground Ghost
Cursor layer has been removed, and the tetrahedron currently uses `radius: 0.52`.
The background effect applies responsive `1.06` world-scale overscan to cover the
transparent canvas under the tilted camera, and the pointer blob uses the compact
`0.24 + 0.14 / iScale` radius. Keep this treatment effect-owned; do not add a CSS
background fallback or CSS transform. The same background target effect owns the
scene-scoped `hero.pointer-light` through the managed lights facade; it uses a
stable key, damped target-local pointer mapping, exit intensity decay, a static
reduced-motion state, and managed removal on effect dispose. This is visually
isolated only because the tetrahedron is the current scene's sole lit material,
not because the runtime provides general per-target light isolation. The ambient
fill remains commented out; the directional key and rim lights are active with
positions `[1.2, 1.2, 2]` / `[1.8, -1.4, 2]` and intensities `4.8` / `2.2`.
The active point light uses `#a883ff`, target intensity `10`,
`distance: 1.8`, `decay: 3`, and camera-side `Z=1.1`; it remains omnidirectional,
not a managed spotlight.

The tetrahedron does not continuously self-rotate. Normal motion uses base
rotation `[-0.6, 0.82, 0.08]`, a six-second `±1.2%` breathing scale, an
eight-second `±0.018` Y float, and the existing damped pointer tilt. Reduced
motion is static at `[-0.6, 0.85, 0.08]`. Current material values are emissive
intensity `0.06`, opacity `0.92`, metalness `0.9`, and roughness `0.12`.
The opacity value is an alpha-transparency experiment, not physical light
transmission. User visual QA reports that the strongly lit metallic surface
looks white/milky rather than transparently refractive, so that treatment is
not accepted as the requested light-through-solid effect. Camera position is
`[0, 0, 3.2]` with target `[0, 0.32, 0]`.

Current verified design and completed execution record:

- `docs/superpowers/specs/2026-07-13-hero-next-ghost-cursor-depth-design.md`
- `docs/superpowers/specs/2026-07-14-hero-next-webglmesh-tetrahedron-design.md`
- `docs/archive/plans/superpowers/2026-07-13-hero-next-ghost-cursor-depth.md`

The earlier matte-studio documents and plans are historical evidence only and
must not be treated as active implementation guidance.

## Verification

Every `hero-next` visual change must verify:

```bash
npm test -- --run apps/hero-next/test
npm run typecheck -w @viselora/hero-next
npm run build -w @viselora/hero-next
npm run check:imports
git diff --check
```

Browser verification must use the real package runtime, `WebGLMesh`, and managed
canvas. Static markup or type success is not visual proof.
