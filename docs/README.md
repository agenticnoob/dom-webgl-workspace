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
- [`apps/hero-next`](../apps/hero-next/) - private Next.js App Router consumer with a strict `#B8B8B8` / `#5F5F5F` semantic palette and a reversible hold-driven radial toggle. A real primary-pointer `WebGLMesh` hit drives one pure effect-owned state machine; six shared progress signals drive the aspect-correct background, Ghost Cursor, and tetrahedron transition. The tetrahedron remains on the runtime-owned `MeshStandardMaterial` and uses the controlled `material.shader` facade to mix committed/target color and emissive per fragment before lighting. All three visual layers share the same screen-space origin, radius, and `1.5px` feather; early release, re-press resume, far-corner commit, release gate, reverse toggle, and reduced-motion color diffusion reuse the same state. The app keeps its public scroll runtime, future Lenis/GSAP/ScrollTrigger capability, managed lights and motion, one canvas, and opt-in antialiasing at maximum DPR `2`; no raw Three ownership or Hero-specific package branch is exposed.

## New Project Notes

- [new-project/example-page-background.md](./new-project/example-page-background.md) - background for a later independent Viselora package-and-skill consumer.
- [new-project/example-page-mvp.md](./new-project/example-page-mvp.md) - later independent MVP target and acceptance criteria; it is not created here.

## Consumer And Agent Docs

- [../skills/viselora-dom-webgl/SKILL.md](../skills/viselora-dom-webgl/SKILL.md) - general brief-to-browser development skill.
- [superpowers/specs/2026-07-11-viselora-general-development-skill-design.md](./superpowers/specs/2026-07-11-viselora-general-development-skill-design.md) - approved general-skill design.
- [superpowers/plans/2026-07-11-viselora-general-development-skill.md](./superpowers/plans/2026-07-11-viselora-general-development-skill.md) - implementation plan and verification boundary.
- [superpowers/specs/2026-07-13-hero-next-ghost-cursor-depth-design.md](./superpowers/specs/2026-07-13-hero-next-ghost-cursor-depth-design.md) - implemented and browser-verified single-scene Ghost Cursor tetrahedron hero design.
- [superpowers/specs/2026-07-14-hero-next-webglmesh-tetrahedron-design.md](./superpowers/specs/2026-07-14-hero-next-webglmesh-tetrahedron-design.md) - current hero truth for the public `WebGLMesh` tetrahedron, material/camera/motion tuning, two active directional lights, effect-owned pointer light, and the user-rejected alpha-transparency experiment.
- [../apps/hero-next/VISUAL_DESIGN.md](../apps/hero-next/VISUAL_DESIGN.md) - implemented two-tone semantic palette, reversible hold-driven radial transition, reduced-motion behavior, and current browser/automated verification truth.
- [superpowers/specs/2026-07-16-hero-next-hold-radial-transition-design.md](./superpowers/specs/2026-07-16-hero-next-hold-radial-transition-design.md) - approved hold-driven radial interaction and visual design truth.
- [superpowers/plans/2026-07-16-hero-next-hold-radial-transition.md](./superpowers/plans/2026-07-16-hero-next-hold-radial-transition.md) - detailed Task 1–9 TDD implementation and verification plan for the hold-driven radial transition.
- [superpowers/specs/2026-07-17-managed-lit-material-shader-extension-design.md](./superpowers/specs/2026-07-17-managed-lit-material-shader-extension-design.md) - implemented managed Basic/Standard/Physical shader-extension design and Hero Standard-material radial diffusion contract.
- [superpowers/plans/2026-07-17-managed-lit-material-shader-extension.md](./superpowers/plans/2026-07-17-managed-lit-material-shader-extension.md) - completed Task 1–8 TDD implementation, real-runtime integration, packed-consumer, documentation, and browser-verification plan.
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
