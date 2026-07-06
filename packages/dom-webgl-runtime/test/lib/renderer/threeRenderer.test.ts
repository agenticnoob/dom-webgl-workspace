import { afterEach, describe, expect, test, vi } from "vitest";

import type {
  WebGLDeclaration,
  WebGLPointerState,
} from "../../../src/lib/types";
import type { ManagedHitCandidate } from "../../../src/lib/renderer/interactionRouter";
import type { createWebGLRuntime, WebGLRuntime } from "../../../src/lib/renderer/runtime";
import type {
  WebGLSceneAdapter,
  WebGLSceneGroup,
  WebGLSceneObject,
} from "../../../src/lib/renderer/sceneObject";
import type { ThreeRendererAdapter } from "../../../src/lib/renderer/threeRenderer";

type RuntimeWithTask23Surface = WebGLRuntime & {
  registerTarget(element: HTMLElement, declaration: WebGLDeclaration): void;
  sync(): void;
};

type DisposableRenderable = {
  dispose(): void;
};

type RuntimeWithInternalRenderableSeed = Parameters<typeof createWebGLRuntime>[0] & {
  renderables?: Iterable<DisposableRenderable>;
};

describe("createThreeRendererHost", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.doUnmock("three/src/cameras/OrthographicCamera.js");
    vi.doUnmock("three/src/cameras/PerspectiveCamera.js");
    vi.doUnmock("three/src/lights/AmbientLight.js");
    vi.doUnmock("three/src/lights/DirectionalLight.js");
    vi.doUnmock("three/src/renderers/WebGLRenderer.js");
    vi.doUnmock("three/src/objects/Group.js");
    vi.doUnmock("three/src/scenes/Scene.js");
    vi.resetModules();
  });

  test("uses Three.js objects on the default host path without requiring a real GPU in tests", async () => {
    const rendererDispose = vi.fn();
    const rendererSetClearAlpha = vi.fn();
    const rendererSetViewport = vi.fn();
    const rendererSetScissor = vi.fn();
    const rendererSetScissorTest = vi.fn();
    const scene = { kind: "scene" };
    const camera = { kind: "camera" };
    const renderer = {
      canvas: document.createElement("canvas"),
      autoClear: true,
      setClearAlpha: rendererSetClearAlpha,
      setViewport: rendererSetViewport,
      setScissor: rendererSetScissor,
      setScissorTest: rendererSetScissorTest,
      dispose: rendererDispose,
    };
    const WebGLRenderer = vi.fn(
      (options: { canvas: HTMLCanvasElement }): ThreeRendererAdapter => {
        renderer.canvas = options.canvas;
        return renderer;
      },
    );
    const Scene = vi.fn(() => scene);
    const OrthographicCamera = vi.fn(() => camera);

    vi.doMock("three/src/cameras/OrthographicCamera.js", () => ({
      OrthographicCamera,
    }));
    vi.doMock("three/src/renderers/WebGLRenderer.js", () => ({
      WebGLRenderer,
    }));
    vi.doMock("three/src/scenes/Scene.js", () => ({ Scene }));

    const { createThreeRendererHost } = await import("../../../src/lib/renderer/threeRenderer");
    const container = document.createElement("div");

    const host = createThreeRendererHost(container);

    expect(WebGLRenderer).toHaveBeenCalledTimes(1);
    expect(WebGLRenderer).toHaveBeenCalledWith({
      antialias: false,
      alpha: true,
      powerPreference: "high-performance",
      canvas: host.canvas,
    });
    expect(rendererSetClearAlpha).toHaveBeenCalledWith(0);
    expect(renderer.autoClear).toBe(false);
    expect(Scene).toHaveBeenCalledTimes(1);
    expect(OrthographicCamera).toHaveBeenCalledWith(0, 800, 600, 0, 0.1, 1000);
    expect(host.scene).toBe(scene);
    expect(host.camera).toBe(camera);
    expect(host.sceneAdapter).toEqual(expect.any(Object));
    expect(host.renderer.setViewport).toEqual(expect.any(Function));
    expect(host.renderer.setScissor).toEqual(expect.any(Function));
    expect(host.renderer.setScissorTest).toEqual(expect.any(Function));
    host.renderer.setViewport?.(20, 30, 320, 180);
    host.renderer.setScissor?.(20, 30, 320, 180);
    host.renderer.setScissorTest?.(true);
    host.sceneAdapter.render();

    host.dispose();
    host.dispose();

    expect(rendererSetViewport).toHaveBeenCalledWith(20, 30, 320, 180);
    expect(rendererSetScissor).toHaveBeenCalledWith(20, 30, 320, 180);
    expect(rendererSetScissorTest).toHaveBeenCalledWith(true);
    expect(rendererDispose).toHaveBeenCalledTimes(1);
    expect(container.querySelector("canvas")).toBeNull();
  });

  test("creates and appends exactly one canvas for one injected renderer host", async () => {
    const { createThreeRendererHost } = await import("../../../src/lib/renderer/threeRenderer");
    const container = document.createElement("div");
    const rendererDispose = vi.fn();
    const scene = {};
    const camera = {};
    const createObjects = vi.fn(
      (canvas: HTMLCanvasElement) => ({
        camera,
        canvas,
        renderer: {
          canvas,
          dispose: rendererDispose,
        },
        scene,
      }),
    );
    const createElement = vi.spyOn(document, "createElement");

    const host = createThreeRendererHost(container, { createObjects });

    expect(createObjects).toHaveBeenCalledTimes(1);
    expect(createObjects).toHaveBeenCalledWith(host.canvas);
    expect(host.scene).toBe(scene);
    expect(host.camera).toBe(camera);
    expect(host.sceneAdapter).toEqual(expect.any(Object));
    expect(canvasCreateCalls(createElement)).toHaveLength(1);
    expect(container.querySelectorAll("canvas")).toHaveLength(1);
    expect(container.querySelector("canvas")).toBe(host.canvas);

    host.dispose();
    host.dispose();

    expect(rendererDispose).toHaveBeenCalledTimes(1);
    expect(container.querySelector("canvas")).toBeNull();
  });

  test("reports stable renderer summary stats from the host adapter", async () => {
    const { createThreeRendererHost } = await import("../../../src/lib/renderer/threeRenderer");
    const container = document.createElement("div");
    const canvas = document.createElement("canvas");
    const renderer = {
      canvas,
      info: {
        render: { calls: 4, triangles: 12 },
        memory: { geometries: 2, textures: 5 },
        programs: [{}, {}],
      },
      dispose: vi.fn(),
    } as unknown as ThreeRendererAdapter;
    const host = createThreeRendererHost(container, {
      createObjects: () => ({
        camera: {},
        renderer,
        scene: {},
      }),
    });

    expect(host.readRendererStats()).toMatchObject({
      drawCalls: 4,
      triangles: 12,
      geometries: 2,
      textures: 5,
      programs: 2,
    });

    host.dispose();
  });

  test("uses managed bounds hit testing even when mesh raycast returns no intersections", async () => {
    const { PerspectiveCamera } = await import("three/src/cameras/PerspectiveCamera.js");
    const { BoxGeometry } = await import("three/src/geometries/BoxGeometry.js");
    const { MeshBasicMaterial } = await import("three/src/materials/MeshBasicMaterial.js");
    const { Mesh } = await import("three/src/objects/Mesh.js");
    const { Scene } = await import("three/src/scenes/Scene.js");
    const { createThreeRendererHost } = await import("../../../src/lib/renderer/threeRenderer");
    const container = document.createElement("div");
    const scene = new Scene();
    const camera = new PerspectiveCamera(42, 800 / 600, 0.1, 1000);
    const mesh = new Mesh(new BoxGeometry(2, 2, 2), new MeshBasicMaterial());

    mesh.raycast = () => {};
    camera.position.set(0, 0, 10);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    scene.add(mesh);

    const host = createThreeRendererHost(container, {
      createObjects(canvas) {
        return {
          camera,
          renderer: {
            canvas,
            setPixelRatio() {},
            setSize() {},
            setClearAlpha() {},
            dispose() {},
          },
          scene,
        };
      },
    });
    const candidate = {
      id: "example.model",
      sceneId: "example.scene",
      sourceKind: "model/glb",
      object3D: mesh,
      hitTest: "bounds",
      pickable: true,
      pointer: { hover: true, press: true, click: true, drag: true },
    } satisfies ManagedHitCandidate;
    const pickManagedObjects = host.pickManagedObjects;
    expect(pickManagedObjects).toEqual(expect.any(Function));
    if (!pickManagedObjects) {
      throw new Error("Expected managed picking to be available.");
    }

    expect(
      pickManagedObjects(
        {
          id: "example.pass",
          sceneId: "example.scene",
          order: 0,
          camera,
          viewport: { x: 0, y: 0, width: 800, height: 600 },
        },
        [candidate],
        createManagedPickingPointer(),
      ),
    ).toMatchObject({
      id: "example.model",
      sceneId: "example.scene",
      distance: 9,
    });

    host.dispose();
  });

  test("adds low-cost default lights to the default scene for lit model materials", async () => {
    const rendererDispose = vi.fn();
    const rendererSetClearAlpha = vi.fn();
    const sceneAdd = vi.fn();
    const scene = { add: sceneAdd };
    const camera = { kind: "camera" };
    const ambientLight = { kind: "ambient-light" };
    const directionalLight = {
      kind: "directional-light",
      position: { set: vi.fn() },
    };
    const WebGLRenderer = vi.fn(
      (options: { canvas: HTMLCanvasElement }): ThreeRendererAdapter => ({
        canvas: options.canvas,
        setClearAlpha: rendererSetClearAlpha,
        dispose: rendererDispose,
      }),
    );
    const Scene = vi.fn(() => scene);
    const OrthographicCamera = vi.fn(() => camera);
    const AmbientLight = vi.fn(() => ambientLight);
    const DirectionalLight = vi.fn(() => directionalLight);

    vi.doMock("three/src/cameras/OrthographicCamera.js", () => ({
      OrthographicCamera,
    }));
    vi.doMock("three/src/lights/AmbientLight.js", () => ({ AmbientLight }));
    vi.doMock("three/src/lights/DirectionalLight.js", () => ({
      DirectionalLight,
    }));
    vi.doMock("three/src/renderers/WebGLRenderer.js", () => ({
      WebGLRenderer,
    }));
    vi.doMock("three/src/scenes/Scene.js", () => ({ Scene }));

    const { createThreeRendererHost } = await import("../../../src/lib/renderer/threeRenderer");
    const container = document.createElement("div");

    const host = createThreeRendererHost(container);

    expect(AmbientLight).toHaveBeenCalledWith(0xffffff, 0.45);
    expect(DirectionalLight).toHaveBeenCalledWith(0xffffff, 1);
    expect(directionalLight.position.set).toHaveBeenCalledWith(1, 1.5, 2);
    expect(sceneAdd).toHaveBeenCalledWith(ambientLight);
    expect(sceneAdd).toHaveBeenCalledWith(directionalLight);

    host.dispose();
  });

  test("positions the renderer canvas below the DOM children as a fixed viewport stage layer", async () => {
    const { createThreeRendererHost } = await import("../../../src/lib/renderer/threeRenderer");
    const container = document.createElement("section");
    const existingChild = document.createElement("article");
    container.appendChild(existingChild);

    Object.defineProperties(container, {
      clientWidth: { configurable: true, value: 640 },
      clientHeight: { configurable: true, value: 360 },
    });

    const host = createThreeRendererHost(container, {
      createObjects: createRendererObjectsStub,
    });

    expect(container.style.position).toBe("relative");
    expect(host.canvas.style.position).toBe("fixed");
    expect(host.canvas.style.inset).toBe("0px");
    expect(host.canvas.style.width).toBe("100vw");
    expect(host.canvas.style.height).toBe("100vh");
    expect(host.canvas.style.pointerEvents).toBe("none");
    expect(host.canvas.style.display).toBe("block");
    expect(host.canvas.style.zIndex).toBe("0");
    expect(existingChild.style.position).toBe("relative");
    expect(existingChild.style.zIndex).toBe("1");
    expect(container.firstElementChild).toBe(host.canvas);
    expect(container.lastElementChild).toBe(existingChild);

    host.dispose();
  });

  test("restores direct DOM child stacking styles on dispose", async () => {
    const { createThreeRendererHost } = await import("../../../src/lib/renderer/threeRenderer");
    const container = document.createElement("section");
    const existingChild = document.createElement("article");
    existingChild.style.position = "relative";
    container.appendChild(existingChild);

    const host = createThreeRendererHost(container, {
      createObjects: createRendererObjectsStub,
    });

    expect(existingChild.style.position).toBe("relative");
    expect(existingChild.style.zIndex).toBe("1");

    host.dispose();

    expect(existingChild.style.position).toBe("relative");
    expect(existingChild.style.zIndex).toBe("");
  });

  test("configures the default camera and canvas for CSS-pixel scene coordinates", async () => {
    const rendererSetSize = vi.fn();
    const rendererDispose = vi.fn();
    const camera = {
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      position: { set: vi.fn() },
      updateProjectionMatrix: vi.fn(),
    };
    const WebGLRenderer = vi.fn(
      (options: { canvas: HTMLCanvasElement }): ThreeRendererAdapter => ({
        canvas: options.canvas,
        setSize: rendererSetSize,
        dispose: rendererDispose,
      } as ThreeRendererAdapter),
    );
    const Scene = vi.fn(() => ({}));
    const OrthographicCamera = vi.fn(() => camera);

    vi.doMock("three/src/cameras/OrthographicCamera.js", () => ({
      OrthographicCamera,
    }));
    vi.doMock("three/src/renderers/WebGLRenderer.js", () => ({
      WebGLRenderer,
    }));
    vi.doMock("three/src/scenes/Scene.js", () => ({ Scene }));

    const { createThreeRendererHost } = await import("../../../src/lib/renderer/threeRenderer");
    const container = document.createElement("div");

    Object.defineProperty(container, "clientWidth", {
      configurable: true,
      value: 1024,
    });
    Object.defineProperty(container, "clientHeight", {
      configurable: true,
      value: 768,
    });
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 1440,
    });
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: 900,
    });

    const host = createThreeRendererHost(container);

    expect(rendererSetSize).toHaveBeenCalledWith(1440, 900, false);
    expect(camera).toMatchObject({
      left: 0,
      right: 1440,
      top: 900,
      bottom: 0,
    });
    expect(camera.position.set).toHaveBeenCalledWith(0, 0, 500);
    expect(camera.updateProjectionMatrix).toHaveBeenCalledTimes(1);

    host.dispose();
  });

  test("resizes managed DOM-aligned scene cameras to the runtime viewport", async () => {
    const scene = { add: vi.fn() };
    const camera = {
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      position: { set: vi.fn() },
      updateProjectionMatrix: vi.fn(),
    };
    const Scene = vi.fn(() => scene);
    const OrthographicCamera = vi.fn(() => camera);

    vi.doMock("three/src/cameras/OrthographicCamera.js", () => ({
      OrthographicCamera,
    }));
    vi.doMock("three/src/scenes/Scene.js", () => ({ Scene }));

    const { createManagedDomAlignedSceneAdapter } = await import("../../../src/lib/renderer/threeRenderer");

    const managed = createManagedDomAlignedSceneAdapter({
      canvas: document.createElement("canvas"),
      render: vi.fn(),
      dispose: vi.fn(),
    });

    managed.resize({ width: 375, height: 812 });

    expect(OrthographicCamera).toHaveBeenCalledWith(0, 800, 600, 0, 0.1, 1000);
    expect(camera).toMatchObject({
      left: 0,
      right: 375,
      top: 812,
      bottom: 0,
    });
    expect(camera.position.set).toHaveBeenLastCalledWith(0, 0, 500);
    expect(camera.updateProjectionMatrix).toHaveBeenCalled();

    managed.dispose();
  });

  test("creates managed perspective cameras from declarations", async () => {
    const perspectiveCamera = {
      aspect: 0,
      position: { set: vi.fn() },
      lookAt: vi.fn(),
      updateProjectionMatrix: vi.fn(),
    };
    const PerspectiveCamera = vi.fn(() => perspectiveCamera);

    vi.doMock("three/src/cameras/PerspectiveCamera.js", () => ({
      PerspectiveCamera,
    }));

    const { createManagedCamera } = await import("../../../src/lib/renderer/threeRenderer");

    const managed = createManagedCamera({
      id: "world.camera",
      sceneId: "world",
      type: "perspective",
      mode: "perspective-stage",
      default: true,
      fov: 50,
      near: 0.1,
      far: 2000,
      position: [0, 0, 500],
      target: [0, 0, 0],
    });

    expect(PerspectiveCamera).toHaveBeenCalledWith(50, 1, 0.1, 2000);

    managed.resize({ width: 390, height: 844 });

    expect(perspectiveCamera.aspect).toBe(390 / 844);
    expect(perspectiveCamera.position.set).toHaveBeenLastCalledWith(0, 0, 500);
    expect(perspectiveCamera.lookAt).toHaveBeenLastCalledWith(0, 0, 0);
    expect(perspectiveCamera.updateProjectionMatrix).toHaveBeenCalled();
  });

  test("applies managed perspective camera framing without exposing raw camera handles", async () => {
    const perspectiveCamera = {
      aspect: 0,
      fov: 50,
      position: { set: vi.fn() },
      lookAt: vi.fn(),
      updateProjectionMatrix: vi.fn(),
    };
    const PerspectiveCamera = vi.fn(() => perspectiveCamera);

    vi.doMock("three/src/cameras/PerspectiveCamera.js", () => ({
      PerspectiveCamera,
    }));

    const { createManagedCamera } = await import("../../../src/lib/renderer/threeRenderer");

    const managed = createManagedCamera({
      id: "world.camera",
      sceneId: "world",
      type: "perspective",
      mode: "perspective-stage",
      default: true,
      fov: 50,
      near: 0.1,
      far: 2000,
      position: [0, 0, 500],
      target: [0, 0, 0],
    });

    managed.applyFraming(
      {
        position: [0, 120, 520],
        target: [0, 48, 0],
        fov: 34,
      },
      { width: 390, height: 844 },
    );

    expect(perspectiveCamera.aspect).toBe(390 / 844);
    expect(perspectiveCamera.position.set).toHaveBeenLastCalledWith(0, 120, 520);
    expect(perspectiveCamera.lookAt).toHaveBeenLastCalledWith(0, 48, 0);
    expect(perspectiveCamera.fov).toBe(34);
    expect(perspectiveCamera.updateProjectionMatrix).toHaveBeenCalled();
  });

  test("caps renderer pixel ratio at 1.5", async () => {
    const { createThreeRendererHost } = await import("../../../src/lib/renderer/threeRenderer");
    const setPixelRatio = vi.fn();
    const container = document.createElement("div");

    Object.defineProperty(window, "devicePixelRatio", {
      configurable: true,
      value: 3,
    });

    const host = createThreeRendererHost(container, {
      createObjects(canvas) {
        return {
          camera: {},
          renderer: {
            canvas,
            setPixelRatio,
            setSize: vi.fn(),
            render: vi.fn(),
            dispose: vi.fn(),
          },
          scene: {},
        };
      },
    });

    expect(setPixelRatio).toHaveBeenCalledWith(1.5);

    host.dispose();
  });

  test("resizes renderer camera and DPR when the viewport changes", async () => {
    const { createThreeRendererHost } = await import("../../../src/lib/renderer/threeRenderer");
    const setSize = vi.fn();
    const setPixelRatio = vi.fn();
    const camera = {
      position: { set: vi.fn() },
      updateProjectionMatrix: vi.fn(),
    };
    const container = document.createElement("div");

    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 800,
    });
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: 600,
    });
    Object.defineProperty(window, "devicePixelRatio", {
      configurable: true,
      value: 1,
    });

    const host = createThreeRendererHost(container, {
      createObjects(canvas) {
        return {
          camera,
          scene: {},
          renderer: {
            canvas,
            setSize,
            setPixelRatio,
            render: vi.fn(),
            dispose: vi.fn(),
          },
        };
      },
    });

    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 390,
    });
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: 844,
    });
    Object.defineProperty(window, "devicePixelRatio", {
      configurable: true,
      value: 3,
    });

    host.resizeIfNeeded();

    expect(setSize).toHaveBeenLastCalledWith(390, 844, false);
    expect(setPixelRatio).toHaveBeenLastCalledWith(1.5);
    expect(camera).toMatchObject({ left: 0, right: 390, top: 844, bottom: 0 });

    host.dispose();
  });

  test("uses the rendered fixed canvas box as the CSS-pixel scene viewport", async () => {
    const { createThreeRendererHost } = await import("../../../src/lib/renderer/threeRenderer");
    const setSize = vi.fn();
    const container = document.createElement("div");
    const originalCanvasRect = HTMLCanvasElement.prototype.getBoundingClientRect;

    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 1280,
    });
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: 720,
    });
    HTMLCanvasElement.prototype.getBoundingClientRect = vi.fn(
      () =>
        ({
          x: 0,
          y: 0,
          left: 0,
          top: 0,
          right: 1265,
          bottom: 720,
          width: 1265,
          height: 720,
          toJSON() {
            return {};
          },
        }) as DOMRect,
    );

    try {
      const host = createThreeRendererHost(container, {
        createObjects(canvas) {
          return {
            camera: {},
            scene: {},
            renderer: {
              canvas,
              setSize,
              dispose: vi.fn(),
            },
          };
        },
      });

      expect(host.getViewportSize()).toEqual({ width: 1265, height: 720 });
      expect(setSize).toHaveBeenCalledWith(1265, 720, false);

      host.dispose();
    } finally {
      HTMLCanvasElement.prototype.getBoundingClientRect = originalCanvasRect;
    }
  });

  test("reparents scene objects between the scene root and internal groups", async () => {
    const Group = vi.fn(() => createObject3D("group"));
    vi.doMock("three/src/objects/Group.js", () => ({ Group }));
    const { createThreeRendererHost } = await import("../../../src/lib/renderer/threeRenderer");
    const container = document.createElement("div");
    const scene = createObject3D("scene");
    const renderer = {
      canvas: document.createElement("canvas"),
      render: vi.fn(),
      dispose: vi.fn(),
    } satisfies ThreeRendererAdapter;
    const object3D = createObject3D("object");
    const sceneObject = createSceneObject("card", object3D);
    const host = createThreeRendererHost(container, {
      createObjects(canvas) {
        renderer.canvas = canvas;

        return {
          camera: {},
          renderer,
          scene,
        };
      },
    });

    host.sceneAdapter.addObject(sceneObject);
    host.sceneAdapter.addObject(sceneObject);
    const group = createRequiredGroup(host.sceneAdapter, "card");
    addRequiredGroup(host.sceneAdapter, group);
    addRequiredGroup(host.sceneAdapter, group);

    expect(scene.children).toEqual([object3D, group.object3D]);
    setRequiredObjectParent(host.sceneAdapter, sceneObject, group);
    expect(scene.children).toEqual([group.object3D]);
    expect(readChildren(group.object3D)).toEqual([object3D]);

    setRequiredObjectParent(host.sceneAdapter, sceneObject);
    setRequiredObjectParent(host.sceneAdapter, sceneObject);
    expect(scene.children).toEqual([group.object3D, object3D]);
    expect(readChildren(group.object3D)).toEqual([]);

    setRequiredObjectParent(host.sceneAdapter, sceneObject, group);
    host.sceneAdapter.removeObject(sceneObject);
    host.sceneAdapter.removeObject(sceneObject);
    expect(readChildren(group.object3D)).toEqual([]);

    removeRequiredGroup(host.sceneAdapter, group);
    removeRequiredGroup(host.sceneAdapter, group);
    expect(scene.children).toEqual([]);
    host.dispose();
  });

  test("reparents internal groups under other groups", async () => {
    vi.doMock("three/src/objects/Group.js", () => ({
      Group: vi.fn(() => createObject3D("group")),
    }));
    const { createThreeRendererHost } = await import("../../../src/lib/renderer/threeRenderer");
    const container = document.createElement("div");
    const scene = createObject3D("scene");
    const host = createThreeRendererHost(container, {
      createObjects(canvas) {
        return {
          camera: {},
          renderer: {
            canvas,
            render: vi.fn(),
            dispose: vi.fn(),
          },
          scene,
        };
      },
    });

    const parentGroup = createRequiredGroup(host.sceneAdapter, "card");
    const childGroup = createRequiredGroup(host.sceneAdapter, "card.media");
    addRequiredGroup(host.sceneAdapter, parentGroup);
    addRequiredGroup(host.sceneAdapter, childGroup);

    setRequiredGroupParent(host.sceneAdapter, childGroup, parentGroup);
    expect(scene.children).toEqual([parentGroup.object3D]);
    expect(readChildren(parentGroup.object3D)).toEqual([childGroup.object3D]);

    setRequiredGroupParent(host.sceneAdapter, childGroup);
    expect(scene.children).toEqual([parentGroup.object3D, childGroup.object3D]);
    expect(readChildren(parentGroup.object3D)).toEqual([]);
    host.dispose();
  });
});

describe("createWebGLRuntime renderer host", () => {
  test("mounts one canvas and repeated register/sync calls do not create more", async () => {
    const { createWebGLRuntime } = await import("../../../src/lib/renderer/runtime");
    const { createThreeRendererHost } = await import("../../../src/lib/renderer/threeRenderer");
    const container = document.createElement("div");
    const runtime = createWebGLRuntime({
      container,
      rendererHostFactory: (hostContainer) =>
        createThreeRendererHost(hostContainer, {
          createObjects: createRendererObjectsStub,
        }),
    } as RuntimeWithRendererHostFactory) as RuntimeWithTask23Surface;

    runtime.registerTarget(document.createElement("section"), { key: "hero" });
    runtime.sync();
    runtime.registerTarget(document.createElement("section"), { key: "details" });
    runtime.sync();

    expect(container.querySelectorAll("canvas")).toHaveLength(1);

    runtime.dispose();

    expect(container.querySelector("canvas")).toBeNull();
  });

  test("dispose releases tracked renderables once", async () => {
    const { createWebGLRuntime } = await import("../../../src/lib/renderer/runtime");
    const { createThreeRendererHost } = await import("../../../src/lib/renderer/threeRenderer");
    const container = document.createElement("div");
    const renderable = { dispose: vi.fn() };
    const runtime = createWebGLRuntime({
      container,
      rendererHostFactory: (hostContainer) =>
        createThreeRendererHost(hostContainer, {
          createObjects: createRendererObjectsStub,
        }),
      renderables: [renderable],
    } as RuntimeWithRendererHostFactory & RuntimeWithInternalRenderableSeed);

    runtime.dispose();
    runtime.dispose();

    expect(renderable.dispose).toHaveBeenCalledTimes(1);
    expect(container.querySelector("canvas")).toBeNull();
  });
});

function canvasCreateCalls(createElement: { mock: { calls: unknown[][] } }) {
  return createElement.mock.calls.filter(([tagName]) => tagName === "canvas");
}

function createManagedPickingPointer(): WebGLPointerState {
  return {
    x: 400,
    y: 300,
    normalizedX: 0,
    normalizedY: 0,
    isInside: true,
    isDown: false,
    downTime: 0,
    pressDuration: 0,
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0,
    dragDeltaX: 0,
    dragDeltaY: 0,
    clickCount: 0,
    buttons: [],
    modifiers: { shift: false, alt: false, ctrl: false, meta: false },
  };
}

type RuntimeWithRendererHostFactory = Parameters<typeof createWebGLRuntime>[0] & {
  rendererHostFactory?: (container: HTMLElement) => unknown;
};

function createRendererObjectsStub(canvas: HTMLCanvasElement) {
  return {
    camera: {},
    renderer: {
      canvas,
      render() {
        // Tests assert host/runtime ownership, not GPU behavior.
      },
      dispose() {
        // Tests assert host/runtime ownership, not GPU behavior.
      },
    },
    scene: {},
  };
}

type FakeObject3D = {
  kind: string;
  parent: FakeObject3D | undefined;
  children: FakeObject3D[];
  add(child: FakeObject3D): void;
  remove(child: FakeObject3D): void;
};

function createObject3D(kind: string): FakeObject3D {
  const object: FakeObject3D = {
    kind,
    parent: undefined,
    children: [],
    add(child) {
      child.parent?.remove(child);
      if (!object.children.includes(child)) {
        object.children.push(child);
      }
      child.parent = object;
    },
    remove(child) {
      object.children = object.children.filter((entry) => entry !== child);
      if (child.parent === object) {
        child.parent = undefined;
      }
    },
  };

  return object;
}

function createSceneObject(
  key: string,
  object3D: FakeObject3D,
): WebGLSceneObject {
  return {
    key,
    object3D,
    setVisible: vi.fn(),
    updateLayout: vi.fn(),
    dispose: vi.fn(),
  };
}

function createRequiredGroup(
  adapter: WebGLSceneAdapter,
  key: string,
): WebGLSceneGroup {
  const createGroup = adapter.createGroup;
  expect(createGroup).toEqual(expect.any(Function));
  if (!createGroup) throw new Error("Expected scene adapter createGroup.");
  return createGroup(key);
}

function addRequiredGroup(
  adapter: WebGLSceneAdapter,
  group: WebGLSceneGroup,
): void {
  const addGroup = adapter.addGroup;
  expect(addGroup).toEqual(expect.any(Function));
  if (!addGroup) throw new Error("Expected scene adapter addGroup.");
  addGroup(group);
}

function removeRequiredGroup(
  adapter: WebGLSceneAdapter,
  group: WebGLSceneGroup,
): void {
  const removeGroup = adapter.removeGroup;
  expect(removeGroup).toEqual(expect.any(Function));
  if (!removeGroup) throw new Error("Expected scene adapter removeGroup.");
  removeGroup(group);
}

function setRequiredObjectParent(
  adapter: WebGLSceneAdapter,
  object: WebGLSceneObject,
  parent?: WebGLSceneGroup,
): void {
  const setObjectParent = adapter.setObjectParent;
  expect(setObjectParent).toEqual(expect.any(Function));
  if (!setObjectParent) {
    throw new Error("Expected scene adapter setObjectParent.");
  }
  setObjectParent(object, parent);
}

function setRequiredGroupParent(
  adapter: WebGLSceneAdapter,
  group: WebGLSceneGroup,
  parent?: WebGLSceneGroup,
): void {
  const setGroupParent = adapter.setGroupParent;
  expect(setGroupParent).toEqual(expect.any(Function));
  if (!setGroupParent) throw new Error("Expected scene adapter setGroupParent.");
  setGroupParent(group, parent);
}

function readChildren(object3D: unknown): FakeObject3D[] {
  return (object3D as { children: FakeObject3D[] }).children;
}
