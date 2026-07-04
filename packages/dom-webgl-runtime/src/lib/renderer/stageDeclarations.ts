import type {
  WebGLColorValue,
  WebGLLightDeclaration,
  WebGLLightKind,
  WebGLStageMaterialDeclaration,
  WebGLStagePlaneRole,
  WebGLStagePrimitiveDeclaration,
  WebGLTuple2,
  WebGLTuple3,
} from "../types";

export type NormalizedStageMaterialDeclaration =
  | {
      kind: "standard";
      color: WebGLColorValue;
      emissive: WebGLColorValue;
      emissiveIntensity: number;
      opacity: number;
      metalness: number;
      roughness: number;
    }
  | {
      kind: "basic";
      color: WebGLColorValue;
      opacity: number;
    };

export type NormalizedStagePrimitiveDeclaration =
  | {
      id: string;
      sceneId: string;
      kind: "plane";
      role?: WebGLStagePlaneRole;
      size: WebGLTuple2;
      position: WebGLTuple3;
      rotation: WebGLTuple3;
      scale: number | WebGLTuple3;
      visible: boolean;
      material: NormalizedStageMaterialDeclaration;
    }
  | {
      id: string;
      sceneId: string;
      kind: "box";
      size: WebGLTuple3;
      position: WebGLTuple3;
      rotation: WebGLTuple3;
      scale: number | WebGLTuple3;
      visible: boolean;
      material: NormalizedStageMaterialDeclaration;
    };

export type NormalizedLightDeclaration = {
  id: string;
  sceneId: string;
  kind: WebGLLightKind;
  color: WebGLColorValue;
  intensity: number;
  position: WebGLTuple3;
  target: WebGLTuple3;
  distance: number;
  decay: number;
  visible: boolean;
};

export function normalizeStagePrimitiveDeclaration(
  declaration: WebGLStagePrimitiveDeclaration,
): NormalizedStagePrimitiveDeclaration {
  const id = normalizePublicId(
    declaration.id,
    "stage primitive",
  );
  const sceneId = normalizePublicId(declaration.sceneId, "scene");
  const position = normalizeTuple3(
    declaration.position,
    [0, 0, 0],
    "stage primitive position",
  );
  const scale = normalizeScale(declaration.scale, "stage primitive scale");
  const visible = declaration.visible ?? true;
  const material = normalizeStageMaterialDeclaration(declaration.material);

  switch (declaration.kind) {
    case "plane": {
      const role = declaration.role;
      const rotation = normalizeTuple3(
        declaration.rotation,
        readPlaneRoleRotation(role),
        "stage primitive rotation",
      );

      return {
        id,
        sceneId,
        kind: "plane",
        ...(role ? { role } : {}),
        size: normalizePositiveTuple2(
          declaration.size,
          [1, 1],
          "stage plane size",
        ),
        position,
        rotation,
        scale,
        visible,
        material,
      };
    }
    case "box":
      return {
        id,
        sceneId,
        kind: "box",
        size: normalizePositiveTuple3(
          declaration.size,
          [1, 1, 1],
          "stage box size",
        ),
        position,
        rotation: normalizeTuple3(
          declaration.rotation,
          [0, 0, 0],
          "stage primitive rotation",
        ),
        scale,
        visible,
        material,
      };
  }
}

export function normalizeLightDeclaration(
  declaration: WebGLLightDeclaration,
): NormalizedLightDeclaration {
  return {
    id: normalizePublicId(declaration.id, "light"),
    sceneId: normalizePublicId(declaration.sceneId, "scene"),
    kind: declaration.kind,
    color: declaration.color ?? "#ffffff",
    intensity: normalizeNonNegativeNumber(
      declaration.intensity,
      1,
      "light intensity",
    ),
    position: normalizeTuple3(declaration.position, [0, 0, 120], "light position"),
    target: normalizeTuple3(declaration.target, [0, 0, 0], "light target"),
    distance: normalizeNonNegativeNumber(
      declaration.distance,
      0,
      "light distance",
    ),
    decay: normalizeNonNegativeNumber(declaration.decay, 2, "light decay"),
    visible: declaration.visible ?? true,
  };
}

function normalizeStageMaterialDeclaration(
  declaration: WebGLStageMaterialDeclaration | undefined,
): NormalizedStageMaterialDeclaration {
  if (!declaration || declaration.kind === undefined || declaration.kind === "standard") {
    return {
      kind: "standard",
      color: declaration?.color ?? "#ffffff",
      emissive: declaration?.emissive ?? "#000000",
      emissiveIntensity: normalizeNonNegativeNumber(
        declaration?.emissiveIntensity,
        1,
        "stage material emissiveIntensity",
      ),
      opacity: normalizeNonNegativeNumber(
        declaration?.opacity,
        1,
        "stage material opacity",
      ),
      metalness: normalizeNonNegativeNumber(
        declaration?.metalness,
        0,
        "stage material metalness",
      ),
      roughness: normalizeNonNegativeNumber(
        declaration?.roughness,
        1,
        "stage material roughness",
      ),
    };
  }

  return {
    kind: "basic",
    color: declaration.color ?? "#ffffff",
    opacity: normalizeNonNegativeNumber(
      declaration.opacity,
      1,
      "stage material opacity",
    ),
  };
}

function normalizePublicId(value: string, kind: string): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error(`WebGL ${kind} declaration requires a non-empty id.`);
  }

  return normalized;
}

function readPlaneRoleRotation(
  role: WebGLStagePlaneRole | undefined,
): WebGLTuple3 {
  if (role === "floor") {
    return [-Math.PI / 2, 0, 0];
  }

  return [0, 0, 0];
}

function normalizeTuple3(
  value: WebGLTuple3 | undefined,
  fallback: WebGLTuple3,
  label: string,
): WebGLTuple3 {
  if (value === undefined) {
    return fallback;
  }

  if (
    !Number.isFinite(value[0]) ||
    !Number.isFinite(value[1]) ||
    !Number.isFinite(value[2])
  ) {
    throw new Error(`WebGL ${label} must contain finite numbers.`);
  }

  return [value[0], value[1], value[2]];
}

function normalizePositiveTuple2(
  value: WebGLTuple2 | undefined,
  fallback: WebGLTuple2,
  label: string,
): WebGLTuple2 {
  if (value === undefined) {
    return fallback;
  }

  if (!isFinitePositive(value[0]) || !isFinitePositive(value[1])) {
    throw new Error(`WebGL ${label} must contain finite positive numbers.`);
  }

  return [value[0], value[1]];
}

function normalizePositiveTuple3(
  value: WebGLTuple3 | undefined,
  fallback: WebGLTuple3,
  label: string,
): WebGLTuple3 {
  if (value === undefined) {
    return fallback;
  }

  if (
    !isFinitePositive(value[0]) ||
    !isFinitePositive(value[1]) ||
    !isFinitePositive(value[2])
  ) {
    throw new Error(`WebGL ${label} must contain finite positive numbers.`);
  }

  return [value[0], value[1], value[2]];
}

function normalizeScale(
  value: number | WebGLTuple3 | undefined,
  label: string,
): number | WebGLTuple3 {
  if (value === undefined) {
    return 1;
  }

  if (typeof value === "number") {
    return normalizePositiveNumber(value, 1, label);
  }

  return normalizePositiveTuple3(value, [1, 1, 1], label);
}

function normalizePositiveNumber(
  value: number | undefined,
  fallback: number,
  label: string,
): number {
  if (value === undefined) {
    return fallback;
  }

  if (!isFinitePositive(value)) {
    throw new Error(`WebGL ${label} must be a finite positive number.`);
  }

  return value;
}

function normalizeNonNegativeNumber(
  value: number | undefined,
  fallback: number,
  label: string,
): number {
  if (value === undefined) {
    return fallback;
  }

  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`WebGL ${label} must be a finite non-negative number.`);
  }

  return value;
}

function isFinitePositive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}
