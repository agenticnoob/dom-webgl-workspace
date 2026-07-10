import type {
  WebGLProgressSignalSource,
  WebGLScrollAdapter,
} from "@viselora/dom-webgl";
import type { WebGLEffectDefinition } from "@viselora/dom-webgl";
import type { WebGLRuntimeProps } from "@viselora/dom-webgl/react";
import { act, createElement } from "react";
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

vi.mock("@viselora/dom-webgl/react", () => ({
  WebGLRuntime: runtimeMocks.WebGLRuntime,
}));

const roots: Root[] = [];

describe("@viselora/scroll-adapters/react", () => {
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

  test("module-loads without browser globals", async () => {
    const globals = removeBrowserGlobals();

    try {
      expect("window" in globalThis).toBe(false);
      expect("document" in globalThis).toBe(false);

      const reactEntry = await import("@viselora/scroll-adapters/react");

      expect(reactEntry).toHaveProperty("WebGLScrollRuntime");
      expect(reactEntry).toHaveProperty("WebGLScrollTimeline");
      expect(reactEntry).toHaveProperty("ScrollEffectSection");
      expect(reactEntry).toHaveProperty("createScrollEffectProgressStore");
    } finally {
      restoreBrowserGlobals(globals);
    }
  });

  test("passes no scroll adapter when smooth is omitted", async () => {
    const { WebGLScrollRuntime } = await import(
      "@viselora/scroll-adapters/react"
    );
    const { root } = createTestRoot();

    await act(async () => {
      root.render(createElement(WebGLScrollRuntime));
    });

    const runtimeProps = readLatestRuntimeProps();
    expect(runtimeProps.scrollAdapter).toBeUndefined();
    expect(runtimeProps.progressSignals).toBeDefined();
  });

  test("uses an advanced scroll adapter without creating the smooth stack", async () => {
    const { WebGLScrollRuntime } = await import(
      "@viselora/scroll-adapters/react"
    );
    const { root } = createTestRoot();
    const smooth = createSmoothDeps();
    const scrollAdapter = createScrollAdapter();

    await act(async () => {
      root.render(
        createElement(WebGLScrollRuntime, {
          smooth,
          scrollAdapter,
        }),
      );
    });

    expect(readLatestRuntimeProps().scrollAdapter).toBe(scrollAdapter);
    expect(smooth.createLenis).not.toHaveBeenCalled();
    expect(smooth.gsap.ticker.add).not.toHaveBeenCalled();
  });

  test("throws a developer-facing invariant outside WebGLScrollRuntime", async () => {
    const { ScrollEffectSection } = await import(
      "@viselora/scroll-adapters/react"
    );
    const { root } = createTestRoot();

    expect(() => {
      act(() => {
        root.render(
          createElement(ScrollEffectSection, { progressKey: "hero.reveal" }),
        );
      });
    }).toThrow("ScrollEffectSection must be rendered inside WebGLScrollRuntime.");
  });

  test("updates and clears section progress without mutating effect props", async () => {
    const { ScrollEffectSection, WebGLScrollRuntime } = await import(
      "@viselora/scroll-adapters/react"
    );
    const { root } = createTestRoot();
    const smooth = createSmoothDeps();
    const effects = [
      {
        kind: "test.pinned",
        update() {},
      },
    ] satisfies readonly WebGLEffectDefinition[];

    await act(async () => {
      root.render(
        createElement(
          WebGLScrollRuntime,
          { effects },
          createElement(
            ScrollEffectSection,
            {
              progressKey: "hero.reveal",
              ScrollTrigger: smooth.ScrollTrigger,
            },
            "Pinned section",
          ),
        ),
      );
    });

    const progressSignals = readProgressSignals();
    expect(progressSignals.get("hero.reveal")).toBe(0);
    expect(smooth.ScrollTrigger.create).toHaveBeenCalledTimes(1);

    act(() => {
      smooth.readTriggerVars()?.onUpdate?.({ progress: 0.6 });
    });

    expect(progressSignals.get("hero.reveal")).toBe(0.6);
    expect(readLatestRuntimeProps().effects).toBe(effects);

    act(() => {
      root.unmount();
    });
    roots.splice(roots.indexOf(root), 1);

    expect(progressSignals.get("hero.reveal")).toBe(0);
    expect(smooth.triggerInstance.kill).toHaveBeenCalledTimes(1);
  });

  test("WebGLScrollTimeline writes progress by id while ScrollEffectSection stays compatible", async () => {
    const { ScrollEffectSection, WebGLScrollRuntime, WebGLScrollTimeline } =
      await import("@viselora/scroll-adapters/react");
    const { root } = createTestRoot();
    const timelineSmooth = createSmoothDeps();
    const sectionSmooth = createSmoothDeps();

    await act(async () => {
      root.render(
        createElement(
          WebGLScrollRuntime,
          undefined,
          createElement(
            WebGLScrollTimeline,
            {
              id: "hero.3d",
              ScrollTrigger: timelineSmooth.ScrollTrigger,
            },
            "Timeline section",
          ),
          createElement(
            ScrollEffectSection,
            {
              progressKey: "hero.reveal",
              ScrollTrigger: sectionSmooth.ScrollTrigger,
            },
            "Compatibility section",
          ),
        ),
      );
    });

    const progressSignals = readProgressSignals();
    expect(timelineSmooth.ScrollTrigger.create).toHaveBeenCalledTimes(1);
    expect(sectionSmooth.ScrollTrigger.create).toHaveBeenCalledTimes(1);

    act(() => {
      timelineSmooth.readTriggerVars()?.onUpdate?.({ progress: 0.35 });
      sectionSmooth.readTriggerVars()?.onUpdate?.({ progress: 0.75 });
    });

    expect(progressSignals.get("hero.3d")).toBe(0.35);
    expect(progressSignals.get("hero.reveal")).toBe(0.75);

    act(() => {
      root.unmount();
    });
    roots.splice(roots.indexOf(root), 1);

    expect(progressSignals.get("hero.3d")).toBe(0);
    expect(progressSignals.get("hero.reveal")).toBe(0);
    expect(timelineSmooth.triggerInstance.kill).toHaveBeenCalledTimes(1);
    expect(sectionSmooth.triggerInstance.kill).toHaveBeenCalledTimes(1);
  });
});

type BrowserGlobalSnapshot = {
  readonly window: PropertyDescriptor | undefined;
  readonly document: PropertyDescriptor | undefined;
};

function removeBrowserGlobals(): BrowserGlobalSnapshot {
  const snapshot = {
    window: Object.getOwnPropertyDescriptor(globalThis, "window"),
    document: Object.getOwnPropertyDescriptor(globalThis, "document"),
  } satisfies BrowserGlobalSnapshot;

  Reflect.deleteProperty(globalThis, "window");
  Reflect.deleteProperty(globalThis, "document");

  return snapshot;
}

function restoreBrowserGlobals(snapshot: BrowserGlobalSnapshot): void {
  restoreBrowserGlobal("window", snapshot.window);
  restoreBrowserGlobal("document", snapshot.document);
}

function restoreBrowserGlobal(
  key: "window" | "document",
  descriptor: PropertyDescriptor | undefined,
): void {
  if (!descriptor) {
    Reflect.deleteProperty(globalThis, key);
    return;
  }

  Object.defineProperty(globalThis, key, descriptor);
}

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

function readProgressSignals(): WebGLProgressSignalSource {
  const progressSignals = readLatestRuntimeProps().progressSignals;

  if (!progressSignals) {
    throw new Error("Expected progress signals to be passed.");
  }

  return progressSignals;
}

function createScrollAdapter(): WebGLScrollAdapter {
  return {
    kind: "test",
    readMetrics() {
      return {
        scrollY: 0,
        scrollHeight: 1000,
        viewportHeight: 500,
      };
    },
    dispose: vi.fn(),
  };
}

function createSmoothDeps() {
  const triggerVarsRef: { current?: ScrollTriggerSectionVars } = {};
  const lenis = {
    raf: vi.fn(),
    on: vi.fn(),
    destroy: vi.fn(),
    scroll: 0,
    limit: 500,
  } satisfies LenisGsapScrollStackLenis;
  const triggerInstance = {
    kill: vi.fn(),
  };
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
    create: vi.fn((vars: ScrollTriggerSectionVars) => {
      triggerVarsRef.current = vars;
      return triggerInstance;
    }),
  } satisfies ScrollTriggerSectionCreator;

  return {
    createLenis: vi.fn(() => lenis),
    lenis,
    gsap,
    ScrollTrigger,
    triggerInstance,
    readTriggerVars() {
      return triggerVarsRef.current;
    },
  };
}
