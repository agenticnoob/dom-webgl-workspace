type GhostCursorOptions = {
  readonly color: string;
  readonly opacity: number;
  readonly pointerActive: boolean;
  readonly pointerIntensity: number;
  readonly pointerX: number;
  readonly pointerY: number;
  readonly time: number;
  readonly trailLength: number;
};

type GhostSurfaceGradient = {
  addColorStop(offset: number, color: string): void;
};

export type GhostSurfaceContext = {
  fillStyle: string | CanvasGradient | CanvasPattern | GhostSurfaceGradient;
  font: string;
  globalAlpha: number;
  globalCompositeOperation: GlobalCompositeOperation;
  lineWidth: number;
  strokeStyle: string | CanvasGradient | CanvasPattern | GhostSurfaceGradient;
  textAlign: CanvasTextAlign;
  textBaseline: CanvasTextBaseline;
  beginPath(): void;
  arc(x: number, y: number, radius: number, startAngle: number, endAngle: number): void;
  clearRect(x: number, y: number, width: number, height: number): void;
  createRadialGradient(
    x0: number,
    y0: number,
    r0: number,
    x1: number,
    y1: number,
    r1: number,
  ): CanvasGradient | GhostSurfaceGradient;
  fill(): void;
  fillRect(x: number, y: number, width: number, height: number): void;
  fillText(text: string, x: number, y: number): void;
  restore(): void;
  save(): void;
  strokeRect(x: number, y: number, width: number, height: number): void;
};

export function drawGhostCursorSurface(
  context: GhostSurfaceContext,
  width: number,
  height: number,
  options: GhostCursorOptions,
): void {
  context.clearRect(0, 0, width, height);
  drawGhostStage(context, width, height);
  const pointerIntensity = Math.max(0, Math.min(1, options.pointerIntensity));
  context.save();
  context.globalCompositeOperation = "screen";

  const maxTrail = Math.max(6, Math.min(64, options.trailLength));
  const baseRadius = calculateGhostCursorBaseRadius(width, height);
  for (let index = maxTrail; index >= 0; index -= 1) {
    const sample = createSmokeSample(index, maxTrail, baseRadius, width, height, options.time);
    const alpha =
      options.opacity *
      sample.weight *
      (0.018 + noise2(sample.x, sample.y, options.time) * 0.05);
    drawSmokeCluster(
      context,
      sample.x,
      sample.y,
      sample.radius,
      options.color,
      alpha,
      sample.drift,
    );
  }
  if (options.pointerActive || pointerIntensity > 0.01) {
    drawGhostSpotlight(
      context,
      options.pointerX,
      options.pointerY,
      baseRadius * 4.8,
      options.color,
      options.opacity * pointerIntensity * 0.48,
    );
  }

  context.restore();
  drawGhostText(context, width, height);
}

export function calculateGhostCursorBaseRadius(width: number, height: number): number {
  return Math.max(18, Math.min(width, height) * 0.13);
}

function drawGhostStage(
  context: GhostSurfaceContext,
  width: number,
  height: number,
): void {
  context.save();
  context.globalAlpha = 1;
  context.globalCompositeOperation = "source-over";
  context.fillStyle = "#07050c";
  context.fillRect(0, 0, width, height);
  context.globalAlpha = 0.78;
  context.strokeStyle = "rgba(92, 72, 118, 0.5)";
  context.lineWidth = Math.max(1, Math.min(width, height) * 0.008);
  context.strokeRect(
    context.lineWidth * 0.5,
    context.lineWidth * 0.5,
    Math.max(1, width - context.lineWidth),
    Math.max(1, height - context.lineWidth),
  );
  context.restore();
}

function drawGhostText(
  context: GhostSurfaceContext,
  width: number,
  height: number,
): void {
  context.save();
  context.globalCompositeOperation = "source-over";
  context.globalAlpha = 0.84;
  context.fillStyle = "#05030a";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = `700 ${Math.max(72, Math.min(width * 0.22, height * 0.54))}px Georgia, "Times New Roman", serif`;
  context.fillText("Boo!", width * 0.5, height * 0.55);
  context.restore();
}

function drawGhostSpotlight(
  context: GhostSurfaceContext,
  x: number,
  y: number,
  radius: number,
  color: string,
  alpha: number,
): void {
  const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, colorWithAlpha("#f0ddff", alpha));
  gradient.addColorStop(0.32, colorWithAlpha(color, alpha * 0.58));
  gradient.addColorStop(0.72, colorWithAlpha(color, alpha * 0.12));
  gradient.addColorStop(1, colorWithAlpha(color, 0));
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fill();
}

function drawSmokeBlob(
  context: GhostSurfaceContext,
  x: number,
  y: number,
  radius: number,
  color: string,
  alpha: number,
): void {
  const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, colorWithAlpha(color, alpha));
  gradient.addColorStop(0.42, colorWithAlpha(color, alpha * 0.34));
  gradient.addColorStop(1, colorWithAlpha(color, 0));
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fill();
}

function drawSmokeCluster(
  context: GhostSurfaceContext,
  x: number,
  y: number,
  radius: number,
  color: string,
  alpha: number,
  drift: number,
): void {
  for (let index = 0; index < 5; index += 1) {
    const branch = drift + index * 1.47;
    const offset = radius * (0.12 + index * 0.11);
    drawSmokeBlob(
      context,
      x + Math.cos(branch) * offset,
      y + Math.sin(branch * 1.4) * offset,
      radius * (0.54 - index * 0.055),
      index % 2 === 0 ? color : "#e7d7ff",
      alpha * (1 - index * 0.14),
    );
  }
}

function createSmokeSample(
  index: number,
  maxTrail: number,
  baseRadius: number,
  width: number,
  height: number,
  time: number,
): {
  readonly drift: number;
  readonly radius: number;
  readonly weight: number;
  readonly x: number;
  readonly y: number;
} {
  const age = index / maxTrail;
  const drift = time * 0.0012 + index * 2.399;
  const pulse = noise2(index * 19.7, age * 31.3, time);
  const orbit = baseRadius * (0.9 + age * 3.4 + pulse * 1.2);
  const centerX = width * (0.51 + Math.sin(time * 0.00018) * 0.04);
  const centerY = height * (0.43 + Math.cos(time * 0.00021) * 0.05);
  const verticalBias = Math.sin(time * 0.0008 + age * Math.PI) * baseRadius * 0.42;

  return {
    drift,
    radius: baseRadius * (0.78 + pulse * 1.32 + (1 - age) * 0.72),
    weight: Math.max(0, 1 - age * 0.74),
    x: centerX + Math.cos(drift) * orbit * 1.8,
    y: centerY + Math.sin(drift * 1.37) * orbit * 0.95 - verticalBias,
  };
}

function colorWithAlpha(color: string, alpha: number): string {
  if (color.startsWith("#") && color.length === 7) {
    const red = Number.parseInt(color.slice(1, 3), 16);
    const green = Number.parseInt(color.slice(3, 5), 16);
    const blue = Number.parseInt(color.slice(5, 7), 16);
    return `rgba(${red}, ${green}, ${blue}, ${Math.max(0, Math.min(1, alpha))})`;
  }

  return color;
}

function noise2(x: number, y: number, time: number): number {
  return (
    Math.sin(x * 0.021 + time * 0.0017) * 0.5 +
    Math.cos(y * 0.028 - time * 0.0013) * 0.5 +
    1
  ) / 2;
}
