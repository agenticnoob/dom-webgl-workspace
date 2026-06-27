export function clampNumber(
  value: number | undefined,
  min: number,
  max: number,
  fallback: number,
): number {
  if (value === undefined || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, value));
}

export function readTargetViewportProgress(layout: {
  top: number;
  height: number;
  viewport: { height: number };
}): number {
  const travelDistance = layout.viewport.height + layout.height;

  if (travelDistance <= 0) {
    return 0;
  }

  return clampNumber(
    (layout.viewport.height - layout.top) / travelDistance,
    0,
    1,
    0,
  );
}
