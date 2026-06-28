import { defineWebGLEffect } from "@project/dom-webgl-runtime";

import { clampNumber } from "./effectMath";

type SequenceCardParams = {
  kind: "example.sequenceCard";
  progressKey: string;
  travel?: number;
  minOpacity?: number;
  maxOpacity?: number;
};

export const exampleSequenceCardEffect =
  defineWebGLEffect<SequenceCardParams>({
    kind: "example.sequenceCard",
    source: "dom/element",
    update(ctx, _state, params) {
      if (ctx.source.kind !== "dom" || ctx.source.type !== "element") {
        return;
      }

      const element = ctx.source.element;
      const progress = clampNumber(ctx.progress.get(params.progressKey), 0, 1, 0);
      const travel = clampNumber(params.travel, 0, 640, 280);
      const minOpacity = clampNumber(params.minOpacity, 0, 1, 0.18);
      const maxOpacity = clampNumber(params.maxOpacity, minOpacity, 1, 0.82);
      const entry = smoothstep(0.08, 0.3, progress);
      const exit = smoothstep(0.7, 0.92, progress);
      const presence = clampNumber(entry * (1 - exit), 0, 1, 0);
      const offsetX = (1 - entry) * -travel + exit * travel;
      const opacity = roundTo(
        minOpacity + (maxOpacity - minOpacity) * presence,
        1000,
      );
      const surface = ctx.source.surface;
      const anchor = readSurfaceSceneAnchor(surface, ctx.layout);

      ctx.target?.setVisible(true);
      surface?.draw(({ context, width, height }) => {
        drawSequenceCardSurface(context, width, height, element);
      });
      surface?.setVisible?.(true);
      surface?.setOpacity?.(1);
      ctx.target?.setOpacity(opacity);
      ctx.target?.setPosition(
        anchor.x + offsetX,
        anchor.y,
        anchor.z,
      );
    },
  });

function readSurfaceSceneAnchor(
  surface: NonNullable<
    Extract<
      Parameters<typeof exampleSequenceCardEffect.update>[0]["source"],
      { kind: "dom"; type: "element" }
    >["surface"]
  > | undefined,
  layout: Parameters<typeof exampleSequenceCardEffect.update>[0]["layout"],
): { x: number; y: number; z: number } {
  const position =
    readScenePosition(surface?.object3D) ?? readScenePosition(surface?.mesh);
  const x = readFiniteNumber(position?.x);
  const y = readFiniteNumber(position?.y);
  const z = readFiniteNumber(position?.z);

  return {
    x: x ?? readSceneX(layout),
    y: y ?? readSceneY(layout),
    z: z ?? 0,
  };
}

function readFiniteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readScenePosition(
  value: unknown,
): { x?: unknown; y?: unknown; z?: unknown } | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const position = record.position;

  if (!position || typeof position !== "object") {
    return undefined;
  }

  return position as { x?: unknown; y?: unknown; z?: unknown };
}

function readSceneX(layout: { left: number; width: number }): number {
  return layout.left + layout.width / 2;
}

function readSceneY(layout: {
  top: number;
  height: number;
  viewport: { height: number };
}): number {
  return layout.viewport.height - (layout.top + layout.height / 2);
}

function drawSequenceCardSurface(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  element: HTMLElement,
): void {
  const title =
    element.querySelector("strong")?.textContent?.trim() ?? "嵌套 WebGLTarget";
  const copy =
    element.querySelector("span")?.textContent?.trim() ??
    "父级是图片序列，卡片是它的 DOM child 和 WebGL 子层。";
  const padding = Math.min(28, Math.max(18, width * 0.06));
  const radius = Math.min(14, Math.max(8, width * 0.03));

  context.save();
  context.clearRect(0, 0, width, height);
  context.shadowColor = "rgba(0, 0, 0, 0.28)";
  context.shadowBlur = 28;
  context.shadowOffsetY = 18;
  context.fillStyle = "rgba(23, 33, 36, 0.72)";
  drawRoundedRect(context, 0, 0, width, height, radius);
  context.fill();
  context.shadowColor = "transparent";
  context.strokeStyle = "rgba(244, 244, 245, 0.34)";
  context.lineWidth = 1.25;
  drawRoundedRect(context, 0.625, 0.625, width - 1.25, height - 1.25, radius);
  context.stroke();

  context.fillStyle = "#f4f4f5";
  context.font = "700 34px Georgia, 'Times New Roman', serif";
  context.textBaseline = "top";
  context.fillText(title, padding, padding);

  context.fillStyle = "rgba(244, 244, 245, 0.78)";
  context.font = "18px Georgia, 'Times New Roman', serif";
  drawWrappedText(context, copy, padding, padding + 52, width - padding * 2, 27);
  context.restore();
}

function drawRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const nextRadius = Math.min(radius, width / 2, height / 2);

  context.beginPath();
  context.moveTo(x + nextRadius, y);
  context.lineTo(x + width - nextRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + nextRadius);
  context.lineTo(x + width, y + height - nextRadius);
  context.quadraticCurveTo(
    x + width,
    y + height,
    x + width - nextRadius,
    y + height,
  );
  context.lineTo(x + nextRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - nextRadius);
  context.lineTo(x, y + nextRadius);
  context.quadraticCurveTo(x, y, x + nextRadius, y);
  context.closePath();
}

function drawWrappedText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
): void {
  const tokens =
    text.match(
      /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]|[^\s\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]+|\s+/gu,
    ) ?? [];
  let line = "";
  let lineY = y;

  for (const token of tokens) {
    const nextLine = line ? `${line}${token}` : token.trimStart();
    if (line && context.measureText(nextLine).width > maxWidth) {
      context.fillText(line.trimEnd(), x, lineY);
      line = token.trimStart();
      lineY += lineHeight;
      continue;
    }

    line = nextLine;
  }

  if (line) {
    context.fillText(line.trimEnd(), x, lineY);
  }
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  if (edge0 === edge1) {
    return value < edge0 ? 0 : 1;
  }

  const t = clampNumber((value - edge0) / (edge1 - edge0), 0, 1, 0);
  return t * t * (3 - 2 * t);
}

function roundTo(value: number, scale: number): number {
  return Math.round(value * scale) / scale;
}
