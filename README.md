# Viselora DOM WebGL

Viselora coordinates semantic DOM and a single React Three Fiber scene in
React 19 and Next.js applications. The runtime manages DOM measurements,
progress inputs, fallback visibility and availability. React Three Fiber and
Three.js own rendering, scene objects, materials, loaders and animation.

Current implementation and publication status live in
[docs/STATUS.md](./docs/STATUS.md).

## Install

Use the matching React/R3F alpha packages. The 0.2 API is a breaking change
from 0.1.x; see the [migration guide](./docs/guides/getting-started.md#migrate-from-01x)
and [release status](./docs/STATUS.md#release-truth).

```bash
npm install @viselora/dom-webgl@alpha react@19 react-dom@19 @react-three/fiber@9 three@0.184
# Optional scroll integration
npm install @viselora/scroll-adapters@alpha
```

Consumers require React 19, React DOM 19, `@react-three/fiber` 9 and Three.js
0.184. Optional scroll integrations use Lenis and GSAP. For workspace development,
follow [Contributing](./CONTRIBUTING.md).

## Quick start

Put Three.js elements in `scene` and ordinary HTML in `children`. The runtime
creates the page's R3F Canvas.

<!-- compile-tsx:root-quick-start -->

```tsx
"use client";

import { WebGLRuntime } from "@viselora/dom-webgl/react";

export function App() {
  return (
    <WebGLRuntime
      canvas={{ camera: { position: [0, 0, 500] }, frameloop: "demand" }}
      scene={
        <mesh>
          <boxGeometry args={[120, 120, 120]} />
          <meshNormalMaterial />
        </mesh>
      }
    >
      <main><h1>DOM content with a native Three.js scene</h1></main>
    </WebGLRuntime>
  );
}
```

Use native R3F JSX, `useFrame`, `useThree`, Three.js objects and ecosystem
helpers for visual work. Use Viselora to bind that work to the page. See
[Getting started](./docs/guides/getting-started.md) for DOM targets and Next.js.

## Public entrypoints

| Entrypoint | Responsibility |
| --- | --- |
| `@viselora/dom-webgl` | DOM text layout/texture tools and runtime input types |
| `@viselora/dom-webgl/react` | Runtime host, DOM target, runtime and target hooks |
| `@viselora/scroll-adapters` | Lenis/GSAP/ScrollTrigger bridges and progress store |
| `@viselora/scroll-adapters/react` | Scroll host, sections, timelines and progress hook |

Applications import these package entrypoints plus React, R3F, Three.js and
chosen ecosystem packages. They never import `packages/*/src`.
The [generated API inventory](./skills/viselora-dom-webgl/references/api-surface.generated.md)
contains the complete export list.

## Repository layout

```text
apps/example/                    public API examples
apps/hero-next/                  Next.js consumer
packages/dom-webgl-runtime/      @viselora/dom-webgl
packages/dom-webgl-scroll-adapters/  optional scroll integration
skills/viselora-dom-webgl/        consumer workflow and runnable template
docs/                           architecture, status and user guides
```

## Documentation

- [Current state and verification](./docs/STATUS.md)
- [Architecture and ownership](./docs/ARCHITECTURE.md)
- [Getting started](./docs/guides/getting-started.md)
- [Native visual effects](./docs/guides/effects.md)
- [Scroll integration](./docs/guides/scroll.md)
- [Contributing](./CONTRIBUTING.md)

## License

MIT.
