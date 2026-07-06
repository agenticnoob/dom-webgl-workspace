import { describe, expect, test, vi } from "vitest";

import {
  defineWebGLSceneObjectEffect,
  type WebGLEffectScopeSnapshot,
} from "../../../src/lib/effects/effectAuthoring";
import {
  createWebGLEffectRegistry,
  type WebGLEffectRegistry,
} from "../../../src/lib/effects/effectRegistry";
import {
  createStageObjectRegistry,
  type StageObjectRegistry,
} from "../../../src/lib/renderer/stageObjectRegistry";
import type { WebGLFrameInput } from "../../../src/lib/types";
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

  test("inspects descriptor-only stage and light summaries", () => {
    const registry = createRegistry({
      worldAdapter: createSceneAdapter(),
      primitiveObject: createSceneObject("primitive:floor"),
      lightObject: createSceneObject("light:hero"),
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

    expect(registry.inspect()).toEqual({
      stagePrimitives: [{ id: "floor", sceneId: "world", kind: "plane" }],
      lights: [{ id: "hero", sceneId: "world", kind: "point" }],
    });
  });

  test("preserves stage primitive effects and normalizes interaction descriptors", () => {
    const floorObject = createSceneObject("primitive:floor");
    const normalizedDeclarations: unknown[] = [];
    const registry = createStageObjectRegistry({
      getSceneAdapter(sceneId) {
        if (sceneId !== "world") {
          throw new Error(`Unknown WebGL scene "${sceneId}".`);
        }

        return createSceneAdapter();
      },
      createPrimitiveObject(declaration) {
        normalizedDeclarations.push(declaration);
        return floorObject;
      },
      createLightObject() {
        return createSceneObject("light:hero");
      },
      effectRegistry: createWebGLEffectRegistry([
        defineWebGLSceneObjectEffect({
          kind: "app.floorHover",
          source: "stage/plane",
          update() {},
        }),
      ]),
    });

    registry.registerStagePrimitive({
      id: "floor",
      sceneId: "world",
      kind: "plane",
      effects: [{ kind: "app.floorHover", strength: 0.5 }],
      interaction: {
        pickable: {
          hitTest: "bounds",
          pointer: { drag: true },
        },
      },
    });

    expect(normalizedDeclarations[0]).toMatchObject({
      id: "floor",
      effects: [{ kind: "app.floorHover", strength: 0.5 }],
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
    expect(registry.inspect().stagePrimitives[0]).toMatchObject({
      effects: ["app.floorHover"],
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

  test("runs and disposes stage primitive scene-object effects", () => {
    const disposeResource = vi.fn();
    const update = vi.fn();
    const registry = createRegistry({
      worldAdapter: createSceneAdapter(),
      primitiveObject: createSceneObject("primitive:floor"),
      lightObject: createSceneObject("light:hero"),
      effectRegistry: createWebGLEffectRegistry([
        defineWebGLSceneObjectEffect({
          kind: "app.floor",
          source: "stage/plane",
          setup(ctx) {
            ctx.resources.addDisposable(disposeResource);
          },
          update(ctx) {
            ctx.scene.id satisfies string;
            update(ctx);
          },
        }),
      ]),
      readEffectScopes: createScopes,
    });

    registry.registerStagePrimitive({
      id: "floor",
      sceneId: "world",
      kind: "plane",
      effects: [{ kind: "app.floor" }],
    });

    expect(registry.updateEffects(createFrameInput())).toBe(true);
    registry.unregisterStagePrimitive("floor");
    registry.unregisterStagePrimitive("floor");

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        objectId: "floor",
        sourceKind: "stage/plane",
        scene: { id: "world", projection: "perspective-stage" },
      }),
    );
    expect(disposeResource).toHaveBeenCalledTimes(1);
  });

  test("normalizes pickable true to bounds hover for stage primitives", () => {
    const normalizedDeclarations: unknown[] = [];
    const registry = createStageObjectRegistry({
      getSceneAdapter() {
        return createSceneAdapter();
      },
      createPrimitiveObject(declaration) {
        normalizedDeclarations.push(declaration);
        return createSceneObject("primitive:floor");
      },
      createLightObject() {
        return createSceneObject("light:hero");
      },
    });

    registry.registerStagePrimitive({
      id: "floor",
      sceneId: "world",
      kind: "plane",
      interaction: { pickable: true },
    });

    expect(normalizedDeclarations[0]).toMatchObject({
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

  test("updates active timeline-bound stage and light visibility", () => {
    const floorObject = createSceneObject("primitive:floor");
    const heroLightObject = createSceneObject("light:hero");
    const registry = createRegistry({
      worldAdapter: createSceneAdapter(),
      primitiveObject: floorObject,
      lightObject: heroLightObject,
    });

    registry.registerStagePrimitive({
      id: "floor",
      sceneId: "world",
      kind: "plane",
      timeline: { id: "hero.3d", active: { from: 0.25, to: 0.75 } },
    });
    registry.registerLight({
      id: "hero",
      sceneId: "world",
      kind: "point",
      timeline: { id: "hero.3d", active: { from: 0.25, to: 0.75 } },
    });

    registry.updateTimelineState({ get: () => 0.1 });

    expect(floorObject.setVisible).toHaveBeenCalledWith(false);
    expect(heroLightObject.setVisible).toHaveBeenCalledWith(false);

    registry.updateTimelineState({ get: () => 0.5 });

    expect(floorObject.setVisible).toHaveBeenCalledWith(true);
    expect(heroLightObject.setVisible).toHaveBeenCalledWith(true);
  });

  test("keeps declaration visible false when active timeline becomes true", () => {
    const floorObject = createSceneObject("primitive:floor");
    const heroLightObject = createSceneObject("light:hero");
    const registry = createRegistry({
      worldAdapter: createSceneAdapter(),
      primitiveObject: floorObject,
      lightObject: heroLightObject,
    });

    registry.registerStagePrimitive({
      id: "floor",
      sceneId: "world",
      kind: "plane",
      visible: false,
      timeline: { id: "hero.3d", active: { from: 0.25, to: 0.75 } },
    });
    registry.registerLight({
      id: "hero",
      sceneId: "world",
      kind: "point",
      visible: false,
      timeline: { id: "hero.3d", active: { from: 0.25, to: 0.75 } },
    });

    registry.updateTimelineState({ get: () => 0.5 });

    expect(floorObject.setVisible).toHaveBeenCalledWith(false);
    expect(heroLightObject.setVisible).toHaveBeenCalledWith(false);
  });

  test("does not toggle visibility for timeline bindings without active ranges", () => {
    const floorObject = createSceneObject("primitive:floor");
    const registry = createRegistry({
      worldAdapter: createSceneAdapter(),
      primitiveObject: floorObject,
      lightObject: createSceneObject("light:hero"),
    });

    registry.registerStagePrimitive({
      id: "floor",
      sceneId: "world",
      kind: "plane",
      timeline: "hero.3d",
    });

    registry.updateTimelineState({ get: () => 0 });

    expect(floorObject.setVisible).not.toHaveBeenCalled();
  });
});

function createRegistry(options: {
  worldAdapter: WebGLSceneAdapter;
  primitiveObject: WebGLSceneObject;
  lightObject: WebGLSceneObject;
  effectRegistry?: WebGLEffectRegistry;
  readEffectScopes?(sceneId: string): WebGLEffectScopeSnapshot;
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
    ...(options.effectRegistry ? { effectRegistry: options.effectRegistry } : {}),
    ...(options.readEffectScopes
      ? { readEffectScopes: options.readEffectScopes }
      : {}),
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
