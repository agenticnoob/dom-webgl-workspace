import { describe, expect, test, vi } from "vitest";
import { AnimationClip } from "three/src/animation/AnimationClip.js";
import { Group } from "three/src/objects/Group.js";

import {
  defineWebGLSceneObjectEffect,
  type WebGLEffectScopeSnapshot,
} from "../../../src/lib/effects/effectAuthoring";
import {
  createWebGLEffectRegistry,
  type WebGLEffectRegistry,
} from "../../../src/lib/effects/effectRegistry";
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
import type { WebGLFrameInput } from "../../../src/lib/types";

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

  test("preserves scene-object effects and normalizes model interaction descriptors", () => {
    const registry = createRegistry({
      worldAdapter: createSceneAdapter(),
      loadModel: async () => ({ scene: new Group() }),
    });

    registry.registerModel({
      id: "character",
      sceneId: "world",
      src: "/models/Sprint.glb",
      effects: [{ kind: "app.modelHover", strength: 0.5 }],
      interaction: {
        pickable: {
          hitTest: "bounds",
          pointer: { drag: true },
        },
      },
    });

    expect(registry.inspect().models[0]).toMatchObject({
      id: "character",
      effects: ["app.modelHover"],
      interaction: {
        pickable: {
          hitTest: "bounds",
          pointer: {
            hover: false,
            press: false,
            click: false,
            drag: true,
          },
        },
      },
    });
  });

  test("normalizes pickable true to bounds hover for models", () => {
    const registry = createRegistry({
      worldAdapter: createSceneAdapter(),
      loadModel: async () => ({ scene: new Group() }),
    });

    registry.registerModel({
      id: "hoverable",
      sceneId: "world",
      src: "/models/Sprint.glb",
      interaction: { pickable: true },
    });

    expect(registry.inspect().models[0]).toMatchObject({
      interaction: {
        pickable: {
          hitTest: "bounds",
          pointer: {
            hover: true,
            press: false,
            click: false,
            drag: false,
          },
        },
      },
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

  test("runs and disposes model scene-object effects", async () => {
    const disposeResource = vi.fn();
    const update = vi.fn();
    const worldAdapter = createSceneAdapter();
    const registry = createRegistry({
      worldAdapter,
      loadModel: async () => ({ scene: new Group() }),
      effectRegistry: createWebGLEffectRegistry([
        defineWebGLSceneObjectEffect({
          kind: "app.modelSpin",
          source: "model/glb",
          setup(ctx) {
            ctx.resources.addDisposable(disposeResource);
          },
          update(ctx) {
            ctx.object.rotation.y = 0.75;
            ctx.object.model?.src satisfies string | undefined;
            update(ctx);
          },
        }),
      ]),
      readEffectScopes: createScopes,
    });

    registry.registerModel({
      id: "character",
      sceneId: "world",
      src: "/models/Sprint.glb",
      effects: [{ kind: "app.modelSpin" }],
    });

    await registry.update(createFrameInput(), { get: () => 0 });
    registry.unregisterModel("character");
    registry.unregisterModel("character");

    const root = worldAdapter.removeObject.mock.calls[0]?.[0].object3D as Group;
    expect(root.rotation.y).toBe(0.75);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        objectId: "character",
        sourceKind: "model/glb",
        scene: { id: "world", projection: "perspective-stage" },
      }),
    );
    expect(disposeResource).toHaveBeenCalledTimes(1);
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

  test("starts legacy and explicit default clips once in declaration order", async () => {
    const worldAdapter = createSceneAdapter();
    const registry = createRegistry({
      worldAdapter,
      loadModel: async () => ({
        scene: new Group(),
        animations: [
          new AnimationClip("Idle", 1, []),
          new AnimationClip("MainSkeleton.001", 1, []),
          new AnimationClip("SpeedLines.001", 1, []),
          new AnimationClip("BagArmature.001", 1, []),
        ],
      }),
    });

    registry.registerModel({
      id: "character",
      sceneId: "world",
      src: "/models/Sprint.glb",
      animation: {
        defaultClip: { clip: "Idle", loop: "repeat" },
        defaultClips: [
          { clip: "MainSkeleton.001", loop: "repeat", fadeInMs: 160 },
          { clip: "SpeedLines.001", loop: "repeat" },
          "BagArmature.001",
        ],
      },
    });

    await registry.update({ delta: 16 }, { get: () => 0 });
    await registry.update({ delta: 16 }, { get: () => 0 });

    expect(registry.inspect().models[0]).toMatchObject({
      clips: ["Idle", "MainSkeleton.001", "SpeedLines.001", "BagArmature.001"],
      activeClips: ["Idle", "MainSkeleton.001", "SpeedLines.001", "BagArmature.001"],
    });
  });

  test("reports missing explicit default clips without throwing", async () => {
    const worldAdapter = createSceneAdapter();
    const registry = createRegistry({
      worldAdapter,
      loadModel: async () => ({
        scene: new Group(),
        animations: [new AnimationClip("MainSkeleton.001", 1, [])],
      }),
    });

    registry.registerModel({
      id: "character",
      sceneId: "world",
      src: "/models/Sprint.glb",
      animation: {
        defaultClips: ["MainSkeleton.001", "MissingSceneClip"],
      },
    });

    await registry.update({ delta: 16 }, { get: () => 0 });
    await registry.update({ delta: 16 }, { get: () => 0 });

    expect(registry.inspect().models[0]).toMatchObject({
      activeClips: ["MainSkeleton.001"],
      diagnostics: [{ kind: "missing-clip", name: "MissingSceneClip" }],
    });
  });

  test("tracks render warmup requests for prepared models", async () => {
    const worldAdapter = createSceneAdapter();
    const registry = createRegistry({
      worldAdapter,
      loadModel: async () => ({
        scene: new Group(),
        animations: [new AnimationClip("MainSkeleton.001", 1, [])],
      }),
    });

    registry.registerModel({
      id: "character",
      sceneId: "world",
      src: "/models/Sprint.glb",
      animation: { defaultClip: "MainSkeleton.001" },
      prepare: { renderWarmup: "idle" },
    });

    await registry.update({ delta: 16 }, { get: () => 0 });

    expect(registry.inspect().models[0]).toMatchObject({
      id: "character",
      prepare: { renderWarmup: "pending" },
      activeClips: ["MainSkeleton.001"],
    });
    expect(registry.consumeRenderWarmupRequests()).toEqual([
      { id: "character", sceneId: "world" },
    ]);
    expect(registry.consumeRenderWarmupRequests()).toEqual([
      { id: "character", sceneId: "world" },
    ]);

    registry.markRenderWarmupComplete("character");

    expect(registry.inspect().models[0]).toMatchObject({
      prepare: { renderWarmup: "complete" },
    });
    expect(registry.consumeRenderWarmupRequests()).toEqual([]);
  });

  test("queues prepared model loading until runtime allows prepare work", async () => {
    const worldAdapter = createSceneAdapter();
    const loadModel = vi.fn(async () => ({
      scene: new Group(),
      animations: [new AnimationClip("MainSkeleton.001", 1, [])],
    }));
    const registry = createRegistry({ worldAdapter, loadModel });

    registry.registerModel({
      id: "character",
      sceneId: "world",
      src: "/models/Sprint.glb",
      animation: { defaultClip: "MainSkeleton.001" },
      prepare: { renderWarmup: "idle" },
    });

    await registry.update(
      { delta: 16 },
      { get: () => 0 },
      { canLoadPreparedModel: () => false },
    );

    expect(loadModel).not.toHaveBeenCalled();
    expect(worldAdapter.objects).toHaveLength(0);
    expect(registry.inspect().models[0]).toMatchObject({
      id: "character",
      resourceStatus: "idle",
      prepare: { load: "queued" },
      clips: [],
      activeClips: [],
    });
  });

  test("loads queued prepared models once runtime allows prepare work", async () => {
    const worldAdapter = createSceneAdapter();
    const loadModel = vi.fn(async () => ({
      scene: new Group(),
      animations: [new AnimationClip("MainSkeleton.001", 1, [])],
    }));
    const registry = createRegistry({ worldAdapter, loadModel });

    registry.registerModel({
      id: "character",
      sceneId: "world",
      src: "/models/Sprint.glb",
      animation: { defaultClip: "MainSkeleton.001" },
      prepare: { renderWarmup: "idle" },
    });

    await registry.update(
      { delta: 16 },
      { get: () => 0 },
      { canLoadPreparedModel: () => false },
    );
    await registry.update(
      { delta: 16 },
      { get: () => 0 },
      { canLoadPreparedModel: () => true },
    );

    expect(loadModel).toHaveBeenCalledTimes(1);
    expect(worldAdapter.objects).toHaveLength(1);
    expect(registry.inspect().models[0]).toMatchObject({
      resourceStatus: "ready",
      prepare: { load: "ready", renderWarmup: "pending" },
      activeClips: ["MainSkeleton.001"],
    });
  });

  test("keeps unprepared models on the eager loading path", async () => {
    const worldAdapter = createSceneAdapter();
    const loadModel = vi.fn(async () => ({ scene: new Group() }));
    const registry = createRegistry({ worldAdapter, loadModel });

    registry.registerModel({
      id: "unprepared",
      sceneId: "world",
      src: "/models/plain.glb",
    });

    await registry.update(
      { delta: 16 },
      { get: () => 0 },
      { canLoadPreparedModel: () => false },
    );

    expect(loadModel).toHaveBeenCalledTimes(1);
    expect(worldAdapter.objects).toHaveLength(1);
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
  effectRegistry?: WebGLEffectRegistry;
  readEffectScopes?(sceneId: string): WebGLEffectScopeSnapshot;
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
    ...(options.effectRegistry ? { effectRegistry: options.effectRegistry } : {}),
    ...(options.readEffectScopes
      ? { readEffectScopes: options.readEffectScopes }
      : {}),
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

function createScopes(sceneId: string): WebGLEffectScopeSnapshot {
  return {
    runtime: { progress: { get: () => 0 } },
    scene: { id: sceneId, projection: "perspective-stage" },
  };
}

function createFrameInput(): WebGLFrameInput {
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
      isInside: true,
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
  };
}
