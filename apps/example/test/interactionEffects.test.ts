import { describe, expect, test, vi } from "vitest";

import type {
  WebGLEffectObjectHandle,
  WebGLFrameInput,
  WebGLSceneObjectEffectContext,
  WebGLSceneObjectEffectSourceKind,
  WebGLSceneObjectPointerState,
} from "@project/dom-webgl-runtime";

import {
  exampleSceneObjectDragPoseEffect,
  exampleSceneObjectHoverPulseEffect,
} from "../src/interactionEffects";

describe("managed interaction example effects", () => {
  test("stage hover pulse only uses object pointer state", () => {
    const object = createObjectHandle("stage/plane");
    const context = createSceneObjectContext({
      sourceKind: "stage/plane",
      object,
      objectPointer: createObjectPointerState({ isHovered: true }),
    });

    exampleSceneObjectHoverPulseEffect.update(context, undefined, {
      kind: "example.sceneObjectHoverPulse",
      baseOpacity: 0.68,
      hoverOpacity: 0.92,
      dragOpacity: 1,
    });

    expect(exampleSceneObjectHoverPulseEffect.source).toBe("stage/plane");
    expect(object.opacity).toBe(0.92);
    expect("layout" in context).toBe(false);
    expect("targetPointer" in context).toBe(false);
  });

  test("model drag pose scales and yaws through the managed object facade", () => {
    const object = createObjectHandle("model/glb");
    const context = createSceneObjectContext({
      sourceKind: "model/glb",
      object,
      objectPointer: createObjectPointerState({
        isHovered: true,
        isPressed: true,
        isDragging: true,
        dragDeltaX: 18,
      }),
    });

    exampleSceneObjectDragPoseEffect.update(context, undefined, {
      kind: "example.sceneObjectDragPose",
      baseScale: 7.8,
      hoverScale: 1.04,
      dragScale: 1.1,
      baseRotationY: -0.42,
    });

    expect(exampleSceneObjectDragPoseEffect.source).toBe("model/glb");
    expect(object.visible).toBe(true);
    expect(object.scale.setScalar).toHaveBeenCalledWith(8.58);
    expect(object.rotation.set).toHaveBeenCalledWith(0, -0.27599999999999997, 0);
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
    },
  };
}
