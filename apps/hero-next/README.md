# Hero Next

`@viselora/hero-next` is a private Next.js App Router consumer used to validate
the public Viselora packages in a production application shape.

The current experience is a pure-visual tetrahedron hero. A real mesh press
drives a reversible hold-based radial transition across the background and
tetrahedron through one app-owned effect state machine and shared progress
signals.

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
- CSS is limited to layout, sizing, stacking, overflow, pointer routing, and
  accessibility.
- WebGL geometry, color, lighting, shader behavior, and motion belong to public
  package declarations and app-owned effects.
- Do not add raw Three.js ownership, a second renderer, private package imports,
  duplicate visual state, or a Hero-specific package branch.
- Keep runtime/effect declarations referentially stable.

## Source map

| Responsibility | Path |
| --- | --- |
| Page/runtime composition | `src/HeroExperience.tsx` |
| Static visual/transition config | `src/heroTransitionConfig.ts` |
| Hold state machine and radial geometry | `src/heroHoldTransition.ts` |
| Shared progress signals | `src/heroTransitionSignals.ts` |
| Scene-object effect and motion | `src/heroEffect.ts` |
| Tetrahedron shader extension | `src/heroTetrahedronShader.ts` |
| Background effect/program | `src/heroGhostEffects.ts`, `src/heroGhostCursorProgram.ts` |
| App constraints | `AGENTS.md` |
| Current visual direction | `docs/visual-design.md` |

## Current evidence boundary

Focused automated tests and desktop production Chromium evidence cover the
implemented hold transition and managed lit-material shader path. Complete
mobile interaction acceptance remains open. The standard-material alpha
experiment was not accepted as a transparent/refractive treatment.

Repository-wide release and capability truth remains in
[docs/STATUS.md](../../docs/STATUS.md).
