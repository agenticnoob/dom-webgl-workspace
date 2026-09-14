import { act, createElement, StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type {
  WebGLCameraDeclaration,
  WebGLDeclaration,
  WebGLRenderPassDeclaration,
  WebGLRuntime,
  WebGLSceneDeclaration,
} from "@viselora/dom-webgl";
import { WebGLScrollRuntime } from "@viselora/scroll-adapters/react";
import {
  PaperReader,
  paperReaderEffects,
} from "../../src/recipes/paper-reader";
import { createEffectContext } from "../effectContext";

const injected: { runtime?: WebGLRuntime } = vi.hoisted(() => ({}));

// Exercise real recipe/scene/camera/pass React registration through a public
// runtime provider. GPU output is verified separately in the browser.
vi.mock("@viselora/dom-webgl/react", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@viselora/dom-webgl/react")>();
  return {
    ...actual,
    WebGLRuntime({ children }: { children?: ReactNode }) {
      if (!injected.runtime) throw new Error("Missing injected test runtime.");
      return createElement(
        actual.WebGLRuntimeProvider,
        { runtime: injected.runtime },
        children,
      );
    },
  };
});

const articles = [
  {
    id: "first",
    label: "01",
    title: "An observation",
    body: "Keep the whole note.",
  },
];

function createRegistry() {
  const scenes = new Map<string, WebGLSceneDeclaration>();
  const cameras = new Map<string, WebGLCameraDeclaration>();
  const passes = new Map<string | undefined, WebGLRenderPassDeclaration>();
  const targets = new Map<string, WebGLDeclaration>();
  const viewportIds = new Set<string>();
  const runtime = {
    container: document.createElement("div"),
    registerScene: (declaration) => {
      scenes.set(declaration.id, declaration);
    },
    unregisterScene: (id) => {
      scenes.delete(id);
    },
    registerCamera: (declaration) => {
      cameras.set(declaration.id, declaration);
    },
    unregisterCamera: (id) => {
      cameras.delete(id);
    },
    registerRenderPass: (declaration) => {
      passes.set(declaration.id, declaration);
    },
    unregisterRenderPass: (id) => {
      passes.delete(id);
    },
    registerPassViewport: (declaration) => {
      viewportIds.add(declaration.id);
    },
    unregisterPassViewport: (id) => {
      viewportIds.delete(id);
    },
    registerTarget: (_element, declaration) => {
      targets.set(declaration.key, declaration);
    },
    unregisterTarget: (id) => {
      targets.delete(id);
    },
    registerMesh: vi.fn(),
    unregisterMesh: vi.fn(),
    registerModel: vi.fn(),
    unregisterModel: vi.fn(),
    registerLight: vi.fn(),
    unregisterLight: vi.fn(),
    sync: vi.fn(),
    dispose: vi.fn(),
    getDebugState: () => ({
      targetCount: 0,
      renderableCount: 0,
      currentScrollMode: "page",
      pointer: createEffectContext().pointer,
      targets: [],
    }),
  } satisfies WebGLRuntime;
  return { runtime, scenes, cameras, passes, targets, viewportIds };
}

describe("paper reader public runtime composition", () => {
  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.replaceChildren();
  });

  test("provides every scoped pass with a matching registered camera and releases StrictMode registrations", () => {
    const registry = createRegistry();
    injected.runtime = registry.runtime;
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    act(() =>
      root.render(
        createElement(
          StrictMode,
          null,
          createElement(WebGLScrollRuntime, { effects: paperReaderEffects }, [
            createElement(PaperReader, { key: "one", id: "one", articles }),
            createElement(PaperReader, { key: "two", id: "two", articles }),
          ]),
        ),
      ),
    );
    expect(registry.passes.size).toBe(2);
    expect(registry.targets.size).toBe(2);
    for (const pass of registry.passes.values()) {
      if (!pass.cameraId) throw new Error("Scoped render pass has no camera.");
      const camera = registry.cameras.get(pass.cameraId);
      expect(camera).toBeDefined();
      expect(camera?.sceneId).toBe(pass.sceneId);
      expect(registry.scenes.has(pass.sceneId)).toBe(true);
      expect(camera?.type).toBe("orthographic");
      expect(pass.viewport?.mode).toBe("dom-rect");
      if (pass.viewport?.mode === "dom-rect") {
        expect(registry.viewportIds.has(pass.viewport.anchorId ?? "")).toBe(
          true,
        );
      }
    }
    act(() => root.unmount());
    expect(registry.scenes.size).toBe(0);
    expect(registry.cameras.size).toBe(0);
    expect(registry.passes.size).toBe(0);
    expect(registry.targets.size).toBe(0);
    expect(registry.viewportIds.size).toBe(0);
  });

  test("replaces all content declarations together and restores ordinary DOM when reduced motion changes", () => {
    const registry = createRegistry();
    injected.runtime = registry.runtime;
    const events = new EventTarget();
    let reducedMotion = false;
    const query = {
      get matches() {
        return reducedMotion;
      },
      media: "(prefers-reduced-motion: reduce)",
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: events.addEventListener.bind(events),
      removeEventListener: events.removeEventListener.bind(events),
      dispatchEvent: events.dispatchEvent.bind(events),
    } satisfies MediaQueryList;
    vi.spyOn(window, "matchMedia").mockReturnValue(query);
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const render = (nextArticles: typeof articles) =>
      createElement(
        WebGLScrollRuntime,
        { effects: paperReaderEffects },
        createElement(PaperReader, {
          id: "notes",
          articles: nextArticles,
          height: 640,
        }),
      );
    act(() => root.render(render(articles)));
    const first = registry.targets.get("notes.paper-reader.surface");
    const nextArticles = [
      {
        ...articles[0],
        title: "A revised observation",
        body: "The revised note.",
      },
      { id: "second", label: "02", title: "An experiment", body: "Try it." },
    ];
    act(() => root.render(render(nextArticles)));
    const next = registry.targets.get("notes.paper-reader.surface");
    expect(next).not.toBe(first);
    expect(host.querySelectorAll("article")).toHaveLength(2);
    expect(host.textContent).toContain("The revised note.");
    expect(
      host
        .querySelector<HTMLElement>(".paper-reader")
        ?.style.getPropertyValue("--paper-reader-stage-height"),
    ).toBe("640px");
    const onReady = next?.effects?.[0]?.onReady;
    if (typeof onReady !== "function")
      throw new Error("Missing readiness callback.");
    act(() => onReady(true));
    expect(
      host.querySelector(".paper-reader__fallback")?.hasAttribute("hidden"),
    ).toBe(true);
    act(() => {
      reducedMotion = true;
      events.dispatchEvent(new Event("change"));
    });
    expect(registry.targets.size).toBe(0);
    expect(registry.cameras.size).toBe(0);
    expect(host.querySelector(".paper-reader__stage")).toBeNull();
    expect(
      host.querySelector(".paper-reader__fallback")?.hasAttribute("hidden"),
    ).toBe(false);
    expect(host.textContent).toContain("The revised note.");
    act(() => root.unmount());
  });
});
