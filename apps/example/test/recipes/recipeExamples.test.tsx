import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { WebGLScrollRuntime } from "@viselora/scroll-adapters/react";
import { expect, test } from "vitest";
import { RecipeExamples } from "../../src/RecipeExamples";
import { recipeCatalog } from "../../src/recipes/catalog";

test("renders all nine live specimens together under one runtime without route selection", () => {
  const html = renderToStaticMarkup(
    createElement(WebGLScrollRuntime, {
      children: createElement(RecipeExamples),
    }),
  );
  const template = document.createElement("template");
  template.innerHTML = html;
  const rows = template.content.querySelectorAll(".recipe-example");
  expect(Array.from(rows, (row) => row.id)).toEqual(
    recipeCatalog.map((recipe) => recipe.id),
  );
  expect(rows).toHaveLength(9);
  for (const row of rows) expect(row.children).toHaveLength(2);
  expect(template.content.querySelectorAll('a[href*="?recipe"]')).toHaveLength(
    0,
  );
  const ids = Array.from(
    template.content.querySelectorAll("[id]"),
    (element) => element.id,
  );
  expect(new Set(ids).size).toBe(ids.length);
  expect(
    template.content.querySelectorAll("[data-webgl-runtime]"),
  ).toHaveLength(1);
  expect(html).toContain("Notes from a working studio");
  expect(html).toContain("Four viewpoints");
  expect(html).toContain("Around a single figure");
  expect(html).toContain("Elsewhere, in detail");
  expect(html).toContain("A record in motion");
});
