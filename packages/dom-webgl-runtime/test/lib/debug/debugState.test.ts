import { describe, expect, test, vi } from "vitest";

import type { ScrollStateController } from "../../../src/lib/input/frameInput";
import type { PointerController } from "../../../src/lib/input/pointerController";
import type { WebGLDebugState, WebGLPointerState } from "../../../src/lib/types";
import {
  createBatchCandidateSummary,
  createDebugState,
  type DebugRuntimeState,
} from "../../../src/lib/debug/debugState";
import type { Renderable } from "../../../src/lib/render/renderable";
import type { createWebGLRuntime, WebGLRuntime } from "../../../src/lib/renderer/runtime";
import type {
  WebGLSceneObject,
  WebGLSceneObjectController,
} from "../../../src/lib/renderer/sceneObject";
import type { ThreeRendererHost } from "../../../src/lib/renderer/threeRenderer";

type RuntimeDebugOptions = Parameters<typeof createWebGLRuntime>[0] & {
  rendererHostFactory?: (container: HTMLElement) => ThreeRendererHost;
  onDebugStateChange?: (state: WebGLDebugState) => void;
  scrollState?: ScrollStateController;
  pointerController?: PointerController;
  clock?: () => number;
  measureElement?: () => DOMRect;
  onRenderableCreated?: (renderable: Renderable) => void;
};

type RuntimeWithDebugState = WebGLRuntime & {
  getDebugState(): WebGLDebugState;
};

describe("debug state", () => {
  test("creates a lightweight immutable debug snapshot", () => {
    const pointer = createPointerState();
    const state = createDebugState({
      targetCount: 1,
      renderableCount: 1,
      currentScrollMode: "page",
      pointer,
      targets: [
        {
          key: "poster",
          sourceKind: "media/image",
          renderRole: "media",
          resourceStatus: "error",
          lifecycleState: "error",
          visible: false,
          pointer: {
            localX: 12,
            localY: 8,
            normalizedX: -0.76,
            normalizedY: 0.84,
            isInside: true,
            isPressed: false,
            pressDuration: 0,
            isDragging: false,
            dragStartLocalX: -10,
            dragStartLocalY: -20,
            dragDeltaX: 0,
            dragDeltaY: 0,
            clickCount: 0,
          },
          error: new Error("Image decode failed"),
        },
      ],
    });

    pointer.x = 999;

    expect(state).toEqual({
      targetCount: 1,
      renderableCount: 1,
      currentScrollMode: "page",
      pointer: {
        ...createPointerState(),
      },
      targets: [
        {
          key: "poster",
          sourceKind: "media/image",
          renderRole: "media",
          resourceStatus: "error",
          lifecycleState: "error",
          visible: false,
          pointer: {
            localX: 12,
            localY: 8,
            normalizedX: -0.76,
            normalizedY: 0.84,
            isInside: true,
            isPressed: false,
            pressDuration: 0,
            isDragging: false,
            dragStartLocalX: -10,
            dragStartLocalY: -20,
            dragDeltaX: 0,
            dragDeltaY: 0,
            clickCount: 0,
          },
          layerDepth: 0,
          siblingIndex: 0,
          error: "Image decode failed",
        },
      ],
    });
  });

  test("copies target layer diagnostics into public debug state", () => {
    const state = createDebugState({
      targetCount: 2,
      renderableCount: 2,
      currentScrollMode: "page",
      pointer: createPointerState(),
      targets: [
        {
          key: "sequence",
          sourceKind: "media/image-sequence",
          renderRole: "media",
          resourceStatus: "ready",
          lifecycleState: "active",
          visible: true,
          layerDepth: 0,
          siblingIndex: 0,
          computedRenderOrder: 10,
        },
        {
          key: "sequence.copy",
          sourceKind: "dom/text",
          renderRole: "content",
          resourceStatus: "ready",
          lifecycleState: "active",
          visible: true,
          parentKey: "sequence",
          layerDepth: 1,
          siblingIndex: 0,
          computedRenderOrder: 130,
        },
      ],
    });

    expect(state.targets).toEqual([
      expect.objectContaining({
        key: "sequence",
        layerDepth: 0,
        siblingIndex: 0,
        computedRenderOrder: 10,
      }),
      expect.objectContaining({
        key: "sequence.copy",
        parentKey: "sequence",
        layerDepth: 1,
        siblingIndex: 0,
        computedRenderOrder: 130,
      }),
    ]);
  });

  test("includes managed scene ids without exposing scene objects", () => {
    const state = createDebugState({
      targetCount: 1,
      renderableCount: 1,
      currentScrollMode: "page",
      pointer: createPointerState(),
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

  test("reports active gate fields only for gate scroll mode", () => {
    const gateState: DebugRuntimeState = {
      targetCount: 0,
      renderableCount: 0,
      currentScrollMode: "gate",
      activeGateKey: "hero.scene",
      sceneProgress: 0.5,
      pointer: createPointerState(),
      targets: [],
    };
    const pageState: DebugRuntimeState = {
      ...gateState,
      currentScrollMode: "page",
    };

    expect(createDebugState(gateState)).toMatchObject({
      currentScrollMode: "gate",
      activeGateKey: "hero.scene",
      sceneProgress: 0.5,
    });
    expect(createDebugState(pageState)).not.toHaveProperty("activeGateKey");
    expect(createDebugState(pageState)).not.toHaveProperty("sceneProgress");
  });

  test("reports performance warnings when active counts exceed default budgets", () => {
    const targets = Array.from({ length: 51 }, (_entry, index) =>
      createDebugTargetState(`hero.${index}`),
    );

    const state = createDebugState({
      targetCount: targets.length,
      renderableCount: targets.length,
      currentScrollMode: "page",
      pointer: createPointerState(),
      targets,
    });

    expect(state.warnings).toContainEqual({
      code: "performance-budget-exceeded",
      target: "activeTargets",
      count: 51,
      limit: 50,
    });
  });

  test("reports performance warnings against custom runtime budgets", () => {
    const state = createDebugState({
      targetCount: 3,
      renderableCount: 3,
      currentScrollMode: "page",
      pointer: createPointerState(),
      performanceBudget: {
        maxActiveTargets: 3,
        maxActiveSnapshots: 2,
        maxActiveVideos: 1,
        maxActiveModels: 1,
      },
      targets: [
        createDebugTargetState("surface", "dom/element"),
        createDebugTargetState("title", "dom/text"),
        createDebugTargetState("poster", "media/image"),
        createDebugTargetState("loop", "media/video"),
        createDebugTargetState("loop.copy", "media/video"),
        createDebugTargetState("model", "model/glb"),
        createDebugTargetState("model.copy", "model/glb"),
      ],
    });

    expect(state.warnings).toEqual([
      {
        code: "performance-budget-exceeded",
        target: "activeTargets",
        count: 7,
        limit: 3,
      },
      {
        code: "performance-budget-exceeded",
        target: "activeSnapshots",
        count: 3,
        limit: 2,
      },
      {
        code: "performance-budget-exceeded",
        target: "activeVideos",
        count: 2,
        limit: 1,
      },
      {
        code: "performance-budget-exceeded",
        target: "activeModels",
        count: 2,
        limit: 1,
      },
    ]);
  });

  test("reports texture size warnings from internal texture telemetry", () => {
    const state = createDebugState({
      targetCount: 1,
      renderableCount: 1,
      currentScrollMode: "page",
      pointer: createPointerState(),
      performanceBudget: { maxTextureSize: 1024 },
      textureTelemetry: [
        {
          key: "hero.image",
          width: 2048,
          height: 1024,
          sourceKind: "image",
          dirty: false,
        },
      ],
      targets: [createDebugTargetState("hero.image", "media/image")],
    });

    expect(state.warnings).toContainEqual({
      code: "performance-budget-exceeded",
      target: "textureSize",
      count: 2048,
      limit: 1024,
    });
    expect(state).not.toHaveProperty("textures");
  });

  test("reports renderer stats budget warnings without exposing raw renderer info", () => {
    const state = createDebugState({
      targetCount: 1,
      renderableCount: 1,
      currentScrollMode: "page",
      pointer: createPointerState(),
      performanceBudget: { maxDrawCalls: 2, maxTextureCount: 3 },
      rendererStats: {
        drawCalls: 4,
        triangles: 12,
        geometries: 2,
        textures: 5,
      },
      targets: [createDebugTargetState("hero")],
    });

    expect(state.warnings).toEqual([
      {
        code: "performance-budget-exceeded",
        target: "drawCalls",
        count: 4,
        limit: 2,
      },
      {
        code: "performance-budget-exceeded",
        target: "textureCount",
        count: 5,
        limit: 3,
      },
    ]);
    expect(state).not.toHaveProperty("rendererInfo");
  });

  test("reports postprocess budget warnings without exposing render targets", () => {
    const state = createDebugState({
      targetCount: 1,
      renderableCount: 1,
      currentScrollMode: "page",
      pointer: createPointerState(),
      performanceBudget: {
        maxPostprocessRequests: 1,
        maxRenderTargetSize: 512,
      },
      postprocessStats: {
        activeRequests: 2,
        passCount: 1,
        maxRenderTargetSize: 800,
      },
      targets: [createDebugTargetState("hero")],
    });

    expect(state.warnings).toEqual([
      {
        code: "performance-budget-exceeded",
        target: "renderTargetSize",
        count: 800,
        limit: 512,
      },
      {
        code: "performance-budget-exceeded",
        target: "postprocessRequests",
        count: 2,
        limit: 1,
      },
    ]);
    expect(state).not.toHaveProperty("postprocess");
    expect(state).not.toHaveProperty("renderTarget");
  });

  test("summarizes internal batching candidates without exposing a public batching API", () => {
    const targets = [
      createDebugTargetState("poster.a", "media/image"),
      createDebugTargetState("poster.b", "media/image"),
      createDebugTargetState("copy", "dom/text"),
      createDebugTargetState("model", "model/glb"),
      {
        ...createDebugTargetState("offscreen.poster", "media/image"),
        lifecycleState: "mounted",
      },
    ] satisfies DebugRuntimeState["targets"];
    const state = createDebugState({
      targetCount: targets.length,
      renderableCount: targets.length,
      currentScrollMode: "page",
      pointer: createPointerState(),
      targets,
    });

    expect(createBatchCandidateSummary(targets)).toEqual({
      compatiblePlaneCount: 3,
      largestFamilySize: 2,
    });
    expect(state).not.toHaveProperty("batchCandidates");
  });

  test("runtime exposes current target renderable and input summaries", async () => {
    const runtime = await createRuntime({
      pointerController: createPointerController(),
      scrollState: createScrollStateController(),
      clock: () => 100,
    });
    const image = document.createElement("img");

    image.setAttribute("src", "/poster.png");
    Object.defineProperty(image, "decode", {
      configurable: true,
      value: vi.fn().mockResolvedValue(undefined),
    });

    runtime.registerTarget(image, { key: "poster" });

    expect(runtime.getDebugState()).toMatchObject({
      targetCount: 1,
      renderableCount: 0,
      currentScrollMode: "page",
      pointer: {
        x: 12,
        y: 24,
        normalizedX: -0.5,
        normalizedY: 0.25,
        isInside: true,
      },
      targets: [
        {
          key: "poster",
            sourceKind: "media/image",
            renderRole: "media",
            resourceStatus: "idle",
            lifecycleState: "declared",
            visible: true,
        },
      ],
    });

    await runtime.sync();

    expect(runtime.getDebugState()).toMatchObject({
      targetCount: 1,
      renderableCount: 1,
      currentScrollMode: "page",
      pointer: {
        x: 12,
        y: 24,
      },
      targets: [
        {
          key: "poster",
          sourceKind: "media/image",
            renderRole: "media",
            resourceStatus: "ready",
            lifecycleState: "active",
            visible: true,
        },
      ],
    });

    runtime.dispose();
  });

  test("runtime debug state exposes active gate frame input", async () => {
    const runtime = await createRuntime({
      scrollState: createGateScrollStateController(),
      pointerController: createPointerController(),
    });

    await runtime.sync();

    expect(runtime.getDebugState()).toMatchObject({
      currentScrollMode: "gate",
      activeGateKey: "hero.scene",
      sceneProgress: 0.25,
    });

    runtime.dispose();
  });

  test("runtime can notify when debug state changes", async () => {
    const onDebugStateChange = vi.fn();
    const runtime = await createRuntime({
      onDebugStateChange,
      pointerController: createPointerController(),
      scrollState: createScrollStateController(),
    });

    runtime.registerTarget(document.createElement("section"), { key: "hero" });
    await runtime.sync();

    expect(onDebugStateChange).toHaveBeenCalled();
    expect(onDebugStateChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        targetCount: 1,
        renderableCount: 1,
        targets: [
          expect.objectContaining({
            key: "hero",
	          sourceKind: "dom/element",
            renderRole: "surface",
            resourceStatus: "ready",
            lifecycleState: "active",
            visible: true,
          }),
        ],
      }),
    );

    runtime.dispose();
  });

  test("runtime exposes a cleared debug snapshot after disposal", async () => {
    const onDebugStateChange = vi.fn();
    const runtime = await createRuntime({
      onDebugStateChange,
      pointerController: createPointerController(),
      scrollState: createScrollStateController(),
    });

    runtime.registerTarget(document.createElement("section"), { key: "hero" });
    await runtime.sync();

    runtime.dispose();

    expect(runtime.getDebugState()).toMatchObject({
      targetCount: 0,
      renderableCount: 0,
      targets: [],
    });
    expect(onDebugStateChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        targetCount: 0,
        renderableCount: 0,
        targets: [],
      }),
    );
  });

  test("runtime notifies debug listeners when async renderable updates fail", async () => {
    const onDebugStateChange = vi.fn();
    const runtime = await createRuntime({
      onDebugStateChange,
      pointerController: createPointerController(),
      scrollState: createScrollStateController(),
    });
    const image = document.createElement("img");

    image.setAttribute("src", "/missing.png");
    Object.defineProperty(image, "decode", {
      configurable: true,
      value: vi.fn().mockRejectedValue(new Error("Image decode failed")),
    });

    runtime.registerTarget(image, { key: "poster" });

    await expect(runtime.sync()).rejects.toThrow("Image decode failed");
    expect(onDebugStateChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        targets: [
          expect.objectContaining({
            key: "poster",
            resourceStatus: "error",
            error: "Image decode failed",
          }),
        ],
      }),
    );

    runtime.dispose();
  });

  test("runtime notifies debug listeners when synchronous renderable updates fail", async () => {
    const onDebugStateChange = vi.fn();
    const runtime = await createRuntime({
      onDebugStateChange,
      pointerController: createPointerController(),
      scrollState: createScrollStateController(),
      measureElement() {
        throw new Error("Measurement failed");
      },
    });

    runtime.registerTarget(document.createElement("section"), { key: "hero" });

    expect(() => runtime.sync()).toThrow("Measurement failed");
    expect(onDebugStateChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        targets: [
          expect.objectContaining({
            key: "hero",
            resourceStatus: "error",
            error: "Measurement failed",
          }),
        ],
      }),
    );

    runtime.dispose();
  });

  test("runtime reports loading while async renderable updates are pending", async () => {
    let resolveDecode!: () => void;
    const runtime = await createRuntime({
      pointerController: createPointerController(),
      scrollState: createScrollStateController(),
    });
    const image = document.createElement("img");

    image.setAttribute("src", "/poster.png");
    Object.defineProperty(image, "decode", {
      configurable: true,
      value: vi.fn(
        () =>
          new Promise<void>((resolve) => {
            resolveDecode = resolve;
          }),
      ),
    });

    runtime.registerTarget(image, { key: "poster" });

    const syncResult = runtime.sync();

    expect(runtime.getDebugState()).toMatchObject({
      targets: [
        expect.objectContaining({
          key: "poster",
          resourceStatus: "loading",
        }),
      ],
    });

    resolveDecode();
    await syncResult;

    expect(runtime.getDebugState()).toMatchObject({
      targets: [
        expect.objectContaining({
          key: "poster",
          resourceStatus: "ready",
        }),
      ],
    });

    runtime.dispose();
  });

  test("runtime target visibility follows actual scene object visibility", async () => {
    const sceneObjectController = createVisibleSceneObjectController();
    const runtime = await createRuntime({
      pointerController: createPointerController(),
      scrollState: createScrollStateController(),
      onRenderableCreated(renderable) {
        Object.defineProperty(renderable, "sceneObjectController", {
          configurable: true,
          get: () => sceneObjectController,
        });
      },
    });

    runtime.registerTarget(document.createElement("section"), { key: "hero" });

    await runtime.sync();
    expect(runtime.getDebugState().targets[0]).toMatchObject({
      key: "hero",
      visible: true,
    });

    sceneObjectController.setVisible(false);
    await runtime.sync();

    expect(runtime.getDebugState().targets[0]).toMatchObject({
      key: "hero",
      visible: false,
    });

    runtime.dispose();
  });
});

async function createRuntime(
  options: Omit<RuntimeDebugOptions, "container" | "rendererHostFactory"> = {},
): Promise<RuntimeWithDebugState> {
  const { createWebGLRuntime } = await import("../../../src/lib/renderer/runtime");
  const container = document.createElement("div");

  return createWebGLRuntime({
    container,
    rendererHostFactory: createRendererHostStub,
    ...options,
  } as RuntimeDebugOptions) as RuntimeWithDebugState;
}

function createRendererHostStub(container: HTMLElement): ThreeRendererHost {
  const canvas = container.ownerDocument.createElement("canvas");

  return {
    canvas,
    camera: {},
    renderer: {
      canvas,
      render() {
        // Tests cover runtime ownership without touching a real WebGL context.
      },
      dispose() {
        // Tests cover runtime ownership without touching a real WebGL context.
      },
    },
    scene: {},
    sceneAdapter: {
      addObject() {
        return;
      },
      removeObject() {
        return;
      },
      render() {
        return;
      },
    },
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
      canvas.remove();
    },
  };
}

function createScrollStateController(): ScrollStateController {
  const scroll = {
    mode: "page" as const,
    pageProgress: 0.4,
    direction: 1 as const,
    velocity: 12,
  };

  return {
    getState() {
      return scroll;
    },
    update() {
      return scroll;
    },
  };
}

function createGateScrollStateController(): ScrollStateController {
  const scroll = {
    mode: "gate" as const,
    activeGateKey: "hero.scene",
    sceneProgress: 0.25,
    direction: 1 as const,
    velocity: 250,
  };

  return {
    getState() {
      return scroll;
    },
    update() {
      return scroll;
    },
  };
}

function createPointerController(): PointerController {
  return {
    getState: createPointerState,
    dispose: vi.fn(),
  };
}

function createPointerState(): WebGLPointerState {
  return {
    x: 12,
    y: 24,
    normalizedX: -0.5,
    normalizedY: 0.25,
    isInside: true,
    isDown: false,
    downTime: 0,
    pressDuration: 0,
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0,
    dragDeltaX: 0,
    dragDeltaY: 0,
    clickCount: 0,
  };
}

function createDebugTargetState(
  key: string,
  sourceKind = "dom/element",
): DebugRuntimeState["targets"][number] {
  return {
    key,
    sourceKind,
    renderRole: sourceKind === "model/glb" ? "model" : "surface",
    resourceStatus: "ready",
    lifecycleState: "active",
    visible: true,
  };
}

function createVisibleSceneObjectController(): WebGLSceneObjectController {
  let visible = true;
  const object: WebGLSceneObject = {
    key: "debug.visible",
    setVisible(nextVisible) {
      visible = nextVisible;
    },
    updateLayout() {
      return;
    },
    dispose() {
      return;
    },
  };

  return {
    object,
    attached: true,
    disposed: false,
    get visible() {
      return visible;
    },
    attach() {
      return;
    },
    setVisible(nextVisible) {
      visible = nextVisible;
    },
    setOrdering() {
      return;
    },
    updateLayout() {
      return;
    },
    render() {
      return;
    },
    dispose() {
      return;
    },
  };
}
