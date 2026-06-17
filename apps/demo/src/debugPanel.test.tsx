import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import type { WebGLDebugState } from "@project/dom-webgl-runtime";

import { DebugPanel } from "./debugPanel";

describe("DebugPanel", () => {
  test("renders lightweight runtime debug state from the public package type", () => {
    const state: WebGLDebugState = {
      targetCount: 5,
      renderableCount: 4,
      currentScrollMode: "page",
      pointer: {
        x: 128,
        y: 256,
        normalizedX: 0.25,
        normalizedY: -0.5,
        isInside: true,
        isDown: false,
        downTime: 0,
        pressDuration: 0,
        isDragging: false,
        dragStartX: 0,
        dragStartY: 0,
        dragDeltaX: 0,
        dragDeltaY: 0,
        clickCount: 2,
      },
      targets: [],
    };

    const markup = renderToStaticMarkup(createElement(DebugPanel, { state }));

    expect(markup).toContain("Targets");
    expect(markup).toContain("5");
    expect(markup).toContain("Renderables");
    expect(markup).toContain("4");
    expect(markup).toContain("Scroll");
    expect(markup).toContain("page");
    expect(markup).toContain("Pointer");
    expect(markup).toContain("128, 256");
  });
});
