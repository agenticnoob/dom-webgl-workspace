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
    registerTarget: vi.fn(),
    unregisterTarget: vi.fn(),
    sync() {},
    getDebugState() {
      throw new Error("not implemented in test");
    },
    dispose() {},
  };
}
