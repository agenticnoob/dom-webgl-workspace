import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { WebGLRuntime } from "../../../src/index";

const roots: Root[] = [];

describe("WebGLStageBox", () => {
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

  test("registers a box with an explicit scene override", async () => {
    const { WebGLRuntimeProvider, WebGLStageBox } = await import(
      "../../../src/react"
    );
    const runtime = createRuntimeStub();
    const { root } = createTestRoot();

    await act(async () => {
      root.render(
        createElement(
          WebGLRuntimeProvider,
          { runtime },
          createElement(WebGLStageBox, {
            id: "box",
            scene: "overlay",
            size: [1, 2, 3],
          }),
        ),
      );
    });

    expect(runtime.registerStagePrimitive).toHaveBeenCalledWith({
      id: "box",
      sceneId: "overlay",
      kind: "box",
      size: [1, 2, 3],
    });

    act(() => {
      root.unmount();
    });
    roots.splice(roots.indexOf(root), 1);

    expect(runtime.unregisterStagePrimitive).toHaveBeenCalledWith("box");
  });

  test("requires an explicit or inherited scene", async () => {
    const { WebGLRuntimeProvider, WebGLStageBox } = await import("../../../src/react");
    const runtime = createRuntimeStub();

    expect(() =>
      renderToStaticMarkup(
        createElement(
          WebGLRuntimeProvider,
          { runtime },
          createElement(WebGLStageBox, { id: "box" }),
        ),
      ),
    ).toThrow('WebGL stage box "box" requires a scene prop or a parent WebGLScene.');
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
  registerStagePrimitive: ReturnType<typeof vi.fn>;
  unregisterStagePrimitive: ReturnType<typeof vi.fn>;
} {
  return {
    container: document.createElement("div"),
    registerScene: vi.fn(),
    unregisterScene: vi.fn(),
    registerCamera: vi.fn(),
    unregisterCamera: vi.fn(),
    registerRenderPass: vi.fn(),
    unregisterRenderPass: vi.fn(),
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
