import { describe, expect, test, vi } from "vitest";
import { AnimationClip } from "three/src/animation/AnimationClip.js";
import { Group } from "three/src/objects/Group.js";

import { createResourceManager } from "../../../src/lib/resources/resourceManager";
import {
  createManagedModelRegistry,
  type ManagedModelRegistry,
} from "../../../src/lib/renderer/managedModelRegistry";
import type {
  WebGLSceneAdapter,
  WebGLSceneObject,
} from "../../../src/lib/renderer/sceneObject";
import type { WebGLModelSourceDescriptor } from "../../../src/lib/source/sourceDescriptor";

describe("managed model registry", () => {
  test("loads a scene-native model and attaches it to the declared scene", async () => {
    const worldAdapter = createSceneAdapter();
    const sourceScene = new Group();
    const clonedScene = new Group();
    const clone = vi.spyOn(sourceScene, "clone").mockReturnValue(clonedScene);
    const loadModel = vi.fn(async () => ({
      scene: sourceScene,
      animations: [{ name: "Idle" }],
    }));
    const registry = createRegistry({ worldAdapter, loadModel });

    registry.registerModel({
      id: "character",
      sceneId: "world",
      src: "/models/Sprint.glb",
      position: [1, 2, 3],
      rotation: [0, 1, 0],
      scale: [2, 3, 4],
    });
    await registry.update({ delta: 16 }, { get: () => 0 });

    expect(loadModel).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "model",
        type: "glb",
        src: "/models/Sprint.glb",
      }),
    );
    expect(clone).toHaveBeenCalledTimes(1);
    expect(worldAdapter.addObject).toHaveBeenCalledTimes(1);
    expect(worldAdapter.objects).toHaveLength(1);
    expect(worldAdapter.objects[0]?.key).toBe("character");

    const root = worldAdapter.objects[0]?.object3D as Group;
    expect(root.children[0]).toBe(clonedScene);
    expect(root.position.toArray()).toEqual([1, 2, 3]);
    expect(root.rotation.toArray()).toEqual([0, 1, 0, "XYZ"]);
    expect(root.scale.toArray()).toEqual([2, 3, 4]);
    expect(registry.inspect().models[0]).toMatchObject({
      id: "character",
      sceneId: "world",
      src: "/models/Sprint.glb",
      resourceStatus: "ready",
      visible: true,
      clips: ["Idle"],
      activeClips: [],
    });
  });

  test("replaces duplicate model ids and releases previous scene objects", async () => {
    const worldAdapter = createSceneAdapter();
    const loadModel = vi
      .fn<(_source: WebGLModelSourceDescriptor) => Promise<unknown>>()
      .mockResolvedValueOnce({ scene: new Group() })
      .mockResolvedValueOnce({ scene: new Group() });
    const registry = createRegistry({ worldAdapter, loadModel });

    registry.registerModel({
      id: "character",
      sceneId: "world",
      src: "/models/first.glb",
    });
    await registry.update({ delta: 16 }, { get: () => 0 });
    const firstObject = worldAdapter.objects[0];
    const firstDispose = vi.spyOn(firstObject!, "dispose");

    registry.registerModel({
      id: "character",
      sceneId: "world",
      src: "/models/second.glb",
    });
    await registry.update({ delta: 16 }, { get: () => 0 });

    expect(worldAdapter.removeObject).toHaveBeenCalledWith(firstObject);
    expect(firstDispose).toHaveBeenCalledTimes(1);
    expect(worldAdapter.objects).toHaveLength(1);
    expect(registry.inspect().models[0]?.src).toBe("/models/second.glb");
  });

  test("hides timeline-inactive models without overriding explicit visibility", async () => {
    let progress = 0;
    const worldAdapter = createSceneAdapter();
    const registry = createRegistry({
      worldAdapter,
      loadModel: async () => ({ scene: new Group() }),
    });

    registry.registerModel({
      id: "character",
      sceneId: "world",
      src: "/models/Sprint.glb",
      timeline: { id: "hero.3d", active: { from: 0.25, to: 0.75 } },
    });
    registry.registerModel({
      id: "hidden",
      sceneId: "world",
      src: "/models/hidden.glb",
      visible: false,
      timeline: { id: "hero.3d", active: { from: 0.25, to: 0.75 } },
    });

    await registry.update({ delta: 16 }, { get: () => progress });

    expect(worldAdapter.objects[0]?.object3D).toMatchObject({ visible: false });
    expect(worldAdapter.objects[1]?.object3D).toMatchObject({ visible: false });
    expect(registry.inspect().models[0]?.timeline).toMatchObject({
      id: "hero.3d",
      progressKey: "hero.3d",
      active: false,
    });

    progress = 0.5;
    await registry.update({ delta: 16 }, { get: () => progress });

    expect(worldAdapter.objects[0]?.object3D).toMatchObject({ visible: true });
    expect(worldAdapter.objects[1]?.object3D).toMatchObject({ visible: false });
  });

  test("unregisters by id, scene, and dispose idempotently", async () => {
    const worldAdapter = createSceneAdapter();
    const registry = createRegistry({
      worldAdapter,
      loadModel: async () => ({ scene: new Group() }),
    });

    registry.registerModel({
      id: "first",
      sceneId: "world",
      src: "/models/first.glb",
    });
    registry.registerModel({
      id: "second",
      sceneId: "world",
      src: "/models/second.glb",
    });
    await registry.update({ delta: 16 }, { get: () => 0 });

    const firstObject = worldAdapter.objects[0];
    const secondObject = worldAdapter.objects[1];
    const firstDispose = vi.spyOn(firstObject!, "dispose");
    const secondDispose = vi.spyOn(secondObject!, "dispose");

    registry.unregisterModel("first");
    registry.unregisterModel("first");
    registry.unregisterScene("world");
    registry.unregisterScene("world");
    registry.dispose();
    registry.dispose();

    expect(firstDispose).toHaveBeenCalledTimes(1);
    expect(secondDispose).toHaveBeenCalledTimes(1);
    expect(worldAdapter.objects).toHaveLength(0);
    expect(registry.inspect().models).toEqual([]);
  });

  test("applies declarative animation and morph bindings", async () => {
    const progress = new Map([
      ["anim.scrub", 0.25],
      ["anim.blend", 0.75],
      ["face", 0.5],
    ]);
    const worldAdapter = createSceneAdapter();
    const sourceScene = new Group();
    const clonedScene = new Group();
    const morphTarget = createMorphTarget(["Smile"]);
    clonedScene.add(morphTarget);
    vi.spyOn(sourceScene, "clone").mockReturnValue(clonedScene);
    const registry = createRegistry({
      worldAdapter,
      loadModel: async () => ({
        scene: sourceScene,
        animations: [
          new AnimationClip("Idle", 1, []),
          new AnimationClip("Run", 1, []),
          new AnimationClip("Wave", 1, []),
        ],
      }),
    });

    registry.registerModel({
      id: "character",
      sceneId: "world",
      src: "/models/Sprint.glb",
      animation: {
        defaultClip: { clip: "Run", loop: "repeat", fadeInMs: 100 },
        scrub: {
          clip: "Wave",
          timeline: { id: "anim.scrub" },
          durationSeconds: 2,
        },
        blend: {
          from: "Idle",
          to: "Run",
          timeline: { id: "anim.blend" },
        },
        morphs: [{ name: "Smile", timeline: { id: "face" }, from: 0, to: 1 }],
      },
    });

    await registry.update({ delta: 16 }, { get: (key) => progress.get(key) ?? 0 });
    await registry.update({ delta: 16 }, { get: (key) => progress.get(key) ?? 0 });

    expect(registry.inspect().models[0]).toMatchObject({
      clips: ["Idle", "Run", "Wave"],
      activeClips: expect.arrayContaining(["Run", "Wave", "Idle"]),
      morphs: ["Smile"],
    });
    expect(morphTarget.morphTargetInfluences[0]).toBe(0.5);
  });

  test("reports missing animation clips and morph targets", async () => {
    const worldAdapter = createSceneAdapter();
    const sourceScene = new Group();
    const clonedScene = new Group();
    vi.spyOn(sourceScene, "clone").mockReturnValue(clonedScene);
    const registry = createRegistry({
      worldAdapter,
      loadModel: async () => ({
        scene: sourceScene,
        animations: [new AnimationClip("Idle", 1, [])],
      }),
    });

    registry.registerModel({
      id: "character",
      sceneId: "world",
      src: "/models/Sprint.glb",
      animation: {
        defaultClip: "MissingClip",
        morphs: [{ name: "MissingMorph", weight: 1 }],
      },
    });

    await registry.update({ delta: 16 }, { get: () => 0 });
    await registry.update({ delta: 16 }, { get: () => 0 });

    expect(registry.inspect().models[0]?.diagnostics).toEqual(
      expect.arrayContaining([
        { kind: "missing-clip", name: "MissingClip" },
        { kind: "missing-morph", name: "MissingMorph" },
      ]),
    );
  });
});

function createRegistry(options: {
  worldAdapter: WebGLSceneAdapter & { objects: WebGLSceneObject[] };
  loadModel?: (source: WebGLModelSourceDescriptor) => Promise<unknown>;
}): ManagedModelRegistry {
  return createManagedModelRegistry({
    resourceManager: createResourceManager(),
    getSceneAdapter(sceneId) {
      if (sceneId !== "world") {
        throw new Error(`Unknown WebGL scene "${sceneId}".`);
      }

      return options.worldAdapter;
    },
    loadModel: options.loadModel,
  });
}

function createSceneAdapter(): WebGLSceneAdapter & {
  objects: WebGLSceneObject[];
  addObject: ReturnType<typeof vi.fn>;
  removeObject: ReturnType<typeof vi.fn>;
} {
  const objects: WebGLSceneObject[] = [];

  return {
    objects,
    addObject: vi.fn((object: WebGLSceneObject) => {
      objects.push(object);
    }),
    removeObject: vi.fn((object: WebGLSceneObject) => {
      const index = objects.indexOf(object);
      if (index >= 0) {
        objects.splice(index, 1);
      }
    }),
    render: vi.fn(),
  };
}

function createMorphTarget(
  names: readonly string[],
): Group & {
  morphTargetDictionary: Record<string, number>;
  morphTargetInfluences: number[];
} {
  const target = new Group() as Group & {
    morphTargetDictionary: Record<string, number>;
    morphTargetInfluences: number[];
  };

  target.morphTargetDictionary = Object.fromEntries(
    names.map((name, index) => [name, index]),
  );
  target.morphTargetInfluences = names.map(() => 0);

  return target;
}
