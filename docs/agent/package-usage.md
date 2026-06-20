# Agent Contract: Package Usage

Purpose: guide AI agents that integrate the published DOM WebGL runtime package
into downstream applications. This is package-consumer documentation, not a
workspace example guide and not a human tutorial. Treat every rule below as
implementation policy.

## Package Truth

- Use public package entrypoints only.
- Root entrypoint owns vanilla runtime creation and effect authoring.
- React entrypoint owns React runtime/provider/target components.
- Applications own concrete visual effects.
- The package owns layout measurement, runtime lifecycle, source handles, target
  handles, frame input, pointer state, scroll state, and managed resources.
- The package does not provide default visual effects or an official
  `effects` preset subpath.

## Public Imports

Replace `<runtime-package>` with the actual published npm package name. In this
workspace before publication, the package name is `@project/dom-webgl-runtime`.

Use:

```ts
import {
  createWebGLRuntime,
  defineWebGLEffect,
  type WebGLDeclaration,
  type WebGLEffectContext,
  type WebGLEffectDefinition,
  type WebGLRuntimeOptions,
} from "<runtime-package>";
```

Use for React:

```tsx
import {
  WebGLRuntime,
  WebGLTarget,
  useWebGLRuntime,
} from "<runtime-package>/react";
```

Do not use:

```ts
import ... from "<runtime-package>/effects";
import ... from "<runtime-package>/src";
import ... from "packages/dom-webgl-runtime/src";
```

## Runtime Setup

React:

```tsx
import { WebGLRuntime, WebGLTarget } from "<runtime-package>/react";

const runtimeEffects = [appSurfaceEffect, appPointerEffect] as const;

export function App() {
  return (
    <WebGLRuntime effects={runtimeEffects}>
      <WebGLTarget
        webgl={{
          key: "hero.surface",
          source: { kind: "snapshot", mode: "element" },
          effects: [{ kind: "app.surface", opacity: 0.82 }],
        }}
      >
        Hero content
      </WebGLTarget>
    </WebGLRuntime>
  );
}
```

Vanilla:

```ts
import { createWebGLRuntime } from "<runtime-package>";

const runtime = createWebGLRuntime({
  container,
  effects: [appSurfaceEffect, appPointerEffect],
});

runtime.registerTarget(element, {
  key: "hero.surface",
  source: { kind: "snapshot", mode: "element" },
  effects: [{ kind: "app.surface", opacity: 0.82 }],
});

runtime.sync();
```

Rules:

- Keep the runtime-level `effects` array reference stable. In React, define it at
  module scope or memoize it.
- Every target key must be stable and unique inside one runtime.
- Target `webgl.effects` contains data only. The executable effect definition is
  registered at runtime level.
- Do not create nested runtimes unless the application intentionally needs
  independent canvases and lifecycle ownership.

## Target Declaration

Minimum target:

```ts
const declaration: WebGLDeclaration = {
  key: "card.primary",
  source: { kind: "snapshot", mode: "element" },
};
```

Effect target:

```ts
const declaration: WebGLDeclaration = {
  key: "model.hero",
  source: { kind: "model", format: "glb", src: "/models/hero.glb" },
  lifecycle: { hideWhenReady: true, hideMode: "subtree" },
  effects: [
    { kind: "app.modelRotate", speed: 0.15 },
    { kind: "app.modelParticles", color: "rgb(255, 0, 0)", density: 2 },
  ],
};
```

Supported source declarations:

- `{ kind: "snapshot", mode?: "element" | "text" }`
- `{ kind: "image", src?: string }`
- `{ kind: "video", src?: string }`
- `{ kind: "model", format: "glb", src: string }`

Lifecycle rules:

- `hideWhenReady: true` is the default for registered targets.
- `hideWhenReady: false` keeps DOM fallback visible.
- `hideMode: "self"` hides the target node after WebGL readiness.
- `hideMode: "subtree"` hides the target subtree after WebGL readiness.
- Failed or pending renderables keep fallback DOM visible.

## Custom Effect Contract

Define effects with `defineWebGLEffect(...)`:

```ts
import { defineWebGLEffect } from "<runtime-package>";

type AppSurfaceParams = {
  kind: "app.surface";
  opacity?: number;
};

export const appSurfaceEffect = defineWebGLEffect<AppSurfaceParams>({
  kind: "app.surface",
  source: "snapshot/element",
  update(ctx, _state, params) {
    ctx.target?.setVisible(true);
    ctx.target?.setOpacity(clampNumber(params.opacity, 0, 1, 1));
  },
});

function clampNumber(
  value: number | undefined,
  min: number,
  max: number,
  fallback: number,
): number {
  if (value === undefined || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, value));
}
```

Stateful effect:

```ts
type AppPulseParams = {
  kind: "app.pulse";
  strength?: number;
};

type AppPulseState = {
  phase: number;
};

export const appPulseEffect = defineWebGLEffect<AppPulseParams, AppPulseState>({
  kind: "app.pulse",
  setup(ctx) {
    ctx.resources.addDisposable(() => {
      // Dispose effect-owned listeners, objects, or handles.
    });

    return { phase: 0 };
  },
  update(ctx, state, params) {
    state.phase += ctx.delta / 1000;
    const strength = clampNumber(params.strength, 0, 2, 1);
    ctx.target?.setScale(1 + Math.sin(state.phase) * 0.04 * strength);
  },
});
```

Rules:

- `kind` in the definition must exactly match target declaration `kind`.
- Use namespaced kinds such as `app.surface`, `brand.heroParticles`, or
  `product.galleryTilt`.
- Do not use generic global names such as `fade`, `rotate`, or `particles`.
- Use `source` on the definition to restrict compatible source handles.
- Always tolerate `ctx.target === undefined`.
- Always narrow `ctx.source.kind` before using source-specific fields.
- Clamp all untrusted numeric params.
- Use `ctx.delta` for motion. Do not rely on frame count.
- Create expensive resources in `setup`, not `update`.
- Dispose effect-owned resources through `ctx.resources`.

## Effect Context

Use context fields as the single runtime truth:

- `ctx.key`: target key.
- `ctx.layout`: current DOM layout snapshot and viewport size.
- `ctx.input`: full frame input.
- `ctx.pointer`: pointer state for the runtime coordinate element.
- `ctx.scroll`: page or gate scroll state.
- `ctx.scrollProgress`: active progress value for current scroll mode.
- `ctx.time`: runtime time in milliseconds.
- `ctx.delta`: frame delta in milliseconds.
- `ctx.source`: source handle.
- `ctx.target`: runtime target controls, if available.
- `ctx.resources`: effect-owned resource scope.

Pointer rule:

- `ctx.pointer.normalizedX/Y` are runtime-coordinate values.
- If an effect needs target-local hit testing, map pointer coordinates through
  `ctx.layout`.
- If an effect hit-tests a transformed model, project through the model's current
  transform before comparing positions.

## Source Handles

Narrow by `ctx.source.kind`:

```ts
if (ctx.source.kind !== "model/glb") {
  return;
}

const model = ctx.source.model;
```

Available handles:

- `snapshot/element`: `{ element }`
- `snapshot/text`: `{ element, text }`
- `image`: `{ element, src }`
- `video`: `{ element, src }`
- `model/glb`: `{ anchor, src, model }`

Model helper rules:

- `model.object3D` is the loaded model object exposed as `unknown`.
- `model.traverseMeshes(visitor)` visits model meshes.
- `model.sampleVertices({ maxPoints })` returns model-root local vertex samples.
- `model.createPointCloud({ density, color, size })` returns a point cloud object.
- Child mesh transforms are applied when sampling vertices.
- `color` accepts numeric Three.js color values and CSS color strings such as
  `"rgb(255, 0, 0)"`.

## Target Handles

Use optional chaining:

```ts
ctx.target?.setVisible(true);
ctx.target?.setRotation(0, ctx.pointer.normalizedX * 0.2, 0);
ctx.target?.setScale(1.05);
ctx.target?.setOpacity(0.8);
```

When adding object3D content:

```ts
const handle = ctx.target?.addObject3D?.(object3D, {
  dispose(object) {
    // Dispose object-owned geometry/material/texture if this effect owns it.
  },
});

ctx.resources.addDisposable(() => handle?.dispose());
```

Do not mutate target internals that are not exposed by the handle.

## Resource Ownership

Effects may own:

- temporary Three.js objects created by the effect;
- event listeners created by the effect;
- generated geometries/materials/textures;
- per-effect mutable state.

Effects must not own:

- the renderer;
- the runtime;
- the runtime canvas;
- the main animation loop;
- global scroll/pointer systems;
- package-internal registries.

If an effect mutates a source model's mesh visibility, material, rotation, scale,
or position, store previous values and restore them on dispose unless the effect
is explicitly the long-term owner of that mutation.

## Package Boundary

MUST:

- Treat the package as a reusable open-source runtime.
- Keep app-specific visual effects in the downstream application.
- Ask for a generic public API before relying on package internals.
- Keep DOM as the source for layout, content, accessibility, and interaction
  state.

DO NOT:

- Depend on example app code, example assets, example target keys, or workspace
  paths.
- Import private source files from the package.
- Add concrete app visual behavior to package core.
- Add CSS-to-WebGL browser paint cloning unless explicitly requested.
- Expose raw Three.js renderer flags as declaration API without package-level
  tests, docs, and compatibility decisions.

## Validation

Minimum for downstream integration:

```bash
npm run typecheck
npm test -- --run <changed-test-files>
```

When working in this repository:

```bash
npm test -- --run <changed-test-files>
npm run typecheck
npm run check:imports
git diff --check
npm run build
```

Effect-specific tests should cover:

- unknown effect kind fails at registration or is caught by tests;
- definition `kind` matches declaration `kind`;
- unsupported `ctx.source.kind` no-ops safely;
- `setup` creates resources once;
- `update` uses `ctx.delta` for motion;
- target-local pointer math maps through `ctx.layout`;
- transformed model picking accounts for current object transform;
- `dispose` releases effect-owned resources and restores source mutations.

## Common Failures

- Unknown effect: target declares `{ kind: "x" }`, but runtime `effects` omits
  `defineWebGLEffect({ kind: "x" })`.
- Runtime recreates in React: `effects` array identity changes on render.
- Pointer offset: effect compares runtime normalized pointer coordinates directly
  to target-local coordinates.
- Rotating model interaction drift: effect hit-tests unrotated model-local
  vertices while visible model is transformed.
- Resource leak: effect creates objects/listeners without `ctx.resources`.
- Boundary violation: app imports package internals or example-only code.

## Agent Completion Report

When finishing package usage or custom effect work, report:

- package entrypoints used;
- runtime registration location;
- target declaration location;
- effect kind(s);
- supported source kind(s);
- resource ownership and dispose behavior;
- tests and verification commands run;
- remaining visual tuning parameters, if any.
