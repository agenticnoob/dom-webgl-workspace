# Architecture

Viselora is a DOM coordination runtime for React 19 and Next.js, built on React
Three Fiber 9 and Three.js. DOM remains the layout, semantic and accessibility
anchor. Visual components are ordinary R3F components.

## Core flow

```text
DOM element -> WebGLTarget registration -> batched rect measurement
            -> useDOMTarget live state -> application useFrame -> native mesh

progress store / scroll adapter -> runtime input -> application useFrame

R3F Canvas -> Three.js renderer -> scene -> camera -> final canvas
```

## Ownership

The application owns semantic DOM, scene composition, native Three.js objects,
materials, loaders, animation, model instances and custom texture lifetimes.
Use R3F JSX, `useFrame`, `useThree`, `useLoader` or suitable Drei helpers directly.

R3F owns the single Canvas, reconciliation, rendering, resize handling,
event raycasting and the frame loop. The runtime-owned host configures that
Canvas and connects runtime invalidations to R3F's `invalidate()`.

Viselora owns DOM registration and measurements, shared progress/scroll input,
DOM fallback paint, renderer availability and observer cleanup. It does
not declare a parallel scene graph or wrap materials, lights, models, physics,
camera controls or postprocessing.

## React host

`WebGLRuntime` accepts semantic `children`, R3F `scene`, optional `canvas`
configuration and progress/scroll inputs. It bridges one runtime context into
the DOM and Canvas trees. Hooks must be descendants of this host.

`WebGLTarget` clones one ref-capable DOM child. `useDOMTarget(id)` observes
registration identity; the returned object's rect, visibility and revision
remain live and should be read in `useFrame`. Do not put per-frame transforms
into React state.

The host measures targets with a negative frame priority before ordinary
application frame subscribers run. R3F remains the only renderer loop owner.
A positive `useFrame` priority takes over rendering and should only be used by
an explicitly owned pass/composer.

Hidden tabs and lost WebGL contexts suspend R3F's frame loop and restore DOM
fallback. On recovery the host restores the configured `canvas.frameloop` and
invalidates a frame; a visibility change cannot clear an ongoing context loss.

`WebGLSection` schedules a native subtree by distance from a DOM target or a
progress range. It decides when the subtree draws and updates, never what it
contains: `warm` hides its wrapper group, and `sleep` places it in a hidden
React `Activity`, which R3F hides and whose effects and frame callbacks React
disconnects. The host's event filter drops hits on undrawn objects.

## DOM and fallback

Measurements are read in a batch before fallback styles are written. Scroll,
resize, DOM mutations and font completion invalidate the scene. A target
revision changes when text/style/dimensions need a new content snapshot.

`hideWhenReady` defaults to false. A replacement visual opts in and explicitly
reports readiness through `runtime.setTargetReady(id, true, target)` once it
can render. Keep the captured target identity when reporting asynchronous
completion so an older load cannot hide a newly mounted target.

Unavailable WebGL, unregistration and disposal restore the opacity property
owned by the runtime. Other current inline styles and classes remain intact.
Fallback paint uses opacity rather than visibility so semantic content remains
in the accessibility tree. Only registered leaves are hidden: a target that
contains another registered target keeps its own DOM paint, allowing an unready
child to remain visible.

`restore-dom` restores fallback when a target leaves the viewport. `park` keeps
ready fallback hidden while offscreen. Both expose `visible` so applications
can pause animation; resource retention or unmounting is the visual component's
explicit policy, using normal React/Three.js lifetimes.

## Text and assets

`measureDOMText` reads CSS typography and produces wrapped lines and glyphs.
`drawDOMText` draws CSS-pixel glyph commands on a caller-owned canvas.
`createDOMTextTexture` creates a native sRGB `CanvasTexture`, capped at 2x DPR,
with a separate CSS width/height and an idempotent disposal function.

Image, video and GLB loading use Three.js/R3F/Drei. Shared `useLoader` assets,
cloned model instances and externally created primitives require explicit
ownership decisions; unmounting one consumer must not dispose another's cached
resources. There is no duplicate Viselora loader or resource cache.

## Scroll and interaction

Progress values are shared inputs, independent of rendering. The optional
scroll-adapter package retains native, Lenis and GSAP/ScrollTrigger integration.
A scene reads `runtime.progress.get(key)` during its frame callback.

Mesh pointer events use R3F. DOM controls retain ordinary pointer/keyboard
handlers. The host connects R3F events to the page container so a fixed Canvas
does not replace semantic DOM interaction. Applications handle interaction
priority, reduced motion and touch alternatives.

## Repository boundaries

Packages are reusable and cannot reference app identities, content or assets.
Applications use public Viselora entrypoints and native ecosystem packages.
Tests stay outside production `src/`. Runtime modules are safe to import during
SSR; browser resources are created after mount or by explicit DOM utilities.

## Non-goals

- a framework-independent/headless WebGL engine;
- facade parity with Three.js or R3F;
- custom physics, loaders, mixers, raycasting or render scheduling;
- a second Canvas for one page experience;
- legacy 0.1.x managed scene/effect compatibility.
