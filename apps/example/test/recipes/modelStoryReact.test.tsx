import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { WebGLRuntimeProvider } from "@viselora/dom-webgl/react";
import type { WebGLRuntime } from "@viselora/dom-webgl";
import { WebGLScrollRuntime } from "@viselora/scroll-adapters/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import {
  ModelStory,
  modelStoryEffects,
  type ModelStoryProps,
} from "../../src/recipes/model-story";

// Only the GPU-backed constructor is replaced; React declarations and controllers are real.
vi.mock("three/src/renderers/WebGLRenderer.js", () => ({
  WebGLRenderer: vi.fn(function unavailableGPU() {
    throw new Error("WebGL unavailable in this test");
  }),
}));

const props = {
  id: "test.figure",
  title: "Every angle",
  model: {
    src: "/models/figure.glb",
    description: "A carved figure",
    poster: "/images/figure.jpg",
  },
  sections: [
    {
      id: "intro",
      side: "left",
      heading: "First impression",
      paragraphs: ["Read this complete sentence."],
    },
    {
      id: "detail",
      side: "right",
      heading: "A closer look",
      paragraphs: ["Another perspective."],
    },
  ],
  messages: {
    front: "Hello from the front",
    side: "A side view",
    back: "Around the back",
  },
} satisfies ModelStoryProps;

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe("ModelStory React semantics", () => {
  test("renders semantic content, full caption transcript, and fallback without WebGL or browser effects", () => {
    const markup = renderToStaticMarkup(
      createElement(
        WebGLScrollRuntime,
        { effects: modelStoryEffects },
        createElement(ModelStory, props),
      ),
    );
    const host = document.createElement("div");
    host.innerHTML = markup;
    expect(host.querySelector("h2")?.textContent).toBe("Every angle");
    expect(host.querySelector(".model-story__sr-only")?.textContent).toBe(
      "First impression",
    );
    expect(host.querySelectorAll("article")).toHaveLength(2);
    expect(host.querySelector("details")?.textContent).toContain(
      "Hello from the front",
    );
    expect(host.querySelector("details")?.textContent).toContain("A side view");
    expect(host.querySelector("details")?.textContent).toContain(
      "Around the back",
    );
    expect(
      host.querySelector(".model-story__fallback img")?.getAttribute("src"),
    ).toBe("/images/figure.jpg");
    expect(
      host.querySelector(".model-story__stage")?.getAttribute("aria-hidden"),
    ).toBe("true");
    expect(host.querySelector("[aria-live]")).toBeNull();
    expect(host.querySelector("canvas")).toBeNull();
  });

  test("keeps managed declarations stable on parent rerenders and unregisters every scoped resource", async () => {
    Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
    vi.spyOn(window, "requestAnimationFrame").mockReturnValue(17);
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const runtime = createRuntimeStub(host);
    function render() {
      root.render(
        createElement(
          WebGLScrollRuntime,
          { effects: modelStoryEffects },
          createElement(
            WebGLRuntimeProvider,
            { runtime },
            createElement(ModelStory, props),
          ),
        ),
      );
    }
    try {
      await act(render);
      const firstModel = runtime.registerModel.mock.calls[0]?.[0];
      expect(firstModel).toMatchObject({
        id: "test.figure.model",
        sceneId: "test.figure.scene",
        src: "/models/figure.glb",
      });
      expect(runtime.registerScene).toHaveBeenCalledTimes(1);
      expect(runtime.registerModel).toHaveBeenCalledTimes(1);
      await act(render);
      expect(runtime.registerModel).toHaveBeenCalledTimes(1);
      expect(runtime.registerScene).toHaveBeenCalledTimes(1);
      expect(
        host.querySelector(".model-story")?.getAttribute("data-model-ready"),
      ).toBeNull();
      expect(
        host.querySelector(".model-story__fallback")?.textContent,
      ).toContain("A carved figure");
    } finally {
      await act(() => root.unmount());
    }
    expect(runtime.unregisterModel).toHaveBeenCalledExactlyOnceWith(
      "test.figure.model",
    );
    expect(runtime.unregisterScene).toHaveBeenCalledExactlyOnceWith(
      "test.figure.scene",
    );
    expect(runtime.unregisterRenderPass).toHaveBeenCalledExactlyOnceWith(
      "test.figure.pass",
    );
    expect(runtime.unregisterPassViewport).toHaveBeenCalledExactlyOnceWith(
      "test.figure.viewport",
    );
    expect(runtime.unregisterCamera).toHaveBeenCalledExactlyOnceWith(
      "test.figure.camera",
    );
    expect(runtime.unregisterLight).toHaveBeenCalledWith("test.figure.key");
    expect(runtime.unregisterLight).toHaveBeenCalledWith("test.figure.ambient");
  });
});

function createRuntimeStub(container: HTMLElement) {
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
    registerMesh: vi.fn(),
    unregisterMesh: vi.fn(),
    registerLight: vi.fn(),
    unregisterLight: vi.fn(),
    registerModel: vi.fn(),
    unregisterModel: vi.fn(),
    registerTarget: vi.fn(),
    unregisterTarget: vi.fn(),
    sync() {},
    getDebugState() {
      throw new Error("Debug state is outside this registration test.");
    },
    dispose() {},
  } satisfies WebGLRuntime;
}
