import type { FaceIndex } from "./types";
import { clampProgress, type Vector3 } from "./math";

export type PortalFrame = {
  readonly faceIndex: FaceIndex;
  readonly orientation: number;
  readonly approach: number;
  readonly triangleReveal: number;
  readonly screenLock: number;
  readonly domContentActive: boolean;
  readonly exiting: boolean;
};

const smooth = (value: number) => value * value * (3 - 2 * value);

/** Same pure mapping for forward and reverse scrolling; no elapsed-time state. */
export function resolvePortalFrame(
  entry: number,
  exit: number,
  faceIndex: FaceIndex = 0,
): PortalFrame {
  const arriving = clampProgress(entry);
  const leaving = clampProgress(exit);
  const flight =
    leaving > 0
      ? leaving < 0.38
        ? 1 - leaving
        : 0.62 * (1 - (leaving - 0.38) / 0.62)
      : arriving;
  const reveal =
    leaving > 0
      ? 1 - smooth(clampProgress(leaving / 0.38))
      : smooth(clampProgress((arriving - 0.62) / 0.38));
  return {
    faceIndex,
    orientation: smooth(clampProgress(flight)),
    approach: smooth(clampProgress(flight / 0.62)),
    triangleReveal: reveal,
    screenLock: reveal,
    domContentActive: arriving >= 1 && leaving <= 0,
    exiting: leaving > 0,
  };
}

export type HoldState = {
  readonly phase: "idle" | "expanding" | "retracting" | "awaiting-release";
  readonly coverage: number;
  readonly scheme: 0 | 1;
  readonly origin: readonly [number, number];
};

export function createHoldState(): HoldState {
  return { phase: "idle", coverage: 0, scheme: 0, origin: [0.5, 0.5] };
}

export function stepHold(
  state: HoldState,
  input: {
    readonly hit: boolean;
    readonly down: boolean;
    readonly origin: readonly [number, number];
    readonly delta: number;
    readonly holdMs: number;
  },
): HoldState {
  const dt = Math.min(64, Math.max(0, input.delta));
  const expand = (origin: readonly [number, number]): HoldState => {
    const coverage = clampProgress(state.coverage + dt / input.holdMs);
    return coverage >= 1
      ? {
          phase: "awaiting-release",
          coverage: 0,
          scheme: state.scheme === 0 ? 1 : 0,
          origin,
        }
      : { ...state, phase: "expanding", coverage, origin };
  };
  switch (state.phase) {
    case "idle":
      return input.hit && input.down ? expand(input.origin) : state;
    case "expanding":
      return input.down
        ? expand(state.origin)
        : { ...state, phase: "retracting" };
    case "retracting": {
      if (input.hit && input.down) return expand(state.origin);
      const coverage = Math.max(0, state.coverage - dt / 300);
      return {
        ...state,
        coverage,
        phase: coverage === 0 ? "idle" : "retracting",
      };
    }
    case "awaiting-release":
      return input.down ? state : { ...state, phase: "idle" };
  }
}

export function radialRadius(
  coverage: number,
  origin: readonly [number, number],
  width: number,
  height: number,
): number {
  const x = origin[0] * width;
  const y = origin[1] * height;
  return (
    (Math.max(
      Math.hypot(x, y),
      Math.hypot(width - x, y),
      Math.hypot(x, height - y),
      Math.hypot(width - x, height - y),
    ) *
      1.02 +
      2) *
    smooth(clampProgress(coverage))
  );
}

export function resolveHoldShake(
  time: number,
  state: HoldState,
  reducedMotion: boolean,
  strength = 1,
): { position: Vector3; rotation: Vector3 } {
  if (
    reducedMotion ||
    state.phase !== "expanding" ||
    state.coverage <= 0 ||
    state.coverage >= 1
  )
    return { position: [0, 0, 0], rotation: [0, 0, 0] };
  const envelope = Math.sin(Math.PI * state.coverage) * strength;
  const phase = time * 0.001 * Math.PI * 2;
  return {
    position: [
      Math.sin(phase * 11) * 0.008 * envelope,
      Math.cos(phase * 13) * 0.008 * envelope,
      Math.sin(phase * 17) * 0.008 * envelope,
    ],
    rotation: [
      Math.cos(phase * 13) * 0.018 * envelope,
      Math.sin(phase * 17) * 0.018 * envelope,
      Math.sin(phase * 11) * 0.018 * envelope,
    ],
  };
}
