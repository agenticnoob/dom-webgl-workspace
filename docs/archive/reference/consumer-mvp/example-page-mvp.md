# Later Project MVP: Viselora Example Page

**Date:** 2026-07-10
**Status:** Deferred; create only after public release

## Goal

Build one polished DOM-first example page in a separate repository using
`@viselora/dom-webgl@alpha`, `@viselora/scroll-adapters@alpha`, and the
`viselora-dom-webgl` skill. This repository does not create the formal MVP.

The project proves that public npm artifacts and agent documentation are enough
to deliver a credible consumer site. It does not port workspace internals, add
runtime capabilities, or use unpublished source imports.

## Required Page

The page should contain real DOM headings, copy, images, video, and fallback
content, enhanced by exactly one runtime-owned WebGL canvas. It should combine:

- a surface pulse on a DOM-aligned panel;
- a video background texture behind readable DOM copy;
- an image hover overlay or Ghost Cursor driven by the shared pointer source;
- a pinned model animation with emissive glow driven by shared scroll progress;
- a scroll-controlled image sequence with synchronized DOM content.

The five effects may share sections when that improves the design. They must
remain application-owned recipes using public Viselora effect definitions.

## Runtime Rules

- Create one `WebGLRuntime` or one `WebGLScrollRuntime`, never both.
- Render one canvas for the page and never instantiate another renderer.
- Use one scroll source. If Lenis/GSAP is used, create it once and pass the
  adapter to Viselora.
- Use one pointer source; do not add per-effect global pointer listeners.
- Import only `@viselora/dom-webgl`, `@viselora/dom-webgl/react`,
  `@viselora/scroll-adapters`, and `@viselora/scroll-adapters/react`.
- Define runtime effect arrays at module scope or memoize them from stable
  dependencies.
- Keep DOM fallback visible during loading/error, choose an offscreen policy,
  honor reduced motion, and dispose subscriptions, timelines, resources, and
  the runtime on unmount.
- Do not add R3F, another Canvas component, raw `WebGLRenderer`, or private
  package paths.

## Acceptance

The later repository must pass:

1. clean installation from the two public alpha packages;
2. the skill's `verify-consumer.mjs` checks;
3. strict TypeScript typecheck through root and React public entrypoints;
4. SSR import checks with no module-load access to `window` or `document`;
5. a runtime test proving one canvas and cleanup after unmount;
6. a production build with no workspace aliases;
7. manual reduced-motion, loading, error, offscreen, scroll, and pointer checks.

## Out Of Scope

- creating this MVP inside the Viselora source workspace;
- publishing new runtime features to make a recipe easier;
- CommonJS or compatibility packages;
- multiple canvases or renderers;
- physics or a generalized visual preset framework.
