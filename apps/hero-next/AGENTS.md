# Hero Next Agent Rules

This file is required reading before editing any file under `apps/hero-next/`.
Its rules apply to the entire `apps/hero-next` subtree.

## Hard Visual Boundary

`hero-next` is a strict downstream dogfood consumer of the current public
Viselora packages.

```text
DOM-backed visual -> WebGLTarget
Procedural 3D geometry -> WebGLMesh
GLB asset -> WebGLModel
```

- CSS may only perform document reset, sizing, positioning, layout, stacking,
  overflow control, and pointer-event routing.
- CSS must not create any visible artwork or visual treatment. Do not use CSS
  backgrounds, gradients, colors, borders, shadows, filters, opacity,
  blend modes, masks, clipping, generated content, visual transforms, or CSS
  animation for the hero image.
- Do not use pseudo-elements as visual layers.
- Every visible hero object, material, light, texture, postprocess operation,
  and motion effect must be produced through public APIs from
  `@viselora/dom-webgl`, `@viselora/dom-webgl/react`, or
  `@viselora/scroll-adapters`.
- App-owned effects created with `defineWebGLEffect(...)` or
  `defineWebGLSceneObjectEffect(...)` are allowed when they use only the
  package-managed effect context and public capability facades.
- Do not import React Three Fiber, package `src/` files, or private renderer,
  scene, camera, material, loader, or object handles. A direct `three` geometry
  constructor import is allowed only for a stable `WebGLMesh`
  `geometry: { kind: "custom", create }` descriptor whose factory returns a
  fresh `BufferGeometry`; runtime owns validation and disposal.

The CSS allowlist is intentionally narrow. New declarations should be limited
to properties such as `box-sizing`, `margin`, `width`, `height`, `min-height`,
`position`, `inset`, `display`, `isolation`, `z-index`, `overflow`,
`overflow-x`, and `pointer-events`. If a visual requirement cannot be expressed
without leaving that boundary, it is not a CSS task.

## Package Freeze And Capability Gaps

Do not modify anything under `packages/` while working on a `hero-next`
downstream effect unless the user separately authorizes package work.

When the current public package cannot express a required effect:

1. Stop before adding a workaround.
2. Report the missing capability with current source/type evidence.
3. Explain the visible limitation it causes in `hero-next`.
4. Describe the smallest general public capability that would unblock it.
5. Wait for explicit authorization before changing package code.

Never bypass a capability gap with CSS artwork, raw Three.js ownership, a private import,
DOM scanning, a second renderer, or an app-specific branch in runtime code.

Known current limits relevant to the studio hero:

- Mesh materials expose basic/standard color and PBR scalar properties plus an
  explicit physical descriptor with transmission, thickness, and IOR. They do
  not expose gradients, texture masks, or stage material programs. The current
  hero descriptor intentionally remains `standard`; do not opt it into
  `physical` without a separate visual decision.
- Scene-native `WebGLMesh` effects receive the controlled managed material
  facade for every managed geometry kind. The facade does not expose raw Three
  handles or grant material replacement/disposal or layer/program ownership.
- Managed light declarations do not expose cast/receive shadow configuration.
- `WebGLMesh` provides `plane`, `box`, `sphere`, `cylinder`, `cone`, and
  `tetrahedron` descriptors plus the controlled custom `BufferGeometry`
  factory; scene fog is not a public declaration.

Use the capabilities that exist—managed scenes, cameras, `WebGLMesh` geometry,
models, basic/standard/physical materials, lights, transforms, timelines,
postprocessing, and app-owned public effects—and report the boundary when they
are insufficient.

## Current Implementation Truth

The previous CSS-owned studio artwork has been removed. The current hero uses
one managed scene, camera, render pass, canvas, and renderer for the background
Ghost Cursor, `WebGLMesh` tetrahedron, and managed lights. The foreground Ghost
Cursor layer has been removed, and the tetrahedron currently uses `radius: 0.52`.
The runtime uses a stable app-level `renderQuality` declaration with
`antialias: true` and `maxDevicePixelRatio: 2` to smooth tilted tetrahedron
silhouettes. Keep this on the public runtime prop; do not raise tetrahedron
`detail`, create a second renderer, or use CSS to imitate antialiasing.
The background effect applies responsive `1.06` world-scale overscan to cover the
transparent canvas under the tilted camera, and the pointer blob uses the compact
`0.24 + 0.14 / iScale` radius. Keep this treatment effect-owned; do not add a CSS
background fallback or CSS transform. The shader receives explicit base/target
background and foreground colors plus pixel-space radial origin/radius/feather
uniforms. It draws the aspect-correct circle and owns no palette literals, gesture
state, or transition phase logic. The same background target effect owns the
scene-scoped `hero.pointer-light` through the managed lights facade; it uses a
stable key, damped target-local pointer mapping, exit intensity decay, a static
reduced-motion state, and managed removal on effect dispose. This is visually
isolated only because the tetrahedron is the current scene's sole lit material,
not because the runtime provides general per-target light isolation.
The ambient fill remains commented out; the directional key and rim lights are
active with positions `[1.2, 1.2, 2]` / `[1.8, -1.4, 2]` and intensities `4.8` /
`2.2`. The active point light remains `#f0f0f0`, target intensity `10`,
`distance: 1.8`, `decay: 3`, and camera-side `Z=0.8`; it is omnidirectional, not a
managed spotlight.

The only non-light author colors are centralized in
`src/heroTransitionConfig.ts`: `light=#B8B8B8` and `dark=#5F5F5F`. Initial roles
are light background/dark foreground; inverted roles are dark background/light
foreground. Ghost Cursor consumes the semantic foreground. The tetrahedron
effect requests the same semantic material color and emissive. The scene-native
`WebGLMesh` runtime now injects `ctx.object.material`, so those writes reach the
real runtime-owned standard material in production.
Key, rim, and pointer light colors are explicit lighting exceptions and must not
be routed through the palette resolver.

The current transition is asymmetric at the material boundary.
The background and Ghost Cursor use the shared origin/radius signals in a
per-fragment pixel-space radial mask, while `resolveHeroTransitionVisual()`
selects the target tetrahedron foreground for the entire material whenever the
phase is not `idle`. The tetrahedron therefore changes as one hard semantic
step at attempt start and retains that target through retraction until
cancellation. This is current implementation truth, not spatial mesh
diffusion. The approved next design direction is to synchronize a
screen-space, per-fragment tetrahedron transition with the existing radial
signals. The current managed mesh material facade has no mask, material-program,
or layer host, so that direction requires a separately designed general public
capability. Do not imitate it with CSS, raw Three handles, or duplicate meshes.

`WebGLScrollRuntime`, `heroSmoothScroll`, Lenis, GSAP, and ScrollTrigger remain in
place for future scrolling. The obsolete transition `WebGLScrollTimeline`, pin,
scrub, and `+=300%` range are removed. Internal `HeroScene` uses the public
`useScrollEffectProgressStore()` hook to create one stable minimal writer and one
stable mesh-effect declaration. React does not mirror per-frame transition state.

The tetrahedron declares `pickable.hitTest: "mesh"` and `pointer.press: true`.
Only a confirmed primary-pointer mesh hit starts or resumes an attempt, and the
runtime pointer coordinates from that hit frame become the radial origin. The
scene-object effect owns the only live transition state and publishes six stable
progress signals: committed scheme, target scheme, coverage, origin X/Y, and
phase. The background effect reads those signals independently; neither effect
imports or calls the other. There is no theme store, event bus, or second state.

The pure phases are `idle`, `expanding`, `retracting`, and `awaiting-release`.
Expansion advances at `1 / 1000 ms`; early release retracts at a full-range rate
of `1 / 300 ms`; a new real mesh press during retraction preserves the origin,
target, and current radius. Commit occurs only when the resolved radial radius
covers the farthest viewport corner. The app effect adapter uses the approved
SSR-safe `window.innerWidth` / `window.innerHeight` viewport source because the
public scene-object context does not expose layout. A committed hold must be
released before another inverse attempt, so continuous holding cannot repeat
the toggle.

The tetrahedron does not continuously self-rotate. Idle motion uses base rotation
`[-0.6, 0.82, 0.08]`, a six-second `±1.2%` breathing scale, an eight-second
`±0.018` Y float, and damped pointer tilt. Ambient motion fades with active
coverage; deterministic shake is present only during non-reduced forward
expansion and stops on release, retraction, or commit. Reduced motion stays at
`[-0.6, 0.85, 0.08]` with no shake or rapid extra transform while retaining hold
timing, radial expansion/retraction, resume, release gate, and reversible scheme
semantics. The declaration-owned material values are emissive intensity `0.06`,
initial opacity `0.92`, metalness `0.9`, and roughness `0.12`; dynamic semantic
material/emissive synchronization now runs through the public runtime facade.
The opacity value is an alpha-transparency experiment, not physical light
transmission. User visual QA reports that the strongly lit metallic surface
looks white/milky rather than transparently refractive, so that treatment is
not accepted as the requested light-through-solid effect. The new package-level
physical capability does not itself approve hero physical values. Camera position is
`[0, 0, 3.2]` with target `[0, 0.32, 0]`.

Current verified design and completed execution record:

- `docs/superpowers/specs/2026-07-16-hero-next-hold-radial-transition-design.md`
- `docs/superpowers/plans/2026-07-16-hero-next-hold-radial-transition.md`
- `docs/superpowers/specs/2026-07-13-hero-next-ghost-cursor-depth-design.md`
- `docs/superpowers/specs/2026-07-14-hero-next-webglmesh-tetrahedron-design.md`
- `docs/archive/plans/superpowers/2026-07-13-hero-next-ghost-cursor-depth.md`

The earlier matte-studio documents and plans are historical evidence only and
must not be treated as active implementation guidance.

## Verification

Every `hero-next` visual change must verify:

```bash
npm test -- --run apps/hero-next/test
npm run typecheck -w @viselora/hero-next
npm run build -w @viselora/hero-next
npm run check:imports
git diff --check
```

Browser verification must use the real package runtime, `WebGLMesh`, and managed
canvas. Static markup or type success is not visual proof.
