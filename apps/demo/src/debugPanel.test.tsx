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
      targets: [
        {
          key: "demo.surface",
          sourceKind: "snapshot",
          renderRole: "surface",
          resourceStatus: "ready",
          lifecycleState: "active",
          visible: true,
        },
        {
          key: "demo.image",
          sourceKind: "image",
          renderRole: "media",
          resourceStatus: "loading",
          lifecycleState: "preloading",
          visible: false,
        },
      ],
    };

    const markup = renderToStaticMarkup(createElement(DebugPanel, { state }));

    expect(markup).toContain("Targets");
    expect(markup).toContain("5");
    expect(markup).toContain("Renderables");
    expect(markup).toContain("4");
    expect(markup).toContain("WebGL visible");
    expect(markup).toContain("1/2");
    expect(markup).toContain("Scroll");
    expect(markup).toContain("page");
    expect(markup).toContain("Pointer");
    expect(markup).toContain("128, 256");
  });

  test("renders active gate state and stable scene progress", () => {
    const state: WebGLDebugState = {
      targetCount: 1,
      renderableCount: 1,
      currentScrollMode: "gate",
      activeGateKey: "demo.surface",
      sceneProgress: 0.375,
      pointer: createPointerState(),
      targets: [],
    };

    const markup = renderToStaticMarkup(createElement(DebugPanel, { state }));

    expect(markup).toContain("gate");
    expect(markup).toContain("demo.surface");
    expect(markup).toContain("0.38");
  });

  test("does not render a stale active gate key in page mode", () => {
    const state: WebGLDebugState = {
      targetCount: 1,
      renderableCount: 1,
      currentScrollMode: "page",
      activeGateKey: "demo.surface",
      sceneProgress: 0.375,
      pointer: createPointerState(),
      targets: [],
    };

    const markup = renderToStaticMarkup(createElement(DebugPanel, { state }));

    expect(markup).toContain("page");
    expect(markup).not.toContain("demo.surface");
  });
});

function createPointerState(): WebGLDebugState["pointer"] {
  return {
    x: 0,
    y: 0,
    normalizedX: 0,
    normalizedY: 0,
    isInside: false,
    isDown: false,
    downTime: 0,
    pressDuration: 0,
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0,
    dragDeltaX: 0,
    dragDeltaY: 0,
    clickCount: 0,
  };
}
