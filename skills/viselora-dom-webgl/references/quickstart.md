# Quickstart

Compatible package version: 0.1.0-alpha.0

## Install

Install exact versions; do not add `^` or `~` to this prerelease:

```bash
npm install --save-exact @viselora/dom-webgl@0.1.0-alpha.0 @viselora/scroll-adapters@0.1.0-alpha.0
npm install --save-dev typescript
```

Keep `typescript` installed even in a JavaScript/JSX consumer; the skill's
verifier uses the consumer-local parser for semantic architecture checks.

Install React when the consumer does not already provide it. Install `gsap` when using `WebGLScrollTimeline`; pass its registered `ScrollTrigger` to the timeline or through the runtime's smooth options. Install `lenis` only when opting into smooth scroll.

## Start from the template

Copy `templates/react-vite/package.json` and `templates/react-vite/src/` into a React/Vite app. Keep these invariants while adapting it:

1. Keep one `WebGLScrollRuntime` root.
2. Keep `runtimeEffects` at module scope.
3. Keep one named progress key for the pinned timeline, model effect, and image sequence.
4. Replace sample asset URLs with public application assets.
5. Preload image-sequence frames before mounting that target.
6. Preserve explicit `lifecycle.offscreen` declarations and visible DOM fallbacks.

## Verify

From the skill directory, run:

```bash
node scripts/verify-consumer.mjs /absolute/path/to/consumer
```

Then run the consumer's typecheck and production build.
