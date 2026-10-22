import type { DOMTargetRect, DOMTargetSnapshot } from "./domRuntime";

/** Reads the rendered canvas in CSS pixels; `alpha` is 0 where nothing drew. */
export type PixelProbe = {
  readonly width: number;
  readonly height: number;
  alpha(x: number, y: number): number;
};

/** Frames between samples of one hidden target; readback stalls the GPU. */
export const readyPixelInterval = 10;
/** Consecutive empty samples before warning (30 frames). */
export const readyPixelSamples = 3;
const grid = 3;

/**
 * Checks, after rendering, that targets whose DOM fallback is hidden keep
 * pixels inside their rectangle. Other content drawn behind a target can pass
 * a sample, so checking continues while the fallback stays hidden; `warn` is
 * called once per hidden period after consecutive empty samples.
 */
export function createReadyPixelCheck(warn: (id: string) => void) {
  const hiddenFor = new Map<string, { frames: number; empty: number; warned: boolean }>();

  return {
    /** `probe` is undefined when the canvas is opaque and cannot tell. */
    check(targets: readonly DOMTargetSnapshot[], probe: PixelProbe | undefined) {
      const hidden = new Set<string>();
      for (const target of targets) {
        if (!target.hidden || !target.visible) continue;
        hidden.add(target.id);
        const state = hiddenFor.get(target.id) ?? { frames: 0, empty: 0, warned: false };
        hiddenFor.set(target.id, state);
        state.frames += 1;
        if (!probe || state.warned || state.frames % readyPixelInterval !== 0) continue;
        state.empty = drawnInside(target.rect, probe) ? 0 : state.empty + 1;
        if (state.empty < readyPixelSamples) continue;
        state.warned = true;
        warn(target.id);
      }
      // A fallback shown again starts a new hidden period.
      for (const id of hiddenFor.keys()) if (!hidden.has(id)) hiddenFor.delete(id);
    },
  };
}

function drawnInside(rect: DOMTargetRect, probe: PixelProbe) {
  let sampled = false;
  for (let row = 0; row < grid; row += 1) {
    for (let column = 0; column < grid; column += 1) {
      const x = rect.left + ((column + 0.5) / grid) * rect.width;
      const y = rect.top + ((row + 0.5) / grid) * rect.height;
      if (x < 0 || y < 0 || x >= probe.width || y >= probe.height) continue;
      sampled = true;
      if (probe.alpha(x, y) > 0) return true;
    }
  }
  // Nothing of the rectangle is on the canvas, so nothing can be judged.
  return !sampled;
}
