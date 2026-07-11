# Architecture Rules

Compatible package version: 0.1.0-alpha.0

## One managed ownership path

- Mount one runtime and one canvas for the page: `WebGLScrollRuntime` or
  `WebGLRuntime`, never both.
- Keep one scroll source and one pointer source. Use managed timeline/progress
  and target/scene pointer declarations instead of component/window listeners.
- Let the runtime own renderer, scenes, cameras, loaders, frame loop, resources,
  scheduling and disposal.
- Do not add R3F, raw `WebGLRenderer`, a second renderer/canvas/runtime, raw
  Three.js ownership or a consumer render loop.

## Stable React declarations

- Define effect definitions and the runtime effect array at module scope.
- Keep runtime effects, scroll integration and mounted target declarations
  reference-stable.
- Remount with a new key when source/effects/scroll/pointer/lifecycle changes.
- Mount image sequences only after a complete stable frame declaration exists.

## Semantic DOM and fallback

- Keep semantic DOM responsible for content, layout, accessibility, controls
  and fallback.
- Keep loading/error fallback visible; choose `restore-dom` or `park`
  deliberately and restore fallback on disposal.
- Keep buttons, links, forms and navigation as accessible DOM controls.
- Hover must have touch or scroll parity; reduced motion must preserve meaning.

## Assets and effects

- Enforce a no production hotlink rule. Store assets locally with source,
  author, license, purpose, modifications, metadata and fallback.
- Use only controlled `ctx.object`, `ctx.runtime`, progress, pointer and resource
  facades. Dispose effect-owned handles through `ctx.resources`/`dispose`.
- Treat postprocess as canvas/pass scoped. Do not use it as object-local glow.
- Leave DOM-fitted model placement runtime-owned unless takeover is intentional.
