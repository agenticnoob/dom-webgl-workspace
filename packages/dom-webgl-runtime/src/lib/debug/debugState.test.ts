import { describe, expect, test, vi } from "vitest";

import type { ScrollStateController } from "../input/frameInput";
import type { PointerController } from "../input/pointerController";
import type { WebGLDebugState, WebGLPointerState } from "../types";
import { createDebugState, type DebugRuntimeState } from "./debugState";
import type { Renderable } from "../render/renderable";
import type { createWebGLRuntime, WebGLRuntime } from "../renderer/runtime";
import type { WebGLSceneObjectController } from "../renderer/sceneObject";
import type { ThreeRendererHost } from "../renderer/threeRenderer";

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
          error: "Image decode failed",
        },
      ],
    });
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
  const { createWebGLRuntime } = await import("../renderer/runtime");
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

function createVisibleSceneObjectController(): WebGLSceneObjectController {
  let visible = true;

  return {
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
