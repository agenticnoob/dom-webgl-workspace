# Internal Render Layer Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the current Level 1 runtime compile internally to one managed `main` scene, one managed `main` camera, and one generated `main` render pass without changing public API or consumer behavior.

**Architecture:** Add an internal render-layer registry that wraps the existing `ThreeRendererHost` scene, camera, and scene adapter as generated `main` entries. Runtime rendering should execute the generated pass list and still route the single pass through the existing canvas-scoped postprocess controller. `WebGLTarget` registration, layout, fallback, scroll, pointer, effects, transform groups, and resource ownership remain unchanged.

**Tech Stack:** TypeScript, Vitest, jsdom, existing Three.js source imports, existing DOM-first runtime factories.

---

## Current Truth

- `createWebGLRuntime()` currently creates one `rendererHost`, one `postprocessController`, and renders through `postprocessController.render(() => rendererHost.sceneAdapter.render())`.
- `createThreeRendererHost()` currently returns `renderer`, `scene`, `camera`, and a single `sceneAdapter`.
- `createThreeSceneAdapter()` attaches objects and transform groups to one internal Three scene and renders it with one internal camera.
- Public `WebGLRuntimeOptions`, `WebGLDeclaration`, React exports, and `WebGLDebugState` do not expose scene, camera, pass, or raw Three.js handles.
- Existing public export tests already reject internal scene object types and raw Three.js scene/camera types.

## Scope

- Introduce internal scene/camera/pass records for the generated Level 1 main render path.
- Keep the public package API unchanged.
- Keep `WebGLTarget` behavior unchanged: DOM layout, fallback visibility, target pointer, scroll, effects, offscreen lifecycle, resource loading, and transform groups keep their current semantics.
- Keep postprocess behavior unchanged and canvas-scoped for now.
- Add focused tests proving the generated main pass exists internally and current render/postprocess order is preserved.

## Non-Goals

- Do not add public `WebGLScene`, `WebGLCamera`, or `WebGLRenderPass` declarations.
- Do not add React context scene inheritance.
- Do not support additional scenes, additional cameras, pass sorting from user declarations, overlay passes, viewport/scissor passes, or pass-scoped postprocess.
- Do not expose raw `THREE.Scene`, `THREE.Camera`, `Object3D`, material, texture, renderer, render target, composer, pass, or render-loop handles.
- Do not change `WebGLDebugState` in this phase unless an implementation test proves a private inspection hook is insufficient.

## File Structure

- Create `packages/dom-webgl-runtime/src/lib/renderer/renderLayerRegistry.ts`
  - Owns internal generated scene/camera/pass records.
  - Provides the default scene adapter for existing renderable creation.
  - Provides generated pass execution data for runtime rendering.
- Create `packages/dom-webgl-runtime/test/lib/renderer/renderLayerRegistry.test.ts`
  - Unit tests for generated `main` entries and id lookups.
- Modify `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`
  - Instantiate the internal registry after `rendererHost`.
  - Pass `renderLayers.getMainSceneAdapter()` into renderable factory context.
  - Create the current postprocess controller from the generated main scene and camera.
  - Render through generated passes instead of directly calling `rendererHost.sceneAdapter.render()`.
- Modify `packages/dom-webgl-runtime/test/lib/renderer/runtime.test.ts`
  - Keep existing scene render assertions passing.
  - Add or adjust a focused assertion that runtime sync still renders exactly once per sync through the generated main pass.
- Modify `packages/dom-webgl-runtime/test/lib/renderer/runtimePipeline.test.ts`
  - Preserve current postprocess order test around generated main pass execution.
- Modify `packages/dom-webgl-runtime/test/publicExports.test.ts`
  - Add negative type assertions that Phase 1 internals and future public names are not exported yet.
- Modify `docs/STATUS.md` and `docs/roadmap/managed-render-system.md`
  - Update Phase 1 state and implementation truth after execution.

## Task 1: Add Failing Unit Tests For The Internal Render Layer Registry

**Files:**
- Create: `packages/dom-webgl-runtime/test/lib/renderer/renderLayerRegistry.test.ts`
- Modify: none

- [ ] **Step 1: Write the missing-module test**

```ts
import { describe, expect, test, vi } from "vitest";

import { createInternalRenderLayerRegistry } from "../../../src/lib/renderer/renderLayerRegistry";
import type { ThreeRendererHost } from "../../../src/lib/renderer/threeRenderer";
import type { WebGLSceneAdapter } from "../../../src/lib/renderer/sceneObject";

describe("createInternalRenderLayerRegistry", () => {
  test("creates generated main scene camera and pass from the renderer host", () => {
    const sceneAdapter = createSceneAdapter();
    const host = createRendererHostStub(sceneAdapter);

    const registry = createInternalRenderLayerRegistry(host);

    expect(registry.getScene("main")).toMatchObject({
      id: "main",
      generated: true,
      projection: "dom-aligned",
      scene: host.scene,
      sceneAdapter,
    });
    expect(registry.getCamera("main")).toMatchObject({
      id: "main",
      generated: true,
      type: "orthographic",
      mode: "dom-aligned",
      camera: host.camera,
    });
    expect(registry.getPasses()).toEqual([
      {
        id: "main",
        generated: true,
        sceneId: "main",
        cameraId: "main",
        order: 0,
      },
    ]);
    expect(registry.getMainSceneAdapter()).toBe(sceneAdapter);
  });

  test("executes generated passes against resolved scene adapters", () => {
    const sceneAdapter = createSceneAdapter();
    const registry = createInternalRenderLayerRegistry(
      createRendererHostStub(sceneAdapter),
    );
    const renderPass = vi.fn((pass, scene, camera) => {
      expect(pass.id).toBe("main");
      expect(scene.id).toBe("main");
      expect(camera.id).toBe("main");
      scene.sceneAdapter.render();
    });

    registry.renderPasses(renderPass);

    expect(renderPass).toHaveBeenCalledTimes(1);
    expect(sceneAdapter.render).toHaveBeenCalledTimes(1);
  });
});

function createSceneAdapter(): WebGLSceneAdapter & {
  render: ReturnType<typeof vi.fn>;
} {
  return {
    addObject() {
      return;
    },
    removeObject() {
      return;
    },
    render: vi.fn(),
  };
}

function createRendererHostStub(sceneAdapter: WebGLSceneAdapter): ThreeRendererHost {
  const canvas = document.createElement("canvas");

  return {
    canvas,
    renderer: {
      canvas,
      render() {
        return;
      },
      dispose() {
        return;
      },
    },
    scene: { label: "main-scene" },
    camera: { label: "main-camera" },
    sceneAdapter,
    getViewportSize() {
      return { width: 800, height: 600 };
    },
    readRendererStats() {
      return {
        drawCalls: 0,
        triangles: 0,
        geometries: 0,
        textures: 0,
      };
    },
    resizeIfNeeded() {
      return;
    },
    dispose() {
      return;
    },
  };
}
```

- [ ] **Step 2: Run the focused test and confirm it fails because the module does not exist**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/renderer/renderLayerRegistry.test.ts
```

Expected: `FAIL` with a module resolution error for `renderLayerRegistry`.

## Task 2: Implement The Internal Registry With Only Generated Main Entries

**Files:**
- Create: `packages/dom-webgl-runtime/src/lib/renderer/renderLayerRegistry.ts`
- Test: `packages/dom-webgl-runtime/test/lib/renderer/renderLayerRegistry.test.ts`

- [ ] **Step 1: Add the internal module**

```ts
import type { WebGLSceneAdapter } from "./sceneObject";
import type { ThreeRendererHost } from "./threeRenderer";

export type InternalRenderSceneEntry = {
  readonly id: "main";
  readonly generated: true;
  readonly projection: "dom-aligned";
  readonly scene: object;
  readonly sceneAdapter: WebGLSceneAdapter;
};

export type InternalRenderCameraEntry = {
  readonly id: "main";
  readonly generated: true;
  readonly type: "orthographic";
  readonly mode: "dom-aligned";
  readonly camera: object;
};

export type InternalRenderPassEntry = {
  readonly id: "main";
  readonly generated: true;
  readonly sceneId: "main";
  readonly cameraId: "main";
  readonly order: 0;
};

export type InternalRenderLayerRegistry = {
  getScene(id: string): InternalRenderSceneEntry;
  getCamera(id: string): InternalRenderCameraEntry;
  getPasses(): readonly InternalRenderPassEntry[];
  getMainSceneAdapter(): WebGLSceneAdapter;
  renderPasses(
    renderPass: (
      pass: InternalRenderPassEntry,
      scene: InternalRenderSceneEntry,
      camera: InternalRenderCameraEntry,
    ) => void,
  ): void;
};

export function createInternalRenderLayerRegistry(
  rendererHost: Pick<ThreeRendererHost, "scene" | "camera" | "sceneAdapter">,
): InternalRenderLayerRegistry {
  const mainScene = {
    id: "main",
    generated: true,
    projection: "dom-aligned",
    scene: rendererHost.scene,
    sceneAdapter: rendererHost.sceneAdapter,
  } satisfies InternalRenderSceneEntry;
  const mainCamera = {
    id: "main",
    generated: true,
    type: "orthographic",
    mode: "dom-aligned",
    camera: rendererHost.camera,
  } satisfies InternalRenderCameraEntry;
  const mainPass = {
    id: "main",
    generated: true,
    sceneId: "main",
    cameraId: "main",
    order: 0,
  } satisfies InternalRenderPassEntry;
  const passes = [mainPass] as const;

  return {
    getScene(id) {
      assertMainId(id, "scene");
      return mainScene;
    },
    getCamera(id) {
      assertMainId(id, "camera");
      return mainCamera;
    },
    getPasses() {
      return passes;
    },
    getMainSceneAdapter() {
      return mainScene.sceneAdapter;
    },
    renderPasses(renderPass) {
      for (const pass of passes) {
        renderPass(pass, mainScene, mainCamera);
      }
    },
  };
}

function assertMainId(id: string, kind: "scene" | "camera"): void {
  if (id !== "main") {
    throw new Error(`Unknown generated ${kind} "${String(id)}".`);
  }
}
```

- [ ] **Step 2: Run registry tests**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/renderer/renderLayerRegistry.test.ts
```

Expected: `PASS`.

## Task 3: Route Runtime Rendering Through The Generated Pass List

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`
- Modify: `packages/dom-webgl-runtime/test/lib/renderer/runtime.test.ts`
- Modify: `packages/dom-webgl-runtime/test/lib/renderer/runtimePipeline.test.ts`

- [ ] **Step 1: Wire the registry into runtime initialization**

Add the import:

```ts
import { createInternalRenderLayerRegistry } from "./renderLayerRegistry";
```

After `rendererHost` is created, create the registry:

```ts
const rendererHost = rendererHostFactory(options.container);
const renderLayers = createInternalRenderLayerRegistry(rendererHost);
```

Use the generated main scene/camera for the existing postprocess controller:

```ts
const mainScene = renderLayers.getScene("main");
const mainCamera = renderLayers.getCamera("main");
const postprocessController =
  internalOptions.postprocessController ??
  createPostprocessController({
    renderer: rendererHost.renderer,
    scene: mainScene.scene,
    camera: mainCamera.camera,
    getViewportSize: () => rendererHost.getViewportSize(),
  });
```

Use the generated main scene adapter in the renderable factory context:

```ts
sceneAdapter: renderLayers.getMainSceneAdapter(),
```

- [ ] **Step 2: Replace direct scene rendering with generated pass execution**

Replace `renderScene()` with this shape:

```ts
function renderScene(): void {
  if (disposed) {
    return;
  }

  renderLayers.renderPasses((_pass, scene) => {
    postprocessController.render(() => {
      scene.sceneAdapter.render();
    });
  });
}
```

This keeps current behavior because the only pass is generated `main` and uses the current single postprocess controller.

- [ ] **Step 3: Keep transform-group calls attached to the main scene adapter**

Do not rewrite transform group logic in this phase. If `runtime.ts` still calls `rendererHost.sceneAdapter` directly for transform groups, replace only those references with the same generated main scene adapter:

```ts
const mainSceneAdapter = renderLayers.getMainSceneAdapter();
```

Use `mainSceneAdapter.createGroup`, `mainSceneAdapter.addGroup`, `mainSceneAdapter.setObjectParent`, and related methods exactly where `rendererHost.sceneAdapter` was used.

- [ ] **Step 4: Run focused runtime tests**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/renderer/renderLayerRegistry.test.ts packages/dom-webgl-runtime/test/lib/renderer/runtime.test.ts packages/dom-webgl-runtime/test/lib/renderer/runtimePipeline.test.ts
```

Expected: `PASS`.

## Task 4: Strengthen Public Boundary Tests

**Files:**
- Modify: `packages/dom-webgl-runtime/test/publicExports.test.ts`

- [ ] **Step 1: Add negative exports for Phase 1 internals and future public names**

In both root-entrypoint and React-entrypoint public fixture blocks, add assertions matching this shape:

```ts
// @ts-expect-error Render layer registry is internal runtime state.
import type { InternalRenderLayerRegistry } from "${importPath}";
// @ts-expect-error Internal render scenes are not public declarations.
import type { InternalRenderSceneEntry } from "${importPath}";
// @ts-expect-error Internal render cameras are not public declarations.
import type { InternalRenderCameraEntry } from "${importPath}";
// @ts-expect-error Internal render passes are not public declarations.
import type { InternalRenderPassEntry } from "${importPath}";
// @ts-expect-error WebGLScene is not a public Phase 1 API.
import type { WebGLScene } from "${importPath}";
// @ts-expect-error WebGLCamera is not a public Phase 1 API.
import type { WebGLCamera } from "${importPath}";
// @ts-expect-error WebGLRenderPass is not a public Phase 1 API.
import type { WebGLRenderPass } from "${importPath}";
```

- [ ] **Step 2: Run the public export guard**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/publicExports.test.ts
```

Expected: `PASS`. If TypeScript reports unused `@ts-expect-error`, the public boundary leaked and must be corrected before continuing.

## Task 5: Update Active Docs After Implementation

**Files:**
- Modify: `docs/STATUS.md`
- Modify: `docs/roadmap/managed-render-system.md`
- Modify: `README.md` only if the public contract text needs a current-truth clarification
- Modify: `docs/agent/package-usage.md` only if implementation changes any consumer-visible package usage wording

- [ ] **Step 1: Update roadmap Phase 1 status**

When tests or implementation start, set Phase 1 to `[in-progress]`. When code is written but not fully verified, set it to `[implemented]`. Only set `[verified]` after tests, docs, and commit are complete.

- [ ] **Step 2: Update `docs/STATUS.md` current truth**

Add a concise internal-only note under Runtime Truth after implementation:

```md
- Internally, the default Level 1 render path is represented as generated
  `main` scene, `main` DOM-aligned camera, and `main` render pass entries.
  These are not public declarations.
```

Do not add public usage instructions for `WebGLScene`, `WebGLCamera`, or `WebGLRenderPass` in Phase 1.

- [ ] **Step 3: Re-check package docs**

If `WebGLRuntimeOptions`, `WebGLDeclaration`, React exports, or consumer usage did not change, leave `docs/agent/package-usage.md` unchanged except for reviewed commit metadata if that file later gains it.

## Task 6: Verification And Commit

**Files:**
- All files changed by Tasks 1-5.

- [ ] **Step 1: Run focused tests**

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/renderer/renderLayerRegistry.test.ts packages/dom-webgl-runtime/test/lib/renderer/runtime.test.ts packages/dom-webgl-runtime/test/lib/renderer/runtimePipeline.test.ts packages/dom-webgl-runtime/test/publicExports.test.ts
```

Expected: `PASS`.

- [ ] **Step 2: Run package-level validation**

```bash
npm run typecheck
npm run check:imports
git diff --check
```

Expected: all commands pass.

- [ ] **Step 3: Run full validation if focused checks pass**

```bash
npm run test -- --run
npm run build
```

Expected: all commands pass.

- [ ] **Step 4: Review the public boundary**

Confirm:

- `packages/dom-webgl-runtime/src/lib/types.ts` has no public scene/camera/pass declarations.
- `packages/dom-webgl-runtime/src/index.ts` and `packages/dom-webgl-runtime/src/react.ts` do not export Phase 1 internals.
- `apps/example` imports still go only through public package entrypoints.
- No package code imports app/example keys, assets, DOM structure, CSS classes, or copy.
- No raw Three.js object, scene, camera, material, texture, renderer, render target, composer, pass, or render loop is exposed through public types.

- [ ] **Step 5: Commit**

```bash
git status --short
git add packages/dom-webgl-runtime/src/lib/renderer/renderLayerRegistry.ts \
  packages/dom-webgl-runtime/test/lib/renderer/renderLayerRegistry.test.ts \
  packages/dom-webgl-runtime/src/lib/renderer/runtime.ts \
  packages/dom-webgl-runtime/test/lib/renderer/runtime.test.ts \
  packages/dom-webgl-runtime/test/lib/renderer/runtimePipeline.test.ts \
  packages/dom-webgl-runtime/test/publicExports.test.ts \
  docs/STATUS.md \
  docs/roadmap/managed-render-system.md
git commit -m "refactor: add internal render layer foundations"
```

## Exit Criteria

- Internal registry exists with generated `main` scene, camera, and pass entries.
- Runtime rendering goes through the generated main pass while preserving current render/postprocess order.
- Existing Level 1 `WebGLTarget` behavior and public package API are unchanged.
- Public export tests reject Phase 1 internals and future scene/camera/pass names.
- Focused tests, typecheck, import boundary check, full test run, build, and `git diff --check` pass.
- Roadmap Phase 1 is marked `[verified]` only after implementation, verification, docs, and commit are complete.
