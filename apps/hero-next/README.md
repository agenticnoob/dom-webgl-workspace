# Hero Next

`@viselora/hero-next` is a private Next.js App Router consumer used to validate
the public Viselora packages in a production application shape.

The current experience is a four-chapter personal narrative. Each chapter owns
one tetrahedron face, unique transition-side information, a screen-locked
triangular reveal, real semantic DOM content, and a reversible exit back to a
complete Hub. The chapters cover self, AI/philosophy axioms, public builds, and
products/public signals. A final Hub exposes confirmed GitHub and blog links.
The same scroll coordinate resolves the same visual state in either direction.

Chinese and English copy share one typed content model and one persisted locale
store. The current implementation deliberately keeps the established single
tetrahedron scene and foreground/background composition unchanged. A personal
GLB remains a later content asset and is not mounted through an extra render
pass in this baseline.

A real mesh hold remains the site-wide two-tone theme switch. It is enabled
only at a complete Hub, commits once after the radial transition covers the
viewport, and persists the committed scheme locally across refreshes.

## Run

From the repository root:

```bash
npm run dev -w @viselora/hero-next
```

The development allowlist currently includes `192.168.50.5`, so devices on the
same LAN can load `http://192.168.50.5:3000/` and establish the Next.js HMR
WebSocket. If the host address changes, update `allowedDevOrigins` in
`next.config.ts` and restart the development server.

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
| Page/runtime composition and subscriptions | `src/experience/` |
| Chapter identity, signals, face, and atlas mapping | `src/chapters/definitions.ts` |
| Chapter content, semantic composition, and locale control | `src/chapters/content.ts`, `src/chapters/HeroChapterNarrative.tsx`, `src/chapters/HeroChapter.tsx`, `src/chapters/HeroLocaleControl.tsx` |
| Reversible scroll, geometry, layout, and atlas | `src/chapters/scrollState.ts`, `src/chapters/geometry.ts`, `src/chapters/layout.ts`, `src/chapters/atlas.ts` |
| Theme and locale persistence | `src/preferences/` |
| Hold state, palette/config, and progress encoding | `src/transition/` |
| Tetrahedron effect and managed shader | `src/tetrahedron/` |
| Background, cursor, and pointer-light effects | `src/ghost/` |
| Shared viewport boundary | `src/shared/viewport.ts` |
| App constraints | `AGENTS.md` |
| Current visual direction | `docs/visual-design.md` |

## Current evidence boundary

Focused automation currently covers 20 hero-next test files / 102 tests,
including four-chapter selection, bidirectional mapping, locale/theme
persistence, four target faces, projected lock UVs, localized atlas/DOM layout,
shader behavior, and one-runtime/one-scene/one-canvas ownership. Local Chromium
verification at 1280×720 covered the initial and between-chapter complete
tetrahedron, chapter-one and chapter-two face transitions, chapter-one DOM
handoff, the final Hub, and an empty error/warning console. Responsive rules are
automated, but mobile visual acceptance was not repeated in the current pass. A
separate LAN-origin check confirmed the HMR WebSocket upgrade, one WebGL canvas,
the initial tetrahedron, and an empty error/warning console. Canvas and DOM glyph
rasterization can still differ slightly, and all content remains a base version
intended for subsequent editorial adjustment.

Repository-wide release and capability truth remains in
[docs/STATUS.md](../../docs/STATUS.md).
