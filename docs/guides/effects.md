# Effect Authoring

Effects let applications control visuals through a managed Three-like facade
without owning the renderer, scene graph, materials, loaders, or disposal.

## Target effects

Define target effects from the root package and register them once:

<!-- compile-tsx:target-effect-definition -->

```ts
import { defineWebGLEffect } from "@viselora/dom-webgl";

type PulseParams = {
  kind: "app.pulse";
  baseOpacity?: number;
};

type PulseState = {
  phase: number;
};

export const pulseEffect = defineWebGLEffect<PulseParams, PulseState>({
  kind: "app.pulse",
  setup() {
    return { phase: 0 };
  },
  update(ctx, state, params) {
    state.phase += ctx.delta / 1000;
    ctx.object.opacity =
      (params.baseOpacity ?? 0.8) + Math.sin(state.phase) * 0.1;
  },
});
```

```tsx
const runtimeEffects = [pulseEffect];

<WebGLRuntime effects={runtimeEffects}>
  <WebGLTarget
    webgl={{
      key: "card",
      source: { kind: "dom", type: "element" },
      effects: [{ kind: "app.pulse", baseOpacity: 0.75 }],
    }}
  >
    <article>Fallback content</article>
  </WebGLTarget>
</WebGLRuntime>;
```

Only array-form declarations are supported. Do not use legacy
`effects.material` or `effects.motion` objects.

## Scene-object effects

Use `defineWebGLSceneObjectEffect(...)` for scene-native `WebGLMesh` and
`WebGLModel` declarations:

<!-- compile-tsx:scene-object-effect-definition -->

```ts
import { defineWebGLSceneObjectEffect } from "@viselora/dom-webgl";

type SpinParams = {
  kind: "app.spin";
  speed?: number;
};

export const spinEffect = defineWebGLSceneObjectEffect<SpinParams>({
  kind: "app.spin",
  update(ctx, _state, params) {
    ctx.object.rotation.y = ctx.time * (params.speed ?? 0.0004);
  },
});
```

Register scene-object definitions in the runtime's stable effect definition
list, then reference them from the mesh/model `effects` array.

Target effects and scene-object effects are distinct contracts. A target effect
receives DOM layout/fallback context; a scene-object effect operates on a
managed scene-native object.

## Controlled object facade

The available modules depend on the target or scene object:

| Module | Responsibility |
| --- | --- |
| `position`, `rotation`, `scale` | Managed scene transforms |
| `visible`, `opacity` | Visibility/compositing |
| `material` | Controlled colors, emissive, PBR properties, shader extensions |
| `lights` | Runtime-owned light creation/update/removal |
| `animation` | Managed GLB clips and morphs |
| `surface`, `text` | Source-backed DOM visual controls |
| `texture`, `video`, `model` | Source-backed media/model capabilities |
| `postprocess` through runtime scope | Canvas/pass effects |

The facade never exposes raw renderer, scene, camera, Object3D, Material,
Texture, loader, mixer, raycaster, WebGL context, or render target.

## Placement rules

`ctx.object.position` is scene-space. It does not write DOM `left` or `top`.

A DOM-backed GLB is fitted to its target rect by the layout pass. Writing
position or scale takes over that placement. Only do this when the effect is
intentionally responsible for model placement.

For `transformScope: "subtree"`, transform/visibility/opacity writes apply to
the parent's managed group. Children still own independent source, effects,
texture, fallback, lifecycle, and offscreen policy.

## Pointer and progress

Declare the input that should wake reactive work:

```ts
pointer: {
  hover: true,
  press: true,
  click: true,
  drag: true,
}
```

Use target-local `ctx.targetPointer` for DOM-rect coordinates. Use managed
scene-object pointer state for pickable meshes/models. Do not create a second
DOM event system or raw raycaster.

Read named progress through the managed progress source:

```ts
const progress = ctx.runtime.progress.get("story.hero");
```

The exact scope is effect-kind dependent. Prefer generated types and the
[scroll guide](./scroll.md) over copying examples from archived plans.

## Materials and shader extensions

Managed mesh materials support `basic`, `standard`, and explicit `physical`
kinds. Scene-object effects can update supported material properties without
replacing or disposing the material.

The controlled `material.shader` facade extends runtime-owned compilation. It
is not a raw `onBeforeCompile` callback or unrestricted shader API. The runtime
retains program caching, viewport/DPR uniforms, texture ownership, rebuild
rules, and cleanup.

Postprocess is canvas/pass scoped. Use material/emissive plus managed lights for
object-local glow; a bloom request can affect the whole pass.

## Resource and disposal rules

- Create managed effect resources in `create` or lazily in `update`.
- Store only controlled handles in effect state.
- Release controlled handles in `dispose`.
- Assume `dispose` may be called more than once; managed removal is idempotent.
- Do not create a renderer, loader pipeline, animation loop, or unmanaged Three
  resource from an effect.
- Keep browser globals out of module initialization for SSR safety.

## Testing effects

Test the real definition with typed context stubs or runtime integration:

- parameter defaults and invalid inputs;
- deterministic transform/material writes;
- pointer/progress transitions;
- reduced-motion behavior;
- managed resource removal and idempotent disposal;
- real runtime attachment when the effect relies on a source-backed capability;
- final-canvas/browser evidence when visible output is the acceptance criterion.

Avoid snapshot tests and avoid mocking the effect module itself.

## Further reference

- [Managed effect API](../../skills/viselora-dom-webgl/references/api-effects-rendering.md)
- [Scene/model API](../../skills/viselora-dom-webgl/references/api-scenes-models.md)
- [Lifecycle/debug API](../../skills/viselora-dom-webgl/references/api-lifecycle-debug.md)
- [Capability status](../../skills/viselora-dom-webgl/references/capability-status.md)
