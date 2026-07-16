import { describe, expect, test, vi } from "vitest";
import { BufferGeometry } from "three/src/core/BufferGeometry.js";
import { MeshPhysicalMaterial } from "three/src/materials/MeshPhysicalMaterial.js";
import { Mesh } from "three/src/objects/Mesh.js";

import { defineWebGLSceneObjectEffect } from "../../../src/lib/effects/effectAuthoring";
import { createWebGLEffectRegistry } from "../../../src/lib/effects/effectRegistry";
import { createStageObjectRegistry } from "../../../src/lib/renderer/stageObjectRegistry";
import type { WebGLFrameInput } from "../../../src/lib/types";
import type {
  WebGLSceneAdapter,
  WebGLSceneObject,
} from "../../../src/lib/renderer/sceneObject";

describe("stage object registry", () => {
  test("registers every mesh geometry discriminator and unregisters idempotently", () => {
    const adapter = createSceneAdapter();
    const declarations: unknown[] = [];
    const objects: WebGLSceneObject[] = [];
    const registry = createStageObjectRegistry({
      getSceneAdapter: () => adapter,
      createMeshObject(declaration) {
        declarations.push(declaration);
        const object = createSceneObject(declaration.id);
        objects.push(object);
        return object;
      },
    });
    const create = () => new BufferGeometry();

    registry.registerMesh({ id: "plane", sceneId: "world", geometry: { kind: "plane" } });
    registry.registerMesh({ id: "box", sceneId: "world", geometry: { kind: "box" } });
    registry.registerMesh({ id: "sphere", sceneId: "world", geometry: { kind: "sphere" } });
    registry.registerMesh({ id: "cylinder", sceneId: "world", geometry: { kind: "cylinder" } });
    registry.registerMesh({ id: "cone", sceneId: "world", geometry: { kind: "cone" } });
    registry.registerMesh({
      id: "tetrahedron",
      sceneId: "world",
      geometry: { kind: "tetrahedron" },
    });
    registry.registerMesh({
      id: "custom",
      sceneId: "world",
      geometry: { kind: "custom", create },
    });

    expect(declarations).toHaveLength(7);
    expect(registry.inspect().meshes.map(({ geometryKind }) => geometryKind)).toEqual([
      "plane",
      "box",
      "sphere",
      "cylinder",
      "cone",
      "tetrahedron",
      "custom",
    ]);
    expect(() =>
      registry.registerMesh({ id: "plane", sceneId: "world", geometry: { kind: "plane" } }),
    ).toThrow('WebGL mesh id "plane" is already registered.');

    registry.unregisterMesh("plane");
    registry.unregisterMesh("plane");
    expect(objects[0]?.dispose).toHaveBeenCalledTimes(1);
  });

  test("preserves mesh effects, interaction, physics, timeline, and screen-plane facts", () => {
    const plane = createSceneObject("plane");
    const sphere = createSceneObject("sphere");
    const disposeResource = vi.fn();
    const update = vi.fn();
    const registry = createStageObjectRegistry({
      getSceneAdapter: createSceneAdapter,
      createMeshObject: (declaration) => declaration.id === "plane" ? plane : sphere,
      effectRegistry: createWebGLEffectRegistry([
        defineWebGLSceneObjectEffect({
          kind: "app.mesh",
          source: "mesh",
          schedule: "frame",
          setup(ctx) {
            ctx.resources.addDisposable(disposeResource);
          },
          update,
        }),
      ]),
      readEffectScopes: () => ({
        runtime: { progress: { get: () => 0 } },
        scene: { id: "world", projection: "perspective-stage" },
      }),
      readObjectPointerState: () => createObjectPointerState(),
    });

    registry.registerMesh({
      id: "plane",
      sceneId: "world",
      geometry: { kind: "plane", size: [12, 8] },
      timeline: { id: "hero", active: { from: 0.25, to: 0.75 } },
      effects: [{ kind: "app.mesh" }],
      interaction: {
        pickable: { hitTest: "mesh", pointer: { hover: true, drag: true } },
      },
    });
    registry.registerMesh({
      id: "sphere",
      sceneId: "world",
      geometry: { kind: "sphere", radius: 2 },
      physics: {
        body: { type: "dynamic" },
        collider: { kind: "box", size: [3, 4, 5] },
      },
    });

    expect(registry.readMeshPlane("plane", "world")).toMatchObject({
      id: "plane",
      size: [12, 8],
    });
    expect(registry.readMeshPlane("sphere", "world")).toBeUndefined();
    expect(registry.collectHitCandidates()).toEqual([
      expect.objectContaining({ id: "plane", sourceKind: "mesh", object3D: plane.object3D }),
    ]);
    expect(registry.collectPhysicsCandidates()).toEqual([
      expect.objectContaining({
        id: "sphere",
        sourceKind: "mesh",
        object: sphere,
        physics: expect.objectContaining({
          collider: expect.objectContaining({ kind: "box", size: [3, 4, 5] }),
        }),
      }),
    ]);
    expect(registry.updateEffects(createFrameInput())).toBe(true);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ objectId: "plane", sourceKind: "mesh" }),
      undefined,
      expect.objectContaining({ kind: "app.mesh" }),
    );

    registry.updateTimelineState({ get: () => 0.1 });
    registry.updateTimelineState({ get: () => 0.5 });
    expect(plane.setVisible).toHaveBeenNthCalledWith(1, false);
    expect(plane.setVisible).toHaveBeenNthCalledWith(2, true);
    expect(registry.inspect().meshes[0]).toMatchObject({
      id: "plane",
      geometryKind: "plane",
      effects: ["app.mesh"],
    });

    registry.unregisterScene("world");
    registry.unregisterScene("world");
    expect(plane.dispose).toHaveBeenCalledTimes(1);
    expect(sphere.dispose).toHaveBeenCalledTimes(1);
    expect(disposeResource).toHaveBeenCalledTimes(1);
  });

  test("injects a managed material capability for real scene-native meshes", () => {
    const objects: WebGLSceneObject[] = [];
    const adapter = {
      addObject(object: WebGLSceneObject) {
        objects.push(object);
      },
      removeObject: vi.fn(),
      render: vi.fn(),
    } satisfies WebGLSceneAdapter;
    const sawMaterial = vi.fn();
    const registry = createStageObjectRegistry({
      getSceneAdapter: () => adapter,
      effectRegistry: createWebGLEffectRegistry([
        defineWebGLSceneObjectEffect({
          kind: "app.physicalMesh",
          source: "mesh",
          update(ctx) {
            sawMaterial(ctx.object.material, ctx.object);
            ctx.object.material?.color.set("#112233");
            ctx.object.material?.emissive.set("#334455", 0.7);
            if (ctx.object.material) {
              ctx.object.material.opacity = 0.9;
              ctx.object.material.metalness = 0.3;
              ctx.object.material.roughness = 0.4;
            }
            if (ctx.object.material?.physical) {
              ctx.object.material.physical.transmission = 0.75;
              ctx.object.material.physical.thickness = 1.1;
              ctx.object.material.physical.ior = 1.6;
            }
          },
        }),
      ]),
    });

    registry.registerMesh({
      id: "glass",
      sceneId: "world",
      geometry: { kind: "box" },
      material: { kind: "physical" },
      effects: [{ kind: "app.physicalMesh" }],
    });
    registry.updateEffects(createFrameInput());

    expect(sawMaterial).toHaveBeenCalledTimes(1);
    expect(objects[0]?.object3D).toBeInstanceOf(Mesh);
    const mesh = objects[0]?.object3D;
    if (!(mesh instanceof Mesh)) {
      throw new Error("Expected a real Three Mesh.");
    }
    expect(mesh.material).toBeInstanceOf(MeshPhysicalMaterial);
    if (!(mesh.material instanceof MeshPhysicalMaterial)) {
      throw new Error("Expected a real MeshPhysicalMaterial.");
    }
    expect(mesh.material.color.getHexString()).toBe("112233");
    expect(mesh.material.emissive.getHexString()).toBe("334455");
    expect(mesh.material).toMatchObject({
      emissiveIntensity: 0.7,
      opacity: 0.9,
      metalness: 0.3,
      roughness: 0.4,
      transmission: 0.75,
      thickness: 1.1,
      ior: 1.6,
    });

    registry.unregisterMesh("glass");
    registry.unregisterMesh("glass");
  });

  test("validates scenes before invoking custom geometry and owns successful disposal", () => {
    const adapter = createSceneAdapter();
    const geometry = new BufferGeometry();
    const disposeGeometry = vi.spyOn(geometry, "dispose");
    const create = vi.fn(() => geometry);
    const registry = createStageObjectRegistry({
      getSceneAdapter(sceneId) {
        if (sceneId !== "world") throw new Error(`Unknown WebGL scene "${sceneId}".`);
        return adapter;
      },
    });

    expect(() =>
      registry.registerMesh({
        id: "missing.custom",
        sceneId: "missing",
        geometry: { kind: "custom", create },
      }),
    ).toThrow('Unknown WebGL scene "missing".');
    expect(create).not.toHaveBeenCalled();
    expect(registry.inspect().meshes).toEqual([]);

    registry.registerMesh({
      id: "custom",
      sceneId: "world",
      geometry: { kind: "custom", create },
    });
    registry.unregisterMesh("custom");
    registry.unregisterMesh("custom");
    expect(create).toHaveBeenCalledTimes(1);
    expect(disposeGeometry).toHaveBeenCalledTimes(1);
  });

  test("registers lights with duplicate, timeline, scene, and disposal behavior intact", () => {
    const adapter = createSceneAdapter();
    const light = createSceneObject("light");
    const registry = createStageObjectRegistry({
      getSceneAdapter(sceneId) {
        if (sceneId !== "world") throw new Error(`Unknown WebGL scene "${sceneId}".`);
        return adapter;
      },
      createLightObject: () => light,
    });

    registry.registerLight({
      id: "hero",
      sceneId: "world",
      kind: "point",
      timeline: { id: "hero", active: { from: 0.25, to: 0.75 } },
    });
    expect(() =>
      registry.registerLight({ id: "hero", sceneId: "world", kind: "ambient" }),
    ).toThrow('WebGL light id "hero" is already registered.');
    registry.updateTimelineState({ get: () => 0.1 });
    expect(light.setVisible).toHaveBeenCalledWith(false);
    expect(registry.inspect().lights).toEqual([
      expect.objectContaining({ id: "hero", sceneId: "world", kind: "point" }),
    ]);
    registry.unregisterLight("hero");
    registry.unregisterLight("hero");
    expect(light.dispose).toHaveBeenCalledTimes(1);
  });
});

function createSceneAdapter(): WebGLSceneAdapter {
  return { addObject: vi.fn(), removeObject: vi.fn(), render: vi.fn() };
}

function createSceneObject(key: string): WebGLSceneObject {
  return {
    key,
    object3D: { key },
    setVisible: vi.fn(),
    updateLayout: vi.fn(),
    dispose: vi.fn(),
  };
}

function createObjectPointerState() {
  return {
    isHovered: false,
    isPressed: false,
    isDragging: false,
    wasClicked: false,
    dragStartX: 0,
    dragStartY: 0,
    dragDeltaX: 0,
    dragDeltaY: 0,
  };
}

function createFrameInput(): WebGLFrameInput {
  return {
    time: 100,
    delta: 16,
    scroll: { mode: "page", pageProgress: 0, direction: 0, velocity: 0 },
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
  };
}
