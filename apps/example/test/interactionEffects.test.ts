import { describe, expect, test } from "vitest";
import {
  readHoverOpacity,
  readKinematicSweep,
} from "../src/interactionEffects";

describe("native interaction frames", () => {
  test("a click pulse overrides hover for 260 milliseconds then restores the current state", () => {
    expect(readHoverOpacity(1, false, 0, 0.68, 0.92)).toBe(0.68);
    expect(readHoverOpacity(1, true, 0, 0.68, 0.92)).toBe(0.92);
    expect(readHoverOpacity(1.1, false, 1.26, 0.68, 0.92)).toBe(1);
    expect(readHoverOpacity(1.26, true, 1.26, 0.68, 0.92)).toBe(0.92);
    expect(readHoverOpacity(1.3, false, 1.26, 0.68, 0.92)).toBe(0.68);
  });
  test("kinematic model sweeps in native meter units without moving vertically", () => {
    expect(readKinematicSweep(0)).toEqual({ x: 2.52, y: -1.32, z: -0.7 });
    expect(readKinematicSweep(Math.PI / 4.8)).toEqual({
      x: 3.48,
      y: -1.32,
      z: -0.7,
    });
    expect(readKinematicSweep(Math.PI / 1.6)).toEqual({
      x: 1.56,
      y: -1.32,
      z: -0.7,
    });
  });
});
