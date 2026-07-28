# Getting Started

This guide shows the shortest React path from semantic DOM to a managed WebGL
target. For the complete export inventory, use the
[generated API surface](../../skills/viselora-dom-webgl/references/api-surface.generated.md).

## Install

```bash
npm install @viselora/dom-webgl@alpha
```

React 18 or newer is required for the React entrypoint.

## Create one runtime

Keep effect definitions and the runtime effect list at module scope:

<!-- compile-tsx:getting-started-runtime -->

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

export function Page() {
  return (
    <WebGLRuntime effects={runtimeEffects}>
      <WebGLTarget
        webgl={{
          key: "hero.title",
          source: { kind: "dom", type: "text" },
          effects: [{ kind: "app.fade", opacity: 0.85 }],
        }}
      >
        <h1>Semantic fallback and managed WebGL</h1>
      </WebGLTarget>
    </WebGLRuntime>
  );
}
```

The DOM remains real content. The runtime measures it, creates a matching
renderable, hides the fallback only when ready, and restores it on error,
offscreen release, unmount, or runtime disposal.

## Choose the visual path

| Need | Public path |
| --- | --- |
| DOM layout, text, media, fallback, or target pointer | `WebGLTarget` |
| Procedural scene-native geometry | `WebGLMesh` |
| Scene-native GLB with managed animation/morph state | `WebGLModel` |

Use managed scenes only when the default DOM-aligned path is insufficient:

```tsx
import {
  WebGLCamera,
  WebGLMesh,
  WebGLRuntime,
  WebGLScene,
} from "@viselora/dom-webgl/react";

<WebGLRuntime effects={runtimeEffects}>
  <WebGLScene
    id="hero.scene"
    projection="perspective-stage"
    render={{ camera: "hero.camera" }}
  >
    <WebGLCamera
      id="hero.camera"
      default
      type="perspective"
      position={[0, 0, 3]}
    />
    <WebGLMesh
      id="hero.mesh"
      geometry={{ kind: "box", size: [1, 1, 1] }}
      material={{ kind: "standard", color: "#dbeafe" }}
    />
  </WebGLScene>
</WebGLRuntime>;
```

Managed scenes do not expose raw Three.js handles and do not replace the normal
`WebGLTarget` path.

## Declare sources

DOM text:

```ts
source: { kind: "dom", type: "text" }
```

Image:

```ts
source: {
  kind: "media",
  type: "image",
  src: "/images/hero.webp",
}
```

Video:

```ts
source: {
  kind: "media",
  type: "video",
  src: "/video/hero.mp4",
}
```

GLB following a DOM rect:

```ts
source: {
  kind: "model",
  type: "glb",
  src: "/models/hero.glb",
  loader: {
    draco: { decoderPath: "/draco/" },
  },
}
```

Apps must host decoder files at the declared public path. Do not pass loader
callbacks or import internal loaders.

## Keep declarations stable

After a `WebGLTarget` mounts, keep its `webgl` declaration stable. Do not mutate
source, effects, scroll, pointer, or lifecycle behavior through render-time
object recreation. Use module-level constants, memoized declarations, or a new
React key when the semantic declaration must change.

Do not mirror frame-by-frame values into React state. Progress and visual state
belong in runtime stores and effects.

## Fallback and offscreen policy

Defaults:

- `hideWhenReady: true`
- `hideMode: "self"`
- offscreen policy `restore-dom`

Use `hideWhenReady: false` when DOM and WebGL should remain visible together.
Use `hideMode: "subtree"` only when the target and its descendants are one
fallback unit.

Use `park` only when retaining WebGL resources offscreen is worth the memory
cost. Loading and error states always keep fallback visible.

## Debugging

Use `onDebugStateChange` or the React debug surface to inspect target counts,
renderable/resource states, active scroll mode, scene progress, managed scene
objects, interaction, animation, physics, and performance budgets.

Separate these claims:

- declaration registered;
- resource ready;
- renderable active;
- automated final-canvas evidence;
- real-browser visual acceptance.

Ready/active state alone does not prove correct final pixels.

## Next

- [Effect authoring](./effects.md)
- [Scroll integration](./scroll.md)
- [Architecture](../ARCHITECTURE.md)
- [Capability status](../../skills/viselora-dom-webgl/references/capability-status.md)
- [Example app](../../apps/example/README.md)
