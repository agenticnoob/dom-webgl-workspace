export type ModelPreparePass = {
  readonly sceneId: string;
  readonly viewport:
    | { readonly mode: "canvas" }
    | {
        readonly mode: "dom-rect";
        readonly rect: {
          readonly x: number;
          readonly y: number;
          readonly width: number;
          readonly height: number;
        };
      };
};

export type ModelPrepareDecision =
  | { readonly allowed: true; readonly reason: "canvas-pass" | "near-dom-pass" }
  | { readonly allowed: false; readonly reason: "far-dom-pass" | "no-pass" };

const defaultPrepareMarginViewportMultiplier = 2.5;

export function readModelPrepareDecision(input: {
  readonly sceneId: string;
  readonly viewportHeight: number;
  readonly passes: readonly ModelPreparePass[];
  readonly marginPx?: number;
}): ModelPrepareDecision {
  const scenePasses = input.passes.filter(
    (pass) => pass.sceneId === input.sceneId,
  );
  if (scenePasses.length === 0) {
    return { allowed: false, reason: "no-pass" };
  }

  if (scenePasses.some((pass) => pass.viewport.mode === "canvas")) {
    return { allowed: true, reason: "canvas-pass" };
  }

  const viewportHeight = readPositiveNumber(input.viewportHeight, 1);
  const marginPx =
    input.marginPx ?? viewportHeight * defaultPrepareMarginViewportMultiplier;

  for (const pass of scenePasses) {
    if (pass.viewport.mode !== "dom-rect") {
      continue;
    }
    if (
      isDomRectInsidePrepareMargin(pass.viewport.rect, viewportHeight, marginPx)
    ) {
      return { allowed: true, reason: "near-dom-pass" };
    }
  }

  return { allowed: false, reason: "far-dom-pass" };
}

function isDomRectInsidePrepareMargin(
  rect: { readonly y: number; readonly width: number; readonly height: number },
  viewportHeight: number,
  marginPx: number,
): boolean {
  const top = readFiniteNumber(rect.y, Number.NaN);
  const width = readFiniteNumber(rect.width, 0);
  const height = readFiniteNumber(rect.height, 0);
  if (!Number.isFinite(top) || width <= 0 || height <= 0) {
    return false;
  }
  const bottom = top + height;

  return bottom >= -marginPx && top <= viewportHeight + marginPx;
}

function readPositiveNumber(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function readFiniteNumber(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}
