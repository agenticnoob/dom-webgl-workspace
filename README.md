# Viselora DOM WebGL

Viselora is a DOM-first WebGL runtime for React and browser applications. It
keeps layout, fallback content, accessibility, scroll, pointer input, resources,
rendering, and disposal under one managed runtime while applications describe
targets and visual effects through public declarations.

The repository publishes two ESM packages:

- `@viselora/dom-webgl`
- `@viselora/scroll-adapters`

Current project and release truth lives in [docs/STATUS.md](./docs/STATUS.md).

## Install

The current prerelease is `0.1.0-alpha.1`. Install the explicit alpha tag or pin
the exact version:

```bash
npm install @viselora/dom-webgl@alpha
```

For Lenis, GSAP, and ScrollTrigger integration:

```bash
npm install @viselora/scroll-adapters@alpha gsap lenis
```

React 18 or newer is an optional peer dependency of the core package and is
required by the React entrypoints.

## Quick start

Define effects and the runtime effect list outside the component so their
references stay stable:

<!-- compile-tsx:root-quick-start -->

```tsx
import { defineWebGLEffect } from "@viselora/dom-webgl";
import {
  WebGLRuntime,
  WebGLTarget,
} from "@viselora/dom-webgl/react";

type FadeParams = {
  kind: "app.fade";
  opacity?: number;
};

const fadeEffect = defineWebGLEffect<FadeParams>({
  kind: "app.fade",
  update(ctx, _state, params) {
    ctx.object.opacity = params.opacity ?? 1;
  },
});

const runtimeEffects = [fadeEffect];

export function App() {
  return (
    <WebGLRuntime effects={runtimeEffects}>
      <WebGLTarget
        webgl={{
          key: "hero.title",
          source: { kind: "dom", type: "text" },
          effects: [{ kind: "app.fade", opacity: 0.8 }],
        }}
      >
        <h1>Managed DOM-first WebGL</h1>
      </WebGLTarget>
    </WebGLRuntime>
  );
}
```

Use one public visual path for each job:

```text
DOM-backed visual      -> WebGLTarget
Procedural 3D geometry -> WebGLMesh
GLB scene object       -> WebGLModel
```

See [Getting started](./docs/guides/getting-started.md) for sources, fallback,
debugging, and the managed-scene escalation path.

## What the runtime owns

- one transparent canvas and render loop per runtime;
- DOM measurement and scene projection;
- source loading, caching, fallback, offscreen policy, and cleanup;
- managed scenes, cameras, passes, lights, meshes, and models;
- pointer routing, picking, progress signals, and optional scroll adapters;
- controlled effect facades for transforms, materials, lights, animation,
  postprocess, textures, video, models, and scene objects;
- debug state without exposing raw renderer, scene, camera, material, loader,
  mixer, raycaster, or render-target handles.

Viselora is not a React Three Fiber replacement and does not provide a raw
Three.js escape hatch. Consumers use declarations and controlled facades while
the runtime retains lifecycle ownership.

## Public entrypoints

| Entrypoint | Responsibility |
| --- | --- |
| `@viselora/dom-webgl` | Runtime creation, declarations, types, and effect definitions |
| `@viselora/dom-webgl/react` | React runtime, target, scene, camera, pass, light, mesh, model, and debug components |
| `@viselora/scroll-adapters` | Lenis, GSAP, ScrollTrigger, and progress-store adapters |
| `@viselora/scroll-adapters/react` | Scroll runtime, timelines, sections, and progress hook |

Do not import `packages/*/src` from an application. The exhaustive generated
surface is in
[skills/viselora-dom-webgl/references/api-surface.generated.md](./skills/viselora-dom-webgl/references/api-surface.generated.md);
capability evidence is in
[capability-status.md](./skills/viselora-dom-webgl/references/capability-status.md).

## Repository layout

```text
apps/
  example/                    public-API dogfood and examples
  hero-next/                  private Next.js public-API consumer
packages/
  dom-webgl-runtime/          @viselora/dom-webgl
  dom-webgl-scroll-adapters/  @viselora/scroll-adapters
skills/
  viselora-dom-webgl/         consumer development skill
docs/
  STATUS.md                   only current implementation/release truth
  ARCHITECTURE.md             stable ownership and system model
  guides/                     task-oriented user guides
  archive/                    completed and superseded records
scripts/                      repository and release tooling
test/                         repository-level tests and guards
```

Each package and app has its own README. Repository structure and contribution
rules are in [CONTRIBUTING.md](./CONTRIBUTING.md).

## Development

```bash
npm install
npm run check
npm run build
npm run check:imports
```

Run the example:

```bash
npm run dev -w @viselora/example
```

Run the Next.js hero:

```bash
npm run dev -w @viselora/hero-next
```

The complete verification sequence is documented in
[CONTRIBUTING.md](./CONTRIBUTING.md#verification).

## Documentation

- [Documentation index and policy](./docs/README.md)
- [Current status](./docs/STATUS.md)
- [Architecture](./docs/ARCHITECTURE.md)
- [Getting started](./docs/guides/getting-started.md)
- [Effect authoring](./docs/guides/effects.md)
- [Scroll integration](./docs/guides/scroll.md)
- [Core package README](./packages/dom-webgl-runtime/README.md)
- [Scroll adapters README](./packages/dom-webgl-scroll-adapters/README.md)
- [Example app](./apps/example/README.md)
- [Hero app](./apps/hero-next/README.md)
- [Archived records](./docs/archive/README.md)

## License

[MIT](./LICENSE)
