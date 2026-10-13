# Scroll integration

The runtime reads shared progress and scroll state; R3F continues to own
rendering. Use one scroll source for the page.

## Progress store

`createScrollEffectProgressStore()` from `@viselora/scroll-adapters` provides
`set(key, progress)`, `get(key)` and a subscribable `source`. Pass that source as
`progressSignals` to `WebGLRuntime`, and read
`useWebGLRuntime().progress.get(key)` inside native scene frame callbacks.
Progress notifications invalidate on-demand scenes.

## React sections

`WebGLScrollRuntime` combines the R3F host with a progress store.
`WebGLScrollTimeline`, `ScrollEffectSection` and `useScrollEffectProgressStore`
share that store. A section with an active ScrollTrigger records its progress;
without a ScrollTrigger instance, update the store explicitly from your chosen
native scroll measurement.

Pass native R3F content through the host's `scene` prop. Scroll components do
not create an additional renderer, Canvas or visual effect registry.

## Lenis and GSAP

Use `createLenisScrollAdapter`, `createGsapTickerLenisBridge`,
`createScrollTriggerBridge`, `createScrollTriggerSection`, or
`createLenisGsapScrollStack` for the integration you actually need. Dispose
bridges and subscriptions on unmount. App-created Lenis instances remain owned
by the app unless the chosen stack explicitly manages them.

A GSAP ticker can advance Lenis and notify scroll progress; do not use it to
render a second Three.js frame loop. For native visual animation read progress
in `useFrame`, using refs rather than per-frame React state.

## Verification

Verify slow/fast forward and reverse scroll, resize, route unmount/remount,
keyboard/touch alternatives and restored DOM fallback. Reaching the same
progress while scrolling in either direction should reproduce the same scene
state for reversible narrative effects.
