# Managed Three-Like Object API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build one Three.js-like managed authoring surface for AI-agent consumers while keeping canvas, renderer, scene graph, loaders, lights, materials, lifecycle, scroll, pointer, and performance ownership inside the runtime.

**Architecture:** Keep `defineWebGLEffect(...)`, target declarations, one runtime canvas, one scroll monitor, and one pointer monitor. Refactor public effect authoring around `ctx.object` as a managed Three-like facade: familiar property names and mutation style, no raw Three.js objects or user-owned renderer state. Split implementation into focused modules for type surface, loader ownership, material controls, lights, model animation, and example dogfood.

**Tech Stack:** TypeScript, npm workspaces, Three.js as internal implementation detail, Vitest/jsdom, React adapter, public TypeScript contract tests in `packages/dom-webgl-runtime/test/publicExports.test.ts`.

---

## Scope Check

This is one subsystem: public effect authoring capability. It can touch many files because the current gap is architectural, not one missing effect hook.

This plan intentionally allows a large refactor. Do not preserve fragmented public handles just to avoid changing multiple files. Keep the consumer-facing shape simple enough for AI agents to infer:

```ts
ctx.object.position.set(0, 24, 0);
ctx.object.rotation.y += ctx.delta / 1000;
ctx.object.scale.setScalar(1.08);
ctx.object.material?.emissive.set("#7dd3fc", 1.8);
ctx.object.lights?.point("glow", { color: "#7dd3fc", intensity: 2.4, follow: "object" });
ctx.object.animation?.play("Idle");
```

Do not expose:

```ts
new THREE.Mesh(...);
scene.add(...);
renderer.setRenderTarget(...);
mesh.material = new THREE.MeshStandardMaterial(...);
gltf.scene.traverse(...);
loader.setDRACOLoader(...);
```

## Current Truth

- `WebGLEffectContext` is already object-first: public fields are `ctx.object`, `ctx.resources`, input/time/layout/progress fields, and `ctx.sourceKind`.
- `ctx.object` currently supports transform, visibility, opacity, postprocess, and optional source-backed modules: surface, text, texture, video, model.
- `ctx.object.model` currently exposes `src`, `meshes`, `sampling`, and `points`.
- GLB loading currently uses a bare `GLTFLoader.loadAsync(src)` path; public `WebGLModelSourceDeclaration` has no Draco loader configuration.
- Runtime internals already have an internal `loadModel?` hook for tests, but public `WebGLRuntimeOptions` and React props do not expose model loader configuration.
- Existing docs already state the correct product thesis: Three-like public facade, runtime-owned raw Three internals.

## Design Rules

- API surface is Three-like; ownership is runtime-managed.
- Public modules should be broad capability families, not effect-specific hooks.
- Use familiar names: `position`, `rotation`, `scale`, `material`, `lights`, `animation`, `model`, `texture`, `postprocess`.
- Keep raw Three.js renderer, scene, camera, object, mesh, material, texture, loader, mixer, raycaster, composer, render target, and pass objects private.
- Capabilities that need source-specific internals should still appear under `ctx.object`.
- Runtime-created resources must be keyed, updatable, disposable, and visible in debug/performance surfaces where relevant.
- Prefer declaration/request APIs over user-owned constructors.

## File Structure

Create focused runtime modules:

- `packages/dom-webgl-runtime/src/lib/assets/modelLoader.ts`
  Runtime-owned GLTF/GLB loader creation, Draco wiring, source/runtime loader config merge.

- `packages/dom-webgl-runtime/src/lib/effects/effectColor.ts`
  Small Three-like color facade types and internal color normalization helpers.

- `packages/dom-webgl-runtime/src/lib/effects/effectMaterial.ts`
  Public material facade types and assembly from runtime-owned material targets.

- `packages/dom-webgl-runtime/src/lib/effects/effectLights.ts`
  Public lights facade types and runtime-owned light request shape.

- `packages/dom-webgl-runtime/src/lib/render/renderables/managedMaterialControls.ts`
  Internal structural material mutation helpers for color, emissive, opacity, metalness, and roughness.

- `packages/dom-webgl-runtime/src/lib/render/renderables/managedLights.ts`
  Internal keyed light request/update/dispose implementation using runtime-owned Three lights.

- `packages/dom-webgl-runtime/src/lib/render/renderables/modelAnimationControls.ts`
  Runtime-owned model animation mixer/action controls.

Modify existing files:

- `packages/dom-webgl-runtime/src/lib/types.ts`
  Add public model loader declarations and runtime option plumbing.

- `packages/dom-webgl-runtime/src/lib/react/WebGLRuntime.tsx`
  Add React prop for runtime-level model loader config.

- `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`
  Pass public loader config into renderable factory context.

- `packages/dom-webgl-runtime/src/lib/render/renderableFactory.ts`
  Pass model loader config into model renderables.

- `packages/dom-webgl-runtime/src/lib/render/renderables/modelRenderable.ts`
  Use runtime-owned model loader, create animation controls, expose managed model capabilities.

- `packages/dom-webgl-runtime/src/lib/render/renderables/modelEffectHandle.ts`
  Add internal material and animation control bridges without exposing raw mesh/object handles.

- `packages/dom-webgl-runtime/src/lib/effects/effectObject.ts`
  Extend public object facade types.

- `packages/dom-webgl-runtime/src/lib/effects/effectObjectCapabilities.ts`
  Attach material/model/animation capabilities under `ctx.object`.

- `packages/dom-webgl-runtime/src/lib/effects/effectObjectContext.ts`
  Pass `resources` and internal target handle into object assembly.

- `packages/dom-webgl-runtime/src/lib/effects/effectContext.ts`
  Provide resources to object assembly so managed lights are disposed with the effect.

- `packages/dom-webgl-runtime/src/index.ts`
  Export public facade and loader declaration types.

- `packages/dom-webgl-runtime/test/publicExports.test.ts`
  Public contract gate for Three-like managed API and raw Three.js negative checks.

- `packages/dom-webgl-runtime/test/lib/render/renderables/*`
  Focused tests for loader, material, lights, model animation, and lifecycle.

- `apps/example/src/modelEffects.ts`, `apps/example/src/App.tsx`, `apps/example/src/exampleEffects.ts`
  Dogfood `4.glb` with rotating floating glow using the new facade.

- Active docs: `README.md`, `docs/00-goal.md`, `docs/EXECUTION_STATE.md`, `docs/agent/effect-object-boundary.md`, `docs/agent/package-usage.md`, `docs/agent/package-onboarding.md`, `docs/agent/custom-effects.md`, `docs/examples/effect-authoring.md`, `AGENTS.md`.

## Public API Target

Use this public shape as the target for this iteration:

```ts
export type WebGLModelLoaderDeclaration = {
  draco?: {
    decoderPath: string;
    preload?: boolean;
  };
};

export type WebGLEffectColorLike = {
  readonly value: string;
  set(value: string | number | readonly [number, number, number]): void;
};

export type WebGLEffectEmissiveLike = WebGLEffectColorLike & {
  readonly intensity: number;
  set(
    value: string | number | readonly [number, number, number],
    intensity?: number,
  ): void;
};

export type WebGLEffectMaterialFacade = {
  color: WebGLEffectColorLike;
  emissive: WebGLEffectEmissiveLike;
  opacity: number;
  metalness: number;
  roughness: number;
  createLayer(options: {
    key: string;
    program: WebGLEffectMaterialProgram;
    sourceTextureUniform?: string;
    mode?: "replace-source" | "overlay";
  }): WebGLEffectMaterialLayerHandle;
  restore(): void;
};

export type WebGLEffectLightFollowMode = "object" | "layout-center" | "none";

export type WebGLEffectPointLightRequest = {
  color?: string | number | readonly [number, number, number];
  intensity?: number;
  distance?: number;
  decay?: number;
  position?: readonly [number, number, number];
  follow?: WebGLEffectLightFollowMode;
};

export type WebGLEffectDirectionalLightRequest = {
  color?: string | number | readonly [number, number, number];
  intensity?: number;
  position?: readonly [number, number, number];
  target?: readonly [number, number, number];
  follow?: WebGLEffectLightFollowMode;
};

export type WebGLEffectAmbientLightRequest = {
  color?: string | number | readonly [number, number, number];
  intensity?: number;
};

export type WebGLEffectLightsFacade = {
  ambient(key: string, request: WebGLEffectAmbientLightRequest): WebGLEffectManagedObjectHandle;
  directional(key: string, request: WebGLEffectDirectionalLightRequest): WebGLEffectManagedObjectHandle;
  point(key: string, request: WebGLEffectPointLightRequest): WebGLEffectManagedObjectHandle;
  remove(key: string): void;
};

export type WebGLEffectAnimationPlayOptions = {
  loop?: "once" | "repeat";
  fadeInMs?: number;
  timeScale?: number;
};

export type WebGLEffectAnimationFacade = {
  clips(): readonly string[];
  play(name: string, options?: WebGLEffectAnimationPlayOptions): void;
  stop(name: string): void;
  stopAll(): void;
  setTime(seconds: number): void;
};

export type WebGLEffectObjectHandle = {
  readonly sourceKind: WebGLEffectSourceKind;
  position: WebGLEffectVector3Like;
  rotation: WebGLEffectVector3Like;
  scale: WebGLEffectScaleLike;
  visible: boolean;
  opacity: number;
  material?: WebGLEffectMaterialFacade;
  lights?: WebGLEffectLightsFacade;
  animation?: WebGLEffectAnimationFacade;
  surface?: WebGLEffectCanvasSurfaceHandle;
  text?: WebGLEffectTextFacade;
  texture?: WebGLEffectTextureFacade;
  video?: WebGLEffectVideoFacade;
  model?: WebGLEffectModelFacade;
  postprocess: WebGLEffectPostprocessFacade;
};
```

## Task 1: Public Contract RED Tests

**Files:**

- Modify: `packages/dom-webgl-runtime/test/publicExports.test.ts`
- Modify: `packages/dom-webgl-runtime/test/lib/effects/effectAuthoring.test.ts`

- [x] **Step 1: Add a Three-like object facade fixture**

In `packages/dom-webgl-runtime/test/publicExports.test.ts`, add this inside the existing public type-check program where effect definitions are declared:

```ts
const managedThreeLikeEffect = defineWebGLEffect({
  kind: "custom.managedThreeLike",
  update(ctx) {
    ctx.object.position.set(0, 24, 0);
    ctx.object.position.y += 4;
    ctx.object.rotation.set(0, 0.5, 0);
    ctx.object.rotation.y += ctx.delta / 1000;
    ctx.object.scale.setScalar(1.08);
    ctx.object.visible = true;
    ctx.object.opacity = 0.86;

    ctx.object.material?.color.set("#f8fafc");
    ctx.object.material?.emissive.set("#7dd3fc", 1.8);
    ctx.object.material?.createLayer({
      key: "custom.materialLayer",
      program: {
        fragmentShader: "void main(){ gl_FragColor = vec4(1.0); }",
        blend: "additive",
      },
    });

    ctx.object.lights?.point("glow", {
      color: "#7dd3fc",
      intensity: 2.4,
      distance: 420,
      follow: "object",
    });

    ctx.object.animation?.play("Idle", {
      loop: "repeat",
      fadeInMs: 120,
      timeScale: 1,
    });

    ctx.object.postprocess.request({
      key: "custom.softBloom",
      bloom: { strength: 0.45, radius: 0.25, threshold: 0.7 },
    });
  },
});

managedThreeLikeEffect satisfies WebGLEffectDefinition;
```

- [x] **Step 2: Add Draco loader declaration fixture**

In the same public type-check program, add:

```ts
const dracoModelDeclaration = {
  key: "model.draco",
  source: {
    kind: "model",
    type: "glb",
    src: "/models/4.glb",
    loader: {
      draco: {
        decoderPath: "/draco/",
        preload: true,
      },
    },
  },
  effects: [{ kind: "custom.managedThreeLike" }],
} satisfies WebGLDeclaration;

const runtimeOptionsWithModelLoader = {
  container: document.createElement("div"),
  modelLoader: {
    draco: {
      decoderPath: "/draco/",
    },
  },
} satisfies WebGLRuntimeOptions;
```

- [x] **Step 3: Add raw Three.js negative checks**

In the same fixture, add:

```ts
declare const publicObject: WebGLEffectContext["object"];

// @ts-expect-error raw object3D remains runtime-owned.
publicObject.object3D;
// @ts-expect-error raw mesh remains runtime-owned.
publicObject.mesh;
// @ts-expect-error raw material remains runtime-owned.
publicObject.rawMaterial;
// @ts-expect-error raw light remains runtime-owned.
publicObject.rawLight;
// @ts-expect-error raw renderer remains runtime-owned.
publicObject.renderer;
// @ts-expect-error raw scene remains runtime-owned.
publicObject.scene;
// @ts-expect-error raw camera remains runtime-owned.
publicObject.camera;
// @ts-expect-error loader callbacks are not public escape hatches.
dracoModelDeclaration.source.loader.configureLoader;
// @ts-expect-error loaded GLTF callbacks are not public escape hatches.
dracoModelDeclaration.source.onGLTFLoaded;
```

- [x] **Step 4: Add authoring syntax regression**

Append this to `packages/dom-webgl-runtime/test/lib/effects/effectAuthoring.test.ts`:

```ts
test("supports Three-like managed object authoring syntax", () => {
  const definition = defineWebGLEffect({
    kind: "custom.threeLikeSyntax",
    update(ctx) {
      ctx.object.position.set(1, 2, 3);
      ctx.object.rotation.y += ctx.delta / 1000;
      ctx.object.scale.setScalar(1.2);
      ctx.object.material?.emissive.set("#38bdf8", 2);
      ctx.object.lights?.point("rim", { intensity: 1.5, follow: "object" });
      ctx.object.animation?.play("Idle");
    },
  });

  expect(definition.kind).toBe("custom.threeLikeSyntax");
});
```

- [x] **Step 5: Run RED tests**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/publicExports.test.ts packages/dom-webgl-runtime/test/lib/effects/effectAuthoring.test.ts
```

Expected: FAIL because `modelLoader`, `loader`, `material`, `lights`, and `animation` are not implemented on the public types yet.

- [x] **Step 6: Commit RED contract**

```bash
git add packages/dom-webgl-runtime/test/publicExports.test.ts packages/dom-webgl-runtime/test/lib/effects/effectAuthoring.test.ts
git commit -m "test: define managed three-like object api contract"
```

## Task 2: Public Types And Facade Module Boundaries

**Files:**

- Create: `packages/dom-webgl-runtime/src/lib/effects/effectColor.ts`
- Create: `packages/dom-webgl-runtime/src/lib/effects/effectMaterial.ts`
- Create: `packages/dom-webgl-runtime/src/lib/effects/effectLights.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/effects/effectObject.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/types.ts`
- Modify: `packages/dom-webgl-runtime/src/index.ts`

- [x] **Step 1: Add color facade types**

Create `packages/dom-webgl-runtime/src/lib/effects/effectColor.ts`:

```ts
export type WebGLEffectColorValue =
  | string
  | number
  | readonly [number, number, number];

export type WebGLEffectColorLike = {
  readonly value: string;
  set(value: WebGLEffectColorValue): void;
};

export type WebGLEffectEmissiveLike = WebGLEffectColorLike & {
  readonly intensity: number;
  set(value: WebGLEffectColorValue, intensity?: number): void;
};
```

- [x] **Step 2: Add material facade types**

Create `packages/dom-webgl-runtime/src/lib/effects/effectMaterial.ts`:

```ts
import type {
  WebGLEffectMaterialLayerHandle,
  WebGLEffectMaterialProgram,
} from "./effectAuthoring";
import type {
  WebGLEffectColorLike,
  WebGLEffectEmissiveLike,
} from "./effectColor";

export type WebGLEffectMaterialLayerOptions = {
  key: string;
  program: WebGLEffectMaterialProgram;
  sourceTextureUniform?: string;
  mode?: "replace-source" | "overlay";
};

export type WebGLEffectMaterialFacade = {
  color: WebGLEffectColorLike;
  emissive: WebGLEffectEmissiveLike;
  opacity: number;
  metalness: number;
  roughness: number;
  createLayer(options: WebGLEffectMaterialLayerOptions): WebGLEffectMaterialLayerHandle;
  restore(): void;
};
```

- [x] **Step 3: Add lights facade types**

Create `packages/dom-webgl-runtime/src/lib/effects/effectLights.ts`:

```ts
import type { WebGLEffectColorValue } from "./effectColor";
import type { WebGLEffectManagedObjectHandle } from "./effectAuthoring";

export type WebGLEffectLightFollowMode = "object" | "layout-center" | "none";

export type WebGLEffectPointLightRequest = {
  color?: WebGLEffectColorValue;
  intensity?: number;
  distance?: number;
  decay?: number;
  position?: readonly [number, number, number];
  follow?: WebGLEffectLightFollowMode;
};

export type WebGLEffectDirectionalLightRequest = {
  color?: WebGLEffectColorValue;
  intensity?: number;
  position?: readonly [number, number, number];
  target?: readonly [number, number, number];
  follow?: WebGLEffectLightFollowMode;
};

export type WebGLEffectAmbientLightRequest = {
  color?: WebGLEffectColorValue;
  intensity?: number;
};

export type WebGLEffectLightsFacade = {
  ambient(key: string, request: WebGLEffectAmbientLightRequest): WebGLEffectManagedObjectHandle;
  directional(key: string, request: WebGLEffectDirectionalLightRequest): WebGLEffectManagedObjectHandle;
  point(key: string, request: WebGLEffectPointLightRequest): WebGLEffectManagedObjectHandle;
  remove(key: string): void;
};
```

- [x] **Step 4: Extend object facade types**

Modify `packages/dom-webgl-runtime/src/lib/effects/effectObject.ts` imports:

```ts
import type { WebGLEffectMaterialFacade } from "./effectMaterial";
import type { WebGLEffectLightsFacade } from "./effectLights";
```

Add animation types in the same file:

```ts
export type WebGLEffectAnimationPlayOptions = {
  loop?: "once" | "repeat";
  fadeInMs?: number;
  timeScale?: number;
};

export type WebGLEffectAnimationFacade = {
  clips(): readonly string[];
  play(name: string, options?: WebGLEffectAnimationPlayOptions): void;
  stop(name: string): void;
  stopAll(): void;
  setTime(seconds: number): void;
};
```

Extend `WebGLEffectObjectHandle`:

```ts
export type WebGLEffectObjectHandle = {
  readonly sourceKind: WebGLEffectSourceKind;
  position: WebGLEffectVector3Like;
  rotation: WebGLEffectVector3Like;
  scale: WebGLEffectScaleLike;
  visible: boolean;
  opacity: number;
  material?: WebGLEffectMaterialFacade;
  lights?: WebGLEffectLightsFacade;
  animation?: WebGLEffectAnimationFacade;
  surface?: WebGLEffectCanvasSurfaceHandle;
  text?: WebGLEffectTextFacade;
  texture?: WebGLEffectTextureFacade;
  video?: WebGLEffectVideoFacade;
  model?: WebGLEffectModelFacade;
  postprocess: WebGLEffectPostprocessFacade;
};
```

- [x] **Step 5: Add public loader declaration types**

In `packages/dom-webgl-runtime/src/lib/types.ts`, add:

```ts
export type WebGLModelLoaderDeclaration = {
  draco?: {
    decoderPath: string;
    preload?: boolean;
  };
};
```

Change `WebGLModelSourceDeclaration`:

```ts
export type WebGLModelSourceDeclaration = {
  kind: "model";
  type: "glb";
  src: string;
  loader?: WebGLModelLoaderDeclaration;
};
```

Change `WebGLRuntimeOptions`:

```ts
export type WebGLRuntimeOptions = {
  container: HTMLElement;
  effects?: readonly WebGLEffectDefinition[];
  progressSignals?: WebGLProgressSignalSource;
  scrollAdapter?: WebGLScrollAdapter;
  modelLoader?: WebGLModelLoaderDeclaration;
  performanceBudget?: WebGLPerformanceBudget;
  onDebugStateChange?: (state: WebGLDebugState) => void;
};
```

- [x] **Step 6: Export public types**

In `packages/dom-webgl-runtime/src/index.ts`, export the new types:

```ts
export type {
  WebGLEffectColorLike,
  WebGLEffectColorValue,
  WebGLEffectEmissiveLike,
} from "./lib/effects/effectColor";
export type {
  WebGLEffectMaterialFacade,
  WebGLEffectMaterialLayerOptions,
} from "./lib/effects/effectMaterial";
export type {
  WebGLEffectAmbientLightRequest,
  WebGLEffectDirectionalLightRequest,
  WebGLEffectLightFollowMode,
  WebGLEffectLightsFacade,
  WebGLEffectPointLightRequest,
} from "./lib/effects/effectLights";
```

- [x] **Step 7: Run public type tests**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/publicExports.test.ts
```

Expected: public type errors for missing runtime implementation may be gone, but runtime/authoring behavior tests still fail until later tasks implement facades.

- [x] **Step 8: Commit public type surface**

```bash
git add packages/dom-webgl-runtime/src/lib/effects/effectColor.ts packages/dom-webgl-runtime/src/lib/effects/effectMaterial.ts packages/dom-webgl-runtime/src/lib/effects/effectLights.ts packages/dom-webgl-runtime/src/lib/effects/effectObject.ts packages/dom-webgl-runtime/src/lib/types.ts packages/dom-webgl-runtime/src/index.ts
git commit -m "feat: add managed three-like public facade types"
```

## Task 3: Runtime-Owned Draco Model Loader

**Files:**

- Create: `packages/dom-webgl-runtime/src/lib/assets/modelLoader.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/source/sourceDescriptor.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/source/inferSource.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/modelRenderable.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderableFactory.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/react/WebGLRuntime.tsx`
- Test: `packages/dom-webgl-runtime/test/lib/render/renderables/modelRenderable.test.ts`
- Test: `packages/dom-webgl-runtime/test/lib/renderer/runtimePipeline.test.ts`

- [x] **Step 1: Add source descriptor loader field**

In `packages/dom-webgl-runtime/src/lib/source/sourceDescriptor.ts`, update `WebGLModelSourceDescriptor`:

```ts
import type { WebGLModelLoaderDeclaration } from "../types";

export type WebGLModelSourceDescriptor = {
  kind: "model";
  type: "glb";
  anchor: HTMLElement;
  src: string;
  loader?: WebGLModelLoaderDeclaration;
};
```

In `packages/dom-webgl-runtime/src/lib/source/inferSource.ts`, preserve the declaration loader when creating the descriptor:

```ts
return {
  kind: "model",
  type: "glb",
  anchor: element,
  src: declaration.source.src,
  loader: declaration.source.loader,
};
```

- [x] **Step 2: Create runtime-owned loader module**

Create `packages/dom-webgl-runtime/src/lib/assets/modelLoader.ts`:

```ts
import type { WebGLModelLoaderDeclaration } from "../types";
import type { WebGLModelSourceDescriptor } from "../source/sourceDescriptor";

type GLTFLoaderLike = {
  loadAsync(src: string): Promise<unknown>;
  setDRACOLoader?(loader: unknown): void;
};

type GLTFLoaderConstructor = new () => GLTFLoaderLike;

type DRACOLoaderLike = {
  setDecoderPath(path: string): DRACOLoaderLike;
  preload?(): void;
  dispose?(): void;
};

type DRACOLoaderConstructor = new () => DRACOLoaderLike;

export type ModelLoaderOptions = {
  runtimeLoader?: WebGLModelLoaderDeclaration;
};

export async function loadGLBModel(
  source: WebGLModelSourceDescriptor,
  options: ModelLoaderOptions = {},
): Promise<unknown> {
  const { GLTFLoader } = (await import(
    "three/addons/loaders/GLTFLoader.js"
  )) as { GLTFLoader: GLTFLoaderConstructor };
  const loader = new GLTFLoader();
  const loaderConfig = mergeModelLoaderConfig(options.runtimeLoader, source.loader);
  const dracoConfig = loaderConfig.draco;

  if (dracoConfig) {
    const { DRACOLoader } = (await import(
      "three/addons/loaders/DRACOLoader.js"
    )) as { DRACOLoader: DRACOLoaderConstructor };
    const dracoLoader = new DRACOLoader().setDecoderPath(dracoConfig.decoderPath);

    if (dracoConfig.preload) {
      dracoLoader.preload?.();
    }
    loader.setDRACOLoader?.(dracoLoader);

    try {
      return await loader.loadAsync(source.src);
    } finally {
      dracoLoader.dispose?.();
    }
  }

  return loader.loadAsync(source.src);
}

export function mergeModelLoaderConfig(
  runtimeLoader: WebGLModelLoaderDeclaration | undefined,
  sourceLoader: WebGLModelLoaderDeclaration | undefined,
): WebGLModelLoaderDeclaration {
  return {
    ...(runtimeLoader ?? {}),
    ...(sourceLoader ?? {}),
    draco:
      sourceLoader?.draco || runtimeLoader?.draco
        ? {
            ...(runtimeLoader?.draco ?? {}),
            ...(sourceLoader?.draco ?? {}),
          }
        : undefined,
  };
}
```

- [x] **Step 3: Wire loader through runtime options**

In `packages/dom-webgl-runtime/src/lib/react/WebGLRuntime.tsx`, extend props:

```ts
export type WebGLRuntimeProps = {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  effects?: WebGLRuntimeOptions["effects"];
  progressSignals?: WebGLRuntimeOptions["progressSignals"];
  scrollAdapter?: WebGLRuntimeOptions["scrollAdapter"];
  modelLoader?: WebGLRuntimeOptions["modelLoader"];
  onDebugStateChange?: (state: WebGLDebugState) => void;
};
```

Pass it into `createWebGLRuntime` and include it in the layout effect dependency list:

```ts
nextRuntime = createWebGLRuntime({
  container,
  effects,
  progressSignals,
  scrollAdapter,
  modelLoader,
  onDebugStateChange(state) {
    onDebugStateChangeRef.current?.(state);
  },
});
```

```ts
}, [effects, progressSignals, scrollAdapter, modelLoader]);
```

In `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`, add to renderable factory context:

```ts
modelLoader: options.modelLoader,
```

In `packages/dom-webgl-runtime/src/lib/render/renderableFactory.ts`, add:

```ts
modelLoader?: WebGLModelLoaderDeclaration;
```

and pass it into `createModelRenderable(...)`.

In `packages/dom-webgl-runtime/src/lib/render/renderables/modelRenderable.ts`, replace the default loader with:

```ts
import { loadGLBModel } from "../../assets/modelLoader";

const loadModel =
  options.loadModel ??
  ((modelSource: WebGLModelSourceDescriptor) =>
    loadGLBModel(modelSource, { runtimeLoader: options.modelLoader }));
```

- [x] **Step 4: Add Draco loader test**

Append a test to `packages/dom-webgl-runtime/test/lib/render/renderables/modelRenderable.test.ts`:

```ts
test("configures DRACOLoader for Draco-compressed GLB sources", async () => {
  const loadAsync = vi.fn(() => Promise.resolve({ scene: createModelObject("draco-model") }));
  const setDRACOLoader = vi.fn();
  const setDecoderPath = vi.fn(function setDecoderPath(this: unknown) {
    return this;
  });
  const preload = vi.fn();
  const dispose = vi.fn();

  vi.doMock("three/addons/loaders/GLTFLoader.js", () => ({
    GLTFLoader: vi.fn(() => ({ loadAsync, setDRACOLoader })),
  }));
  vi.doMock("three/addons/loaders/DRACOLoader.js", () => ({
    DRACOLoader: vi.fn(() => ({ setDecoderPath, preload, dispose })),
  }));

  const { createModelRenderable: createRenderableWithMocks } = await import(
    "../../../../src/lib/render/renderables/modelRenderable"
  );
  const sceneAdapter = createSceneAdapter();
  const renderable = createRenderableWithMocks(createRenderableContext({
    source: {
      kind: "model",
      type: "glb",
      anchor: document.createElement("section"),
      src: "/models/4.glb",
      loader: { draco: { decoderPath: "/draco/", preload: true } },
    },
  }), {
    resourceManager: createResourceManager(),
    sceneAdapter,
    measureElement: createElementMeasurement,
  });

  await renderable.update(createFrameInput());

  expect(setDecoderPath).toHaveBeenCalledWith("/draco/");
  expect(preload).toHaveBeenCalledTimes(1);
  expect(setDRACOLoader).toHaveBeenCalledTimes(1);
  expect(loadAsync).toHaveBeenCalledWith("/models/4.glb");
  expect(dispose).toHaveBeenCalledTimes(1);
});
```

- [x] **Step 5: Run loader tests**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/render/renderables/modelRenderable.test.ts packages/dom-webgl-runtime/test/lib/renderer/runtimePipeline.test.ts packages/dom-webgl-runtime/test/publicExports.test.ts
```

Expected: PASS for loader tests and public declaration fixtures.

- [x] **Step 6: Commit loader work**

```bash
git add packages/dom-webgl-runtime/src/lib/assets/modelLoader.ts packages/dom-webgl-runtime/src/lib/source/sourceDescriptor.ts packages/dom-webgl-runtime/src/lib/source/inferSource.ts packages/dom-webgl-runtime/src/lib/render/renderables/modelRenderable.ts packages/dom-webgl-runtime/src/lib/render/renderableFactory.ts packages/dom-webgl-runtime/src/lib/renderer/runtime.ts packages/dom-webgl-runtime/src/lib/react/WebGLRuntime.tsx packages/dom-webgl-runtime/test/lib/render/renderables/modelRenderable.test.ts packages/dom-webgl-runtime/test/lib/renderer/runtimePipeline.test.ts packages/dom-webgl-runtime/test/publicExports.test.ts
git commit -m "feat: add runtime-owned draco model loader config"
```

## Task 4: Managed Material Facade

**Files:**

- Create: `packages/dom-webgl-runtime/src/lib/render/renderables/managedMaterialControls.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/modelEffectHandle.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/sourceCapabilityHandles.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/effects/effectObjectCapabilities.ts`
- Test: `packages/dom-webgl-runtime/test/lib/render/renderables/modelEffectHandle.test.ts`
- Test: `packages/dom-webgl-runtime/test/lib/render/renderables/sourceCapabilityHandles.test.ts`

- [x] **Step 1: Add internal material controls**

Create `packages/dom-webgl-runtime/src/lib/render/renderables/managedMaterialControls.ts`:

```ts
import type { WebGLEffectColorValue } from "../../effects/effectColor";
import type { WebGLEffectMaterialFacade } from "../../effects/effectMaterial";
import type { WebGLEffectMaterialLayerHost } from "../../effects/effectAuthoring";

type MaterialMutationTarget = {
  readonly material: unknown;
  readonly layerHost?: WebGLEffectMaterialLayerHost;
  restoreMaterial?(): void;
};

export function createManagedMaterialFacade(
  target: MaterialMutationTarget,
): WebGLEffectMaterialFacade {
  return {
    color: createColorFacade(target, "color"),
    emissive: createEmissiveFacade(target),
    get opacity() {
      return readNumberMaterialProperty(target.material, "opacity", 1);
    },
    set opacity(value) {
      setMaterialProperty(target.material, "opacity", clampNumber(value, 0, 1, 1));
      if (value < 1) {
        setMaterialProperty(target.material, "transparent", true);
      }
    },
    get metalness() {
      return readNumberMaterialProperty(target.material, "metalness", 0);
    },
    set metalness(value) {
      setMaterialProperty(target.material, "metalness", clampNumber(value, 0, 1, 0));
    },
    get roughness() {
      return readNumberMaterialProperty(target.material, "roughness", 1);
    },
    set roughness(value) {
      setMaterialProperty(target.material, "roughness", clampNumber(value, 0, 1, 1));
    },
    createLayer(options) {
      if (!target.layerHost) {
        throw new Error("This WebGL object does not expose a material layer host.");
      }
      return target.layerHost.createMaterialLayer(options);
    },
    restore() {
      target.restoreMaterial?.();
    },
  };
}

function createColorFacade(target: MaterialMutationTarget, key: string) {
  return {
    get value() {
      return readColorValue(target.material, key);
    },
    set(value: WebGLEffectColorValue) {
      setColorValue(target.material, key, value);
    },
  };
}

function createEmissiveFacade(target: MaterialMutationTarget) {
  return {
    get value() {
      return readColorValue(target.material, "emissive");
    },
    get intensity() {
      return readNumberMaterialProperty(target.material, "emissiveIntensity", 1);
    },
    set(value: WebGLEffectColorValue, intensity?: number) {
      setColorValue(target.material, "emissive", value);
      if (intensity !== undefined) {
        setMaterialProperty(target.material, "emissiveIntensity", Math.max(0, intensity));
      }
    },
  };
}

function readColorValue(material: unknown, key: string): string {
  const color = readMaterialProperty(material, key);
  if (color && typeof color === "object" && "getHexString" in color) {
    return `#${(color as { getHexString: () => string }).getHexString()}`;
  }
  return "#ffffff";
}

function setColorValue(material: unknown, key: string, value: WebGLEffectColorValue): void {
  forEachMaterial(material, (entry) => {
    const color = readMaterialProperty(entry, key);
    if (color && typeof color === "object" && "set" in color) {
      (color as { set: (next: unknown) => void }).set(value);
      setMaterialProperty(entry, "needsUpdate", true);
    }
  });
}

function readMaterialProperty(material: unknown, key: string): unknown {
  if (!material || typeof material !== "object") {
    return undefined;
  }
  return (material as Record<string, unknown>)[key];
}

function readNumberMaterialProperty(
  material: unknown,
  key: string,
  fallback: number,
): number {
  const value = readMaterialProperty(material, key);
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function setMaterialProperty(material: unknown, key: string, value: unknown): void {
  forEachMaterial(material, (entry) => {
    Object.assign(entry, { [key]: value, needsUpdate: true });
  });
}

function forEachMaterial(material: unknown, visitor: (material: object) => void): void {
  const entries = Array.isArray(material) ? material : [material];
  for (const entry of entries) {
    if (entry && typeof entry === "object") {
      visitor(entry);
    }
  }
}

function clampNumber(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, value));
}
```

- [x] **Step 2: Attach material facade to model mesh handles**

In `packages/dom-webgl-runtime/src/lib/render/renderables/modelEffectHandle.ts`, import `createManagedMaterialFacade` and add a `material` field to mesh handles:

```ts
import { createManagedMaterialFacade } from "./managedMaterialControls";
```

Inside `createModelMeshHandle(...)`, return:

```ts
const handle = {
  ...createObject3DControls(mesh, {
    scaleZ: "x",
    opacity: { kind: "object" },
  }),
  index,
  name: readStringProperty(mesh, "name"),
  materialName,
  material: createManagedMaterialFacade({
    material: readMaterial(mesh),
    layerHost: {
      createMaterialLayer(options) {
        const layer = createMaterialLayer({
          ...options,
          target: createMaterialTarget(mesh),
        });
        activeLayers.push(layer);
        return layer;
      },
    },
    restoreMaterial() {
      for (const layer of activeLayers.splice(0)) {
        layer.dispose();
      }
    },
  }),
  createMaterialLayer(options) {
    const layer = createMaterialLayer({
      ...options,
      target: createMaterialTarget(mesh),
    });
    activeLayers.push(layer);
    return layer;
  },
  restoreMaterial() {
    for (const layer of activeLayers.splice(0)) {
      layer.dispose();
    }
  },
};

return handle;
```

Add helper:

```ts
function readMaterial(mesh: unknown): unknown {
  if (!mesh || typeof mesh !== "object") {
    return undefined;
  }
  return (mesh as { material?: unknown }).material;
}
```

- [x] **Step 3: Expose top-level `ctx.object.material`**

In `packages/dom-webgl-runtime/src/lib/effects/effectObjectCapabilities.ts`, map source capabilities:

```ts
function createModelCapabilities(
  source: ModelSourceHandle,
): WebGLEffectObjectCapabilities {
  const meshes = source.model.getMeshes();
  const primaryMaterial = meshes[0]?.material;

  return {
    material: primaryMaterial,
    model: {
      src: source.src,
      meshes: {
        all() {
          return source.model.getMeshes();
        },
        forEach(visitor) {
          source.model.forEachMesh(visitor);
        },
      },
      sampling: {
        vertices(options) {
          return source.model.sampleVertices(options);
        },
      },
      points: {
        create(options) {
          return source.model.createPointLayer(options);
        },
      },
    },
  };
}
```

For `dom/text`, `media/image`, `media/video`, and `media/image-sequence`, set `material` to a facade backed by the existing source material layer host. For `dom/element`, use the surface layer host.

- [x] **Step 4: Add material behavior tests**

In `packages/dom-webgl-runtime/test/lib/render/renderables/modelEffectHandle.test.ts`, add:

```ts
test("exposes managed material facade without raw material access", () => {
  const mesh = {
    geometry: {},
    material: {
      color: { set: vi.fn(), getHexString: () => "ffffff" },
      emissive: { set: vi.fn(), getHexString: () => "000000" },
      emissiveIntensity: 1,
      opacity: 1,
      metalness: 0,
      roughness: 1,
    },
  };
  const object3D = { children: [mesh] };
  const handle = createModelEffectHandle(object3D);
  const [meshHandle] = handle.getMeshes();

  meshHandle?.material.color.set("#38bdf8");
  meshHandle?.material.emissive.set("#7dd3fc", 2);
  if (meshHandle) {
    meshHandle.material.opacity = 0.72;
    meshHandle.material.metalness = 0.4;
    meshHandle.material.roughness = 0.2;
  }

  expect(mesh.material.color.set).toHaveBeenCalledWith("#38bdf8");
  expect(mesh.material.emissive.set).toHaveBeenCalledWith("#7dd3fc");
  expect(mesh.material.emissiveIntensity).toBe(2);
  expect(mesh.material.opacity).toBe(0.72);
  expect(mesh.material.transparent).toBe(true);
  expect("rawMaterial" in (meshHandle ?? {})).toBe(false);
});
```

- [x] **Step 5: Run material tests**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/render/renderables/modelEffectHandle.test.ts packages/dom-webgl-runtime/test/lib/render/renderables/sourceCapabilityHandles.test.ts packages/dom-webgl-runtime/test/publicExports.test.ts
```

Expected: PASS for material facade behavior and public type contract.

- [x] **Step 6: Commit material facade**

```bash
git add packages/dom-webgl-runtime/src/lib/render/renderables/managedMaterialControls.ts packages/dom-webgl-runtime/src/lib/render/renderables/modelEffectHandle.ts packages/dom-webgl-runtime/src/lib/render/renderables/sourceCapabilityHandles.ts packages/dom-webgl-runtime/src/lib/effects/effectObjectCapabilities.ts packages/dom-webgl-runtime/test/lib/render/renderables/modelEffectHandle.test.ts packages/dom-webgl-runtime/test/lib/render/renderables/sourceCapabilityHandles.test.ts packages/dom-webgl-runtime/test/publicExports.test.ts
git commit -m "feat: add managed material facade"
```

## Task 5: Runtime-Managed Lights Facade

**Files:**

- Create: `packages/dom-webgl-runtime/src/lib/render/renderables/managedLights.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/effects/effectObjectContext.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/effects/effectContext.ts`
- Test: `packages/dom-webgl-runtime/test/lib/effects/effectObjectContext.test.ts`

- [ ] **Step 1: Implement keyed managed lights**

Create `packages/dom-webgl-runtime/src/lib/render/renderables/managedLights.ts`:

```ts
import { AmbientLight } from "three/src/lights/AmbientLight.js";
import { DirectionalLight } from "three/src/lights/DirectionalLight.js";
import { PointLight } from "three/src/lights/PointLight.js";

import type {
  WebGLEffectAmbientLightRequest,
  WebGLEffectDirectionalLightRequest,
  WebGLEffectLightsFacade,
  WebGLEffectPointLightRequest,
} from "../../effects/effectLights";
import type {
  WebGLEffectManagedObjectHandle,
  WebGLEffectResourceScope,
  WebGLEffectTargetHandle,
} from "../../effects/effectAuthoring";

type InternalTargetWithObjects = WebGLEffectTargetHandle & {
  addObject3D?(
    object3D: unknown,
    options?: { dispose?: (object3D: unknown) => void },
  ): WebGLEffectManagedObjectHandle;
};

export function createManagedLightsFacade(options: {
  target?: InternalTargetWithObjects;
  resources: WebGLEffectResourceScope;
  readObjectPosition(): { x: number; y: number; z: number };
}): WebGLEffectLightsFacade | undefined {
  if (!options.target?.addObject3D) {
    return undefined;
  }

  const handlesByKey = new Map<string, WebGLEffectManagedObjectHandle>();

  options.resources.addDisposable(() => {
    for (const handle of handlesByKey.values()) {
      handle.dispose();
    }
    handlesByKey.clear();
  });

  return {
    ambient(key, request) {
      const light = new AmbientLight(readColor(request.color), readIntensity(request.intensity, 1));
      return replaceLight(key, light);
    },
    directional(key, request) {
      const light = new DirectionalLight(readColor(request.color), readIntensity(request.intensity, 1));
      applyPosition(light, request.position, options.readObjectPosition(), request.follow);
      return replaceLight(key, light);
    },
    point(key, request) {
      const light = new PointLight(
        readColor(request.color),
        readIntensity(request.intensity, 1),
        readPositive(request.distance, 0),
        readPositive(request.decay, 2),
      );
      applyPosition(light, request.position, options.readObjectPosition(), request.follow);
      return replaceLight(key, light);
    },
    remove(key) {
      handlesByKey.get(key)?.dispose();
      handlesByKey.delete(key);
    },
  };

  function replaceLight(key: string, light: unknown): WebGLEffectManagedObjectHandle {
    handlesByKey.get(key)?.dispose();
    const handle = options.target?.addObject3D?.(light, {
      dispose(object3D) {
        if (object3D && typeof object3D === "object" && "dispose" in object3D) {
          const dispose = (object3D as { dispose?: unknown }).dispose;
          if (typeof dispose === "function") {
            dispose.call(object3D);
          }
        }
      },
    });

    if (!handle) {
      return createDisposedHandle();
    }
    handlesByKey.set(key, handle);
    return handle;
  }
}

function applyPosition(
  light: unknown,
  explicit: readonly [number, number, number] | undefined,
  objectPosition: { x: number; y: number; z: number },
  follow: "object" | "layout-center" | "none" | undefined,
): void {
  const position =
    explicit ??
    (follow === "object" || follow === "layout-center"
      ? [objectPosition.x, objectPosition.y, objectPosition.z + 120] as const
      : [0, 0, 120] as const);
  const target = (light as { position?: { set?: (x: number, y: number, z: number) => void } }).position;
  target?.set?.(position[0], position[1], position[2]);
}

function readColor(value: unknown): string | number {
  if (typeof value === "string" || typeof value === "number") {
    return value;
  }
  return 0xffffff;
}

function readIntensity(value: number | undefined, fallback: number): number {
  return readPositive(value, fallback);
}

function readPositive(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : fallback;
}

function createDisposedHandle(): WebGLEffectManagedObjectHandle {
  return {
    setVisible() {},
    remove() {},
    dispose() {},
  };
}
```

- [ ] **Step 2: Pass resources into object assembly**

Change `packages/dom-webgl-runtime/src/lib/effects/effectObjectContext.ts` options:

```ts
import type { WebGLEffectResourceScope } from "./effectAuthoring";

export type WebGLEffectObjectOptions = {
  sourceKind: WebGLEffectSourceKind;
  source: WebGLEffectSourceHandle;
  target?: WebGLEffectTargetHandle;
  visual: WebGLEffectVisualContext;
  resources: WebGLEffectResourceScope;
};
```

When returning the object, add:

```ts
lights: createManagedLightsFacade({
  target: options.target,
  resources: options.resources,
  readObjectPosition() {
    return transform.position;
  },
}),
```

Import:

```ts
import { createManagedLightsFacade } from "../render/renderables/managedLights";
```

In `packages/dom-webgl-runtime/src/lib/effects/effectContext.ts`, pass `resources` into `createWebGLEffectObject(...)`.

- [ ] **Step 3: Add lights lifecycle test**

In `packages/dom-webgl-runtime/test/lib/effects/effectObjectContext.test.ts`, add:

```ts
test("managed lights attach through target and dispose with resources", () => {
  const disposed: unknown[] = [];
  const added: unknown[] = [];
  const target = {
    setVisible() {},
    setPosition() {},
    setRotation() {},
    setScale() {},
    setOpacity() {},
    addObject3D(object3D: unknown, options?: { dispose?: (object3D: unknown) => void }) {
      added.push(object3D);
      return {
        setVisible() {},
        remove() {},
        dispose() {
          disposed.push(object3D);
          options?.dispose?.(object3D);
        },
      };
    },
  };
  const resources = createWebGLEffectResourceScope();
  const object = createWebGLEffectObject({
    sourceKind: "dom/element",
    source: createElementSourceHandle(),
    target,
    resources,
    visual: createVisualContext(),
  });

  object.position.set(12, 24, 0);
  object.lights?.point("glow", { color: "#7dd3fc", intensity: 2, follow: "object" });

  expect(added.length).toBe(1);
  resources.dispose();
  expect(disposed).toEqual(added);
});
```

- [ ] **Step 4: Run lights tests**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/effects/effectObjectContext.test.ts packages/dom-webgl-runtime/test/publicExports.test.ts
```

Expected: PASS, with no public raw light access.

- [ ] **Step 5: Commit lights facade**

```bash
git add packages/dom-webgl-runtime/src/lib/render/renderables/managedLights.ts packages/dom-webgl-runtime/src/lib/effects/effectObjectContext.ts packages/dom-webgl-runtime/src/lib/effects/effectContext.ts packages/dom-webgl-runtime/test/lib/effects/effectObjectContext.test.ts packages/dom-webgl-runtime/test/publicExports.test.ts
git commit -m "feat: add runtime-managed lights facade"
```

## Task 6: Model Animation Facade

**Files:**

- Create: `packages/dom-webgl-runtime/src/lib/render/renderables/modelAnimationControls.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/modelRenderable.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/modelEffectHandle.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/effects/effectObjectCapabilities.ts`
- Test: `packages/dom-webgl-runtime/test/lib/render/renderables/modelRenderable.test.ts`
- Test: `packages/dom-webgl-runtime/test/lib/render/renderables/modelEffectHandle.test.ts`

- [ ] **Step 1: Add runtime-owned animation controls**

Create `packages/dom-webgl-runtime/src/lib/render/renderables/modelAnimationControls.ts`:

```ts
import { AnimationMixer } from "three/src/animation/AnimationMixer.js";
import { LoopOnce, LoopRepeat } from "three/src/constants.js";

import type {
  WebGLEffectAnimationFacade,
  WebGLEffectAnimationPlayOptions,
} from "../../effects/effectObject";

type AnimationClipLike = {
  name?: string;
};

type AnimationActionLike = {
  reset(): AnimationActionLike;
  play(): AnimationActionLike;
  stop(): AnimationActionLike;
  fadeIn?(durationSeconds: number): AnimationActionLike;
  setLoop?(mode: number, repetitions: number): AnimationActionLike;
  timeScale?: number;
};

export type ModelAnimationController = WebGLEffectAnimationFacade & {
  update(deltaMilliseconds: number): void;
  dispose(): void;
};

export function createModelAnimationController(model: unknown): ModelAnimationController | undefined {
  const scene = readModelScene(model);
  const clips = readAnimationClips(model);

  if (!scene || clips.length === 0) {
    return undefined;
  }

  const mixer = new AnimationMixer(scene as object);
  const actionsByName = new Map<string, AnimationActionLike>();

  return {
    clips() {
      return clips.map((clip, index) => readClipName(clip, index));
    },
    play(name, options = {}) {
      const clip = clips.find((candidate, index) => readClipName(candidate, index) === name);
      if (!clip) {
        return;
      }
      const action = readAction(mixer, clip);
      applyPlayOptions(action, options);
      action.reset().play();
      actionsByName.set(name, action);
    },
    stop(name) {
      actionsByName.get(name)?.stop();
      actionsByName.delete(name);
    },
    stopAll() {
      for (const action of actionsByName.values()) {
        action.stop();
      }
      actionsByName.clear();
    },
    setTime(seconds) {
      if ("setTime" in mixer && typeof (mixer as { setTime?: unknown }).setTime === "function") {
        (mixer as { setTime: (time: number) => void }).setTime(Math.max(0, seconds));
      }
    },
    update(deltaMilliseconds) {
      mixer.update(Math.max(0, deltaMilliseconds) / 1000);
    },
    dispose() {
      this.stopAll();
      if ("uncacheRoot" in mixer && typeof (mixer as { uncacheRoot?: unknown }).uncacheRoot === "function") {
        (mixer as { uncacheRoot: (root: object) => void }).uncacheRoot(scene as object);
      }
    },
  };
}

function applyPlayOptions(action: AnimationActionLike, options: WebGLEffectAnimationPlayOptions): void {
  if (options.loop) {
    action.setLoop?.(options.loop === "once" ? LoopOnce : LoopRepeat, options.loop === "once" ? 1 : Infinity);
  }
  if (options.fadeInMs) {
    action.fadeIn?.(Math.max(0, options.fadeInMs) / 1000);
  }
  if (options.timeScale !== undefined) {
    action.timeScale = options.timeScale;
  }
}

function readAction(mixer: AnimationMixer, clip: AnimationClipLike): AnimationActionLike {
  return (mixer.clipAction as unknown as (candidate: AnimationClipLike) => AnimationActionLike)(clip);
}

function readModelScene(model: unknown): unknown {
  return model && typeof model === "object" ? (model as { scene?: unknown }).scene : undefined;
}

function readAnimationClips(model: unknown): readonly AnimationClipLike[] {
  const animations = model && typeof model === "object" ? (model as { animations?: unknown }).animations : undefined;
  return Array.isArray(animations) ? animations : [];
}

function readClipName(clip: AnimationClipLike, index: number): string {
  return clip.name && clip.name.trim() ? clip.name : `clip-${index}`;
}
```

- [ ] **Step 2: Use animation controller in model renderable**

In `packages/dom-webgl-runtime/src/lib/render/renderables/modelRenderable.ts`, replace the older animation driver with the new controller:

```ts
import {
  createModelAnimationController,
  type ModelAnimationController,
} from "./modelAnimationControls";
```

Change state:

```ts
animation: undefined as ModelAnimationController | undefined,
```

When model loads:

```ts
state.animation = createModelAnimationController(model);
state.modelHandle = createModelEffectHandle(modelObject3D, {
  animation: state.animation,
});
```

On dispose:

```ts
state.animation?.dispose();
state.scene?.controller.dispose();
resource.dispose();
```

- [ ] **Step 3: Expose animation through object capabilities**

In `packages/dom-webgl-runtime/src/lib/render/renderables/modelEffectHandle.ts`, accept options:

```ts
export type ModelEffectHandleOptions = {
  animation?: WebGLEffectAnimationFacade;
};

export function createModelEffectHandle(
  object3D: unknown,
  options: ModelEffectHandleOptions = {},
): WebGLModelEffectHandle {
  return {
    ...createObject3DControls(object3D, {
      scaleZ: "x",
      opacity: { kind: "object" },
    }),
    get animation() {
      return options.animation;
    },
    // existing methods
  };
}
```

Update `WebGLModelEffectHandle` in `effectAuthoring.ts`:

```ts
export type WebGLModelEffectHandle = WebGLEffectRenderableHandle & {
  readonly animation?: WebGLEffectAnimationFacade;
  getMeshes(): readonly WebGLModelMeshHandle[];
  forEachMesh(visitor: (mesh: WebGLModelMeshHandle) => void): void;
  sampleVertices(options?: { maxPoints?: number }): Float32Array;
  createPointLayer(options: WebGLEffectPointLayerOptions): WebGLEffectManagedObjectHandle;
};
```

In `effectObjectCapabilities.ts`, map:

```ts
return {
  animation: source.model.animation,
  material: primaryMaterial,
  model: {
    // existing fields
  },
};
```

- [ ] **Step 4: Add animation tests**

In `packages/dom-webgl-runtime/test/lib/render/renderables/modelEffectHandle.test.ts`, add:

```ts
test("exposes animation facade without raw mixer", () => {
  const animation = {
    clips: vi.fn(() => ["Idle"]),
    play: vi.fn(),
    stop: vi.fn(),
    stopAll: vi.fn(),
    setTime: vi.fn(),
  };
  const handle = createModelEffectHandle({ children: [] }, { animation });

  handle.animation?.play("Idle", { loop: "repeat" });

  expect(animation.play).toHaveBeenCalledWith("Idle", { loop: "repeat" });
  expect("mixer" in handle).toBe(false);
});
```

- [ ] **Step 5: Run animation tests**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/render/renderables/modelRenderable.test.ts packages/dom-webgl-runtime/test/lib/render/renderables/modelEffectHandle.test.ts packages/dom-webgl-runtime/test/publicExports.test.ts
```

Expected: PASS. Visible models with animations continue updating only while visible.

- [ ] **Step 6: Commit animation facade**

```bash
git add packages/dom-webgl-runtime/src/lib/render/renderables/modelAnimationControls.ts packages/dom-webgl-runtime/src/lib/render/renderables/modelRenderable.ts packages/dom-webgl-runtime/src/lib/render/renderables/modelEffectHandle.ts packages/dom-webgl-runtime/src/lib/effects/effectObjectCapabilities.ts packages/dom-webgl-runtime/src/lib/effects/effectAuthoring.ts packages/dom-webgl-runtime/test/lib/render/renderables/modelRenderable.test.ts packages/dom-webgl-runtime/test/lib/render/renderables/modelEffectHandle.test.ts packages/dom-webgl-runtime/test/publicExports.test.ts
git commit -m "feat: add managed model animation facade"
```

## Task 7: Example Dogfood With `4.glb`

**Files:**

- Modify: `apps/example/src/modelEffects.ts`
- Modify: `apps/example/src/exampleEffects.ts`
- Modify: `apps/example/src/exampleEffectDeclarations.ts`
- Modify: `apps/example/src/exampleResourceScheduler.ts`
- Modify: `apps/example/src/App.tsx`
- Test: `apps/example/test/modelEffects.test.ts`
- Test: `apps/example/test/App.test.tsx`

- [ ] **Step 1: Add rotating floating glow effect**

In `apps/example/src/modelEffects.ts`, add:

```ts
type ModelFloatGlowParams = {
  kind: "example.modelFloatGlow";
  amplitude?: number;
  speed?: number;
  emissive?: string;
  lightIntensity?: number;
};

export const exampleModelFloatGlowEffect = defineWebGLEffect<ModelFloatGlowParams>({
  kind: "example.modelFloatGlow",
  source: "model/glb",
  setup(ctx, params) {
    const bloom = ctx.object.postprocess.request({
      key: `${ctx.key}.bloom`,
      bloom: { strength: 0.42, radius: 0.24, threshold: 0.62 },
    });
    ctx.resources.addDisposable(() => bloom.dispose());

    ctx.object.material?.emissive.set(params.emissive ?? "#7dd3fc", 1.4);
    const light = ctx.object.lights?.point(`${ctx.key}.glow`, {
      color: params.emissive ?? "#7dd3fc",
      intensity: params.lightIntensity ?? 2.2,
      distance: 460,
      follow: "object",
    });
    if (light) {
      ctx.resources.addDisposable(() => light.dispose());
    }

    return undefined;
  },
  update(ctx, _state, params) {
    if (!ctx.object.model) {
      return;
    }

    const amplitude = clampNumber(params.amplitude, 0, 96, 32);
    const speed = clampNumber(params.speed, 0, 3, 0.42);
    const centerX = ctx.layout.left + ctx.layout.width / 2;
    const centerY = ctx.layout.top + ctx.layout.height / 2;
    const floatY = centerY + Math.sin(ctx.time / 760) * amplitude;

    ctx.object.visible = true;
    ctx.object.position.set(centerX, floatY, 0);
    ctx.object.rotation.set(
      Math.sin(ctx.time / 1100) * 0.18,
      (ctx.time / 1000) * speed,
      0,
    );
    ctx.object.scale.setScalar(1 + Math.sin(ctx.time / 900) * 0.025);
  },
});
```

- [ ] **Step 2: Register effect and params**

In `apps/example/src/exampleEffects.ts`, add `exampleModelFloatGlowEffect` to the exported array.

In `apps/example/src/exampleEffectDeclarations.ts`, add:

```ts
"example.modelFloatGlow": {
  amplitude?: number;
  speed?: number;
  emissive?: string;
  lightIntensity?: number;
};
```

- [ ] **Step 3: Warm both model assets**

In `apps/example/src/exampleResourceScheduler.ts`, replace the single model warm with:

```ts
const heroModelReady = warmModel("/models/hero.glb");
const fourModelReady = warmModel("/models/4.glb");
const modelReady = Promise.all([heroModelReady, fourModelReady]).then((results) =>
  results.every(Boolean),
);
```

- [ ] **Step 4: Add example row**

In `apps/example/src/App.tsx`, after the existing model float row, add:

```tsx
<section className="example-row">
  <EffectDescription source="model/glb" title="模型自发光">
    用 Three-like managed facade 控制 GLB 的位置、旋转、材质发光、点光源和 bloom。
  </EffectDescription>
  {exampleResources.modelReady ? (
    <WebGLTarget
      as="section"
      className="example-panel example-panel-model example-panel-model-glow"
      webgl={{
        key: "example.model.float-glow",
        source: {
          kind: "model",
          type: "glb",
          src: "/models/4.glb",
        },
        lifecycle: { hideWhenReady: true, hideMode: "subtree" },
        effects: [
          {
            kind: "example.modelFloatGlow",
            amplitude: 30,
            speed: 0.46,
            emissive: "#7dd3fc",
            lightIntensity: 2.2,
          },
        ],
      }}
    >
      <strong>Managed Three-like API 控制模型发光和灯光。</strong>
    </WebGLTarget>
  ) : (
    <section className="example-panel example-panel-model example-panel-model-glow" />
  )}
</section>
```

- [ ] **Step 5: Add effect test**

In `apps/example/test/modelEffects.test.ts`, add:

```ts
test("model float glow uses managed material lights and postprocess", () => {
  const material = {
    emissive: { set: vi.fn() },
  };
  const lights = {
    point: vi.fn(() => ({ dispose: vi.fn(), remove: vi.fn(), setVisible: vi.fn() })),
  };
  const postprocess = {
    request: vi.fn(() => ({ update: vi.fn(), dispose: vi.fn() })),
  };
  const ctx = createEffectContext({
    key: "example.model.float-glow",
    source: { kind: "model", type: "glb", src: "/models/4.glb" },
    object: {
      model: createModelFacade(),
      material,
      lights,
      postprocess,
    },
    time: 1200,
  });

  exampleModelFloatGlowEffect.setup?.(ctx, {
    kind: "example.modelFloatGlow",
    emissive: "#7dd3fc",
    lightIntensity: 2.2,
  });
  exampleModelFloatGlowEffect.update(ctx, undefined, {
    kind: "example.modelFloatGlow",
    amplitude: 30,
    speed: 0.46,
  });

  expect(material.emissive.set).toHaveBeenCalledWith("#7dd3fc", 1.4);
  expect(lights.point).toHaveBeenCalledWith("example.model.float-glow.glow", {
    color: "#7dd3fc",
    intensity: 2.2,
    distance: 460,
    follow: "object",
  });
  expect(postprocess.request).toHaveBeenCalledWith({
    key: "example.model.float-glow.bloom",
    bloom: { strength: 0.42, radius: 0.24, threshold: 0.62 },
  });
});
```

- [ ] **Step 6: Run example tests**

Run:

```bash
npm test -- --run apps/example/test/modelEffects.test.ts apps/example/test/App.test.tsx
```

Expected: PASS and App test includes `/models/4.glb` declaration.

- [ ] **Step 7: Commit example dogfood**

```bash
git add apps/example/src/modelEffects.ts apps/example/src/exampleEffects.ts apps/example/src/exampleEffectDeclarations.ts apps/example/src/exampleResourceScheduler.ts apps/example/src/App.tsx apps/example/test/modelEffects.test.ts apps/example/test/App.test.tsx apps/example/public/models/4.glb
git commit -m "feat: dogfood managed three-like model glow"
```

## Task 8: Docs, Guardrails, And Full Verification

**Files:**

- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `docs/00-goal.md`
- Modify: `docs/EXECUTION_STATE.md`
- Modify: `docs/agent/effect-object-boundary.md`
- Modify: `docs/agent/package-usage.md`
- Modify: `docs/agent/package-onboarding.md`
- Modify: `docs/agent/custom-effects.md`
- Modify: `docs/examples/effect-authoring.md`

- [ ] **Step 1: Update package docs with the managed API thesis**

In `README.md` and `docs/agent/effect-object-boundary.md`, add this exact principle near the effect model section:

```md
The public authoring model is managed Three-like API: consumers use familiar
Three.js vocabulary such as `position`, `rotation`, `scale`, `material`,
`lights`, and `animation`, while the runtime owns raw Three.js renderer, scene,
camera, objects, materials, textures, loaders, mixers, lights, render targets,
scroll, pointer, lifecycle, disposal, and performance scheduling.
```

- [ ] **Step 2: Update usage docs with the canonical example**

In `docs/agent/package-usage.md`, add:

```ts
const modelGlow = defineWebGLEffect({
  kind: "app.modelGlow",
  source: "model/glb",
  setup(ctx) {
    ctx.object.material?.emissive.set("#7dd3fc", 1.8);
    ctx.object.lights?.point("glow", {
      color: "#7dd3fc",
      intensity: 2.4,
      distance: 420,
      follow: "object",
    });
    ctx.object.postprocess.request({
      key: "app.modelGlow.bloom",
      bloom: { strength: 0.45, radius: 0.25, threshold: 0.7 },
    });
  },
  update(ctx) {
    ctx.object.rotation.y += ctx.delta / 1000;
    ctx.object.position.y += Math.sin(ctx.time / 700) * 0.5;
  },
});
```

Also add the Draco declaration:

```ts
source: {
  kind: "model",
  type: "glb",
  src: "/models/product.glb",
  loader: {
    draco: { decoderPath: "/draco/" },
  },
}
```

- [ ] **Step 3: Add public boundary guardrail text**

In `docs/agent/package-onboarding.md` and `docs/agent/custom-effects.md`, add:

```md
When porting from Three.js, keep the mental model and port the algorithm, not
the ownership. Do not create a renderer, scene, camera, loader, light, mesh,
material, texture, mixer, composer, pass, render target, or render loop in
consumer effects. Ask for or use a managed facade under `ctx.object`.
```

- [ ] **Step 4: Update execution state**

In `docs/EXECUTION_STATE.md`, add a current-truth entry:

```md
Managed Three-like object API is the current public effect authoring direction:
`ctx.object` owns transform, material, lights, animation, source-backed modules,
and postprocess requests through controlled facades. Runtime remains responsible
for raw Three.js internals, model loader configuration including Draco, resource
lifetime, fallback visibility, scroll/pointer monitoring, and scheduling.
```

- [ ] **Step 5: Run full verification**

Run:

```bash
npm run test -- --run
npm run typecheck
npm run build
npm run check:imports
git diff --check
```

Expected:

- tests pass;
- typecheck passes;
- build passes, allowing existing Vite chunk-size warnings if unchanged;
- import boundary check passes;
- `git diff --check` has no whitespace errors.

- [ ] **Step 6: Check for forbidden public raw Three.js cues**

Run:

```bash
rg -n "raw object3D|raw mesh|raw material|scene\\.add|new THREE|setDRACOLoader|configureLoader|onGLTFLoaded|EffectComposer|WebGLRenderTarget" README.md docs AGENTS.md packages/dom-webgl-runtime/src packages/dom-webgl-runtime/test/publicExports.test.ts
```

Expected: matches only in negative guardrails, internal implementation files, tests proving rejection, or docs warning not to use those paths.

- [ ] **Step 7: Commit docs and final verification state**

```bash
git add README.md AGENTS.md docs/00-goal.md docs/EXECUTION_STATE.md docs/agent/effect-object-boundary.md docs/agent/package-usage.md docs/agent/package-onboarding.md docs/agent/custom-effects.md docs/examples/effect-authoring.md
git commit -m "docs: document managed three-like object api"
```

## Self-Review

Spec coverage:

- Three.js-like consumer mental model: covered by Tasks 1, 2, 4, 5, 6, 7, and 8.
- Runtime owns all raw Three.js objects and lifecycle: covered by Design Rules, Tasks 3, 4, 5, 6, and public negative tests.
- Single canvas, scroll monitor, pointer monitor, render control: preserved by keeping `WebGLRuntime` architecture and only adding managed facades.
- Avoid piecemeal capability additions: covered by one capability matrix and top-level `ctx.object` modules.
- Modular, low coupling, high cohesion, single responsibility: covered by File Structure and task-specific modules.
- No extra consumer mental burden for AI agents: covered by canonical Three-like syntax in public tests, example dogfood, and docs.

Placeholder scan:

- This plan uses concrete file paths, concrete code snippets, and defined task outputs.
- Every implementation task has concrete file paths, code snippets, commands, and expected results.

Type consistency:

- Public type names use `WebGLEffect*` for effect facades and `WebGLModelLoaderDeclaration` for declaration/runtime loader configuration.
- The public syntax consistently routes through `ctx.object`.
- Loader configuration is declarative on source declarations and runtime options, not a public loader callback.
