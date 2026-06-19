# Phase 8 Custom Effect Authoring API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make user-authored effects the single effect model: core registers no default effects, runtime supplies managed context, and official effects become optional presets implemented with the same public API.

**Architecture:** Runtime continues to own DOM layout, source loading, frame input, scene attachment, resource lifetime, and disposal. Effect authors write small `setup` / `update` / `dispose` functions against a managed context containing layout, pointer, scroll, time, source handles, target handles, and effect-owned resources. Phase 7 registry dispatch remains useful internally, but the public mental model shifts from "register plugins against existing capabilities" to "define effects and pass them to the runtime."

**Tech Stack:** TypeScript, Vitest, jsdom, Three.js internal renderable adapters, React/Vite demo app.

---

## Implementation Status

Implemented in the Phase 8 branch. The public authoring model is
`defineWebGLEffect(...)` plus runtime-level `effects`; core does not register
default visual effects; official `surfaceBasicEffect` and `pointerTiltEffect`
presets are exported from `@project/dom-webgl-runtime/effects`; and the demo
opts into those presets through public package entrypoints with a stable
runtime-level effect definition array so debug-state re-renders do not recreate
the runtime.

The implementation keeps Three-backed GLB source helpers beside the GLB
renderable adapter rather than inside the pure effects module, preserving the
effect boundary while still exposing managed `model/glb` source handles to
effect authors.

## Current Truth

- Phase 7 exposes `createWebGLEffectRegistry(...)`, `WebGLEffectPlugin`, and `<WebGLRuntime effectRegistry={registry}>`.
- Built-in `material.solid`, `surface.basic`, and `motion.pointerTilt` are registered by default inside `createWebGLEffectController(...)`.
- User-defined effects can run only through the currently exposed target capability methods: `applySolidMaterial`, `applySurfaceMaterial`, and `setRotation`.
- `model/glb` renderables already load a runtime-owned object, attach it through `createModelSceneRenderableController(...)`, and expose only the existing `setRotation` effect target.
- This is not enough for the intended user model where authors can write their own GLB particles, shader-ish transforms, or source-aware visual behavior from runtime-managed input and resources.

## Design Decision

Do not keep both "built-in effect declarations" and "custom effect registry" as equal public concepts. That splits the author mental model and makes custom effects look secondary.

Phase 8 should use one public model:

```ts
const glbParticles = defineWebGLEffect({
  kind: "glbParticles",
  source: "model/glb",
  setup(ctx, params) {
    const points = ctx.source.model.createPointCloud({
      density: params.density ?? 0.5,
    });
    const layer = ctx.target?.addObject3D(points);

    return { layer };
  },
  update(ctx, state) {
    state.layer?.setVisible(true);
    state.layer?.setProgress?.(ctx.scrollProgress);
    state.layer?.setPointer?.(ctx.pointer.normalizedX, ctx.pointer.normalizedY);
  },
});

createWebGLRuntime({
  container,
  effects: [glbParticles],
});
```

Target declarations stay data-only:

```ts
runtime.registerTarget(element, {
  key: "product.model",
  source: { kind: "model", format: "glb", src: "/product.glb" },
  effects: [{ kind: "glbParticles", density: 0.6 }],
});
```

Official effects may still exist, but only as optional presets:

```ts
import { pointerTiltEffect, surfaceBasicEffect } from "@project/dom-webgl-runtime/effects";

createWebGLRuntime({
  container,
  effects: [surfaceBasicEffect, pointerTiltEffect],
});
```

Those presets must use the same `defineWebGLEffect(...)` API as user code. Core must not auto-register them.

## Non-Goals

- Do not implement a complete GLB particle visual in this phase unless it is needed as a tiny smoke preset. The phase should enable user-authored GLB effects first.
- Do not expose `renderer`, `camera`, or raw scene mutation as the default API.
- Do not add multiple canvases, picking, third-party scroll adapters, or CSS paint cloning.
- Do not let effects create their own renderer, scan DOM, install global pointer listeners, or own independent source loading.
- Do not keep public docs centered on `effectRegistry` after the authoring API exists.

## Target Public Contract

Root exports:

```ts
export {
  defineWebGLEffect,
  type WebGLEffectDefinition,
  type WebGLEffectContext,
  type WebGLEffectSetupContext,
  type WebGLEffectUpdateContext,
  type WebGLEffectResourceScope,
  type WebGLEffectSourceHandle,
  type WebGLEffectManagedObjectHandle,
  type WebGLEffectTargetHandle,
} from "./lib/effects/effectAuthoring";
```

Runtime options:

```ts
export type WebGLRuntimeOptions = {
  container: HTMLElement;
  effects?: readonly WebGLEffectDefinition[];
  onDebugStateChange?: (state: WebGLDebugState) => void;
};
```

React adapter:

```ts
export type WebGLRuntimeProps = {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  effects?: WebGLRuntimeOptions["effects"];
  onDebugStateChange?: (state: WebGLDebugState) => void;
};
```

Effect definition:

```ts
export type WebGLEffectDefinition<
  TParams extends WebGLEffectDeclaration = WebGLEffectDeclaration,
  TState = void,
> = {
  readonly kind: TParams["kind"];
  readonly source?: WebGLEffectSourceKind | readonly WebGLEffectSourceKind[];
  setup?(context: WebGLEffectSetupContext, params: TParams): TState;
  update(context: WebGLEffectUpdateContext, state: TState, params: TParams): void;
  dispose?(
    context: WebGLEffectContext,
    state: TState,
    params: TParams,
  ): void;
};

export function defineWebGLEffect<
  TParams extends WebGLEffectDeclaration,
  TState = void,
>(
  definition: WebGLEffectDefinition<TParams, TState>,
): WebGLEffectDefinition<TParams, TState> {
  return definition;
}
```

Context shape:

```ts
export type WebGLEffectContext = {
  key: string;
  sourceKind: WebGLEffectSourceKind;
  layout: ElementLayoutSnapshot;
  input: WebGLFrameInput;
  pointer: WebGLFrameInput["pointer"];
  scroll: WebGLFrameInput["scroll"];
  scrollProgress: number;
  time: number;
  delta: number;
  source: WebGLEffectSourceHandle;
  target: WebGLEffectTargetHandle | undefined;
  resources: WebGLEffectResourceScope;
};
```

Source handles:

```ts
export type WebGLEffectSourceHandle =
  | { kind: "snapshot/element"; element: HTMLElement }
  | { kind: "snapshot/text"; element: HTMLElement; text: string }
  | { kind: "image"; element: HTMLImageElement; src: string }
  | { kind: "video"; element: HTMLVideoElement; src: string }
  | { kind: "model/glb"; anchor: HTMLElement; src: string; model: WebGLModelEffectHandle };
```

The initial model handle should expose a managed, source-aware API instead of `renderer` or `scene`:

```ts
export type WebGLModelEffectHandle = {
  readonly object3D: unknown;
  traverseMeshes(visitor: (mesh: unknown) => void): void;
  sampleVertices(options?: { maxPoints?: number }): Float32Array;
  createPointCloud(options: {
    density?: number;
    color?: number;
    size?: number;
  }): unknown;
};
```

The `object3D` field is intentionally typed as `unknown` from the root public contract. A future Three-specific authoring subpath may narrow it to Three.js types if we decide to support a documented advanced API.

Managed resources:

```ts
export type WebGLEffectResourceScope = {
  addDisposable(dispose: () => void): void;
  createObject3D<TObject>(factory: () => TObject, dispose?: (object: TObject) => void): TObject;
  dispose(): void;
};
```

Target handle:

```ts
export type WebGLEffectTargetHandle = {
  setVisible(visible: boolean): void;
  setRotation(x: number, y: number, z?: number): void;
  setScale(x: number, y?: number, z?: number): void;
  setOpacity(opacity: number): void;
  addObject3D?(
    object3D: unknown,
    options?: { dispose?: (object3D: unknown) => void },
  ): WebGLEffectManagedObjectHandle;
};

export type WebGLEffectManagedObjectHandle = {
  setVisible(visible: boolean): void;
  remove(): void;
  dispose(): void;
  setProgress?(progress: number): void;
  setPointer?(x: number, y: number): void;
};
```

## File Map

Authoring contracts:

- Create: `packages/dom-webgl-runtime/src/lib/effects/effectAuthoring.ts`
- Create: `packages/dom-webgl-runtime/src/lib/effects/effectAuthoring.test.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/effects/effectPlugin.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/effects/effectRegistry.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/types.ts`
- Modify: `packages/dom-webgl-runtime/src/index.ts`
- Modify: `packages/dom-webgl-runtime/src/react.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/react/WebGLRuntime.tsx`

Controller and runtime wiring:

- Modify: `packages/dom-webgl-runtime/src/lib/effects/effectController.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/effects/effectController.test.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderable.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderableFactory.ts`

Source and target handles:

- Create: `packages/dom-webgl-runtime/src/lib/effects/effectContext.ts`
- Create: `packages/dom-webgl-runtime/src/lib/effects/effectResources.ts`
- Create: `packages/dom-webgl-runtime/src/lib/effects/modelEffectHandle.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/effects/effectTarget.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/modelRenderable.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/sceneRenderableObject.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/effectTargets/elementPlaneEffectTarget.ts`

Optional presets:

- Create: `packages/dom-webgl-runtime/src/effects.ts`
- Create: `packages/dom-webgl-runtime/src/lib/effects/presets/surfaceBasicEffect.ts`
- Create: `packages/dom-webgl-runtime/src/lib/effects/presets/pointerTiltEffect.ts`
- Create: `packages/dom-webgl-runtime/src/lib/effects/presets/index.ts`
- Move/replace: `packages/dom-webgl-runtime/src/lib/effects/builtins/*`
- Modify: `packages/dom-webgl-runtime/package.json`

Demo, tests, docs:

- Modify: `packages/dom-webgl-runtime/src/publicExports.test.ts`
- Modify: `apps/demo/src/App.tsx`
- Modify: `apps/demo/src/App.test.tsx`
- Modify: `README.md`
- Modify: `docs/00-goal.md`
- Modify: `docs/EXECUTION_STATE.md`

## Task 1: Public Authoring Contract Tests

**Files:**
- Modify: `packages/dom-webgl-runtime/src/publicExports.test.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/types.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/react/WebGLRuntime.tsx`

- [ ] **Step 1: Write failing root public API type coverage**

Add this to the root-entrypoint fixture in `packages/dom-webgl-runtime/src/publicExports.test.ts`:

```ts
import {
  createWebGLRuntime,
  defineWebGLEffect,
} from "${importPath}";
import type {
  WebGLEffectContext,
  WebGLEffectDefinition,
  WebGLEffectResourceScope,
  WebGLEffectSourceHandle,
  WebGLEffectTargetHandle,
  WebGLRuntimeOptions,
} from "${importPath}";

const customModelEffect = defineWebGLEffect({
  kind: "custom.glbParticles",
  source: "model/glb",
  setup(ctx, params: { kind: "custom.glbParticles"; density?: number }) {
    ctx.source satisfies WebGLEffectSourceHandle;
    ctx.target satisfies WebGLEffectTargetHandle | undefined;
    ctx.resources satisfies WebGLEffectResourceScope;
    return {
      density: params.density ?? 0.5,
      scrollAtSetup: ctx.scrollProgress,
    };
  },
  update(ctx, state) {
    ctx satisfies WebGLEffectContext;
    state.density satisfies number;
    ctx.target?.setRotation(0, ctx.pointer.normalizedX);
  },
}) satisfies WebGLEffectDefinition<
  { kind: "custom.glbParticles"; density?: number },
  { density: number; scrollAtSetup: number }
>;

const runtimeOptions = {
  container: element,
  effects: [customModelEffect],
} satisfies WebGLRuntimeOptions;

const customRuntime = createWebGLRuntime(runtimeOptions);
customRuntime.registerTarget(element, {
  key: "product.model",
  source: { kind: "model", format: "glb", src: "/product.glb" },
  effects: [{ kind: "custom.glbParticles", density: 0.6 }],
});
```

Remove the public `createWebGLEffectRegistry` happy-path assertion from this fixture. Keep any backwards-compatibility checks only if the implementation explicitly retains deprecated exports.

- [ ] **Step 2: Write failing React prop type coverage**

In the React entrypoint fixture, replace `effectRegistry` usage with:

```tsx
declare const effects: WebGLRuntimeProps["effects"];

const runtimeElement = (
  <WebGLRuntime effects={effects}>
    <WebGLTarget
      declaration={{
        key: "react.custom-effect",
        effects: [{ kind: "custom.reactEffect" }],
      }}
    >
      <div />
    </WebGLTarget>
  </WebGLRuntime>
);

runtimeElement satisfies JSX.Element;
```

- [ ] **Step 3: Run tests and verify RED**

Run:

```bash
npm test -- packages/dom-webgl-runtime/src/publicExports.test.ts
```

Expected: FAIL because `defineWebGLEffect`, `WebGLEffectDefinition`, `WebGLEffectContext`, `WebGLEffectResourceScope`, and `WebGLRuntimeOptions.effects` do not exist.

## Task 2: Add `defineWebGLEffect` Authoring Types

**Files:**
- Create: `packages/dom-webgl-runtime/src/lib/effects/effectAuthoring.ts`
- Create: `packages/dom-webgl-runtime/src/lib/effects/effectAuthoring.test.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/types.ts`
- Modify: `packages/dom-webgl-runtime/src/index.ts`

- [ ] **Step 1: Add the authoring module**

Create `packages/dom-webgl-runtime/src/lib/effects/effectAuthoring.ts`:

```ts
import type { ElementLayoutSnapshot } from "../renderer/layoutPass";
import type {
  WebGLEffectDeclaration,
  WebGLFrameInput,
} from "../types";
import type { WebGLEffectSourceKind } from "./effectPlugin";

export type WebGLEffectResourceScope = {
  addDisposable(dispose: () => void): void;
  createObject3D<TObject>(
    factory: () => TObject,
    dispose?: (object: TObject) => void,
  ): TObject;
  dispose(): void;
};

export type WebGLEffectTargetHandle = {
  setVisible(visible: boolean): void;
  setRotation(x: number, y: number, z?: number): void;
  setScale(x: number, y?: number, z?: number): void;
  setOpacity(opacity: number): void;
  addObject3D?(
    object3D: unknown,
    options?: { dispose?: (object3D: unknown) => void },
  ): WebGLEffectManagedObjectHandle;
};

export type WebGLEffectManagedObjectHandle = {
  setVisible(visible: boolean): void;
  remove(): void;
  dispose(): void;
  setProgress?(progress: number): void;
  setPointer?(x: number, y: number): void;
};

export type WebGLModelEffectHandle = {
  readonly object3D: unknown;
  traverseMeshes(visitor: (mesh: unknown) => void): void;
  sampleVertices(options?: { maxPoints?: number }): Float32Array;
  createPointCloud(options: {
    density?: number;
    color?: number;
    size?: number;
  }): unknown;
};

export type WebGLEffectSourceHandle =
  | { kind: "snapshot/element"; element: HTMLElement }
  | { kind: "snapshot/text"; element: HTMLElement; text: string }
  | { kind: "image"; element: HTMLImageElement; src: string }
  | { kind: "video"; element: HTMLVideoElement; src: string }
  | {
      kind: "model/glb";
      anchor: HTMLElement;
      src: string;
      model: WebGLModelEffectHandle;
    };

export type WebGLEffectContext = {
  key: string;
  sourceKind: WebGLEffectSourceKind;
  layout: ElementLayoutSnapshot;
  input: WebGLFrameInput;
  pointer: WebGLFrameInput["pointer"];
  scroll: WebGLFrameInput["scroll"];
  scrollProgress: number;
  time: number;
  delta: number;
  source: WebGLEffectSourceHandle;
  target: WebGLEffectTargetHandle | undefined;
  resources: WebGLEffectResourceScope;
};

export type WebGLEffectSetupContext = WebGLEffectContext;
export type WebGLEffectUpdateContext = WebGLEffectContext;

export type WebGLEffectDefinition<
  TParams extends WebGLEffectDeclaration = WebGLEffectDeclaration,
  TState = void,
> = {
  readonly kind: TParams["kind"];
  readonly source?: WebGLEffectSourceKind | readonly WebGLEffectSourceKind[];
  setup?(context: WebGLEffectSetupContext, params: TParams): TState;
  update(
    context: WebGLEffectUpdateContext,
    state: TState,
    params: TParams,
  ): void;
  dispose?(
    context: WebGLEffectContext,
    state: TState,
    params: TParams,
  ): void;
};

export function defineWebGLEffect<
  TParams extends WebGLEffectDeclaration,
  TState = void,
>(
  definition: WebGLEffectDefinition<TParams, TState>,
): WebGLEffectDefinition<TParams, TState> {
  return definition;
}
```

- [ ] **Step 2: Add focused authoring tests**

Create `packages/dom-webgl-runtime/src/lib/effects/effectAuthoring.test.ts`:

```ts
import { describe, expect, test } from "vitest";

import { defineWebGLEffect } from "./effectAuthoring";

describe("defineWebGLEffect", () => {
  test("returns the definition unchanged so authors can keep stable references", () => {
    const definition = {
      kind: "custom.test",
      update() {
        return;
      },
    } as const;

    expect(defineWebGLEffect(definition)).toBe(definition);
  });
});
```

- [ ] **Step 3: Add runtime options**

Modify `packages/dom-webgl-runtime/src/lib/types.ts`:

```ts
import type { WebGLEffectDefinition } from "./effects/effectAuthoring";
```

Replace `effectRegistry?: WebGLEffectRegistry;` with:

```ts
effects?: readonly WebGLEffectDefinition[];
```

Remove the `WebGLEffectRegistry` import from this file.

- [ ] **Step 4: Export the authoring contract**

Modify `packages/dom-webgl-runtime/src/index.ts`:

```ts
export {
  defineWebGLEffect,
  type WebGLEffectContext,
  type WebGLEffectDefinition,
  type WebGLEffectResourceScope,
  type WebGLEffectSetupContext,
  type WebGLEffectSourceHandle,
  type WebGLEffectManagedObjectHandle,
  type WebGLEffectTargetHandle,
  type WebGLEffectUpdateContext,
  type WebGLModelEffectHandle,
} from "./lib/effects/effectAuthoring";
```

Do not export `createWebGLEffectRegistry` from the root public entrypoint after this task unless a compatibility task explicitly keeps it under a deprecated subpath.

- [ ] **Step 5: Verify authoring types**

Run:

```bash
npm test -- packages/dom-webgl-runtime/src/lib/effects/effectAuthoring.test.ts packages/dom-webgl-runtime/src/publicExports.test.ts
```

Expected: `effectAuthoring.test.ts` passes; `publicExports.test.ts` may still fail until runtime and React wiring are added.

## Task 3: Replace Public Registry Wiring With Runtime Effects

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/effects/effectRegistry.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/effects/effectController.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/effects/effectController.test.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/react/WebGLRuntime.tsx`

- [ ] **Step 1: Make the registry internal and definition-based**

Update `packages/dom-webgl-runtime/src/lib/effects/effectRegistry.ts`:

```ts
import type { WebGLEffectDefinition } from "./effectAuthoring";

export type WebGLEffectRegistry = {
  resolve(kind: string): WebGLEffectDefinition | undefined;
  list(): readonly WebGLEffectDefinition[];
};

export function createWebGLEffectRegistry(
  effects: readonly WebGLEffectDefinition[] = [],
): WebGLEffectRegistry {
  const byKind = new Map<string, WebGLEffectDefinition>();

  for (const effect of effects) {
    if (byKind.has(effect.kind)) {
      throw new Error(`WebGL effect "${effect.kind}" is already registered.`);
    }

    byKind.set(effect.kind, effect);
  }

  return {
    resolve(kind) {
      return byKind.get(kind);
    },
    list() {
      return [...byKind.values()];
    },
  };
}
```

- [ ] **Step 2: Remove default built-ins from controller creation**

In `packages/dom-webgl-runtime/src/lib/effects/effectController.ts`, replace:

```ts
const registry =
  options.registry ?? createWebGLEffectRegistry(builtInWebGLEffectPlugins);
```

with:

```ts
const registry = options.registry ?? createWebGLEffectRegistry();
```

Remove the `builtInWebGLEffectPlugins` import.

- [ ] **Step 3: Thread `options.effects` through runtime**

In `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`, change the pipeline context from:

```ts
effectRegistry: internalOptions.effectRegistry,
```

to:

```ts
effectRegistry: createWebGLEffectRegistry(options.effects ?? []),
```

Import `createWebGLEffectRegistry` from `../effects/effectRegistry`.

- [ ] **Step 4: Replace React prop**

In `packages/dom-webgl-runtime/src/lib/react/WebGLRuntime.tsx`, replace the `effectRegistry` prop with `effects`:

```tsx
export type WebGLRuntimeProps = {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  effects?: WebGLRuntimeOptions["effects"];
  onDebugStateChange?: (state: WebGLDebugState) => void;
};
```

Pass it into runtime creation:

```tsx
const nextRuntime = createWebGLRuntime({
  container,
  effects,
  onDebugStateChange(state) {
    onDebugStateChangeRef.current?.(state);
  },
});
```

Use `[effects]` as the effect dependency.

- [ ] **Step 5: Verify no default effects**

Add or update an `effectController.test.ts` case:

```ts
test("does not register preset effects by default", () => {
  expect(() =>
    createWebGLEffectController({
      key: "hero",
      declaration: [{ kind: "surface.basic" }],
      source: createElementSnapshotSource(),
      target: createEffectTarget(),
    }),
  ).toThrow(
    'WebGL target "hero" references unknown effect "surface.basic". Register it through createWebGLRuntime({ effects: [...] }).',
  );
});
```

Update the unknown-effect error in `effectController.ts` to include the registration hint above.

- [ ] **Step 6: Run tests and verify RED/GREEN progression**

Run:

```bash
npm test -- packages/dom-webgl-runtime/src/lib/effects/effectRegistry.test.ts packages/dom-webgl-runtime/src/lib/effects/effectController.test.ts packages/dom-webgl-runtime/src/publicExports.test.ts
```

Expected: registry and controller tests pass after updates; public exports still fail only if later context types are incomplete.

## Task 4: Add Effect Lifecycle State and Context Construction

**Files:**
- Create: `packages/dom-webgl-runtime/src/lib/effects/effectContext.ts`
- Create: `packages/dom-webgl-runtime/src/lib/effects/effectResources.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/effects/effectController.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/effects/effectController.test.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderable.ts`

- [ ] **Step 1: Add managed resource scope**

Create `packages/dom-webgl-runtime/src/lib/effects/effectResources.ts`:

```ts
import type { WebGLEffectResourceScope } from "./effectAuthoring";

export function createWebGLEffectResourceScope(): WebGLEffectResourceScope {
  const disposables: Array<() => void> = [];
  let disposed = false;

  return {
    addDisposable(dispose) {
      if (disposed) {
        dispose();
        return;
      }

      disposables.push(dispose);
    },
    createObject3D(factory, dispose) {
      const object = factory();

      if (dispose) {
        this.addDisposable(() => dispose(object));
      }

      return object;
    },
    dispose() {
      if (disposed) {
        return;
      }

      disposed = true;
      for (const dispose of disposables.splice(0).reverse()) {
        dispose();
      }
    },
  };
}
```

- [ ] **Step 2: Add context builder**

Create `packages/dom-webgl-runtime/src/lib/effects/effectContext.ts`:

```ts
import type { ElementLayoutSnapshot } from "../renderer/layoutPass";
import type { WebGLFrameInput } from "../types";
import type {
  WebGLEffectContext,
  WebGLEffectResourceScope,
  WebGLEffectSourceHandle,
  WebGLEffectTargetHandle,
} from "./effectAuthoring";
import type { WebGLEffectSourceKind } from "./effectPlugin";

export type WebGLEffectContextOptions = {
  key: string;
  sourceKind: WebGLEffectSourceKind;
  layout: ElementLayoutSnapshot;
  input: WebGLFrameInput;
  source: WebGLEffectSourceHandle;
  target?: WebGLEffectTargetHandle;
  resources: WebGLEffectResourceScope;
};

export function createWebGLEffectContext(
  options: WebGLEffectContextOptions,
): WebGLEffectContext {
  return {
    key: options.key,
    sourceKind: options.sourceKind,
    layout: options.layout,
    input: options.input,
    pointer: options.input.pointer,
    scroll: options.input.scroll,
    scrollProgress: readScrollProgress(options.input.scroll),
    time: options.input.time,
    delta: options.input.delta,
    source: options.source,
    target: options.target,
    resources: options.resources,
  };
}

function readScrollProgress(input: WebGLFrameInput["scroll"]): number {
  return input.mode === "gate" ? input.sceneProgress : input.pageProgress;
}
```

- [ ] **Step 3: Extend renderables with effect source handles**

Modify `packages/dom-webgl-runtime/src/lib/render/renderable.ts`:

```ts
import type { WebGLEffectSourceHandle } from "../effects/effectAuthoring";
```

Add to `Renderable`:

```ts
readonly effectSource?: WebGLEffectSourceHandle;
```

Add to `RenderableHooks`:

```ts
effectSource?(): WebGLEffectSourceHandle | undefined;
```

Add to `createRenderable(...)` return object:

```ts
get effectSource() {
  return hooks.effectSource?.();
},
```

- [ ] **Step 4: Rewrite controller lifecycle**

Update `createWebGLEffectController(...)` so each declaration creates an entry:

```ts
type RunningEffect = {
  definition: WebGLEffectDefinition;
  params: WebGLEffectDeclaration;
  resources: WebGLEffectResourceScope;
  state: unknown;
  initialized: boolean;
};
```

On `update(input, layout)`, build context and call `setup` once:

```ts
const context = createWebGLEffectContext({
  key: options.key,
  sourceKind,
  input,
  layout,
  source,
  target,
  resources: effect.resources,
});

if (!effect.initialized) {
  effect.state = effect.definition.setup?.(context, effect.params);
  effect.initialized = true;
}

effect.definition.update(context, effect.state as never, effect.params as never);
```

The controller options must include:

```ts
getSource(): WebGLEffectSourceHandle | undefined;
getTarget?(): WebGLEffectTargetHandle | undefined;
```

If `getSource()` returns `undefined`, skip setup/update for that frame. This lets async GLB loading finish before model effects run.

- [ ] **Step 5: Dispose effect state and resources**

In controller `dispose()`:

```ts
for (const effect of effects) {
  if (effect.initialized) {
    const source = readEffectSource(options);
    const target = readEffectTarget(options);
    if (source) {
      effect.definition.dispose?.(
        createWebGLEffectContext({
          key: options.key,
          sourceKind,
          input: createEmptyFrameInput(),
          layout: createEmptyLayoutSnapshot(),
          source,
          target,
          resources: effect.resources,
        }),
        effect.state as never,
        effect.params as never,
      );
    }
  }

  effect.resources.dispose();
}
```

Use small local helpers for empty input/layout only if existing state is unavailable at dispose time. Prefer storing the last successful context on each running effect so dispose receives real values.

- [ ] **Step 6: Verify setup/update/dispose ordering**

Add tests to `effectController.test.ts`:

```ts
test("runs setup once, update every frame, and dispose once", () => {
  const setup = vi.fn(() => ({ count: 0 }));
  const update = vi.fn((_context, state: { count: number }) => {
    state.count += 1;
  });
  const dispose = vi.fn();
  const controller = createWebGLEffectController({
    key: "hero",
    declaration: [{ kind: "custom.counter" }],
    source: createElementSnapshotSource(),
    getSource: () => createElementEffectSource(),
    target: createEffectTarget(),
    registry: createWebGLEffectRegistry([
      defineWebGLEffect({
        kind: "custom.counter",
        source: "snapshot/element",
        setup,
        update,
        dispose,
      }),
    ]),
  });

  controller.update(createFrameInput(), createLayoutSnapshot());
  controller.update(createFrameInput(), createLayoutSnapshot());
  controller.dispose();
  controller.dispose();

  expect(setup).toHaveBeenCalledTimes(1);
  expect(update).toHaveBeenCalledTimes(2);
  expect(dispose).toHaveBeenCalledTimes(1);
});
```

Run:

```bash
npm test -- packages/dom-webgl-runtime/src/lib/effects/effectController.test.ts
```

Expected: PASS.

## Task 5: Add Source Handles for Snapshot, Image, Video, and GLB

**Files:**
- Create: `packages/dom-webgl-runtime/src/lib/effects/modelEffectHandle.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/elementSnapshotRenderable.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/textSnapshotRenderable.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/imageRenderable.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/videoRenderable.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/modelRenderable.ts`

- [ ] **Step 1: Add the model effect handle**

Create `packages/dom-webgl-runtime/src/lib/effects/modelEffectHandle.ts`:

```ts
import { BufferGeometry } from "three/src/core/BufferGeometry.js";
import { BufferAttribute } from "three/src/core/BufferAttribute.js";
import { Points } from "three/src/objects/Points.js";
import { PointsMaterial } from "three/src/materials/PointsMaterial.js";

import type { WebGLModelEffectHandle } from "./effectAuthoring";

export function createModelEffectHandle(object3D: unknown): WebGLModelEffectHandle {
  return {
    object3D,
    traverseMeshes(visitor) {
      traverseObject(object3D, (candidate) => {
        if (isMeshLike(candidate)) {
          visitor(candidate);
        }
      });
    },
    sampleVertices(options = {}) {
      return sampleModelVertices(object3D, options.maxPoints ?? 2048);
    },
    createPointCloud(options) {
      const vertices = sampleModelVertices(
        object3D,
        Math.max(1, Math.floor(2048 * (options.density ?? 1))),
      );
      const geometry = new BufferGeometry();
      geometry.setAttribute("position", new BufferAttribute(vertices, 3));
      const material = new PointsMaterial({
        color: options.color ?? 0xffffff,
        size: options.size ?? 0.02,
      });

      return new Points(geometry, material);
    },
  };
}

function traverseObject(object3D: unknown, visitor: (object: unknown) => void): void {
  if (!object3D || typeof object3D !== "object") {
    return;
  }

  visitor(object3D);

  const children = (object3D as { children?: unknown }).children;
  if (Array.isArray(children)) {
    for (const child of children) {
      traverseObject(child, visitor);
    }
  }
}

function isMeshLike(object: unknown): boolean {
  return Boolean(
    object &&
      typeof object === "object" &&
      "geometry" in object &&
      (object as { geometry?: unknown }).geometry,
  );
}

function sampleModelVertices(object3D: unknown, maxPoints: number): Float32Array {
  const vertices: number[] = [];

  traverseObject(object3D, (candidate) => {
    const position = (candidate as {
      geometry?: { attributes?: { position?: { array?: ArrayLike<number>; count?: number } } };
    }).geometry?.attributes?.position;

    if (!position?.array || !position.count) {
      return;
    }

    const stride = Math.max(1, Math.ceil(position.count / Math.max(1, maxPoints)));
    for (let index = 0; index < position.count; index += stride) {
      const offset = index * 3;
      vertices.push(
        Number(position.array[offset] ?? 0),
        Number(position.array[offset + 1] ?? 0),
        Number(position.array[offset + 2] ?? 0),
      );
      if (vertices.length / 3 >= maxPoints) {
        return;
      }
    }
  });

  return new Float32Array(vertices);
}
```

- [ ] **Step 2: Expose `effectSource` from each renderable**

For element snapshot renderables, return:

```ts
effectSource() {
  return { kind: "snapshot/element", element: context.descriptor.element };
}
```

For text snapshot renderables, return:

```ts
effectSource() {
  return {
    kind: "snapshot/text",
    element: context.descriptor.element,
    text: context.descriptor.element.textContent ?? "",
  };
}
```

For image renderables, return:

```ts
effectSource() {
  return {
    kind: "image",
    element: source.element,
    src: source.src,
  };
}
```

For video renderables, return:

```ts
effectSource() {
  return {
    kind: "video",
    element: source.element,
    src: source.src,
  };
}
```

For model renderables, after `object3D` is instantiated and attached, return:

```ts
effectSource() {
  if (!state.modelHandle) {
    return undefined;
  }

  return {
    kind: "model/glb",
    anchor: source.anchor,
    src: source.src,
    model: state.modelHandle,
  };
}
```

Store `state.modelHandle = createModelEffectHandle(object3D)` at the same point that `state.scene` is created.

- [ ] **Step 3: Verify GLB effect source waits until model load**

Add a runtime pipeline test:

```ts
test("runs model effects after the GLB source handle is ready", async () => {
  const updateEffect = vi.fn();
  const runtime = await createPipelineRuntime({
    loadModel: async () => ({
      scene: {
        children: [],
        clone() {
          return this;
        },
      },
    }),
    effects: [
      defineWebGLEffect({
        kind: "custom.modelProbe",
        source: "model/glb",
        update(ctx) {
          updateEffect(ctx.source);
        },
      }),
    ],
  });
  const anchor = document.createElement("div");

  runtime.registerTarget(anchor, {
    key: "product",
    source: { kind: "model", format: "glb", src: "/product.glb" },
    effects: [{ kind: "custom.modelProbe" }],
  });

  await runtime.sync();

  expect(updateEffect).toHaveBeenCalledWith(
    expect.objectContaining({
      kind: "model/glb",
      src: "/product.glb",
      model: expect.objectContaining({
        sampleVertices: expect.any(Function),
        createPointCloud: expect.any(Function),
      }),
    }),
  );

  runtime.dispose();
});
```

Run:

```bash
npm test -- packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts
```

Expected: PASS.

## Task 6: Add Managed Target Handles

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/effects/effectTarget.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/effectTargets/elementPlaneEffectTarget.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/sceneRenderableObject.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/sceneRenderableObject.test.ts`

- [ ] **Step 1: Replace capability-shaped target methods with general handles**

Modify `WebGLEffectTarget` to match the public target handle:

```ts
import type { WebGLEffectManagedObjectHandle } from "./effectAuthoring";

export type WebGLEffectTarget = {
  setVisible?(visible: boolean): void;
  setRotation?(x: number, y: number, z?: number): void;
  setScale?(x: number, y?: number, z?: number): void;
  setOpacity?(opacity: number): void;
  addObject3D?(
    object3D: unknown,
    options?: { dispose?: (object3D: unknown) => void },
  ): WebGLEffectManagedObjectHandle;
  disposeEffects?(): void;
};
```

Remove `applySolidMaterial` and `applySurfaceMaterial` from the core target handle. Surface and solid visuals move to optional presets that use `setOpacity`, managed textures, or future target APIs.

- [ ] **Step 2: Implement transform helpers**

In `elementPlaneEffectTarget.ts`, update `createElementPlaneEffectTarget(...)` and `createObject3DEffectTarget(...)` to provide:

```ts
setVisible(visible) {
  mesh.visible = visible;
},
setRotation(x, y, z) {
  setObject3DRotation(mesh, x, y, z);
},
setScale(x, y = x, z = 1) {
  setObject3DScale(mesh, x, y, z);
},
setOpacity(opacity) {
  material.opacity = opacity;
  material.transparent = opacity < 1;
  material.needsUpdate = true;
},
addObject3D(object3D, options) {
  return addManagedObject3D(object3D, options);
},
```

Add `setObject3DScale(...)` beside `setObject3DRotation(...)`. Implement
`addManagedObject3D(...)` in the scene renderable layer and pass it into the
effect target adapter. The helper must attach the object through the runtime's
existing scene adapter, remove it when the effect resource is disposed, and call
the optional disposer exactly once.

- [ ] **Step 3: Verify generic target handle**

Update `sceneRenderableObject.test.ts`:

```ts
test("exposes a generic effect target for user-authored effects", () => {
  const controller = createElementPlaneSceneRenderableController({
    key: "effect.surface",
    sceneAdapter: createSceneAdapter(),
    measureElement: () => createMeasurement(),
    element: document.createElement("section"),
  });

  controller.object.effectTarget?.setVisible?.(true);
  controller.object.effectTarget?.setRotation?.(0.1, -0.2, 0.3);
  controller.object.effectTarget?.setScale?.(1.2, 0.9, 1);
  controller.object.effectTarget?.setOpacity?.(0.4);

  expect(controller.object.visible).toBe(true);
});
```

Run:

```bash
npm test -- packages/dom-webgl-runtime/src/lib/render/renderables/sceneRenderableObject.test.ts
```

Expected: PASS.

## Task 7: Move Current Effects to Optional Presets

**Files:**
- Create: `packages/dom-webgl-runtime/src/effects.ts`
- Create: `packages/dom-webgl-runtime/src/lib/effects/presets/pointerTiltEffect.ts`
- Create: `packages/dom-webgl-runtime/src/lib/effects/presets/surfaceBasicEffect.ts`
- Create: `packages/dom-webgl-runtime/src/lib/effects/presets/index.ts`
- Modify: `packages/dom-webgl-runtime/package.json`
- Modify: `packages/dom-webgl-runtime/src/lib/effects/builtins/index.ts`

- [ ] **Step 1: Add optional preset subpath**

Modify `packages/dom-webgl-runtime/package.json`:

```json
"./effects": {
  "types": "./src/effects.ts",
  "import": "./src/effects.ts"
}
```

- [ ] **Step 2: Create pointer tilt preset**

Create `packages/dom-webgl-runtime/src/lib/effects/presets/pointerTiltEffect.ts`:

```ts
import { defineWebGLEffect } from "../effectAuthoring";

export const pointerTiltEffect = defineWebGLEffect<{
  kind: "pointerTilt";
  strength?: number;
  maxDegrees?: number;
}>({
  kind: "pointerTilt",
  update(ctx, _state, params) {
    if (!ctx.pointer.isInside) {
      ctx.target?.setRotation(0, 0);
      return;
    }

    const strength = Math.max(0, Math.min(params.strength ?? 1, 2));
    const maxDegrees = Math.max(0, Math.min(params.maxDegrees ?? 8, 30));
    const radians = (maxDegrees * Math.PI) / 180;

    ctx.target?.setRotation(
      -ctx.pointer.normalizedY * radians * strength,
      ctx.pointer.normalizedX * radians * strength,
    );
  },
});
```

- [ ] **Step 3: Create minimal visibility/opacity preset**

Create `packages/dom-webgl-runtime/src/lib/effects/presets/surfaceBasicEffect.ts`:

```ts
import { defineWebGLEffect } from "../effectAuthoring";

export const surfaceBasicEffect = defineWebGLEffect<{
  kind: "surfaceBasic";
  opacity?: number;
}>({
  kind: "surfaceBasic",
  source: "snapshot/element",
  update(ctx, _state, params) {
    ctx.target?.setVisible(true);
    ctx.target?.setOpacity(params.opacity ?? 1);
  },
});
```

This intentionally does not preserve full Phase 7 rounded surface texture behavior unless Task 6 adds a generic managed texture target. Keep the preset small; the product goal is authoring API simplicity, not reproducing every built-in visual as core behavior.

- [ ] **Step 4: Export presets**

Create `packages/dom-webgl-runtime/src/lib/effects/presets/index.ts`:

```ts
export { pointerTiltEffect } from "./pointerTiltEffect";
export { surfaceBasicEffect } from "./surfaceBasicEffect";
```

Create `packages/dom-webgl-runtime/src/effects.ts`:

```ts
export { pointerTiltEffect, surfaceBasicEffect } from "./lib/effects/presets";
```

- [ ] **Step 5: Remove default built-in aggregation**

Replace `packages/dom-webgl-runtime/src/lib/effects/builtins/index.ts` with either an empty compatibility export or delete it after updating imports. There must be no code path where `createWebGLRuntime(...)` registers presets automatically.

- [ ] **Step 6: Verify presets are optional**

Add a public export test for the subpath:

```ts
const effectsModule = await import("@project/dom-webgl-runtime/effects");
expect(effectsModule.pointerTiltEffect).toEqual(expect.objectContaining({
  kind: "pointerTilt",
}));
```

Run:

```bash
npm test -- packages/dom-webgl-runtime/src/publicExports.test.ts
```

Expected: PASS after package export fixture support is updated.

## Task 8: Update Demo to the Single Authoring Model

**Files:**
- Modify: `apps/demo/src/App.tsx`
- Modify: `apps/demo/src/App.test.tsx`

- [ ] **Step 1: Pass optional presets into the demo runtime**

In `apps/demo/src/App.tsx`, import presets:

```ts
import { pointerTiltEffect, surfaceBasicEffect } from "@project/dom-webgl-runtime/effects";
```

Pass them into the runtime:

```tsx
<WebGLRuntime
  className="demo-runtime"
  effects={[surfaceBasicEffect, pointerTiltEffect]}
  onDebugStateChange={setDebugState}
>
```

- [ ] **Step 2: Replace legacy target declarations**

Replace legacy object-form effects:

```ts
effects: {
  material: { kind: "surface", color: 0x111827, opacity: 0.84, radius: 16 },
  motion: { kind: "pointer-tilt", strength: 0.5, maxDegrees: 10 },
}
```

with single-model array declarations:

```ts
effects: [
  { kind: "surfaceBasic", opacity: 0.84 },
  { kind: "pointerTilt", strength: 0.5, maxDegrees: 10 },
]
```

- [ ] **Step 3: Update demo tests**

In `apps/demo/src/App.test.tsx`, update expectations to assert:

```ts
expect(webglRuntimeProps()).toMatchObject({
  effects: expect.arrayContaining([
    expect.objectContaining({ kind: "surfaceBasic" }),
    expect.objectContaining({ kind: "pointerTilt" }),
  ]),
});

expect(webglDeclarationFor("demo.effects.surface")).toMatchObject({
  effects: [
    { kind: "surfaceBasic", opacity: 0.84 },
    { kind: "pointerTilt", strength: 0.5, maxDegrees: 10 },
  ],
});
```

- [ ] **Step 4: Verify demo tests**

Run:

```bash
npm test -- apps/demo/src/App.test.tsx
```

Expected: PASS.

## Task 9: Runtime Pipeline Integration Tests

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts`

- [ ] **Step 1: Replace the Phase 7 custom capability test**

Replace `"runs custom registered effects through existing target capabilities"` with:

```ts
test("runs user-authored effects from runtime options", async () => {
  const setup = vi.fn(() => ({ updates: 0 }));
  const update = vi.fn((ctx, state: { updates: number }) => {
    state.updates += 1;
    ctx.target?.setVisible(true);
    ctx.target?.setRotation(0, ctx.pointer.normalizedX);
  });
  const runtime = await createPipelineRuntime({
    effects: [
      defineWebGLEffect({
        kind: "custom.visibleTilt",
        source: "snapshot/element",
        setup,
        update,
      }),
    ],
    pointerController: createPointerController({
      isInside: true,
      normalizedX: 0.5,
      normalizedY: 0,
    }),
  });
  const element = document.createElement("section");

  runtime.registerTarget(element, {
    key: "custom.surface",
    source: { kind: "snapshot", mode: "element" },
    effects: [{ kind: "custom.visibleTilt" }],
  });

  await runtime.sync();
  await runtime.sync();

  expect(setup).toHaveBeenCalledTimes(1);
  expect(update).toHaveBeenCalledTimes(2);
  expect(update.mock.calls[0]?.[0]).toMatchObject({
    key: "custom.surface",
    sourceKind: "snapshot/element",
    pointer: { normalizedX: 0.5 },
    target: {
      setVisible: expect.any(Function),
      setRotation: expect.any(Function),
    },
  });

  runtime.dispose();
});
```

- [ ] **Step 2: Add unknown effect registration error test**

Add:

```ts
test("reports target effects that were not passed to the runtime", async () => {
  const runtime = await createPipelineRuntime();

  runtime.registerTarget(document.createElement("section"), {
    key: "missing.effect",
    effects: [{ kind: "custom.missing" }],
  });

  expect(() => runtime.sync()).toThrow(
    'WebGL target "missing.effect" references unknown effect "custom.missing". Register it through createWebGLRuntime({ effects: [...] }).',
  );

  runtime.dispose();
});
```

- [ ] **Step 3: Run pipeline tests**

Run:

```bash
npm test -- packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts
```

Expected: PASS.

## Task 10: Documentation Alignment

**Files:**
- Modify: `README.md`
- Modify: `docs/00-goal.md`
- Modify: `docs/EXECUTION_STATE.md`

- [ ] **Step 1: Update README effect model**

Replace the Phase 7-centered text:

```md
Custom effect registries are created with `createWebGLEffectRegistry(...)`
```

with:

```md
Phase 8 makes user-authored effects the single effect model. Core does not
auto-register default visual effects; consumers pass effect definitions to the
runtime with `createWebGLRuntime({ effects })` or `<WebGLRuntime effects={...}>`.
Official presets, when used, are optional effects implemented with the same
`defineWebGLEffect(...)` API as application effects.
```

- [ ] **Step 2: Update goal truth**

In `docs/00-goal.md`, add a `Planned Phase 8 behavior` section after Delivered Phase 7:

```md
Planned Phase 8 behavior:

- Replace public `effectRegistry` authoring with `defineWebGLEffect(...)` and
  runtime-level `effects`.
- Core runtime registers no default effects. Official effects are optional
  presets and use the same public authoring API as user effects.
- Effect context exposes layout, frame input, pointer, scroll, time, source
  handles, target handles, and managed resources.
- GLB effects receive a model source handle after the model source is loaded;
  effects do not load GLB assets themselves.
- Raw renderer, camera, and scene mutation remain outside the default API.
```

- [ ] **Step 3: Update execution state**

In `docs/EXECUTION_STATE.md`, add:

```md
Phase 8 custom effect authoring is planned but not implemented. The plan
intentionally removes default core effect registration as the public model,
moves official visuals to optional presets, and makes `defineWebGLEffect(...)`
the main author-facing API.
```

- [ ] **Step 4: Search for stale claims**

Run:

```bash
rg "custom effect registry|effectRegistry|built-in|builtins|built-in effect|default effect" README.md docs/00-goal.md docs/EXECUTION_STATE.md
```

Expected: remaining matches either describe Phase 7 history or clearly say Phase 8 replaces the public authoring model.

## Task 11: Final Verification

**Files:**
- All files touched by previous tasks.

- [ ] **Step 1: Run targeted tests**

Run:

```bash
npm test -- packages/dom-webgl-runtime/src/lib/effects/effectAuthoring.test.ts packages/dom-webgl-runtime/src/lib/effects/effectController.test.ts packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts packages/dom-webgl-runtime/src/publicExports.test.ts apps/demo/src/App.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run full workspace checks**

Run:

```bash
npm run typecheck
npm test -- --run
npm run build
npm run check:imports
git diff --check
```

Expected:

- `npm run typecheck`: PASS.
- `npm test -- --run`: PASS.
- `npm run build`: PASS, allowing the existing Vite chunk-size warning if it appears.
- `npm run check:imports`: PASS.
- `git diff --check`: no whitespace errors.

- [ ] **Step 3: Commit**

```bash
git add packages/dom-webgl-runtime apps/demo README.md docs/00-goal.md docs/EXECUTION_STATE.md
git commit -m "feat: add custom effect authoring api"
```

## Self-Review Notes

- Spec coverage: Covers the user concern that custom effects should not be second-class wrappers around built-in capabilities. The plan makes `defineWebGLEffect(...)` the single public model and moves official visuals to optional presets.
- Scope check: The plan is a single implementation phase. It enables GLB-aware effects through source handles and managed resources, but it does not require shipping a polished GLB particle preset in the same phase.
- Type consistency: Runtime option name is `effects`; target declaration property remains `effects`; effect implementations are `WebGLEffectDefinition`.
- Boundary check: The default API does not expose `renderer`, `camera`, or scene mutation. Model object access is exposed as `unknown` plus managed helper methods to avoid making raw Three.js object mutation the default contract.
