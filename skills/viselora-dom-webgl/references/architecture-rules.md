# Architecture rules

## Runtime and renderer ownership

- Mount exactly one `WebGLScrollRuntime` or `WebGLRuntime` root for the page.
- Let the runtime own its single canvas, renderer, scene objects, cameras, loaders, frame loop, disposal, and scheduling.
- Never create `WebGLRenderer`, R3F `<Canvas>`, or another render loop.
- Never import repository paths such as `packages/dom-webgl-runtime/src/*`, aliases such as `@project/*`, or non-exported Viselora subpaths.

## React stability

- Define effect definitions and `runtimeEffects` at module scope.
- Keep runtime effects and target declarations reference-stable.
- Remount with a new key when a target's source/effects/scroll/pointer/lifecycle declaration must change.
- Mount an image-sequence target only after its complete, stable frame array is ready.

## DOM-first fallback

- Keep semantic DOM content, `alt` text, video attributes, and loading/error UI in React.
- Set `hideWhenReady: true` only when the WebGL resource is ready to replace the fallback.
- Use `hideMode: "self"` unless the whole declared subtree is intentionally replaced.
- Use `offscreen.strategy: "restore-dom"` to restore fallback and release resources.
- Use `offscreen.strategy: "park"` to keep expensive media/model resources warm.
- Never hide a fallback while its resource is loading or after it errors.

## Input and progress ownership

- Use `WebGLScrollTimeline` or `ScrollEffectSection` for shared progress.
- Use target `pointer: { hover, press, click, drag }` declarations for managed pointer state.
- Do not attach window/document/component scroll, wheel, touch, or pointer listeners.
- Do not construct Lenis, GSAP, or ScrollTrigger objects during React render.

## Placement and effects

- Let model targets fit their DOM anchor unless an effect intentionally takes over scene placement.
- Use `ctx.object.material` and mesh emissive/light controls for object glow.
- Remember that postprocessing is runtime-canvas scoped, not target scoped.
- Dispose material layers or other effect-owned resources in the effect `dispose` hook.
