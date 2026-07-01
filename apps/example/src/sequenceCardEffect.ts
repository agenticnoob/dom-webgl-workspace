import {
  defineWebGLEffect,
  type WebGLEffectUpdateContext,
} from "@project/dom-webgl-runtime";

import { clampNumber } from "./effectMath";
import {
  readTargetLocalPointer,
  type TargetLocalPointer,
} from "./surfacePointer";

type SequenceCardSlideParams = {
  kind: "example.sequenceCardSlide";
  progressKey: string;
  travel?: number;
  minOpacity?: number;
  maxOpacity?: number;
};

type SequenceCardBorderGlowParams = {
  kind: "example.sequenceCardBorderGlow";
  progressKey?: string;
  travel?: number;
  edgeSensitivity?: number;
  colorSensitivity?: number;
  glowIntensity?: number;
  glowRadius?: number;
  fillOpacity?: number;
};

type SequenceCardGlow = {
  active: boolean;
  edgeProximity: number;
  glowOpacity: number;
  colorOpacity: number;
  edgeX: number;
  edgeY: number;
  glowRadius: number;
  fillOpacity: number;
};

const borderGlowColors = ["#c084fc", "#f472b6", "#38bdf8"] as const;

export const exampleSequenceCardSlideEffect =
  defineWebGLEffect<SequenceCardSlideParams>({
    kind: "example.sequenceCardSlide",
    source: "dom/element",
    update(ctx, _state, params) {
      if (ctx.source.kind !== "dom" || ctx.source.type !== "element") {
        return;
      }

      const minOpacity = clampNumber(params.minOpacity, 0, 1, 0.18);
      const maxOpacity = clampNumber(params.maxOpacity, minOpacity, 1, 0.82);
      const motion = readSequenceCardMotion(ctx, params);
      const opacity = roundTo(
        minOpacity + (maxOpacity - minOpacity) * motion.presence,
        1000,
      );
      const anchor = readSceneAnchor(ctx.layout);

      ctx.target?.setVisible(true);
      ctx.target?.setOpacity(opacity);
      ctx.target?.setPosition(
        anchor.x + motion.offsetX,
        anchor.y,
        anchor.z,
      );
    },
  });

export const exampleSequenceCardBorderGlowEffect =
  defineWebGLEffect<SequenceCardBorderGlowParams>({
    kind: "example.sequenceCardBorderGlow",
    source: "dom/element",
    update(ctx, _state, params) {
      if (ctx.source.kind !== "dom" || ctx.source.type !== "element") {
        return;
      }

      const surface = ctx.source.surface;
      const offsetX = readSequenceCardMotion(ctx, params).offsetX;
      const pointer = readTargetLocalPointer({
        layout: readVisualLayout(ctx.layout, offsetX),
        pointer: {
          ...ctx.targetPointer,
          localX: ctx.targetPointer.localX - offsetX,
          isInside: ctx.pointer.isInside,
        },
      });
      const glow = readSequenceCardGlow(pointer, ctx.layout, params);

      surface?.draw(({ context, width, height }) => {
        drawSequenceCardSurface(context, width, height, glow);
      });
      surface?.setVisible?.(true);
      surface?.setOpacity?.(1);
    },
  });

function readSequenceCardMotion(
  ctx: WebGLEffectUpdateContext,
  params: { readonly progressKey?: string; readonly travel?: number },
): { offsetX: number; presence: number } {
  if (!params.progressKey) {
    return { offsetX: 0, presence: 1 };
  }

  const progress = clampNumber(ctx.progress.get(params.progressKey), 0, 1, 0);
  const travel = clampNumber(params.travel, 0, 640, 280);
  const entry = smoothstep(0.08, 0.3, progress);
  const exit = smoothstep(0.7, 0.92, progress);

  return {
    offsetX: (1 - entry) * -travel + exit * travel,
    presence: clampNumber(entry * (1 - exit), 0, 1, 0),
  };
}

function readVisualLayout(
  layout: WebGLEffectUpdateContext["layout"],
  offsetX: number,
): Parameters<typeof readTargetLocalPointer>[0]["layout"] {
  return {
    height: layout.height,
    width: layout.width,
  };
}

function readSceneAnchor(
  layout: WebGLEffectUpdateContext["layout"],
): {
  x: number;
  y: number;
  z: number;
} {
  return {
    x: readSceneX(layout),
    y: readSceneY(layout),
    z: 0,
  };
}

function readSequenceCardGlow(
  pointer: TargetLocalPointer,
  layout: WebGLEffectUpdateContext["layout"],
  params: SequenceCardBorderGlowParams,
): SequenceCardGlow {
  const width = Math.max(layout.width, 1);
  const height = Math.max(layout.height, 1);
  const edgeSensitivity = clampNumber(params.edgeSensitivity, 0, 0.95, 0.3);
  const colorSensitivity = clampNumber(
    params.colorSensitivity,
    edgeSensitivity,
    0.98,
    edgeSensitivity + 0.2,
  );
  const glowIntensity = clampNumber(params.glowIntensity, 0, 2, 1);
  const edgeProximity = pointer.active
    ? readEdgeProximity(width, height, pointer.x, pointer.y)
    : 0;
  const glowOpacity =
    readSensitivityOpacity(edgeProximity, edgeSensitivity) * glowIntensity;
  const colorOpacity =
    readSensitivityOpacity(edgeProximity, colorSensitivity) * glowIntensity;
  const edgePoint = projectPointerToRectEdge(width, height, pointer);

  return {
    active: pointer.active,
    edgeProximity,
    glowOpacity: clampNumber(glowOpacity, 0, 1, 0),
    colorOpacity: clampNumber(colorOpacity, 0, 1, 0),
    edgeX: edgePoint.x,
    edgeY: edgePoint.y,
    glowRadius: clampNumber(params.glowRadius, 8, 96, 40),
    fillOpacity: clampNumber(params.fillOpacity, 0, 1, 0.42),
  };
}

function readEdgeProximity(
  width: number,
  height: number,
  x: number,
  y: number,
): number {
  const centerX = width * 0.5;
  const centerY = height * 0.5;
  const xRatio = centerX === 0 ? 0 : Math.abs(x - centerX) / centerX;
  const yRatio = centerY === 0 ? 0 : Math.abs(y - centerY) / centerY;

  return clampNumber(Math.max(xRatio, yRatio), 0, 1, 0);
}

function readSensitivityOpacity(edge: number, sensitivity: number): number {
  if (sensitivity >= 1) {
    return edge >= 1 ? 1 : 0;
  }

  return clampNumber((edge - sensitivity) / (1 - sensitivity), 0, 1, 0);
}

function projectPointerToRectEdge(
  width: number,
  height: number,
  pointer: TargetLocalPointer,
): { x: number; y: number } {
  const centerX = width * 0.5;
  const centerY = height * 0.5;
  const dx = pointer.x - centerX;
  const dy = pointer.y - centerY;

  if (!pointer.active || (dx === 0 && dy === 0)) {
    return { x: centerX, y: 0 };
  }

  const scaleX = dx === 0 ? Infinity : centerX / Math.abs(dx);
  const scaleY = dy === 0 ? Infinity : centerY / Math.abs(dy);
  const scale = Math.min(scaleX, scaleY);

  return {
    x: centerX + dx * scale,
    y: centerY + dy * scale,
  };
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
  glow: SequenceCardGlow,
): void {
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

  drawPointerBorderGlow(context, width, height, radius, glow);
  context.restore();
}

function drawPointerBorderGlow(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  radius: number,
  glow: SequenceCardGlow,
): void {
  if (!glow.active || glow.glowOpacity <= 0) {
    return;
  }

  if (glow.colorOpacity > 0) {
    drawPointerMeshFill(context, width, height, radius, glow);
  }

  const glowGradient = context.createRadialGradient(
    glow.edgeX,
    glow.edgeY,
    0,
    glow.edgeX,
    glow.edgeY,
    glow.glowRadius * 2.2,
  );
  glowGradient.addColorStop(0, `rgba(248, 226, 178, ${0.86 * glow.glowOpacity})`);
  glowGradient.addColorStop(0.34, `rgba(244, 114, 182, ${0.46 * glow.glowOpacity})`);
  glowGradient.addColorStop(0.68, `rgba(56, 189, 248, ${0.2 * glow.glowOpacity})`);
  glowGradient.addColorStop(1, "rgba(56, 189, 248, 0)");

  context.save();
  context.globalCompositeOperation = "lighter";
  context.strokeStyle = glowGradient;
  context.shadowColor = `rgba(248, 226, 178, ${0.52 * glow.glowOpacity})`;
  context.shadowBlur = 32;
  context.lineWidth = 4.5;
  drawRoundedRect(context, 2.25, 2.25, width - 4.5, height - 4.5, radius);
  context.stroke();
  context.shadowBlur = 18;
  context.lineWidth = 1.5;
  drawRoundedRect(context, 0.75, 0.75, width - 1.5, height - 1.5, radius);
  context.stroke();
  context.restore();
}

function drawPointerMeshFill(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  radius: number,
  glow: SequenceCardGlow,
): void {
  context.save();
  drawRoundedRect(context, 1, 1, width - 2, height - 2, radius);
  context.clip();
  context.globalCompositeOperation = "soft-light";
  context.globalAlpha = glow.colorOpacity * glow.fillOpacity;

  const meshStops = [
    { x: width * 0.8, y: height * 0.55, color: borderGlowColors[0] },
    { x: width * 0.69, y: height * 0.34, color: borderGlowColors[1] },
    { x: width * 0.08, y: height * 0.06, color: borderGlowColors[2] },
    { x: width * 0.86, y: height * 0.85, color: borderGlowColors[1] },
  ] as const;

  for (const stop of meshStops) {
    const gradient = context.createRadialGradient(
      stop.x,
      stop.y,
      0,
      stop.x,
      stop.y,
      Math.max(width, height) * 0.72,
    );
    gradient.addColorStop(0, stop.color);
    gradient.addColorStop(0.5, "rgba(255, 255, 255, 0)");
    gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
  }

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
