import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { WebGLRuntime } from "../../../src/index";

const roots: Root[] = [];

describe("WebGLScene", () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
  });

  afterEach(() => {
    for (const root of roots.splice(0)) {
      act(() => {
        root.unmount();
      });
    }
    document.body.replaceChildren();
  });

  test("registers and unregisters a managed scene declaration", async () => {
    const { WebGLRuntimeProvider, WebGLScene } = await import("../../../src/react");
    const runtime = createRuntimeStub();
    const { root } = createTestRoot();

    await act(async () => {
      root.render(
          createElement(
            WebGLRuntimeProvider,
            { runtime },
          createElement(WebGLScene, {
            id: "world",
            defaultPass: true,
            timeline: "hero.3d",
          }),
        ),
      );
    });

    expect(runtime.registerScene).toHaveBeenCalledWith({
      id: "world",
      projection: undefined,
      defaultCameraId: undefined,
      defaultPass: true,
      timeline: "hero.3d",
    });

    act(() => {
      root.unmount();
    });
    roots.splice(roots.indexOf(root), 1);

    expect(runtime.unregisterScene).toHaveBeenCalledWith("world");
  });

  test("registers scene-owned render pass from the render prop", async () => {
    const { WebGLRuntimeProvider, WebGLScene } = await import("../../../src/react");
    const runtime = createRuntimeStub();
    const { root } = createTestRoot();

    await act(async () => {
      root.render(
        createElement(
          WebGLRuntimeProvider,
          { runtime },
          createElement(WebGLScene, {
            id: "overlay",
            render: { camera: "overlay.camera", order: 10, clearDepth: true },
          }),
        ),
      );
    });

    expect(runtime.registerScene).toHaveBeenCalledWith({
      id: "overlay",
      projection: undefined,
      defaultCameraId: undefined,
      defaultPass: false,
    });
    expect(runtime.registerRenderPass).toHaveBeenCalledWith({
      id: undefined,
      sceneId: "overlay",
      cameraId: "overlay.camera",
      order: 10,
      clear: undefined,
      clearDepth: true,
    });

    act(() => {
      root.unmount();
    });
    roots.splice(roots.indexOf(root), 1);

    expect(runtime.unregisterRenderPass).toHaveBeenCalledWith(
      "overlay:overlay.camera:pass",
    );
    expect(runtime.unregisterScene).toHaveBeenCalledWith("overlay");
  });

  test("forwards screen projection declarations", async () => {
    const { WebGLRuntimeProvider, WebGLScene } = await import("../../../src/react");
    const runtime = createRuntimeStub();
    const { root } = createTestRoot();

    await act(async () => {
      root.render(
        createElement(
          WebGLRuntimeProvider,
          { runtime },
          createElement(WebGLScene, {
            id: "overlay",
            projection: "screen",
            defaultCameraId: "overlay.camera",
          }),
        ),
      );
    });

    expect(runtime.registerScene).toHaveBeenCalledWith({
      id: "overlay",
      projection: "screen",
      defaultCameraId: "overlay.camera",
      defaultPass: undefined,
    });
  });

  test("forwards scene-owned render viewport and postprocess declarations", async () => {
    const { WebGLRuntimeProvider, WebGLScene } = await import("../../../src/react");
    const runtime = createRuntimeStub();
    const { root } = createTestRoot();

    await act(async () => {
      root.render(
        createElement(
          WebGLRuntimeProvider,
          { runtime },
          createElement(WebGLScene, {
            id: "hero.scene",
            render: {
              id: "hero.pass",
              camera: "hero.camera",
              viewport: {
                mode: "dom-rect",
                anchorId: "hero.viewport",
                scissor: true,
              },
              postprocess: {
                grain: { amount: 0.04 },
              },
            },
          }),
        ),
      );
    });

    expect(runtime.registerRenderPass).toHaveBeenCalledWith({
      id: "hero.pass",
      sceneId: "hero.scene",
      cameraId: "hero.camera",
      order: undefined,
      clear: undefined,
      clearDepth: undefined,
      viewport: {
        mode: "dom-rect",
        anchorId: "hero.viewport",
        scissor: true,
      },
      postprocess: {
        grain: { amount: 0.04 },
      },
    });
  });

  test("uses the nearest pass viewport context for scene-owned render declarations", async () => {
    const { WebGLPassViewport, WebGLRuntimeProvider, WebGLScene } = await import(
      "../../../src/react"
    );
    const runtime = createRuntimeStub();
    const { root } = createTestRoot();

    await act(async () => {
      root.render(
        createElement(
          WebGLRuntimeProvider,
          { runtime },
          createElement(
            WebGLPassViewport,
            { id: "hero.viewport" },
            createElement(WebGLScene, {
              id: "hero.scene",
              render: {
                camera: "hero.camera",
                viewport: { mode: "dom-rect" },
              },
            }),
          ),
        ),
      );
    });

    expect(runtime.registerRenderPass).toHaveBeenCalledWith(
      expect.objectContaining({
        viewport: {
          mode: "dom-rect",
          anchorId: "hero.viewport",
        },
      }),
    );
  });
});

function createTestRoot(): { root: Root; host: HTMLElement } {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  roots.push(root);

  return { root, host };
}

function createRuntimeStub(): WebGLRuntime & {
  registerScene: ReturnType<typeof vi.fn>;
  unregisterScene: ReturnType<typeof vi.fn>;
  registerRenderPass: ReturnType<typeof vi.fn>;
  unregisterRenderPass: ReturnType<typeof vi.fn>;
} {
  return {
    container: document.createElement("div"),
    registerScene: vi.fn(),
    unregisterScene: vi.fn(),
    registerCamera: vi.fn(),
    unregisterCamera: vi.fn(),
    registerRenderPass: vi.fn(),
    unregisterRenderPass: vi.fn(),
    registerPassViewport: vi.fn(),
    unregisterPassViewport: vi.fn(),
    registerStagePrimitive: vi.fn(),
    unregisterStagePrimitive: vi.fn(),
    registerLight: vi.fn(),
    unregisterLight: vi.fn(),
    registerTarget: vi.fn(),
    unregisterTarget: vi.fn(),
    sync() {},
    getDebugState() {
      throw new Error("not implemented in test");
    },
    dispose() {},
  };
}
