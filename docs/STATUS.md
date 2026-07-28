# Current Status

**Last verified: 2026-07-28 against source, package metadata, and npm dist-tags.**

This is the only repository-wide current-state document. Detailed app behavior
belongs to each app; completed plans and prior evidence belong in
[archive/](./archive/).

## Project state

Viselora is a capability-stable prerelease. Upstream work is focused on package
hardening, documentation, consumer evidence, and defect correction rather than
unbounded feature expansion.

The runtime remains DOM-first and managed:

- one runtime owns one transparent canvas and render loop;
- DOM content remains the layout, fallback, and accessibility anchor;
- applications use declarations and controlled effect facades;
- the runtime owns rendering, resources, input, scheduling, and disposal;
- raw Three.js ownership and React Three Fiber integration are out of scope.

## Release truth

The repository package versions are:

- `@viselora/dom-webgl@0.1.0-alpha.1`
- `@viselora/scroll-adapters@0.1.0-alpha.1`

The adapters depend exactly on the matching core version. npm registry readback
on 2026-07-28 confirmed that both `alpha` dist-tags resolve to
`0.1.0-alpha.1`; both default `latest` tags still resolve to
`0.1.0-alpha.0`. Consumers should install `@alpha` or pin alpha.1 explicitly.

Alpha.1 fixes the alpha.0 cross-entrypoint scene-object effect registry defect:
effects defined from the root entrypoint can attach through the React
entrypoint. The published alpha.1 release previously passed the installed-
tarball Chromium gate. Independent consumer implementation and acceptance
remain downstream responsibilities.

## Implemented runtime surface

The public runtime currently supports:

- DOM element/text, image, video, image-sequence, and GLB target sources;
- runtime-owned fallback, loading/error, offscreen, resource-cache, and dispose
  behavior;
- target effects through `defineWebGLEffect(...)`;
- opt-in managed scenes, cameras, render passes, pass viewports, lights,
  procedural meshes, and scene-native GLB models;
- scene-object effects through `defineWebGLSceneObjectEffect(...)`;
- managed model animation/morph controls, picking, camera gestures, and a
  bounded descriptor-only physics slice;
- native scroll, scene gates, named progress signals, and optional
  Lenis/GSAP/ScrollTrigger adapters;
- target and scene-object pointer state without exposing raycasters or raw
  intersections;
- runtime/pass-scoped postprocess requests;
- basic, standard, and physical managed mesh materials;
- controlled lit-material shader extensions and material property updates;
- opt-in render quality controls for antialiasing and device-pixel-ratio caps;
- descriptor-only debug state for targets, scenes, resources, interaction,
  animation, physics, and performance budgets.

The generated public value/type inventory is
[api-surface.generated.md](../skills/viselora-dom-webgl/references/api-surface.generated.md).
Capability maturity is tracked separately in
[capability-status.md](../skills/viselora-dom-webgl/references/capability-status.md);
an exported symbol is not automatically browser-verified.

## Workspace applications

### `apps/example`

The Vite/React example is the primary public-API dogfood surface. It must import
only package entrypoints and exercises DOM targets, media, models, effects,
managed scenes, timelines, interaction, postprocess, and physics. It is an
example consumer, not a place for runtime-specific branches.

See [apps/example/README.md](../apps/example/README.md).

### `apps/hero-next`

The private Next.js consumer uses public managed scene, mesh, effect, shader,
lighting, render-quality, and scroll APIs. Its current visual behavior is a
two-tone, reversible hold-driven radial transition across the background and
tetrahedron, with app-owned state and no package-specific Hero branch.

Automated and desktop Chromium evidence exists for the implemented transition
and managed lit-material shader path. The earlier 390×844 browser evidence
covers the initial frame only; complete mobile interaction acceptance remains
unverified. The standard-material alpha experiment was visually rejected as a
white/milky treatment; physical-material parameters have not been selected or
accepted for the Hero.

See [apps/hero-next/README.md](../apps/hero-next/README.md) and its
[visual direction](../apps/hero-next/docs/visual-design.md).

## Verification truth

Repository automation covers:

- TypeScript strict checking;
- Vitest unit, integration, public-boundary, structure, documentation, and
  package tests;
- workspace production builds;
- example public-import enforcement;
- version and tarball validation;
- external consumer SSR/type/build/browser checks;
- generated skill API and selected-capability checks.

Use the normal repository sequence for development:

```bash
npm run test -- --run
npm run typecheck
npm run build
npm run check:imports
npm run check:docs
git diff --check
```

`npm run verify:release` is the wider publication-oriented gate. Passing
automation does not by itself prove subjective visual quality, complete mobile
interaction, or downstream product acceptance.

## Known boundaries

- Public APIs are prerelease and may still need contract corrections before
  stable.
- Advanced capabilities have mixed evidence levels; consult the capability
  matrix before recommending them.
- DOM fallback must remain usable during loading/error and when an offscreen
  policy restores DOM.
- Postprocess is runtime/pass scoped, not target/model scoped.
- Scene-native model/mesh APIs do not gain DOM fallback semantics
  automatically.
- Physics is a small managed descriptor slice, not a general rigid-body engine.
- No raw renderer, scene, camera, material, loader, mixer, raycaster, render
  target, scheduler, or disposal escape hatch is public.
- Build output, browser sessions, screenshots, and temporary evidence are local
  artifacts and must not be committed.

## Current focus

1. Keep package, generated API, skill, and documentation truth aligned.
2. Fix defects through public, reusable contracts rather than app branches.
3. Expand external/browser evidence per capability without overstating it.
4. Keep repository documentation small; archive completed work immediately.

Future work must start from current source and tests. Historical roadmaps and
plans under `docs/archive/` are evidence, not an active backlog.
