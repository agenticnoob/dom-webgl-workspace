import { describe, expect, test, vi } from "vitest";

import type {
  WebGLEffectObjectHandle,
  WebGLFrameInput,
  WebGLSceneObjectEffectContext,
  WebGLSceneObjectEffectSourceKind,
  WebGLSceneObjectPointerState,
} from "@viselora/dom-webgl";

import {
  examplePhysicsKinematicSweepEffect,
  exampleSceneObjectHoverPulseEffect,
} from "../src/interactionEffects";

describe("managed interaction example effects", () => {
  test("scene object hover pulse supports stage and model object sources", () => {
    const object = createObjectHandle("stage/plane");
    const context = createSceneObjectContext({
      sourceKind: "stage/plane",
      object,
      objectPointer: createObjectPointerState({ isHovered: true }),
    });

    const state = exampleSceneObjectHoverPulseEffect.setup?.(context, {
      kind: "example.sceneObjectHoverPulse",
      baseOpacity: 0.68,
      hoverOpacity: 0.92,
      clickOpacity: 1,
    }) ?? { clickUntil: 0 };

    exampleSceneObjectHoverPulseEffect.update(context, state, {
      kind: "example.sceneObjectHoverPulse",
      baseOpacity: 0.68,
      hoverOpacity: 0.92,
      clickOpacity: 1,
    });

    expect(exampleSceneObjectHoverPulseEffect.source).toEqual([
      "stage/plane",
      "stage/box",
      "model/glb",
    ]);
    expect(object.opacity).toBe(0.92);
    expect("layout" in context).toBe(false);
    expect("targetPointer" in context).toBe(false);
  });

  test("scene object hover pulse can update model opacity from object pointer state", () => {
    const object = createObjectHandle("model/glb");
    const context = createSceneObjectContext({
      sourceKind: "model/glb",
      object,
      objectPointer: createObjectPointerState({ wasClicked: true }),
    });
    const state = exampleSceneObjectHoverPulseEffect.setup?.(context, {
      kind: "example.sceneObjectHoverPulse",
      baseOpacity: 0.68,
      hoverOpacity: 0.92,
      clickOpacity: 1,
    }) ?? { clickUntil: 0 };

    exampleSceneObjectHoverPulseEffect.update(context, state, {
      kind: "example.sceneObjectHoverPulse",
      baseOpacity: 0.68,
      hoverOpacity: 0.92,
      clickOpacity: 1,
    });

    expect(object.opacity).toBe(1);
  });

  test("kinematic sweep moves a scene-native model through the object facade", () => {
    const object = createObjectHandle("model/glb");
    const context = createSceneObjectContext({
      sourceKind: "model/glb",
      object,
    });

    examplePhysicsKinematicSweepEffect.update(context, undefined, {
      kind: "example.physicsKinematicSweep",
      baseX: 252,
      amplitude: 96,
      y: -132,
      z: -70,
      speed: 0.0024,
    });

    expect(examplePhysicsKinematicSweepEffect.source).toBe("model/glb");
    expect(examplePhysicsKinematicSweepEffect.schedule).toBe("frame");
    expect(object.position.set).toHaveBeenCalledWith(
      252 + Math.sin(1600 * 0.0024) * 96,
      -132,
      -70,
    );
  });
});

function createSceneObjectContext({
  sourceKind,
  object,
  objectPointer = createObjectPointerState(),
}: {
  readonly sourceKind: WebGLSceneObjectEffectSourceKind;
  readonly object: WebGLEffectObjectHandle;
  readonly objectPointer?: WebGLSceneObjectPointerState;
}): WebGLSceneObjectEffectContext {
  const input = createFrameInput();

  return {
    objectId: "example.object",
    sourceKind,
    input,
    pointer: input.pointer,
    objectPointer,
    progress: { get: () => 0 },
    runtime: {
      progress: { get: () => 0 },
      postprocess: {
        request: vi.fn(() => ({
          update: vi.fn(),
          dispose: vi.fn(),
        })),
      },
    },
    scene: { id: "example.scene", projection: "perspective-stage" },
    time: input.time,
    delta: input.delta,
    object,
    resources: {
      addDisposable: vi.fn(),
      createObject3D: vi.fn((factory) => factory()),
      dispose: vi.fn(),
    },
  };
}

function createObjectHandle(
  sourceKind: WebGLSceneObjectEffectSourceKind,
): WebGLEffectObjectHandle {
  return {
    sourceKind,
    position: createVector3(),
    rotation: createVector3(),
    scale: {
      ...createVector3(1),
      setScalar: vi.fn(),
    },
    visible: false,
    opacity: 1,
  };
}

function createVector3(initial = 0) {
  return {
    x: initial,
    y: initial,
    z: initial,
    set: vi.fn(),
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

function createFrameInput(): WebGLFrameInput {
  return {
    time: 1600,
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
