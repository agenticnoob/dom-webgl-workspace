import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { WebGLSceneProvider } from "../../../src/lib/react/sceneContext";
import type { WebGLRuntime } from "../../../src/index";

const roots: Root[] = [];

describe("WebGLModel", () => {
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

  test("registers a scene-native model under the nearest WebGLScene", async () => {
    const { WebGLModel, WebGLRuntimeProvider } = await import("../../../src/react");
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
            createElement(WebGLModel, {
              id: "character",
              src: "/models/Sprint.glb",
              position: [0, 12, -40],
              rotation: [0, 1.2, 0],
              scale: 1.5,
              timeline: { id: "hero.3d", active: { from: 0.2, to: 0.8 } },
              animation: {
                defaultClip: { clip: "Run", loop: "repeat", fadeInMs: 120 },
                morphs: [{ name: "Smile", weight: 0.65 }],
              },
              physics: {
                body: { type: "kinematic" },
                collider: { kind: "sphere", radius: 18 },
                constraints: [{ kind: "anchor", target: [0, 12, -40], stiffness: 0.2 }],
              },
            }),
          ),
        ),
      );
    });

    expect(runtime.registerModel).toHaveBeenCalledWith({
      id: "character",
      sceneId: "world",
      src: "/models/Sprint.glb",
      position: [0, 12, -40],
      rotation: [0, 1.2, 0],
      scale: 1.5,
      timeline: { id: "hero.3d", active: { from: 0.2, to: 0.8 } },
      animation: {
        defaultClip: { clip: "Run", loop: "repeat", fadeInMs: 120 },
        morphs: [{ name: "Smile", weight: 0.65 }],
      },
      physics: {
        body: { type: "kinematic" },
        collider: { kind: "sphere", radius: 18 },
        constraints: [{ kind: "anchor", target: [0, 12, -40], stiffness: 0.2 }],
      },
    });

    act(() => {
      root.unmount();
    });
    roots.splice(roots.indexOf(root), 1);

    expect(runtime.unregisterModel).toHaveBeenCalledWith("character");
  });

  test("supports an explicit scene prop", async () => {
    const { WebGLModel, WebGLRuntimeProvider } = await import("../../../src/react");
    const runtime = createRuntimeStub();
    const { root } = createTestRoot();

    await act(async () => {
      root.render(
        createElement(
          WebGLRuntimeProvider,
          { runtime },
          createElement(WebGLModel, {
            id: "vehicle",
            scene: "garage",
            src: "/models/Vehicle.glb",
          }),
        ),
      );
    });

    expect(runtime.registerModel).toHaveBeenCalledWith({
      id: "vehicle",
      sceneId: "garage",
      src: "/models/Vehicle.glb",
    });
  });

  test("passes prepare descriptors through to the runtime", async () => {
    const { WebGLModel, WebGLRuntimeProvider } = await import("../../../src/react");
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
            createElement(WebGLModel, {
              id: "character",
              src: "/models/Sprint.glb",
              prepare: { renderWarmup: "idle" },
            }),
          ),
        ),
      );
    });

    expect(runtime.registerModel).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "character",
        sceneId: "world",
        src: "/models/Sprint.glb",
        prepare: { renderWarmup: "idle" },
      }),
    );
  });

  test("passes explicit default clips through as descriptor data", async () => {
    const { WebGLModel, WebGLRuntimeProvider } = await import("../../../src/react");
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
            createElement(WebGLModel, {
              id: "character",
              src: "/models/Sprint.glb",
              animation: {
                defaultClips: [
                  { clip: "MainSkeleton.001", loop: "repeat", fadeInMs: 160 },
                  { clip: "SpeedLines.001", loop: "repeat" },
                  "BagArmature.001",
                ],
              },
            }),
          ),
        ),
      );
    });

    expect(runtime.registerModel).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "character",
        sceneId: "world",
        src: "/models/Sprint.glb",
        animation: {
          defaultClips: [
            { clip: "MainSkeleton.001", loop: "repeat", fadeInMs: 160 },
            { clip: "SpeedLines.001", loop: "repeat" },
            "BagArmature.001",
          ],
        },
      }),
    );
  });

  test("requires an explicit or inherited scene", async () => {
    const { WebGLModel, WebGLRuntimeProvider } = await import("../../../src/react");
    const runtime = createRuntimeStub();

    expect(() =>
      renderToStaticMarkup(
        createElement(
          WebGLRuntimeProvider,
          { runtime },
          createElement(WebGLModel, { id: "character", src: "/models/Sprint.glb" }),
        ),
      ),
    ).toThrow(
      'WebGL model "character" requires a scene prop or a parent WebGLScene.',
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
  registerModel: ReturnType<typeof vi.fn>;
  unregisterModel: ReturnType<typeof vi.fn>;
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
