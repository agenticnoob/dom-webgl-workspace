# Opt-In Scene Camera Pass Declarations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add managed opt-in `WebGLScene`, `WebGLCamera`, and `WebGLRenderPass` declarations while keeping Level 1 `WebGLTarget` usage unchanged and default.

**Implementation status:** Executed in this round. Roadmap Phase 2 is now marked `[verified]`; this plan remains as the focused implementation record. Follow-up branch `codex/react-scene-render-api` keeps `WebGLScene render` as the primary React-owned render declaration and replaces generated `main` ids with the internal reserved `__dom-webgl-default__` id so consumer ids such as `main` remain valid.

**Architecture:** Extend the Phase 1 internal render-layer registry from generated default entries to runtime-owned managed scene/camera/pass entries. React declarations register descriptors through runtime lifecycle methods, and `WebGLTarget` inherits the nearest managed scene through React context; vanilla users can use equivalent descriptor/runtime methods with explicit ids. Phase 2 only establishes ownership, routing, duplicate diagnostics, and public ergonomics; projection policies, stage-local placement, pass-scoped postprocess, and scene-native models remain later phases.

**Tech Stack:** TypeScript, React, Vitest, jsdom, existing internal Three.js renderer adapter, existing DOM-first runtime factories.

---

## Current Truth

- At implementation start, roadmap `Roadmap Status` marked Phase 2 as `[planned]` and linked this focused plan.
- Phase 1 is verified: `packages/dom-webgl-runtime/src/lib/renderer/renderLayerRegistry.ts` creates generated `main` scene, `main` camera, and `main` pass only.
- `packages/dom-webgl-runtime/src/lib/types.ts` has no public scene/camera/pass declarations and no `sceneId` on `WebGLDeclaration`.
- `packages/dom-webgl-runtime/src/lib/react/WebGLTarget.tsx` registers targets directly through `runtime.registerTarget(element, webgl)`.
- `packages/dom-webgl-runtime/src/lib/react/runtimeContext.tsx` only provides the runtime instance.
- `packages/dom-webgl-runtime/src/react.ts` exports `WebGLRuntime`, `WebGLTarget`, `WebGLRuntimeProvider`, `useWebGLRuntime`, and debug panel utilities; it does not export `WebGLScene`, `WebGLCamera`, or `WebGLRenderPass`.
- `packages/dom-webgl-runtime/src/lib/render/renderableFactory.ts` receives one `sceneAdapter`, so Phase 2 must make scene adapter selection descriptor-driven before target routing can be real.
- `packages/dom-webgl-runtime/test/publicExports.test.ts` currently rejects `WebGLScene`, `WebGLCamera`, and `WebGLRenderPass` as Phase 1 non-API.

## Scope

- Add managed public descriptor types:
  - `WebGLSceneDeclaration`
  - `WebGLCameraDeclaration`
  - `WebGLRenderPassDeclaration`
  - `WebGLSceneProjection`
  - `WebGLCameraType`
  - `WebGLCameraMode`
- Add `sceneId?: string` to `WebGLDeclaration` so vanilla targets can opt into a managed scene without React context.
- Add runtime lifecycle methods:
  - `registerScene(declaration)`
  - `unregisterScene(id)`
  - `registerCamera(declaration)`
  - `unregisterCamera(id)`
  - `registerRenderPass(declaration)`
  - `unregisterRenderPass(id)`
- Add React components:
  - `<WebGLScene id="world" defaultPass>`
  - `<WebGLCamera id="main" default />`
  - `<WebGLRenderPass scene="world" camera="main" />`
- Make `WebGLTarget` inherit the nearest `WebGLScene` when `webgl.sceneId` is absent.
- Keep targets outside any `WebGLScene` on the implicit generated `main` scene.
- Route renderables to the declared scene adapter when their descriptor carries `sceneId`.
- Keep Phase 2 camera/projection support to `projection: "dom-aligned"`, `type: "orthographic"`, and `mode: "dom-aligned"` so Phase 3 can own projection policy design.
- Add controlled duplicate and unresolved-reference diagnostics.
- Update docs after implementation so package users see the Level 1 path first and Level 2 as opt-in escalation.

## Non-Goals

- Do not expose raw `THREE.Scene`, `THREE.Camera`, `Object3D`, `Mesh`, `Material`, `Texture`, `WebGLRenderer`, render target, composer, render loop, or pass internals.
- Do not add `perspective-stage`, `screen`, `screen-depth`, `screen-plane`, `stage-local`, or other projection/placement policies.
- Do not add `WebGLModel`, stage primitives, lit floor/wall/backdrop helpers, colliders, picking, camera controls, physics, or pass-scoped postprocess.
- Do not change default Level 1 `WebGLTarget` usage or require scenes/cameras/passes in existing examples.
- Do not let user declarations replace the generated `main` scene/camera/pass in Phase 2.
- Do not change effect authoring scope to `ctx.scene`, `ctx.camera`, or `ctx.runtime`; Phase 5 owns scoped effect contexts.
- Do not commit during this planning turn. During implementation, commit only when the user explicitly asks for a commit.

## API And Architecture Principles

- DOM-first remains the default: `<WebGLRuntime><WebGLTarget ... /></WebGLRuntime>` must stay valid and unchanged.
- React mental model: component nesting expresses scene ownership; props are descriptor-like; mount/unmount maps to runtime registration/disposal.
- Agent-first names: public ids use `sceneId`, `cameraId`, and `passId` in runtime descriptors; React components use ergonomic props `id`, `scene`, and `camera`.
- Three-like vocabulary stays managed: `scene`, `camera`, and `renderPass` mean runtime-owned descriptors and controlled routing, not raw Three.js instances.
- Explicit scope: targets belong to a scene; passes choose scene + camera; cameras belong to scenes.
- Low coupling: keep normalization/diagnostics separate from React components and renderer object creation.
- Smallest useful Phase 2: support dom-aligned scene separation and explicit pass order; defer projection/stage behavior until later phases.

## Proposed Public Shape

React:

```tsx
import {
  WebGLCamera,
  WebGLRenderPass,
  WebGLRuntime,
  WebGLScene,
  WebGLTarget,
} from "@project/dom-webgl-runtime/react";

export function Example() {
  return (
    <WebGLRuntime effects={runtimeEffects}>
      <WebGLTarget webgl={{ key: "hero.title", source: { kind: "dom", type: "text" } }}>
        Hero title
      </WebGLTarget>

      <WebGLScene id="world" defaultPass>
        <WebGLCamera id="world.camera" default />
        <WebGLTarget
          webgl={{
            key: "hero.model",
            source: { kind: "model", type: "glb", src: "/models/hero.glb" },
          }}
        >
          <div aria-label="Hero model fallback" />
        </WebGLTarget>
      </WebGLScene>

      <WebGLScene id="overlay">
        <WebGLCamera id="overlay.camera" default />
        <WebGLTarget webgl={{ key: "hud.title", source: { kind: "dom", type: "text" } }}>
          HUD title
        </WebGLTarget>
      </WebGLScene>

      <WebGLRenderPass id="overlay.pass" scene="overlay" camera="overlay.camera" order={1} />
    </WebGLRuntime>
  );
}
```

Vanilla/runtime descriptor parity:

```ts
const runtime = createWebGLRuntime({ container, effects: runtimeEffects });

runtime.registerScene({ id: "world", defaultCameraId: "world.camera" });
runtime.registerCamera({
  id: "world.camera",
  sceneId: "world",
  default: true,
  type: "orthographic",
  mode: "dom-aligned",
});
runtime.registerRenderPass({
  id: "world.pass",
  sceneId: "world",
  cameraId: "world.camera",
  order: 0,
});
runtime.registerTarget(element, {
  key: "hero.model",
  sceneId: "world",
  source: { kind: "model", type: "glb", src: "/models/hero.glb" },
});
```

## File Structure

- Modify `packages/dom-webgl-runtime/src/lib/types.ts`
  - Add public managed scene/camera/pass descriptor types.
  - Add `sceneId?: string` to `WebGLDeclaration`.
  - Add runtime registration methods to `WebGLRuntime`.
  - Add debug ids if accepted in Task 8.
- Modify `packages/dom-webgl-runtime/src/index.ts`
  - Export public descriptor types from the root entrypoint.
- Create `packages/dom-webgl-runtime/src/lib/renderer/renderLayerDeclarations.ts`
  - Normalize ids, defaults, reserved `main` checks, and render pass ids.
  - Keep pure descriptor validation out of React and runtime.
- Modify `packages/dom-webgl-runtime/src/lib/renderer/renderLayerRegistry.ts`
  - Store generated `main` entries and user-managed entries.
  - Register/unregister scenes, cameras, and render passes.
  - Resolve pass scene/camera references at render time.
  - Expose `getSceneAdapterForTarget(sceneId)` for target renderable creation.
- Modify `packages/dom-webgl-runtime/src/lib/renderer/threeRenderer.ts`
  - Export internal helpers for creating managed dom-aligned scene/camera adapter entries.
  - Keep raw Three objects behind internal adapter types.
- Modify `packages/dom-webgl-runtime/src/lib/render/renderableFactory.ts`
  - Replace the single `sceneAdapter` context value with descriptor-driven adapter lookup.
- Modify `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`
  - Add runtime methods.
  - Route target renderables by `descriptor.declaration.sceneId ?? "main"`.
  - Request render frames when scene/camera/pass declarations change.
  - Dispose managed render-layer entries on unregister/runtime dispose.
- Create `packages/dom-webgl-runtime/src/lib/react/sceneContext.tsx`
  - Provides nearest scene id for nested `WebGLTarget`, `WebGLCamera`, and `WebGLRenderPass`.
- Create `packages/dom-webgl-runtime/src/lib/react/WebGLScene.tsx`
  - Registers/unregisters managed scenes and provides scene context.
- Create `packages/dom-webgl-runtime/src/lib/react/WebGLCamera.tsx`
  - Registers/unregisters managed cameras under nearest scene.
- Create `packages/dom-webgl-runtime/src/lib/react/WebGLRenderPass.tsx`
  - Registers/unregisters managed render passes.
- Modify `packages/dom-webgl-runtime/src/lib/react/WebGLRuntime.tsx`
  - Update pending runtime stub with no-op managed declaration methods.
- Modify `packages/dom-webgl-runtime/src/lib/react/WebGLTarget.tsx`
  - Merge nearest scene id into `webgl.sceneId` when absent.
- Modify `packages/dom-webgl-runtime/src/react.ts`
  - Export the new React components and prop types.
- Add or modify tests:
  - `packages/dom-webgl-runtime/test/publicExports.test.ts`
  - `packages/dom-webgl-runtime/test/lib/renderer/renderLayerDeclarations.test.ts`
  - `packages/dom-webgl-runtime/test/lib/renderer/renderLayerRegistry.test.ts`
  - `packages/dom-webgl-runtime/test/lib/renderer/runtimePipeline.test.ts`
  - `packages/dom-webgl-runtime/test/lib/react/WebGLScene.test.tsx`
  - `packages/dom-webgl-runtime/test/lib/react/WebGLCamera.test.tsx`
  - `packages/dom-webgl-runtime/test/lib/react/WebGLRenderPass.test.tsx`
  - `packages/dom-webgl-runtime/test/lib/react/WebGLTarget.test.tsx`
- Update docs:
  - `README.md`
  - `docs/STATUS.md`
  - `docs/roadmap/managed-render-system.md`
  - `docs/agent/package-onboarding.md`
  - `docs/agent/package-usage.md`

## Task 1: Add Failing Public API And Type Boundary Tests

**Files:**
- Modify: `packages/dom-webgl-runtime/test/publicExports.test.ts`

- [ ] **Step 1: Update the React entrypoint runtime import assertion**

Add these expectations to the existing `React entrypoint exposes the public React adapter` test:

```ts
expect(reactApi.WebGLScene).toEqual(expect.any(Function));
expect(reactApi.WebGLCamera).toEqual(expect.any(Function));
expect(reactApi.WebGLRenderPass).toEqual(expect.any(Function));
```

- [ ] **Step 2: Update the React type fixture imports**

Replace the existing fixture import in `React entrypoint type-checks public gate declarations only` with:

```ts
import {
  WebGLCamera,
  WebGLRenderPass,
  WebGLRuntime,
  WebGLScene,
  WebGLTarget,
} from "${importPath}";
import type {
  WebGLCameraProps,
  WebGLRenderPassProps,
  WebGLRuntimeProps,
  WebGLSceneProps,
  WebGLTargetProps,
} from "${importPath}";
import type { ReactElement } from "react";
```

Remove the three Phase 1 `@ts-expect-error` imports that reject public `WebGLScene`, `WebGLCamera`, and `WebGLRenderPass`.

- [ ] **Step 3: Add a React fixture that type-checks Level 1 and Level 2 together**

Add this fixture content after the existing `runtimeElement` assertion:

```tsx
const levelTwoElement = (
  <WebGLRuntime effects={effects} progressSignals={progressSignals}>
    <WebGLTarget
      webgl={{
        key: "level1.title",
        source: { kind: "dom", type: "text" },
      }}
    >
      Level 1 still works
    </WebGLTarget>

    <WebGLScene id="world" defaultPass>
      <WebGLCamera id="world.camera" default />
      <WebGLTarget
        webgl={{
          key: "world.model",
          source: { kind: "model", type: "glb", src: "/models/hero.glb" },
        }}
      >
        <div />
      </WebGLTarget>
    </WebGLScene>

    <WebGLScene id="overlay">
      <WebGLCamera id="overlay.camera" default />
      <WebGLTarget
        webgl={{
          key: "overlay.title",
          source: { kind: "dom", type: "text" },
        }}
      >
        Overlay title
      </WebGLTarget>
    </WebGLScene>
    <WebGLRenderPass
      id="overlay.pass"
      scene="overlay"
      camera="overlay.camera"
      order={1}
    />
  </WebGLRuntime>
);

levelTwoElement satisfies ReactElement;

const sceneProps = {
  id: "world",
  defaultPass: true,
} satisfies WebGLSceneProps;
sceneProps satisfies WebGLSceneProps;

const cameraProps = {
  id: "world.camera",
  default: true,
  type: "orthographic",
  mode: "dom-aligned",
} satisfies WebGLCameraProps;
cameraProps satisfies WebGLCameraProps;

const passProps = {
  id: "world.pass",
  scene: "world",
  camera: "world.camera",
  order: 0,
} satisfies WebGLRenderPassProps;
passProps satisfies WebGLRenderPassProps;
```

- [ ] **Step 4: Keep raw Three.js handles rejected**

Add these raw Three type imports to the same React fixture:

```ts
import type { Scene as ThreeScene } from "three/src/scenes/Scene.js";
import type { Camera as ThreeCamera } from "three/src/cameras/Camera.js";
```

Then add negative public-prop assertions:

```ts
declare const rawScene: ThreeScene;
declare const rawCamera: ThreeCamera;

// @ts-expect-error WebGLScene does not accept a raw Three scene handle.
const rawSceneProps = { id: "raw", scene: rawScene } satisfies WebGLSceneProps;

// @ts-expect-error WebGLCamera does not accept a raw Three camera handle.
const rawCameraProps = { id: "raw.camera", camera: rawCamera } satisfies WebGLCameraProps;
```

- [ ] **Step 5: Add root entrypoint type checks**

In `root entrypoint type-checks public types and hides internal types`, add public type imports:

```ts
WebGLCameraDeclaration,
WebGLCameraMode,
WebGLCameraType,
WebGLRenderPassDeclaration,
WebGLSceneDeclaration,
WebGLSceneProjection,
```

Add fixture assertions:

```ts
const sceneDeclaration = {
  id: "world",
  defaultCameraId: "world.camera",
  defaultPass: true,
} satisfies WebGLSceneDeclaration;

const cameraDeclaration = {
  id: "world.camera",
  sceneId: "world",
  default: true,
  type: "orthographic",
  mode: "dom-aligned",
} satisfies WebGLCameraDeclaration;

const passDeclaration = {
  id: "world.pass",
  sceneId: "world",
  cameraId: "world.camera",
  order: 0,
} satisfies WebGLRenderPassDeclaration;

const projection = "dom-aligned" satisfies WebGLSceneProjection;
const cameraType = "orthographic" satisfies WebGLCameraType;
const cameraMode = "dom-aligned" satisfies WebGLCameraMode;

sceneDeclaration satisfies WebGLSceneDeclaration;
cameraDeclaration satisfies WebGLCameraDeclaration;
passDeclaration satisfies WebGLRenderPassDeclaration;
```

- [ ] **Step 6: Run the public export test and verify red**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/publicExports.test.ts
```

Expected: FAIL because `WebGLScene`, `WebGLCamera`, `WebGLRenderPass`, and the descriptor types are not exported yet.

## Task 2: Add Failing Descriptor Normalization Tests

**Files:**
- Create: `packages/dom-webgl-runtime/test/lib/renderer/renderLayerDeclarations.test.ts`
- Create: `packages/dom-webgl-runtime/src/lib/renderer/renderLayerDeclarations.ts`

- [ ] **Step 1: Create descriptor normalization tests**

Create `packages/dom-webgl-runtime/test/lib/renderer/renderLayerDeclarations.test.ts`:

```ts
import { describe, expect, test } from "vitest";

import {
  normalizeRenderLayerCameraDeclaration,
  normalizeRenderLayerPassDeclaration,
  normalizeRenderLayerSceneDeclaration,
  normalizeTargetSceneId,
} from "../../../src/lib/renderer/renderLayerDeclarations";
import type {
  WebGLCameraDeclaration,
  WebGLSceneDeclaration,
} from "../../../src/lib/types";

describe("render layer declaration normalization", () => {
  test("normalizes scene defaults without changing Level 1 main behavior", () => {
    expect(
      normalizeRenderLayerSceneDeclaration({
        id: " world ",
        defaultCameraId: " world.camera ",
        defaultPass: true,
      }),
    ).toEqual({
      id: "world",
      projection: "dom-aligned",
      defaultCameraId: "world.camera",
      defaultPass: true,
    });
  });

  test("normalizes camera defaults under an explicit scene", () => {
    expect(
      normalizeRenderLayerCameraDeclaration({
        id: " world.camera ",
        sceneId: " world ",
        default: true,
      }),
    ).toEqual({
      id: "world.camera",
      sceneId: "world",
      type: "orthographic",
      mode: "dom-aligned",
      default: true,
    });
  });

  test("normalizes pass defaults and derives id from scene plus camera", () => {
    expect(
      normalizeRenderLayerPassDeclaration({
        sceneId: " world ",
        cameraId: " world.camera ",
      }),
    ).toEqual({
      id: "world:world.camera:pass",
      sceneId: "world",
      cameraId: "world.camera",
      order: 0,
    });
  });

  test("keeps explicit target scene ids trimmed and defaults missing ids to main", () => {
    expect(normalizeTargetSceneId(" overlay ")).toBe("overlay");
    expect(normalizeTargetSceneId(undefined)).toBe("main");
  });

  test("rejects empty ids and generated main overrides", () => {
    expect(() => normalizeRenderLayerSceneDeclaration({ id: " " })).toThrow(
      'WebGL scene declaration requires a non-empty id.',
    );
    expect(() => normalizeRenderLayerSceneDeclaration({ id: "main" })).toThrow(
      'WebGL scene id "main" is reserved by the generated Level 1 scene.',
    );
    expect(() =>
      normalizeRenderLayerCameraDeclaration({ id: "main", sceneId: "world" }),
    ).toThrow(
      'WebGL camera id "main" is reserved by the generated Level 1 camera.',
    );
    expect(() =>
      normalizeRenderLayerPassDeclaration({ id: "main", sceneId: "world" }),
    ).toThrow(
      'WebGL render pass id "main" is reserved by the generated Level 1 pass.',
    );
  });

  test("rejects future projection and camera policies in Phase 2", () => {
    const invalidSceneDeclaration: WebGLSceneDeclaration = {
      id: "world",
      // @ts-expect-error Phase 2 does not expose perspective-stage projection.
      projection: "perspective-stage",
    };
    const invalidCameraDeclaration: WebGLCameraDeclaration = {
      id: "world.camera",
      sceneId: "world",
      // @ts-expect-error Phase 2 does not expose perspective cameras.
      type: "perspective",
    };

    expect(() =>
      normalizeRenderLayerSceneDeclaration(invalidSceneDeclaration),
    ).toThrow('Unsupported WebGL scene projection "perspective-stage".');
    expect(() =>
      normalizeRenderLayerCameraDeclaration(invalidCameraDeclaration),
    ).toThrow('Unsupported WebGL camera type "perspective".');
  });
});
```

- [ ] **Step 2: Add a temporary empty module to confirm typed red**

Create `packages/dom-webgl-runtime/src/lib/renderer/renderLayerDeclarations.ts` with only:

```ts
export {};
```

- [ ] **Step 3: Run the focused test and verify red**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/renderer/renderLayerDeclarations.test.ts
```

Expected: FAIL because the normalization functions do not exist.

## Task 3: Implement Public Types And Descriptor Normalization

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/types.ts`
- Modify: `packages/dom-webgl-runtime/src/index.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/renderLayerDeclarations.ts`
- Test: `packages/dom-webgl-runtime/test/lib/renderer/renderLayerDeclarations.test.ts`
- Test: `packages/dom-webgl-runtime/test/publicExports.test.ts`

- [ ] **Step 1: Add public descriptor types**

In `packages/dom-webgl-runtime/src/lib/types.ts`, add near the current render/source declarations:

```ts
export type WebGLSceneProjection = "dom-aligned";

export type WebGLCameraType = "orthographic";

export type WebGLCameraMode = "dom-aligned";

export type WebGLSceneDeclaration = {
  id: string;
  projection?: WebGLSceneProjection;
  defaultCameraId?: string;
  defaultPass?: boolean;
};

export type WebGLCameraDeclaration = {
  id: string;
  sceneId: string;
  type?: WebGLCameraType;
  mode?: WebGLCameraMode;
  default?: boolean;
};

export type WebGLRenderPassDeclaration = {
  id?: string;
  sceneId: string;
  cameraId?: string;
  order?: number;
};
```

Extend `WebGLDeclaration`:

```ts
export type WebGLDeclaration = {
  key: string;
  sceneId?: string;
  source?: WebGLSourceDeclaration;
  renderRole?: WebGLRenderRole;
  scroll?: WebGLScrollBehavior;
  pointer?: WebGLPointerDeclaration;
  lifecycle?: WebGLLifecycleDeclaration;
  effects?: WebGLEffectsDeclaration;
  transformScope?: WebGLTransformScope;
};
```

Extend `WebGLRuntime`:

```ts
export type WebGLRuntime = {
  readonly container: HTMLElement;
  registerScene(declaration: WebGLSceneDeclaration): void;
  unregisterScene(id: string): void;
  registerCamera(declaration: WebGLCameraDeclaration): void;
  unregisterCamera(id: string): void;
  registerRenderPass(declaration: WebGLRenderPassDeclaration): void;
  unregisterRenderPass(id: string): void;
  registerTarget(element: HTMLElement, declaration: WebGLDeclaration): void;
  unregisterTarget(key: string): void;
  sync(): void | Promise<void>;
  getDebugState(): WebGLDebugState;
  dispose(): void;
};
```

- [ ] **Step 2: Export root descriptor types**

In `packages/dom-webgl-runtime/src/index.ts`, add these to the existing type export from `./lib/types`:

```ts
WebGLCameraDeclaration,
WebGLCameraMode,
WebGLCameraType,
WebGLRenderPassDeclaration,
WebGLSceneDeclaration,
WebGLSceneProjection,
```

- [ ] **Step 3: Implement normalization helpers**

Replace `packages/dom-webgl-runtime/src/lib/renderer/renderLayerDeclarations.ts` with:

```ts
import type {
  WebGLCameraDeclaration,
  WebGLCameraMode,
  WebGLCameraType,
  WebGLRenderPassDeclaration,
  WebGLSceneDeclaration,
  WebGLSceneProjection,
} from "../types";

export type NormalizedRenderLayerSceneDeclaration = {
  id: string;
  projection: WebGLSceneProjection;
  defaultCameraId?: string;
  defaultPass: boolean;
};

export type NormalizedRenderLayerCameraDeclaration = {
  id: string;
  sceneId: string;
  type: WebGLCameraType;
  mode: WebGLCameraMode;
  default: boolean;
};

export type NormalizedRenderLayerPassDeclaration = {
  id: string;
  sceneId: string;
  cameraId?: string;
  order: number;
};

export function normalizeRenderLayerSceneDeclaration(
  declaration: WebGLSceneDeclaration,
): NormalizedRenderLayerSceneDeclaration {
  const id = normalizePublicId(declaration.id, "scene");
  assertNotReservedMain(id, "scene");
  const projection = declaration.projection ?? "dom-aligned";

  if (projection !== "dom-aligned") {
    throw new Error(`Unsupported WebGL scene projection "${String(projection)}".`);
  }

  return {
    id,
    projection,
    ...(declaration.defaultCameraId
      ? { defaultCameraId: normalizePublicId(declaration.defaultCameraId, "camera") }
      : {}),
    defaultPass: declaration.defaultPass ?? false,
  };
}

export function normalizeRenderLayerCameraDeclaration(
  declaration: WebGLCameraDeclaration,
): NormalizedRenderLayerCameraDeclaration {
  const id = normalizePublicId(declaration.id, "camera");
  const sceneId = normalizePublicId(declaration.sceneId, "scene");
  const type = declaration.type ?? "orthographic";
  const mode = declaration.mode ?? "dom-aligned";

  assertNotReservedMain(id, "camera");

  if (type !== "orthographic") {
    throw new Error(`Unsupported WebGL camera type "${String(type)}".`);
  }

  if (mode !== "dom-aligned") {
    throw new Error(`Unsupported WebGL camera mode "${String(mode)}".`);
  }

  return {
    id,
    sceneId,
    type,
    mode,
    default: declaration.default ?? false,
  };
}

export function normalizeRenderLayerPassDeclaration(
  declaration: WebGLRenderPassDeclaration,
): NormalizedRenderLayerPassDeclaration {
  const sceneId = normalizePublicId(declaration.sceneId, "scene");
  const cameraId = declaration.cameraId
    ? normalizePublicId(declaration.cameraId, "camera")
    : undefined;
  const id = declaration.id
    ? normalizePublicId(declaration.id, "render pass")
    : `${sceneId}:${cameraId ?? "default"}:pass`;

  assertNotReservedMain(id, "render pass");

  return {
    id,
    sceneId,
    ...(cameraId ? { cameraId } : {}),
    order: normalizeOrder(declaration.order),
  };
}

export function normalizeTargetSceneId(sceneId: string | undefined): string {
  if (sceneId === undefined) {
    return "main";
  }

  return normalizePublicId(sceneId, "scene");
}

function normalizePublicId(value: string, kind: string): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error(`WebGL ${kind} declaration requires a non-empty id.`);
  }

  return normalized;
}

function assertNotReservedMain(id: string, kind: "scene" | "camera" | "render pass"): void {
  if (id !== "main") {
    return;
  }

  throw new Error(
    `WebGL ${kind} id "main" is reserved by the generated Level 1 ${kind}.`,
  );
}

function normalizeOrder(value: number | undefined): number {
  if (value === undefined) {
    return 0;
  }

  if (!Number.isFinite(value)) {
    throw new Error("WebGL render pass order must be a finite number.");
  }

  return value;
}
```

- [ ] **Step 4: Run focused tests**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/renderer/renderLayerDeclarations.test.ts packages/dom-webgl-runtime/test/publicExports.test.ts
```

Expected: `renderLayerDeclarations.test.ts` PASS; `publicExports.test.ts` may still fail until React components are exported in Task 6.

## Task 4: Expand The Internal Render Layer Registry

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/renderLayerRegistry.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/threeRenderer.ts`
- Modify: `packages/dom-webgl-runtime/test/lib/renderer/renderLayerRegistry.test.ts`

- [ ] **Step 1: Add failing registry tests**

Append these tests to `packages/dom-webgl-runtime/test/lib/renderer/renderLayerRegistry.test.ts`:

```ts
test("registers managed scene camera and pass entries without replacing main", () => {
  const mainAdapter = createSceneAdapter();
  const worldAdapter = createSceneAdapter();
  const registry = createInternalRenderLayerRegistry(
    createRendererHostStub(mainAdapter),
    {
      createManagedSceneAdapter() {
        return {
          scene: { label: "world-scene" },
          camera: { label: "world-camera" },
          sceneAdapter: worldAdapter,
          dispose() {
            return;
          },
        };
      },
    },
  );

  registry.registerScene({ id: "world", defaultPass: true });
  registry.registerCamera({
    id: "world.camera",
    sceneId: "world",
    default: true,
  });
  registry.registerRenderPass({
    id: "world.pass",
    sceneId: "world",
    cameraId: "world.camera",
    order: 1,
  });

  expect(registry.getScene("main").sceneAdapter).toBe(mainAdapter);
  expect(registry.getScene("world")).toMatchObject({
    id: "world",
    generated: false,
    projection: "dom-aligned",
    scene: { label: "world-scene" },
    sceneAdapter: worldAdapter,
  });
  expect(registry.getCamera("world.camera")).toMatchObject({
    id: "world.camera",
    generated: false,
    type: "orthographic",
    mode: "dom-aligned",
    sceneId: "world",
    camera: { label: "world-camera" },
  });
  expect(registry.getSceneAdapterForTarget("world")).toBe(worldAdapter);
});

test("renders generated and managed passes in order", () => {
  const mainAdapter = createSceneAdapter();
  const overlayAdapter = createSceneAdapter();
  const order: string[] = [];
  const registry = createInternalRenderLayerRegistry(
    createRendererHostStub(mainAdapter),
    {
      createManagedSceneAdapter() {
        return {
          scene: { label: "overlay-scene" },
          camera: { label: "overlay-camera" },
          sceneAdapter: overlayAdapter,
          dispose() {
            return;
          },
        };
      },
    },
  );

  mainAdapter.render.mockImplementation(() => order.push("main"));
  overlayAdapter.render.mockImplementation(() => order.push("overlay"));

  registry.registerScene({ id: "overlay" });
  registry.registerCamera({ id: "overlay.camera", sceneId: "overlay", default: true });
  registry.registerRenderPass({
    id: "overlay.pass",
    sceneId: "overlay",
    cameraId: "overlay.camera",
    order: 1,
  });

  registry.renderPasses((_pass, scene) => {
    scene.sceneAdapter.render();
  });

  expect(order).toEqual(["main", "overlay"]);
});

test("throws controlled diagnostics for duplicates and unresolved references", () => {
  const registry = createInternalRenderLayerRegistry(
    createRendererHostStub(createSceneAdapter()),
  );

  registry.registerScene({ id: "overlay" });

  expect(() => registry.registerScene({ id: "overlay" })).toThrow(
    'WebGL scene id "overlay" is already registered.',
  );
  expect(() =>
    registry.registerCamera({ id: "missing.camera", sceneId: "missing" }),
  ).toThrow('WebGL camera "missing.camera" references unknown scene "missing".');
  expect(() =>
    registry.registerRenderPass({ id: "missing.pass", sceneId: "missing" }),
  ).toThrow('WebGL render pass "missing.pass" references unknown scene "missing".');
});
```

- [ ] **Step 2: Update internal registry types**

Modify `InternalRenderSceneEntry`, `InternalRenderCameraEntry`, and `InternalRenderPassEntry` so ids are strings and managed entries are allowed:

```ts
export type InternalRenderSceneEntry = {
  readonly id: string;
  readonly generated: boolean;
  readonly projection: "dom-aligned";
  readonly scene: object;
  readonly sceneAdapter: WebGLSceneAdapter;
  readonly defaultCameraId?: string;
  readonly dispose?: () => void;
};

export type InternalRenderCameraEntry = {
  readonly id: string;
  readonly generated: boolean;
  readonly sceneId: string;
  readonly type: "orthographic";
  readonly mode: "dom-aligned";
  readonly camera: object;
  readonly dispose?: () => void;
};

export type InternalRenderPassEntry = {
  readonly id: string;
  readonly generated: boolean;
  readonly sceneId: string;
  readonly cameraId: string;
  readonly order: number;
};
```

Add methods to `InternalRenderLayerRegistry`:

```ts
registerScene(declaration: WebGLSceneDeclaration): void;
unregisterScene(id: string): void;
registerCamera(declaration: WebGLCameraDeclaration): void;
unregisterCamera(id: string): void;
registerRenderPass(declaration: WebGLRenderPassDeclaration): void;
unregisterRenderPass(id: string): void;
getSceneAdapterForTarget(sceneId: string | undefined): WebGLSceneAdapter;
dispose(): void;
```

- [ ] **Step 3: Add an internal managed scene adapter factory**

In `packages/dom-webgl-runtime/src/lib/renderer/threeRenderer.ts`, export an internal helper:

```ts
export type ManagedThreeSceneAdapterEntry = {
  readonly scene: object;
  readonly camera: object;
  readonly sceneAdapter: WebGLSceneAdapter;
  dispose(): void;
};

export function createManagedDomAlignedSceneAdapter(
  renderer: ThreeRendererAdapter,
): ManagedThreeSceneAdapterEntry {
  const scene = new Scene();
  configureDefaultSceneLighting(scene);
  const camera = new OrthographicCamera(0, 800, 600, 0, 0.1, 1000);
  const sceneAdapter = createThreeSceneAdapter(scene, camera, renderer);

  return {
    scene,
    camera,
    sceneAdapter,
    dispose() {
      clearSceneObjects(scene);
    },
  };
}

function clearSceneObjects(scene: object): void {
  const children = (scene as { children?: unknown }).children;
  const remove = readSceneMethod(scene, "remove");

  if (!Array.isArray(children) || !remove) {
    return;
  }

  for (const child of [...children]) {
    remove(child);
  }
}
```

Keep this helper internal by exporting only from the source file, not from package entrypoints.

- [ ] **Step 4: Implement registry maps and pass resolution**

Use normalized declaration helpers in `renderLayerRegistry.ts`:

```ts
const scenesById = new Map<string, InternalRenderSceneEntry>([["main", mainScene]]);
const camerasById = new Map<string, InternalRenderCameraEntry>([["main", mainCamera]]);
const passesById = new Map<string, InternalRenderPassEntry>([["main", mainPass]]);
```

Implement `renderPasses` with sorted passes:

```ts
renderPasses(renderPass) {
  const orderedPasses = Array.from(passesById.values()).sort(
    (left, right) => left.order - right.order,
  );

  for (const pass of orderedPasses) {
    const scene = scenesById.get(pass.sceneId);
    const camera = camerasById.get(pass.cameraId);

    if (!scene) {
      throw new Error(
        `WebGL render pass "${pass.id}" references unknown scene "${pass.sceneId}".`,
      );
    }
    if (!camera) {
      throw new Error(
        `WebGL render pass "${pass.id}" references unknown camera "${pass.cameraId}".`,
      );
    }

    renderPass(pass, scene, camera);
  }
}
```

- [ ] **Step 5: Run registry tests**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/renderer/renderLayerRegistry.test.ts
```

Expected: PASS.

## Task 5: Add Runtime Registration Methods And Target Scene Routing

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderableFactory.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`
- Modify: `packages/dom-webgl-runtime/test/lib/renderer/runtimePipeline.test.ts`

- [ ] **Step 1: Add failing runtime pipeline tests**

Add tests to `runtimePipeline.test.ts` near the existing render layer pass test:

```ts
test("routes targets with sceneId to the managed scene adapter", async () => {
  const mainAdapter = createObjectRecordingSceneAdapter();
  const worldAdapter = createObjectRecordingSceneAdapter();
  const { registry } = createRenderLayerRegistryStub(mainAdapter, {
    scenes: {
      world: worldAdapter,
    },
  });
  const runtime = await createPipelineRuntime({
    rendererHostFactory(container) {
      return createRendererHostStub(container, mainAdapter);
    },
    renderLayerRegistryFactory() {
      return registry;
    },
  });
  const mainElement = document.createElement("section");
  const worldElement = document.createElement("section");

  runtime.registerTarget(mainElement, {
    key: "main.target",
    source: { kind: "dom", type: "element" },
  });
  runtime.registerTarget(worldElement, {
    key: "world.target",
    sceneId: "world",
    source: { kind: "dom", type: "element" },
  });

  await runtime.sync();

  expect(mainAdapter.objects.map((object) => object.key)).toEqual(["main.target"]);
  expect(worldAdapter.objects.map((object) => object.key)).toEqual(["world.target"]);
  runtime.dispose();
});

test("runtime registers managed scene camera and pass declarations", async () => {
  const sceneAdapter = createRecordingSceneAdapter();
  const { registry, registerScene, registerCamera, registerRenderPass } =
    createRenderLayerRegistryStub(sceneAdapter);
  const runtime = await createPipelineRuntime({
    rendererHostFactory(container) {
      return createRendererHostStub(container, sceneAdapter);
    },
    renderLayerRegistryFactory() {
      return registry;
    },
  });

  runtime.registerScene({ id: "world", defaultPass: true });
  runtime.registerCamera({ id: "world.camera", sceneId: "world", default: true });
  runtime.registerRenderPass({
    id: "world.pass",
    sceneId: "world",
    cameraId: "world.camera",
  });
  runtime.unregisterRenderPass("world.pass");
  runtime.unregisterCamera("world.camera");
  runtime.unregisterScene("world");

  expect(registerScene).toHaveBeenCalledWith({ id: "world", defaultPass: true });
  expect(registerCamera).toHaveBeenCalledWith({
    id: "world.camera",
    sceneId: "world",
    default: true,
  });
  expect(registerRenderPass).toHaveBeenCalledWith({
    id: "world.pass",
    sceneId: "world",
    cameraId: "world.camera",
  });
  runtime.dispose();
});
```

Update `createRenderLayerRegistryStub` to accept optional scene adapters and record methods.

- [ ] **Step 2: Make renderable factory adapter lookup descriptor-driven**

In `RenderableFactoryContext`, replace:

```ts
sceneAdapter: WebGLSceneAdapter;
```

with:

```ts
getSceneAdapter?(descriptor: TargetDescriptor): WebGLSceneAdapter;
sceneAdapter: WebGLSceneAdapter;
```

At the top of `createRenderable`, compute:

```ts
const sceneAdapter =
  context.getSceneAdapter?.(targetDescriptor) ?? context.sceneAdapter;
```

Then replace each `sceneAdapter: context.sceneAdapter` option with `sceneAdapter`.

- [ ] **Step 3: Wire runtime methods to render layer registry**

In `createWebGLRuntime()` return object, add:

```ts
registerScene(declaration) {
  if (disposed) {
    throw new Error("Cannot register a WebGL scene after runtime disposal.");
  }

  renderLayers.registerScene(declaration);
  rendererLoopRequestFrame("target-register");
  emitDebugState(true);
},
unregisterScene(id) {
  renderLayers.unregisterScene(id);
  rendererLoopRequestFrame("target-unregister");
  emitDebugState(true);
},
registerCamera(declaration) {
  if (disposed) {
    throw new Error("Cannot register a WebGL camera after runtime disposal.");
  }

  renderLayers.registerCamera(declaration);
  rendererLoopRequestFrame("target-register");
  emitDebugState(true);
},
unregisterCamera(id) {
  renderLayers.unregisterCamera(id);
  rendererLoopRequestFrame("target-unregister");
  emitDebugState(true);
},
registerRenderPass(declaration) {
  if (disposed) {
    throw new Error("Cannot register a WebGL render pass after runtime disposal.");
  }

  renderLayers.registerRenderPass(declaration);
  rendererLoopRequestFrame("target-register");
  emitDebugState(true);
},
unregisterRenderPass(id) {
  renderLayers.unregisterRenderPass(id);
  rendererLoopRequestFrame("target-unregister");
  emitDebugState(true);
},
```

In runtime disposal, call `renderLayers.dispose()` before `rendererHost.dispose()`.

- [ ] **Step 4: Route renderable creation**

In `renderableFactoryContext`, add:

```ts
getSceneAdapter(descriptor) {
  return renderLayers.getSceneAdapterForTarget(descriptor.declaration.sceneId);
},
```

- [ ] **Step 5: Run runtime pipeline tests**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/renderer/runtimePipeline.test.ts
```

Expected: PASS.

## Task 6: Add React Scene, Camera, And RenderPass Components

**Files:**
- Create: `packages/dom-webgl-runtime/src/lib/react/sceneContext.tsx`
- Create: `packages/dom-webgl-runtime/src/lib/react/WebGLScene.tsx`
- Create: `packages/dom-webgl-runtime/src/lib/react/WebGLCamera.tsx`
- Create: `packages/dom-webgl-runtime/src/lib/react/WebGLRenderPass.tsx`
- Modify: `packages/dom-webgl-runtime/src/lib/react/WebGLRuntime.tsx`
- Modify: `packages/dom-webgl-runtime/src/lib/react/WebGLTarget.tsx`
- Modify: `packages/dom-webgl-runtime/src/react.ts`
- Create: `packages/dom-webgl-runtime/test/lib/react/WebGLScene.test.tsx`
- Create: `packages/dom-webgl-runtime/test/lib/react/WebGLCamera.test.tsx`
- Create: `packages/dom-webgl-runtime/test/lib/react/WebGLRenderPass.test.tsx`
- Modify: `packages/dom-webgl-runtime/test/lib/react/WebGLTarget.test.tsx`

- [ ] **Step 1: Add scene context**

Create `sceneContext.tsx`:

```tsx
import { createContext, type ReactNode } from "react";

export const WebGLSceneContext = createContext<string | undefined>(undefined);

export type WebGLSceneProviderProps = {
  sceneId: string;
  children?: ReactNode;
};

export function WebGLSceneProvider({
  sceneId,
  children,
}: WebGLSceneProviderProps) {
  return (
    <WebGLSceneContext.Provider value={sceneId}>
      {children}
    </WebGLSceneContext.Provider>
  );
}
```

- [ ] **Step 2: Implement `WebGLScene`**

Create `WebGLScene.tsx`:

```tsx
import { createElement, useEffect, type ReactNode } from "react";

import type { WebGLSceneDeclaration } from "../types";

import { WebGLSceneProvider } from "./sceneContext";
import { useWebGLRuntime } from "./useWebGLRuntime";

export type WebGLSceneProps = WebGLSceneDeclaration & {
  children?: ReactNode;
};

export function WebGLScene({
  id,
  projection,
  defaultCameraId,
  defaultPass,
  children,
}: WebGLSceneProps) {
  const runtime = useWebGLRuntime();

  useEffect(() => {
    runtime.registerScene({
      id,
      projection,
      defaultCameraId,
      defaultPass,
    });

    return () => {
      runtime.unregisterScene(id);
    };
  }, [runtime, id, projection, defaultCameraId, defaultPass]);

  return createElement(WebGLSceneProvider, { sceneId: id }, children);
}
```

- [ ] **Step 3: Implement `WebGLCamera`**

Create `WebGLCamera.tsx`:

```tsx
import { useContext, useEffect } from "react";

import type { WebGLCameraDeclaration } from "../types";

import { WebGLSceneContext } from "./sceneContext";
import { useWebGLRuntime } from "./useWebGLRuntime";

export type WebGLCameraProps = Omit<WebGLCameraDeclaration, "sceneId"> & {
  scene?: string;
};

export function WebGLCamera({
  id,
  scene,
  type,
  mode,
  default: isDefault,
}: WebGLCameraProps) {
  const runtime = useWebGLRuntime();
  const inheritedSceneId = useContext(WebGLSceneContext);
  const sceneId = scene ?? inheritedSceneId;

  useEffect(() => {
    if (!sceneId) {
      throw new Error(
        `WebGL camera "${id}" requires a scene prop or a parent WebGLScene.`,
      );
    }

    runtime.registerCamera({
      id,
      sceneId,
      type,
      mode,
      default: isDefault,
    });

    return () => {
      runtime.unregisterCamera(id);
    };
  }, [runtime, id, sceneId, type, mode, isDefault]);

  return null;
}
```

- [ ] **Step 4: Implement `WebGLRenderPass`**

Create `WebGLRenderPass.tsx`:

```tsx
import { useContext, useEffect } from "react";

import type { WebGLRenderPassDeclaration } from "../types";

import { WebGLSceneContext } from "./sceneContext";
import { useWebGLRuntime } from "./useWebGLRuntime";

export type WebGLRenderPassProps = {
  id?: string;
  scene?: string;
  camera?: string;
  order?: number;
};

export function WebGLRenderPass({
  id,
  scene,
  camera,
  order,
}: WebGLRenderPassProps) {
  const runtime = useWebGLRuntime();
  const inheritedSceneId = useContext(WebGLSceneContext);
  const sceneId = scene ?? inheritedSceneId;

  useEffect(() => {
    if (!sceneId) {
      throw new Error("WebGL render pass requires a scene prop or a parent WebGLScene.");
    }

    const declaration: WebGLRenderPassDeclaration = {
      id,
      sceneId,
      cameraId: camera,
      order,
    };

    runtime.registerRenderPass(declaration);

    return () => {
      runtime.unregisterRenderPass(id ?? `${sceneId}:${camera ?? "default"}:pass`);
    };
  }, [runtime, id, sceneId, camera, order]);

  return null;
}
```

- [ ] **Step 5: Update pending runtime no-op methods**

In `createPendingRuntime()` in `WebGLRuntime.tsx`, add no-op methods:

```ts
registerScene() {},
unregisterScene() {},
registerCamera() {},
unregisterCamera() {},
registerRenderPass() {},
unregisterRenderPass() {},
```

- [ ] **Step 6: Make `WebGLTarget` inherit nearest scene**

In `WebGLTarget.tsx`, import context and memoize the effective declaration:

```tsx
import { useContext, useMemo, ... } from "react";
import { WebGLSceneContext } from "./sceneContext";
```

Inside the component:

```tsx
const inheritedSceneId = useContext(WebGLSceneContext);
const effectiveWebgl = useMemo(
  () =>
    inheritedSceneId && webgl.sceneId === undefined
      ? { ...webgl, sceneId: inheritedSceneId }
      : webgl,
  [inheritedSceneId, webgl],
);
const webglRef = useRef(effectiveWebgl);
webglRef.current = effectiveWebgl;
```

Use `effectiveWebgl.key` in fallback marking, registration, and unregister dependencies.

- [ ] **Step 7: Export React components**

In `packages/dom-webgl-runtime/src/react.ts`, add:

```ts
export { WebGLScene, type WebGLSceneProps } from "./lib/react/WebGLScene";
export { WebGLCamera, type WebGLCameraProps } from "./lib/react/WebGLCamera";
export {
  WebGLRenderPass,
  type WebGLRenderPassProps,
} from "./lib/react/WebGLRenderPass";
```

- [ ] **Step 8: Add React component tests**

`WebGLScene.test.tsx` should assert:

```ts
expect(runtime.registerScene).toHaveBeenCalledWith({
  id: "world",
  projection: undefined,
  defaultCameraId: undefined,
  defaultPass: true,
});
expect(runtime.unregisterScene).toHaveBeenCalledWith("world");
```

`WebGLCamera.test.tsx` should assert inherited scene:

```ts
expect(runtime.registerCamera).toHaveBeenCalledWith({
  id: "world.camera",
  sceneId: "world",
  type: undefined,
  mode: undefined,
  default: true,
});
```

`WebGLRenderPass.test.tsx` should assert explicit scene/camera:

```ts
expect(runtime.registerRenderPass).toHaveBeenCalledWith({
  id: "overlay.pass",
  sceneId: "overlay",
  cameraId: "overlay.camera",
  order: 1,
});
```

`WebGLTarget.test.tsx` should add:

```ts
test("inherits the nearest WebGLScene id when no explicit sceneId is provided", async () => {
  const { WebGLRuntimeProvider, WebGLScene, WebGLTarget } = await import("../../../src/react");
  const runtime = createRuntimeStub();
  const { root, host } = createTestRoot();

  await act(async () => {
    root.render(
      createElement(
        WebGLRuntimeProvider,
        { runtime },
        createElement(
          WebGLScene,
          { id: "world" },
          createElement(WebGLTarget, {
            id: "world-target",
            webgl: { key: "world.target" },
          }),
        ),
      ),
    );
  });

  expect(runtime.registerTarget).toHaveBeenCalledWith(
    host.querySelector("#world-target"),
    { key: "world.target", sceneId: "world" },
  );
});
```

- [ ] **Step 9: Run React tests**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/react/WebGLRuntime.test.tsx packages/dom-webgl-runtime/test/lib/react/WebGLTarget.test.tsx packages/dom-webgl-runtime/test/lib/react/WebGLScene.test.tsx packages/dom-webgl-runtime/test/lib/react/WebGLCamera.test.tsx packages/dom-webgl-runtime/test/lib/react/WebGLRenderPass.test.tsx packages/dom-webgl-runtime/test/publicExports.test.ts
```

Expected: PASS.

## Task 7: Add Compatibility And Boundary Coverage

**Files:**
- Modify: `packages/dom-webgl-runtime/test/lib/renderer/runtimePipeline.test.ts`
- Modify: `packages/dom-webgl-runtime/test/publicExports.test.ts`
- Modify: `apps/example/test` only if existing app tests need public import assertions

- [ ] **Step 1: Prove Level 1 examples remain unchanged**

Add a focused runtime pipeline assertion:

```ts
test("targets without scene declarations still render through generated main", async () => {
  const sceneAdapter = createObjectRecordingSceneAdapter();
  const runtime = await createPipelineRuntime({
    rendererHostFactory(container) {
      return createRendererHostStub(container, sceneAdapter);
    },
  });
  const element = document.createElement("section");

  runtime.registerTarget(element, {
    key: "level1.surface",
    source: { kind: "dom", type: "element" },
  });

  await runtime.sync();

  expect(sceneAdapter.objects.map((object) => object.key)).toEqual([
    "level1.surface",
  ]);
  runtime.dispose();
});
```

- [ ] **Step 2: Prove explicit `sceneId` is vanilla parity**

Add a runtime pipeline assertion:

```ts
test("vanilla target sceneId uses the same routing as React inheritance", async () => {
  const mainAdapter = createObjectRecordingSceneAdapter();
  const overlayAdapter = createObjectRecordingSceneAdapter();
  const { registry } = createRenderLayerRegistryStub(mainAdapter, {
    scenes: { overlay: overlayAdapter },
  });
  const runtime = await createPipelineRuntime({
    rendererHostFactory(container) {
      return createRendererHostStub(container, mainAdapter);
    },
    renderLayerRegistryFactory() {
      return registry;
    },
  });

  runtime.registerTarget(document.createElement("section"), {
    key: "overlay.title",
    sceneId: "overlay",
    source: { kind: "dom", type: "text" },
  });

  await runtime.sync();

  expect(overlayAdapter.objects.map((object) => object.key)).toEqual([
    "overlay.title",
  ]);
  runtime.dispose();
});
```

- [ ] **Step 3: Keep raw internals out of public exports**

Keep or add negative assertions that these are not exported from root or React entrypoints:

```ts
// @ts-expect-error Internal render layer registry is still private.
import type { InternalRenderLayerRegistry } from "${importPath}";
// @ts-expect-error Internal render scenes are not public declarations.
import type { InternalRenderSceneEntry } from "${importPath}";
// @ts-expect-error Internal render cameras are not public declarations.
import type { InternalRenderCameraEntry } from "${importPath}";
// @ts-expect-error Internal render passes are not public declarations.
import type { InternalRenderPassEntry } from "${importPath}";
// @ts-expect-error Scene adapters are internal renderer state.
import type { WebGLSceneAdapter } from "${importPath}";
```

- [ ] **Step 4: Run boundary tests**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/publicExports.test.ts packages/dom-webgl-runtime/test/open-source-boundary.test.ts
```

Expected: PASS.

## Task 8: Update Debug Records Without Exposing Internals

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/types.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/debug/debugState.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`
- Modify: `packages/dom-webgl-runtime/test/lib/debug/debugState.test.ts`
- Modify: `packages/dom-webgl-runtime/test/lib/renderer/runtimePipeline.test.ts`

- [ ] **Step 1: Add managed id fields**

Add optional debug id fields:

```ts
sceneId?: string;
cameraId?: string;
renderPassIds?: string[];
```

Use `sceneId` on target records. Keep `cameraId` and `renderPassIds` at runtime-level only if a later test needs them; otherwise defer them to avoid widening debug state without a consumer.

- [ ] **Step 2: Copy scene id into debug target summaries**

In `DebugTargetState`:

```ts
sceneId?: string;
```

In `createDebugState`, add:

```ts
if (target.sceneId) {
  summary.sceneId = target.sceneId;
}
```

In runtime debug map:

```ts
sceneId: descriptor.declaration.sceneId ?? "main",
```

- [ ] **Step 3: Add debug tests**

Add to `debugState.test.ts`:

```ts
test("includes managed scene ids without exposing scene objects", () => {
  const state = createDebugState({
    targetCount: 1,
    renderableCount: 1,
    currentScrollMode: "page",
    pointer: createInitialPointerState(),
    targets: [
      {
        key: "world.target",
        sceneId: "world",
        sourceKind: "dom/element",
        renderRole: "surface",
        resourceStatus: "ready",
        lifecycleState: "active",
        visible: true,
      },
    ],
  });

  expect(state.targets[0]).toMatchObject({
    key: "world.target",
    sceneId: "world",
  });
  expect(state.targets[0]).not.toHaveProperty("scene");
  expect(state.targets[0]).not.toHaveProperty("camera");
});
```

- [ ] **Step 4: Run debug tests**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/debug/debugState.test.ts packages/dom-webgl-runtime/test/lib/renderer/runtimePipeline.test.ts
```

Expected: PASS.

## Task 9: Update Package Docs After Implementation

**Files:**
- Modify: `README.md`
- Modify: `docs/STATUS.md`
- Modify: `docs/roadmap/managed-render-system.md`
- Modify: `docs/agent/package-onboarding.md`
- Modify: `docs/agent/package-usage.md`

- [ ] **Step 1: Update active status**

In `docs/STATUS.md`, after implementation verification:

- Add managed scene/camera/pass declarations to `Implemented Public Surface`.
- Add caveat that Phase 2 supports only `dom-aligned` / orthographic managed camera declarations.
- Keep Level 1 `WebGLTarget` listed as the shortest path.
- Keep raw renderer/scene/camera internals listed as private.

- [ ] **Step 2: Update roadmap**

In `docs/roadmap/managed-render-system.md`, after implementation verification:

- Change Phase 2 table status from `[planned]` to `[verified]` only after tests, docs, and commit are closed.
- Change Phase 2 section status to `[verified]`.
- Add completion notes:
  - public React declarations exist;
  - target scene inheritance works;
  - vanilla runtime descriptor parity exists;
  - Level 1 remains unchanged;
  - projection policies remain Phase 3.

- [ ] **Step 3: Update package onboarding and usage docs**

Add a Level 2 section after the Level 1 examples:

```tsx
<WebGLRuntime effects={runtimeEffects}>
  <WebGLScene id="world" defaultPass>
    <WebGLCamera id="world.camera" default />
    <WebGLTarget
      webgl={{
        key: "world.model",
        source: { kind: "model", type: "glb", src: "/models/hero.glb" },
      }}
    >
      <div aria-label="World model fallback" />
    </WebGLTarget>
  </WebGLScene>
</WebGLRuntime>
```

State these rules:

- Use `WebGLTarget` alone for normal DOM-first effects.
- Use `WebGLScene` only when a target needs explicit managed scene/pass ownership.
- `WebGLTarget` inside `WebGLScene` inherits that scene unless `webgl.sceneId` is explicit.
- Phase 2 supports dom-aligned scene separation; projection/stage-local APIs remain later phases.
- No raw Three.js scene/camera/renderer handles are public.

- [ ] **Step 4: Update README succinctly**

Add one opt-in Level 2 snippet after the existing Level 1 snippet. Keep README focused on default usage first.

## Task 10: Verification

**Files:**
- No source edits beyond prior tasks.

- [ ] **Step 1: Run focused tests**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/renderer/renderLayerDeclarations.test.ts packages/dom-webgl-runtime/test/lib/renderer/renderLayerRegistry.test.ts packages/dom-webgl-runtime/test/lib/renderer/runtimePipeline.test.ts packages/dom-webgl-runtime/test/lib/react/WebGLRuntime.test.tsx packages/dom-webgl-runtime/test/lib/react/WebGLTarget.test.tsx packages/dom-webgl-runtime/test/lib/react/WebGLScene.test.tsx packages/dom-webgl-runtime/test/lib/react/WebGLCamera.test.tsx packages/dom-webgl-runtime/test/lib/react/WebGLRenderPass.test.tsx packages/dom-webgl-runtime/test/publicExports.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run package checks**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/renderer/renderLayerDeclarations.test.ts packages/dom-webgl-runtime/test/lib/renderer/renderLayerRegistry.test.ts packages/dom-webgl-runtime/test/lib/renderer/runtimePipeline.test.ts packages/dom-webgl-runtime/test/lib/react/WebGLRuntime.test.tsx packages/dom-webgl-runtime/test/lib/react/WebGLTarget.test.tsx packages/dom-webgl-runtime/test/lib/react/WebGLScene.test.tsx packages/dom-webgl-runtime/test/lib/react/WebGLCamera.test.tsx packages/dom-webgl-runtime/test/lib/react/WebGLRenderPass.test.tsx packages/dom-webgl-runtime/test/publicExports.test.ts
npm run typecheck
npm run check:imports
git diff --check
```

Expected: all commands PASS.

- [ ] **Step 3: Run full verification only when implementation is ready for closeout**

Run:

```bash
npm run test -- --run && npm run typecheck && npm run build && npm run check:imports && git diff --check
```

Expected: all commands PASS. Existing Vite chunk-size warnings are non-blocking if unchanged.

## Exit Criteria

- Current Level 1 examples and tests work unchanged.
- `WebGLScene`, `WebGLCamera`, and `WebGLRenderPass` are exported from `@project/dom-webgl-runtime/react`.
- Root public types expose descriptor declarations but not internal registry/adapter/Three objects.
- `WebGLTarget` inside `WebGLScene` inherits scene ownership; targets outside scenes use the internal generated default scene.
- Vanilla users can register equivalent scene/camera/pass descriptors and explicit `sceneId` target routing.
- Duplicate scene/camera/pass ids and unresolved pass references produce deterministic errors.
- Render pass order is deterministic and keeps the generated default pass first by default.
- Debug output may expose managed ids, but never raw scene/camera/pass objects.
- Docs clearly distinguish Level 1 default usage from Level 2 opt-in declarations.
- Roadmap Phase 2 is not marked `[verified]` until tests, docs, and commit are closed.

## Risks

- React effect registration order can create transient missing references. Avoid relying on component mount order by making registry registration idempotent and resolving pass references during render after all declarations are mounted.
- Adding runtime methods widens the public `WebGLRuntime` type and requires updating every runtime stub in tests.
- If Phase 2 accepts `perspective` now, it will create a hollow API because Phase 3 owns projection policy. Keep Phase 2 orthographic/dom-aligned unless the user explicitly approves earlier perspective work.
- Additional scenes need internal disposal; otherwise unregistering a scene can leave objects attached.
- `ctx.object.postprocess` remains runtime-canvas scoped, so docs must not imply pass-scoped postprocess exists after Phase 2.
- The initial plan reserved `main`; the follow-up decision changed the generated id to `__dom-webgl-default__`, so consumer-managed `main` scene/camera/pass ids are allowed.

## Questions For Confirmation

- Should Phase 2 intentionally support only `projection: "dom-aligned"` and `type: "orthographic"`, leaving `perspective-stage` and `type: "perspective"` to Phase 3?
- Resolved after implementation: user-declared id `"main"` is allowed; it does not augment or replace the internal generated default scene.
- Should debug state include only target-level `sceneId` in Phase 2, or also runtime-level scene/camera/pass summaries?

## Self-Review

- Spec coverage: Phase 2 roadmap requirements are covered by public declarations, target scene inheritance, duplicate diagnostics, vanilla parity, and raw Three boundary tests.
- Scope guard: projection policies, stage primitives, scoped effects, postprocess correction, picking, model animation, and physics are explicitly deferred.
- Placeholder scan: this plan avoids unspecified tasks and names exact files, public types, commands, and expected outcomes.
- Type consistency: public runtime descriptors use `sceneId`/`cameraId`; React props use `scene`/`camera` for ergonomics and normalize to runtime descriptors.
