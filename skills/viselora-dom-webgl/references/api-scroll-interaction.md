# Scroll And Interaction API

Compatible package version: 0.1.0-alpha.0

## Contents

- [Scroll ownership and adapters](#scroll-ownership-and-adapters)
- [ScrollTrigger bridges](#scrolltrigger-bridges)
- [Progress stores and timelines](#progress-stores-and-timelines)
- [Scroll runtime](#scroll-runtime)
- [Pointer picking gestures and physics](#pointer-picking-gestures-and-physics)

## Scroll ownership and adapters

**When to use:** use `createGsapTickerLenisBridge`,
`createLenisScrollAdapter` or `createLenisGsapScrollStack` only when the app
intentionally owns one Lenis/GSAP lifecycle.
**Public entrypoint:** `@viselora/scroll-adapters`.
**Declaration/props shape:** pass stable Lenis/GSAP/ScrollTrigger instances and
use `manageLenis: false` when the app owns Lenis cleanup.
**Ownership and stability:** create one stack outside React render.
**Fallback and lifecycle:** native scroll remains the fallback when smooth
scroll is absent.
**Version limitations:** these helpers do not validate story pixels.

```ts
import { createLenisGsapScrollStack } from "@viselora/scroll-adapters";
const stack = createLenisGsapScrollStack({ lenis, gsap, ScrollTrigger, manageLenis: false });
```

**Direct verification:** assert one scroll source, cleanup and forward/reverse
progress.

## ScrollTrigger bridges

**When to use:** choose `createScrollTriggerBridge` or
`createScrollTriggerSection` for lower-level non-React ownership.
**Public entrypoint:** `@viselora/scroll-adapters`.
**Declaration/props shape:** pass a stable ScrollTrigger-like object and bounded
section vars/update callbacks.
**Ownership and stability:** one integration layer creates and disposes trigger
instances.
**Fallback and lifecycle:** content stays in normal DOM flow without JS.
**Version limitations:** avoid mixing this route with a React timeline owner.

```ts
import { createScrollTriggerSection } from "@viselora/scroll-adapters";
const section = createScrollTriggerSection({ ScrollTrigger, trigger, onUpdate });
```

**Direct verification:** assert trigger disposal and bounded reversible values.

## Progress stores and timelines

**When to use:** choose `createScrollEffectProgressStore`,
`WebGLScrollTimeline`, `ScrollEffectSection` or
`useScrollEffectProgressStore` for one named progress path.
**Public entrypoints:** `@viselora/scroll-adapters` and
`@viselora/scroll-adapters/react`.
**Declaration/props shape:** use a stable id/progressKey, pin/scrub options and
the same key in declarations/effects.
**Ownership and stability:** do not write mounted target props per scroll frame.
**Fallback and lifecycle:** semantic sections remain readable without WebGL.
**Version limitations:** scene/camera/advanced capabilities retain their own
experimental statuses.

```tsx
import { WebGLScrollTimeline } from "@viselora/scroll-adapters/react";
<WebGLScrollTimeline id="story.progress" pin scrub ScrollTrigger={ScrollTrigger}>{children}</WebGLScrollTimeline>;
```

**Direct verification:** test slow, fast, forward and reverse progress.

## Scroll runtime

**When to use:** choose `WebGLScrollRuntime` as the one page-level React owner
when any beat uses adapter timelines.
**Public entrypoint:** `@viselora/scroll-adapters/react`.
**Declaration/props shape:** pass stable module-scope effects and optional smooth
options; nest all scroll timelines under it.
**Ownership and stability:** do not mount `WebGLRuntime` beside it.
**Fallback and lifecycle:** unmount restores target fallbacks and removes canvas.
**Version limitations:** the static verifier does not execute browser scroll.

```tsx
import { WebGLScrollRuntime } from "@viselora/scroll-adapters/react";
<WebGLScrollRuntime effects={runtimeEffects}>{story}</WebGLScrollRuntime>;
```

**Direct verification:** assert one canvas and one scroll source across remount.

## Pointer picking gestures and physics

Use target `pointer` declarations and `ctx.targetPointer`; scene objects use
managed `interaction.pickable` and `ctx.objectPointer`. Cameras use managed
controller descriptors; scene-native physics uses descriptor-only bodies,
colliders and constraints. Do not add component/window pointer, wheel or touch
listeners. Keep buttons/forms in DOM and provide touch or scroll alternatives
for hover. These advanced paths are experimental in 0.1.0-alpha.0.
