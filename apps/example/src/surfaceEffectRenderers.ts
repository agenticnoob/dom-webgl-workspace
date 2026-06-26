type CoverImageSource = HTMLImageElement | HTMLVideoElement;

export {
  calculateGhostCursorBaseRadius,
  drawGhostCursorSurface,
  type GhostSurfaceContext,
} from "./ghostCursorSurface";

type WavesOptions = {
  readonly lineColor: string;
  readonly opacity: number;
  readonly pointerActive: boolean;
  readonly pointerX: number;
  readonly pointerY: number;
  readonly time: number;
};

export function drawCoverImage(
  context: CanvasRenderingContext2D,
  image: CoverImageSource | undefined,
  width: number,
  height: number,
): void {
  const sourceWidth = readSourceWidth(image);
  const sourceHeight = readSourceHeight(image);
  if (!image || sourceWidth <= 0 || sourceHeight <= 0) {
    return;
  }

  const sourceRatio = sourceWidth / sourceHeight;
  const targetRatio = width / height;
  let sourceX = 0;
  let sourceY = 0;
  let coverWidth = sourceWidth;
  let coverHeight = sourceHeight;

  if (sourceRatio > targetRatio) {
    coverWidth = sourceHeight * targetRatio;
    sourceX = (sourceWidth - coverWidth) / 2;
  } else {
    coverHeight = sourceWidth / targetRatio;
    sourceY = (sourceHeight - coverHeight) / 2;
  }

  context.drawImage(
    image,
    sourceX,
    sourceY,
    coverWidth,
    coverHeight,
    0,
    0,
    width,
    height,
  );
}

export function drawPulseSurface(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  pulse: number,
  opacity: number,
  expansion: number,
): void {
  context.clearRect(0, 0, width, height);
  const inset = Math.max(
    8,
    Math.min(width, height) * (0.035 + pulse * (0.04 + expansion * 0.12)),
  );
  const lineWidth = Math.max(3, Math.min(width, height) * 0.018);

  context.save();
  context.globalAlpha = (0.58 + pulse * 0.28) * opacity;
  context.fillStyle = "#d95f42";
  context.fillRect(0, 0, width, height);
  context.globalAlpha = 1;
  context.strokeStyle = "#fff1b8";
  context.lineWidth = lineWidth;
  context.strokeRect(
    inset,
    inset,
    Math.max(1, width - inset * 2),
    Math.max(1, height - inset * 2),
  );
  context.globalAlpha = (0.64 + pulse * 0.36) * opacity;
  context.fillStyle = "#ffffff";
  context.fillRect(0, height * (0.18 + pulse * 0.5), width, lineWidth * 1.8);
  context.restore();
}

export function drawWavesSurface(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  options: WavesOptions,
): void {
  context.clearRect(0, 0, width, height);
  context.save();
  context.globalAlpha = options.opacity;
  context.strokeStyle = options.lineColor;
  context.lineWidth = Math.max(1, Math.min(width, height) * 0.006);

  const xGap = 18;
  const yGap = 28;
  const columns = Math.ceil((width + 160) / xGap);
  const rows = Math.ceil((height + 120) / yGap);
  const startX = (width - columns * xGap) / 2;
  const startY = (height - rows * yGap) / 2;

  for (let column = 0; column <= columns; column += 1) {
    context.beginPath();
    for (let row = 0; row <= rows; row += 1) {
      const baseX = startX + column * xGap;
      const baseY = startY + row * yGap;
      const wave = Math.sin(baseX * 0.018 + options.time * 0.0015);
      const sway = Math.cos(baseY * 0.026 + options.time * 0.0011);
      const pointer = options.pointerActive
        ? pointerDisplacement(baseX, baseY, options)
        : { x: 0, y: 0 };
      const x = baseX + wave * 24 + pointer.x;
      const y = baseY + sway * 14 + pointer.y;
      if (row === 0) {
        context.moveTo(x, y);
      } else {
        context.lineTo(x, y);
      }
    }
    context.stroke();
  }

  context.restore();
}

function pointerDisplacement(
  x: number,
  y: number,
  options: WavesOptions,
): { readonly x: number; readonly y: number } {
  const dx = x - options.pointerX;
  const dy = y - options.pointerY;
  const distance = Math.hypot(dx, dy);
  const radius = 190;
  const strength = Math.max(0, 1 - distance / radius);
  const angle = Math.atan2(dy, dx) + Math.sin(options.time * 0.002) * 0.8;
  const push = strength * strength * 72;
  return {
    x: Math.cos(angle) * push,
    y: Math.sin(angle) * push,
  };
}

function readSourceWidth(image: CoverImageSource | undefined): number {
  if (!image) {
    return 0;
  }

  if (image instanceof HTMLImageElement) {
    return image.naturalWidth;
  }

  return image.videoWidth;
}

function readSourceHeight(image: CoverImageSource | undefined): number {
  if (!image) {
    return 0;
  }

  if (image instanceof HTMLImageElement) {
    return image.naturalHeight;
  }

  return image.videoHeight;
}
