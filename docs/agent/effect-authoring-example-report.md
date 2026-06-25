# Effect Authoring Example Report

Date: 2026-06-22

## Summary

`apps/example` was created as a React-only downstream consumer of
`@project/dom-webgl-runtime`. It imports only public package entrypoints,
defines application-owned effects locally, exercises `snapshot/element`,
`snapshot/text`, `image`, `video`, and `model/glb` source handles through a
full-width vertical one-effect-per-row catalog, places user-facing explanations
in a reusable click-to-expand overlay component on each Chinese effect row while
keeping API identifiers in English, and applies the optional Lenis + GSAP +
ScrollTrigger stack through `@project/dom-webgl-scroll-adapters`.

## What Worked

- The public `defineWebGLEffect(...)` API is enough to write small effects
  without importing package internals.
- React integration is straightforward once the runtime-level `effects` array is
  kept stable at module scope.
- Source handle narrowing is explicit and testable.
- `snapshot/text`, `image`, `video`, and `model/glb` handles expose enough basic
  controls for small examples.
- A full-width vertical catalog makes it easier to compare multiple effects for
  the same source kind without mixing them into the package validation demo.
- The package boundary remains understandable when `apps/example` is treated as
  downstream app code and `apps/demo` remains package validation code.
- Copying static assets into `apps/example/public` keeps the example runnable as
  an isolated downstream app instead of depending on `apps/demo/public`.
- The optional smooth-scroll stack fits the same boundary: the app owns Lenis
  and cleanup, the adapter package owns ticker/proxy wiring, and core receives
  only `scrollAdapter`.

## Friction And Counterintuitive Points

- The relationship between target `webgl.effects` data and runtime-level
  executable `effects` needs repeated documentation. It is easy to assume target
  declarations execute by themselves.
- React runtime recreation from changing `effects` array identity is easy to
  miss. The docs need to keep showing module-scope effect arrays.
- Smooth scrolling adds another stable-reference concern: the app must pass only
  `smoothScroll.scrollAdapter` and avoid constructing Lenis/GSAP bridges during
  render.
- Runtime replacement from a late-arriving `scrollAdapter` is handled inside the
  React adapter. Consumers should still avoid unnecessary adapter identity churn
  for performance, but they do not need a guard to prevent disposed-runtime
  registration crashes.
- Media source declarations are stricter than a new user may expect:
  `image` requires `img`, and `video` requires `video`.
- Text effects need careful language: `textLayer.setGlyphs(...)` changes only
  the WebGL output, not DOM content or accessibility text.
- Model examples can rotate via `ctx.target`, but advanced model effects still
  need users to understand object ownership and cleanup.

## Documentation Gaps Closed In This Pass

- `docs/agent/custom-effects.md` now explains React registration, source handle
  narrowing, resource ownership, media target rules, and validation.
- `docs/examples/effect-authoring.md` now gives a React-only consumer tutorial.
- README and package usage docs now point to `apps/example`.

## Boundaries To Preserve

- Do not export concrete example effects from the runtime package.
- Do not add an `effects` package subpath.
- Do not make `apps/demo` the consumer tutorial surface.
- Do not let downstream examples import package internals.
- Do not relax media declarations to silently accept non-media elements.

## Follow-Up Candidates

- Add a browser smoke check for `apps/example` once visual tuning matters.
- Add a small vanilla runtime example later, after the React-only contract stays
  stable.
- Consider a helper for common numeric param clamping only if several real
  downstream examples repeat the same code enough to justify it.
