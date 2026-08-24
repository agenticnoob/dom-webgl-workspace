# Hero Next

`@viselora/hero-next` is a private Next.js App Router consumer used to validate
the public Viselora packages in a production application shape.

The current experience is a one-chapter vertical slice: a complete tetrahedron
Hub enters one face, locks a projected chapter frame to screen space, expands a
triangular WebGL window into real semantic DOM, scrolls the chapter, then
reverses the composition back to the Hub. The same scroll coordinate resolves
the same visual state in either direction.

A real mesh hold remains the site-wide two-tone theme switch. It is enabled
only at a complete Hub, commits once after the radial transition covers the
viewport, and persists the committed scheme locally across refreshes.

## Run

From the repository root:

```bash
npm run dev -w @viselora/hero-next
```

Focused validation:

```bash
npm test -- --run apps/hero-next/test
npm run typecheck -w @viselora/hero-next
npm run build -w @viselora/hero-next
```

## Boundary

- Consume public Viselora entrypoints only.
- Keep one runtime and one canvas.
- CSS owns semantic DOM layout, accessible theme tokens, stacking, overflow,
  and pointer routing; it does not own the triangular transition window.
- WebGL geometry, face projection, triangular reveal, lighting, shader behavior,
  and motion belong to public package declarations and app-owned effects.
- Do not add raw Three.js ownership, a second renderer, private package imports,
  duplicate visual state, or a Hero-specific package branch.
- Keep runtime/effect declarations referentially stable.

## Source map

| Responsibility | Path |
| --- | --- |
| Page/runtime composition | `src/HeroExperience.tsx` |
| Static visual/transition config | `src/heroTransitionConfig.ts` |
| Hold state machine and radial geometry | `src/heroHoldTransition.ts` |
| Reversible chapter phase resolver | `src/heroChapterScroll.ts` |
| Camera-space chapter geometry | `src/heroChapterGeometry.ts` |
| Theme truth and persistence | `src/heroTheme.ts`, `src/heroExperienceState.ts` |
| Shared chapter content | `src/heroChapterContent.ts` |
| Shared responsive atlas/DOM layout | `src/heroChapterLayout.ts`, `src/heroChapterLayoutReact.ts` |
| Managed chapter texture atlas | `src/heroChapterAtlas.ts` |
| Shared progress signals | `src/heroTransitionSignals.ts` |
| Scene-object effect and motion | `src/heroEffect.ts` |
| Tetrahedron shader extension | `src/heroTetrahedronShader.ts` |
| Background effect/program | `src/heroGhostEffects.ts`, `src/heroGhostCursorProgram.ts` |
| Semantic chapter composition | `src/HeroChapterNarrative.tsx` |
| App constraints | `AGENTS.md` |
| Current visual direction | `docs/visual-design.md` |

## Current evidence boundary

Focused automation covers the scroll resolver, bidirectional mapping, theme
gate/persistence, projected lock UVs, shared atlas/DOM layout, shader
composition, and React runtime composition. Production Chromium evidence
covers the forward and reverse chapter path, handoff, Hub-only theme gate,
refresh persistence, single-canvas ownership, reduced motion, and desktop plus
390×844 mobile layouts. Element anchors are continuous across both handoffs;
Canvas and DOM glyph rasterization can still differ slightly. The visuals are
a recognizable prototype surface, not final chapter art or content acceptance.

Repository-wide release and capability truth remains in
[docs/STATUS.md](../../docs/STATUS.md).
