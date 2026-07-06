import type {
  WebGLColliderDeclaration,
  WebGLDebugPhysicsBodySummary,
  WebGLPhysicsBodyDeclaration,
  WebGLPhysicsBodyType,
  WebGLPhysicsConstraintDeclaration,
  WebGLPhysicsDeclaration,
  WebGLPhysicsPointerDragDeclaration,
  WebGLTuple3,
} from "../types";

export type NormalizedPhysicsBodyDeclaration = {
  readonly type: WebGLPhysicsBodyType;
  readonly mass: number;
  readonly velocity: WebGLTuple3;
  readonly gravityScale: number;
  readonly damping: number;
  readonly restitution: number;
  readonly friction: number;
};

export type NormalizedColliderDeclaration =
  | {
      readonly kind: "bounds";
      readonly padding: number | WebGLTuple3;
    }
  | {
      readonly kind: "box";
      readonly size: WebGLTuple3;
      readonly center: WebGLTuple3;
    }
  | {
      readonly kind: "sphere";
      readonly radius: number;
      readonly center: WebGLTuple3;
    }
  | {
      readonly kind: "plane";
      readonly normal: WebGLTuple3;
      readonly offset: number;
    };

export type NormalizedPhysicsConstraintDeclaration =
  | {
      readonly kind: "anchor";
      readonly target: WebGLTuple3;
      readonly stiffness: number;
      readonly damping: number;
    }
  | {
      readonly kind: "spring";
      readonly target: WebGLTuple3;
      readonly restLength: number;
      readonly stiffness: number;
      readonly damping: number;
    };

export type NormalizedPhysicsPointerDragDeclaration = {
  readonly stiffness: number;
  readonly damping: number;
  readonly maxForce: number;
};

export type NormalizedPhysicsDeclaration = {
  readonly body: NormalizedPhysicsBodyDeclaration | undefined;
  readonly collider: NormalizedColliderDeclaration | undefined;
  readonly constraints: readonly NormalizedPhysicsConstraintDeclaration[];
  readonly pointerDrag: NormalizedPhysicsPointerDragDeclaration | undefined;
};

export function normalizePhysicsDeclaration(
  declaration: WebGLPhysicsDeclaration | undefined,
): NormalizedPhysicsDeclaration | undefined {
  if (!declaration) {
    return undefined;
  }

  const body = declaration.body
    ? normalizePhysicsBodyDeclaration(declaration.body)
    : undefined;
  const collider =
    declaration.collider === false
      ? undefined
      : normalizeColliderDeclaration(declaration.collider);
  const pointerDrag = normalizePointerDragDeclaration(declaration.pointerDrag);

  return {
    body,
    collider,
    constraints: (declaration.constraints ?? []).map(
      normalizeConstraintDeclaration,
    ),
    pointerDrag,
  };
}

export function inspectPhysicsDeclaration(
  declaration: NormalizedPhysicsDeclaration | undefined,
): WebGLDebugPhysicsBodySummary["collider"] | undefined {
  if (!declaration?.collider) {
    return undefined;
  }

  return { kind: declaration.collider.kind };
}

function normalizePhysicsBodyDeclaration(
  declaration: WebGLPhysicsBodyDeclaration,
): NormalizedPhysicsBodyDeclaration {
  const type = declaration.type ?? "dynamic";
  const dynamic = type === "dynamic";

  return {
    type,
    mass: dynamic
      ? Math.max(0.001, normalizeFiniteNumber(declaration.mass, 1))
      : 0,
    velocity: normalizeTuple3(declaration.velocity, [0, 0, 0]),
    gravityScale: dynamic
      ? normalizeFiniteNumber(declaration.gravityScale, 1)
      : 0,
    damping: clamp01(normalizeFiniteNumber(declaration.damping, 0)),
    restitution: clamp01(normalizeFiniteNumber(declaration.restitution, 0)),
    friction: clamp01(normalizeFiniteNumber(declaration.friction, 0.5)),
  };
}

function normalizeColliderDeclaration(
  declaration: WebGLColliderDeclaration | undefined,
): NormalizedColliderDeclaration {
  if (
    !declaration ||
    declaration.kind === undefined ||
    declaration.kind === "bounds"
  ) {
    return {
      kind: "bounds",
      padding: normalizePadding(declaration?.padding),
    };
  }

  switch (declaration.kind) {
    case "box":
      return {
        kind: "box",
        size: normalizePositiveTuple3(declaration.size, [1, 1, 1]),
        center: normalizeTuple3(declaration.center, [0, 0, 0]),
      };
    case "sphere":
      return {
        kind: "sphere",
        radius: normalizePositiveNumber(declaration.radius, 1),
        center: normalizeTuple3(declaration.center, [0, 0, 0]),
      };
    case "plane":
      return {
        kind: "plane",
        normal: normalizeTuple3(declaration.normal, [0, 1, 0]),
        offset: normalizeFiniteNumber(declaration.offset, 0),
      };
  }
}

function normalizeConstraintDeclaration(
  declaration: WebGLPhysicsConstraintDeclaration,
): NormalizedPhysicsConstraintDeclaration {
  switch (declaration.kind) {
    case "anchor":
      return {
        kind: "anchor",
        target: normalizeTuple3(declaration.target, [0, 0, 0]),
        stiffness: clamp01(normalizeFiniteNumber(declaration.stiffness, 1)),
        damping: clamp01(normalizeFiniteNumber(declaration.damping, 0.18)),
      };
    case "spring":
      return {
        kind: "spring",
        target: normalizeTuple3(declaration.target, [0, 0, 0]),
        restLength: normalizeNonNegativeNumber(declaration.restLength, 0),
        stiffness: clamp01(normalizeFiniteNumber(declaration.stiffness, 0.24)),
        damping: clamp01(normalizeFiniteNumber(declaration.damping, 0.18)),
      };
  }
}

function normalizePointerDragDeclaration(
  declaration: WebGLPhysicsPointerDragDeclaration | undefined,
): NormalizedPhysicsPointerDragDeclaration | undefined {
  if (!declaration) {
    return undefined;
  }

  if (declaration === true) {
    return {
      stiffness: 0.24,
      damping: 0.18,
      maxForce: 1600,
    };
  }

  return {
    stiffness: clamp01(normalizeFiniteNumber(declaration.stiffness, 0.24)),
    damping: clamp01(normalizeFiniteNumber(declaration.damping, 0.18)),
    maxForce: normalizeNonNegativeNumber(declaration.maxForce, 1600),
  };
}

function normalizePadding(
  value: number | WebGLTuple3 | undefined,
): number | WebGLTuple3 {
  if (value === undefined) {
    return 0;
  }

  if (typeof value === "number") {
    return normalizeNonNegativeNumber(value, 0);
  }

  return normalizeNonNegativeTuple3(value, [0, 0, 0]);
}

function normalizeTuple3(
  value: WebGLTuple3 | undefined,
  fallback: WebGLTuple3,
): WebGLTuple3 {
  if (!value) {
    return fallback;
  }

  return [
    normalizeFiniteNumber(value[0], fallback[0]),
    normalizeFiniteNumber(value[1], fallback[1]),
    normalizeFiniteNumber(value[2], fallback[2]),
  ];
}

function normalizePositiveTuple3(
  value: WebGLTuple3 | undefined,
  fallback: WebGLTuple3,
): WebGLTuple3 {
  const normalized = normalizeTuple3(value, fallback);

  return [
    normalizePositiveNumber(normalized[0], fallback[0]),
    normalizePositiveNumber(normalized[1], fallback[1]),
    normalizePositiveNumber(normalized[2], fallback[2]),
  ];
}

function normalizeNonNegativeTuple3(
  value: WebGLTuple3,
  fallback: WebGLTuple3,
): WebGLTuple3 {
  const normalized = normalizeTuple3(value, fallback);

  return [
    normalizeNonNegativeNumber(normalized[0], fallback[0]),
    normalizeNonNegativeNumber(normalized[1], fallback[1]),
    normalizeNonNegativeNumber(normalized[2], fallback[2]),
  ];
}

function normalizeFiniteNumber(
  value: number | undefined,
  fallback: number,
): number {
  if (value === undefined || !Number.isFinite(value)) {
    return fallback;
  }

  return value;
}

function normalizePositiveNumber(
  value: number | undefined,
  fallback: number,
): number {
  const normalized = normalizeFiniteNumber(value, fallback);

  return normalized > 0 ? normalized : fallback;
}

function normalizeNonNegativeNumber(
  value: number | undefined,
  fallback: number,
): number {
  const normalized = normalizeFiniteNumber(value, fallback);

  return normalized >= 0 ? normalized : fallback;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
