import { defineWebGLEffect } from "@project/dom-webgl-runtime";

export const demoSurfaceEffect = defineWebGLEffect<{
  kind: "demo.surface";
  opacity?: number;
}>({
  kind: "demo.surface",
  source: "snapshot/element",
  update(ctx, _state, params) {
    ctx.target?.setVisible(true);
    ctx.target?.setOpacity(clampNumber(params.opacity, 0, 1, 1));
  },
});

export const demoPointerTiltEffect = defineWebGLEffect<{
  kind: "demo.pointerTilt";
  strength?: number;
  maxDegrees?: number;
}>({
  kind: "demo.pointerTilt",
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
