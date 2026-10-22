import type { DOMTargetRect } from "./domRuntime";

/**
 * `active`: drawn and updated. `warm`: updated but not drawn, so it can
 * prepare. `sleep`: neither; its effects and frame callbacks are disconnected.
 */
export type SectionPhase = "sleep" | "warm" | "active";

export type SectionMargins = {
  /** Largest distance that is still `active`. */
  readonly active: number;
  /** Largest distance that is still `warm`; at least `active`. */
  readonly warm: number;
  /** Extra distance a phase keeps before it is left, so edges do not flicker. */
  readonly hysteresis: number;
};

/** Target margins in viewport sizes: 3D content often overflows its DOM box. */
export const targetSectionMargins: SectionMargins = {
  active: 0.5,
  warm: 1.5,
  hysteresis: 0.1,
};

/** Progress margins in the progress signal's own units. */
export const progressSectionMargins: SectionMargins = {
  active: 0,
  warm: 0.15,
  hysteresis: 0.02,
};

/**
 * Distance between a rect and the viewport in viewport sizes (the larger of
 * the vertical and horizontal gaps); 0 when they overlap. An empty rect has no
 * position and returns `undefined`.
 */
export function viewportDistance(
  rect: DOMTargetRect,
  viewport: { readonly width: number; readonly height: number },
) {
  if (rect.width <= 0 && rect.height <= 0) return undefined;
  const vertical =
    Math.max(0, rect.top - viewport.height, -rect.bottom) /
    Math.max(1, viewport.height);
  const horizontal =
    Math.max(0, rect.left - viewport.width, -rect.right) /
    Math.max(1, viewport.width);
  return Math.max(vertical, horizontal);
}

/** Distance from `value` to the closed range `[from, to]`; 0 inside it. */
export function rangeDistance(value: number, from: number, to: number) {
  return Math.max(0, Math.min(from, to) - value, value - Math.max(from, to));
}

/** The phase for `distance`; an unknown distance (no target) sleeps. */
export function nextSectionPhase(
  previous: SectionPhase,
  distance: number | undefined,
  margins: SectionMargins,
): SectionPhase {
  if (distance === undefined || !Number.isFinite(distance)) return "sleep";
  const active =
    margins.active + (previous === "active" ? margins.hysteresis : 0);
  if (distance <= active) return "active";
  const warm =
    Math.max(margins.warm, margins.active) +
    (previous === "sleep" ? 0 : margins.hysteresis);
  return distance <= warm ? "warm" : "sleep";
}
