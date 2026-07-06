import { describe, expect, test, vi } from "vitest";

import {
  defineWebGLEffect,
  defineWebGLSceneObjectEffect,
  type WebGLEffectScopeSnapshot,
  type WebGLSceneObjectPointerState,
} from "../../../src/lib/effects/effectAuthoring";
import type { WebGLEffectObjectHandle } from "../../../src/lib/effects/effectObject";
import { createWebGLEffectController } from "../../../src/lib/effects/effectController";
import { createWebGLEffectRegistry } from "../../../src/lib/effects/effectRegistry";
import { createWebGLSceneObjectEffectController } from "../../../src/lib/effects/sceneObjectEffectController";
import type { WebGLFrameInput } from "../../../src/lib/types";

describe("createWebGLSceneObjectEffectController", () => {
  test("rejects target effects on scene-native objects", () => {
    expect(() =>
      createWebGLSceneObjectEffectController({
        objectId: "runner",
        sourceKind: "model/glb",
        declaration: [{ kind: "app.targetOnly" }],
        getObject: createObjectHandle,
        registry: createWebGLEffectRegistry([
          defineWebGLEffect({
            kind: "app.targetOnly",
            update() {},
          }),
        ]),
        readScopes: createScopes,
      }),
    ).toThrow('Effect "app.targetOnly" is not a scene-object effect.');
  });

  test("rejects scene-object effects on DOM targets", () => {
    expect(() =>
      createWebGLEffectController({
        key: "hero",
        declaration: [{ kind: "app.sceneObjectOnly" }],
        source: {
          kind: "dom",
          type: "element",
          element: document.createElement("div"),
        },
        registry: createWebGLEffectRegistry([
          defineWebGLSceneObjectEffect({
            kind: "app.sceneObjectOnly",
            update() {},
          }),
        ]),
      }),
    ).toThrow('Effect "app.sceneObjectOnly" is not a target effect.');
  });

  test("runs scene-object effects with object pointer and scene scope", () => {
    const update = vi.fn();
    const controller = createWebGLSceneObjectEffectController({
      objectId: "runner",
      sourceKind: "model/glb",
      declaration: [{ kind: "app.modelHover", strength: 0.5 }],
      getObject: createObjectHandle,
      getObjectPointerState: () => createObjectPointerState({ isHovered: true }),
      registry: createWebGLEffectRegistry([
        defineWebGLSceneObjectEffect({
          kind: "app.modelHover",
          source: "model/glb",
          update(ctx, _state, params: { kind: "app.modelHover"; strength: number }) {
            ctx.object.rotation.y = params.strength;
            update(ctx);
          },
        }),
      ]),
      readScopes: createScopes,
    });
    const input = createFrameInput();

    controller.update(input);

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        objectId: "runner",
        sourceKind: "model/glb",
        objectPointer: expect.objectContaining({ isHovered: true }),
        scene: { id: "world", projection: "perspective-stage" },
      }),
    );
    expect("layout" in update.mock.calls[0]![0]).toBe(false);
    expect("targetPointer" in update.mock.calls[0]![0]).toBe(false);
  });

  test("disposes scene-object effect resources once", () => {
    const disposeResource = vi.fn();
    const disposeEffect = vi.fn();
    const controller = createWebGLSceneObjectEffectController({
      objectId: "floor",
      sourceKind: "stage/plane",
      declaration: [{ kind: "app.floor" }],
      getObject: createObjectHandle,
      registry: createWebGLEffectRegistry([
        defineWebGLSceneObjectEffect({
          kind: "app.floor",
          setup(ctx) {
            ctx.resources.addDisposable(disposeResource);
          },
          update() {},
          dispose: disposeEffect,
        }),
      ]),
      readScopes: createScopes,
    });

    controller.update(createFrameInput());
    controller.dispose();
    controller.dispose();

    expect(disposeEffect).toHaveBeenCalledTimes(1);
    expect(disposeResource).toHaveBeenCalledTimes(1);
  });
});

function createObjectHandle(): WebGLEffectObjectHandle {
  return {
    sourceKind: "model/glb",
    position: createVector3(),
    rotation: createVector3(),
    scale: {
      ...createVector3(1),
      setScalar() {},
    },
    visible: true,
    opacity: 1,
  };
}

function createVector3(initial = 0) {
  return {
    x: initial,
    y: initial,
    z: initial,
    set() {},
  };
}

function createObjectPointerState(
  overrides: Partial<WebGLSceneObjectPointerState> = {},
): WebGLSceneObjectPointerState {
  return {
    isHovered: false,
    isPressed: false,
    isDragging: false,
    wasClicked: false,
    dragStartX: 0,
    dragStartY: 0,
    dragDeltaX: 0,
    dragDeltaY: 0,
    ...overrides,
  };
}

function createScopes(): WebGLEffectScopeSnapshot {
  return {
    runtime: { progress: { get: () => 0 } },
    scene: { id: "world", projection: "perspective-stage" },
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
