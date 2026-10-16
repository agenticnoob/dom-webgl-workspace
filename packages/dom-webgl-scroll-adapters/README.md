# @viselora/scroll-adapters

Optional Lenis, GSAP, ScrollTrigger and React progress integration for the
React Three Fiber host in `@viselora/dom-webgl`.

## Install

```bash
npm install @viselora/dom-webgl@alpha @viselora/scroll-adapters@alpha react@19 react-dom@19 @react-three/fiber@9 three@0.184
# Only when using the Lenis/GSAP integrations
npm install lenis gsap
```

## AI agents

Coding agents can install the matching usage skill:

```bash
npx skills add agenticnoob/dom-webgl-workspace --skill viselora-dom-webgl
```

## Entrypoints

- `@viselora/scroll-adapters`: Lenis/GSAP/ScrollTrigger bridges and a shared
  progress store.
- `@viselora/scroll-adapters/react`: `WebGLScrollRuntime`, `WebGLScrollTimeline`,
  `ScrollEffectSection` and `useScrollEffectProgressStore`.

React consumers require React 19. Install Lenis and GSAP only for integrations
that use them. The host forwards native R3F scene content and owns one Canvas.

Core and adapters use matching package versions from the `alpha` channel;
see [release truth](https://github.com/agenticnoob/dom-webgl-workspace/blob/main/docs/STATUS.md#release-truth).
See the [scroll guide](https://github.com/agenticnoob/dom-webgl-workspace/blob/main/docs/guides/scroll.md) for lifetime and progress
ownership.

## Development

```bash
npm run typecheck -w @viselora/scroll-adapters
npm run build -w @viselora/scroll-adapters
```

## License

MIT.
