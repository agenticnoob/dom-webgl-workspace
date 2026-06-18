import { describe, expect, test, vi } from "vitest";

import { createTargetDescriptor } from "../../dom/targetDescriptor";
import type { WebGLSceneAdapter } from "../../renderer/sceneObject";
import type { WebGLSnapshotSourceDescriptor } from "../../source/sourceDescriptor";
import { compileRenderPolicy } from "../renderPolicy";
import { createElementSnapshotRenderable } from "./elementSnapshotRenderable";

describe("createElementSnapshotRenderable", () => {
  test("creates a surface renderable and applies measured layout separately", async () => {
    const element = document.createElement("section");
    const descriptor = createTargetDescriptor(
      element,
      { key: "hero.surface" },
      3,
    );
    const source = createSnapshotDescriptor(element);
    const measureElement = vi.fn(() => ({
      x: 10,
      y: 20,
      width: 300,
      height: 180,
      top: 20,
      right: 310,
      bottom: 200,
      left: 10,
    }));
    const sceneAdapter = createSceneAdapter();

    const renderable = createElementSnapshotRenderable(
      {
        descriptor,
        source,
        role: "surface",
        policy: compileRenderPolicy("surface"),
      },
      { measureElement, sceneAdapter },
    );

    expect(renderable.key).toBe("hero.surface");
    expect(renderable.role).toBe("surface");
    expect(renderable.status).toBe("idle");

    await renderable.update();
    renderable.updateLayout?.(createMeasurement(10, 20, 300, 180));

    expect(measureElement).not.toHaveBeenCalled();
    expect(sceneAdapter.addObject).toHaveBeenCalledTimes(1);
    expect(renderable.hasSceneObject).toBe(true);
    expect(renderable.status).toBe("ready");

    renderable.setVisible(false);
    expect(sceneAdapter.objects[0]?.visible).toBe(false);

    renderable.setVisible(true);
    expect(sceneAdapter.objects[0]?.visible).toBe(true);

    renderable.dispose();

    expect(sceneAdapter.removeObject).toHaveBeenCalledTimes(1);
    expect(sceneAdapter.objects[0]?.disposed).toBe(true);
    expect(sceneAdapter.objects[0]?.object3D).toMatchObject({
      isMesh: true,
      geometry: { type: "PlaneGeometry" },
    });
  });

  test("marks the renderable as disposed", () => {
    const element = document.createElement("section");
    const descriptor = createTargetDescriptor(
      element,
      { key: "hero.surface" },
      0,
    );

    const renderable = createElementSnapshotRenderable(
      {
        descriptor,
        source: createSnapshotDescriptor(element),
        role: "surface",
        policy: compileRenderPolicy("surface"),
      },
      {
        measureElement: () => ({
          x: 0,
          y: 0,
          width: 1,
          height: 1,
          top: 0,
          right: 1,
          bottom: 1,
          left: 0,
        }),
        sceneAdapter: createSceneAdapter(),
      },
    );

    renderable.dispose();

    expect(renderable.status).toBe("disposed");
  });

  test("does not rebuild the CSS box snapshot for pure position changes", async () => {
    const element = document.createElement("section");
    Object.assign(element.style, { backgroundColor: "rgb(240, 248, 255)" });
    const descriptor = createTargetDescriptor(
      element,
      { key: "hero.surface" },
      0,
    );
    const getComputedStyle = vi.spyOn(window, "getComputedStyle");
    const renderable = createElementSnapshotRenderable(
      {
        descriptor,
        source: createSnapshotDescriptor(element),
        role: "surface",
        policy: compileRenderPolicy("surface"),
      },
      {
        measureElement: () => createMeasurement(0, 0, 200, 100),
        sceneAdapter: createSceneAdapter(),
      },
    );

    await renderable.update();
    renderable.updateLayout?.(createMeasurement(0, 0, 200, 100));
    renderable.updateLayout?.(createMeasurement(40, 80, 200, 100));

    expect(getComputedStyle).toHaveBeenCalledTimes(1);
  });
});

function createMeasurement(
  left: number,
  top: number,
  width: number,
  height: number,
) {
  return {
    x: left,
    y: top,
    width,
    height,
    top,
    right: left + width,
    bottom: top + height,
    left,
    viewport: { width: 800, height: 600 },
    devicePixelRatio: 1,
    layoutSignature: JSON.stringify([left, top, width, height, 800, 600, 1]),
  };
}

type TestSceneObject = {
  key: string;
  visible: boolean;
  disposed: boolean;
  lastLayout?: unknown;
  object3D?: unknown;
};

function createSceneAdapter(): WebGLSceneAdapter & {
  objects: TestSceneObject[];
  addObject: ReturnType<typeof vi.fn>;
  removeObject: ReturnType<typeof vi.fn>;
} {
  const objects: TestSceneObject[] = [];

  return {
    objects,
    addObject: vi.fn((object: TestSceneObject) => {
      objects.push(object);
    }),
    removeObject: vi.fn(),
    render: vi.fn(),
  } as unknown as WebGLSceneAdapter & {
    objects: TestSceneObject[];
    addObject: ReturnType<typeof vi.fn>;
    removeObject: ReturnType<typeof vi.fn>;
  };
}

function createSnapshotDescriptor(
  element: HTMLElement,
): WebGLSnapshotSourceDescriptor {
  return {
    kind: "snapshot",
    mode: "element",
    element,
  };
}
