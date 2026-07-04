import { defineWebGLEffect } from "@project/dom-webgl-runtime";

import { clampNumber } from "./effectMath";

type ManagedTimelineCardParams = {
  kind: "example.managedTimelineCard";
  progressKey: string;
};

export const exampleManagedTimelineCardEffect =
  defineWebGLEffect<ManagedTimelineCardParams>({
    kind: "example.managedTimelineCard",
    source: "dom/element",
    schedule: "frame",
    update(ctx, _state, params) {
      const surface = ctx.object.surface;
      if (!surface) {
        return;
      }

      const progress = readManagedTimelineProgress(ctx, params.progressKey);
      const entry = smoothstep(0.12, 0.38, progress);
      const exit = smoothstep(0.78, 0.94, progress);
      const travel = smoothstep(0.2, 0.68, progress);
      const presence = clampNumber(entry * (1 - exit), 0, 1, 0);
      const visible = (ctx.scene?.timeline?.active ?? true) && presence > 0.02;

      ctx.object.visible = visible;
      ctx.object.opacity = visible ? 0.12 + presence * 0.88 : 0;
      ctx.object.rotation.set(0, -0.28 + travel * 0.46, 0);
      ctx.object.scale.setScalar(0.7 + travel * 0.3);
      surface.draw(({ context, width, height }) => {
        drawTimelineCard(context, width, height, progress, presence);
      });
      surface.setVisible?.(visible);
      surface.setOpacity?.(visible ? 0.2 + presence * 0.8 : 0);
    },
  });

function readManagedTimelineProgress(
  ctx: Parameters<typeof exampleManagedTimelineCardEffect.update>[0],
  progressKey: string,
): number {
  const runtimeProgress = ctx.runtime.progress.get(progressKey);
  const timelineProgress = ctx.scene?.timeline?.progress ?? runtimeProgress;
  if (timelineProgress > 0) {
    return clampNumber(timelineProgress, 0, 1, 0);
  }
  return clampNumber(ctx.scrollProgress, 0, 1, 0);
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = clampNumber((value - edge0) / (edge1 - edge0), 0, 1, 0);
  return t * t * (3 - 2 * t);
}

function drawTimelineCard(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  progress: number,
  presence: number,
): void {
  const inset = Math.max(10, Math.min(width, height) * 0.08);
  const radius = Math.max(12, Math.min(width, height) * 0.1);

  context.clearRect(0, 0, width, height);
  context.save();
  context.globalAlpha = 0.84 + presence * 0.16;
  context.fillStyle = "#f2c656";
  roundRect(context, 0, 0, width, height, radius);
  context.fill();

  context.globalAlpha = 0.24;
  context.fillStyle = "#fff3bf";
  roundRect(context, inset, inset, width - inset * 2, height - inset * 2, radius * 0.72);
  context.fill();

  context.globalAlpha = 1;
  context.fillStyle = "#172124";
  context.font = `700 ${Math.max(12, height * 0.11)}px ui-monospace, monospace`;
  context.textBaseline = "top";
  context.fillText("WebGLTarget", inset * 1.35, inset * 1.05);

  context.font = `800 ${Math.max(24, height * 0.22)}px Georgia, serif`;
  context.fillText("Timeline", inset * 1.35, height * 0.38);
  context.fillText("target", inset * 1.35, height * 0.62);

  context.globalAlpha = 0.5 + presence * 0.35;
  context.fillStyle = "#172124";
  context.fillRect(inset * 1.35, height - inset * 1.35, (width - inset * 2.7) * progress, 4);
  context.restore();
}

function roundRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.lineTo(x + width - safeRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  context.lineTo(x + width, y + height - safeRadius);
  context.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  context.lineTo(x + safeRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  context.lineTo(x, y + safeRadius);
  context.quadraticCurveTo(x, y, x + safeRadius, y);
  context.closePath();
}
