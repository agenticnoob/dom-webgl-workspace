type CoverImageSource = HTMLImageElement | HTMLVideoElement;

export {
  calculateGhostCursorBaseRadius,
  drawGhostCursorSurface,
  type GhostSurfaceContext,
} from "./ghostCursorSurface";

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
