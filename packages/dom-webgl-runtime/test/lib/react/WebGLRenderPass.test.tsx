import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { WebGLRuntime } from "../../../src/index";

const roots: Root[] = [];

describe("WebGLRenderPass", () => {
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

  test("registers an explicit scene and camera render pass", async () => {
    const { WebGLRenderPass, WebGLRuntimeProvider } = await import(
      "../../../src/react"
    );
    const runtime = createRuntimeStub();
    const { root } = createTestRoot();

    await act(async () => {
      root.render(
        createElement(
          WebGLRuntimeProvider,
          { runtime },
          createElement(WebGLRenderPass, {
            id: " overlay.pass ",
            scene: "overlay",
            camera: "overlay.camera",
            order: 1,
          }),
        ),
      );
    });

    expect(runtime.registerRenderPass).toHaveBeenCalledWith({
      id: " overlay.pass ",
      sceneId: "overlay",
      cameraId: "overlay.camera",
      order: 1,
    });

    act(() => {
      root.unmount();
    });
    roots.splice(roots.indexOf(root), 1);

    expect(runtime.unregisterRenderPass).toHaveBeenCalledWith("overlay.pass");
  });

  test("forwards clear and clearDepth render pass declarations", async () => {
    const { WebGLRenderPass, WebGLRuntimeProvider } = await import(
      "../../../src/react"
    );
    const runtime = createRuntimeStub();
    const { root } = createTestRoot();

    await act(async () => {
      root.render(
        createElement(
          WebGLRuntimeProvider,
          { runtime },
          createElement(WebGLRenderPass, {
            id: "overlay.pass",
            scene: "overlay",
            camera: "overlay.camera",
            order: 10,
            clearDepth: true,
          }),
        ),
      );
    });

    expect(runtime.registerRenderPass).toHaveBeenCalledWith({
      id: "overlay.pass",
      sceneId: "overlay",
      cameraId: "overlay.camera",
      order: 10,
      clear: undefined,
      clearDepth: true,
    });
  });

  test("forwards viewport and postprocess render pass declarations", async () => {
    const { WebGLRenderPass, WebGLRuntimeProvider } = await import(
      "../../../src/react"
    );
    const runtime = createRuntimeStub();
    const { root } = createTestRoot();

    await act(async () => {
      root.render(
        createElement(
          WebGLRuntimeProvider,
          { runtime },
          createElement(WebGLRenderPass, {
            id: "hero.pass",
            scene: "hero.scene",
            camera: "hero.camera",
            viewport: {
              mode: "dom-rect",
              anchorId: "hero.viewport",
              scissor: true,
            },
            postprocess: {
              grain: { amount: 0.04 },
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

  test("uses the nearest pass viewport context when dom-rect anchorId is omitted", async () => {
    const { WebGLPassViewport, WebGLRenderPass, WebGLRuntimeProvider } =
      await import("../../../src/react");
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
            createElement(WebGLRenderPass, {
              id: "hero.pass",
              scene: "hero.scene",
              camera: "hero.camera",
              viewport: { mode: "dom-rect" },
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
