import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { WebGLSceneProvider } from "../../../src/lib/react/sceneContext";
import type { WebGLRuntime } from "../../../src/index";

const roots: Root[] = [];

describe("WebGLMesh", () => {
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

  test("forwards the full declaration to an explicit scene and unregisters on unmount", async () => {
    const { WebGLMesh, WebGLRuntimeProvider } = await import("../../../src/react");
    const runtime = createRuntimeStub();
    const { root } = createTestRoot();
    const geometry = { kind: "tetrahedron" as const, radius: 2, detail: 1 };
    const material = {
      kind: "physical" as const,
      color: "#f5f1e8",
      roughness: 0.72,
      transmission: 0.8,
      thickness: 1.2,
      ior: 1.6,
    };
    const effects = [{ kind: "app.mesh" }];
    const interaction = { pickable: true as const };
    const physics = {
      body: { type: "dynamic" as const, mass: 2 },
      collider: { kind: "box" as const, size: [2, 2, 2] as const },
    };

    await act(async () => {
      root.render(
        createElement(
          WebGLRuntimeProvider,
          { runtime },
          createElement(WebGLMesh, {
            id: "hero.mesh",
            scene: "world",
            geometry,
            position: [1, 2, 3],
            rotation: [0.1, 0.2, 0.3],
            scale: [2, 3, 4],
            visible: false,
            material,
            timeline: "hero.timeline",
            effects,
            interaction,
            physics,
          }),
        ),
      );
    });

    expect(runtime.registerMesh).toHaveBeenCalledWith({
      id: "hero.mesh",
      sceneId: "world",
      geometry,
      position: [1, 2, 3],
      rotation: [0.1, 0.2, 0.3],
      scale: [2, 3, 4],
      visible: false,
      material,
      timeline: "hero.timeline",
      effects,
      interaction,
      physics,
    });

    act(() => {
      root.unmount();
    });
    roots.splice(roots.indexOf(root), 1);

    expect(runtime.unregisterMesh).toHaveBeenCalledWith("hero.mesh");
  });

  test("inherits the nearest WebGLScene", async () => {
    const { WebGLMesh, WebGLRuntimeProvider } = await import("../../../src/react");
    const runtime = createRuntimeStub();
    const { root } = createTestRoot();

    await act(async () => {
      root.render(
        createElement(
          WebGLRuntimeProvider,
          { runtime },
          createElement(
            WebGLSceneProvider,
            { sceneId: "inherited" },
            createElement(WebGLMesh, {
              id: "inherited.mesh",
              geometry: { kind: "sphere" },
            }),
          ),
        ),
      );
    });

    expect(runtime.registerMesh).toHaveBeenCalledWith({
      id: "inherited.mesh",
      sceneId: "inherited",
      geometry: { kind: "sphere" },
    });
  });

  test("requires an explicit or inherited scene", async () => {
    const { WebGLMesh, WebGLRuntimeProvider } = await import("../../../src/react");
    const runtime = createRuntimeStub();

    expect(() =>
      renderToStaticMarkup(
        createElement(
          WebGLRuntimeProvider,
          { runtime },
          createElement(WebGLMesh, {
            id: "missing.mesh",
            geometry: { kind: "box" },
          }),
        ),
      ),
    ).toThrow('WebGL mesh "missing.mesh" requires a scene prop or a parent WebGLScene.');
  });

  test("re-registers when a declaration prop reference changes", async () => {
    const { WebGLMesh, WebGLRuntimeProvider } = await import("../../../src/react");
    const runtime = createRuntimeStub();
    const { root } = createTestRoot();
    const firstGeometry = { kind: "plane" as const, size: [2, 1] as const };
    const secondGeometry = { kind: "box" as const, size: [2, 1, 3] as const };

    await act(async () => {
      root.render(
        createElement(
          WebGLRuntimeProvider,
          { runtime },
          createElement(WebGLMesh, {
            id: "changing.mesh",
            scene: "world",
            geometry: firstGeometry,
          }),
        ),
      );
    });

    await act(async () => {
      root.render(
        createElement(
          WebGLRuntimeProvider,
          { runtime },
          createElement(WebGLMesh, {
            id: "changing.mesh",
            scene: "world",
            geometry: secondGeometry,
          }),
        ),
      );
    });

    expect(runtime.unregisterMesh).toHaveBeenCalledWith("changing.mesh");
    expect(runtime.registerMesh).toHaveBeenNthCalledWith(2, {
      id: "changing.mesh",
      sceneId: "world",
      geometry: secondGeometry,
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
  registerMesh: ReturnType<typeof vi.fn>;
  unregisterMesh: ReturnType<typeof vi.fn>;
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
    registerMesh: vi.fn(),
    unregisterMesh: vi.fn(),
    registerLight: vi.fn(),
    unregisterLight: vi.fn(),
    registerModel: vi.fn(),
    unregisterModel: vi.fn(),
    registerTarget: vi.fn(),
    unregisterTarget: vi.fn(),
    sync() {},
    getDebugState() {
      throw new Error("not implemented in test");
    },
    dispose() {},
  };
}
