import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";

import { WebGLScrollRuntime } from "@viselora/scroll-adapters/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import {
  ModelStory,
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
      createElement(WebGLScrollRuntime, null, createElement(ModelStory, props)),
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
    expect(host.querySelectorAll("canvas")).toHaveLength(1);
  });

  test("keeps semantic content stable across rerenders and releases its scroll controller", async () => {
    Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
    vi.spyOn(window, "requestAnimationFrame").mockReturnValue(17);
    const cancel = vi
      .spyOn(window, "cancelAnimationFrame")
      .mockImplementation(() => {});
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    // R3F's react-use-measure debounces scroll by 50ms and does not cancel the
    // timer on unmount; without debounce the scroll below cannot fire after
    // the test environment is torn down.
    const render = () =>
      root.render(
        createElement(
          WebGLScrollRuntime,
          { canvas: { resize: { debounce: 0 } } },
          createElement(ModelStory, props),
        ),
      );
    await act(render);
    const section = host.querySelector(".model-story");
    await act(render);
    expect(host.querySelector(".model-story")).toBe(section);
    expect(host.querySelectorAll(".model-story__viewport")).toHaveLength(1);
    expect(host.querySelector(".model-story__fallback")?.textContent).toContain(
      "A carved figure",
    );
    await act(() => window.dispatchEvent(new Event("scroll")));
    await act(() => root.unmount());
    expect(host.childElementCount).toBe(0);
    expect(cancel).toHaveBeenCalled();
  });
});
