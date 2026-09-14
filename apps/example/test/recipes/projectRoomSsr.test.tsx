// @vitest-environment node
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";
import { WebGLCamera } from "@viselora/dom-webgl/react";
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
  expect(html).not.toContain("<canvas");
});

test("declares a scoped default camera so the managed pass cannot remain deferred", () => {
  // A camera declaration has no SSR DOM; observe React's real element creation
  // while rendering the real component instead of substituting the adapter.
  const create = vi.spyOn(React, "createElement");
  try {
    renderToStaticMarkup(
      createElement(WebGLScrollRuntime, {
        children: createElement(ProjectRoomDemo),
      }),
    );
    expect(create).toHaveBeenCalledWith(WebGLCamera, {
      id: "demo.project-room.camera",
      default: true,
      type: "orthographic",
      mode: "screen",
    });
  } finally {
    create.mockRestore();
  }
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
