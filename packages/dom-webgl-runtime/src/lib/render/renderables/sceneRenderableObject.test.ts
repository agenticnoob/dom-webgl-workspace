import { describe, expect, test, vi } from "vitest";

import { createElementPlaneSceneRenderableController } from "./sceneRenderableObject";

describe("element plane scene renderable", () => {
  test("does not make element snapshots visible from DOM visual CSS paint", () => {
    const element = document.createElement("section");

    Object.assign(element.style, {
      backgroundColor: "rgb(240, 248, 255)",
      border: "2px solid rgb(12, 34, 56)",
      borderRadius: "18px",
      boxShadow: "0px 8px 16px rgba(0, 0, 0, 0.2)",
    });

    const controller = createElementPlaneSceneRenderableController({
      key: "visual.surface",
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

  test("exposes an effect target for explicit solid material and pointer tilt", () => {
    const element = document.createElement("section");
    const controller = createElementPlaneSceneRenderableController({
      key: "effect.surface",
      sceneAdapter: {
        addObject: vi.fn(),
        removeObject: vi.fn(),
        render: vi.fn(),
      },
      measureElement: () => createMeasurement(),
      getViewportSize: () => ({ width: 800, height: 600 }),
      element,
    });
    const mesh = controller.object.object3D as {
      visible?: boolean;
      rotation?: { x?: number; y?: number };
      material?: {
        opacity?: number;
        transparent?: boolean;
        color?: { getHex(): number };
      };
    };

    controller.object.effectTarget?.applySolidMaterial?.({
      color: 0x112233,
      opacity: 0.42,
    });
    controller.object.effectTarget?.setRotation?.(0.1, -0.2);

    expect(mesh.visible).toBe(true);
    expect(mesh.material?.transparent).toBe(true);
    expect(mesh.material?.opacity).toBe(0.42);
    expect(mesh.material?.color?.getHex()).toBe(0x112233);
    expect(mesh.rotation?.x).toBe(0.1);
    expect(mesh.rotation?.y).toBe(-0.2);

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
