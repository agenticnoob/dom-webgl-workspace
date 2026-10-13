import { clampNumber } from "./effectMath";

export function readTimelineCardFrame(progress: number) {
  const presence = smoothstep(0.12, 0.38, progress);
  const travel = smoothstep(0.2, 0.68, progress);
  const visible = presence > 0.02;
  return {
    presence,
    visible,
    opacity: visible ? (0.12 + presence * 0.88) * (0.2 + presence * 0.8) : 0,
    rotationY: -0.28 + travel * 0.46,
  };
}

export function smoothstep(
  edge0: number,
  edge1: number,
  value: number,
): number {
  const t = clampNumber((value - edge0) / (edge1 - edge0), 0, 1, 0);
  return t * t * (3 - 2 * t);
}

export function drawTimelineCard(
  context: Pick<
    CanvasRenderingContext2D,
    | "clearRect"
    | "save"
    | "restore"
    | "globalAlpha"
    | "fillStyle"
    | "font"
    | "textBaseline"
    | "fillText"
    | "fillRect"
    | "fill"
    | "beginPath"
    | "moveTo"
    | "lineTo"
    | "quadraticCurveTo"
    | "closePath"
  >,
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
  roundRect(
    context,
    inset,
    inset,
    width - inset * 2,
    height - inset * 2,
    radius * 0.72,
  );
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
  context.fillRect(
    inset * 1.35,
    height - inset * 1.35,
    (width - inset * 2.7) * progress,
    4,
  );
  context.restore();
}

function roundRect(
  context: Pick<
    CanvasRenderingContext2D,
    "beginPath" | "moveTo" | "lineTo" | "quadraticCurveTo" | "closePath"
  >,
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
  context.quadraticCurveTo(
    x + width,
    y + height,
    x + width - safeRadius,
    y + height,
  );
  context.lineTo(x + safeRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  context.lineTo(x, y + safeRadius);
  context.quadraticCurveTo(x, y, x + safeRadius, y);
  context.closePath();
}
