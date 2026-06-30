import type { WebGLRuntimeProps } from "@project/dom-webgl-runtime/react";
import { act, createElement, StrictMode, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { GsapTickerLike } from "../src/gsap";
import type { LenisGsapScrollStackLenis } from "../src/smoothScrollStack";
import type { ScrollTriggerSectionCreator, ScrollTriggerSectionVars } from "../src/scrollTrigger";

const runtimeMocks = vi.hoisted(() => ({
  WebGLRuntime: vi.fn((props: WebGLRuntimeProps) =>
    createElement("div", { "data-runtime": "true" }, props.children),
  ),
}));

vi.mock("@project/dom-webgl-runtime/react", () => ({
  WebGLRuntime: runtimeMocks.WebGLRuntime,
}));

const roots: Root[] = [];

describe("WebGLScrollRuntime smooth ownership", () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
    runtimeMocks.WebGLRuntime.mockClear();
  });

  afterEach(() => {
    for (const root of roots.splice(0)) {
      act(() => {
        root.unmount();
      });
    }
    document.body.replaceChildren();
  });

  test("keeps built-in smooth scroll adapter stable across child rerenders", async () => {
    const { WebGLScrollRuntime } = await import(
      "@project/dom-webgl-scroll-adapters/react"
    );
    const { root } = createTestRoot();
    const smooth = createSmoothDeps();

    function RuntimeHost() {
      const [revision, setRevision] = useState(0);

      return createElement(
        WebGLScrollRuntime,
        { smooth },
        createElement(
          "button",
          {
            type: "button",
            onClick: () => {
              setRevision((value) => value + 1);
            },
          },
          `revision ${revision}`,
        ),
      );
    }

    await act(async () => {
      root.render(createElement(RuntimeHost));
    });

    const firstAdapter = readLatestRuntimeProps().scrollAdapter;

    await act(async () => {
      document.querySelector("button")?.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });

    expect(readLatestRuntimeProps().scrollAdapter).toBe(firstAdapter);
    expect(smooth.createLenis).toHaveBeenCalledTimes(1);
    expect(smooth.gsap.ticker.add).toHaveBeenCalledTimes(1);
  });

  test("renders before the built-in smooth stack is ready", async () => {
    const { WebGLScrollRuntime } = await import(
      "@project/dom-webgl-scroll-adapters/react"
    );
    const { root } = createTestRoot();
    const smooth = createSmoothDeps();

    await act(async () => {
      root.render(createElement(WebGLScrollRuntime, { smooth }));
    });

    expect(runtimeMocks.WebGLRuntime.mock.calls[0]?.[0].scrollAdapter).toBeUndefined();
    expect(readLatestRuntimeProps().scrollAdapter).toBeDefined();
    expect(smooth.createLenis).toHaveBeenCalledTimes(1);
  });

  test("keeps the final strict mode smooth stack alive after initial remount", async () => {
    const { WebGLScrollRuntime } = await import(
      "@project/dom-webgl-scroll-adapters/react"
    );
    const { root } = createTestRoot();
    const smooth = createSmoothDepsWithLenisInstances();

    await act(async () => {
      root.render(
        createElement(
          StrictMode,
          null,
          createElement(WebGLScrollRuntime, { smooth }),
        ),
      );
    });

    const instances = smooth.readLenisInstances();
    const latestInstance = instances.at(-1);

    expect(instances.length).toBeGreaterThanOrEqual(2);
    expect(latestInstance?.destroy).not.toHaveBeenCalled();
    expect(readLatestRuntimeProps().scrollAdapter?.readMetrics().scrollY).toBe(
      latestInstance?.scroll,
    );
  });

  test("creates and disposes one smooth stack per mount", async () => {
    const { WebGLScrollRuntime } = await import(
      "@project/dom-webgl-scroll-adapters/react"
    );
    const { root } = createTestRoot();
    const smooth = createSmoothDeps();

    await act(async () => {
      root.render(createElement(WebGLScrollRuntime, { smooth }));
    });

    expect(smooth.createLenis).toHaveBeenCalledTimes(1);
    expect(smooth.gsap.ticker.add).toHaveBeenCalledTimes(1);

    act(() => {
      root.unmount();
    });
    roots.splice(roots.indexOf(root), 1);

    expect(smooth.gsap.ticker.remove).toHaveBeenCalledTimes(1);
    expect(smooth.lenis.destroy).toHaveBeenCalledTimes(1);
  });

  test("creates one section trigger after the smooth stack is ready", async () => {
    const { ScrollEffectSection, WebGLScrollRuntime } = await import(
      "@project/dom-webgl-scroll-adapters/react"
    );
    const { root } = createTestRoot();
    const smooth = createSmoothDeps();

    await act(async () => {
      root.render(
        createElement(
          WebGLScrollRuntime,
          { smooth },
          createElement(ScrollEffectSection, { progressKey: "hero.reveal" }),
        ),
      );
    });

    expect(smooth.ScrollTrigger.create).toHaveBeenCalledTimes(1);

    act(() => {
      root.unmount();
    });
    roots.splice(roots.indexOf(root), 1);

    expect(smooth.readLatestTrigger()?.kill).toHaveBeenCalledTimes(1);
  });

  test("does not leak smooth ticker callbacks across strict mode remounts", async () => {
    const { WebGLScrollRuntime } = await import(
      "@project/dom-webgl-scroll-adapters/react"
    );
    const { root } = createTestRoot();
    const smooth = createSmoothDeps();

    await act(async () => {
      root.render(
        createElement(
          StrictMode,
          null,
          createElement(WebGLScrollRuntime, { smooth }),
        ),
      );
    });

    act(() => {
      root.unmount();
    });
    roots.splice(roots.indexOf(root), 1);

    expect(smooth.gsap.ticker.add.mock.calls.length).toBe(
      smooth.gsap.ticker.remove.mock.calls.length,
    );
    expect(smooth.lenis.destroy).toHaveBeenCalledTimes(
      smooth.createLenis.mock.calls.length,
    );
  });

});

function createTestRoot(): { readonly root: Root; readonly host: HTMLElement } {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  roots.push(root);

  return { root, host };
}

function readLatestRuntimeProps(): WebGLRuntimeProps {
  const call = runtimeMocks.WebGLRuntime.mock.calls.at(-1);

  if (!call) {
    throw new Error("Expected WebGLRuntime to render.");
  }

  return call[0];
}

function createSmoothDeps() {
  const lenis = {
    raf: vi.fn(),
    on: vi.fn(),
    destroy: vi.fn(),
    scroll: 0,
    limit: 500,
  } satisfies LenisGsapScrollStackLenis;
  const gsap = {
    ticker: {
      add: vi.fn(),
      remove: vi.fn(),
      lagSmoothing: vi.fn(),
    },
  } satisfies GsapTickerLike;
  const ScrollTrigger = {
    update: vi.fn(),
    refresh: vi.fn(),
    create: vi.fn((_vars: ScrollTriggerSectionVars) => {
      const trigger = { kill: vi.fn() };
      latestTrigger.current = trigger;
      return trigger;
    }),
  } satisfies ScrollTriggerSectionCreator;
  const latestTrigger: { current?: { readonly kill: ReturnType<typeof vi.fn> } } =
    {};

  return {
    createLenis: vi.fn(() => lenis),
    lenis,
    gsap,
    ScrollTrigger,
    readLatestTrigger() {
      return latestTrigger.current;
    },
  };
}

function createSmoothDepsWithLenisInstances() {
  const instances: Array<LenisGsapScrollStackLenis & { readonly destroy: ReturnType<typeof vi.fn> }> =
    [];
  const gsap = {
    ticker: {
      add: vi.fn(),
      remove: vi.fn(),
      lagSmoothing: vi.fn(),
    },
  } satisfies GsapTickerLike;
  const ScrollTrigger = {
    update: vi.fn(),
    refresh: vi.fn(),
    create: vi.fn((_vars: ScrollTriggerSectionVars) => ({ kill: vi.fn() })),
  } satisfies ScrollTriggerSectionCreator;

  return {
    createLenis: vi.fn(() => {
      const lenis = {
        raf: vi.fn(),
        on: vi.fn(),
        destroy: vi.fn(),
        scroll: instances.length + 1,
        limit: 500,
      } satisfies LenisGsapScrollStackLenis & {
        readonly destroy: ReturnType<typeof vi.fn>;
      };
      instances.push(lenis);
      return lenis;
    }),
    gsap,
    ScrollTrigger,
    readLenisInstances() {
      return instances;
    },
  };
}
