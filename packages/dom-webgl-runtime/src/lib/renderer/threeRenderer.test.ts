import { afterEach, describe, expect, test, vi } from "vitest";

import type { WebGLDeclaration } from "../types";
import type { createWebGLRuntime, WebGLRuntime } from "./runtime";
import type { ThreeRendererAdapter } from "./threeRenderer";

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
    vi.doUnmock("three/src/renderers/WebGLRenderer.js");
    vi.doUnmock("three/src/scenes/Scene.js");
    vi.resetModules();
  });

  test("uses Three.js objects on the default host path without requiring a real GPU in tests", async () => {
    const rendererDispose = vi.fn();
    const scene = { kind: "scene" };
    const camera = { kind: "camera" };
    const WebGLRenderer = vi.fn(
      (options: { canvas: HTMLCanvasElement }): ThreeRendererAdapter => ({
        canvas: options.canvas,
        dispose: rendererDispose,
      }),
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

    const { createThreeRendererHost } = await import("./threeRenderer");
    const container = document.createElement("div");

    const host = createThreeRendererHost(container);

    expect(WebGLRenderer).toHaveBeenCalledTimes(1);
    expect(WebGLRenderer).toHaveBeenCalledWith({
      antialias: false,
      alpha: true,
      powerPreference: "high-performance",
      canvas: host.canvas,
    });
    expect(Scene).toHaveBeenCalledTimes(1);
    expect(OrthographicCamera).toHaveBeenCalledWith(0, 800, 600, 0, 0.1, 1000);
    expect(host.scene).toBe(scene);
    expect(host.camera).toBe(camera);
    expect(host.sceneAdapter).toEqual(expect.any(Object));
    host.sceneAdapter.render();

    host.dispose();
    host.dispose();

    expect(rendererDispose).toHaveBeenCalledTimes(1);
    expect(container.querySelector("canvas")).toBeNull();
  });

  test("creates and appends exactly one canvas for one injected renderer host", async () => {
    const { createThreeRendererHost } = await import("./threeRenderer");
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

  test("positions the renderer canvas as a fixed viewport stage layer", async () => {
    const { createThreeRendererHost } = await import("./threeRenderer");
    const container = document.createElement("section");

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

    host.dispose();
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

    const { createThreeRendererHost } = await import("./threeRenderer");
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

  test("caps renderer pixel ratio at 1.5", async () => {
    const { createThreeRendererHost } = await import("./threeRenderer");
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
});

describe("createWebGLRuntime renderer host", () => {
  test("mounts one canvas and repeated register/sync calls do not create more", async () => {
    const { createWebGLRuntime } = await import("./runtime");
    const { createThreeRendererHost } = await import("./threeRenderer");
    const container = document.createElement("div");
    const createElement = vi.spyOn(document, "createElement");
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

    expect(canvasCreateCalls(createElement)).toHaveLength(1);
    expect(container.querySelectorAll("canvas")).toHaveLength(1);

    runtime.dispose();

    expect(container.querySelector("canvas")).toBeNull();
  });

  test("dispose releases tracked renderables once", async () => {
    const { createWebGLRuntime } = await import("./runtime");
    const { createThreeRendererHost } = await import("./threeRenderer");
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
