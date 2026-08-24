# Hero Next Agent Rules

These rules extend the repository [AGENTS.md](../../AGENTS.md) for
`apps/hero-next`.

Read [README.md](./README.md) and
[docs/visual-design.md](./docs/visual-design.md) before editing.

## Public-package boundary

- Import only public Viselora entrypoints.
- Do not import package source paths or runtime internals.
- Do not modify `packages/` to tune this app unless the user explicitly
  authorizes a reusable public capability change.
- Report a missing capability with the desired public declaration/facade,
  ownership, lifecycle, and verification contract before changing packages.
- Never add a Hero key, asset, branch, shader, layout, or copy rule to runtime
  source.

## Visual boundary

- CSS owns semantic DOM layout, accessible theme tokens, sizing, stacking,
  overflow, and pointer routing.
- WebGL owns the tetrahedron, face projection, triangular transition window,
  shader output, lighting, postprocess, and motion.
- Keep one runtime, one canvas, one scroll truth, and one committed theme truth.
- Do not create raw Three.js renderer/scene/camera/material/loader ownership.
- Do not add a second canvas, CSS mask/clip transition, duplicate mesh, DOM
  event bus, second theme store, or React frame state.
- Preserve the two semantic non-light color tokens unless the user explicitly
  approves a new visual direction.
- Key, rim, and pointer-light colors are lighting inputs, not semantic palette
  tokens.

## Declaration stability

- Keep runtime effects, scene declarations, smooth-scroll options, signal keys,
  and shader definitions referentially stable.
- High-frequency transition state stays in the scene-object effect and progress
  store, not React props/state.
- A real primary-pointer mesh hit is the interaction source; do not replace it
  with a page-level DOM press shortcut.
- Preserve reduced-motion content and transition semantics while removing
  unnecessary motion.

## Source ownership

| Concern | Owner |
| --- | --- |
| Constants and semantic palette | `src/heroTransitionConfig.ts` |
| Pure hold/radial state | `src/heroHoldTransition.ts` |
| Pure reversible scroll phases | `src/heroChapterScroll.ts` |
| Camera-space chapter geometry | `src/heroChapterGeometry.ts` |
| Committed theme and persistence | `src/heroTheme.ts`, `src/heroExperienceState.ts` |
| Shared chapter copy | `src/heroChapterContent.ts` |
| Responsive atlas/DOM layout | `src/heroChapterLayout.ts`, `src/heroChapterLayoutReact.ts` |
| Managed chapter texture atlas | `src/heroChapterAtlas.ts` |
| Progress encoding | `src/heroTransitionSignals.ts` |
| Mesh effect, material, motion | `src/heroEffect.ts` |
| Managed material extension | `src/heroTetrahedronShader.ts` |
| Background program/effect | `src/heroGhostCursorProgram.ts`, `src/heroGhostEffects.ts` |
| React composition and semantic DOM | `src/HeroExperience.tsx`, `src/HeroChapterNarrative.tsx` |
| Visual truth | `docs/visual-design.md` |

Do not duplicate constants or live state across these modules.

## Verification

```bash
npm test -- --run apps/hero-next/test
npm run typecheck -w @viselora/hero-next
npm run build -w @viselora/hero-next
git diff --check
```

When acceptance is visual, also verify the production app in a real browser and
report viewport, interaction path, console/page errors, canvas count, reduced
motion, and limitations. Automated checks are not subjective visual acceptance.

## Documentation

- Update `README.md` only when app purpose, run commands, boundaries, or source
  map changes.
- Update `docs/visual-design.md` only when current visual behavior,
  configuration, or visual evidence changes.
- Update this file only when agent execution constraints change.
- Put completed designs, plans, and investigations under the repository
  `docs/archive/`; do not link them as current truth.
