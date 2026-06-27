import { describe, expect, test, vi } from "vitest";
import { BoxGeometry } from "three/src/geometries/BoxGeometry.js";
import { Mesh } from "three/src/objects/Mesh.js";

import { createTargetDescriptor } from "../../dom/targetDescriptor";
import { createResourceManager } from "../../resources/resourceManager";
import type { WebGLSceneAdapter } from "../../renderer/sceneObject";
import type { WebGLModelSourceDescriptor } from "../../source/sourceDescriptor";
import { compileRenderPolicy } from "../renderPolicy";
import { createModelRenderable } from "./modelRenderable";

describe("createModelRenderable", () => {
  test("creates a model renderable and loads a GLB through the adapter resource boundary", async () => {
    const source = createModelDescriptor("/models/hero.glb");
    const descriptor = createTargetDescriptor(
      source.anchor,
      { key: "hero.model" },
      0,
    );
    const resourceManager = createResourceManager();
    const modelScene = createModelObject("source-scene");
    const model = { scene: modelScene };
    const loadModel = vi.fn(async () => model);
    const sceneAdapter = createSceneAdapter();

    const renderable = createModelRenderable(
      {
        descriptor,
        source,
        role: "model",
        policy: compileRenderPolicy("model"),
      },
      {
        resourceManager,
        loadModel,
        sceneAdapter,
        measureElement: () => createMeasurement(10, 30, 240, 160),
      },
    );

    expect(renderable.key).toBe("hero.model");
    expect(renderable.role).toBe("model");
    expect(renderable.policy).toEqual(compileRenderPolicy("model"));
    expect(renderable.fallbackVisible).toBe(true);
    expect(renderable.resourceReady).toBe(false);

    await renderable.update();
    await renderable.update();
    renderable.updateLayout?.(createMeasurement(10, 30, 240, 160));

    expect(loadModel).toHaveBeenCalledTimes(1);
    expect(loadModel).toHaveBeenCalledWith(source);
    expect(modelScene.clone).toHaveBeenCalledTimes(1);
    expect(renderable.status).toBe("ready");
    expect(renderable.fallbackVisible).toBe(false);
    expect(renderable.resourceReady).toBe(true);
    expect(renderable.hasSceneObject).toBe(true);
    const attachedModel = sceneAdapter.objects[0]?.object3D as TestModelObject;

    expect(attachedModel).not.toBe(modelScene);
    expect(attachedModel.name).toBe("source-scene.clone");
    expect(attachedModel.position.set).toHaveBeenCalledWith(130, 490, 0);
    expect(attachedModel.scale.set).toHaveBeenCalledWith(240, 160, 1);
    expect(sceneAdapter.objects[0]).toMatchObject({
      key: "hero.model",
      object3D: attachedModel,
      visible: true,
      lastLayout: { x: 130, y: 490, width: 240, height: 160 },
    });
    expect(resourceManager.inspect("model:glb:/models/hero.glb")).toMatchObject({
      kind: "model/glb",
      status: "ready",
      value: model,
    });

    renderable.setVisible(false);
    expect(sceneAdapter.objects[0]?.visible).toBe(false);
    expect(attachedModel.visible).toBe(false);

    renderable.dispose();

    expect(sceneAdapter.removeObject).toHaveBeenCalledTimes(1);
    expect(sceneAdapter.objects[0]?.disposed).toBe(true);
    expect(attachedModel.dispose).toHaveBeenCalledTimes(1);
    expect(resourceManager.inspect("model:glb:/models/hero.glb")).toBeUndefined();
  });

  test("accepts direct loaded model objects without a GLTF scene wrapper", async () => {
    const source = createModelDescriptor("/models/direct.glb");
    const descriptor = createTargetDescriptor(
      source.anchor,
      { key: "hero.model" },
      0,
    );
    const directModel = createModelObject("direct-model");
    const sceneAdapter = createSceneAdapter();
    const renderable = createModelRenderable(
      {
        descriptor,
        source,
        role: "model",
        policy: compileRenderPolicy("model"),
      },
      {
        resourceManager: createResourceManager(),
        loadModel: async () => directModel,
        sceneAdapter,
        measureElement: () => createMeasurement(0, 0, 100, 100),
      },
    );

    await renderable.update();

    expect(sceneAdapter.objects[0]?.object3D).not.toBe(directModel);
    expect((sceneAdapter.objects[0]?.object3D as TestModelObject).name).toBe(
      "direct-model.clone",
    );
  });

  test("contains model bounds inside the anchor without stretching depth", async () => {
    const source = createModelDescriptor("/models/bounds.glb");
    const descriptor = createTargetDescriptor(
      source.anchor,
      { key: "hero.model" },
      0,
    );
    const model = new Mesh(new BoxGeometry(2, 4, 6));
    const sceneAdapter = createSceneAdapter();
    const renderable = createModelRenderable(
      {
        descriptor,
        source,
        role: "model",
        policy: compileRenderPolicy("model"),
      },
      {
        resourceManager: createResourceManager(),
        loadModel: async () => model,
        sceneAdapter,
        measureElement: () => createMeasurement(10, 30, 240, 160),
      },
    );

    await renderable.update();
    renderable.updateLayout?.(createMeasurement(10, 30, 240, 160));

    const attachedModel = sceneAdapter.objects[0]?.object3D as Mesh;

    expect(attachedModel.scale.toArray()).toEqual([40, 40, 40]);
    expect(attachedModel.position.toArray()).toEqual([130, 490, 0]);
  });

  test("creates independent scene instances for shared GLB resources", async () => {
    const source = createModelDescriptor("/models/shared.glb");
    const firstDescriptor = createTargetDescriptor(
      source.anchor,
      { key: "hero.model.first" },
      0,
    );
    const secondDescriptor = createTargetDescriptor(
      document.createElement("div"),
      { key: "hero.model.second" },
      1,
    );
    const resourceManager = createResourceManager();
    const loadedScene = createModelObject("shared-scene");
    const sharedGeometry = { dispose: vi.fn() };
    const sharedMaterial = { dispose: vi.fn() };

    loadedScene.geometry = sharedGeometry;
    loadedScene.material = sharedMaterial;
    const loadModel = vi.fn(async () => ({ scene: loadedScene }));
    const firstSceneAdapter = createSceneAdapter();
    const secondSceneAdapter = createSceneAdapter();
    const first = createModelRenderable(
      {
        descriptor: firstDescriptor,
        source,
        role: "model",
        policy: compileRenderPolicy("model"),
      },
      {
        resourceManager,
        loadModel,
        sceneAdapter: firstSceneAdapter,
        measureElement: () => createMeasurement(0, 0, 100, 100),
      },
    );
    const second = createModelRenderable(
      {
        descriptor: secondDescriptor,
        source,
        role: "model",
        policy: compileRenderPolicy("model"),
      },
      {
        resourceManager,
        loadModel,
        sceneAdapter: secondSceneAdapter,
        measureElement: () => createMeasurement(20, 20, 200, 200),
      },
    );

    await first.update();
    await second.update();

    expect(loadModel).toHaveBeenCalledTimes(1);
    expect(firstSceneAdapter.objects[0]?.object3D).not.toBe(
      secondSceneAdapter.objects[0]?.object3D,
    );

    first.setVisible(false);

    expect((firstSceneAdapter.objects[0]?.object3D as TestModelObject).visible).toBe(
      false,
    );
    expect((secondSceneAdapter.objects[0]?.object3D as TestModelObject).visible).toBe(
      true,
    );

    first.dispose();

    expect(sharedGeometry.dispose).not.toHaveBeenCalled();
    expect(sharedMaterial.dispose).not.toHaveBeenCalled();
    expect((secondSceneAdapter.objects[0]?.object3D as TestModelObject).visible).toBe(
      true,
    );
  });

  test("keeps fallback visible when the model loader fails", async () => {
    const source = createModelDescriptor("/models/missing.glb");
    const descriptor = createTargetDescriptor(
      source.anchor,
      { key: "hero.model" },
      0,
    );
    const resourceManager = createResourceManager();
    const error = new Error("model load failed");
    const sceneAdapter = createSceneAdapter();
    const renderable = createModelRenderable(
      {
        descriptor,
        source,
        role: "model",
        policy: compileRenderPolicy("model"),
      },
      {
        resourceManager,
        loadModel: async () => Promise.reject(error),
        sceneAdapter,
        measureElement: () => createMeasurement(0, 0, 100, 100),
      },
    );

    await expect(renderable.update()).rejects.toThrow("model load failed");

    expect(renderable.status).toBe("error");
    expect(renderable.fallbackVisible).toBe(true);
    expect(renderable.resourceReady).toBe(false);
    expect(renderable.hasSceneObject).toBe(false);
    expect(sceneAdapter.objects).toHaveLength(0);
    expect(resourceManager.inspect("model:glb:/models/missing.glb")).toMatchObject(
      {
        kind: "model/glb",
        status: "error",
        error,
      },
    );
  });
});

type TestSceneObject = {
  key: string;
  object3D?: unknown;
  visible: boolean;
  disposed: boolean;
  lastLayout?: unknown;
};

type TestModelObject = {
  name: string;
  visible: boolean;
  position: { set: ReturnType<typeof vi.fn> };
  scale: { set: ReturnType<typeof vi.fn> };
  geometry?: { dispose: ReturnType<typeof vi.fn> };
  material?: { dispose: ReturnType<typeof vi.fn> };
  clone: ReturnType<typeof vi.fn> & (() => TestModelObject);
  dispose: ReturnType<typeof vi.fn>;
};

function createModelObject(name: string): TestModelObject {
  const object = {
    name,
    visible: true,
    position: { set: vi.fn() },
    scale: { set: vi.fn() },
    clone: vi.fn(),
    dispose: vi.fn(),
  } as TestModelObject;

  object.clone.mockImplementation(() => {
    const clone = createModelObject(`${name}.clone`);

    clone.geometry = object.geometry;
    clone.material = object.material;

    return clone;
  });

  return object;
}

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
    viewport: { width: 800, height: 600 },
    devicePixelRatio: 1,
    layoutSignature: JSON.stringify([left, top, width, height, 800, 600, 1]),
  };
}

function createModelDescriptor(src: string): WebGLModelSourceDescriptor {
  const anchor = document.createElement("div");

  return {
    kind: "model",
    type: "glb",
    anchor,
    src,
  };
}
