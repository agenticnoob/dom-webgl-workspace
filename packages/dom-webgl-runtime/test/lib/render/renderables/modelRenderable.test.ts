import { describe, expect, test, vi } from "vitest";
import { BoxGeometry } from "three/src/geometries/BoxGeometry.js";
import { Group } from "three/src/objects/Group.js";
import { Mesh } from "three/src/objects/Mesh.js";

import { createTargetDescriptor } from "../../../../src/lib/dom/targetDescriptor";
import { createResourceManager } from "../../../../src/lib/resources/resourceManager";
import type { WebGLSceneAdapter } from "../../../../src/lib/renderer/sceneObject";
import type { WebGLModelSourceDescriptor } from "../../../../src/lib/source/sourceDescriptor";
import type { WebGLFrameInput } from "../../../../src/lib/types";
import { compileRenderPolicy } from "../../../../src/lib/render/renderPolicy";
import { createModelRenderable } from "../../../../src/lib/render/renderables/modelRenderable";

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
    const attachedRoot = sceneAdapter.objects[0]?.object3D as TestModelRoot;
    const attachedModel = readModelRootChild(attachedRoot);

    expect(attachedModel).not.toBe(modelScene);
    expect(attachedModel.name).toBe("source-scene.clone");
    expect(attachedRoot.position.toArray()).toEqual([130, 490, 0]);
    expect(attachedRoot.scale.toArray()).toEqual([240, 160, 1]);
    expect(sceneAdapter.objects[0]).toMatchObject({
      key: "hero.model",
      object3D: attachedRoot,
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
    expect(attachedRoot.visible).toBe(false);

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

    const attachedRoot = sceneAdapter.objects[0]?.object3D as TestModelRoot;
    const attachedModel = readModelRootChild(attachedRoot);

    expect(attachedModel).not.toBe(directModel);
    expect(attachedModel.name).toBe("direct-model.clone");
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

    const attachedRoot = sceneAdapter.objects[0]?.object3D as Group;

    expect(attachedRoot.children[0]).toBeInstanceOf(Mesh);
    expect(attachedRoot.scale.toArray()).toEqual([40, 40, 40]);
    expect(attachedRoot.position.toArray()).toEqual([130, 490, 0]);
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
    const sharedGeometry = new BoxGeometry(1, 1, 1);
    const sharedGeometryDispose = vi.spyOn(sharedGeometry, "dispose");
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

    expect((firstSceneAdapter.objects[0]?.object3D as TestModelRoot).visible).toBe(
      false,
    );
    expect((secondSceneAdapter.objects[0]?.object3D as TestModelRoot).visible).toBe(
      true,
    );

    first.dispose();

    expect(sharedGeometryDispose).not.toHaveBeenCalled();
    expect(sharedMaterial.dispose).not.toHaveBeenCalled();
    expect((secondSceneAdapter.objects[0]?.object3D as TestModelRoot).visible).toBe(
      true,
    );
  });

  test("does not use app-provided model mixer escape hatches", async () => {
    const source = createModelDescriptor("/models/external-mixer.glb");
    const descriptor = createTargetDescriptor(
      source.anchor,
      { key: "hero.model" },
      0,
    );
    const mixer = { update: vi.fn() };
    const model = {
      scene: new Group(),
      animations: [],
      mixer,
    };
    const renderable = createModelRenderable(
      {
        descriptor,
        source,
        role: "model",
        policy: compileRenderPolicy("model"),
      },
      {
        resourceManager: createResourceManager(),
        sceneAdapter: createSceneAdapter(),
        measureElement: () => createMeasurement(0, 0, 100, 100),
        loadModel: async () => model,
      },
    );

    await renderable.update(createFrameInput({ delta: 16 }));
    expect(renderable.shouldRenderContinuously?.()).toBe(false);

    renderable.setVisible(false);
    await renderable.update(createFrameInput({ delta: 16 }));

    expect(mixer.update).not.toHaveBeenCalled();
    expect(renderable.shouldRenderContinuously?.()).toBe(false);
  });

  test("creates a runtime-owned animation mixer for GLB animation clips", async () => {
    vi.resetModules();
    const update = vi.fn();
    const stop = vi.fn();
    const reset = vi.fn(function reset(this: unknown) {
      return this;
    });
    const play = vi.fn(function play(this: unknown) {
      return this;
    });
    const clipAction = vi.fn(() => ({ reset, play, stop }));
    const uncacheRoot = vi.fn();
    const AnimationMixer = vi.fn(() => ({
      update,
      clipAction,
      uncacheRoot,
    }));

    vi.doMock("three/src/animation/AnimationMixer.js", () => ({
      AnimationMixer,
    }));

    const { createModelRenderable: createRenderableWithMocks } = await import(
      "../../../../src/lib/render/renderables/modelRenderable"
    );
    const source = createModelDescriptor("/models/animated-runtime.glb");
    const descriptor = createTargetDescriptor(
      source.anchor,
      { key: "hero.model.animated" },
      0,
    );
    const scene = new Group();
    const model = { scene, animations: [{ name: "Idle" }] };
    const renderable = createRenderableWithMocks(
      {
        descriptor,
        source,
        role: "model",
        policy: compileRenderPolicy("model"),
      },
      {
        resourceManager: createResourceManager(),
        sceneAdapter: createSceneAdapter(),
        measureElement: () => createMeasurement(0, 0, 100, 100),
        loadModel: async () => model,
      },
    );

    await renderable.update(createFrameInput({ delta: 16 }));
    expect(renderable.shouldRenderContinuously?.()).toBe(true);

    renderable.setVisible(false);
    await renderable.update(createFrameInput({ delta: 16 }));
    renderable.dispose();

    expect(AnimationMixer).toHaveBeenCalledWith(scene);
    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith(0.016);
    expect(uncacheRoot).toHaveBeenCalledWith(scene);

    vi.doUnmock("three/src/animation/AnimationMixer.js");
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

  test("configures DRACOLoader for Draco-compressed GLB sources", async () => {
    vi.resetModules();
    const loadAsync = vi.fn(() =>
      Promise.resolve({ scene: createModelObject("draco-model") }),
    );
    const setDRACOLoader = vi.fn();
    const setDecoderPath = vi.fn(function setDecoderPath(this: unknown) {
      return this;
    });
    const preload = vi.fn();
    const dispose = vi.fn();

    vi.doMock("three/addons/loaders/GLTFLoader.js", () => ({
      GLTFLoader: vi.fn(() => ({ loadAsync, setDRACOLoader })),
    }));
    vi.doMock("three/addons/loaders/DRACOLoader.js", () => ({
      DRACOLoader: vi.fn(() => ({ setDecoderPath, preload, dispose })),
    }));

    const { createModelRenderable: createRenderableWithMocks } = await import(
      "../../../../src/lib/render/renderables/modelRenderable"
    );
    const source = {
      kind: "model",
      type: "glb",
      anchor: document.createElement("section"),
      src: "/models/4.glb",
      loader: { draco: { decoderPath: "/draco/", preload: true } },
    } satisfies WebGLModelSourceDescriptor;
    const descriptor = createTargetDescriptor(
      source.anchor,
      { key: "hero.model.draco" },
      0,
    );
    const renderable = createRenderableWithMocks(
      {
        descriptor,
        source,
        role: "model",
        policy: compileRenderPolicy("model"),
      },
      {
        resourceManager: createResourceManager(),
        sceneAdapter: createSceneAdapter(),
        measureElement: () => createMeasurement(0, 0, 100, 100),
      },
    );

    await renderable.update(createFrameInput());

    expect(setDecoderPath).toHaveBeenCalledWith("/draco/");
    expect(preload).toHaveBeenCalledTimes(1);
    expect(setDRACOLoader).toHaveBeenCalledTimes(1);
    expect(loadAsync).toHaveBeenCalledWith("/models/4.glb");
    expect(dispose).toHaveBeenCalledTimes(1);

    vi.doUnmock("three/addons/loaders/GLTFLoader.js");
    vi.doUnmock("three/addons/loaders/DRACOLoader.js");
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
  geometry?: { dispose: () => void };
  material?: { dispose: () => void };
  clone: ReturnType<typeof vi.fn> & (() => TestModelObject);
  dispose: ReturnType<typeof vi.fn>;
};

type TestModelRoot = Group & {
  children: TestModelObject[];
};

function createModelObject(name: string): TestModelObject {
  const object = new Group() as unknown as TestModelObject;

  object.name = name;
  object.position.set = vi.fn(object.position.set.bind(object.position));
  object.scale.set = vi.fn(object.scale.set.bind(object.scale));
  object.clone = vi.fn();
  object.dispose = vi.fn();

  object.clone.mockImplementation(() => {
    const clone = createModelObject(`${name}.clone`);

    clone.geometry = object.geometry;
    clone.material = object.material;

    return clone;
  });

  return object;
}

function readModelRootChild(root: TestModelRoot): TestModelObject {
  const child = root.children[0];

  if (!child) {
    throw new Error("Expected model target root to contain the loaded model.");
  }

  return child;
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

function createFrameInput(
  input: Partial<WebGLFrameInput> = {},
): WebGLFrameInput {
  return {
    time: 100,
    delta: 16,
    scroll: {
      mode: "page",
      pageProgress: 0,
      direction: 0,
      velocity: 0,
    },
    pointer: {
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
      buttons: [],
      modifiers: { shift: false, alt: false, ctrl: false, meta: false },
    },
    ...input,
  };
}
