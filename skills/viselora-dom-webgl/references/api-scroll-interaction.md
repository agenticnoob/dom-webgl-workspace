# Scroll and interaction

## Smooth scroll by default

Every page that scrolls uses the smooth host. Copy
[recipes/smoothScroll.ts](../recipes/smoothScroll.ts) and install its peers:

```bash
npm install lenis gsap
```

```tsx
import { WebGLScrollRuntime, ScrollEffectSection } from "@viselora/scroll-adapters/react";
import { smoothScroll } from "./smoothScroll";

export function Page() {
  return (
    <WebGLScrollRuntime smooth={smoothScroll} scene={<Scene />}>
      {/* Whole-page progress under one key: 0 at the top, 1 at the bottom. */}
      <ScrollEffectSection as="div" progressKey="page" start="top top" end="bottom bottom">
        <main>{/* chapters */}</main>
      </ScrollEffectSection>
    </WebGLScrollRuntime>
  );
}
```

- Scenes read `runtime.progress.get("page")` in `useFrame`. Map measured
  chapter positions to ranges of that key, or give each chapter its own
  `ScrollEffectSection` (default `start="top bottom" end="bottom top"`).
- `WebGLScrollRuntime` owns `progressSignals`; a custom source reading
  `window.scrollY` would be ignored, so move it into a section.
- `ScrollEffectSection` replaces its element's `ref`; wrap an element that
  needs its own ref instead of passing `as` with that ref.
- After layout changes that move sections (fonts, images, async content),
  call `refreshScrollLayout()` from the recipe, for example from the
  `ResizeObserver` that measures chapters.
- Keyboard, the scrollbar and an idle `window.scrollTo` stay native and Lenis
  follows them. The recipe sets `anchors`, so Lenis also handles `#hash`
  links: a native anchor jump clicked while Lenis is still easing would be
  pulled back to Lenis' target. A scripted `window.scrollTo` during easing is
  overridden the same way; start scripted scrolls from an idle page. Wheel
  input keeps native steps under `prefers-reduced-motion: reduce`.
- `frameloop: "demand"` keeps working: the runtime invalidates on each eased
  scroll step.
- If the application already owns Lenis or another smooth scroller, keep it
  and pass `createLenisScrollAdapter(lenis)` (or its own adapter) as
  `scrollAdapter`; do not run two smooth scrollers.
- Verify with a mouse wheel, not only a trackpad: trackpads already scroll in
  small steps, so the difference shows on a wheel.

## Scroll ownership and adapters

`createLenisScrollAdapter`, `createGsapTickerLenisBridge` and
`createLenisGsapScrollStack` connect the chosen page scroll source. Dispose
owned bridges when their consumer unmounts. Keep R3F as the render-loop owner.

## Progress stores and timelines

`createScrollEffectProgressStore` exposes set/get/clear and a subscribable
source. A scene reads `runtime.progress.get(key)` during `useFrame`.
`WebGLScrollTimeline`, `ScrollEffectSection` and
`useScrollEffectProgressStore` share the React scroll host's store. A section
needs an active ScrollTrigger to automate its progress; otherwise update the
store from your native scroll mapping.

## ScrollTrigger bridges

`createScrollTriggerBridge` and `createScrollTriggerSection` connect external
ScrollTrigger instances to runtime progress and restore their subscriptions on
cleanup. Verify reverse scroll and layout refresh after resize.

## Scroll runtime

`WebGLScrollRuntime` hosts the same single R3F Canvas and accepts native visual
content in `scene`. Optional smooth integration owns the configured Lenis/GSAP
stack. It does not add a second rendering backend.

Mesh pointer events use R3F. DOM controls remain DOM controls. Preserve keyboard
and touch paths when a desktop visual uses hover or dragging.
