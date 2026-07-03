import { describe, expect, test, vi } from "vitest";

import { createInternalRenderLayerRegistry } from "../../../src/lib/renderer/renderLayerRegistry";
import type { WebGLSceneAdapter } from "../../../src/lib/renderer/sceneObject";
import type { ThreeRendererHost } from "../../../src/lib/renderer/threeRenderer";

describe("createInternalRenderLayerRegistry", () => {
  test("creates generated main scene camera and pass from the renderer host", () => {
    const sceneAdapter = createSceneAdapter();
    const host = createRendererHostStub(sceneAdapter);

    const registry = createInternalRenderLayerRegistry(host);

    expect(registry.getScene("main")).toMatchObject({
      id: "main",
      generated: true,
      projection: "dom-aligned",
      scene: host.scene,
      sceneAdapter,
    });
    expect(registry.getCamera("main")).toMatchObject({
      id: "main",
      generated: true,
      type: "orthographic",
      mode: "dom-aligned",
      camera: host.camera,
    });
    expect(registry.getPasses()).toEqual([
      {
        id: "main",
        generated: true,
        sceneId: "main",
        cameraId: "main",
        order: 0,
      },
    ]);
    expect(registry.getMainSceneAdapter()).toBe(sceneAdapter);
  });

  test("executes generated passes against resolved scene adapters", () => {
    const sceneAdapter = createSceneAdapter();
    const registry = createInternalRenderLayerRegistry(
      createRendererHostStub(sceneAdapter),
    );
    const renderPass = vi.fn((pass, scene, camera) => {
      expect(pass.id).toBe("main");
      expect(scene.id).toBe("main");
      expect(camera.id).toBe("main");
      scene.sceneAdapter.render();
    });

    registry.renderPasses(renderPass);

    expect(renderPass).toHaveBeenCalledTimes(1);
    expect(sceneAdapter.render).toHaveBeenCalledTimes(1);
  });
});

function createSceneAdapter(): WebGLSceneAdapter & {
  render: ReturnType<typeof vi.fn>;
} {
  return {
    addObject() {
      return;
    },
    removeObject() {
      return;
    },
    render: vi.fn(),
  };
}

function createRendererHostStub(
  sceneAdapter: WebGLSceneAdapter,
): ThreeRendererHost {
  const canvas = document.createElement("canvas");

  return {
    canvas,
    renderer: {
      canvas,
      render() {
        return;
      },
      dispose() {
        return;
      },
    },
    scene: { label: "main-scene" },
    camera: { label: "main-camera" },
    sceneAdapter,
    getViewportSize() {
      return { width: 800, height: 600 };
    },
    readRendererStats() {
      return {
        drawCalls: 0,
        triangles: 0,
        geometries: 0,
        textures: 0,
      };
    },
    resizeIfNeeded() {
      return;
    },
    dispose() {
      return;
    },
  };
}
