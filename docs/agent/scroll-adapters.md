# Agent Contract: Scroll Adapters

Purpose: guide AI agents that integrate third-party scroll systems with the DOM
WebGL runtime. This document is package-consumer policy, not a demo tutorial.

## Boundary

- `@project/dom-webgl-runtime` owns the public `WebGLScrollAdapter` protocol,
  native page scroll, scene gates, scroll lock, frame input, and effect context.
- `@project/dom-webgl-scroll-adapters` owns optional glue for Lenis, GSAP ticker,
  and ScrollTrigger.
- Applications own third-party scroll instances, trigger timelines, animation
  products, route-level lifecycle, and DOM layout decisions.
- Effects consume normalized `ctx.scroll` / `ctx.scrollProgress`. They do not
  consume Lenis, GSAP, or ScrollTrigger instances.

Core must not import `lenis`, `gsap`, or `ScrollTrigger`.

## Runtime Integration

There are three supported routes.

### 1. Native Default

Native browser scroll needs no adapter:

```tsx
<WebGLRuntime effects={runtimeEffects}>{children}</WebGLRuntime>
```

This remains the default for `@project/dom-webgl-runtime`.

### 2. Official Smooth Scroll Stack

Use `createLenisGsapScrollStack(...)` when the application wants the recommended
Lenis + GSAP ticker + ScrollTrigger bridge.

```tsx
import { WebGLRuntime } from "@project/dom-webgl-runtime/react";
import { createLenisGsapScrollStack } from "@project/dom-webgl-scroll-adapters";

const smoothScroll = createLenisGsapScrollStack({
  lenis,
  gsap,
  ScrollTrigger,
});

<WebGLRuntime effects={runtimeEffects} scrollAdapter={smoothScroll.scrollAdapter}>
  {children}
</WebGLRuntime>;
```

When Lenis is manually driven by the GSAP ticker, configure Lenis with
`autoRaf: false` in the application-owned Lenis setup.

### 3. Custom Adapter

Use a custom `WebGLScrollAdapter` when the application owns another scroll
system or needs a different lifecycle.

```ts
const runtime = createWebGLRuntime({
  container,
  scrollAdapter: customScrollAdapter,
});
```

Keep `scrollAdapter` reference stable. In React, create it at module scope only
when the third-party instance is also module-stable; otherwise store it in a
stable ref or memoize it around the instance lifecycle.

## Lenis

Use `createLenisScrollAdapter(lenis, options)` when Lenis owns smooth page
scroll values.

Rules:

- Default ownership is consumer-owned. `adapter.dispose()` removes adapter-owned
  listeners but does not destroy Lenis.
- Set `manageInstance: true` only when the adapter created or explicitly owns
  the Lenis instance.
- Provide `getViewportHeight` when the app uses a custom scroll root or tests
  run outside a real browser viewport.
- Do not pass Lenis directly to effects.

## GSAP Ticker

Use `createGsapTickerLenisBridge({ gsap, lenis, scrollTrigger })` when GSAP's
ticker should drive `lenis.raf(...)`.

Rules:

- The bridge adds one ticker callback and removes only that callback on dispose.
- If `scrollTrigger` is provided, Lenis scroll events call
  `ScrollTrigger.update()`.
- The bridge may disable GSAP lag smoothing by default to keep smooth-scroll and
  scroll-triggered state in phase.
- The bridge does not create timelines, triggers, or product animations.

## ScrollTrigger

Use `createScrollTriggerBridge({ ScrollTrigger, scroller, proxy })` when the app
needs a scroller proxy or explicit update/refresh wrapper.

Rules:

- `scrollerProxy(...)` is only configured when both `scroller` and `proxy` are
  provided.
- `update()` and `refresh(safe?)` delegate to ScrollTrigger.
- Trigger creation, pinning strategy, scrub timelines, and animation semantics
  stay in application code.
- Cleanup must not call global `killAll()` from a reusable adapter unless the
  application explicitly asks for global teardown.

## Common Failures

- Page does not scroll: with manual Lenis RAF, the ticker bridge may have been
  created before the Lenis instance was ready.
- Runtime recreates in React: `scrollAdapter` identity changes every render.
- Effects drift from scroll: an effect reads Lenis or ScrollTrigger directly
  instead of normalized `ctx.scroll`.
- Core coupling: runtime source imports `lenis`, `gsap`, app paths, or adapter
  package internals.
- Cleanup leak: ticker callbacks or scroll listeners are added without a matching
  adapter-owned dispose path.

## Validation

When changing scroll adapter code:

```bash
npm test -- --run packages/dom-webgl-scroll-adapters/src
npm test -- --run packages/dom-webgl-runtime/src/lib/input/pageScroll.test.ts packages/dom-webgl-runtime/src/lib/input/scrollController.test.ts packages/dom-webgl-runtime/src/lib/input/scrollDelta.test.ts
npm test -- --run packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts packages/dom-webgl-runtime/src/lib/react/WebGLRuntime.test.tsx
npm run typecheck
npm run check:imports
```

Also sweep for forbidden core imports:

```bash
rg -n "from [\"'](lenis|gsap)|ScrollTrigger" packages/dom-webgl-runtime/src
```
