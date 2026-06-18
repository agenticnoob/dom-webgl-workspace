import type { DOMStyleSnapshot } from "../../dom/styleSnapshot";
import { capDevicePixelRatio } from "../../renderer/layoutPass";

export type CSSBoxCanvasState = {
  width: number;
  height: number;
  devicePixelRatio: number;
  style: DOMStyleSnapshot;
};

export function createCSSBoxCanvasSignature(state: CSSBoxCanvasState): string {
  return JSON.stringify([
    state.width,
    state.height,
    capDevicePixelRatio(state.devicePixelRatio),
    state.style.box,
  ]);
}

export function drawCSSBoxToCanvas(
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
  state: CSSBoxCanvasState,
): void {
  const dpr = capDevicePixelRatio(state.devicePixelRatio);
  const width = Math.max(1, state.width);
  const height = Math.max(1, state.height);
  const box = state.style.box;

  canvas.width = Math.max(1, Math.ceil(width * dpr));
  canvas.height = Math.max(1, Math.ceil(height * dpr));
  context.setTransform?.(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.scale(dpr, dpr);
  context.save();
  applySingleOuterShadow(context, box.boxShadow);
  drawRoundedRectPath(context, width, height, box);
  context.fillStyle = box.backgroundColor;
  context.fill();
  context.restore();

  drawBorderSide(
    context,
    box.borderTopWidth,
    box.borderTopColor,
    0,
    box.borderTopWidth / 2,
    width,
    box.borderTopWidth / 2,
  );
  drawBorderSide(
    context,
    box.borderRightWidth,
    box.borderRightColor,
    width - box.borderRightWidth / 2,
    0,
    width - box.borderRightWidth / 2,
    height,
  );
  drawBorderSide(
    context,
    box.borderBottomWidth,
    box.borderBottomColor,
    width,
    height - box.borderBottomWidth / 2,
    0,
    height - box.borderBottomWidth / 2,
  );
  drawBorderSide(
    context,
    box.borderLeftWidth,
    box.borderLeftColor,
    box.borderLeftWidth / 2,
    height,
    box.borderLeftWidth / 2,
    0,
  );
}

type BoxPathStyle = DOMStyleSnapshot["box"];

function drawRoundedRectPath(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  box: BoxPathStyle,
  inset = 0,
): void {
  const maxRadius = Math.min(width, height) / 2;
  const topLeft = Math.min(box.borderTopLeftRadius, maxRadius);
  const topRight = Math.min(box.borderTopRightRadius, maxRadius);
  const bottomRight = Math.min(box.borderBottomRightRadius, maxRadius);
  const bottomLeft = Math.min(box.borderBottomLeftRadius, maxRadius);
  const left = inset;
  const top = inset;
  const right = width + inset;
  const bottom = height + inset;

  context.beginPath();
  context.moveTo(left + topLeft, top);
  context.lineTo(right - topRight, top);
  context.quadraticCurveTo(right, top, right, top + topRight);
  context.lineTo(right, bottom - bottomRight);
  context.quadraticCurveTo(right, bottom, right - bottomRight, bottom);
  context.lineTo(left + bottomLeft, bottom);
  context.quadraticCurveTo(left, bottom, left, bottom - bottomLeft);
  context.lineTo(left, top + topLeft);
  context.quadraticCurveTo(left, top, left + topLeft, top);
  context.closePath();
}

function applySingleOuterShadow(
  context: CanvasRenderingContext2D,
  boxShadow: string,
): void {
  if (!boxShadow || boxShadow === "none") {
    return;
  }

  const match = boxShadow.match(
    /(-?\d+(?:\.\d+)?)px\s+(-?\d+(?:\.\d+)?)px\s+(-?\d+(?:\.\d+)?)px\s+(.*)/,
  );

  if (!match) {
    return;
  }

  context.shadowOffsetX = Number.parseFloat(match[1] ?? "0");
  context.shadowOffsetY = Number.parseFloat(match[2] ?? "0");
  context.shadowBlur = Math.max(0, Number.parseFloat(match[3] ?? "0"));
  context.shadowColor = match[4] ?? "rgba(0, 0, 0, 0)";
}

function drawBorderSide(
  context: CanvasRenderingContext2D,
  width: number,
  color: string,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): void {
  if (width <= 0) {
    return;
  }

  context.save();
  context.beginPath();
  context.moveTo(x1, y1);
  context.lineTo(x2, y2);
  context.strokeStyle = color;
  context.lineWidth = width;
  context.stroke();
  context.restore();
}
