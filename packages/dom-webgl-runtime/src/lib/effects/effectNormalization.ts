import type {
  WebGLEffectsDeclaration,
  WebGLMaterialDeclaration,
  WebGLMotionDeclaration,
} from "../types";

export type NormalizedWebGLMaterialDeclaration = {
  kind: "solid";
  color: number;
  opacity: number;
};

export type NormalizedWebGLMotionDeclaration = {
  kind: "pointer-tilt";
  strength: number;
  maxDegrees: number;
};

export type NormalizedWebGLEffectsDeclaration = {
  material?: NormalizedWebGLMaterialDeclaration;
  motion?: NormalizedWebGLMotionDeclaration;
};

const defaultMaterial = {
  color: 0xffffff,
  opacity: 1,
};

const defaultMotion = {
  strength: 1,
  maxDegrees: 8,
};

export function normalizeWebGLEffectsDeclaration(
  declaration: WebGLEffectsDeclaration | undefined,
): NormalizedWebGLEffectsDeclaration {
  if (!declaration) {
    return {};
  }

  return {
    material: declaration.material
      ? normalizeMaterialDeclaration(declaration.material)
      : undefined,
    motion: declaration.motion
      ? normalizeMotionDeclaration(declaration.motion)
      : undefined,
  };
}

function normalizeMaterialDeclaration(
  material: WebGLMaterialDeclaration,
): NormalizedWebGLMaterialDeclaration {
  return {
    kind: "solid",
    color: clampInteger(material.color, 0, 0xffffff, defaultMaterial.color),
    opacity: clampNumber(material.opacity, 0, 1, defaultMaterial.opacity),
  };
}

function normalizeMotionDeclaration(
  motion: WebGLMotionDeclaration,
): NormalizedWebGLMotionDeclaration {
  return {
    kind: "pointer-tilt",
    strength: clampNumber(motion.strength, 0, 1, defaultMotion.strength),
    maxDegrees: clampNumber(motion.maxDegrees, 0, 30, defaultMotion.maxDegrees),
  };
}

function clampInteger(
  value: number | undefined,
  min: number,
  max: number,
  fallback: number,
): number {
  return Math.round(clampNumber(value, min, max, fallback));
}

function clampNumber(
  value: number | undefined,
  min: number,
  max: number,
  fallback: number,
): number {
  if (value === undefined || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, value));
}
