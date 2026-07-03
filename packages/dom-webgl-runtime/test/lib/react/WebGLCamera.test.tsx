import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { WebGLRuntime } from "../../../src/index";

const roots: Root[] = [];

describe("WebGLCamera", () => {
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

  test("registers a camera under the nearest WebGLScene", async () => {
    const { WebGLCamera, WebGLRuntimeProvider, WebGLScene } = await import(
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
            WebGLScene,
            { id: "world" },
            createElement(WebGLCamera, { id: "world.camera", default: true }),
          ),
        ),
      );
    });

    expect(runtime.registerCamera).toHaveBeenCalledWith({
      id: "world.camera",
      sceneId: "world",
      type: undefined,
      mode: undefined,
      default: true,
    });
  });

  test("forwards perspective camera declarations", async () => {
    const { WebGLCamera, WebGLRuntimeProvider, WebGLScene } = await import(
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
            WebGLScene,
            { id: "world" },
            createElement(WebGLCamera, {
              id: "world.camera",
              type: "perspective",
              mode: "perspective-stage",
              fov: 50,
              near: 0.1,
              far: 2000,
              position: [0, 0, 500],
              target: [0, 0, 0],
              default: true,
            }),
          ),
        ),
      );
    });

    expect(runtime.registerCamera).toHaveBeenCalledWith({
      id: "world.camera",
      sceneId: "world",
      type: "perspective",
      mode: "perspective-stage",
      fov: 50,
      near: 0.1,
      far: 2000,
      position: [0, 0, 500],
      target: [0, 0, 0],
      default: true,
    });
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
  registerCamera: ReturnType<typeof vi.fn>;
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
