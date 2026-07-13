# Hero Next Agent Rules

This file is required reading before editing any file under `apps/hero-next/`.
Its rules apply to the entire `apps/hero-next` subtree.

## Hard Visual Boundary

`hero-next` is a strict downstream dogfood consumer of the current public
Viselora packages.

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
- Do not import `three`, React Three Fiber, package `src/` files, or private
  renderer, scene, camera, material, loader, or object handles.

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

Never bypass a capability gap with CSS artwork, raw Three.js, a private import,
DOM scanning, a second renderer, or an app-specific branch in runtime code.

Known current limits relevant to the studio hero:

- Stage materials expose basic/standard color and PBR scalar properties, but
  no gradient, texture mask, or stage material program.
- Stage-plane effects do not currently expose a managed material facade.
- Managed light declarations do not expose cast/receive shadow configuration.
- Managed stage geometry is limited to planes and boxes; scene fog is not a
  public declaration.

Use the capabilities that exist—managed scenes, cameras, planes, boxes,
models, basic/standard materials, lights, transforms, timelines,
postprocessing, and app-owned public effects—and report the boundary when they
are insufficient.

## Current Implementation Truth

The previous CSS-owned studio artwork has been removed. The current hero uses
one managed scene, camera, render pass, canvas, and renderer for the background
Ghost Cursor, GLB tetrahedron, foreground Ghost Cursor, and managed lights.
The two Ghost Cursor effects apply responsive `1.06` world-scale overscan to
cover the transparent canvas under the tilted camera, and the pointer blob uses
the compact `0.24 + 0.14 / iScale` radius. Keep both treatments effect-owned;
do not add a CSS background fallback or CSS transform.

Current verified design and completed execution record:

- `docs/superpowers/specs/2026-07-13-hero-next-ghost-cursor-depth-design.md`
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

Browser verification must use the real package runtime, GLB, Draco decoder,
and managed canvas. Static markup or type success is not visual proof.
