import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import App from "../src/App";
import { recipeCatalog } from "../src/recipes/catalog";

describe("example application composition", () => {
  test("all examples and nine recipes share one Canvas with semantic fallback", () => {
    const html = renderToStaticMarkup(createElement(App));
    const host = document.createElement("div");
    host.innerHTML = html;
    expect(host.querySelectorAll("canvas")).toHaveLength(1);
    expect(host.querySelectorAll("[data-webgl-runtime]")).toHaveLength(1);
    expect(host.querySelectorAll(".recipe-example")).toHaveLength(9);
    for (const recipe of recipeCatalog)
      expect(host.querySelector(`[id="${recipe.id}"]`)).not.toBeNull();
    expect(host.querySelectorAll(".example-dom-visual")).toHaveLength(22);
    expect(host.querySelector(".example-text-pressure")?.textContent).toBe(
      "Pressure",
    );
    expect(host.querySelectorAll("video")).toHaveLength(2);
    expect(host.querySelectorAll(".example-sequence-card strong")).toHaveLength(
      1,
    );
    expect(host.textContent).toContain("滚动控制文字");
    expect(
      host.querySelectorAll(
        ".example-stage-viewport, .example-managed-model-viewport, .example-managed-stage-viewport, .example-interaction-viewport, .example-physics-viewport",
      ).length,
    ).toBe(5);
    const ids = Array.from(host.querySelectorAll("[id]"), (e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
