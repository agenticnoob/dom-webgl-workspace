# Hero Next

`@viselora/hero-next` is a private Next.js App Router consumer used to validate
the public Viselora packages in a production application shape.

The current experience is a four-chapter personal narrative. The opening Hub
first presents site-level context beside the breathing tetrahedron, then hands
those two side columns to chapter one before spatial flight begins. Each chapter
owns one tetrahedron face, unique transition-side information, a progressively
screen-locked triangular reveal whose rotation and centering finish at the DOM
handoff, one continuous semantic body, signal-only entry/exit runways, and a
reversible exit that preselects the following portal content under full cover.
The chapters cover self, AI/philosophy axioms, public builds, and
public channels. Chapter two is a scroll-driven circular title index
and a stack of differently sized, postage-edged article sheets, rendered through
one managed surface in the existing scene. Scroll continuously drives their
right-side arc arrivals; only overflowing text adds a reading segment before
the next sheet. Article data, sizing and motion configuration stay in `src/axioms/`;
see [the reader design and extension guide](./docs/visual-design.md#第二章扇面目录与文章纸卡).
Chapter three places the four projects on the walls of a mouse-driven room on
wide screens with a fine pointer. Edge gestures turn to adjacent walls; project
buttons and a stable source link preserve keyboard access. Mobile and touch
layouts retain the normal project list. See [project room behavior](./docs/visual-design.md#第三章四面项目空间).
Chapter four presents Douyin, Xiaohongshu, Bilibili, Blog and GitHub as five
large single-line entries with pointer-following previews. Each entry and its
preview share one direct link; missing channel destinations remain unavailable
until supplied. Both endpoints share the same directory composition.
See [public channel behavior](./docs/visual-design.md#第四章公共入口与跟随预览).
The fourth exit preselects terminal contact copy
instead of repeating chapter four, then retains that same terminal Portal as
the final Hub title and summary. The final runway adds confirmed GitHub and
blog links without replaying a duplicate
visual block. Scroll-driven transitions are reversible. The desktop project
room also retains its selected wall and responds to pointer input independently
of scroll; both transition endpoints settle on the first wall.

Each tetrahedron face keeps paired atlas tiles derived from that chapter body's
real content. Ordinary DOM chapters use their opening copy and final content;
chapter two uses the first and last reader frames. The desktop project room
uses the same first-wall composition at both endpoints, while its mobile
layout uses the ordinary DOM opening and final project card. Chapter four uses
the same unselected five-entry directory at both endpoints. Atlas drawing
and the semantic body share the same responsive geometry, including the profile columns,
balanced heading, model exclusion, and profile speech bubble. Both tiles are
packed up front, so exit switches to the prepared endpoint without rebuilding or
uploading a texture on scroll, while face-space UV lock advances continuously
with the approach. The Hub keeps its no-spin breathing and floating motion with
stronger damped pointer parallax. Its single managed
material combines existing directional lighting with an app-owned Fresnel edge
light and reduced flat/emissive fill for clearer depth; the edge light fades as
the target face reaches full screen lock. No ground plane, shadow map, outline
mesh, duplicate tetrahedron, or additional render pass is used.

Chinese and English copy share one typed content model and one persisted locale
store. Chapter one adds a scene-native personal GLB to the established scene
without creating another renderer, canvas, scene, or render pass. The same
model starts as a shallow relief attached to the first tetrahedron face,
expands out of that face into the fixed body position, and returns to the face
during exit. Its semantic profile copy remains split into explicit left and
right columns gathered around the center. A rounded-rectangle manga speech
bubble with a background-color fill and foreground-color text stays above the
model's head without changing size or shape. Its front, side, and back messages
type in one character at a time, hold briefly at the matching model angle, and
delete one character at a time before the next stage, using the same reversible
one-turn body progress. Reduced motion retains the complete front message. Each
rendered line resolves its own displacement against the combined responsive
GLB and speech-bubble exclusions, leaving the outer gutters available for the
wrap instead of moving a whole section at once. All four chapter DOM cycles
render body content only; empty entry/exit runways remain solely as 3D
transition signals. The exit starts when the body bottom reaches the viewport
bottom. That same body progress maps the centered model deterministically to
one clockwise turn. The tetrahedron approach and retreat keep the model's
face-local pose still. The checked-in model is a Draco/WebP derivative under
5 MB, while the original source asset remains outside the repository. Its
app-owned material uses geometry normals and restrained PBR fill, with one
stable light-neutral base tint across both themes so a theme commit cannot
multiply the texture by the darker page background. Pointer lighting eases down
while a chapter is active so it remains a restrained spatial cue rather than a
dominant highlight.

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

For a local production preview, build first and then keep the server running:

```bash
npm run build -w @viselora/hero-next
npm run start -w @viselora/hero-next -- --hostname 127.0.0.1 --port 3002
```

### Development troubleshooting

Keep the development terminal or tool session alive. If the site stops
responding, check the actual listener before starting another server:

```bash
lsof -nP -iTCP:3000 -sTCP:LISTEN
```

Stop only the identified stale app process, then restart it. To keep logs
independent of a tool session's output pipe, redirect them to a local file:

```bash
npm run dev -w @viselora/hero-next -- --hostname 127.0.0.1 --port 3000 > /tmp/viselora-hero-next-dev.log 2>&1
```

This command runs in the foreground; redirection does not supervise the process
or keep it alive after its execution environment terminates. `write EPIPE`
means a pipe or socket's receiving end has closed. Inspect its stack and output
destination before assigning a cause; the error alone does not identify which
connection failed. Check the new server response and logs after restarting.

If a hydration error shows an injected attribute such as `trancy-version` on
`<html>`, disable that browser extension for the local site and reload, or
compare with a browser profile without extensions. See the
[Next.js hydration guidance](https://nextjs.org/docs/messages/react-hydration-error).
Do not suppress all hydration warnings to hide an extension-specific mismatch.

### Validation

Focused checks:

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
| Chapter-one profile body, model declaration, and scroll effect  | `src/profile/`                                                                                                                           |
| Chapter-two circular index, article sheets, typesetting, and managed reader effect | `src/axioms/` |
| Chapter-three project room, pointer navigation, and semantic controls | `src/projects/` |
| Chapter-four public directory, previews, and endpoint artwork | `src/signals/` |
| Reversible scroll, geometry, layout, and atlas                  | `src/chapters/scrollState.ts`, `src/chapters/geometry.ts`, `src/chapters/layout.ts`, `src/chapters/atlas.ts`                             |
| Theme and locale persistence                                    | `src/preferences/`                                                                                                                       |
| Hold/radial/portal state, palette/config, and progress encoding | `src/transition/`                                                                                                                        |
| Tetrahedron effect and managed shader                           | `src/tetrahedron/`                                                                                                                       |
| Background, cursor, and pointer-light effects                   | `src/ghost/`                                                                                                                             |
| Shared viewport boundary                                        | `src/shared/viewport.ts`                                                                                                                 |
| App constraints                                                 | `AGENTS.md`                                                                                                                              |
| Current visual direction                                        | `docs/visual-design.md`                                                                                                                  |

## Current evidence boundary

Current automated coverage, desktop/mobile interaction evidence, and remaining
diagnostics are owned by [the visual direction](./docs/visual-design.md#当前验证边界).
Canvas and DOM glyph
rasterization can still differ slightly, and all content remains a base version
intended for subsequent editorial adjustment.

Repository-wide release and capability truth remains in
[docs/STATUS.md](../../docs/STATUS.md).
