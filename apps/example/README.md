# Example App

`@viselora/example` is the Vite/React public-API dogfood application for the
Viselora packages.

It demonstrates DOM targets, text/media/model sources, custom effects, managed
scenes and pass viewports, timelines, scene-native meshes/models, interaction,
postprocess, model animation, and the bounded physics descriptor surface.

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
- [Getting started](../../docs/guides/getting-started.md)
- [Effect authoring](../../docs/guides/effects.md)
- [Scroll integration](../../docs/guides/scroll.md)
