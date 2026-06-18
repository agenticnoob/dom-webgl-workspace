import { describe, expect, test, vi } from "vitest";

import { createElementPlaneSceneRenderableController } from "./sceneRenderableObject";

describe("element plane scene renderable", () => {
  test("keeps transparent layout-only element snapshots invisible", () => {
    const element = document.createElement("section");
    const controller = createElementPlaneSceneRenderableController({
      key: "layout.container",
      sceneAdapter: {
        addObject: vi.fn(),
        removeObject: vi.fn(),
        render: vi.fn(),
      },
      measureElement: () => createMeasurement(),
      getViewportSize: () => ({ width: 800, height: 600 }),
      element,
    });

    controller.updateLayout(createMeasurement());

    expect((controller.object.object3D as { visible?: boolean }).visible).toBe(
      false,
    );

    controller.controller.dispose();
  });
});

function createMeasurement() {
  return {
    x: 0,
    y: 0,
    left: 32,
    top: 40,
    right: 432,
    bottom: 340,
    width: 400,
    height: 300,
  };
}
