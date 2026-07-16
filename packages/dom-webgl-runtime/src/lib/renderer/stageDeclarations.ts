import type {
  WebGLColorValue,
  WebGLEffectsDeclaration,
  WebGLLightDeclaration,
  WebGLLightKind,
  WebGLMeshDeclaration,
  WebGLMeshMaterialDeclaration,
  WebGLPlaneRole,
  WebGLTuple2,
  WebGLTuple3,
} from "../types";
import {
  normalizePhysicsDeclaration,
  type NormalizedPhysicsDeclaration,
} from "./physicsDeclarations";
import {
  normalizeTimelineBinding,
  type NormalizedTimelineBinding,
} from "../timeline/timelineDeclarations";
import {
  normalizeSceneObjectEffects,
  normalizeSceneObjectInteraction,
  type NormalizedSceneObjectInteractionDeclaration,
} from "./sceneObjectInteractionDeclarations";

export type NormalizedMeshMaterialDeclaration =
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
      kind: "physical";
      color: WebGLColorValue;
      emissive: WebGLColorValue;
      emissiveIntensity: number;
      opacity: number;
      metalness: number;
      roughness: number;
      transmission: number;
      thickness: number;
      ior: number;
    }
  | {
      kind: "basic";
      color: WebGLColorValue;
      opacity: number;
    };

export type NormalizedMeshGeometryDeclaration =
  | {
      kind: "plane";
      role?: WebGLPlaneRole;
      size: WebGLTuple2;
    }
  | {
      kind: "box";
      size: WebGLTuple3;
    }
  | {
      kind: "sphere";
      radius: number;
      widthSegments: number;
      heightSegments: number;
    }
  | {
      kind: "cylinder";
      radiusTop: number;
      radiusBottom: number;
      height: number;
      radialSegments: number;
      heightSegments: number;
      openEnded: boolean;
    }
  | {
      kind: "cone";
      radius: number;
      height: number;
      radialSegments: number;
      heightSegments: number;
      openEnded: boolean;
    }
  | {
      kind: "tetrahedron";
      radius: number;
      detail: number;
    }
  | {
      kind: "custom";
      create: Extract<WebGLMeshDeclaration["geometry"], { kind: "custom" }>["create"];
    };

export type NormalizedMeshDeclaration = {
  id: string;
  sceneId: string;
  geometry: NormalizedMeshGeometryDeclaration;
  position: WebGLTuple3;
  rotation: WebGLTuple3;
  scale: number | WebGLTuple3;
  visible: boolean;
  material: NormalizedMeshMaterialDeclaration;
  timeline?: NormalizedTimelineBinding;
  effects?: WebGLEffectsDeclaration;
  interaction?: NormalizedSceneObjectInteractionDeclaration;
  physics?: NormalizedPhysicsDeclaration;
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
  timeline?: NormalizedTimelineBinding;
};

export function normalizeMeshDeclaration(
  declaration: WebGLMeshDeclaration,
): NormalizedMeshDeclaration {
  const id = normalizePublicId(declaration.id, "mesh");
  const sceneId = normalizePublicId(declaration.sceneId, "scene");
  const position = normalizeTuple3(
    declaration.position,
    [0, 0, 0],
    "mesh position",
  );
  const geometry = normalizeMeshGeometryDeclaration(declaration.geometry);
  const rotation = normalizeTuple3(
    declaration.rotation,
    readNormalizedMeshGeometryRotation(geometry),
    "mesh rotation",
  );
  const scale = normalizeScale(declaration.scale, "mesh scale");
  const material = normalizeMeshMaterialDeclaration(declaration.material);
  const timeline = normalizeTimelineBinding(declaration.timeline);
  const effects = normalizeSceneObjectEffects(declaration.effects);
  const interaction = normalizeSceneObjectInteraction(declaration.interaction);
  const physics = normalizePhysicsDeclaration(declaration.physics);

  return {
    id,
    sceneId,
    geometry,
    position,
    rotation,
    scale,
    visible: declaration.visible ?? true,
    material,
    ...(timeline ? { timeline } : {}),
    ...(effects ? { effects } : {}),
    ...(interaction ? { interaction } : {}),
    ...(physics ? { physics } : {}),
  };
}

function normalizeMeshGeometryDeclaration(
  geometry: WebGLMeshDeclaration["geometry"],
): NormalizedMeshGeometryDeclaration {
  switch (geometry.kind) {
    case "plane":
      return {
        kind: "plane",
        ...(geometry.role ? { role: geometry.role } : {}),
        size: normalizePositiveTuple2(
          geometry.size,
          [1, 1],
          "mesh plane size",
        ),
      };
    case "box":
      return {
        kind: "box",
        size: normalizePositiveTuple3(
          geometry.size,
          [1, 1, 1],
          "mesh box size",
        ),
      };
    case "sphere":
      return {
        kind: "sphere",
        radius: normalizePositiveNumber(
          geometry.radius,
          1,
          "mesh sphere radius",
        ),
        widthSegments: normalizeIntegerAtLeast(
          geometry.widthSegments,
          32,
          3,
          "mesh sphere widthSegments",
        ),
        heightSegments: normalizeIntegerAtLeast(
          geometry.heightSegments,
          16,
          2,
          "mesh sphere heightSegments",
        ),
      };
    case "cylinder": {
      const radiusTop = normalizeNonNegativeNumber(
        geometry.radiusTop,
        1,
        "mesh cylinder radiusTop",
      );
      const radiusBottom = normalizeNonNegativeNumber(
        geometry.radiusBottom,
        1,
        "mesh cylinder radiusBottom",
      );

      if (radiusTop === 0 && radiusBottom === 0) {
        throw new Error("WebGL mesh cylinder radii cannot both be zero.");
      }

      return {
        kind: "cylinder",
        radiusTop,
        radiusBottom,
        height: normalizePositiveNumber(
          geometry.height,
          1,
          "mesh cylinder height",
        ),
        radialSegments: normalizeIntegerAtLeast(
          geometry.radialSegments,
          32,
          3,
          "mesh cylinder radialSegments",
        ),
        heightSegments: normalizeIntegerAtLeast(
          geometry.heightSegments,
          1,
          1,
          "mesh cylinder heightSegments",
        ),
        openEnded: geometry.openEnded ?? false,
      };
    }
    case "cone":
      return {
        kind: "cone",
        radius: normalizePositiveNumber(
          geometry.radius,
          1,
          "mesh cone radius",
        ),
        height: normalizePositiveNumber(
          geometry.height,
          1,
          "mesh cone height",
        ),
        radialSegments: normalizeIntegerAtLeast(
          geometry.radialSegments,
          32,
          3,
          "mesh cone radialSegments",
        ),
        heightSegments: normalizeIntegerAtLeast(
          geometry.heightSegments,
          1,
          1,
          "mesh cone heightSegments",
        ),
        openEnded: geometry.openEnded ?? false,
      };
    case "tetrahedron":
      return {
        kind: "tetrahedron",
        radius: normalizePositiveNumber(
          geometry.radius,
          1,
          "mesh tetrahedron radius",
        ),
        detail: normalizeIntegerAtLeast(
          geometry.detail,
          0,
          0,
          "mesh tetrahedron detail",
        ),
      };
    case "custom":
      if (typeof geometry.create !== "function") {
        throw new Error("WebGL mesh custom geometry requires a create function.");
      }

      return { kind: "custom", create: geometry.create };
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
    ...(declaration.timeline
      ? { timeline: normalizeTimelineBinding(declaration.timeline) }
      : {}),
  };
}

function normalizeMeshMaterialDeclaration(
  declaration: WebGLMeshMaterialDeclaration | undefined,
): NormalizedMeshMaterialDeclaration {
  if (!declaration || declaration.kind === undefined || declaration.kind === "standard") {
    return {
      kind: "standard",
      color: declaration?.color ?? "#ffffff",
      emissive: declaration?.emissive ?? "#000000",
      emissiveIntensity: normalizeNonNegativeNumber(
        declaration?.emissiveIntensity,
        1,
        "mesh material emissiveIntensity",
      ),
      opacity: normalizeNonNegativeNumber(
        declaration?.opacity,
        1,
        "mesh material opacity",
      ),
      metalness: normalizeNonNegativeNumber(
        declaration?.metalness,
        0,
        "mesh material metalness",
      ),
      roughness: normalizeNonNegativeNumber(
        declaration?.roughness,
        1,
        "mesh material roughness",
      ),
    };
  }

  switch (declaration.kind) {
    case "basic":
      return {
        kind: "basic",
        color: declaration.color ?? "#ffffff",
        opacity: normalizeNonNegativeNumber(
          declaration.opacity,
          1,
          "mesh material opacity",
        ),
      };
    case "physical":
      return {
        kind: "physical",
        color: declaration.color ?? "#ffffff",
        emissive: declaration.emissive ?? "#000000",
        emissiveIntensity: normalizeNonNegativeNumber(
          declaration.emissiveIntensity,
          1,
          "mesh material emissiveIntensity",
        ),
        opacity: normalizeNonNegativeNumber(
          declaration.opacity,
          1,
          "mesh material opacity",
        ),
        metalness: normalizeNonNegativeNumber(
          declaration.metalness,
          0,
          "mesh material metalness",
        ),
        roughness: normalizeNonNegativeNumber(
          declaration.roughness,
          1,
          "mesh material roughness",
        ),
        transmission: normalizeNumberInRange(
          declaration.transmission,
          0,
          0,
          1,
          "mesh material transmission",
        ),
        thickness: normalizeNonNegativeNumber(
          declaration.thickness,
          0,
          "mesh material thickness",
        ),
        ior: normalizeNumberInRange(
          declaration.ior,
          1.5,
          1,
          2.333,
          "mesh material ior",
        ),
      };
  }
}

function normalizePublicId(value: string, kind: string): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error(`WebGL ${kind} declaration requires a non-empty id.`);
  }

  return normalized;
}

function readPlaneRoleRotation(
  role: WebGLPlaneRole | undefined,
): WebGLTuple3 {
  if (role === "floor") {
    return [-Math.PI / 2, 0, 0];
  }

  return [0, 0, 0];
}

function readNormalizedMeshGeometryRotation(
  geometry: NormalizedMeshGeometryDeclaration,
): WebGLTuple3 {
  switch (geometry.kind) {
    case "plane":
      return readPlaneRoleRotation(geometry.role);
    case "box":
    case "sphere":
    case "cylinder":
    case "cone":
    case "tetrahedron":
    case "custom":
      return [0, 0, 0];
  }
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

function normalizeNumberInRange(
  value: number | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
  label: string,
): number {
  if (value === undefined) {
    return fallback;
  }

  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new Error(
      `WebGL ${label} must be between ${minimum} and ${maximum}.`,
    );
  }

  return value;
}

function normalizeIntegerAtLeast(
  value: number | undefined,
  fallback: number,
  minimum: number,
  label: string,
): number {
  if (value === undefined) {
    return fallback;
  }

  if (!Number.isInteger(value) || value < minimum) {
    throw new Error(
      `WebGL ${label} must be an integer greater than or equal to ${minimum}.`,
    );
  }

  return value;
}

function isFinitePositive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}
