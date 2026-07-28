# Scroll Integration

Native browser scroll is the default. Add `@viselora/scroll-adapters` only when
the application needs named progress timelines, Lenis smoothing, GSAP ticker
integration, or ScrollTrigger sections.

## Install

```bash
npm install @viselora/dom-webgl@alpha @viselora/scroll-adapters@alpha
```

Install only the optional peers you use:

```bash
npm install gsap lenis
```

Core and adapter versions move in exact lockstep.

## Native scroll

`WebGLRuntime` reads native page scroll without an adapter. Prefer this path
when effects only need current scroll position or ordinary page movement.

Do not add Lenis or GSAP merely to animate WebGL. Effects and progress signals
already run inside the runtime-owned frame loop.

## Named React timelines

`WebGLScrollRuntime` creates one stable progress store and passes it to the core
runtime. `WebGLScrollTimeline` writes ScrollTrigger progress under its `id` (or
an explicit `progressKey`):

```tsx
import {
  WebGLScrollRuntime,
  WebGLScrollTimeline,
} from "@viselora/scroll-adapters/react";

const runtimeEffects = [storyEffect];

export function Story() {
  return (
    <WebGLScrollRuntime effects={runtimeEffects}>
      <WebGLScrollTimeline
        id="story.hero"
        start="top top"
        end="+=200%"
        pin
        scrub
      >
        <section>Semantic story content</section>
      </WebGLScrollTimeline>
    </WebGLScrollRuntime>
  );
}
```

The effect reads the same stable key from the managed progress source. Do not
mirror per-frame progress into React state.

`ScrollEffectSection` is the same section mechanism with an explicit
`progressKey`. `useScrollEffectProgressStore()` is available for app-owned
writers/readers that still use the runtime's one shared store.

## Lenis, GSAP, and ScrollTrigger

For React-owned setup, pass one stable `smooth` object:

```tsx
import gsap from "gsap";
import Lenis from "lenis";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { WebGLScrollRuntime } from "@viselora/scroll-adapters/react";

gsap.registerPlugin(ScrollTrigger);

const smooth = {
  createLenis: () => new Lenis(),
  gsap,
  ScrollTrigger,
};

<WebGLScrollRuntime effects={runtimeEffects} smooth={smooth}>
  {children}
</WebGLScrollRuntime>;
```

Keep `smooth` referentially stable. The React adapter creates and disposes the
Lenis/GSAP stack it owns.

For application-owned Lenis, create the stack outside render:

```ts
import { createLenisGsapScrollStack } from "@viselora/scroll-adapters";

const stack = createLenisGsapScrollStack({
  lenis,
  gsap,
  ScrollTrigger,
  manageLenis: false,
});
```

Pass `stack.scrollAdapter` to the runtime. Dispose the stack and the app-owned
Lenis instance in the owning application cleanup.

## Scene gates

Scene gates are an advanced alternative to ordinary pinned progress:

```ts
scroll: {
  type: "gate",
  start: "top top",
  duration: 1,
  release: "both-directions-complete",
}
```

A gate can lock page scroll and map wheel/touch delta to `sceneProgress`.
Default to ordinary native or pinned scroll. Use a gate only when deliberate
scroll capture is part of the interaction and test forward, reverse, keyboard,
touch, and escape behavior.

## Ownership rules

- One runtime, one scroll source, and one progress store per experience.
- Do not create a consumer render loop.
- Do not construct Lenis/GSAP integrations during React render.
- Do not let both Lenis and the browser independently own the same scroll
  mutation.
- Keep timeline declarations stable; write high-frequency values to the shared
  progress store.
- Preserve reduced-motion content and an accessible non-gesture path.
- Test slow/fast and forward/reverse progress, cleanup, and offscreen re-entry.

## Further reference

- [Scroll and interaction API](../../skills/viselora-dom-webgl/references/api-scroll-interaction.md)
- [Capability status](../../skills/viselora-dom-webgl/references/capability-status.md)
- [Example app](../../apps/example/README.md)
