import { describe, expect, test } from "vitest";
import {
  createTimelinePanels,
  timelineConfig,
  timelineGeometry,
  timelineLanePosition,
  timelinePanelMotion,
  timelineTravel,
  timelineWindowStart,
} from "../../src/recipes/perspective-timeline/track";

const viewport = { width: 1440, height: 900 };
const entries = Array.from({ length: 40 }, (_, index) => ({
  id: `entry-${index}`,
  label: `Version ${40 - index}`,
  meta: "Tools · Notes",
  body:
    index % 3
      ? "A short entry."
      : "Mixed 中英文 paragraphs with a longer reading interval. ".repeat(10),
}));

describe("perspective timeline track", () => {
  test("preserves caller order and reserves space for both complete columns", () => {
    const panels = createTimelinePanels(entries, viewport);
    expect(panels.map((panel) => panel.id)).toEqual(
      entries.map((entry) => entry.id),
    );
    expect(panels[0].height).toBeGreaterThan(panels[1].height);
    for (let index = 1; index < panels.length; index++) {
      const previous = panels[index - 1];
      const current = panels[index];
      const ratio = Math.exp(
        (current.offset - previous.offset) * timelineConfig.rate,
      );
      expect(
        timelineConfig.slope * (ratio - 1) * viewport.height,
      ).toBeGreaterThanOrEqual(current.height);
    }
  });

  test("accounts for explicit line breaks, long metadata and a multiline label", () => {
    const base = entries[1];
    const panel = (patch: Partial<typeof base>) =>
      createTimelinePanels([{ ...base, ...patch }], viewport)[0];
    expect(panel({ body: "a\n".repeat(30) }).height).toBeGreaterThan(
      panel({ body: "a".repeat(30) }).height,
    );
    expect(panel({ meta: "metadata ".repeat(200) }).height).toBeGreaterThan(
      panel({}).height,
    );
    expect(panel({ label: "Milestone ".repeat(100) }).height).toBeGreaterThan(
      panel({}).height,
    );
  });

  test("projects matching left and right lanes to symmetric screen positions", () => {
    const panels = createTimelinePanels(entries, viewport);
    for (const progress of [0, 0.2, 0.5, 0.8, 1, 0.5, 0]) {
      for (const panel of panels) {
        const motion = timelinePanelMotion(progress, panel, panels);
        if (motion.opacity === 0) continue;
        const left = timelineLanePosition(motion, "left", viewport);
        const right = timelineLanePosition(motion, "right", viewport);
        expect(left[0]).toBeCloseTo(-right[0]);
        expect(left.slice(1)).toEqual(right.slice(1));
        const screenHeight =
          (timelineConfig.cameraZ - left[2]) *
          2 *
          Math.tan((timelineConfig.fov * Math.PI) / 360);
        expect(0.5 - left[1] / screenHeight).toBeCloseTo(motion.y);
      }
    }
  });

  test("keeps every visible entry inside a bounded window during forward and reverse scroll", () => {
    const panels = createTimelinePanels(entries, viewport);
    for (const index of [
      ...Array.from({ length: 101 }, (_, index) => index),
      70,
      40,
      0,
    ]) {
      const progress = index / 100;
      const start = timelineWindowStart(progress, panels);
      const window = panels.slice(start, start + timelineConfig.slots);
      expect(window.length).toBeLessThanOrEqual(16);
      for (const panel of panels)
        if (timelinePanelMotion(progress, panel, panels).opacity > 0.001)
          expect(window).toContain(panel);
    }
  });

  test("starts at a readable scale and fades the final panel after it exits", () => {
    const panels = createTimelinePanels(entries, viewport);
    expect(timelinePanelMotion(0, panels[0], panels).scale).toBeCloseTo(0.76);
    expect(timelinePanelMotion(0, panels[0], panels).opacity).toBe(1);
    expect(timelinePanelMotion(1, panels.at(-1)!, panels).opacity).toBeCloseTo(
      0,
    );
  });

  test("handles empty datasets and clamps nonfinite/out-of-range progress", () => {
    expect(timelineWindowStart(1, [])).toBe(0);
    expect(Number.isFinite(timelineTravel(1, []))).toBe(true);
    const panels = createTimelinePanels(entries, viewport);
    for (const value of [NaN, Infinity, -1])
      expect(timelineTravel(value, panels)).toBe(timelineTravel(0, panels));
    expect(timelineTravel(3, panels)).toBe(timelineTravel(1, panels));
    expect(timelineGeometry({ width: 1000, height: 900 }).width).toBe(300);
  });
});
