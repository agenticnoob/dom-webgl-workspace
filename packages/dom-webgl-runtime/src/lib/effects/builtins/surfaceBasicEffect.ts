import type { WebGLSurfaceBasicEffectDeclaration } from "../../types";
import type { WebGLEffectPlugin } from "../effectPlugin";

export type NormalizedSurfaceBasicEffect = {
  color: number;
  opacity: number;
  radius: number;
};

export const surfaceBasicEffect: WebGLEffectPlugin<
  WebGLSurfaceBasicEffectDeclaration,
  NormalizedSurfaceBasicEffect
> = {
  kind: "surface.basic",
  appliesTo: ["snapshot/element"],
  capabilities: ["material.surface"],
  normalize(declaration) {
    return {
      color: clampInteger(declaration.color, 0, 0xffffff, 0xffffff),
      opacity: clampNumber(declaration.opacity, 0, 1, 1),
      radius: clampNumber(declaration.radius, 0, 96, 0),
    };
  },
  create(state) {
    return {
      update(context): void {
        context.target?.applySurfaceMaterial?.(state, {
          width: context.layout.width,
          height: context.layout.height,
          devicePixelRatio: context.layout.devicePixelRatio,
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
