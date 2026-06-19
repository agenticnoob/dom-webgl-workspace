import { defineWebGLEffect } from "../effectAuthoring";

export const pointerTiltEffect = defineWebGLEffect<{
  kind: "pointerTilt";
  strength?: number;
  maxDegrees?: number;
}>({
  kind: "pointerTilt",
  update(ctx, _state, params) {
    if (!ctx.pointer.isInside) {
      ctx.target?.setRotation(0, 0);
      return;
    }

    const strength = clampNumber(params.strength, 0, 2, 1);
    const maxDegrees = clampNumber(params.maxDegrees, 0, 30, 8);
    const radians = (maxDegrees * Math.PI) / 180;

    ctx.target?.setRotation(
      -ctx.pointer.normalizedY * radians * strength,
      ctx.pointer.normalizedX * radians * strength,
    );
  },
});

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
