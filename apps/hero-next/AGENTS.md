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
- Report a missing DOM/runtime management capability with the desired public API,
  ownership, lifecycle, and verification contract before changing packages.
- Never add a Hero key, asset, branch, shader, layout, or copy rule to runtime
  source.

## Visual boundary

- CSS owns semantic DOM layout, accessible theme tokens, sizing, stacking,
  overflow, and pointer routing.
- WebGL owns the tetrahedron, face projection, triangular transition window,
  shader output, lighting, postprocess, and motion.
- Keep one runtime, one canvas, one scroll truth, and one committed theme truth.
- R3F owns the canvas, renderer and frame loop. App components use native Three.js
  geometry, materials, lights, loaders and object refs inside the shared scene.
- Dispose app-created textures/materials; do not dispose shared useGLTF cache assets.
- Do not add a second canvas, CSS mask/clip transition, duplicate mesh, DOM
  event bus, second theme store, or React frame state.
- Preserve the two semantic non-light color tokens unless the user explicitly
  approves a new visual direction.
- Key, rim, and pointer-light colors are lighting inputs, not semantic palette
  tokens.

## Declaration stability

- Keep Canvas options, smooth-scroll options, signal keys, shader programs and
  app stores stable. Use `useFrame` to mutate native object refs.
- High-frequency transition state stays in native object refs and the progress
  store, not React props/state.
- A real primary-pointer mesh hit is the interaction source; do not replace it
  with a page-level DOM press shortcut.
- Preserve reduced-motion content and transition semantics while removing
  unnecessary motion.

## Source ownership

| Concern                                                                         | Owner                                                                                                                                    |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Runtime composition and React subscriptions                                     | `src/experience/`                                                                                                                        |
| Chapter identity, order, signals, faces, and atlas slots                        | `src/chapters/definitions.ts`                                                                                                            |
| Pure reversible scroll phases and geometry                                      | `src/chapters/scrollState.ts`, `src/chapters/geometry.ts`                                                                                |
| Chapter content, semantic DOM, and locale control                               | `src/chapters/content.ts`, `src/chapters/HeroChapterNarrative.tsx`, `src/chapters/HeroChapter.tsx`, `src/chapters/HeroLocaleControl.tsx` |
| Chapter-one profile body, model component, and scroll effect                    | `src/profile/`                                                                                                                           |
| Chapter-two article registry, reader geometry, postage edges, and R3F component | `src/axioms/`; behavior and extension instructions live in `docs/visual-design.md`                                                       |
| Chapter-three room navigation, artwork, shader, and semantic controls           | `src/projects/`; project copy remains in `src/chapters/content.ts`                                                                       |
| Chapter-four public directory, pointer previews, and endpoint artwork           | `src/signals/`; channel copy and destinations remain in `src/chapters/content.ts`                                                        |
| Responsive atlas and profile DOM layout                                         | `src/chapters/layout.ts`, `src/chapters/atlas.ts`, `src/profile/`                                                                        |
| Committed theme and locale persistence                                          | `src/preferences/`                                                                                                                       |
| Transition constants, hold/radial/portal state, and progress encoding           | `src/transition/`                                                                                                                        |
| Native mesh component, material, motion, and shader                             | `src/tetrahedron/`                                                                                                                       |
| Background, cursor, and native pointer light                                    | `src/ghost/`                                                                                                                             |
| Shared viewport type and browser read                                           | `src/shared/viewport.ts`                                                                                                                 |
| Visual truth                                                                    | `docs/visual-design.md`                                                                                                                  |

Do not duplicate constants or live state across these modules. Chapter order,
signal keys, tetrahedron face vectors, and atlas slots have one structural truth
in `src/chapters/definitions.ts`.

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
