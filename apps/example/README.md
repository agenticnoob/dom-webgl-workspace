# Example App

`@viselora/example` is the Vite/React public-API dogfood application for the
Viselora packages.

It demonstrates a single Runtime host with native R3F/Drei Views, Three.js
textures and materials, GLTF animation, scroll progress, OrbitControls and
pointer events, Three.js postprocessing, and Rapier physics. Viselora manages
DOM registration, fallback, progress and lifecycle; the app owns visual code.

Open `/` for the Viselora site: a product page built with the runtime itself
(`src/site/`), with a live readout of its own sections and tier and an index of
every demo. `/effects.html` holds the basic effects and all nine Hero Next
specimens on one page, grouped with anchors; each specimen is rendered directly
as a full-width effect row. `/showcase.html` and `/specimen.html` compose the
one-take recipes.
The [recipe catalog and agent integration guide](./src/recipes/README.md) explain
which component to select, its typed inputs, complete usage, fallback, and source
ownership. All WebGL examples share the page's runtime and canvas.

## Run

From the repository root:

```bash
npm run dev -w @viselora/example
```

Production build and typecheck:

```bash
npm run typecheck -w @viselora/example
npm run build -w @viselora/example
```

Fonts are self-hosted under `public/fonts` (SIL Open Font License files
alongside) with `@font-face` sheets in `src/fonts/`; no page loads a
third-party font host. Refresh them with `node scripts/fetch-site-fonts.mjs`
after changing a page's families or weights, then update the preload in
`index.html`.

## Boundary

- Use React, R3F, Drei, Three.js and ecosystem packages directly. Import Viselora
  only from `@viselora/dom-webgl`,
  `@viselora/dom-webgl/react`, `@viselora/scroll-adapters`, and
  `@viselora/scroll-adapters/react`.
- Do not import package source paths.
- Keep example keys, assets, layout, and copy inside this app.
- Runtime/package code must not branch on example details.
- Tests live in `apps/example/test/`.
- Public assets live in `apps/example/public/`.

The repository import guard enforces the public-consumer boundary:

```bash
npm run check:imports
```

## Local documentation

- [Design system](./docs/design-system.md)
- [Component catalog and agent integration](./src/recipes/README.md)
- [Verification and limitations](./docs/verification.md)
- [One-take benchmark](./docs/benchmark.md)
- [One-take showcase recipes](./src/showcase/README.md) (`/showcase.html`)
- [Getting started](../../docs/guides/getting-started.md)
- [Effect authoring](../../docs/guides/effects.md)
- [Scroll integration](../../docs/guides/scroll.md)
