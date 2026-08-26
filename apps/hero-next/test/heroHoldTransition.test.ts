import { describe, expect, test } from "vitest";

import {
  createHeroHoldTransitionState,
  resolveHeroRadialGeometry,
  resolveHeroShake,
  resolveHeroTransitionVisual,
  stepHeroHoldTransition,
  type HeroHoldTransitionInput,
  type HeroHoldTransitionState,
} from "../src/transition/holdTransition";

const viewport = { width: 1200, height: 835 } as const;
const pressedInput = {
  interactionEnabled: true,
  meshPressed: true,
  primaryPointerDown: true,
  hitConfirmed: true,
  pointer: { x: 0.5, y: 0.5 },
  viewport,
  deltaMs: 16,
  reducedMotion: false,
} satisfies HeroHoldTransitionInput;
const releasedInput = {
  ...pressedInput,
  meshPressed: false,
  primaryPointerDown: false,
  hitConfirmed: false,
} satisfies HeroHoldTransitionInput;

function advance(
  state: HeroHoldTransitionState,
  totalMs: number,
  overrides: Partial<HeroHoldTransitionInput> = {},
): HeroHoldTransitionState {
  let next = state;
  let remaining = totalMs;
  while (remaining > 0) {
    const deltaMs = Math.min(16, remaining);
    next = stepHeroHoldTransition(next, {
      ...pressedInput,
      deltaMs,
      ...overrides,
    });
    remaining -= deltaMs;
  }
  return next;
}

function retract(
  state: HeroHoldTransitionState,
  totalMs: number,
): HeroHoldTransitionState {
  let next = stepHeroHoldTransition(state, {
    ...releasedInput,
    deltaMs: 0,
  });
  let remaining = totalMs;
  while (remaining > 0) {
    const deltaMs = Math.min(16, remaining);
    next = stepHeroHoldTransition(next, {
      ...releasedInput,
      deltaMs,
    });
    remaining -= deltaMs;
  }
  return next;
}

describe("hero hold transition", () => {
  test("expands for accumulated frame time and commits only at geometric coverage", () => {
    const idle = createHeroHoldTransitionState("initial");
    const at999 = advance(idle, 999);

    expect(at999.phase).toBe("expanding");
    expect(at999.coverage).toBeCloseTo(0.999, 6);
    expect(at999.committedScheme).toBe("initial");

    const complete = advance(at999, 1);
    expect(complete).toMatchObject({
      phase: "awaiting-release",
      coverage: 1,
      committedScheme: "inverted",
      targetScheme: "inverted",
      shakeActive: false,
    });
    expect(
      resolveHeroRadialGeometry(complete.coverage, complete.origin, viewport)
        .coversViewport,
    ).toBe(true);

    const oneLargeFrame = stepHeroHoldTransition(idle, {
      ...pressedInput,
      deltaMs: 1000,
    });
    expect(oneLargeFrame.coverage).toBeCloseTo(0.064, 6);
    expect(oneLargeFrame.phase).toBe("expanding");
  });

  test.each([0.25, 0.5, 0.9])(
    "retracts coverage %s at the proportional full-range rate",
    (coverage) => {
      const expanded = advance(
        createHeroHoldTransitionState("initial"),
        coverage * 1000,
      );
      const cancelled = retract(expanded, coverage * 300);

      expect(cancelled).toMatchObject({
        coverage: 0,
        phase: "idle",
        committedScheme: "initial",
        targetScheme: "initial",
      });
      expect(resolveHeroTransitionVisual(cancelled)).toEqual({
        committed: { background: "#B8B8B8", foreground: "#5F5F5F" },
        target: { background: "#B8B8B8", foreground: "#5F5F5F" },
      });
    },
  );

  test("keeps half coverage before 150ms and cancels at 150ms", () => {
    const half = advance(createHeroHoldTransitionState("initial"), 500);

    expect(retract(half, 149).coverage).toBeGreaterThan(0);
    expect(retract(half, 150)).toMatchObject({ coverage: 0, phase: "idle" });
  });

  test("resumes retraction from the current radius and original hit origin", () => {
    const expandedToHalf = advance(createHeroHoldTransitionState("initial"), 500);
    const retracting = stepHeroHoldTransition(expandedToHalf, releasedInput);
    const partlyRetracted = stepHeroHoldTransition(retracting, {
      ...releasedInput,
      deltaMs: 60,
    });
    const resumed = stepHeroHoldTransition(partlyRetracted, {
      ...pressedInput,
      pointer: { x: 0.8, y: 0.2 },
      deltaMs: 16,
    });

    expect(resumed.phase).toBe("expanding");
    expect(resumed.coverage).toBeGreaterThan(partlyRetracted.coverage);
    expect(resumed.origin).toEqual(expandedToHalf.origin);
    expect(resumed.targetScheme).toBe(expandedToHalf.targetScheme);
  });

  test("requires release after commit and toggles deterministically both ways", () => {
    const firstCommit = advance(createHeroHoldTransitionState("initial"), 1000);
    const heldAfterCommit = advance(firstCommit, 2000);
    const released = stepHeroHoldTransition(heldAfterCommit, releasedInput);
    const secondCommit = advance(released, 1000);

    expect(firstCommit.committedScheme).toBe("inverted");
    expect(heldAfterCommit).toMatchObject({
      phase: "awaiting-release",
      committedScheme: "inverted",
    });
    expect(released.phase).toBe("idle");
    expect(secondCommit).toMatchObject({
      phase: "awaiting-release",
      committedScheme: "initial",
      targetScheme: "initial",
    });
  });

  test("requires a confirmed primary mesh press to start", () => {
    const idle = createHeroHoldTransitionState();

    for (const overrides of [
      { meshPressed: false },
      { primaryPointerDown: false },
      { hitConfirmed: false },
    ]) {
      expect(
        stepHeroHoldTransition(idle, { ...pressedInput, ...overrides }),
      ).toEqual(idle);
    }
  });

  test("retracts an active attempt when the Hub-only interaction gate closes", () => {
    const expanded = advance(createHeroHoldTransitionState(), 320);
    const gated = stepHeroHoldTransition(expanded, {
      ...pressedInput,
      interactionEnabled: false,
      deltaMs: 16,
    });

    expect(gated).toMatchObject({
      phase: "retracting",
      committedScheme: "initial",
      targetScheme: "inverted",
      shakeActive: false,
    });
    expect(gated.coverage).toBe(expanded.coverage);
  });

  test("sanitizes invalid delta and clamps oversized frames", () => {
    const idle = createHeroHoldTransitionState();

    for (const deltaMs of [Number.NaN, Number.POSITIVE_INFINITY, -1]) {
      expect(
        stepHeroHoldTransition(idle, { ...pressedInput, deltaMs }).coverage,
      ).toBe(0);
    }
    expect(
      stepHeroHoldTransition(idle, { ...pressedInput, deltaMs: 1000 }).coverage,
    ).toBeCloseTo(0.064, 6);
  });

  test("covers desktop, mobile, and edge origins with circular pixel geometry", () => {
    for (const testedViewport of [
      { width: 1200, height: 835 },
      { width: 390, height: 844 },
    ]) {
      for (const origin of [
        { x: 0.5, y: 0.5 },
        { x: 0, y: 0 },
        { x: 1, y: 1 },
        { x: 0.03, y: 0.97 },
      ]) {
        const radial = resolveHeroRadialGeometry(1, origin, testedViewport);
        expect(radial.radiusPx).toBeGreaterThan(radial.farthestCornerPx);
        expect(radial.coversViewport).toBe(true);
      }
    }

    const wide = resolveHeroRadialGeometry(
      0.5,
      { x: 0.5, y: 0.5 },
      { width: 1600, height: 800 },
    );
    expect(wide.farthestCornerPx).toBeCloseTo(Math.hypot(800, 400), 6);
  });

  test("keeps timing and semantics under reduced motion while disabling shake", () => {
    const state = advance(createHeroHoldTransitionState("initial"), 500, {
      reducedMotion: true,
    });
    const complete = advance(state, 500, { reducedMotion: true });

    expect(state).toMatchObject({ phase: "expanding", coverage: 0.5 });
    expect(state.shakeActive).toBe(false);
    expect(resolveHeroShake(500, state, true)).toEqual({
      position: [0, 0, 0],
      rotation: [0, 0, 0],
    });
    expect(complete).toMatchObject({
      phase: "awaiting-release",
      committedScheme: "inverted",
      coverage: 1,
    });
  });
});
