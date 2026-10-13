import React, { act, createElement, useLayoutEffect, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";

import {
  WebGLScrollRuntime,
  useScrollEffectProgressStore,
  type ScrollEffectProgressStore,
} from "@viselora/scroll-adapters/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { FacePortal } from "../../src/recipes/spatial/FacePortal";
import { InteractiveSculpture } from "../../src/recipes/spatial/InteractiveSculpture";
import {
  useSpatialStage,
  type SpatialStage,
} from "../../src/recipes/spatial/stage";
import type { FourFaces, PortalChapter } from "../../src/recipes/spatial/types";

// Keep the real providers and declarations; replace only the unavailable GPU constructor.
vi.mock("three/src/renderers/WebGLRenderer.js", () => ({
  WebGLRenderer: vi.fn(function unavailableGPU() {
    throw new Error("WebGL is unavailable in this DOM lifecycle test.");
  }),
}));

const mountedRoots = new Set<Root>();
const chapters: FourFaces<PortalChapter> = [
  {
    id: "explicit-exit",
    entry: { label: "Start", title: "Opening", description: "First view" },
    paragraphs: ["Read the story before following its link."],
    exit: { label: "Finish", title: "Closing", description: "Last view" },
    link: { href: "/one", label: "Read more" },
  },
  {
    id: "link-only",
    entry: {
      label: "Two",
      title: "One composition",
      description: "Both endpoints",
    },
    link: { href: "/two", label: "Second link" },
  },
  {
    id: "prose-only",
    entry: {
      label: "Three",
      title: "A full chapter",
      description: "A stable endpoint",
    },
    paragraphs: ["Longer semantic content between the two matching views."],
  },
  {
    id: "panel-only",
    entry: {
      label: "Four",
      title: "A single panel",
      description: "No extra body",
    },
  },
];

beforeEach(() => {
  Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
});

afterEach(async () => {
  for (const root of mountedRoots) await act(() => root.unmount());
  mountedRoots.clear();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

function createHost() {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  mountedRoots.add(root);
  return { host, root };
}

function mockGeometry() {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      if (this.hasAttribute("data-spatial-entry"))
        return new DOMRect(0, -800, 1200, 1000);
      if (this.hasAttribute("data-spatial-body"))
        return new DOMRect(0, -600, 1200, 1600);
      if (this.hasAttribute("data-spatial-exit"))
        return new DOMRect(0, -200, 1200, 1000);
      return new DOMRect(0, 0, 1200, 800);
    },
  );
}

function StageFixture({ id }: { readonly id: string }) {
  const { root, viewport } = useSpatialStage(id, true);
  return createElement(
    "section",
    { ref: root },
    createElement("div", { ref: viewport }),
    ...[0, 1, 2, 3].map((index) =>
      createElement(
        "div",
        { key: index, "data-spatial-cycle": "" },
        createElement("div", { "data-spatial-entry": "" }),
        createElement("div", { "data-spatial-body": "" }),
        createElement("div", { "data-spatial-exit": "" }),
      ),
    ),
  );
}

describe("spatial recipe lifecycle", () => {
  test("measures pointer offsets in viewport coordinates after the host scrolls", async () => {
    const { host, root } = createHost();
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function (this: HTMLElement) {
        return this === host
          ? new DOMRect(0, -12000, 390, 90000)
          : new DOMRect(20, 60, 350, 844);
      },
    );
    let capturedStage: SpatialStage | undefined;
    function PointerFixture() {
      const { root, viewport, stage } = useSpatialStage("pointer", false);
      useLayoutEffect(() => {
        capturedStage = stage;
      }, [stage]);
      return createElement(
        "section",
        { ref: root },
        createElement("div", { ref: viewport }),
      );
    }
    await act(() =>
      root.render(
        createElement(
          WebGLScrollRuntime,
          null,
          createElement(React.Fragment, null, createElement(PointerFixture)),
        ),
      ),
    );
    if (!capturedStage) throw new Error("The spatial stage did not mount.");
    expect(capturedStage.pointerLeft).toBe(20);
    expect(capturedStage.pointerTop).toBe(60);
    expect(capturedStage.visible).toBe(true);
  });

  test("both reading-mode transitions return to the component start without scrolling on mount", async () => {
    mockGeometry();
    vi.spyOn(window, "requestAnimationFrame").mockReturnValue(1);
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
    const { host, root } = createHost();
    const scrollTargets: HTMLElement[] = [];
    const scrollOptions: (boolean | ScrollIntoViewOptions | undefined)[] = [];
    const previousScrollIntoView = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      "scrollIntoView",
    );
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value(this: HTMLElement, options?: boolean | ScrollIntoViewOptions) {
        scrollTargets.push(this);
        scrollOptions.push(options);
      },
    });
    try {
      await act(() =>
        root.render(
          createElement(
            React.StrictMode,
            null,
            createElement(
              WebGLScrollRuntime,
              null,
              createElement(
                React.Fragment,
                null,
                createElement(FacePortal, { id: "reading", chapters }),
              ),
            ),
          ),
        ),
      );
      expect(scrollTargets).toHaveLength(0);
      const portal = host.querySelector<HTMLElement>(".spatial-portal");
      const button = host.querySelector<HTMLButtonElement>(
        ".spatial-reader-toggle button",
      );
      if (!portal || !button)
        throw new Error("Missing portal reading control.");
      await act(() => button.click());
      expect(button.getAttribute("aria-pressed")).toBe("true");
      expect(scrollTargets).toEqual([portal]);
      await act(() => button.click());
      expect(button.getAttribute("aria-pressed")).toBe("false");
      expect(scrollTargets).toEqual([portal, portal]);
      expect(scrollOptions).toEqual([
        { block: "start", behavior: "instant" },
        { block: "start", behavior: "instant" },
      ]);
    } finally {
      if (previousScrollIntoView) {
        Object.defineProperty(
          HTMLElement.prototype,
          "scrollIntoView",
          previousScrollIntoView,
        );
      } else {
        Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
      }
    }
  });

  test("unmount clears only its twelve signals and rejects a previously queued measurement", async () => {
    mockGeometry();
    const { root } = createHost();
    const callbacks = new Map<number, FrameRequestCallback>();
    let requestId = 0;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callbacks.set(++requestId, callback);
      return requestId;
    });
    const cancel = vi
      .spyOn(window, "cancelAnimationFrame")
      .mockImplementation((id) => {
        callbacks.delete(id);
      });
    let capturedStore: ScrollEffectProgressStore | undefined;
    function CaptureStore() {
      const store = useScrollEffectProgressStore();
      useLayoutEffect(() => {
        capturedStore = store;
      }, [store]);
      return null;
    }
    function render(first: boolean) {
      root.render(
        createElement(
          WebGLScrollRuntime,
          null,
          createElement(
            React.Fragment,
            null,
            createElement(CaptureStore),
            first
              ? createElement(StageFixture, { key: "first", id: "first" })
              : null,
            createElement(StageFixture, { key: "second", id: "second" }),
          ),
        ),
      );
    }
    await act(() => render(true));
    if (!capturedStore)
      throw new Error("The real progress provider did not mount.");
    const store = capturedStore;
    store.set("outside", 0.4);
    expect(store.source.get("first.0.entry")).toBe(0.8);
    expect(store.source.get("second.0.entry")).toBe(0.8);
    const clear = vi.spyOn(store, "clear");
    const set = vi.spyOn(store, "set");
    await act(() => window.dispatchEvent(new Event("scroll")));
    const scheduled = Array.from(callbacks.values());
    expect(scheduled).toHaveLength(2);
    await act(() => render(false));
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(clear.mock.calls.map(([key]) => key).sort()).toEqual(
      [0, 1, 2, 3]
        .flatMap((index) =>
          ["entry", "body", "exit"].map((phase) => `first.${index}.${phase}`),
        )
        .sort(),
    );
    expect(store.source.get("first.0.entry")).toBe(0);
    expect(store.source.get("second.0.entry")).toBe(0.8);
    expect(store.source.get("outside")).toBe(0.4);
    set.mockClear();
    await act(() => {
      for (const callback of scheduled) callback(100);
    });
    expect(set.mock.calls.every(([key]) => key.startsWith("second."))).toBe(
      true,
    );
    expect(store.source.get("first.0.entry")).toBe(0);
  });

  test("inline scheme callbacks do not repeat on parent renders and the next commit uses the latest callback", async () => {
    mockGeometry();
    vi.spyOn(window, "requestAnimationFrame").mockReturnValue(1);
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
    const { host, root } = createHost();
    const committed = vi.fn<(label: string, scheme: 0 | 1) => void>();
    function Parent({ label }: { readonly label: string }) {
      const [settings, setSettings] = useState<{ scheme: 0 | 1 }>({
        scheme: 0,
      });
      return createElement(
        "div",
        { "data-parent-scheme": settings.scheme },
        createElement(InteractiveSculpture, {
          id: "sculpture",
          title: "Sculpture",
          holdMs: 1000,
          onSchemeChange(scheme) {
            committed(label, scheme);
            if (committed.mock.calls.length > 5)
              throw new Error("Scheme callbacks must not form a render loop.");
            setSettings({ scheme });
          },
        }),
      );
    }
    function render(label: string) {
      root.render(
        createElement(
          WebGLScrollRuntime,
          null,
          createElement(React.Fragment, null, createElement(Parent, { label })),
        ),
      );
    }
    await act(() => render("first"));
    expect(committed).toHaveBeenCalledExactlyOnceWith("first", 0);
    expect(host.querySelectorAll(".spatial-pass")).toHaveLength(1);
    await act(() => render("latest"));
    expect(committed).toHaveBeenCalledTimes(1);
    const button = host.querySelector<HTMLButtonElement>("button");
    if (!button) throw new Error("Missing keyboard theme control.");
    await act(() => button.click());
    expect(committed.mock.calls).toEqual([
      ["first", 0],
      ["latest", 1],
    ]);
    expect(
      host
        .querySelector("[data-parent-scheme]")
        ?.getAttribute("data-parent-scheme"),
    ).toBe("1");
    expect(host.querySelectorAll(".spatial-pass")).toHaveLength(1);
  });

  test("the last DOM child always matches the exit atlas, including chapters with links or no explicit exit", () => {
    const host = document.createElement("div");
    host.innerHTML = renderToStaticMarkup(
      createElement(
        WebGLScrollRuntime,
        null,
        createElement(FacePortal, { id: "portal", chapters }),
      ),
    );
    const bodies = Array.from(
      host.querySelectorAll<HTMLElement>("[data-spatial-body]"),
    );
    expect(bodies).toHaveLength(4);
    for (const [index, body] of bodies.entries()) {
      const endpoint = body.lastElementChild;
      if (!endpoint) throw new Error("A chapter requires a terminal panel.");
      expect(endpoint.classList.contains("spatial-panel")).toBe(true);
      expect(endpoint.querySelector("h2")?.textContent).toBe(
        (chapters[index].exit ?? chapters[index].entry).title,
      );
      const link = body.querySelector("a");
      if (link) {
        expect(link.parentElement?.classList.contains("spatial-prose")).toBe(
          true,
        );
        expect(
          link.compareDocumentPosition(endpoint) &
            Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();
      }
    }
    expect(bodies[3].querySelectorAll(".spatial-panel")).toHaveLength(1);
  });

  test("the reading control retains its own contrast colors when the page background inverts", () => {
    const palette = { background: "#faf2df", foreground: "#162423" };
    const host = document.createElement("div");
    host.innerHTML = renderToStaticMarkup(
      createElement(
        WebGLScrollRuntime,
        null,
        createElement(FacePortal, { id: "contrast", chapters, palette }),
      ),
    );
    document.body.append(host);
    const portal = host.querySelector<HTMLElement>(".spatial-portal");
    const button = host.querySelector<HTMLButtonElement>(
      ".spatial-reader-toggle button",
    );
    if (!portal || !button) throw new Error("Missing portal reading control.");
    portal.style.background = palette.foreground;
    const style = window.getComputedStyle(button);
    expect(style.backgroundColor).toBe("rgb(250, 242, 223)");
    expect(style.color).toBe("rgb(22, 36, 35)");
  });
});
