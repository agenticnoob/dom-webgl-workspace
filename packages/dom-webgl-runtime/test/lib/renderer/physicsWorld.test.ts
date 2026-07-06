import { describe, expect, test } from "vitest";

import type { WebGLSceneObjectPointerState } from "../../../src/lib/effects/effectAuthoring";
import { normalizePhysicsDeclaration } from "../../../src/lib/renderer/physicsDeclarations";
import {
  createPhysicsWorld,
  type ManagedPhysicsCandidate,
} from "../../../src/lib/renderer/physicsWorld";
import type { WebGLSceneObject } from "../../../src/lib/renderer/sceneObject";
import type {
  WebGLFrameInput,
  WebGLPhysicsDeclaration,
  WebGLTuple3,
} from "../../../src/lib/types";

describe("managed physics world", () => {
  test("dynamic bodies integrate velocity, gravity, and damping", () => {
    const world = createPhysicsWorld();
    const object = createSceneObject("body", [0, 0, 0]);

    const result = world.update({
      frameInput: createFrameInput({ delta: 1000 }),
      candidates: [
        createCandidate("body", object, {
          body: {
            type: "dynamic",
            velocity: [30, 0, 0],
            gravityScale: 1,
            damping: 0,
          },
          collider: false,
        }),
      ],
    });

    expect(result).toEqual({
      changed: true,
      requiresContinuousRendering: true,
    });
    expect(readPosition(object)[0]).toBeCloseTo(1);
    expect(readPosition(object)[1]).toBeLessThan(0);
    expect(world.inspect().bodies[0]).toMatchObject({
      id: "body",
      sceneId: "world",
      type: "dynamic",
      active: true,
    });
  });

  test("static bodies do not move", () => {
    const world = createPhysicsWorld();
    const object = createSceneObject("floor", [0, 0, 0]);

    const result = world.update({
      frameInput: createFrameInput({ delta: 1000 }),
      candidates: [
        createCandidate("floor", object, {
          body: { type: "static", velocity: [30, -30, 0] },
          collider: { kind: "plane", normal: [0, 1, 0], offset: 0 },
        }),
      ],
    });

    expect(result).toEqual({
      changed: false,
      requiresContinuousRendering: false,
    });
    expect(readPosition(object)).toEqual([0, 0, 0]);
  });

  test("kinematic bodies keep descriptor transform unless pointer drag is active", () => {
    const world = createPhysicsWorld();
    const object = createSceneObject("handle", [0, 0, 0]);

    world.update({
      frameInput: createFrameInput({ delta: 1000 }),
      candidates: [
        createCandidate("handle", object, {
          body: { type: "kinematic", velocity: [30, 0, 0] },
          pointerDrag: true,
        }),
      ],
    });

    expect(readPosition(object)).toEqual([0, 0, 0]);

    world.update({
      frameInput: createFrameInput({ delta: 1000 }),
      candidates: [
        createCandidate(
          "handle",
          object,
          {
            body: { type: "kinematic", velocity: [30, 0, 0] },
            pointerDrag: true,
          },
          createObjectPointerState({
            isDragging: true,
            hit: { point: [30, 0, 0], distance: 10 },
          }),
        ),
      ],
    });

    expect(readPosition(object)[0]).toBeGreaterThan(0);
  });

  test("spring constraints pull a body toward their target", () => {
    const world = createPhysicsWorld();
    const object = createSceneObject("spring", [0, 0, 0]);

    world.update({
      frameInput: createFrameInput({ delta: 1000 }),
      candidates: [
        createCandidate("spring", object, {
          body: { type: "dynamic", gravityScale: 0, damping: 0 },
          collider: false,
          constraints: [
            { kind: "spring", target: [30, 0, 0], stiffness: 1, damping: 0 },
          ],
        }),
      ],
    });

    expect(readPosition(object)[0]).toBeGreaterThan(0);
  });

  test("sphere and box bodies resolve against a static plane", () => {
    const world = createPhysicsWorld();
    const floor = createSceneObject("floor", [0, 0, 0]);
    const sphere = createSceneObject("sphere", [0, -5, 0]);
    const box = createSceneObject("box", [20, -2, 0]);

    world.update({
      frameInput: createFrameInput({ delta: 16 }),
      candidates: [
        createCandidate("floor", floor, {
          body: { type: "static" },
          collider: { kind: "plane", normal: [0, 1, 0], offset: 0 },
        }),
        createCandidate("sphere", sphere, {
          body: { type: "dynamic", gravityScale: 0, restitution: 0 },
          collider: { kind: "sphere", radius: 10 },
        }),
        createCandidate("box", box, {
          body: { type: "dynamic", gravityScale: 0, restitution: 0 },
          collider: { kind: "box", size: [10, 10, 10] },
        }),
      ],
    });

    expect(readPosition(sphere)[1]).toBeCloseTo(10);
    expect(readPosition(box)[1]).toBeCloseTo(5);
    expect(world.inspect().collisionCount).toBe(2);
  });

  test("pointer drag creates a spring target from object pointer hit state", () => {
    const world = createPhysicsWorld();
    const object = createSceneObject("drag", [0, 0, 0]);

    const result = world.update({
      frameInput: createFrameInput({ delta: 1000 }),
      candidates: [
        createCandidate(
          "drag",
          object,
          {
            body: { type: "dynamic", gravityScale: 0, damping: 0 },
            collider: false,
            pointerDrag: { stiffness: 1, damping: 0, maxForce: 1000 },
          },
          createObjectPointerState({
            isDragging: true,
            hit: { point: [30, 0, 0], distance: 10 },
          }),
        ),
      ],
    });

    expect(result.requiresContinuousRendering).toBe(true);
    expect(readPosition(object)[0]).toBeGreaterThan(0);
    expect(world.inspect().bodies[0]?.pointerDrag).toBe(true);
  });

  test("dispose clears bodies and inspect returns an empty summary", () => {
    const world = createPhysicsWorld();
    const object = createSceneObject("body", [0, 0, 0]);

    world.update({
      frameInput: createFrameInput({ delta: 16 }),
      candidates: [
        createCandidate("body", object, {
          body: { type: "dynamic", velocity: [1, 0, 0] },
        }),
      ],
    });

    world.dispose();
    world.dispose();

    expect(world.inspect()).toEqual({
      bodyCount: 0,
      activeBodyCount: 0,
      collisionCount: 0,
      bodies: [],
    });
  });
});

type TestSceneObject = WebGLSceneObject & {
  readonly object3D: {
    readonly position: MutableVector3;
    readonly rotation: MutableVector3;
    readonly scale: MutableVector3;
  };
};

type MutableVector3 = {
  x: number;
  y: number;
  z: number;
  set(x: number, y: number, z: number): void;
};

function createCandidate(
  id: string,
  object: TestSceneObject,
  physics: WebGLPhysicsDeclaration,
  objectPointer?: WebGLSceneObjectPointerState,
): ManagedPhysicsCandidate {
  const normalizedPhysics = normalizePhysicsDeclaration(physics);

  if (!normalizedPhysics) {
    throw new Error("Expected normalized physics declaration.");
  }

  return {
    id,
    sceneId: "world",
    sourceKind: "stage/box",
    object,
    physics: normalizedPhysics,
    ...(objectPointer ? { objectPointer } : {}),
  };
}

function createSceneObject(id: string, position: WebGLTuple3): TestSceneObject {
  return {
    key: id,
    object3D: {
      position: createVector3(position),
      rotation: createVector3([0, 0, 0]),
      scale: createVector3([1, 1, 1]),
    },
    setVisible() {},
    updateLayout() {},
    dispose() {},
  };
}

function createVector3(value: WebGLTuple3): MutableVector3 {
  return {
    x: value[0],
    y: value[1],
    z: value[2],
    set(x, y, z) {
      this.x = x;
      this.y = y;
      this.z = z;
    },
  };
}

function readPosition(object: TestSceneObject): WebGLTuple3 {
  const { position } = object.object3D;

  return [position.x, position.y, position.z];
}

function createObjectPointerState(
  state: Partial<WebGLSceneObjectPointerState>,
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
    ...state,
  };
}

function createFrameInput({
  delta,
}: {
  readonly delta: number;
}): WebGLFrameInput {
  return {
    time: 100,
    delta,
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
