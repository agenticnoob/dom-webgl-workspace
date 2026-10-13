// @vitest-environment node
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import ProjectRoomDemo from "../../src/recipe-demos/ProjectRoomDemo";
import {
  ProjectRoom,
  type ProjectRoomItems,
} from "../../src/recipes/project-room";
import { WebGLScrollRuntime } from "@viselora/scroll-adapters/react";

test("imports and renders meaningful room fallback before browser or GPU initialization", () => {
  const html = renderToStaticMarkup(
    createElement(WebGLScrollRuntime, {
      children: createElement(ProjectRoomDemo),
    }),
  );
  expect(html).toContain("Four viewpoints");
  expect(html).toContain("Field archive");
  expect(html).toContain("Shared foundations");
  expect(html).toContain('id="demo.project-room.heading"');
  expect(html.match(/<canvas/g)).toHaveLength(1);
});

test("provides an independent transparent viewport and complete loading fallback", () => {
  const html = renderToStaticMarkup(
    createElement(WebGLScrollRuntime, null, createElement(ProjectRoomDemo)),
  );
  expect(html).toContain('class="recipe-room__surface"');
  expect(html).toContain('class="recipe-room__fallback"');
  expect(html.match(/class="recipe-room__surface"/g)).toHaveLength(1);
  expect(html).not.toContain('class="recipe-room__surface" style="background');
});

test("rejects duplicate identifiers and invalid palette before scheduling WebGL work", () => {
  const first = {
    id: "same",
    label: "A",
    title: "First",
    description: "Body",
    href: "/first",
  };
  const items = [first, first, first, first] satisfies ProjectRoomItems;
  expect(() =>
    renderToStaticMarkup(
      createElement(WebGLScrollRuntime, {
        children: createElement(ProjectRoom, { id: "example", items }),
      }),
    ),
  ).toThrow("unique");
  const validItems = [
    first,
    { ...first, id: "two" },
    { ...first, id: "three" },
    { ...first, id: "four" },
  ] satisfies ProjectRoomItems;
  expect(() =>
    renderToStaticMarkup(
      createElement(WebGLScrollRuntime, {
        children: createElement(ProjectRoom, {
          id: "example",
          items: validItems,
          palette: { background: "not-a-color", foreground: "#ffffff" },
        }),
      }),
    ),
  ).toThrow("#RRGGBB");
});
