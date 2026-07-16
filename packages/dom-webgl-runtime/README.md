# @viselora/dom-webgl

DOM-first WebGL runtime with managed rendering, lifecycle, interaction, and effect authoring.

## Install

```bash
npm install @viselora/dom-webgl@alpha
```

React is an optional peer dependency. Install React 18 or newer when using the React entrypoint.

## Alpha.1 recovery release

Published `0.1.0-alpha.1` fixes cross-entrypoint scene-object effect
registration between `@viselora/dom-webgl` definitions and
`@viselora/dom-webgl/react` consumers. The alpha.0 failure was
`Effect "<kind>" is not a scene-object effect.` The published tarballs passed
the installed-tarball Chromium release gate. Independent downstream consumer
acceptance remains a consumer-project responsibility.

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

## Managed mesh materials

`WebGLMesh` keeps `standard` as its default and also supports `basic` plus an
explicit `physical` opt-in. Physical meshes create a real runtime-owned
`MeshPhysicalMaterial`; they do not upgrade standard meshes globally.

```tsx
<WebGLMesh
  id="glass"
  geometry={{ kind: "box", size: [2, 2, 0.2] }}
  material={{
    kind: "physical",
    color: "#dbeafe",
    opacity: 1,
    roughness: 0.08,
    transmission: 0.9,
    thickness: 1.2,
    ior: 1.6,
  }}
  effects={[{ kind: "app.glass" }]}
/>
```

Scene-object effects receive the controlled facade at
`ctx.object.material`. `material.physical` exists only when every controlled
material entry is a real physical material. Effects may update color,
emissive, opacity, metalness, roughness, transmission, thickness, and IOR, but
cannot access, replace, or dispose the raw Three material. A scene-native mesh
does not gain material-layer/program authoring; `createLayer(...)` still
requires a source-backed material layer host. `transmission > 0` normally works
with `opacity: 1`; transmission does not implicitly alter opacity.

## License

MIT
