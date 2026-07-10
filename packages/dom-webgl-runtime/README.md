# @viselora/dom-webgl

DOM-first WebGL runtime with managed rendering, lifecycle, interaction, and effect authoring.

## Install

```bash
npm install @viselora/dom-webgl@alpha
```

React is an optional peer dependency. Install React 18 or newer when using the React entrypoint.

## Entrypoints

- `@viselora/dom-webgl` exports the runtime, declarations, public types, and effect-authoring APIs.
- `@viselora/dom-webgl/react` exports the managed React components and hooks.

## Stable React setup

Define effects and the runtime effect list at module scope so their references stay stable across React renders.

```tsx
import { defineWebGLEffect } from "@viselora/dom-webgl";
import {
  WebGLRuntime,
  WebGLTarget,
} from "@viselora/dom-webgl/react";

const fadeEffect = defineWebGLEffect({
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

The public API is declaration-driven and runtime-owned. It intentionally does not expose raw Three.js renderer, scene, camera, material, loader, or React Three Fiber escape hatches.

## License

MIT
