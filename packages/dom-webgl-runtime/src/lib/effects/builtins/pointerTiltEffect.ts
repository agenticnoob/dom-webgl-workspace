import type { WebGLPointerTiltEffectDeclaration } from "../../types";
import type { WebGLEffectPlugin } from "../effectPlugin";
import { applyPointerTilt } from "../motions/pointerTilt";

export type NormalizedPointerTiltEffect = {
  kind: "pointer-tilt";
  strength: number;
  maxDegrees: number;
};

export const pointerTiltEffect: WebGLEffectPlugin<
  WebGLPointerTiltEffectDeclaration,
  NormalizedPointerTiltEffect
> = {
  kind: "motion.pointerTilt",
  appliesTo: ["snapshot/element", "snapshot/text", "image", "video", "model/glb"],
  capabilities: ["transform.rotation"],
  normalize(declaration) {
    return {
      kind: "pointer-tilt",
      strength: clampNumber(declaration.strength, 0, 1, 1),
      maxDegrees: clampNumber(declaration.maxDegrees, 0, 30, 8),
    };
  },
  create(state) {
    return {
      update(context): void {
        applyPointerTilt(context.target, context.input, state);
      },
    };
  },
};

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
