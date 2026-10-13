import { describe, expect, test, vi } from "vitest";
import {
  drawTimelineCard,
  readTimelineCardFrame,
} from "../src/managedTimelineCardEffect";

describe("native timeline card", () => {
  test("stays hidden before entry and holds the final opaque pose", () => {
    expect(readTimelineCardFrame(0.04)).toMatchObject({
      visible: false,
      opacity: 0,
      rotationY: -0.28,
    });
    expect(readTimelineCardFrame(1)).toMatchObject({
      visible: true,
      opacity: 1,
      rotationY: 0.18,
    });
  });
  test("retains the original reversible tilt and composite surface opacity", () => {
    const early = readTimelineCardFrame(0.28);
    const middle = readTimelineCardFrame(0.64);
    expect(early.rotationY).toBeLessThan(-0.18);
    expect(middle.rotationY).toBeGreaterThan(0.12);
    expect(early.opacity).toBeGreaterThan(0);
    expect(early.opacity).toBeLessThan(middle.opacity);
    expect(readTimelineCardFrame(0.28)).toEqual(early);
  });
  test("draws the original card typography and progress rail into a canvas texture", () => {
    const text = vi.fn();
    const rail = vi.fn();
    const context = {
      clearRect: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      globalAlpha: 1,
      fillStyle: "",
      font: "",
      textBaseline: "top",
      fillText: text,
      fillRect: rail,
      fill: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      quadraticCurveTo: vi.fn(),
      closePath: vi.fn(),
    } satisfies Parameters<typeof drawTimelineCard>[0];
    drawTimelineCard(context, 360, 136, 0.64, 1);
    expect(text.mock.calls.map((call) => call[0])).toEqual([
      "WebGLTarget",
      "Timeline",
      "target",
    ]);
    expect(rail).toHaveBeenCalledWith(
      expect.any(Number),
      expect.any(Number),
      expect.closeTo((360 - 10.88 * 2.7) * 0.64),
      4,
    );
  });
});
