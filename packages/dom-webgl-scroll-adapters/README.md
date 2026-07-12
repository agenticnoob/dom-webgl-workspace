# @viselora/scroll-adapters

Optional Lenis, GSAP, ScrollTrigger, and React integration for `@viselora/dom-webgl`.

## Install

```bash
npm install @viselora/scroll-adapters@alpha gsap lenis
```

GSAP, Lenis, and React are optional peer dependencies. Install only the peers required by the entrypoints and features your application uses; React 18 or newer is required for the React entrypoint.

## Entrypoints

- `@viselora/scroll-adapters` exports the Lenis adapter, GSAP ticker bridge, ScrollTrigger bridge, and progress store.
- `@viselora/scroll-adapters/react` exports `WebGLScrollRuntime`, `WebGLScrollTimeline`, `ScrollEffectSection`, and `useScrollEffectProgressStore`.

```ts
import { createLenisGsapScrollStack } from "@viselora/scroll-adapters";
```

```tsx
import {
  WebGLScrollRuntime,
  WebGLScrollTimeline,
} from "@viselora/scroll-adapters/react";
```

## Core version lockstep

Adapters and core releases use exact version lockstep. The local
`@viselora/scroll-adapters@0.1.0-alpha.1` candidate depends on exactly
`@viselora/dom-webgl@0.1.0-alpha.1`; upgrade both packages together. The
candidate is local tarball browser verified; registry publication pending and
downstream consumer verification pending.

## License

MIT
