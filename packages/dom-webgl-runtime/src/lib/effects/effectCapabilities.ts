import type { WebGLEffectTargetCapability } from "./effectPlugin";
import type { WebGLEffectTarget } from "./effectTarget";

export function effectTargetSupports(
  target: WebGLEffectTarget | undefined,
  capability: WebGLEffectTargetCapability,
): boolean {
  if (!target) {
    return false;
  }

  switch (capability) {
    case "material.solid":
      return !!target.applySolidMaterial;
    case "material.surface":
      return !!target.applySurfaceMaterial;
    case "transform.rotation":
      return !!target.setRotation;
  }
}
