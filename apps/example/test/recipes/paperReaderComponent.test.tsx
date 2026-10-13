import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { WebGLScrollRuntime } from "@viselora/scroll-adapters/react";
import { PaperReader } from "../../src/recipes/paper-reader";

const articles = [
  {
    id: "public-note",
    label: "FIELD NOTE",
    title: "A useful observation",
    body: "Complete semantic text remains available without a renderer.",
  },
];

describe("paper reader semantic component", () => {
  test("renders complete accessible SSR fallback through the documented wrapper without a canvas", () => {
    const html = renderToString(
      createElement(
        WebGLScrollRuntime,
        null,
        createElement(PaperReader, {
          id: "notes",
          articles,
          title: "A reading collection",
        }),
      ),
    );
    const container = document.createElement("div");
    container.innerHTML = html;
    expect(container.querySelectorAll("canvas")).toHaveLength(1);
    expect(container.querySelector("article")?.textContent).toContain(
      articles[0].body,
    );
    expect(container.querySelector("h2")?.textContent).toBe(
      "A reading collection",
    );
    expect(
      container
        .querySelector(".paper-reader__fallback")
        ?.hasAttribute("hidden"),
    ).toBe(false);
    expect(container.querySelector(".paper-reader__stage")).toBeNull();
  });

  test("supports two independently identified readers within one runtime", () => {
    const html = renderToString(
      createElement(WebGLScrollRuntime, null, [
        createElement(PaperReader, { key: "one", id: "one", articles }),
        createElement(PaperReader, { key: "two", id: "two", articles }),
      ]),
    );
    const container = document.createElement("div");
    container.innerHTML = html;
    expect(container.querySelectorAll("[data-webgl-runtime]")).toHaveLength(1);
    expect(container.querySelectorAll("article")).toHaveLength(2);
    const headingIds = Array.from(
      container.querySelectorAll("h2"),
      (heading) => heading.id,
    );
    expect(new Set(headingIds).size).toBe(2);
  });

  test("requires the caller's scroll runtime instead of silently creating another one", () => {
    expect(() =>
      renderToString(createElement(PaperReader, { id: "notes", articles })),
    ).toThrow(/WebGLScrollRuntime/);
  });
});
