import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { WebGLRuntime } from "../../../src/index";

const roots: Root[] = [];

describe("WebGLPassViewport", () => {
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

  test("registers and unregisters a pass viewport anchor", async () => {
    const { WebGLPassViewport, WebGLRuntimeProvider } = await import(
      "../../../src/react"
    );
    const runtime = createRuntimeStub();
    const { root } = createTestRoot();

    await act(async () => {
      root.render(
        createElement(
          WebGLRuntimeProvider,
          { runtime },
          createElement(WebGLPassViewport, {
            id: "hero.viewport",
            as: "section",
            className: "hero-stage",
          }),
        ),
      );
    });

    expect(runtime.registerPassViewport).toHaveBeenCalledWith({
      id: "hero.viewport",
      element: expect.any(HTMLElement),
    });

    act(() => {
      root.unmount();
    });
    roots.splice(roots.indexOf(root), 1);

    expect(runtime.unregisterPassViewport).toHaveBeenCalledWith("hero.viewport");
  });

  test("renders arbitrary children inside the DOM viewport owner", async () => {
    const { WebGLPassViewport, WebGLRuntimeProvider } = await import(
      "../../../src/react"
    );
    const runtime = createRuntimeStub();
    const { root, host } = createTestRoot();

    await act(async () => {
      root.render(
        createElement(
          WebGLRuntimeProvider,
          { runtime },
          createElement(
            WebGLPassViewport,
            { id: "hero.viewport", as: "section" },
            createElement("p", null, "普通 DOM 内容"),
          ),
        ),
      );
    });

    expect(host.textContent).toContain("普通 DOM 内容");
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
  registerPassViewport: ReturnType<typeof vi.fn>;
  unregisterPassViewport: ReturnType<typeof vi.fn>;
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
