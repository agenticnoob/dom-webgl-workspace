import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { WebGLSceneProvider } from "../../../src/lib/react/sceneContext";
import type { WebGLRuntime } from "../../../src/index";

const roots: Root[] = [];

describe("WebGLStagePlane", () => {
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

  test("registers a plane under the nearest WebGLScene", async () => {
    const { WebGLRuntimeProvider, WebGLStagePlane } = await import(
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
            WebGLSceneProvider,
            { sceneId: "world" },
            createElement(WebGLStagePlane, {
              id: "floor",
              role: "floor",
              size: [1200, 800],
              timeline: "hero.3d",
            }),
          ),
        ),
      );
    });

    expect(runtime.registerStagePrimitive).toHaveBeenCalledWith({
      id: "floor",
      sceneId: "world",
      kind: "plane",
      role: "floor",
      size: [1200, 800],
      timeline: "hero.3d",
    });

    act(() => {
      root.unmount();
    });
    roots.splice(roots.indexOf(root), 1);

    expect(runtime.unregisterStagePrimitive).toHaveBeenCalledWith("floor");
  });

  test("requires an explicit or inherited scene", async () => {
    const { WebGLRuntimeProvider, WebGLStagePlane } = await import(
      "../../../src/react"
    );
    const runtime = createRuntimeStub();

    expect(() =>
      renderToStaticMarkup(
        createElement(
          WebGLRuntimeProvider,
          { runtime },
          createElement(WebGLStagePlane, { id: "floor" }),
        ),
      ),
    ).toThrow('WebGL stage plane "floor" requires a scene prop or a parent WebGLScene.');
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
