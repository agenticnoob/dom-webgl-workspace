import type { WebGLSolidMaterialEffectDeclaration } from "../../types";
import type { WebGLEffectPlugin } from "../effectPlugin";

export type NormalizedSolidMaterialEffect = {
  color: number;
  opacity: number;
};

export const solidMaterialEffect: WebGLEffectPlugin<
  WebGLSolidMaterialEffectDeclaration,
  NormalizedSolidMaterialEffect
> = {
  kind: "material.solid",
  appliesTo: ["snapshot/element"],
  capabilities: ["material.solid"],
  normalize(declaration) {
    return {
      color: clampInteger(declaration.color, 0, 0xffffff, 0xffffff),
      opacity: clampNumber(declaration.opacity, 0, 1, 1),
    };
  },
  create(state) {
    return {
      update(context): void {
        context.target?.applySolidMaterial?.({
          color: state.color,
          opacity: state.opacity,
        });
      },
    };
  },
};

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
