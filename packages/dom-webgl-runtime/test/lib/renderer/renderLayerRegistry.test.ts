import { describe, expect, test, vi } from "vitest";

import { createInternalRenderLayerRegistry } from "../../../src/lib/renderer/renderLayerRegistry";
import type { WebGLSceneAdapter } from "../../../src/lib/renderer/sceneObject";
import type { ThreeRendererHost } from "../../../src/lib/renderer/threeRenderer";

describe("createInternalRenderLayerRegistry", () => {
  test("creates generated default scene camera and pass from the renderer host", () => {
    const sceneAdapter = createSceneAdapter();
    const host = createRendererHostStub(sceneAdapter);

    const registry = createInternalRenderLayerRegistry(host);

    expect(registry.getScene("__dom-webgl-default__")).toMatchObject({
      id: "__dom-webgl-default__",
      generated: true,
      projection: "dom-aligned",
      scene: host.scene,
      sceneAdapter,
    });
    expect(registry.getCamera("__dom-webgl-default__")).toMatchObject({
      id: "__dom-webgl-default__",
      generated: true,
      type: "orthographic",
      mode: "dom-aligned",
      camera: host.camera,
    });
    expect(registry.getPasses()).toEqual([
      {
        id: "__dom-webgl-default__",
        generated: true,
        sceneId: "__dom-webgl-default__",
        cameraId: "__dom-webgl-default__",
        order: 0,
        clear: false,
        clearDepth: false,
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
      expect(pass.id).toBe("__dom-webgl-default__");
      expect(scene.id).toBe("__dom-webgl-default__");
      expect(camera.id).toBe("__dom-webgl-default__");
      scene.sceneAdapter.render();
    });

    registry.renderPasses(renderPass);

    expect(renderPass).toHaveBeenCalledTimes(1);
    expect(sceneAdapter.render).toHaveBeenCalledTimes(1);
  });

  test("registers managed scene camera and pass entries without replacing main", () => {
    const mainAdapter = createSceneAdapter();
    const worldAdapter = createSceneAdapter();
    const managedCamera = { label: "world-camera" };
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
        createManagedCamera() {
          return {
            camera: managedCamera,
            resize() {
              return;
            },
            applyFraming() {
              return;
            },
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

    expect(registry.getScene("__dom-webgl-default__").sceneAdapter).toBe(
      mainAdapter,
    );
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
      camera: managedCamera,
    });
    expect(registry.getSceneAdapterForTarget("world")).toBe(worldAdapter);
    expect(resize).toHaveBeenCalledWith({ width: 800, height: 600 });

    registry.resize({ width: 390, height: 844 });

    expect(resize).toHaveBeenLastCalledWith({ width: 390, height: 844 });
  });

  test("creates managed cameras separately from managed scene adapters", () => {
    const mainAdapter = createSceneAdapter();
    const worldAdapter = createSceneAdapter();
    const perspectiveCamera = { label: "perspective-camera" };
    const resizeCamera = vi.fn();
    const registry = createInternalRenderLayerRegistry(
      createRendererHostStub(mainAdapter),
      {
        createManagedSceneAdapter() {
          return {
            scene: { label: "world-scene" },
            camera: { label: "fallback-camera" },
            sceneAdapter: worldAdapter,
            resize() {
              return;
            },
            dispose() {
              return;
            },
          };
        },
        createManagedCamera(declaration) {
          expect(declaration.type).toBe("perspective");
          return {
            camera: perspectiveCamera,
            resize: resizeCamera,
            applyFraming() {
              return;
            },
            dispose() {
              return;
            },
          };
        },
      },
    );

    registry.registerScene({ id: "world", projection: "perspective-stage" });
    registry.registerCamera({
      id: "world.camera",
      sceneId: "world",
      type: "perspective",
      mode: "perspective-stage",
      default: true,
    });

    expect(registry.getCamera("world.camera")).toMatchObject({
      id: "world.camera",
      sceneId: "world",
      type: "perspective",
      mode: "perspective-stage",
      camera: perspectiveCamera,
    });

    registry.resize({ width: 390, height: 844 });

    expect(resizeCamera).toHaveBeenCalledWith({ width: 390, height: 844 });
  });

  test("updates managed perspective camera controllers from progress signals", () => {
    const managedCamera = {
      camera: { label: "hero-camera" },
      resize: vi.fn(),
      applyFraming: vi.fn(),
      dispose: vi.fn(),
    };
    const registry = createInternalRenderLayerRegistry(
      createRendererHostStub(createSceneAdapter()),
      {
        createManagedCamera() {
          return managedCamera;
        },
      },
    );

    registry.registerScene({ id: "hero.scene", projection: "perspective-stage" });
    registry.registerCamera({
      id: "hero.camera",
      sceneId: "hero.scene",
      type: "perspective",
      mode: "perspective-stage",
      default: true,
      position: [0, 0, 700],
      target: [0, 0, 0],
      fov: 44,
      controller: {
        timeline: "hero.timeline",
        to: {
          position: [0, 120, 520],
          target: [0, 48, 0],
          fov: 34,
        },
      },
    });

    expect(registry.updateCameraControllers({ get: () => 0.5 })).toBe(true);
    expect(managedCamera.applyFraming).toHaveBeenLastCalledWith(
      {
        position: [0, 60, 610],
        target: [0, 24, 0],
        fov: 39,
      },
      { width: 800, height: 600 },
    );
    expect(registry.inspectCameraControllers()).toEqual([
      {
        cameraId: "hero.camera",
        sceneId: "hero.scene",
        timelineId: "hero.timeline",
        progressKey: "hero.timeline",
        progress: 0.5,
        applied: true,
      },
    ]);

    expect(registry.updateCameraControllers({ get: () => 0.5 })).toBe(false);

    registry.unregisterCamera("hero.camera");

    expect(managedCamera.applyFraming).toHaveBeenLastCalledWith(
      {
        position: [0, 0, 700],
        target: [0, 0, 0],
        fov: 44,
      },
      { width: 800, height: 600 },
    );
    expect(managedCamera.dispose).toHaveBeenCalledTimes(1);
  });

  test("rejects camera controllers outside perspective-stage managed cameras", () => {
    const registry = createInternalRenderLayerRegistry(
      createRendererHostStub(createSceneAdapter()),
    );

    registry.registerScene({ id: "overlay", projection: "screen" });

    expect(() =>
      registry.registerCamera({
        id: "overlay.camera",
        sceneId: "overlay",
        type: "orthographic",
        mode: "screen",
        default: true,
        controller: {
          timeline: "overlay.timeline",
          to: { fov: 34 },
        },
      }),
    ).toThrow(
      'WebGL camera controller "overlay.camera" requires a managed perspective-stage camera.',
    );
  });

  test("allows user-managed scenes named main without replacing the generated default", () => {
    const defaultAdapter = createSceneAdapter();
    const userMainAdapter = createSceneAdapter();
    const registry = createInternalRenderLayerRegistry(
      createRendererHostStub(defaultAdapter),
      {
        createManagedSceneAdapter() {
          return {
            scene: { label: "user-main-scene" },
            camera: { label: "user-main-camera" },
            sceneAdapter: userMainAdapter,
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

    registry.registerScene({ id: "main" });

    expect(registry.getScene("__dom-webgl-default__").sceneAdapter).toBe(
      defaultAdapter,
    );
    expect(registry.getScene("main")).toMatchObject({
      id: "main",
      generated: false,
      sceneAdapter: userMainAdapter,
    });
    expect(registry.getSceneAdapterForTarget(undefined)).toBe(defaultAdapter);
    expect(registry.getSceneAdapterForTarget("main")).toBe(userMainAdapter);
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

  test("stores pass viewport and postprocess descriptors without exposing renderer state", () => {
    const registry = createInternalRenderLayerRegistry(
      createRendererHostStub(createSceneAdapter()),
    );

    registry.registerScene({ id: "hero.scene" });
    registry.registerCamera({
      id: "hero.camera",
      sceneId: "hero.scene",
      default: true,
    });
    registry.registerRenderPass({
      id: "hero.pass",
      sceneId: "hero.scene",
      cameraId: "hero.camera",
      viewport: {
        mode: "dom-rect",
        anchorId: "hero.viewport",
        scissor: true,
      },
      postprocess: {
        grain: { amount: 0.04 },
      },
    });

    expect(registry.getPasses()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "hero.pass",
          viewport: {
            mode: "dom-rect",
            anchorId: "hero.viewport",
            scissor: true,
          },
          postprocess: {
            grain: { amount: 0.04 },
          },
        }),
      ]),
    );
  });

  test("skips timeline-bound scene passes while the active range is inactive", () => {
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
    registry.registerScene({
      id: "world",
      defaultPass: true,
      timeline: { id: "hero.3d", active: { from: 0.25, to: 0.75 } },
    });
    registry.registerCamera({
      id: "world.camera",
      sceneId: "world",
      default: true,
    });

    expect(registry.getScene("world").timeline).toEqual({
      id: "hero.3d",
      progressKey: "hero.3d",
      active: { from: 0.25, to: 0.75 },
    });

    registry.updateTimelineState({ get: () => 0.1 });
    registry.renderPasses((_pass, scene) => {
      scene.sceneAdapter.render();
    });

    expect(order).toEqual(["main"]);

    registry.updateTimelineState({ get: () => 0.5 });
    registry.renderPasses((_pass, scene) => {
      scene.sceneAdapter.render();
    });

    expect(order).toEqual(["main", "main", "world"]);
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

  test("defers explicit passes until their camera is registered", () => {
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
    registry.registerRenderPass({
      id: "overlay.pass",
      sceneId: "overlay",
      cameraId: "overlay.camera",
      order: 1,
    });
    registry.renderPasses((_pass, scene) => {
      scene.sceneAdapter.render();
    });

    expect(order).toEqual(["main"]);

    registry.registerCamera({
      id: "overlay.camera",
      sceneId: "overlay",
      default: true,
    });
    registry.renderPasses((_pass, scene) => {
      scene.sceneAdapter.render();
    });

    expect(order).toEqual(["main", "main", "overlay"]);
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
