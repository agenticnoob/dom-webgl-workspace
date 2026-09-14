import { describe, expect, test } from "vitest";
import {
  createTimelineFlightState,
  stepTimelineFlight,
  timelineFlightFrame,
} from "../../src/recipes/perspective-timeline/flight";

const input = { delta: 1000 / 60, scrollDelta: 30, height: 900, active: true };

describe("timeline scroll flight", () => {
  test("accelerates into a smaller, brighter, banking mesh and damps after stopping", () => {
    const state = createTimelineFlightState();
    for (let index = 0; index < 60; index++) stepTimelineFlight(state, input);
    const moving = timelineFlightFrame(state, 1000);
    expect(moving.scale).toBeLessThan(0.85);
    expect(moving.scale).toBeGreaterThanOrEqual(0.78);
    expect(moving.position[2]).toBeLessThan(0);
    expect(moving.rotation[0]).toBeLessThan(0);
    expect(moving.glow).toBeGreaterThan(0.7);
    for (let index = 0; index < 240; index++)
      stepTimelineFlight(state, { ...input, scrollDelta: 0 });
    const resting = timelineFlightFrame(state, 5000);
    expect(resting.scale).toBeCloseTo(1, 3);
    expect(resting.glow).toBeCloseTo(0, 3);
    expect(resting.position[2]).toBeCloseTo(0, 4);
  });

  test("reverses banking without reversing spin or changing thrust magnitude", () => {
    const forward = createTimelineFlightState();
    const backward = createTimelineFlightState();
    for (let index = 0; index < 60; index++) {
      stepTimelineFlight(forward, input);
      stepTimelineFlight(backward, { ...input, scrollDelta: -30 });
    }
    expect(forward.thrust).toBe(backward.thrust);
    expect(forward.steering).toBeCloseTo(-backward.steering);
    expect(forward.spin).toBe(backward.spin);
  });

  test("normalizes speed independently of frame rate and viewport height", () => {
    const states = [30, 60, 120].map((fps) => {
      const state = createTimelineFlightState();
      for (let index = 0; index < fps; index++)
        stepTimelineFlight(state, {
          ...input,
          delta: 1000 / fps,
          scrollDelta: 1800 / fps,
        });
      return state;
    });
    for (const state of states) {
      expect(state.thrust).toBeCloseTo(states[0].thrust, 5);
      expect(state.spin).toBeCloseTo(states[0].spin, 1);
    }
    const small = createTimelineFlightState();
    for (let index = 0; index < 60; index++)
      stepTimelineFlight(small, { ...input, height: 450, scrollDelta: 15 });
    expect(small.thrust).toBeCloseTo(states[1].thrust, 5);
  });

  test("resets offscreen flight and rejects invalid elapsed times", () => {
    const state = { thrust: 1, steering: 1, spin: 2 };
    stepTimelineFlight(state, { ...input, delta: 0 });
    expect(state.spin).toBe(2);
    stepTimelineFlight(state, { ...input, active: false });
    expect(state).toEqual(createTimelineFlightState());
    stepTimelineFlight(state, { ...input, delta: 60000, scrollDelta: 1e9 });
    expect(state.spin).toBeLessThan(0.1);
    expect(state.thrust).toBeLessThanOrEqual(1);
  });
});
