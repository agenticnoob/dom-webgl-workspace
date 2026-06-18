import { act, createElement, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type {
  WebGLRuntime as RuntimeInstance,
  WebGLRuntimeOptions,
} from "../renderer/runtime";

const runtimeMocks = vi.hoisted(() => ({
  createWebGLRuntime: vi.fn(),
}));

vi.mock("../renderer/runtime", () => ({
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
    const reactEntrypoint = await import("../../react");

    expect(reactEntrypoint.WebGLRuntime).toBeTypeOf("function");
    expect(runtimeMocks.createWebGLRuntime).not.toHaveBeenCalled();
  });

  test("preserves ordinary DOM targets before the runtime is ready", async () => {
    const { WebGLRuntime, WebGLTarget } = await import("../../react");

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
    const { WebGLRuntime } = await import("../../react");
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

  test("does not recreate the runtime when debug callbacks update parent state", async () => {
    const { WebGLRuntime } = await import("../../react");
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
    const { WebGLRuntime, useWebGLRuntime } = await import("../../react");
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
    const { WebGLRuntime } = await import("../../react");
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
    const { WebGLRuntime } = await import("../../react");
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
    const { WebGLRuntime, useWebGLRuntime } = await import("../../react");

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
    const { WebGLRuntime } = await import("../../react");
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
  return {
    container,
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
    dispose: vi.fn(),
  };
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
