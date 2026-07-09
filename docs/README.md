# Documentation Index

This directory is split into active documents and archived execution records.

## Start Here

- [STATUS.md](./STATUS.md) - current implementation truth and active direction.
- [roadmap/managed-render-system.md](./roadmap/managed-render-system.md) - next strategic roadmap for managed scenes, cameras, stages, passes, input, model animation, and physics.
- [00-goal.md](./00-goal.md) - long-form architecture principles and non-goals.

Current product boundary: this repo remains a DOM-first managed WebGL runtime,
not a React Three Fiber replacement and not an R3F companion runtime. If the
product direction changes to R3F as the rendering layer, start a separate
prototype and keep this repo's docs as the current managed-runtime truth.

## Consumer And Agent Docs

- [consumer-standard-usage.md](./consumer-standard-usage.md) - standard consumer usage guide.
- [agent/package-onboarding.md](./agent/package-onboarding.md) - single entrypoint for agents starting from zero.
- [agent/package-usage.md](./agent/package-usage.md) - detailed downstream package contract.
- [agent/effect-object-boundary.md](./agent/effect-object-boundary.md) - current `ctx.object` effect authoring boundary.
- [agent/custom-effects.md](./agent/custom-effects.md) - custom effect authoring guidance.
- [agent/scroll-adapters.md](./agent/scroll-adapters.md) - optional Lenis / GSAP / ScrollTrigger integration.
- [examples/effect-authoring.md](./examples/effect-authoring.md) - React-only consumer tutorial.
- [examples/third-party-scroll-adapters.md](./examples/third-party-scroll-adapters.md) - optional scroll adapter examples.

## Supporting Docs

- [performance/profile-notes.md](./performance/profile-notes.md) - current profiling notes and batching decision.
- [REVIEW_BACKLOG.md](./REVIEW_BACKLOG.md) - deferred review findings and follow-ups.
- [agent/effect-authoring-example-report.md](./agent/effect-authoring-example-report.md) - dogfood friction report.

## Archive

- [archive/](./archive/) contains completed implementation plans, historical execution state, and stale reference material.
- Archived files are evidence, not live roadmap or current API truth.
- New active implementation plans may temporarily live under [superpowers/plans/](./superpowers/plans/), then move to [archive/plans/](./archive/plans/) after completion.
