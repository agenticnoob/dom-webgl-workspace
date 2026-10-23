# @viselora/dom-webgl

DOM coordination for React 19.2 / Next.js on React Three Fiber 9 and Three.js.
The 0.2 React/R3F API replaces the 0.1.x managed engine API. See the repository
[release status](https://github.com/agenticnoob/dom-webgl-workspace/blob/main/docs/STATUS.md#release-truth).

## Install

```bash
npm install @viselora/dom-webgl@alpha react@19.2 react-dom@19.2 @react-three/fiber@9 three@0.186
```

Use the `alpha` tag for the React/R3F API; see
[migration and Next.js integration](https://github.com/agenticnoob/dom-webgl-workspace/blob/main/docs/guides/getting-started.md).

## AI agents

Coding agents can install the matching usage skill:

```bash
npx skills add agenticnoob/viselora-skills --skill viselora-dom-webgl
```

## Entrypoints

- `@viselora/dom-webgl`: DOM text layout/drawing, native CanvasTexture creation
  and runtime/progress input types.
- `@viselora/dom-webgl/react`: `WebGLRuntime`, `WebGLTarget`, `useWebGLRuntime`
  and `useDOMTarget`.

`WebGLRuntime` hosts one R3F Canvas with native components in `scene` and
semantic DOM in `children`. `WebGLTarget` registers a ref-capable DOM child;
scene components read its live layout through `useDOMTarget`.
Fallback hiding is explicit (`hideWhenReady` plus visual readiness).

Use R3F/Three.js objects, materials, loaders, hooks and events directly.
There are no managed mesh/model/material declarations or effect facades.
See [Getting started](https://github.com/agenticnoob/dom-webgl-workspace/blob/main/docs/guides/getting-started.md) and
[native visual effects](https://github.com/agenticnoob/dom-webgl-workspace/blob/main/docs/guides/effects.md).

## Development

```bash
npm run typecheck -w @viselora/dom-webgl
npm run build -w @viselora/dom-webgl
```

Tests live in `test/`. Apps consume package entrypoints, never source paths.

## License

MIT.
