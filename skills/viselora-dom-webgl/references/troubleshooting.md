# Troubleshooting

## Verifier reports package versions

Pin both Viselora packages to the exact string `0.1.0-alpha.0` in `dependencies`. Remove `^`, `~`, workspace aliases, and source-directory fallbacks.

## Runtime is rebuilt repeatedly

Move effect definitions and `runtimeEffects` outside React components. Keep target declaration objects stable or remount a changed declaration under a new React/WebGL key.

## Duplicate canvas or input behavior

Keep one runtime root. Remove R3F `<Canvas>`, direct `WebGLRenderer`, manual animation loops, and component-owned scroll/pointer listeners.

## Fallback disappears before WebGL is ready

Preserve a semantic DOM child or media element. Let `hideWhenReady` switch it only after resource readiness. Loading and error paths must leave fallback visible.

## Video is blank

Use a `media/video` source, a real DOM `<video>` fallback, `muted`, and `playsInline`. Call the managed `ctx.object.video` methods; do not create `VideoTexture` directly. Browser autoplay policy may still require a user gesture.

## Hover never activates

Declare `pointer: { hover: true }` on the target and read `ctx.targetPointer.isInside`. Do not replace managed input with DOM pointer listeners.

## Model animation or glow is missing

Confirm the GLB contains the named clip. Use `ctx.object.animation.clips()` while debugging, keep the model attached to a named progress timeline, and prefer emissive plus runtime-owned lights over canvas-wide bloom.

## Image sequence stays on one frame

Preload every frame, mount only after the frame array is stable, and use the same `progressKey` in the timeline, source declaration, and any companion effect.
