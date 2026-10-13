---
name: viselora-dom-webgl
description: Build or migrate a React or Next.js DOM-first visual experience using Viselora for DOM/progress/fallback coordination and React Three Fiber with native Three.js objects for rendering.
---

# Viselora React/R3F Development

Compatible package version: 0.2.0-alpha.0

This skill targets the breaking React/R3F 0.2 alpha API. Install matching package
versions from the `alpha` channel or use reviewed local tarballs. The 0.1.x
packages implement a different API. Check the repository
[release status](../../docs/STATUS.md#release-truth) for registry confirmation.

## Workflow

1. Read the consumer's actual scene, DOM and assets before changing ownership.
   Preserve its visual behavior, semantics and existing authorization scope.
2. Keep one `WebGLRuntime`/`WebGLScrollRuntime` host. Put ordinary R3F components
   in `scene`, semantic HTML in `children`, and use public Viselora entrypoints.
3. Use `WebGLTarget` and `useDOMTarget` for measured DOM anchors. Use native
   Three.js refs, materials, loaders and R3F hooks for visual behavior.
4. Keep fallback paint until the replacement visual is ready. Scope async
   readiness to the captured target. Choose resource retention explicitly.
5. Verify focused behavior, types and builds, then compare actual browser
   pixels, forward/reverse scroll, resize, input and remount behavior.

## Load only what the task needs

| Need | Reference |
| --- | --- |
| Start a consumer or use the runnable template | [quickstart.md](references/quickstart.md) |
| API navigation | [public-api.md](references/public-api.md) |
| Native effects and DOM text | [api-effects-rendering.md](references/api-effects-rendering.md) |
| Native scene and model ownership | [api-scenes-models.md](references/api-scenes-models.md) |
| Scroll progress and interaction | [api-scroll-interaction.md](references/api-scroll-interaction.md) |
| Fallback, SSR and cleanup | [api-lifecycle-debug.md](references/api-lifecycle-debug.md) |
| Ownership constraints | [architecture-rules.md](references/architecture-rules.md) |
| Optional narrative planning | [narrative-design.md](references/narrative-design.md) |
| Asset provenance | [asset-pipeline.md](references/asset-pipeline.md) |
| Native visual recipes | [effect-recipes.md](references/effect-recipes.md) |
| Failures | [troubleshooting.md](references/troubleshooting.md) |
| Verification scope | [verification.md](references/verification.md) |
| Automated capability evidence | [capability-status.md](references/capability-status.md) |
| Exhaustive exports | [api-surface.generated.md](references/api-surface.generated.md) |
| Maintainer coverage map | [api-coverage.json](references/api-coverage.json) |

## Boundaries

- React 19, R3F 9 and Three.js 0.184 are the supported stack.
- Native Three.js ownership and R3F JSX/hooks are the normal visual API.
- Do not add a second Canvas/WebGLRenderer or custom renderer RAF loop.
- Do not import private Viselora source or rebuild a scene/material/effect facade.
- Read live rect/progress in `useFrame`; R3F delta is in seconds.
- `hideWhenReady` defaults to false. Paint hiding uses opacity on registered
  leaves; a target containing another target remains visible.
- Shared cached assets and external primitives require deliberate disposal.
- Static checks do not establish browser visual correctness or publication.
