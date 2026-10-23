import { describe, expect, it } from "vitest";

import {
  budgetedDpr,
  createQualityGovernor,
  createQualityStore,
  defaultQualityBudgets,
  initialQualityTier,
} from "../src/lib/renderQuality";

const range = { min: 0.5, max: 2 };

describe("budgeted pixel ratio", () => {
  it("fits the drawing buffer inside the tier budget", () => {
    const laptop = { width: 1440, height: 900 };
    expect(budgetedDpr("high", defaultQualityBudgets, laptop, 2, range)).toBe(1.76);
    expect(budgetedDpr("medium", defaultQualityBudgets, laptop, 2, range)).toBe(1.24);
    expect(budgetedDpr("low", defaultQualityBudgets, laptop, 2, range)).toBe(0.88);
  });

  it("never exceeds the device ratio or the configured maximum", () => {
    const phone = { width: 360, height: 780 };
    expect(budgetedDpr("high", defaultQualityBudgets, phone, 3, range)).toBe(2);
    expect(budgetedDpr("high", defaultQualityBudgets, phone, 1, range)).toBe(1);
    expect(budgetedDpr("high", defaultQualityBudgets, phone, 3, { min: 0.5, max: 1.5 })).toBe(1.5);
  });

  it("keeps the configured minimum on very large displays", () => {
    const fiveK = { width: 2560, height: 1440 };
    expect(budgetedDpr("low", defaultQualityBudgets, fiveK, 2, range)).toBe(0.52);
    expect(budgetedDpr("low", defaultQualityBudgets, fiveK, 2, { min: 1, max: 2 })).toBe(1);
  });
});

describe("initial tier", () => {
  it("starts phones at medium and Save-Data at low", () => {
    expect(initialQualityTier({ coarsePointer: false, smallScreen: false, saveData: false })).toBe("high");
    expect(initialQualityTier({ coarsePointer: true, smallScreen: false, saveData: false })).toBe("high");
    expect(initialQualityTier({ coarsePointer: true, smallScreen: true, saveData: false })).toBe("medium");
    expect(initialQualityTier({ coarsePointer: false, smallScreen: false, saveData: true })).toBe("low");
  });
});

type FrameCost = Record<"high" | "medium" | "low", number>;

/** Feeds frames whose cost depends on the current tier; returns tier changes. */
function simulate(
  governor: ReturnType<typeof createQualityGovernor>,
  cost: FrameCost,
  seconds: number,
  clock: { now: number },
) {
  const changes: string[] = [];
  const end = clock.now + seconds * 1000;
  while (clock.now < end) {
    const frameMs = cost[governor.tier];
    clock.now += frameMs;
    const next = governor.sample(frameMs, clock.now);
    if (next) changes.push(next);
  }
  return changes;
}

const vsync = 1000 / 60;

/** Feeds the startup grace period with frames that neither step up nor down. */
function pastStartup(governor: ReturnType<typeof createQualityGovernor>, clock: { now: number }) {
  expect(simulate(governor, { high: 18, medium: 18, low: 18 }, 3.1, clock)).toEqual([]);
}

describe("quality governor", () => {
  it("ignores the first three seconds of startup frames", () => {
    const clock = { now: 0 };
    const governor = createQualityGovernor("high");
    expect(simulate(governor, { high: 120, medium: 120, low: 120 }, 2.9, clock)).toEqual([]);
    expect(governor.tier).toBe("high");
  });

  it("steps down one tier at a time while fewer pixels help", () => {
    const clock = { now: 0 };
    const governor = createQualityGovernor("high");
    pastStartup(governor, clock);
    const cost = { high: 40, medium: 28, low: 18 };
    expect(simulate(governor, cost, 1.5, clock)).toEqual([]);
    expect(simulate(governor, cost, 1, clock)).toEqual(["medium"]);
    expect(simulate(governor, cost, 3, clock)).toEqual(["low"]);
    expect(simulate(governor, cost, 10, clock)).toEqual([]);
  });

  it("drops straight to low when frames are far over budget", () => {
    const clock = { now: 0 };
    const governor = createQualityGovernor("high");
    pastStartup(governor, clock);
    expect(simulate(governor, { high: 180, medium: 90, low: 30 }, 3, clock)).toEqual(["low"]);
  });

  it("undoes a downgrade that does not shorten frames and then waits", () => {
    const clock = { now: 0 };
    const governor = createQualityGovernor("high");
    pastStartup(governor, clock);
    const cpuBound = { high: 30, medium: 30, low: 30 };
    expect(simulate(governor, cpuBound, 4.5, clock)).toEqual(["medium", "high"]);
    expect(simulate(governor, cpuBound, 9, clock)).toEqual([]);
    // After the cooldown it tries once more and undoes it again.
    expect(simulate(governor, cpuBound, 4, clock)).toEqual(["medium", "high"]);
  });

  it("steps up once frames keep up with a 60 Hz display", () => {
    const clock = { now: 0 };
    const governor = createQualityGovernor("low");
    pastStartup(governor, clock);
    const cost = { high: vsync, medium: vsync, low: vsync };
    expect(simulate(governor, cost, 4, clock)).toEqual([]);
    expect(simulate(governor, cost, 1.5, clock)).toEqual(["medium"]);
    expect(simulate(governor, cost, 6, clock)).toEqual(["high"]);
  });

  it("does not step up from steady slow frames", () => {
    const clock = { now: 0 };
    const governor = createQualityGovernor("low");
    pastStartup(governor, clock);
    expect(simulate(governor, { high: 21, medium: 21, low: 21 }, 15, clock)).toEqual([]);
  });

  it("ignores pauses", () => {
    const clock = { now: 0 };
    const governor = createQualityGovernor("medium");
    pastStartup(governor, clock);
    expect(governor.sample(2000, 2000)).toBeUndefined();
    expect(governor.sample(0, 2000)).toBeUndefined();
    expect(governor.tier).toBe("medium");
  });

  it("stops upgrading after three recoveries so tiers do not oscillate", () => {
    const clock = { now: 0 };
    const governor = createQualityGovernor("high");
    pastStartup(governor, clock);
    const changes = simulate(governor, { high: 26, medium: vsync, low: vsync }, 60, clock);
    expect(changes.filter((tier) => tier === "high")).toHaveLength(3);
    expect(governor.tier).toBe("medium");
  });

  it("does not step above its ceiling", () => {
    const clock = { now: 0 };
    const governor = createQualityGovernor("medium", "medium");
    pastStartup(governor, clock);
    expect(simulate(governor, { high: vsync, medium: vsync, low: vsync }, 10, clock)).toEqual([]);
  });
});

describe("quality store", () => {
  it("notifies only on changes and moves tiers only when adaptive", () => {
    const store = createQualityStore();
    let notified = 0;
    store.subscribe(() => {
      notified += 1;
    });
    store.configure("high", false);
    expect(notified).toBe(0);
    for (let at = 0; at < 5000; at += 40) store.sample(40, at);
    expect(store.get().tier).toBe("high");

    store.configure("high", true);
    for (let at = 0; at < 6000; at += 40) store.sample(40, at);
    expect(store.get().tier).toBe("medium");
    store.setDpr(1.24);
    store.setDpr(1.24);
    store.setReducedMotion(true);
    expect(store.get()).toEqual({ tier: "medium", dpr: 1.24, reducedMotion: true });
    expect(notified).toBe(3);
  });
});
