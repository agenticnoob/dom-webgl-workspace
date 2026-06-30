import { describe, expect, test, vi } from "vitest";

import { createTargetDescriptor } from "../../../../src/lib/dom/targetDescriptor";
import type { WebGLSceneAdapter } from "../../../../src/lib/renderer/sceneObject";
import type { WebGLDOMSourceDescriptor } from "../../../../src/lib/source/sourceDescriptor";
import { compileRenderPolicy } from "../../../../src/lib/render/renderPolicy";
import { createElementSnapshotRenderable } from "../../../../src/lib/render/renderables/elementSnapshotRenderable";

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
    expect(renderable.effectSource).toMatchObject({
      kind: "dom",
      type: "element",
      surface: expect.objectContaining({
        canvas: expect.any(HTMLCanvasElement),
        draw: expect.any(Function),
        clear: expect.any(Function),
        invalidate: expect.any(Function),
        createMaterialLayer: expect.any(Function),
      }),
    });
    const effectSource = renderable.effectSource;
    if (
      effectSource?.kind !== "dom" ||
      effectSource.type !== "element" ||
      !effectSource.surface
    ) {
      throw new Error("Expected element surface effect source.");
    }
    expect("texture" in effectSource.surface).toBe(false);
    expect("mesh" in effectSource.surface).toBe(false);
    expect("material" in effectSource.surface).toBe(false);

    renderable.setVisible(false);
    expect(sceneAdapter.objects[0]?.visible).toBe(false);

    renderable.setVisible(true);
    expect(sceneAdapter.objects[0]?.visible).toBe(true);

    renderable.dispose();

    expect(sceneAdapter.removeObject).toHaveBeenCalledTimes(1);
    expect(sceneAdapter.objects[0]?.disposed).toBe(true);
    const root = sceneAdapter.objects[0]?.object3D as
      | {
          isGroup?: boolean;
          children?: Array<{ isMesh?: boolean; geometry?: { type?: string } }>;
        }
      | undefined;
    expect(root?.isGroup).toBe(true);
    expect(root?.children?.[0]).toMatchObject({
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

  test("does not read visual CSS paint for element surface anchors", async () => {
    const element = document.createElement("section");
    Object.assign(element.style, {
      backgroundColor: "rgb(240, 248, 255)",
      border: "2px solid rgb(12, 34, 56)",
      borderRadius: "18px",
      boxShadow: "0 12px 30px rgba(0, 0, 0, 0.2)",
    });
    const descriptor = createTargetDescriptor(
      element,
      { key: "hero.surface" },
      0,
    );
    const getComputedStyle = vi.spyOn(window, "getComputedStyle");
    const sceneAdapter = createSceneAdapter();
    const renderable = createElementSnapshotRenderable(
      {
        descriptor,
        source: createSnapshotDescriptor(element),
        role: "surface",
        policy: compileRenderPolicy("surface"),
      },
      {
        measureElement: () => createMeasurement(0, 0, 200, 100),
        sceneAdapter,
      },
    );

    await renderable.update();
    renderable.updateLayout?.(createMeasurement(0, 0, 200, 100));
    renderable.updateLayout?.(createMeasurement(40, 80, 200, 100));

    expect(getComputedStyle).not.toHaveBeenCalled();
    const root = sceneAdapter.objects[0]?.object3D as
      | {
          isGroup?: boolean;
          visible?: boolean;
          children?: Array<{ material?: { opacity?: number } }>;
        }
      | undefined;
    expect(root?.isGroup).toBe(true);
    expect(root?.visible).toBe(false);
    expect(root?.children?.[0]?.material?.opacity).toBe(0);
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
): WebGLDOMSourceDescriptor {
  return {
    kind: "dom",
    type: "element",
    element,
  };
}
