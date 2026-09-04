# Current Status

**Last verified: hero-next current source 2026-09-05; DOM-text rendering and registry release truth
2026-07-28.**

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

DOM-text snapshot canvases preserve the source element's measured CSS-pixel
box while rasterizing at up to `2×` device pixel ratio. Their runtime-owned
textures use sRGB color space, linear sampling, and no mipmaps so high-DPI text
stays sharper without changing semantic DOM layout or public API ownership.

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

The private Next.js consumer uses public managed scene, mesh, model, effect,
shader, lighting, render-quality, and scroll APIs. It implements four reversible
chapters across the tetrahedron's four faces, localized Chinese/English atlas
and semantic content, a progressively screen-locked reveal whose rotation and
centering finish at the DOM handoff, body-only chapter DOM with signal-only
entry/exit runways, unique transition-side information, one body-derived face
atlas per chapter with separately packed lead and real-content tail tiles,
shared responsive Atlas/DOM lead geometry that prevents full-screen handoff
reflow, continuous
approach-weighted UV lock, project/public links,
and one terminal contact Portal preselected under the fourth chapter's covered
exit and retained through the final Hub. The final DOM runway owns only semantic
content and interactive public links, so the terminal title and summary are not
rendered twice. It preserves the established single tetrahedron scene and
foreground/background composition. Stronger damped pointer parallax and an
app-owned Fresnel edge light increase depth without adding a ground plane,
shadow map, outline mesh, duplicate tetrahedron, or render pass; the edge light
fades at full screen lock. Chapter one mounts an optimized scene-native personal
GLB inside that same scene and pass. It begins as a shallow relief on the first
tetrahedron face, expands continuously into a fixed center position, returns to
the face on exit, and remains part of that face whenever the tetrahedron is
visible. The body progress starts after the DOM handoff and reaches its endpoint
exactly where the exit return begins, mapping the centered model to exactly one
clockwise turn while the tetrahedron approach and retreat add no model-local
spin. Profile copy stays in explicit left/right columns gathered around the
center; each rendered line
resolves an independent outward displacement against the combined responsive
model and speech-bubble exclusions. A rounded-rectangle manga bubble with a
background-color fill and foreground-color text stays fixed above the model's
head while front, side, and back messages type in, hold, and delete one
character at a time from the same reversible one-turn body progress.
Pointer-light intensity is reduced inside chapters. The hold-driven
radial theme switch remains Hub-only, while theme and locale each persist one
committed truth locally. The profile material keeps the same light-neutral base
color across both schemes, so a committed theme change does not multiply the GLB
albedo by the darker page background.

Focused automation currently covers 25 hero-next test files / 151 tests. Current
desktop, mobile, interaction, and LAN-origin browser evidence is
owned by the app's [visual direction](../apps/hero-next/docs/visual-design.md).
The bilingual profile is a literary base version grounded in stable biography
and remains open to editorial refinement. No package-specific Hero branch, raw
Three ownership, second scene, second runtime, or second canvas was added.

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
