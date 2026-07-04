import { act, createElement, useLayoutEffect, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type {
  WebGLRuntime as RuntimeInstance,
  WebGLRuntimeOptions,
} from "../../../src/lib/renderer/runtime";

const runtimeMocks = vi.hoisted(() => ({
  createWebGLRuntime: vi.fn(),
}));

vi.mock("../../../src/lib/renderer/runtime", () => ({
  createWebGLRuntime: runtimeMocks.createWebGLRuntime,
}));

const roots: Root[] = [];

describe("WebGLRuntime", () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
    runtimeMocks.createWebGLRuntime.mockReset();
    runtimeMocks.createWebGLRuntime.mockImplementation(
      (options: WebGLRuntimeOptions) => createRuntimeStub(options.container),
    );
  });

  afterEach(() => {
    for (const root of roots.splice(0)) {
      act(() => {
        root.unmount();
      });
    }
    document.body.replaceChildren();
  });

  test("does not create a runtime at module import time", async () => {
    const reactEntrypoint = await import("../../../src/react");

    expect(reactEntrypoint.WebGLRuntime).toBeTypeOf("function");
    expect(runtimeMocks.createWebGLRuntime).not.toHaveBeenCalled();
  });

  test("preserves ordinary DOM targets before the runtime is ready", async () => {
    const { WebGLRuntime, WebGLTarget } = await import("../../../src/react");

    const markup = renderToStaticMarkup(
      createElement(
        WebGLRuntime,
        null,
        createElement(
          WebGLTarget,
          {
            as: "section",
            webgl: { key: "hero.ssr" },
            id: "ssr-target",
          },
          "SSR fallback target",
        ),
      ),
    );

    expect(markup).toContain("ssr-target");
    expect(markup).toContain("SSR fallback target");
    expect(runtimeMocks.createWebGLRuntime).not.toHaveBeenCalled();
  });

  test("creates a runtime after mount and passes runtime events", async () => {
    const { WebGLRuntime } = await import("../../../src/react");
    const { root, host } = createTestRoot();
    const onDebugStateChange = vi.fn();

    await act(async () => {
      root.render(
        createElement(
          WebGLRuntime,
          { onDebugStateChange },
          createElement("span", { "data-runtime-child": true }, "child"),
        ),
      );
    });

    expect(runtimeMocks.createWebGLRuntime).toHaveBeenCalledTimes(1);
    expect(runtimeMocks.createWebGLRuntime).toHaveBeenCalledWith({
      container: host.firstElementChild,
      onDebugStateChange: expect.any(Function),
    });
    runtimeMocks.createWebGLRuntime.mock.calls[0][0].onDebugStateChange?.(
      createEmptyDebugState(),
    );
    expect(onDebugStateChange).toHaveBeenCalledTimes(1);
    expect(host.querySelector("[data-runtime-child]")?.textContent).toBe("child");
  });

  test("keeps DOM fallback mounted when WebGL runtime creation fails", async () => {
    const { WebGLRuntime } = await import("../../../src/react");
    const { root, host } = createTestRoot();
    const onDebugStateChange = vi.fn();
    const error = new Error("Error creating WebGL context.");

    runtimeMocks.createWebGLRuntime.mockImplementation(() => {
      throw error;
    });

    await act(async () => {
      expect(() => {
        root.render(
          createElement(
            WebGLRuntime,
            { onDebugStateChange },
            createElement("span", { "data-runtime-child": true }, "child"),
          ),
        );
      }).not.toThrow();
    });

    expect(runtimeMocks.createWebGLRuntime).toHaveBeenCalledTimes(1);
    expect(host.querySelector("[data-runtime-child]")?.textContent).toBe("child");
    expect(onDebugStateChange).toHaveBeenCalledWith(
      expect.objectContaining({
        targetCount: 0,
        renderableCount: 0,
        targets: [
          expect.objectContaining({
            key: "runtime",
            lifecycleState: "error",
            resourceStatus: "error",
            error: "Error creating WebGL context.",
          }),
        ],
      }),
    );
  });

  test("passes effect definitions to the runtime on mount", async () => {
    const { WebGLRuntime } = await import("../../../src/react");
    const { root } = createTestRoot();
    const effects = createTestEffects();

    await act(async () => {
      root.render(createElement(WebGLRuntime, { effects }));
    });

    expect(runtimeMocks.createWebGLRuntime).toHaveBeenCalledTimes(1);
    expect(runtimeMocks.createWebGLRuntime).toHaveBeenCalledWith(
      expect.objectContaining({
        effects,
      }),
    );
  });

  test("passes a scroll adapter to the runtime on mount", async () => {
    const { WebGLRuntime } = await import("../../../src/react");
    const { root } = createTestRoot();
    const scrollAdapter = createTestScrollAdapter();

    await act(async () => {
      root.render(createElement(WebGLRuntime, { scrollAdapter }));
    });

    expect(runtimeMocks.createWebGLRuntime).toHaveBeenCalledTimes(1);
    expect(runtimeMocks.createWebGLRuntime).toHaveBeenCalledWith(
      expect.objectContaining({
        scrollAdapter,
      }),
    );
  });

  test("passes progress signals to the runtime on mount", async () => {
    const { WebGLRuntime } = await import("../../../src/react");
    const { root } = createTestRoot();
    const progressSignals = createTestProgressSignals();

    await act(async () => {
      root.render(createElement(WebGLRuntime, { progressSignals }));
    });

    expect(runtimeMocks.createWebGLRuntime).toHaveBeenCalledTimes(1);
    expect(runtimeMocks.createWebGLRuntime).toHaveBeenCalledWith(
      expect.objectContaining({
        progressSignals,
      }),
    );
  });

  test("recreates the runtime when progress signals change", async () => {
    const { WebGLRuntime } = await import("../../../src/react");
    const { root } = createTestRoot();
    const firstProgressSignals = createTestProgressSignals(0.25);
    const secondProgressSignals = createTestProgressSignals(0.75);

    await act(async () => {
      root.render(createElement(WebGLRuntime, { progressSignals: firstProgressSignals }));
    });

    const firstRuntime = runtimeMocks.createWebGLRuntime.mock.results[0]
      .value as RuntimeInstance;

    await act(async () => {
      root.render(createElement(WebGLRuntime, { progressSignals: secondProgressSignals }));
    });
    await flushRuntimeDisposal();

    expect(runtimeMocks.createWebGLRuntime).toHaveBeenCalledTimes(2);
    expect(firstRuntime.dispose).toHaveBeenCalledTimes(1);
    expect(runtimeMocks.createWebGLRuntime.mock.calls[1][0]).toEqual(
      expect.objectContaining({
        progressSignals: secondProgressSignals,
      }),
    );
  });

  test("recreates the runtime when effect definitions change", async () => {
    const { WebGLRuntime } = await import("../../../src/react");
    const { root } = createTestRoot();
    const firstEffects = createTestEffects();
    const secondEffects = createTestEffects("custom.second");

    await act(async () => {
      root.render(createElement(WebGLRuntime, { effects: firstEffects }));
    });

    const firstRuntime = runtimeMocks.createWebGLRuntime.mock.results[0]
      .value as RuntimeInstance;

    await act(async () => {
      root.render(createElement(WebGLRuntime, { effects: secondEffects }));
    });
    await flushRuntimeDisposal();

    expect(runtimeMocks.createWebGLRuntime).toHaveBeenCalledTimes(2);
    expect(firstRuntime.dispose).toHaveBeenCalledTimes(1);
    expect(runtimeMocks.createWebGLRuntime.mock.calls[1][0]).toEqual(
      expect.objectContaining({
        effects: secondEffects,
      }),
    );
  });

  test("keeps React children above the canvas across runtime replacement", async () => {
    const { WebGLRuntime } = await import("../../../src/react");
    const { root } = createTestRoot();
    const effectsA = [] as const;
    const effectsB = [] as const;

    await act(async () => {
      root.render(
        createElement(
          WebGLRuntime,
          { effects: effectsA },
          createElement("main", { "data-testid": "content" }, "DOM content"),
        ),
      );
    });

    const content = document.querySelector(
      "[data-testid='content']",
    ) as HTMLElement;
    const contentLayer = content.parentElement as HTMLElement;
    const runtimeRoot = contentLayer.parentElement as HTMLElement;
    const canvas = runtimeRoot.querySelector("canvas") as HTMLCanvasElement;

    expect(canvas.style.zIndex).toBe("0");
    expect(contentLayer.dataset.domWebglRuntimeContent).toBe("true");
    expect(contentLayer.style.position).toBe("relative");
    expect(contentLayer.style.zIndex).toBe("1");

    await act(async () => {
      root.render(
        createElement(
          WebGLRuntime,
          { effects: effectsB },
          createElement("main", { "data-testid": "content" }, "DOM content"),
        ),
      );
    });

    await flushRuntimeDisposal();

    const nextContent = document.querySelector(
      "[data-testid='content']",
    ) as HTMLElement;
    const nextContentLayer = nextContent.parentElement as HTMLElement;
    const nextRuntimeRoot = nextContentLayer.parentElement as HTMLElement;
    const nextCanvas = nextRuntimeRoot.querySelector(
      "canvas",
    ) as HTMLCanvasElement;

    expect(nextCanvas.style.zIndex).toBe("0");
    expect(nextContentLayer.dataset.domWebglRuntimeContent).toBe("true");
    expect(nextContentLayer.style.position).toBe("relative");
    expect(nextContentLayer.style.zIndex).toBe("1");
  });

  test("recreates the runtime when the scroll adapter changes", async () => {
    const { WebGLRuntime } = await import("../../../src/react");
    const { root } = createTestRoot();
    const firstScrollAdapter = createTestScrollAdapter();
    const secondScrollAdapter = createTestScrollAdapter(120);

    await act(async () => {
      root.render(createElement(WebGLRuntime, { scrollAdapter: firstScrollAdapter }));
    });

    const firstRuntime = runtimeMocks.createWebGLRuntime.mock.results[0]
      .value as RuntimeInstance;

    await act(async () => {
      root.render(createElement(WebGLRuntime, { scrollAdapter: secondScrollAdapter }));
    });
    await flushRuntimeDisposal();

    expect(runtimeMocks.createWebGLRuntime).toHaveBeenCalledTimes(2);
    expect(firstRuntime.dispose).toHaveBeenCalledTimes(1);
    expect(runtimeMocks.createWebGLRuntime.mock.calls[1][0]).toEqual(
      expect.objectContaining({
        scrollAdapter: secondScrollAdapter,
      }),
    );
  });

  test("does not let targets register against a disposed runtime when scroll adapter becomes ready", async () => {
    const { WebGLRuntime, WebGLTarget } = await import("../../../src/react");
    const { root } = createTestRoot();
    const firstRuntime = createStrictRuntimeStub(document.createElement("div"));
    const secondRuntime = createStrictRuntimeStub(document.createElement("div"));
    runtimeMocks.createWebGLRuntime
      .mockImplementationOnce((options: WebGLRuntimeOptions) => ({
        ...firstRuntime,
        container: options.container,
      }))
      .mockImplementationOnce((options: WebGLRuntimeOptions) => ({
        ...secondRuntime,
        container: options.container,
      }));

    function RuntimeHost() {
      const [scrollAdapter, setScrollAdapter] =
        useState<WebGLRuntimeOptions["scrollAdapter"]>();

      useLayoutEffect(() => {
        setScrollAdapter(createTestScrollAdapter(160));
      }, []);

      return createElement(
        WebGLRuntime,
        { scrollAdapter },
        createElement(WebGLTarget, {
          webgl: {
            key: "example.target",
            source: { kind: "dom", type: "element" },
          },
        }),
      );
    }

    await act(async () => {
      expect(() => {
        root.render(createElement(RuntimeHost));
      }).not.toThrow();
    });
    await flushRuntimeDisposal();

    expect(runtimeMocks.createWebGLRuntime).toHaveBeenCalledTimes(2);
    expect(firstRuntime.dispose).toHaveBeenCalledTimes(1);
    expect(secondRuntime.registerTarget).toHaveBeenCalledTimes(1);
  });

  test("does not recreate the runtime when debug callbacks update parent state", async () => {
    const { WebGLRuntime } = await import("../../../src/react");
    const { root } = createTestRoot();
    let latestDebugCallback: ((state: unknown) => void) | undefined;

    runtimeMocks.createWebGLRuntime.mockImplementation((options) => {
      latestDebugCallback = options.onDebugStateChange;
      return createRuntimeStub(options.container);
    });

    function RuntimeHost() {
      const [, setDebugRevision] = useState(0);

      return createElement(WebGLRuntime, {
        onDebugStateChange: () => {
          setDebugRevision((revision) => revision + 1);
        },
      });
    }

    await act(async () => {
      root.render(createElement(RuntimeHost));
    });

    const firstRuntime = runtimeMocks.createWebGLRuntime.mock.results[0]
      .value as RuntimeInstance;

    await act(async () => {
      latestDebugCallback?.({});
    });

    expect(runtimeMocks.createWebGLRuntime).toHaveBeenCalledTimes(1);
    expect(firstRuntime.dispose).not.toHaveBeenCalled();
  });

  test("renders children inside the runtime provider", async () => {
    const { WebGLRuntime, useWebGLRuntime } = await import("../../../src/react");
    const { root } = createTestRoot();
    let providedRuntime: RuntimeInstance | undefined;

    function RuntimeConsumer() {
      providedRuntime = useWebGLRuntime();
      return createElement("span", null, "provided");
    }

    await act(async () => {
      root.render(createElement(WebGLRuntime, null, createElement(RuntimeConsumer)));
    });

    expect(providedRuntime).toBe(runtimeMocks.createWebGLRuntime.mock.results[0].value);
  });

  test("renders children without adding a global DOM layer wrapper", async () => {
    const { WebGLRuntime } = await import("../../../src/react");
    const { root, host } = createTestRoot();

    await act(async () => {
      root.render(
        createElement(
          WebGLRuntime,
          null,
          createElement("button", { "data-visible-dom": true }, "native"),
        ),
      );
    });

    expect(host.querySelector("[data-webgl-dom-layer]")).toBeNull();
    expect(host.querySelector("[data-visible-dom]")?.textContent).toBe("native");
  });

  test("does not own a React requestAnimationFrame sync loop", async () => {
    const { WebGLRuntime } = await import("../../../src/react");
    const { root } = createTestRoot();
    const requestAnimationFrame = vi
      .spyOn(globalThis, "requestAnimationFrame")
      .mockImplementation(() => 1);
    const cancelAnimationFrame = vi
      .spyOn(globalThis, "cancelAnimationFrame")
      .mockImplementation(() => {});

    await act(async () => {
      root.render(createElement(WebGLRuntime));
    });

    expect(requestAnimationFrame).not.toHaveBeenCalled();
    expect(cancelAnimationFrame).not.toHaveBeenCalled();

    requestAnimationFrame.mockRestore();
    cancelAnimationFrame.mockRestore();
  });

  test("allows consumers to read the pending runtime container before mount effects run", async () => {
    const { WebGLRuntime, useWebGLRuntime } = await import("../../../src/react");

    function RuntimeConsumer() {
      const runtime = useWebGLRuntime();

      return createElement(
        "span",
        { "data-pending-container": runtime.container.tagName },
        "pending",
      );
    }

    expect(() =>
      renderToStaticMarkup(
        createElement(WebGLRuntime, null, createElement(RuntimeConsumer)),
      ),
    ).not.toThrow();
  });

  test("disposes the runtime on unmount", async () => {
    const { WebGLRuntime } = await import("../../../src/react");
    const { root } = createTestRoot();

    await act(async () => {
      root.render(createElement(WebGLRuntime));
    });

    const runtime = runtimeMocks.createWebGLRuntime.mock.results[0]
      .value as RuntimeInstance;

    act(() => {
      root.unmount();
    });
    roots.splice(roots.indexOf(root), 1);

    expect(runtime.dispose).toHaveBeenCalledTimes(1);
  });
});

function createTestRoot(): { root: Root; host: HTMLElement } {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  roots.push(root);

  return { root, host };
}

function createRuntimeStub(container: HTMLElement): RuntimeInstance {
  const canvas = container.ownerDocument.createElement("canvas");
  canvas.style.zIndex = "0";
  container.prepend(canvas);

  return {
    container,
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
    sync: vi.fn(),
    getDebugState() {
      return {
        targetCount: 0,
        renderableCount: 0,
        currentScrollMode: "page",
        pointer: {
          x: 0,
          y: 0,
          normalizedX: 0,
          normalizedY: 0,
          isInside: false,
          isDown: false,
          downTime: 0,
          pressDuration: 0,
          isDragging: false,
          dragStartX: 0,
          dragStartY: 0,
          dragDeltaX: 0,
          dragDeltaY: 0,
          clickCount: 0,
        },
        targets: [],
      };
    },
    dispose: vi.fn(() => {
      canvas.remove();
    }),
  };
}

function createStrictRuntimeStub(container: HTMLElement): RuntimeInstance {
  let disposed = false;

  return {
    ...createRuntimeStub(container),
    registerTarget: vi.fn(() => {
      if (disposed) {
        throw new Error("Cannot register a WebGL target after runtime disposal.");
      }
    }),
    dispose: vi.fn(() => {
      disposed = true;
    }),
  };
}

function createTestEffects(kind = "custom.test"): WebGLRuntimeOptions["effects"] {
  return [
    {
      kind,
      update() {
        return;
      },
    },
  ];
}

function createTestScrollAdapter(
  scrollY = 0,
): WebGLRuntimeOptions["scrollAdapter"] {
  return {
    readMetrics() {
      return {
        scrollY,
        scrollHeight: 1000,
        viewportHeight: 500,
      };
    },
  };
}

function createTestProgressSignals(
  progress = 0,
): WebGLRuntimeOptions["progressSignals"] {
  return {
    get() {
      return progress;
    },
  };
}

async function flushRuntimeDisposal(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function createEmptyDebugState() {
  return {
    targetCount: 0,
    renderableCount: 0,
    currentScrollMode: "page" as const,
    pointer: {
      x: 0,
      y: 0,
      normalizedX: 0,
      normalizedY: 0,
      isInside: false,
      isDown: false,
      downTime: 0,
      pressDuration: 0,
      isDragging: false,
      dragStartX: 0,
      dragStartY: 0,
      dragDeltaX: 0,
      dragDeltaY: 0,
      clickCount: 0,
    },
    targets: [],
  };
}
