# Example App

`@viselora/example` is the Vite/React public-API dogfood application for the
Viselora packages.

It demonstrates DOM targets, text/media/model sources, custom effects, managed
scenes and pass viewports, timelines, scene-native meshes/models, interaction,
postprocess, model animation, and the bounded physics descriptor surface.

Open `/` to scroll through the basic effects and all eight Hero Next specimens
on the same page. Each specimen is rendered directly as a full-width effect row.
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

## Boundary

- Import only from `@viselora/dom-webgl`,
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
- [Getting started](../../docs/guides/getting-started.md)
- [Effect authoring](../../docs/guides/effects.md)
- [Scroll integration](../../docs/guides/scroll.md)
