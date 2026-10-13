import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { WebGLScrollRuntime } from "@viselora/scroll-adapters/react";
import { PinnedScrollExample } from "../src/PinnedScrollExample";

test("pinned reveal retains its native semantic text inside the shared host", () => {
  const html = renderToStaticMarkup(
    createElement(WebGLScrollRuntime, null, createElement(PinnedScrollExample)),
  );
  const host = document.createElement("div");
  host.innerHTML = html;
  expect(host.querySelectorAll("canvas")).toHaveLength(1);
  expect(host.querySelector(".example-pinned-text")?.textContent).toContain(
    "滚动控制文字",
  );
  expect(host.querySelectorAll(".example-dom-view")).toHaveLength(1);
  expect(host.querySelector('[data-scroll-runway="post-pinned"]')).toBeNull();
});
