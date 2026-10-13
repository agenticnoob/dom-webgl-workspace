# Scroll and interaction

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
