export type TimelineFlightState = {
  thrust: number;
  steering: number;
  spin: number;
};

export function createTimelineFlightState(): TimelineFlightState {
  return { thrust: 0, steering: 0, spin: 0 };
}

export function stepTimelineFlight(
  state: TimelineFlightState,
  input: {
    readonly delta: number;
    readonly scrollDelta: number;
    readonly height: number;
    readonly active: boolean;
  },
) {
  if (!input.active) {
    state.thrust = state.steering = state.spin = 0;
    return;
  }
  if (!Number.isFinite(input.delta) || input.delta <= 0) return;
  const delta = Math.min(64, input.delta);
  // The runtime reports pixels per frame. Normalize before capping integration.
  const speed = Number.isFinite(input.scrollDelta)
    ? (input.scrollDelta * 1000) /
      (input.delta * Math.max(1, input.height) * 2.2)
    : 0;
  const direction = Math.max(-1, Math.min(1, speed));
  const target = Math.abs(direction);
  state.thrust +=
    (target - state.thrust) *
    (1 - Math.exp(-delta / (target > state.thrust ? 100 : 420)));
  state.steering += (direction - state.steering) * (1 - Math.exp(-delta / 180));
  state.spin =
    (state.spin + (delta / 1000) * (0.16 + state.thrust * 0.65)) %
    (Math.PI * 2);
}

export function timelineFlightFrame(state: TimelineFlightState, time: number) {
  const seconds = time / 1000;
  return {
    scale: 1 - 0.22 * state.thrust,
    position: [
      Math.sin(seconds * Math.PI * 2 * 7.1) * 0.008 * state.thrust,
      Math.sin(seconds * Math.PI * 2 * 9.3) * 0.0056 * state.thrust,
      -0.14 * state.thrust,
    ] as const,
    rotation: [
      -0.12 * state.steering + Math.sin(seconds * 1.3) * 0.025 * state.thrust,
      state.spin,
      0.07 * state.steering + Math.sin(seconds * 2.1) * 0.018 * state.thrust,
    ] as const,
    glow: state.thrust,
  };
}
