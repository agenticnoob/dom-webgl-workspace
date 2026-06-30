import { describe, expect, test } from "vitest";

import {
  createSceneGateStateMachine,
  detectSceneGateCrossing,
  measureSceneGateStart,
  parseSceneGateStart,
} from "../../../src/lib/input/sceneGate";

describe("parseSceneGateStart", () => {
  test("rejects unsupported start strings with a clear error", () => {
    expect(() => parseSceneGateStart("left left")).toThrowError(
      /unsupported scene gate start/i,
    );
  });
});

describe("measureSceneGateStart", () => {
  test("measures top-top anchors against the viewport top line", () => {
    expect(
      measureSceneGateStart({
        rect: { top: 120, height: 240 },
        viewportHeight: 800,
        start: "top top",
      }),
    ).toEqual({
      anchorLine: 120,
      viewportLine: 0,
      offset: 120,
    });
  });

  test("measures center-center anchors against the viewport center line", () => {
    expect(
      measureSceneGateStart({
        rect: { top: 100, height: 240 },
        viewportHeight: 800,
        start: "center center",
      }),
    ).toEqual({
      anchorLine: 220,
      viewportLine: 400,
      offset: -180,
    });
  });

  test("measures bottom-bottom anchors against the viewport bottom line", () => {
    expect(
      measureSceneGateStart({
        rect: { top: 100, bottom: 340, height: 240 },
        viewportHeight: 300,
        start: "bottom bottom",
      }),
    ).toEqual({
      anchorLine: 340,
      viewportLine: 300,
      offset: 40,
    });
  });
});

describe("detectSceneGateCrossing", () => {
  test("reports forward crossing when offset moves from positive to zero or below", () => {
    expect(
      detectSceneGateCrossing({
        previousOffset: 20,
        currentOffset: 0,
      }),
    ).toBe("forward");

    expect(
      detectSceneGateCrossing({
        previousOffset: 20,
        currentOffset: -5,
      }),
    ).toBe("forward");
  });

  test("reports reverse crossing when offset moves from negative to zero or above", () => {
    expect(
      detectSceneGateCrossing({
        previousOffset: -20,
        currentOffset: 0,
      }),
    ).toBe("reverse");

    expect(
      detectSceneGateCrossing({
        previousOffset: -20,
        currentOffset: 5,
      }),
    ).toBe("reverse");
  });

  test("does not report a crossing when offsets stay on the same side", () => {
    expect(
      detectSceneGateCrossing({
        previousOffset: 20,
        currentOffset: 5,
      }),
    ).toBeNull();

    expect(
      detectSceneGateCrossing({
        previousOffset: -20,
        currentOffset: -5,
      }),
    ).toBeNull();

    expect(
      detectSceneGateCrossing({
        previousOffset: 0,
        currentOffset: 0,
      }),
    ).toBeNull();
  });
});

describe("createSceneGateStateMachine", () => {
  test("exposes inactive state and leaves it unchanged when applying scroll delta", () => {
    const stateMachine = createSceneGateStateMachine();
    const inactiveState = stateMachine.inactive();

    expect(inactiveState).toEqual({ kind: "inactive" });
    expect(
      stateMachine.applyScrollDelta({
        state: inactiveState,
        viewportHeight: 500,
        deltaY: 250,
      }),
    ).toBe(inactiveState);
  });

  test("starts forward entry at sceneProgress 0", () => {
    const stateMachine = createSceneGateStateMachine();

    expect(
      stateMachine.enterForward({
        gateKey: "hero",
        duration: 2,
        release: "forward-complete",
      }),
    ).toEqual({
      kind: "active",
      gateKey: "hero",
      entryDirection: "forward",
      release: "forward-complete",
      duration: 2,
      sceneProgress: 0,
    });
  });

  test("does not lock reverse entry when release policy is forward-complete", () => {
    const stateMachine = createSceneGateStateMachine();

    expect(
      stateMachine.enterReverse({
        gateKey: "hero",
        duration: 2,
        release: "forward-complete",
      }),
    ).toEqual({ kind: "inactive" });
  });

  test("starts reverse entry at sceneProgress 1 and releases backward at 0", () => {
    const stateMachine = createSceneGateStateMachine();
    const activeState = stateMachine.enterReverse({
      gateKey: "hero",
      duration: 2,
      release: "both-directions-complete",
    });

    expect(activeState).toEqual({
      kind: "active",
      gateKey: "hero",
      entryDirection: "reverse",
      release: "both-directions-complete",
      duration: 2,
      sceneProgress: 1,
    });

    const progressedState = stateMachine.applyScrollDelta({
      state: activeState,
      viewportHeight: 500,
      deltaY: -250,
    });

    expect(progressedState).toEqual({
      kind: "active",
      gateKey: "hero",
      entryDirection: "reverse",
      release: "both-directions-complete",
      duration: 2,
      sceneProgress: 0.75,
    });

    expect(
      stateMachine.applyScrollDelta({
        state: progressedState,
        viewportHeight: 500,
        deltaY: -800,
      }),
    ).toEqual({
      kind: "released",
      gateKey: "hero",
      entryDirection: "reverse",
      release: "both-directions-complete",
      releaseDirection: "backward",
      sceneProgress: 0,
    });
  });

  test("does not apply forward progress from positive delta during reverse active state", () => {
    const stateMachine = createSceneGateStateMachine();
    const activeState = stateMachine.enterReverse({
      gateKey: "hero",
      duration: 2,
      release: "both-directions-complete",
    });

    expect(activeState.kind).toBe("active");
    expect(
      stateMachine.applyScrollDelta({
        state: activeState,
        viewportHeight: 500,
        deltaY: 125,
      }),
    ).toBe(activeState);
  });

  test("advances forward progress from positive delta using duration and viewport height", () => {
    const stateMachine = createSceneGateStateMachine();
    const activeState = stateMachine.enterForward({
      gateKey: "hero",
      duration: 2,
      release: "forward-complete",
    });

    expect(
      stateMachine.applyScrollDelta({
        state: activeState,
        viewportHeight: 500,
        deltaY: 250,
      }),
    ).toEqual({
      kind: "active",
      gateKey: "hero",
      entryDirection: "forward",
      release: "forward-complete",
      duration: 2,
      sceneProgress: 0.25,
    });
  });

  test("does not apply reverse progress from negative delta during forward active state", () => {
    const stateMachine = createSceneGateStateMachine();
    const activeState = stateMachine.enterForward({
      gateKey: "hero",
      duration: 2,
      release: "forward-complete",
    });
    const progressedState = stateMachine.applyScrollDelta({
      state: activeState,
      viewportHeight: 500,
      deltaY: 250,
    });

    expect(progressedState.kind).toBe("active");
    expect(
      stateMachine.applyScrollDelta({
        state: progressedState,
        viewportHeight: 500,
        deltaY: -125,
      }),
    ).toBe(progressedState);
  });

  test("clamps forward progress to 1 and returns a release state when complete", () => {
    const stateMachine = createSceneGateStateMachine();
    const activeState = stateMachine.enterForward({
      gateKey: "hero",
      duration: 1,
      release: "forward-complete",
    });

    expect(
      stateMachine.applyScrollDelta({
        state: activeState,
        viewportHeight: 400,
        deltaY: 600,
      }),
    ).toEqual({
      kind: "released",
      gateKey: "hero",
      entryDirection: "forward",
      release: "forward-complete",
      releaseDirection: "forward",
      sceneProgress: 1,
    });
  });
});
