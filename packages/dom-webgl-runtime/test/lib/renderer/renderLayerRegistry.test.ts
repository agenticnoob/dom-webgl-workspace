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

  test("registers managed scene camera and pass entries without replacing main", () => {
    const mainAdapter = createSceneAdapter();
    const worldAdapter = createSceneAdapter();
    const resize = vi.fn();
    const registry = createInternalRenderLayerRegistry(
      createRendererHostStub(mainAdapter),
      {
        createManagedSceneAdapter() {
          return {
            scene: { label: "world-scene" },
            camera: { label: "world-camera" },
            sceneAdapter: worldAdapter,
            resize,
            dispose() {
              return;
            },
          };
        },
      },
    );

    registry.registerScene({ id: "world", defaultPass: true });
    registry.registerCamera({
      id: "world.camera",
      sceneId: "world",
      default: true,
    });
    registry.registerRenderPass({
      id: "world.pass",
      sceneId: "world",
      cameraId: "world.camera",
      order: 1,
    });

    expect(registry.getScene("main").sceneAdapter).toBe(mainAdapter);
    expect(registry.getScene("world")).toMatchObject({
      id: "world",
      generated: false,
      projection: "dom-aligned",
      scene: { label: "world-scene" },
      sceneAdapter: worldAdapter,
    });
    expect(registry.getCamera("world.camera")).toMatchObject({
      id: "world.camera",
      generated: false,
      type: "orthographic",
      mode: "dom-aligned",
      sceneId: "world",
      camera: { label: "world-camera" },
    });
    expect(registry.getSceneAdapterForTarget("world")).toBe(worldAdapter);
    expect(resize).toHaveBeenCalledWith({ width: 800, height: 600 });

    registry.resize({ width: 390, height: 844 });

    expect(resize).toHaveBeenLastCalledWith({ width: 390, height: 844 });
  });

  test("renders generated and managed passes in order", () => {
    const mainAdapter = createSceneAdapter();
    const overlayAdapter = createSceneAdapter();
    const order: string[] = [];
    const registry = createInternalRenderLayerRegistry(
      createRendererHostStub(mainAdapter),
      {
        createManagedSceneAdapter() {
          return {
            scene: { label: "overlay-scene" },
            camera: { label: "overlay-camera" },
            sceneAdapter: overlayAdapter,
            resize() {
              return;
            },
            dispose() {
              return;
            },
          };
        },
      },
    );

    mainAdapter.render.mockImplementation(() => order.push("main"));
    overlayAdapter.render.mockImplementation(() => order.push("overlay"));

    registry.registerScene({ id: "overlay" });
    registry.registerCamera({ id: "overlay.camera", sceneId: "overlay", default: true });
    registry.registerRenderPass({
      id: "overlay.pass",
      sceneId: "overlay",
      cameraId: "overlay.camera",
      order: 1,
    });

    registry.renderPasses((_pass, scene) => {
      scene.sceneAdapter.render();
    });

    expect(order).toEqual(["main", "overlay"]);
  });

  test("throws controlled diagnostics for duplicates and unresolved references", () => {
    const registry = createInternalRenderLayerRegistry(
      createRendererHostStub(createSceneAdapter()),
    );

    registry.registerScene({ id: "overlay" });

    expect(() => registry.registerScene({ id: "overlay" })).toThrow(
      'WebGL scene id "overlay" is already registered.',
    );
    expect(() =>
      registry.registerCamera({ id: "missing.camera", sceneId: "missing" }),
    ).toThrow('WebGL camera "missing.camera" references unknown scene "missing".');
    expect(() =>
      registry.registerRenderPass({ id: "missing.pass", sceneId: "missing" }),
    ).toThrow('WebGL render pass "missing.pass" references unknown scene "missing".');
  });

  test("defers scene default passes until a default camera is registered", () => {
    const mainAdapter = createSceneAdapter();
    const worldAdapter = createSceneAdapter();
    const order: string[] = [];
    const registry = createInternalRenderLayerRegistry(
      createRendererHostStub(mainAdapter),
      {
        createManagedSceneAdapter() {
          return {
            scene: { label: "world-scene" },
            camera: { label: "world-camera" },
            sceneAdapter: worldAdapter,
            resize() {
              return;
            },
            dispose() {
              return;
            },
          };
        },
      },
    );

    mainAdapter.render.mockImplementation(() => order.push("main"));
    worldAdapter.render.mockImplementation(() => order.push("world"));

    registry.registerScene({ id: "world", defaultPass: true });
    registry.renderPasses((_pass, scene) => {
      scene.sceneAdapter.render();
    });

    expect(order).toEqual(["main"]);

    registry.registerCamera({ id: "world.camera", sceneId: "world", default: true });
    registry.renderPasses((_pass, scene) => {
      scene.sceneAdapter.render();
    });

    expect(order).toEqual(["main", "main", "world"]);
  });

  test("keeps default cameras scoped to their owning scene", () => {
    const registry = createInternalRenderLayerRegistry(
      createRendererHostStub(createSceneAdapter()),
    );

    registry.registerScene({ id: "world", defaultPass: true });
    registry.registerScene({ id: "overlay" });
    registry.registerCamera({
      id: "world.camera",
      sceneId: "world",
      default: true,
    });
    registry.registerCamera({
      id: "overlay.camera",
      sceneId: "overlay",
      default: true,
    });

    registry.unregisterCamera("world.camera");

    expect(() =>
      registry.renderPasses(() => {
        return;
      }),
    ).not.toThrow();
    registry.unregisterRenderPass("world:default:pass");
    expect(() =>
      registry.registerRenderPass({
        id: "world.overlay-camera.pass",
        sceneId: "world",
        cameraId: "overlay.camera",
      }),
    ).not.toThrow();
    expect(() =>
      registry.renderPasses(() => {
        return;
      }),
    ).toThrow(
      'WebGL render pass "world.overlay-camera.pass" references camera "overlay.camera" from scene "overlay".',
    );
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
