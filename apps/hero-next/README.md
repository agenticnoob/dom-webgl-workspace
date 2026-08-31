# Hero Next

`@viselora/hero-next` is a private Next.js App Router consumer used to validate
the public Viselora packages in a production application shape.

The current experience is a four-chapter personal narrative. The opening Hub
first presents site-level context beside the breathing tetrahedron, then hands
those two side columns to chapter one before spatial flight begins. Each chapter
owns one tetrahedron face, unique transition-side information, a progressively
screen-locked triangular reveal whose rotation and centering finish at the DOM
handoff, distinct entry/exit Frame content, real semantic DOM content, and a
reversible exit that preselects the following portal content under full cover.
The chapters cover self, AI/philosophy axioms, public builds, and
products/public signals. The fourth exit preselects terminal contact copy
instead of repeating chapter four, then retains that same terminal Portal as
the final Hub title and summary. The final runway adds confirmed GitHub and
blog links without replaying a duplicate
visual block. The same scroll coordinate resolves the same visual state in
either direction.

Completed exit Frames remain on their tetrahedron faces while later chapters
begin, and face-space UV lock advances continuously with the approach instead
of switching at chapter boundaries. The Hub keeps its no-spin breathing and
floating motion with stronger damped pointer parallax. Its single managed
material combines existing directional lighting with an app-owned Fresnel edge
light and reduced flat/emissive fill for clearer depth; the edge light fades as
the target face reaches full screen lock. No ground plane, shadow map, outline
mesh, duplicate tetrahedron, or additional render pass is used.

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

Use the Network URL printed by Next.js to open the app from another device. The
development allowlist intentionally accepts any dotted hostname or IPv4 origin,
so DHCP address changes do not require a configuration edit and the HMR
WebSocket remains available. This applies only to `next dev`; use it only on a
trusted network and never expose the development port to the public internet.

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

| Responsibility                                                  | Path                                                                                                                                     |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Page/runtime composition and subscriptions                      | `src/experience/`                                                                                                                        |
| Chapter identity, signals, face, and atlas mapping              | `src/chapters/definitions.ts`                                                                                                            |
| Chapter content, semantic composition, and locale control       | `src/chapters/content.ts`, `src/chapters/HeroChapterNarrative.tsx`, `src/chapters/HeroChapter.tsx`, `src/chapters/HeroLocaleControl.tsx` |
| Reversible scroll, geometry, layout, and atlas                  | `src/chapters/scrollState.ts`, `src/chapters/geometry.ts`, `src/chapters/layout.ts`, `src/chapters/atlas.ts`                             |
| Theme and locale persistence                                    | `src/preferences/`                                                                                                                       |
| Hold/radial/portal state, palette/config, and progress encoding | `src/transition/`                                                                                                                        |
| Tetrahedron effect and managed shader                           | `src/tetrahedron/`                                                                                                                       |
| Background, cursor, and pointer-light effects                   | `src/ghost/`                                                                                                                             |
| Shared viewport boundary                                        | `src/shared/viewport.ts`                                                                                                                 |
| App constraints                                                 | `AGENTS.md`                                                                                                                              |
| Current visual direction                                        | `docs/visual-design.md`                                                                                                                  |

## Current evidence boundary

Focused automation currently covers 22 hero-next test files / 115 tests,
including four-chapter selection, bidirectional mapping, locale/theme
persistence, site-to-chapter copy handoff, next-content and terminal-contact
preselection, four target faces, progressive screen lock, continuous
approach-weighted lock UVs, persistent completed-exit atlas tiles, stronger
damped pointer parallax, Fresnel depth lighting,
localized atlas/DOM layout including the `320×568` card bound, shader behavior,
and one-runtime/one-scene/one-canvas ownership. Current desktop, mobile,
interaction, and LAN-origin browser evidence is owned by
[the visual direction](./docs/visual-design.md). Canvas and DOM glyph
rasterization can still differ slightly, and all content remains a base version
intended for subsequent editorial adjustment.

Repository-wide release and capability truth remains in
[docs/STATUS.md](../../docs/STATUS.md).
