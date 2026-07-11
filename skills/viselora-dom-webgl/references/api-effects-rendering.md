# Effects And Rendering API

Compatible package version: 0.1.0-alpha.0

## Contents

- [Runtime creation](#runtime-creation)
- [Runtime and provider ownership](#runtime-and-provider-ownership)
- [Targets and stable declarations](#targets-and-stable-declarations)
- [Typed effect declarations](#typed-effect-declarations)
- [Effect definitions](#effect-definitions)
- [Managed object and rendering facades](#managed-object-and-rendering-facades)

## Runtime creation

**When to use:** choose `createWebGLRuntime` for non-React ownership.
**Public entrypoint:** `@viselora/dom-webgl`.
**Declaration/props shape:** pass one container, stable effects, optional scroll
adapter, budgets and debug callback; register stable target descriptors.
**Ownership and stability:** the runtime owns canvas, renderer, frame loop,
resources and disposal. Call `dispose()` from the container owner's cleanup.
**Fallback and lifecycle:** each registered DOM target retains semantic fallback
until its managed output is ready.
**Version limitations:** this is not a raw renderer/scene escape hatch.

```ts
import { createWebGLRuntime } from "@viselora/dom-webgl";
const runtime = createWebGLRuntime({ container, effects: runtimeEffects });
```

**Direct verification:** assert one canvas, unregister/dispose cleanup and
remount count `1 -> 0 -> 1`.

## Runtime and provider ownership

**When to use:** choose `WebGLRuntime`, `WebGLRuntimeProvider` and
`useWebGLRuntime` for React pages without scroll-adapter ownership.
**Public entrypoint:** `@viselora/dom-webgl/react`.
**Declaration/props shape:** pass one stable `effects` array and optional
`onDebugStateChange`; nest targets under the one owner.
**Ownership and stability:** do not construct effects arrays during render.
**Fallback and lifecycle:** unmount disposes the runtime and restores fallbacks.
**Version limitations:** do not mount a second runtime for a local section.

```tsx
import { WebGLRuntime } from "@viselora/dom-webgl/react";
<WebGLRuntime effects={runtimeEffects}>{children}</WebGLRuntime>;
```

**Direct verification:** count canvas nodes across mount/unmount/remount.

## Targets and stable declarations

**When to use:** choose `WebGLTarget` for DOM-anchored element, text, image,
video, image-sequence or GLB enhancement.
**Public entrypoint:** `@viselora/dom-webgl/react`.
**Declaration/props shape:** provide a stable `webgl` object with `key`,
`source`, array-form `effects`, optional `pointer`/`timeline`, and explicit
`lifecycle.offscreen`.
**Ownership and stability:** changing source/effects/input/lifecycle after mount
requires a new key or remount.
**Fallback and lifecycle:** keep semantic children or native media fallback;
loading/error must remain visible.
**Version limitations:** default DOM-anchored GLB visible output is blocked in
this version even though loading lifecycle is verified.

```tsx
import { WebGLTarget } from "@viselora/dom-webgl/react";
<WebGLTarget as="img" src="/media/product.webp" alt="Product" webgl={imageDeclaration} />;
```

**Direct verification:** assert fallback transitions and final-canvas pixels.

## Typed effect declarations

**When to use:** choose `createEffectDeclarations` for app-level kind/params
type checking.
**Public entrypoint:** `@viselora/dom-webgl`.
**Declaration/props shape:** call `createEffectDeclarations<AppMap>()([...])`.
**Ownership and stability:** keep the resulting declarations stable.
**Fallback and lifecycle:** declarations never replace target fallback policy.
**Version limitations:** typing does not prove registration or visible pixels.

```ts
import { createEffectDeclarations } from "@viselora/dom-webgl";
const effects = createEffectDeclarations<AppEffects>()([{ kind: "app.hover" }]);
```

**Direct verification:** strict typecheck plus runtime kind registration.

## Effect definitions

**When to use:** choose `defineWebGLEffect` for target effects and
`defineWebGLSceneObjectEffect` for managed scene objects.
**Public entrypoint:** `@viselora/dom-webgl`.
**Declaration/props shape:** define module-scope kind/source/setup/update/dispose
data and register definitions once in the runtime array.
**Ownership and stability:** use `ctx.resources` for effect-owned cleanup; never
create a renderer, loader, render loop or global input source.
**Fallback and lifecycle:** effects do not own DOM fallback visibility.
**Version limitations:** scene-object effects have no DOM layout or
`ctx.targetPointer`.

```ts
import { defineWebGLEffect } from "@viselora/dom-webgl";
export const fade = defineWebGLEffect({ kind: "app.fade", update(ctx) { ctx.object.opacity = 0.8; } });
```

**Direct verification:** assert update changes final output and dispose releases
every registered resource.

## Managed object and rendering facades

Use `ctx.object` transforms, material, lights, animation, surface, text,
texture, video and model modules only when the source supports them. Source
material layers may sample `shaderInputs.sourceTexture`; image replacement must
name `sourceTextureUniform` and use `replace-source`. Runtime postprocess is
canvas/pass scoped. Verify visible results at final-canvas pixels, not only
uniforms, callbacks or effect-owned canvas changes.
