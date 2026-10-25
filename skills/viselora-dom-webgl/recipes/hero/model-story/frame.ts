export type ModelStoryFacing = "front" | "side" | "back";

export type ModelStoryMessages = Readonly<Record<ModelStoryFacing, string>>;

export type ModelStoryFrame = {
  readonly rotationY: number;
  readonly facing: ModelStoryFacing;
  readonly phase: "typing" | "holding" | "deleting" | "blank";
  readonly characterProgress: number;
};

const facings = ["front", "side", "back", "side", "front"] as const;

/** A pure position on the scroll timeline; reversing scroll needs no history. */
export function resolveModelStoryFrame(
  progress: number,
  reducedMotion = false,
): ModelStoryFrame {
  const safeProgress = reducedMotion ? 0 : clampStoryProgress(progress);
  const stageProgress = safeProgress * 4;
  const index = Math.min(4, Math.round(stageProgress));
  const distance = stageProgress - index;
  const proximity = clampStoryProgress(1 - Math.abs(distance) * 2);
  const characterProgress = Number(
    clampStoryProgress(proximity / 0.68).toFixed(6),
  );

  return {
    rotationY: -safeProgress * Math.PI * 2,
    facing: facings[index],
    phase:
      characterProgress === 0
        ? "blank"
        : characterProgress === 1
          ? "holding"
          : distance < 0
            ? "typing"
            : "deleting",
    characterProgress,
  };
}

export function resolveStoryCharacterCount(
  length: number,
  progress: number,
): number {
  const safeLength = Number.isFinite(length)
    ? Math.max(0, Math.floor(length))
    : 0;
  return Math.min(
    safeLength,
    Math.floor(safeLength * clampStoryProgress(progress) + 1e-9),
  );
}

export function resolveStoryScrollProgress(
  top: number,
  height: number,
  viewportHeight: number,
): number {
  const travel = height - viewportHeight;
  return travel > 0 ? clampStoryProgress(-top / travel) : top < 0 ? 1 : 0;
}

export function clampStoryProgress(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}
