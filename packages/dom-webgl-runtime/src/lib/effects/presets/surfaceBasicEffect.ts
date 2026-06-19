import { defineWebGLEffect } from "../effectAuthoring";

export const surfaceBasicEffect = defineWebGLEffect<{
  kind: "surfaceBasic";
  opacity?: number;
}>({
  kind: "surfaceBasic",
  source: "snapshot/element",
  update(ctx, _state, params) {
    ctx.target?.setVisible(true);
    ctx.target?.setOpacity(clampNumber(params.opacity, 0, 1, 1));
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
