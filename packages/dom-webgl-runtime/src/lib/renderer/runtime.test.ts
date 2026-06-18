import { afterEach, describe, expect, test, vi } from "vitest";

import type { Renderable } from "../render/renderable";
import type { WebGLSceneAdapter } from "./sceneObject";
import type { createWebGLRuntime, WebGLRuntime } from "./runtime";
import type { ThreeRendererHost } from "./threeRenderer";

const guardedBrowserGlobals = [
  "window",
  "document",
  "HTMLElement",
  "HTMLCanvasElement",
  "HTMLImageElement",
  "HTMLMediaElement",
  "HTMLVideoElement",
  "Image",
  "DOMRect",
  "ResizeObserver",
  "requestAnimationFrame",
  "WebGLRenderingContext",
] as const;

type RuntimePublicApi = {
  createWebGLRuntime?: (options: { container: HTMLElement }) => {
    container: HTMLElement;
    dispose(): void;
  };
};

type ReactPublicApi = {
  WebGLRuntime?: unknown;
  WebGLTarget?: unknown;
  useWebGLRuntime?: unknown;
};

type RuntimeInternalTestOptions = Parameters<typeof createWebGLRuntime>[0] & {
  rendererHostFactory?: (container: HTMLElement) => ThreeRendererHost;
  onRenderableCreated?: (renderable: Renderable) => void;
};

describe("createWebGLRuntime", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.doUnmock("three/src/cameras/PerspectiveCamera.js");
    vi.doUnmock("three/src/renderers/WebGLRenderer.js");
    vi.doUnmock("three/src/scenes/Scene.js");
    vi.unstubAllGlobals();
    document.documentElement.style.overflow = "";
    vi.resetModules();
  });

  test("imports the public runtime API without touching browser globals", async () => {
    vi.resetModules();

    const restoreBrowserGlobals = installThrowingBrowserGlobalGetters();
    let runtimeApi: RuntimePublicApi | undefined;

    try {
      runtimeApi = (await import("../../index")) as RuntimePublicApi;
    } finally {
      restoreBrowserGlobals();
    }

    expect(runtimeApi?.createWebGLRuntime).toEqual(expect.any(Function));
  });

  test("imports the public React API without touching browser globals", async () => {
    vi.resetModules();

    const restoreBrowserGlobals = installThrowingBrowserGlobalGetters();
    let reactApi: ReactPublicApi | undefined;

    try {
      reactApi = (await import("../../react")) as ReactPublicApi;
    } finally {
      restoreBrowserGlobals();
    }

    expect(reactApi?.WebGLRuntime).toEqual(expect.any(Function));
    expect(reactApi?.WebGLTarget).toEqual(expect.any(Function));
    expect(reactApi?.useWebGLRuntime).toEqual(expect.any(Function));
  });

  test("throws a clear error when runtime creation executes without a DOM", async () => {
    const runtimeApi = (await import("../../index")) as RuntimePublicApi;

    vi.stubGlobal("window", undefined);
    vi.stubGlobal("document", undefined);
    vi.stubGlobal("HTMLElement", undefined);

    expect(() =>
      runtimeApi.createWebGLRuntime?.({ container: {} as HTMLElement }),
    ).toThrow(/createWebGLRuntime requires a browser DOM/i);
  });

  test("creates and disposes a runtime-owned canvas only when runtime creation executes", async () => {
    const { rendererDispose } = installThreeRendererModuleMocks();
    const runtimeApi = (await import("../../index")) as RuntimePublicApi;
    const container = document.createElement("div");
    const createElement = vi.spyOn(document, "createElement");

    const runtime = runtimeApi.createWebGLRuntime?.({ container });

    expect(runtime?.container).toBe(container);
    expect(createElement).toHaveBeenCalledWith("canvas");
    expect(container.querySelectorAll("canvas")).toHaveLength(1);
    expect(runtime?.dispose()).toBeUndefined();
    expect(rendererDispose).toHaveBeenCalledTimes(1);
    expect(container.querySelector("canvas")).toBeNull();
  });

  test("runtime dispose releases an active gate scroll lock", async () => {
    const scrollMetrics = installRuntimeScrollMetrics();
    const runtime = await createRuntimeForCleanupTest();
    const gate = registerRuntimeGate(runtime);

    await enterRuntimeGate(runtime, gate, scrollMetrics);
    expect(document.documentElement.style.overflow).toBe("hidden");

    runtime.dispose();
    runtime.dispose();

    expect(document.documentElement.style.overflow).toBe("");
  });

  test("visibility hidden releases an active gate scroll lock", async () => {
    const visibilityState = vi
      .spyOn(document, "visibilityState", "get")
      .mockReturnValue("visible");
    const scrollMetrics = installRuntimeScrollMetrics();
    const runtime = await createRuntimeForCleanupTest();
    const gate = registerRuntimeGate(runtime);

    await enterRuntimeGate(runtime, gate, scrollMetrics);
    expect(document.documentElement.style.overflow).toBe("hidden");

    visibilityState.mockReturnValue("hidden");
    document.dispatchEvent(new Event("visibilitychange"));

    expect(document.documentElement.style.overflow).toBe("");
    expect(runtime.getDebugState().currentScrollMode).toBe("page");

    runtime.dispose();
  });

  test("renderable update errors release active gate scroll lock before rethrow", async () => {
    const updateError = new Error("renderable update failed");
    const scrollMetrics = installRuntimeScrollMetrics();
    const runtime = await createRuntimeForCleanupTest({
      onRenderableCreated(renderable) {
        renderable.update = () => {
          throw updateError;
        };
      },
    });
    const gate = registerRuntimeGate(runtime);

    scrollMetrics.setScrollY(80);
    gate.setTop(0);

    expect(() => runtime.sync()).toThrow(updateError);
    expect(document.documentElement.style.overflow).toBe("");
    expect(runtime.getDebugState()).toMatchObject({
      currentScrollMode: "page",
      targets: [
        expect.objectContaining({
          key: "hero.scene",
          resourceStatus: "error",
          error: "renderable update failed",
        }),
      ],
    });

    runtime.dispose();
  });

  test("keeps fallback DOM visible until a ready renderable has a scene object", async () => {
    let visuallyReady = false;
    const runtime = await createRuntimeForCleanupTest({
      onRenderableCreated(renderable) {
        Object.defineProperty(renderable, "sceneObjectController", {
          configurable: true,
          get: () => ({
            attached: visuallyReady,
          }),
        });
      },
    });
    const element = document.createElement("section");

    runtime.registerTarget(element, {
      key: "hero.surface",
      lifecycle: { hideWhenReady: true, hideMode: "subtree" },
    });

    expect(element.style.visibility).toBe("");

    await runtime.sync();
    expect(element.style.visibility).toBe("");

    visuallyReady = true;
    await runtime.sync();
    expect(element.style.visibility).toBe("hidden");

    runtime.dispose();
    expect(element.style.visibility).toBe("");
  });

  test("restores fallback DOM on unregister and renderable errors keep DOM visible", async () => {
    let shouldThrow = false;
    const runtime = await createRuntimeForCleanupTest({
      onRenderableCreated(renderable) {
        Object.defineProperty(renderable, "sceneObjectController", {
          configurable: true,
          get: () => ({
            attached: true,
          }),
        });
        const originalUpdate = renderable.update.bind(renderable);

        renderable.update = (input) => {
          if (shouldThrow) {
            throw new Error("render failed");
          }

          return originalUpdate(input);
        };
      },
    });
    const element = document.createElement("section");

    runtime.registerTarget(element, {
      key: "hero.surface",
      lifecycle: { hideWhenReady: true, hideMode: "subtree" },
    });

    await runtime.sync();
    expect(element.style.visibility).toBe("hidden");

    runtime.unregisterTarget("hero.surface");
    expect(element.style.visibility).toBe("");

    const failingElement = document.createElement("section");
    runtime.registerTarget(failingElement, {
      key: "hero.error",
      lifecycle: { hideWhenReady: true, hideMode: "subtree" },
    });
    shouldThrow = true;

    expect(() => runtime.sync()).toThrow("render failed");
    expect(failingElement.style.visibility).toBe("");

    runtime.dispose();
  });

  test("runtime cleanup is idempotent across visibility hidden unregister and dispose", async () => {
    const visibilityState = vi
      .spyOn(document, "visibilityState", "get")
      .mockReturnValue("visible");
    const scrollMetrics = installRuntimeScrollMetrics();
    const runtime = await createRuntimeForCleanupTest();
    const gate = registerRuntimeGate(runtime);

    await enterRuntimeGate(runtime, gate, scrollMetrics);
    expect(document.documentElement.style.overflow).toBe("hidden");

    visibilityState.mockReturnValue("hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    runtime.unregisterTarget("hero.scene");
    runtime.dispose();
    runtime.dispose();
    document.dispatchEvent(new Event("visibilitychange"));

    expect(document.documentElement.style.overflow).toBe("");
  });

  test("sync renders the scene after synchronous visible updates", async () => {
    const sceneAdapter = createRecordingSceneAdapter();
    const runtime = await createRuntimeForCleanupTest({
      rendererHostFactory: (container) =>
        createRendererHostStub(container, sceneAdapter),
    });

    runtime.registerTarget(document.createElement("section"), { key: "hero" });

    await runtime.sync();

    expect(sceneAdapter.render).toHaveBeenCalledTimes(1);

    await runtime.sync();

    expect(sceneAdapter.render).toHaveBeenCalledTimes(2);

    runtime.dispose();
  });

  test("disposed runtime does not render the scene again", async () => {
    const sceneAdapter = createRecordingSceneAdapter();
    const runtime = await createRuntimeForCleanupTest({
      rendererHostFactory: (container) =>
        createRendererHostStub(container, sceneAdapter),
    });

    runtime.registerTarget(document.createElement("section"), { key: "hero" });
    await runtime.sync();

    runtime.dispose();
    runtime.sync();

    expect(sceneAdapter.render).toHaveBeenCalledTimes(1);
  });
});

function installThreeRendererModuleMocks() {
  const rendererDispose = vi.fn();

  vi.doMock("three/src/cameras/PerspectiveCamera.js", () => ({
    PerspectiveCamera: vi.fn(() => ({})),
  }));
  vi.doMock("three/src/renderers/WebGLRenderer.js", () => ({
    WebGLRenderer: vi.fn(() => ({
      dispose: rendererDispose,
    })),
  }));
  vi.doMock("three/src/scenes/Scene.js", () => ({
    Scene: vi.fn(() => ({})),
  }));

  return { rendererDispose };
}

async function createRuntimeForCleanupTest(
  options: Omit<RuntimeInternalTestOptions, "container"> = {},
): Promise<WebGLRuntime> {
  const { createWebGLRuntime } = await import("./runtime");
  const container = document.createElement("div");

  return createWebGLRuntime({
    container,
    rendererHostFactory: createRendererHostStub,
    ...options,
  } as RuntimeInternalTestOptions);
}

function createRendererHostStub(
  container: HTMLElement,
  sceneAdapter: WebGLSceneAdapter = createRecordingSceneAdapter(),
): ThreeRendererHost {
  const canvas = container.ownerDocument.createElement("canvas");

  container.appendChild(canvas);

  return {
    canvas,
    camera: {},
    renderer: {
      canvas,
      render() {
        // Tests cover runtime cleanup without a real WebGL context.
      },
      dispose() {
        // Tests cover runtime cleanup without a real WebGL context.
      },
    },
    scene: {},
    sceneAdapter,
    getViewportSize() {
      return { width: 800, height: 600 };
    },
    resizeIfNeeded() {
      return;
    },
    dispose() {
      canvas.remove();
    },
  };
}

function createRecordingSceneAdapter(): WebGLSceneAdapter & {
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

function installRuntimeScrollMetrics(): { setScrollY(scrollY: number): void } {
  let scrollY = 0;

  vi.spyOn(window, "scrollY", "get").mockImplementation(() => scrollY);

  return {
    setScrollY(nextScrollY: number): void {
      scrollY = nextScrollY;
    },
  };
}

function registerRuntimeGate(runtime: WebGLRuntime): {
  setTop(top: number): void;
} {
  const element = document.createElement("section");
  let top = 80;

  element.getBoundingClientRect = vi.fn(() => createDOMRect(top));
  runtime.registerTarget(element, {
    key: "hero.scene",
    scroll: {
      type: "gate",
      start: "top top",
      duration: 1,
    },
  });

  return {
    setTop(nextTop: number): void {
      top = nextTop;
    },
  };
}

async function enterRuntimeGate(
  runtime: WebGLRuntime,
  gate: { setTop(top: number): void },
  scrollMetrics: { setScrollY(scrollY: number): void },
): Promise<void> {
  scrollMetrics.setScrollY(80);
  gate.setTop(0);
  await runtime.sync();
}

function createDOMRect(top: number): DOMRect {
  return {
    x: 0,
    y: top,
    width: 100,
    height: 100,
    top,
    right: 100,
    bottom: top + 100,
    left: 0,
    toJSON() {
      return {
        x: 0,
        y: top,
        width: 100,
        height: 100,
        top,
        right: 100,
        bottom: top + 100,
        left: 0,
      };
    },
  } as DOMRect;
}

function installThrowingBrowserGlobalGetters(): () => void {
  const originalDescriptors = guardedBrowserGlobals.map(
    (name) =>
      [
        name,
        Object.getOwnPropertyDescriptor(globalThis, name),
      ] as const,
  );

  for (const name of guardedBrowserGlobals) {
    Object.defineProperty(globalThis, name, {
      configurable: true,
      get() {
        throw new Error(
          `Browser global ${name} was accessed during public runtime import.`,
        );
      },
    });
  }

  return () => {
    for (const [name, descriptor] of originalDescriptors) {
      if (descriptor) {
        Object.defineProperty(globalThis, name, descriptor);
      } else {
        delete globalThis[name];
      }
    }
  };
}
