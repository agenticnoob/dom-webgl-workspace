# Agent Contract: Scroll Adapters

Purpose: guide AI agents that integrate third-party scroll systems with the DOM
WebGL runtime. This document is package-consumer policy, not a demo tutorial.

## Boundary

- `@project/dom-webgl-runtime` owns the public `WebGLScrollAdapter` protocol,
  native page scroll, scene gates, scroll lock, frame input, progress signal
  reads, and effect context.
- `@project/dom-webgl-scroll-adapters` owns optional glue for Lenis, GSAP ticker,
  and ScrollTrigger.
- The low-level adapter helpers leave third-party scroll instances, trigger
  timelines, animation products, route-level lifecycle, and DOM layout decisions
  in application code.
- `@project/dom-webgl-scroll-adapters/react` is the high-level exception: it
  intentionally owns bounded `ScrollTrigger` section instances for
  `ScrollEffectSection`, writes keyed progress into the runtime, and kills only
  its own trigger on cleanup.
- Effects consume normalized `ctx.scroll`, `ctx.scrollProgress`, and
  `ctx.progress.get(key)`. They do not consume Lenis, GSAP, or ScrollTrigger
  instances.

Core must not import `lenis`, `gsap`, or `ScrollTrigger`.

## Runtime Integration

There are three supported routes. Prefer the simplest route that matches the
product behavior. For ordinary pinned sections, default to route 2:
`@project/dom-webgl-scroll-adapters/react` with GSAP ScrollTrigger
`pin`/`scrub` and stable `progressKey` data.

### 1. Plain Runtime

Use plain runtime for normal page scroll and ordinary effects. Native browser
scroll needs no adapter:

```tsx
<WebGLRuntime effects={runtimeEffects}>{children}</WebGLRuntime>
```

This remains the default for `@project/dom-webgl-runtime`.

### 2. High-Level Pinned Scroll React Adapter

Use `@project/dom-webgl-scroll-adapters/react` when the product story is
"scroll a section, keep a region pinned, and drive a WebGL effect by section
progress." This is the recommended pinned-scroll story path. It uses GSAP
ScrollTrigger `pin`/`scrub` under `ScrollEffectSection` and exposes progress to
effects through a stable `progressKey`.

```tsx
import {
  ScrollEffectSection,
  WebGLScrollRuntime,
} from "@project/dom-webgl-scroll-adapters/react";
import { WebGLTarget } from "@project/dom-webgl-runtime/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";

const runtimeEffects = [pinnedRevealEffect] as const;

<WebGLScrollRuntime effects={runtimeEffects} smooth={false}>
  <ScrollEffectSection
    progressKey="article.hero.reveal"
    ScrollTrigger={ScrollTrigger}
    pin
    scrub
  >
    <WebGLTarget
      webgl={{
        key: "article.hero",
        source: { kind: "dom", type: "element" },
        effects: [
          {
            kind: "app.pinnedReveal",
            progressKey: "article.hero.reveal",
          },
        ],
      }}
    >
      章节滚动驱动 WebGL 效果
    </WebGLTarget>
  </ScrollEffectSection>
</WebGLScrollRuntime>;
```

The matching effect reads the stable key:

```ts
const progress = ctx.progress.get(params.progressKey);
```

`ScrollEffectSection` creates one bounded trigger for its own element, writes
that trigger's progress into the nearest `WebGLScrollRuntime` store, and clears
the key on unmount. This is not a scene gate and should keep runtime scroll mode
as ordinary page mode. The progress store also notifies the runtime when a key
changes, so keyed scrub updates wake on-demand renderables such as
`media/image-sequence`. For pinned scrub sections, let the section own `pin`,
the pinned DOM subtree, and a clear scrub duration such as `end="+=140%"`.
Cards or captions inside that subtree should be effect-driven if they need to
move or reveal while the section is pinned. Do not append a synthetic
post-pinned runway sibling just to hand scroll back.

When the wrapper is also responsible for the official smooth-scroll stack, pass
`smooth` options with `ScrollTrigger`; child sections can inherit it from
context. If an advanced `scrollAdapter` prop is supplied, that adapter is used
instead of creating the built-in smooth stack.

### 3. Advanced Manual `scrollAdapter`

Use `createLenisGsapScrollStack(...)` or a custom `WebGLScrollAdapter` when the
application needs to own the third-party lifecycle directly.

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
`autoRaf: false` in the application-owned Lenis setup. `apps/example` uses the
higher-level route by default:
`WebGLScrollRuntime smooth={exampleSmoothScrollOptions}` creates and owns the
built-in stack while `ScrollEffectSection` owns pinned progress. This keeps the
consumer choice explicit: manual ownership for advanced integration, high-level
React ownership for ordinary pinned scroll effects.

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
- With the low-level bridge, trigger creation, pinning strategy, scrub
  timelines, and animation semantics stay in application code.
- With `@project/dom-webgl-scroll-adapters/react`, `ScrollEffectSection` owns a
  bounded trigger instance and maps its progress to a notifying keyed runtime
  signal.
- Cleanup must not call global `killAll()` from a reusable adapter unless the
  application explicitly asks for global teardown.

## Scene Gates Are Different

`scroll: { type: "gate", ... }` is a runtime scene-gate feature. It locks page
scroll while active and emits `sceneProgress` in gate mode. It is historical
Phase 2 behavior and an optional advanced capability, not the recommended
pinned-scroll section story. A pinned section should use `ScrollEffectSection`
plus GSAP ScrollTrigger `pin`/`scrub` and `ctx.progress.get(key)` so the page
remains in page scroll mode.

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
npm test -- --run packages/dom-webgl-scroll-adapters/test
npm test -- --run packages/dom-webgl-runtime/test/lib/input/pageScroll.test.ts packages/dom-webgl-runtime/test/lib/input/scrollController.test.ts packages/dom-webgl-runtime/test/lib/input/scrollDelta.test.ts
npm test -- --run packages/dom-webgl-runtime/test/lib/renderer/runtimePipeline.test.ts packages/dom-webgl-runtime/test/lib/react/WebGLRuntime.test.tsx
npm run typecheck
npm run check:imports
```

Also sweep for forbidden core imports:

```bash
rg -n "from [\"'](lenis|gsap)|ScrollTrigger" packages/dom-webgl-runtime/src
```
