// Blocked defect reproduction for 0.1.0-alpha.0. Read capability-status.md before use.
import { defineWebGLEffect } from "@viselora/dom-webgl";

type SurfacePulseParams = {
  kind: "viselora.surfacePulse";
  color?: string;
  speed?: number;
};

export const surfacePulseEffect = defineWebGLEffect<SurfacePulseParams>({
  kind: "viselora.surfacePulse",
  source: "dom/element",
  schedule: "frame",
  update(ctx, _state, params) {
    const surface = ctx.object.surface;
    if (!surface) {
      return;
    }

    const pulse = 0.5 + Math.sin((ctx.time / 1000) * (params.speed ?? 2)) * 0.5;
    const color = params.color ?? "#7dd3fc";

    ctx.object.visible = true;
    ctx.object.material?.color.set(color);
    if (ctx.object.material) {
      ctx.object.material.roughness = 0.3 + pulse * 0.35;
    }
    surface.draw(({ context, width, height }) => {
      const radius = Math.min(width, height) * (0.16 + pulse * 0.1);
      const gradient = context.createRadialGradient(
        width / 2,
        height / 2,
        0,
        width / 2,
        height / 2,
        radius,
      );
      gradient.addColorStop(0, color);
      gradient.addColorStop(1, "rgba(125, 211, 252, 0)");
      context.clearRect(0, 0, width, height);
      context.fillStyle = gradient;
      context.fillRect(0, 0, width, height);
    });
  },
});

export const surfacePulseTarget = {
  key: "viselora.surface-pulse",
  source: { kind: "dom", type: "element" },
  lifecycle: {
    hideWhenReady: true,
    hideMode: "self",
    offscreen: { strategy: "restore-dom" },
  },
  effects: [{ kind: "viselora.surfacePulse", color: "#7dd3fc" }],
} as const;
