import { axiomsReaderConfig } from "./config";

export function resolveAxiomsStamp(width: number, height: number) {
  const config = axiomsReaderConfig.stamp;
  const scale = Math.max(
    config.minimumScale,
    Math.min(1, width / config.referenceWidth),
  );
  const columns = Math.max(1, Math.round(width / (config.pitch * scale)));
  const rows = Math.max(1, Math.round(height / (config.pitch * scale)));
  return {
    columns,
    rows,
    pitchX: width / columns,
    pitchY: height / rows,
    radius: Math.min(
      config.radius * scale,
      width / columns / 3,
      height / rows / 3,
    ),
  };
}

// The face atlas and the live shader use the same pitch and half-cell centers.
export function traceAxiomsStamp(
  context: Pick<
    CanvasRenderingContext2D,
    "beginPath" | "moveTo" | "lineTo" | "arc" | "closePath"
  >,
  width: number,
  height: number,
): void {
  const stamp = resolveAxiomsStamp(width, height);
  const r = stamp.radius;
  context.beginPath();
  context.moveTo(0, 0);
  for (let i = 0; i < stamp.columns; i++) {
    const x = (i + 0.5) * stamp.pitchX;
    context.lineTo(x - r, 0);
    context.arc(x, 0, r, Math.PI, 0, true);
  }
  context.lineTo(width, 0);
  for (let i = 0; i < stamp.rows; i++) {
    const y = (i + 0.5) * stamp.pitchY;
    context.lineTo(width, y - r);
    context.arc(width, y, r, -Math.PI / 2, Math.PI / 2, true);
  }
  context.lineTo(width, height);
  for (let i = stamp.columns - 1; i >= 0; i--) {
    const x = (i + 0.5) * stamp.pitchX;
    context.lineTo(x + r, height);
    context.arc(x, height, r, 0, Math.PI, true);
  }
  context.lineTo(0, height);
  for (let i = stamp.rows - 1; i >= 0; i--) {
    const y = (i + 0.5) * stamp.pitchY;
    context.lineTo(0, y + r);
    context.arc(0, y, r, Math.PI / 2, -Math.PI / 2, true);
  }
  context.closePath();
}
