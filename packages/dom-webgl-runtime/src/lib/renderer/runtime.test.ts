import { afterEach, describe, expect, test, vi } from "vitest";

const guardedBrowserGlobals = [
  "window",
  "document",
  "HTMLElement",
  "HTMLCanvasElement",
  "WebGLRenderingContext",
] as const;

type RuntimePublicApi = {
  createWebGLRuntime?: (options: { container: HTMLElement }) => {
    container: HTMLElement;
    dispose(): void;
  };
};

describe("createWebGLRuntime", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.doUnmock("three/src/cameras/PerspectiveCamera.js");
    vi.doUnmock("three/src/renderers/WebGLRenderer.js");
    vi.doUnmock("three/src/scenes/Scene.js");
    vi.unstubAllGlobals();
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
