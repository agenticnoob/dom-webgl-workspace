import { describe, expect, test, vi } from "vitest";

import {
  createSurfaceWavesState,
  drawReactBitsWavesSurface,
  type WavesSurfaceContext,
} from "./wavesSurface";

describe("ReactBits-style waves surface", () => {
  test("draws a dense point grid with Perlin wave motion", () => {
    const context = createWavesContext();
    const state = createSurfaceWavesState();

    drawReactBitsWavesSurface(context, 120, 96, {
      lineColor: "#172124",
      opacity: 0.82,
      pointerActive: false,
      pointerX: 0,
      pointerY: 0,
      time: 1000,
    }, state);

    expect(state.lines.length).toBeGreaterThan(20);
    expect(state.lines[0]?.length).toBeGreaterThan(3);
    expect(context.lineTo).toHaveBeenCalled();
    expect(context.strokeStyle).toBe("#172124");
    expect(context.globalAlpha).toBe(0.82);
  });

  test("uses ReactBits mouse velocity physics for target-local pointer movement", () => {
    const context = createWavesContext();
    const state = createSurfaceWavesState();

    drawReactBitsWavesSurface(context, 180, 120, {
      lineColor: "#172124",
      opacity: 0.82,
      pointerActive: true,
      pointerX: 42,
      pointerY: 48,
      time: 1000,
    }, state);
    const firstCursorOffset = state.lines[10]?.[2]?.cursor.x ?? 0;

    drawReactBitsWavesSurface(context, 180, 120, {
      lineColor: "#172124",
      opacity: 0.82,
      pointerActive: true,
      pointerX: 132,
      pointerY: 52,
      time: 1016,
    }, state);
    const secondCursorOffset = state.lines[10]?.[2]?.cursor.x ?? 0;

    expect(state.mouse.set).toBe(true);
    expect(state.mouse.vs).toBeGreaterThan(0);
    expect(secondCursorOffset).not.toBe(firstCursorOffset);
  });

  test("keeps the smoothed pointer close enough to feel responsive", () => {
    const context = createWavesContext();
    const state = createSurfaceWavesState();

    drawReactBitsWavesSurface(context, 180, 120, {
      lineColor: "#172124",
      opacity: 0.82,
      pointerActive: true,
      pointerX: 20,
      pointerY: 40,
      time: 1000,
    }, state);
    drawReactBitsWavesSurface(context, 180, 120, {
      lineColor: "#172124",
      opacity: 0.82,
      pointerActive: true,
      pointerX: 140,
      pointerY: 40,
      time: 1016,
    }, state);

    expect(state.mouse.sx).toBeGreaterThanOrEqual(108);
    expect(state.mouse.sx).toBeLessThanOrEqual(140);
  });

  test("keeps the ambient wave field subtle across one frame", () => {
    const context = createWavesContext();
    const state = createSurfaceWavesState();

    drawReactBitsWavesSurface(context, 180, 120, {
      lineColor: "#172124",
      opacity: 0.82,
      pointerActive: false,
      pointerX: 0,
      pointerY: 0,
      time: 1000,
    }, state);
    const firstWaveX = state.lines[8]?.[2]?.wave.x ?? 0;

    drawReactBitsWavesSurface(context, 180, 120, {
      lineColor: "#172124",
      opacity: 0.82,
      pointerActive: false,
      pointerX: 0,
      pointerY: 0,
      time: 1016,
    }, state);
    const secondWaveX = state.lines[8]?.[2]?.wave.x ?? 0;

    expect(Math.abs(secondWaveX - firstWaveX)).toBeLessThan(0.04);
  });

  test("applies hover displacement on the first active frame", () => {
    const context = createWavesContext();
    const state = createSurfaceWavesState();

    drawReactBitsWavesSurface(context, 180, 120, {
      lineColor: "#172124",
      opacity: 0.82,
      pointerActive: true,
      pointerX: 90,
      pointerY: 60,
      time: 1000,
    }, state);

    const maxCursorOffset = Math.max(
      ...state.lines.flatMap((points) =>
        points.map((point) => Math.hypot(point.cursor.x, point.cursor.y)),
      ),
    );

    expect(maxCursorOffset).toBeGreaterThan(0.5);
  });
});

function createWavesContext(): WavesSurfaceContext {
  return {
    beginPath: vi.fn(),
    clearRect: vi.fn(),
    lineTo: vi.fn(),
    moveTo: vi.fn(),
    restore: vi.fn(),
    save: vi.fn(),
    stroke: vi.fn(),
    globalAlpha: 1,
    lineWidth: 1,
    strokeStyle: "",
  };
}
