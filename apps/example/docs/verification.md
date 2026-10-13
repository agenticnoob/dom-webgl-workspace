# Example verification

This document owns the example app's verification evidence and limitations.
Use the [component catalog](../src/recipes/README.md) for integration contracts
and [repository status](../../../docs/STATUS.md) for repository-wide gate status.

## Automated checks

All Example tests passed in the repository suite on 2026-10-14, covering
native scenes, DOM, pure math and SSR. The app-specific and repository TypeScript
checks passed. The app configuration clears source aliases so this consumer
checks public package declarations.

Coverage includes:

- One shared Canvas, 22 basic visual bindings, five native scene demonstrations,
  nine recipes, unique DOM IDs and semantic server-rendered fallback.
- Reversible glyph, sequence, scroll, camera, portal and timeline calculations.
- Actual Three.js object animation and picking, texture UV cropping, video
  playback rejection, offscreen parking, and shared GLTF resource ownership.
- The sequence decoder loads 454 unique frames with at most six concurrent
  decodes and shares one load. Ordinary images and GLBs use Drei's caches;
  the app no longer separately warms those assets or creates a metadata video.
- Text texture rebuilds after same-size content/style revisions. Decorative DOM
  backgrounds and recipe transcripts return when the Runtime becomes unavailable;
  prepared scenes remain mounted and resume after recovery.
- Paper atlas replacement on DOM-only viewport resizing; independent instances;
  texture/material disposal. Project-room picking, edge rearming, narrow fallback,
  viewport uniforms, preference listeners and atlas disposal.
- Native animation-mixer sampling, Rapier world/body behavior, scroll-controller
  cleanup, reduced-motion changes, bounded timeline windows and complete text.

From the repository root:

```bash
npm test -- --run apps/example/test
npx tsc -p apps/example/tsconfig.json
npm run build -w @viselora/example
npm run check:imports
npm run check:docs
```

Native-scene tests use `@react-three/test-renderer` and actual Three.js scene
objects. The test renderer supplies a mocked GPU context; these tests establish
state and lifecycle behavior, not final shader pixels.

## Browser evidence

The migration's desktop Chromium review at 1780×833 confirmed one shared Canvas
without page/console errors in the sampled states. Inspected output includes the native
postprocessing stage, real GLTF animation, timeline camera and card, picking and
physics scenes, paper-reader ink pages and project-room walls. The project-room
Next wall control changed both the visible project and its source link. An actual
long press on the radial-theme mesh committed the dark theme. The first surface's
horizontal texture streaks come from the supplied `bg.png` asset.

OrbitControls changed the camera after a mouse drag. A Rapier box was dragged
into the air, then rotated, fell and collided after release without scrolling
the page. ModelStory rendered the actual model and captions. FacePortal's full
reading control exposed its DOM content; ReliefPortal showed the model and its
surface. PointerPreview displayed the supplied image on hover. PerspectiveTimeline
rendered perspective text and its mesh, and switched to complete reading mode.

Lit scenes explicitly retain the old renderer's default ambient and directional
lights alongside each demo's authored lights. The Runtime no longer adds lights.

After the final source freeze, the basic CanvasTexture Chinese text, the
454-frame sequence's initial image and card, and the native composer's bloom and
geometry were visible. All nine recipes were inspected in the same application.

Real `WEBGL_lose_context` and `restoreContext` calls changed Runtime readiness
from true to false and back. The room's four semantic links became visible and
focusable during the loss. Recovery retained one Canvas without page/console
errors.

Mobile emulation at 390×844 and live reduced-motion changes retained the room's
complete fallback list and all six timeline entries. The document's scroll width
remained 390 pixels, and the page still used one Canvas.

## Limits

- Browser emulation does not establish physical mobile-device behavior.
- Visual review verifies the observed composition and interactions; it is not a
  pixel-for-pixel comparison or a performance benchmark.
- The application retains its existing large-bundle build warning.
- React Doctor's broader release scan and review are recorded in
  [repository verification](../../../docs/STATUS.md#verification-truth).
  Example retains advice about ordered text index keys, shader math and
  low-frequency scheme callbacks. Reviewed effect cleanup and client-only R3F
  initialization are covered by runtime/SSR checks; no clean lint score is claimed.
- Recipes measure native document scroll. Transformed scroll systems or nested
  scrollers require their own integration and browser verification.
- These checks cover the supplied assets and content. Other GLBs, text lengths,
  languages, GPU limits and downstream compositions need consumer verification.
