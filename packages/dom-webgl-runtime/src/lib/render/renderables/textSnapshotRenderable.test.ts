import { describe, expect, test, vi } from "vitest";

import { createTargetDescriptor } from "../../dom/targetDescriptor";
import type { WebGLSceneAdapter } from "../../renderer/sceneObject";
import type { WebGLSnapshotSourceDescriptor } from "../../source/sourceDescriptor";
import { compileRenderPolicy } from "../renderPolicy";
import { createTextSnapshotRenderable } from "./textSnapshotRenderable";

describe("createTextSnapshotRenderable", () => {
  test("creates a content renderable and captures target text on update", async () => {
    const element = document.createElement("h1");
    element.textContent = "Hello WebGL text";
    const descriptor = createTargetDescriptor(element, { key: "hero.title" }, 1);
    const sceneAdapter = createSceneAdapter();

    const renderable = createTextSnapshotRenderable(
      {
        descriptor,
        source: createTextSnapshotDescriptor(element),
        role: "content",
        policy: compileRenderPolicy("content"),
      },
      {
        sceneAdapter,
        measureElement: () => createMeasurement(12, 24, 200, 40),
      },
    );

    expect(renderable.key).toBe("hero.title");
    expect(renderable.role).toBe("content");
    expect(renderable.policy).toEqual(compileRenderPolicy("content"));
    expect(renderable.status).toBe("idle");

    await renderable.update();
    renderable.updateLayout?.(createMeasurement(12, 24, 200, 40));

    expect(renderable.textContent).toBe("Hello WebGL text");
    expect(sceneAdapter.objects[0]).toMatchObject({
      key: "hero.title",
      textContent: "Hello WebGL text",
      visible: true,
      lastLayout: { x: 112, y: 556, width: 200, height: 40 },
    });
    expect(renderable.status).toBe("ready");

    element.textContent = "Updated WebGL text";
    renderable.updateLayout?.(createMeasurement(12, 24, 200, 40));

    expect(sceneAdapter.objects).toHaveLength(1);
    expect(sceneAdapter.objects[0]?.textContent).toBe("Hello WebGL text");
    expect(sceneAdapter.objects[0]?.object3D).toMatchObject({
      isMesh: true,
      geometry: { type: "PlaneGeometry" },
    });
  });

  test("redraws text content only after internal content invalidation", async () => {
    const element = document.createElement("h1");
    element.textContent = "Initial";
    const descriptor = createTargetDescriptor(element, { key: "hero.title" }, 1);
    const renderable = createTextSnapshotRenderable(
      {
        descriptor,
        source: createTextSnapshotDescriptor(element),
        role: "content",
        policy: compileRenderPolicy("content"),
      },
      {
        sceneAdapter: createSceneAdapter(),
        measureElement: () => createMeasurement(0, 0, 200, 50),
      },
    );

    await renderable.update();
    element.textContent = "Changed";
    renderable.updateLayout?.(createMeasurement(0, 0, 200, 50));

    expect(renderable.textContent).toBe("Initial");

    renderable.invalidateContent?.();
    await renderable.update();

    expect(renderable.textContent).toBe("Changed");
  });

  test("does not redraw text content during repeated frame updates", async () => {
    const element = document.createElement("h1");
    element.textContent = "Initial";
    const descriptor = createTargetDescriptor(element, { key: "hero.title" }, 1);
    const renderable = createTextSnapshotRenderable(
      {
        descriptor,
        source: createTextSnapshotDescriptor(element),
        role: "content",
        policy: compileRenderPolicy("content"),
      },
      {
        sceneAdapter: createSceneAdapter(),
        measureElement: () => createMeasurement(0, 0, 200, 50),
      },
    );

    await renderable.update();
    element.textContent = "Changed";
    await renderable.update();

    expect(renderable.textContent).toBe("Initial");
  });

  test("disposes idempotently", async () => {
    const element = document.createElement("p");
    element.textContent = "Disposable copy";
    const descriptor = createTargetDescriptor(element, { key: "body.copy" }, 2);
    const sceneAdapter = createSceneAdapter();
    const renderable = createTextSnapshotRenderable(
      {
        descriptor,
        source: createTextSnapshotDescriptor(element),
        role: "content",
        policy: compileRenderPolicy("content"),
      },
      {
        sceneAdapter,
        measureElement: () => createMeasurement(0, 0, 100, 20),
      },
    );

    await renderable.update();
    expect(renderable.textContent).toBe("Disposable copy");

    renderable.dispose();
    renderable.dispose();

    expect(renderable.status).toBe("disposed");
    expect(renderable.textContent).toBe("");
    expect(sceneAdapter.removeObject).toHaveBeenCalledTimes(1);
    expect(sceneAdapter.objects[0]?.disposed).toBe(true);
  });
});

type TestSceneObject = {
  key: string;
  textContent?: string;
  visible: boolean;
  disposed: boolean;
  lastLayout?: unknown;
  object3D?: unknown;
};

function createSceneAdapter(): WebGLSceneAdapter & {
  objects: TestSceneObject[];
  removeObject: ReturnType<typeof vi.fn>;
} {
  const objects: TestSceneObject[] = [];

  return {
    objects,
    addObject(object: TestSceneObject) {
      objects.push(object);
    },
    removeObject: vi.fn(),
    render() {
      return;
    },
  } as unknown as WebGLSceneAdapter & {
    objects: TestSceneObject[];
    removeObject: ReturnType<typeof vi.fn>;
  };
}

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
  };
}

function createTextSnapshotDescriptor(
  element: HTMLElement,
): WebGLSnapshotSourceDescriptor {
  return {
    kind: "snapshot",
    mode: "text",
    element,
  };
}
