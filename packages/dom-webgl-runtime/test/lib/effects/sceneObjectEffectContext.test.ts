import { describe, expect, test } from "vitest";

import { createWebGLSceneObjectEffectContext } from "../../../src/lib/effects/sceneObjectEffectContext";
import type { WebGLSceneObjectPointerState } from "../../../src/lib/effects/effectAuthoring";
import type { WebGLEffectObjectHandle } from "../../../src/lib/effects/effectObject";
import type { WebGLFrameInput } from "../../../src/lib/types";

describe("createWebGLSceneObjectEffectContext", () => {
  test("builds a scene-object context without DOM target fields", () => {
    const object = createObjectHandle();
    const objectPointer = createObjectPointerState({ isHovered: true });
    const input = createFrameInput();
    const context = createWebGLSceneObjectEffectContext({
      objectId: "runner",
      sourceKind: "model/glb",
      input,
      object,
      objectPointer,
      resources: createResourceScope(),
      progressSignals: { get: (key) => (key === "hero" ? 0.4 : 0) },
      scopes: {
        runtime: { progress: { get: (key) => (key === "hero" ? 0.4 : 0) } },
        scene: { id: "world", projection: "perspective-stage" },
      },
    });

    expect(context).toMatchObject({
      objectId: "runner",
      sourceKind: "model/glb",
      input,
      pointer: input.pointer,
      objectPointer: expect.objectContaining({ isHovered: true }),
      scene: { id: "world", projection: "perspective-stage" },
      time: 100,
      delta: 16,
      object,
    });
    expect(context.runtime.progress.get("hero")).toBe(0.4);
    expect("layout" in context).toBe(false);
    expect("targetPointer" in context).toBe(false);
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

function createResourceScope() {
  return {
    addDisposable() {},
    createObject3D<TObject>(factory: () => TObject): TObject {
      return factory();
    },
    dispose() {},
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
