import type { WebGLSceneObjectPointerState } from "../effects/effectAuthoring";
import type {
  WebGLDebugPhysicsBodySummary,
  WebGLDebugPhysicsSummary,
  WebGLFrameInput,
  WebGLTuple3,
} from "../types";

import type {
  NormalizedColliderDeclaration,
  NormalizedPhysicsDeclaration,
} from "./physicsDeclarations";
import { inspectPhysicsDeclaration } from "./physicsDeclarations";
import type { WebGLSceneObject } from "./sceneObject";
import {
  readSceneObjectTransform,
  writeSceneObjectPosition,
} from "./sceneObjectTransform";
import type { WebGLSceneObjectEffectSourceKind } from "../effects/effectAuthoring";

export type ManagedPhysicsCandidate = {
  readonly id: string;
  readonly sceneId: string;
  readonly sourceKind: WebGLSceneObjectEffectSourceKind;
  readonly object: WebGLSceneObject;
  readonly physics: NormalizedPhysicsDeclaration;
  readonly objectPointer?: WebGLSceneObjectPointerState;
};

export type PhysicsWorld = {
  update(input: {
    readonly frameInput: WebGLFrameInput;
    readonly candidates: readonly ManagedPhysicsCandidate[];
  }): {
    readonly changed: boolean;
    readonly requiresContinuousRendering: boolean;
  };
  inspect(): WebGLDebugPhysicsSummary;
  dispose(): void;
};

type PhysicsBodyState = {
  readonly id: string;
  readonly sceneId: string;
  readonly sourceKind: WebGLSceneObjectEffectSourceKind;
  readonly object: WebGLSceneObject;
  readonly physics: NormalizedPhysicsDeclaration;
  position: WebGLTuple3;
  velocity: WebGLTuple3;
  active: boolean;
  pointerDragActive: boolean;
  pointerDragOrigin?: PointerDragOrigin;
};

type PointerDragOrigin = {
  readonly dragStartX: number;
  readonly dragStartY: number;
  readonly startPosition: WebGLTuple3;
  previousPosition: WebGLTuple3;
};

const GRAVITY: WebGLTuple3 = [0, -980, 0];
const MAX_DELTA_SECONDS = 1 / 30;
const SETTLE_EPSILON = 0.001;

export function createPhysicsWorld(): PhysicsWorld {
  const bodies = new Map<string, PhysicsBodyState>();
  let collisionCount = 0;
  let disposed = false;

  return {
    update(input): {
      readonly changed: boolean;
      readonly requiresContinuousRendering: boolean;
    } {
      if (disposed) {
        return { changed: false, requiresContinuousRendering: false };
      }

      collisionCount = 0;
      const candidatesById = new Map(
        input.candidates.map((candidate) => [candidate.id, candidate]),
      );

      for (const id of [...bodies.keys()]) {
        if (!candidatesById.has(id)) {
          bodies.delete(id);
        }
      }

      for (const candidate of input.candidates) {
        if (!candidate.physics.body) {
          continue;
        }

        const previous = bodies.get(candidate.id);
        const transform = readSceneObjectTransform(candidate.object);
        const position =
          previous && candidate.physics.body.type === "dynamic"
            ? previous.position
            : transform.position;

        bodies.set(candidate.id, {
          id: candidate.id,
          sceneId: candidate.sceneId,
          sourceKind: candidate.sourceKind,
          object: candidate.object,
          physics: candidate.physics,
          position,
          velocity: previous?.velocity ?? candidate.physics.body.velocity,
          active: false,
          pointerDragActive: false,
          ...(previous?.pointerDragOrigin
            ? { pointerDragOrigin: previous.pointerDragOrigin }
            : {}),
        });
      }

      const deltaSeconds = Math.min(
        MAX_DELTA_SECONDS,
        Math.max(0, input.frameInput.delta / 1000),
      );
      let changed = false;

      for (const body of bodies.values()) {
        const previousPosition = body.position;
        const nextPosition = updateBody(
          body,
          candidatesById.get(body.id),
          deltaSeconds,
        );

        body.position = nextPosition;
        if (hasMoved(previousPosition, nextPosition)) {
          changed = true;
        }
      }

      changed = resolveCollisions(bodies) || changed;

      for (const body of bodies.values()) {
        writeSceneObjectPosition(body.object, body.position);
      }

      const requiresContinuousRendering = Array.from(bodies.values()).some(
        shouldKeepRendering,
      );

      return { changed, requiresContinuousRendering };
    },
    inspect(): WebGLDebugPhysicsSummary {
      const bodySummaries = Array.from(bodies.values(), inspectBody);

      return {
        bodyCount: bodySummaries.length,
        activeBodyCount: bodySummaries.filter((body) => body.active).length,
        collisionCount,
        bodies: bodySummaries,
      };
    },
    dispose(): void {
      if (disposed) {
        return;
      }

      disposed = true;
      bodies.clear();
      collisionCount = 0;
    },
  };

  function updateBody(
    body: PhysicsBodyState,
    candidate: ManagedPhysicsCandidate | undefined,
    deltaSeconds: number,
  ): WebGLTuple3 {
    const declaration = body.physics.body;

    if (!declaration || declaration.type === "static" || deltaSeconds === 0) {
      body.active = false;
      body.pointerDragActive = false;
      return body.position;
    }

    const pointerDragPosition = readPointerDragPosition(
      body,
      candidate,
      deltaSeconds,
    );
    if (pointerDragPosition) {
      body.active = true;
      body.pointerDragActive = true;
      return pointerDragPosition;
    }

    body.pointerDragActive = false;
    const force = readConstraintForce(body);

    if (declaration.type === "kinematic" && !body.pointerDragActive) {
      body.velocity = [0, 0, 0];
      body.active = false;
      return readSceneObjectTransform(body.object).position;
    }

    const mass = Math.max(0.001, declaration.mass || 1);
    const gravity =
      declaration.type === "dynamic"
        ? multiplyVector(GRAVITY, declaration.gravityScale)
        : [0, 0, 0] satisfies WebGLTuple3;
    const acceleration = addVectors(gravity, multiplyVector(force, 1 / mass));
    const dampedVelocity = multiplyVector(
      addVectors(body.velocity, multiplyVector(acceleration, deltaSeconds)),
      Math.max(0, 1 - declaration.damping),
    );
    const nextPosition = addVectors(
      body.position,
      multiplyVector(dampedVelocity, deltaSeconds),
    );

    body.velocity = dampedVelocity;
    body.active =
      vectorLength(dampedVelocity) > SETTLE_EPSILON ||
      vectorLength(force) > SETTLE_EPSILON ||
      body.physics.constraints.length > 0;

    return nextPosition;
  }

  function resolveCollisions(entries: Map<string, PhysicsBodyState>): boolean {
    let changed = false;
    const staticBodies = Array.from(entries.values()).filter(
      (body) => body.physics.body?.type === "static" && body.physics.collider,
    );

    for (const body of entries.values()) {
      if (
        body.physics.body?.type !== "dynamic" ||
        !body.physics.collider ||
        body.pointerDragActive
      ) {
        continue;
      }

      for (const staticBody of staticBodies) {
        const result = resolveBodyCollision(body, staticBody);
        if (!result) {
          continue;
        }

        body.position = result.position;
        body.velocity = result.velocity;
        body.active = true;
        collisionCount += 1;
        changed = true;
      }
    }

    return changed;
  }
}

function readConstraintForce(body: PhysicsBodyState): WebGLTuple3 {
  let force: WebGLTuple3 = [0, 0, 0];

  for (const constraint of body.physics.constraints) {
    switch (constraint.kind) {
      case "anchor": {
        const offset = subtractVectors(constraint.target, body.position);
        force = addVectors(
          force,
          subtractVectors(
            multiplyVector(offset, constraint.stiffness),
            multiplyVector(body.velocity, constraint.damping),
          ),
        );
        break;
      }
      case "spring": {
        const offset = subtractVectors(constraint.target, body.position);
        const distance = vectorLength(offset);
        if (distance <= SETTLE_EPSILON) {
          break;
        }
        const direction = multiplyVector(offset, 1 / distance);
        const stretch = Math.max(0, distance - constraint.restLength);
        force = addVectors(
          force,
          subtractVectors(
            multiplyVector(direction, stretch * constraint.stiffness),
            multiplyVector(body.velocity, constraint.damping),
          ),
        );
        break;
      }
    }
  }

  return force;
}

function readPointerDragPosition(
  body: PhysicsBodyState,
  candidate: ManagedPhysicsCandidate | undefined,
  deltaSeconds: number,
): WebGLTuple3 | undefined {
  const pointer = candidate?.objectPointer;
  if (!body.physics.pointerDrag || !pointer?.isPressed || !pointer.hit) {
    if (!pointer?.isDragging) {
      body.pointerDragOrigin = undefined;
    }
    return undefined;
  }

  if (
    !body.pointerDragOrigin ||
    body.pointerDragOrigin.dragStartX !== pointer.dragStartX ||
    body.pointerDragOrigin.dragStartY !== pointer.dragStartY
  ) {
    body.pointerDragOrigin = createPointerDragOrigin(pointer, body.position);
  }

  const origin = body.pointerDragOrigin;
  const nextPosition = addVectors(origin.startPosition, [
    pointer.dragDeltaX,
    -pointer.dragDeltaY,
    0,
  ]);
  body.velocity =
    deltaSeconds > 0
      ? multiplyVector(
          subtractVectors(nextPosition, origin.previousPosition),
          1 / deltaSeconds,
        )
      : [0, 0, 0];
  origin.previousPosition = nextPosition;

  return nextPosition;
}

function createPointerDragOrigin(
  pointer: WebGLSceneObjectPointerState,
  position: WebGLTuple3,
): PointerDragOrigin {
  const startPosition = cloneVector(position);
  return {
    dragStartX: pointer.dragStartX,
    dragStartY: pointer.dragStartY,
    startPosition,
    previousPosition: startPosition,
  };
}

function cloneVector(vector: WebGLTuple3): WebGLTuple3 {
  return [vector[0], vector[1], vector[2]];
}

function resolveBodyCollision(
  body: PhysicsBodyState,
  staticBody: PhysicsBodyState,
):
  | {
      readonly position: WebGLTuple3;
      readonly velocity: WebGLTuple3;
    }
  | undefined {
  const staticCollider = staticBody.physics.collider;
  const collider = body.physics.collider;
  if (!staticCollider || !collider) {
    return undefined;
  }

  switch (staticCollider.kind) {
    case "plane":
      return resolveAgainstPlane(body, collider, staticBody, staticCollider);
    case "box":
      return resolveAgainstStaticBox(body, collider, staticBody, staticCollider);
    case "bounds":
    case "sphere":
      return undefined;
  }
}

function resolveAgainstPlane(
  body: PhysicsBodyState,
  collider: NormalizedColliderDeclaration,
  staticBody: PhysicsBodyState,
  staticCollider: Extract<NormalizedColliderDeclaration, { kind: "plane" }>,
):
  | {
      readonly position: WebGLTuple3;
      readonly velocity: WebGLTuple3;
    }
  | undefined {
  const normal = normalizeDirection(staticCollider.normal);
  const center = readColliderCenter(body.position, collider);
  const extent = readPlaneExtent(collider, normal);
  const planeOffset =
    dotVectors(normal, staticBody.position) + staticCollider.offset;
  const distance = dotVectors(normal, center) - planeOffset;
  const penetration = extent - distance;

  if (penetration <= 0) {
    return undefined;
  }

  const position = addVectors(body.position, multiplyVector(normal, penetration));
  return {
    position,
    velocity: resolveVelocity(body, normal),
  };
}

function resolveAgainstStaticBox(
  body: PhysicsBodyState,
  collider: NormalizedColliderDeclaration,
  staticBody: PhysicsBodyState,
  staticCollider: Extract<NormalizedColliderDeclaration, { kind: "box" }>,
):
  | {
      readonly position: WebGLTuple3;
      readonly velocity: WebGLTuple3;
    }
  | undefined {
  const boxCenter = addVectors(staticBody.position, staticCollider.center);
  const boxHalf = multiplyVector(staticCollider.size, 0.5);

  if (collider.kind === "sphere") {
    const sphereCenter = readColliderCenter(body.position, collider);
    const nearest = clampPointToAabb(sphereCenter, boxCenter, boxHalf);
    const offset = subtractVectors(sphereCenter, nearest);
    const distance = vectorLength(offset);
    if (distance >= collider.radius) {
      return undefined;
    }
    const normal: WebGLTuple3 =
      distance > SETTLE_EPSILON
        ? multiplyVector(offset, 1 / distance)
        : [0, 1, 0];
    const position = addVectors(
      body.position,
      multiplyVector(normal, collider.radius - distance),
    );
    return { position, velocity: resolveVelocity(body, normal) };
  }

  const bodyCenter = readColliderCenter(body.position, collider);
  const bodyHalf = readBoxHalfExtent(collider);
  const delta = subtractVectors(bodyCenter, boxCenter);
  const overlap: WebGLTuple3 = [
    boxHalf[0] + bodyHalf[0] - Math.abs(delta[0]),
    boxHalf[1] + bodyHalf[1] - Math.abs(delta[1]),
    boxHalf[2] + bodyHalf[2] - Math.abs(delta[2]),
  ];

  if (overlap[0] <= 0 || overlap[1] <= 0 || overlap[2] <= 0) {
    return undefined;
  }

  const axis = readMinimumOverlapAxis(overlap);
  const normal: WebGLTuple3 = [
    axis === 0 ? Math.sign(delta[0]) || 1 : 0,
    axis === 1 ? Math.sign(delta[1]) || 1 : 0,
    axis === 2 ? Math.sign(delta[2]) || 1 : 0,
  ];
  const position = addVectors(
    body.position,
    multiplyVector(normal, overlap[axis]),
  );

  return { position, velocity: resolveVelocity(body, normal) };
}

function resolveVelocity(
  body: PhysicsBodyState,
  normal: WebGLTuple3,
): WebGLTuple3 {
  const normalVelocity = dotVectors(body.velocity, normal);
  if (normalVelocity >= 0) {
    return body.velocity;
  }

  const restitution = body.physics.body?.restitution ?? 0;
  const friction = body.physics.body?.friction ?? 0.5;
  const reflected = subtractVectors(
    body.velocity,
    multiplyVector(normal, (1 + restitution) * normalVelocity),
  );
  const normalComponent = multiplyVector(normal, dotVectors(reflected, normal));
  const tangent = subtractVectors(reflected, normalComponent);

  return addVectors(normalComponent, multiplyVector(tangent, 1 - friction));
}

function inspectBody(body: PhysicsBodyState): WebGLDebugPhysicsBodySummary {
  const collider = inspectPhysicsDeclaration(body.physics);

  return {
    id: body.id,
    sceneId: body.sceneId,
    sourceKind: body.sourceKind,
    type: body.physics.body?.type ?? "dynamic",
    active: body.active,
    ...(collider ? { collider } : {}),
    position: body.position,
    velocity: body.velocity,
    constraints: body.physics.constraints.length,
    pointerDrag: Boolean(body.physics.pointerDrag),
  };
}

function shouldKeepRendering(body: PhysicsBodyState): boolean {
  return (
    body.active ||
    body.pointerDragActive ||
    (body.physics.body?.type === "dynamic" &&
      vectorLength(body.velocity) > SETTLE_EPSILON)
  );
}

function readColliderCenter(
  position: WebGLTuple3,
  collider: NormalizedColliderDeclaration,
): WebGLTuple3 {
  switch (collider.kind) {
    case "box":
    case "sphere":
      return addVectors(position, collider.center);
    case "bounds":
    case "plane":
      return position;
  }
}

function readPlaneExtent(
  collider: NormalizedColliderDeclaration,
  normal: WebGLTuple3,
): number {
  switch (collider.kind) {
    case "sphere":
      return collider.radius;
    case "box": {
      const half = multiplyVector(collider.size, 0.5);
      return (
        Math.abs(normal[0]) * half[0] +
        Math.abs(normal[1]) * half[1] +
        Math.abs(normal[2]) * half[2]
      );
    }
    case "bounds":
      return 0.5;
    case "plane":
      return 0;
  }
}

function readBoxHalfExtent(
  collider: NormalizedColliderDeclaration,
): WebGLTuple3 {
  switch (collider.kind) {
    case "box":
      return multiplyVector(collider.size, 0.5);
    case "sphere":
      return [collider.radius, collider.radius, collider.radius];
    case "bounds":
      return [0.5, 0.5, 0.5];
    case "plane":
      return [0, 0, 0];
  }
}

function clampPointToAabb(
  point: WebGLTuple3,
  center: WebGLTuple3,
  half: WebGLTuple3,
): WebGLTuple3 {
  return [
    clamp(point[0], center[0] - half[0], center[0] + half[0]),
    clamp(point[1], center[1] - half[1], center[1] + half[1]),
    clamp(point[2], center[2] - half[2], center[2] + half[2]),
  ];
}

function readMinimumOverlapAxis(overlap: WebGLTuple3): 0 | 1 | 2 {
  if (overlap[0] <= overlap[1] && overlap[0] <= overlap[2]) {
    return 0;
  }
  if (overlap[1] <= overlap[2]) {
    return 1;
  }
  return 2;
}

function hasMoved(previous: WebGLTuple3, next: WebGLTuple3): boolean {
  return vectorLength(subtractVectors(next, previous)) > SETTLE_EPSILON;
}

function addVectors(left: WebGLTuple3, right: WebGLTuple3): WebGLTuple3 {
  return [left[0] + right[0], left[1] + right[1], left[2] + right[2]];
}

function subtractVectors(left: WebGLTuple3, right: WebGLTuple3): WebGLTuple3 {
  return [left[0] - right[0], left[1] - right[1], left[2] - right[2]];
}

function multiplyVector(vector: WebGLTuple3, scalar: number): WebGLTuple3 {
  return [vector[0] * scalar, vector[1] * scalar, vector[2] * scalar];
}

function dotVectors(left: WebGLTuple3, right: WebGLTuple3): number {
  return left[0] * right[0] + left[1] * right[1] + left[2] * right[2];
}

function vectorLength(vector: WebGLTuple3): number {
  return Math.hypot(vector[0], vector[1], vector[2]);
}

function normalizeDirection(vector: WebGLTuple3): WebGLTuple3 {
  const length = vectorLength(vector);
  if (length <= SETTLE_EPSILON) {
    return [0, 1, 0];
  }

  return multiplyVector(vector, 1 / length);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
