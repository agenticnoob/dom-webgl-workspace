import { describe, expect, test, vi } from "vitest";

import { createEffectContext } from "./effectContext";
import { exampleManagedTimelineCardEffect } from "../src/managedTimelineCardEffect";

const params = {
  kind: "example.managedTimelineCard",
  progressKey: "example.managedTimeline",
} as const;

describe("managed timeline card effect", () => {
  test("draws and animates a timeline-driven WebGL target surface", () => {
    const fixture = createManagedTimelineCardContext({ progress: 0.64 });
    const state = exampleManagedTimelineCardEffect.setup?.(fixture.context, params);

    exampleManagedTimelineCardEffect.update(fixture.context, state, params);

    expect(exampleManagedTimelineCardEffect.source).toBe("dom/element");
    expect(fixture.runtimeProgressGet).toHaveBeenCalledWith("example.managedTimeline");
    expect(fixture.surfaceDraw).toHaveBeenCalledTimes(1);
    expect(fixture.surfaceSetVisible).toHaveBeenCalledWith(true);
    expect(fixture.surfaceSetOpacity).toHaveBeenCalledWith(expect.any(Number));
    expect(fixture.target.setVisible).toHaveBeenCalledWith(true);
    expect(fixture.target.setRotation).toHaveBeenCalledWith(0, expect.any(Number), 0);
    expect(fixture.target.setRotation.mock.calls[0]?.[1]).toBeGreaterThan(0.12);
    expect(fixture.target.setScale).not.toHaveBeenCalled();
    expect(fixture.target.setOpacity).toHaveBeenCalledWith(expect.any(Number));
  });

  test("tilts without overriding the runtime-projected layout size", () => {
    const early = createManagedTimelineCardContext({ progress: 0.28 });
    const middle = createManagedTimelineCardContext({ progress: 0.64 });

    exampleManagedTimelineCardEffect.update(early.context, undefined, params);
    exampleManagedTimelineCardEffect.update(middle.context, undefined, params);

    const earlyRotationY = early.target.setRotation.mock.calls[0]?.[1];
    const middleRotationY = middle.target.setRotation.mock.calls[0]?.[1];

    expect(earlyRotationY).toBeLessThan(-0.18);
    expect(middleRotationY).toBeGreaterThan(0.12);
    expect(early.target.setScale).not.toHaveBeenCalled();
    expect(middle.target.setScale).not.toHaveBeenCalled();
    expect(early.surfaceDraw).toHaveBeenCalledTimes(1);
    expect(middle.surfaceDraw).toHaveBeenCalledTimes(1);
  });

  test("hides the WebGL target surface while its timeline presence is zero", () => {
    const fixture = createManagedTimelineCardContext({ progress: 0.04 });

    exampleManagedTimelineCardEffect.update(fixture.context, undefined, params);

    expect(fixture.target.setVisible).toHaveBeenCalledWith(false);
    expect(fixture.target.setOpacity).toHaveBeenCalledWith(0);
    expect(fixture.surfaceSetVisible).toHaveBeenCalledWith(false);
    expect(fixture.surfaceSetOpacity).toHaveBeenCalledWith(0);
  });

  test("falls back to target scroll progress when the managed timeline signal is not available", () => {
    const fixture = createManagedTimelineCardContext({
      progress: 0,
      scrollProgress: 0.64,
    });

    exampleManagedTimelineCardEffect.update(fixture.context, undefined, params);

    expect(fixture.target.setVisible).toHaveBeenCalledWith(true);
    expect(fixture.surfaceDraw).toHaveBeenCalledTimes(1);
  });
});

function createManagedTimelineCardContext(options: {
  readonly progress: number;
  readonly scrollProgress?: number;
}) {
  const runtimeProgressGet = vi.fn((key: string) =>
    key === "example.managedTimeline" ? options.progress : 0,
  );
  const surfaceDraw = vi.fn();
  const surfaceSetVisible = vi.fn();
  const surfaceSetOpacity = vi.fn();
  const target = {
    setVisible: vi.fn(),
    setPosition: vi.fn(),
    setRotation: vi.fn(),
    setScale: vi.fn(),
    setOpacity: vi.fn(),
  };
  const context = createEffectContext({
    source: {
      kind: "dom",
      type: "element",
      element: document.createElement("article"),
      surface: {
        draw: surfaceDraw,
        setVisible: surfaceSetVisible,
        setOpacity: surfaceSetOpacity,
      },
    },
    target,
    layout: { width: 360, height: 136 },
    scrollProgress: options.scrollProgress ?? 0,
    progress: { get: runtimeProgressGet },
    runtime: { progress: { get: runtimeProgressGet } },
  });

  return {
    context,
    runtimeProgressGet,
    surfaceDraw,
    surfaceSetOpacity,
    surfaceSetVisible,
    target,
  };
}
