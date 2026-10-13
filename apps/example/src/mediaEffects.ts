import { clampNumber } from "./effectMath";
import type { TargetLocalPointer } from "./surfacePointer";
export type ImageHoverRevealParams = {
  radius?: number;
  feather?: number;
  restoreMs?: number;
  roughness?: number;
};
type ImageHoverRevealPoint = { x: number; y: number };
export type ImageHoverRevealState = {
  maskCanvas?: HTMLCanvasElement;
  maskSize?: { width: number; height: number };
  previousPoint?: ImageHoverRevealPoint;
  lastInteractionTime?: number;
};

export function updateImageHoverRevealMask(
  time: number,
  state: ImageHoverRevealState,
  params: ImageHoverRevealParams,
  pointer: TargetLocalPointer,
  layout: { width: number; height: number },
): HTMLCanvasElement {
  const maskCanvas = readImageHoverRevealMaskCanvas(state, layout);
  if (!pointer.active) {
    state.previousPoint = undefined;
    if (readImageHoverRevealTrailOpacity(time, state, params) <= 0) {
      clearImageHoverRevealMask(state);
      state.lastInteractionTime = undefined;
    }
    return maskCanvas;
  }

  const currentPoint = { x: pointer.x, y: pointer.y };
  if (
    state.previousPoint &&
    Math.hypot(
      currentPoint.x - state.previousPoint.x,
      currentPoint.y - state.previousPoint.y,
    ) < imageHoverRevealMovementThreshold
  ) {
    return maskCanvas;
  }

  const context = readImageHoverRevealMaskContext(maskCanvas);
  const currentOpacity = readImageHoverRevealTrailOpacity(time, state, params);
  if (context && currentOpacity > 0 && currentOpacity < 1) {
    bakeImageHoverRevealMaskOpacity(context, maskCanvas, currentOpacity);
  } else if (state.lastInteractionTime !== undefined && currentOpacity <= 0) {
    clearImageHoverRevealMask(state);
  }

  state.lastInteractionTime = time;
  if (!context) {
    state.previousPoint = currentPoint;
    return maskCanvas;
  }

  drawImageHoverRevealStroke(
    context,
    state.previousPoint ?? currentPoint,
    currentPoint,
    params,
  );
  state.previousPoint = currentPoint;
  return maskCanvas;
}

function drawImageHoverRevealStroke(
  context: CanvasRenderingContext2D,
  from: ImageHoverRevealPoint,
  to: ImageHoverRevealPoint,
  params: ImageHoverRevealParams,
): void {
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  if (distance === 0) {
    drawImageHoverRevealStamp(context, to.x, to.y, params);
    return;
  }

  const step = Math.max(6, readImageHoverRevealRadius(params) * 0.18);
  const count = Math.max(1, Math.ceil(distance / step));
  for (let index = 0; index <= count; index++) {
    const progress = index / count;
    drawImageHoverRevealStamp(
      context,
      from.x + (to.x - from.x) * progress,
      from.y + (to.y - from.y) * progress,
      params,
    );
  }
}

function drawImageHoverRevealStamp(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  params: ImageHoverRevealParams,
): void {
  const radius = readImageHoverRevealRadius(params);
  const feather = clampNumber(params.feather, 1, 160, 36);
  const roughness = readImageHoverRevealRoughness(params);
  const innerRadius = Math.max(1, radius - feather);

  context.save();
  context.globalCompositeOperation = "source-over";
  for (let ring = imageHoverRevealBrushRings; ring >= 1; ring--) {
    const progress = ring / imageHoverRevealBrushRings;
    const ringRadius = innerRadius + (radius - innerRadius) * progress;
    const alpha = ring === 1 ? 1 : Math.max(0.08, 1 - progress * 0.86);
    context.fillStyle = `rgba(255,255,255,${alpha})`;
    context.beginPath();
    for (let index = 0; index < imageHoverRevealBrushSegments; index++) {
      const angle = (Math.PI * 2 * index) / imageHoverRevealBrushSegments;
      const noisyRadius =
        ringRadius *
        (1 +
          Math.sin(x * 0.017 + y * 0.023 + index * 2.173 + ring * 0.911) *
            roughness *
            0.72);
      const pointX = x + Math.cos(angle) * noisyRadius;
      const pointY = y + Math.sin(angle) * noisyRadius;
      if (index === 0) {
        context.moveTo(pointX, pointY);
      } else {
        context.lineTo(pointX, pointY);
      }
    }
    context.closePath();
    context.fill();
  }
  context.restore();
}

function bakeImageHoverRevealMaskOpacity(
  context: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  opacity: number,
): void {
  context.save();
  context.globalCompositeOperation = "destination-in";
  context.globalAlpha = opacity;
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.restore();
}

function clearImageHoverRevealMask(state: ImageHoverRevealState): void {
  if (!state.maskCanvas) {
    return;
  }

  const context = readImageHoverRevealMaskContext(state.maskCanvas);
  if (context) {
    context.clearRect(0, 0, state.maskCanvas.width, state.maskCanvas.height);
    return;
  }

  state.maskCanvas.width = state.maskCanvas.width;
}

function readImageHoverRevealRestoreMs(params: ImageHoverRevealParams): number {
  return clampNumber(params.restoreMs, 250, 6000, 1800);
}

function readImageHoverRevealRadius(params: ImageHoverRevealParams): number {
  return clampNumber(params.radius, 8, 360, 120);
}

function readImageHoverRevealRoughness(params: ImageHoverRevealParams): number {
  return clampNumber(params.roughness, 0, 0.55, 0.24);
}

export function readImageHoverRevealTrailOpacity(
  time: number,
  state: ImageHoverRevealState,
  params: ImageHoverRevealParams,
): number {
  if (!state.maskCanvas || state.lastInteractionTime === undefined) {
    return 0;
  }

  const restoreMs = readImageHoverRevealRestoreMs(params);
  const age = Math.max(0, time - state.lastInteractionTime);
  return clampNumber(1 - age / restoreMs, 0, 1, 0);
}

function readImageHoverRevealMaskCanvas(
  state: ImageHoverRevealState,
  layout: { width: number; height: number },
): HTMLCanvasElement {
  const width = Math.max(1, Math.round(layout.width));
  const height = Math.max(1, Math.round(layout.height));
  if (
    state.maskCanvas &&
    state.maskSize?.width === width &&
    state.maskSize.height === height
  ) {
    return state.maskCanvas;
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  state.maskCanvas = canvas;
  state.maskSize = { width, height };
  state.previousPoint = undefined;
  state.lastInteractionTime = undefined;
  return canvas;
}

function readImageHoverRevealMaskContext(
  canvas: HTMLCanvasElement,
): CanvasRenderingContext2D | null {
  if (typeof CanvasRenderingContext2D === "undefined") {
    return null;
  }

  try {
    return canvas.getContext("2d");
  } catch (_error: unknown) {
    return null;
  }
}

export const imageHoverRevealFragmentShader = `
  uniform sampler2D uBaseTexture;
  uniform sampler2D uRevealTexture;
  uniform sampler2D uMaskTexture;
  uniform vec2 uPointer;
  uniform bool uPointerActive;
  uniform bool uRevealReady;
  uniform float uRadius;
  uniform float uFeather;
  uniform float uRoughness;
  uniform float uTrailOpacity;
  uniform vec2 uTargetSize;
  uniform vec2 uUvRepeat;
  uniform vec2 uUvOffset;
  varying vec2 vUv;

  void main() {
    vec2 sampledUv = vUv * uUvRepeat + uUvOffset;
    vec4 baseColor = texture2D(uBaseTexture, sampledUv);
    vec4 revealColor = texture2D(uRevealTexture, sampledUv);
    float mask = texture2D(uMaskTexture, vUv).a;
    mask *= (uRevealReady ? 1.0 : 0.0) * uTrailOpacity;
    gl_FragColor = mix(baseColor, revealColor, mask);
  }
`;

const imageHoverRevealBrushSegments = 18;
const imageHoverRevealBrushRings = 5;
const imageHoverRevealMovementThreshold = 2;
