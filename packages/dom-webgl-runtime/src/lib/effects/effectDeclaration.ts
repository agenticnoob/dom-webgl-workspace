import type {
  WebGLEffectDeclaration,
  WebGLEffectsDeclaration,
  WebGLLegacyEffectsDeclaration,
} from "../types";

export function compileWebGLEffectDeclarations(
  declaration: WebGLEffectsDeclaration | undefined,
): WebGLEffectDeclaration[] {
  if (!declaration) {
    return [];
  }

  if (Array.isArray(declaration)) {
    return [...declaration];
  }

  return compileLegacyEffectsDeclaration(declaration);
}

function compileLegacyEffectsDeclaration(
  declaration: WebGLLegacyEffectsDeclaration,
): WebGLEffectDeclaration[] {
  const effects: WebGLEffectDeclaration[] = [];

  if (declaration.material?.kind === "solid") {
    effects.push({
      kind: "material.solid",
      color: declaration.material.color,
      opacity: declaration.material.opacity,
    });
  }

  if (declaration.material?.kind === "surface") {
    effects.push({
      kind: "surface.basic",
      color: declaration.material.color,
      opacity: declaration.material.opacity,
      radius: declaration.material.radius,
    });
  }

  if (declaration.motion?.kind === "pointer-tilt") {
    effects.push({
      kind: "motion.pointerTilt",
      strength: declaration.motion.strength,
      maxDegrees: declaration.motion.maxDegrees,
    });
  }

  return effects;
}
