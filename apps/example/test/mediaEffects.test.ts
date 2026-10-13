import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  updateImageHoverRevealMask,
  readImageHoverRevealTrailOpacity,
  imageHoverRevealFragmentShader,
  type ImageHoverRevealState,
} from "../src/mediaEffects";
const layout = { width: 480, height: 280 };
const params = { radius: 60, feather: 24, restoreMs: 2000, roughness: 0.24 };
const pointer = { active: true, x: 80, y: 80 };
let context: ReturnType<typeof createFakeCanvasContext>;
beforeEach(() => {
  context = createFakeCanvasContext();
  vi.stubGlobal(
    "CanvasRenderingContext2D",
    function CanvasRenderingContext2D() {},
  );
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
    context as unknown as CanvasRenderingContext2D,
  );
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("image reveal brush and native shader", () => {
  test("accumulates a mask texture instead of a limited point window", () => {
    const state: ImageHoverRevealState = {};
    const canvas = updateImageHoverRevealMask(
      0,
      state,
      params,
      pointer,
      layout,
    );
    for (let i = 1; i <= 40; i++)
      expect(
        updateImageHoverRevealMask(
          i * 10,
          state,
          params,
          { ...pointer, x: 80 + i * 8 },
          layout,
        ),
      ).toBe(canvas);
    expect(context.fill.mock.calls.length).toBeGreaterThan(100);
    expect(state.previousPoint?.x).toBe(400);
    expect(imageHoverRevealFragmentShader).toContain("uMaskTexture");
    expect(imageHoverRevealFragmentShader).toContain("uRevealTexture");
  });
  test("the whole trail fades when the pointer leaves", () => {
    const state: ImageHoverRevealState = {};
    updateImageHoverRevealMask(0, state, params, pointer, layout);
    updateImageHoverRevealMask(
      1000,
      state,
      params,
      { ...pointer, active: false },
      layout,
    );
    expect(readImageHoverRevealTrailOpacity(1000, state, params)).toBe(0.5);
    expect(state.previousPoint).toBeUndefined();
    updateImageHoverRevealMask(
      2001,
      state,
      params,
      { ...pointer, active: false },
      layout,
    );
    expect(readImageHoverRevealTrailOpacity(2001, state, params)).toBe(0);
    expect(state.lastInteractionTime).toBeUndefined();
    expect(context.clearRect).toHaveBeenCalled();
  });
  test("a stationary pointer does not renew the trail lifetime", () => {
    const state: ImageHoverRevealState = {};
    updateImageHoverRevealMask(0, state, params, pointer, layout);
    const stamps = context.fill.mock.calls.length;
    updateImageHoverRevealMask(1000, state, params, pointer, layout);
    expect(context.fill).toHaveBeenCalledTimes(stamps);
    expect(state.lastInteractionTime).toBe(0);
    expect(readImageHoverRevealTrailOpacity(1000, state, params)).toBe(0.5);
  });
  test("new strokes bake previously faded opacity before appending", () => {
    const state: ImageHoverRevealState = {};
    updateImageHoverRevealMask(0, state, params, pointer, layout);
    updateImageHoverRevealMask(
      1000,
      state,
      params,
      { ...pointer, x: 180 },
      layout,
    );
    expect(context.operations).toContain("composite:destination-in");
    expect(context.alphaValues).toContain(0.5);
    expect(readImageHoverRevealTrailOpacity(1000, state, params)).toBe(1);
  });
  test("irregular polygon stamps interpolate fast movement without radial circles", () => {
    const state: ImageHoverRevealState = {};
    updateImageHoverRevealMask(0, state, params, pointer, layout);
    const stamps = context.fill.mock.calls.length;
    updateImageHoverRevealMask(
      10,
      state,
      params,
      { ...pointer, x: 400 },
      layout,
    );
    expect(context.fill.mock.calls.length).toBeGreaterThan(stamps + 20);
    expect(context.lineTo).toHaveBeenCalled();
    expect(context.createRadialGradient).not.toHaveBeenCalled();
    expect(
      new Set(context.lineTo.mock.calls.map((call) => call.join(","))).size,
    ).toBeGreaterThan(100);
  });
  test("resize resets only that instance's brush history", () => {
    const first: ImageHoverRevealState = {};
    const second: ImageHoverRevealState = {};
    const initial = updateImageHoverRevealMask(
      0,
      first,
      params,
      pointer,
      layout,
    );
    const other = updateImageHoverRevealMask(
      0,
      second,
      params,
      pointer,
      layout,
    );
    const resized = updateImageHoverRevealMask(
      1,
      first,
      params,
      { ...pointer, active: false },
      { width: 200, height: 100 },
    );
    expect(resized).not.toBe(initial);
    expect(resized.width).toBe(200);
    expect(first.previousPoint).toBeUndefined();
    expect(second.maskCanvas).toBe(other);
    expect(second.previousPoint).toEqual({ x: 80, y: 80 });
  });
});

function createFakeCanvasContext() {
  const operations: string[] = [];
  const alphaValues: number[] = [];
  const context = {
    operations,
    alphaValues,
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    createRadialGradient: vi.fn(() => ({
      addColorStop: vi.fn(),
    })),
    set globalCompositeOperation(value: string) {
      operations.push(`composite:${value}`);
    },
    get globalCompositeOperation() {
      return "source-over";
    },
    set globalAlpha(value: number) {
      alphaValues.push(value);
    },
    get globalAlpha() {
      return 1;
    },
    set fillStyle(_value: unknown) {
      return;
    },
    get fillStyle() {
      return "#fff";
    },
  };

  return context;
}
