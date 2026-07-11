---
name: viselora-dom-webgl
description: Use when building a new DOM-first scroll narrative, enhancing an existing React site with public Viselora APIs, selecting capabilities or interactions, planning local assets, debugging lifecycle or rendering failures, or verifying a Viselora consumer.
---

# Viselora Development

Compatible package version: 0.1.0-alpha.0

## Workflow

1. Establish audience, core message, outcome, tone, length, interaction density,
   available assets, accessibility, mobile, performance and reduced-motion
   constraints. Follow [narrative-design.md](references/narrative-design.md).
2. When direction is ambiguous, offer 2–3 materially different directions,
   recommend one, and pause only if the choice materially changes scope.
3. Define 4–8 story beats with semantic DOM/fallback, entrance/active/exit,
   scroll owner/range, at most one primary interaction, mobile/reduced motion,
   assets, capability/status and direct evidence. Copy
   [story-plan.md](templates/story-plan.md).
4. Inventory first; freeze production assets locally with provenance, license,
   metadata and fallback. Follow [asset-pipeline.md](references/asset-pipeline.md)
   and copy [asset-manifest.json](templates/asset-manifest.json).
5. Map each dynamic beat to the narrowest public API. Read
   [public-api.md](references/public-api.md) and
   [capability-status.md](references/capability-status.md). Use experimental
   paths only with acknowledgement; use blocked paths only for retained defect
   reproduction.
6. Implement with one page-level runtime/canvas, one scroll source, one pointer
   source, module-scope effect definitions/array, stable mounted declarations,
   semantic DOM and visible loading/error fallback. Follow
   [architecture-rules.md](references/architecture-rules.md).
7. Run the selected-capability verifier, strict typecheck and production build,
   then collect real-browser pixels/behavior and complete desktop/mobile/
   reduced-motion narrative review. Follow
   [verification.md](references/verification.md).

## Load only what the task needs

| Need | Reference |
| --- | --- |
| Install and start | [quickstart.md](references/quickstart.md) |
| Effects, targets, materials, textures, text, postprocess | [api-effects-rendering.md](references/api-effects-rendering.md) |
| Scenes, cameras, passes, stages, models | [api-scenes-models.md](references/api-scenes-models.md) |
| Scroll, progress, pointer, gestures, physics | [api-scroll-interaction.md](references/api-scroll-interaction.md) |
| Loading, fallback, debug selectors, disposal, SSR | [api-lifecycle-debug.md](references/api-lifecycle-debug.md) |
| Optional examples | [effect-recipes.md](references/effect-recipes.md) |
| Diagnose failures | [troubleshooting.md](references/troubleshooting.md) |
| Exhaustive exports | [api-surface.generated.md](references/api-surface.generated.md) |
| Maintainer value mapping | [api-coverage.json](references/api-coverage.json) |

## Hard boundaries

- Import only `@viselora/dom-webgl`, `@viselora/dom-webgl/react`,
  `@viselora/scroll-adapters`, and `@viselora/scroll-adapters/react`.
- Do not add R3F, `<Canvas>`, raw `WebGLRenderer`, a second renderer/runtime/
  canvas, a consumer render loop, private/source imports, or duplicate scroll/
  pointer listeners.
- Do not mutate mounted target declarations or construct runtime effect arrays
  during render.
- Do not hide semantic fallback while loading or after error.
- Do not hotlink production assets. Do not claim browser verification from the
  static verifier, skill tests, typecheck or build alone.
- Route ready/active-but-blank output to public-boundary reproduction; never
  introduce raw Three.js ownership as a workaround.
