# Documentation Index

This directory is split into active documents and archived execution records.

## Start Here

- [project-release-validation.md](./project-release-validation.md) - alpha release decision, validation boundary, and publication gate.
- [STATUS.md](./STATUS.md) - current implementation and release-validation truth.
- [roadmap/managed-render-system.md](./roadmap/managed-render-system.md) - completed capability roadmap reference.
- [00-goal.md](./00-goal.md) - long-form architecture principles and non-goals.

Current product boundary: Viselora is capability-stable; the lockstep alpha.1
packages are public, and the agent skill and package release gates remain the
upstream validation surfaces. Independent consumer implementation and browser
acceptance are owned by their downstream repositories. This is active release
engineering, not a conclusion that the project must migrate to another
renderer.

## App Workspaces

- [`apps/example`](../apps/example/) - React-only public API dogfood and effect-authoring tutorial.
- [`apps/hero-next`](../apps/hero-next/) - private Next.js App Router consumer with a neutral grayscale background Ghost Cursor, dark-silver managed `WebGLMesh` tetrahedron, two fixed directional lights, an effect-owned pointer light, and app-owned breathing/floating/pointer-parallax motion without continuous self-rotation; the latest `opacity: 0.92` alpha experiment is automated-verified, but user visual QA found a white/milky metallic result rather than physical transmission.

## New Project Notes

- [new-project/example-page-background.md](./new-project/example-page-background.md) - background for a later independent Viselora package-and-skill consumer.
- [new-project/example-page-mvp.md](./new-project/example-page-mvp.md) - later independent MVP target and acceptance criteria; it is not created here.

## Consumer And Agent Docs

- [../skills/viselora-dom-webgl/SKILL.md](../skills/viselora-dom-webgl/SKILL.md) - general brief-to-browser development skill.
- [superpowers/specs/2026-07-11-viselora-general-development-skill-design.md](./superpowers/specs/2026-07-11-viselora-general-development-skill-design.md) - approved general-skill design.
- [superpowers/plans/2026-07-11-viselora-general-development-skill.md](./superpowers/plans/2026-07-11-viselora-general-development-skill.md) - implementation plan and verification boundary.
- [superpowers/specs/2026-07-13-hero-next-ghost-cursor-depth-design.md](./superpowers/specs/2026-07-13-hero-next-ghost-cursor-depth-design.md) - implemented and browser-verified single-scene Ghost Cursor tetrahedron hero design.
- [superpowers/specs/2026-07-14-hero-next-webglmesh-tetrahedron-design.md](./superpowers/specs/2026-07-14-hero-next-webglmesh-tetrahedron-design.md) - current hero truth for the public `WebGLMesh` tetrahedron, material/camera/motion tuning, two active directional lights, effect-owned pointer light, and the user-rejected alpha-transparency experiment.
- [archive/plans/superpowers/2026-07-13-hero-next-ghost-cursor-depth.md](./archive/plans/superpowers/2026-07-13-hero-next-ghost-cursor-depth.md) - completed task-by-task implementation and browser acceptance record.
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
