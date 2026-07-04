import { describe, expect, test, vi } from "vitest";

import {
  createStageObjectRegistry,
  type StageObjectRegistry,
} from "../../../src/lib/renderer/stageObjectRegistry";
import type {
  WebGLSceneAdapter,
  WebGLSceneObject,
} from "../../../src/lib/renderer/sceneObject";

describe("stage object registry", () => {
  test("registers and unregisters stage primitives and lights", () => {
    const worldAdapter = createSceneAdapter();
    const floorObject = createSceneObject("primitive:floor");
    const heroLightObject = createSceneObject("light:hero");
    const registry = createRegistry({
      worldAdapter,
      primitiveObject: floorObject,
      lightObject: heroLightObject,
    });

    registry.registerStagePrimitive({
      id: "floor",
      sceneId: "world",
      kind: "plane",
    });
    registry.registerLight({
      id: "hero",
      sceneId: "world",
      kind: "point",
    });

    expect(worldAdapter.addObject).toHaveBeenCalledTimes(2);
    expect(worldAdapter.addObject).toHaveBeenNthCalledWith(1, floorObject);
    expect(worldAdapter.addObject).toHaveBeenNthCalledWith(2, heroLightObject);

    registry.unregisterStagePrimitive("floor");
    registry.unregisterLight("hero");

    expect(worldAdapter.removeObject).toHaveBeenCalledTimes(2);
    expect(worldAdapter.removeObject).toHaveBeenNthCalledWith(1, floorObject);
    expect(worldAdapter.removeObject).toHaveBeenNthCalledWith(2, heroLightObject);
    expect(floorObject.dispose).toHaveBeenCalledTimes(1);
    expect(heroLightObject.dispose).toHaveBeenCalledTimes(1);
  });

  test("rejects duplicate ids within each stage object kind", () => {
    const registry = createRegistry({
      worldAdapter: createSceneAdapter(),
      primitiveObject: createSceneObject("primitive:floor"),
      lightObject: createSceneObject("light:floor"),
    });

    registry.registerStagePrimitive({
      id: "floor",
      sceneId: "world",
      kind: "plane",
    });
    registry.registerLight({
      id: "floor",
      sceneId: "world",
      kind: "ambient",
    });

    expect(() =>
      registry.registerStagePrimitive({
        id: "floor",
        sceneId: "world",
        kind: "plane",
      }),
    ).toThrow('WebGL stage primitive id "floor" is already registered.');

    expect(() =>
      registry.registerLight({
        id: "floor",
        sceneId: "world",
        kind: "ambient",
      }),
    ).toThrow('WebGL light id "floor" is already registered.');
  });

  test("surfaces missing scene diagnostics before retaining objects", () => {
    const worldAdapter = createSceneAdapter();
    const floorObject = createSceneObject("primitive:floor");
    const registry = createRegistry({
      worldAdapter,
      primitiveObject: floorObject,
      lightObject: createSceneObject("light:missing"),
    });

    expect(() =>
      registry.registerLight({
        id: "missing.light",
        sceneId: "missing",
        kind: "ambient",
      }),
    ).toThrow('Unknown WebGL scene "missing".');
    expect(worldAdapter.addObject).not.toHaveBeenCalled();
    expect(floorObject.dispose).not.toHaveBeenCalled();
  });

  test("cleans up all objects for a scene idempotently", () => {
    const worldAdapter = createSceneAdapter();
    const floorObject = createSceneObject("primitive:floor");
    const heroLightObject = createSceneObject("light:hero");
    const registry = createRegistry({
      worldAdapter,
      primitiveObject: floorObject,
      lightObject: heroLightObject,
    });

    registry.registerStagePrimitive({
      id: "floor",
      sceneId: "world",
      kind: "plane",
    });
    registry.registerLight({
      id: "hero",
      sceneId: "world",
      kind: "point",
    });

    registry.unregisterScene("world");
    registry.unregisterScene("world");
    registry.dispose();

    expect(worldAdapter.removeObject).toHaveBeenCalledTimes(2);
    expect(floorObject.dispose).toHaveBeenCalledTimes(1);
    expect(heroLightObject.dispose).toHaveBeenCalledTimes(1);
  });
});

function createRegistry(options: {
  worldAdapter: WebGLSceneAdapter;
  primitiveObject: WebGLSceneObject;
  lightObject: WebGLSceneObject;
}): StageObjectRegistry {
  return createStageObjectRegistry({
    getSceneAdapter(sceneId) {
      if (sceneId !== "world") {
        throw new Error(`Unknown WebGL scene "${sceneId}".`);
      }

      return options.worldAdapter;
    },
    createPrimitiveObject() {
      return options.primitiveObject;
    },
    createLightObject() {
      return options.lightObject;
    },
  });
}

function createSceneAdapter(): WebGLSceneAdapter {
  return {
    addObject: vi.fn(),
    removeObject: vi.fn(),
    render: vi.fn(),
  };
}

function createSceneObject(key: string): WebGLSceneObject {
  return {
    key,
    setVisible: vi.fn(),
    updateLayout: vi.fn(),
    dispose: vi.fn(),
  };
}
