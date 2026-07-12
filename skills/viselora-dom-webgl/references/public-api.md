# Public API Navigation

Compatible package version: 0.1.0-alpha.1

Use only four published entrypoints:

| Entrypoint | Route |
| --- | --- |
| `@viselora/dom-webgl` | Runtime creation, effect definitions, public declarations and types → [effects/rendering](api-effects-rendering.md) |
| `@viselora/dom-webgl/react` | Runtime/target, scene, camera, stage, model and debug React values → [effects/rendering](api-effects-rendering.md), [scenes/models](api-scenes-models.md), [lifecycle/debug](api-lifecycle-debug.md) |
| `@viselora/scroll-adapters` | Lenis, GSAP, ScrollTrigger and progress-store glue → [scroll/interaction](api-scroll-interaction.md) |
| `@viselora/scroll-adapters/react` | Scroll runtime, timelines, sections and progress hook → [scroll/interaction](api-scroll-interaction.md) |

Read [capability-status.md](capability-status.md) before recommending an API.
Status belongs to a capability and package version, not to an entire entrypoint.
An exported symbol can exist while its visible-output path is experimental or
blocked.

Search [api-surface.generated.md](api-surface.generated.md) for the exhaustive
value/type inventory generated from the four published declarations. It is
discovery data, not recommendation evidence. Human guidance and ownership rules
live in the capability references above.

Never import package source paths, private subpaths, workspace aliases, example
implementation files, raw Three.js ownership, or R3F.
