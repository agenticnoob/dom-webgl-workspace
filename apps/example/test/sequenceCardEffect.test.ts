import { describe, expect, test, vi } from "vitest";
import {
  drawSequenceCardSurface,
  readSequenceCardGlow,
  readSequenceCardMotion,
} from "../src/sequenceCardEffect";

describe("native sequence card", () => {
  test("enters from the left, rests, and exits to the right reversibly", () => {
    expect(readSequenceCardMotion(0, 280)).toEqual({
      offsetX: -280,
      presence: 0,
    });
    expect(readSequenceCardMotion(0.5, 280)).toEqual({
      offsetX: 0,
      presence: 1,
    });
    expect(readSequenceCardMotion(1, 280)).toEqual({
      offsetX: 280,
      presence: 0,
    });
    for (const [progress, offset] of [
      [0.19, -140],
      [0.81, 140],
      [0.19, -140],
    ]) {
      const motion = readSequenceCardMotion(progress, 280);
      expect(motion.offsetX).toBeCloseTo(offset);
      expect(motion.presence).toBeCloseTo(0.5);
    }
  });
  test("draws the card surface separately from its semantic text", () => {
    const ctx = createCanvasContextStub();
    const glow = readSequenceCardGlow(
      { active: false, x: 0, y: 0 },
      { width: 420, height: 164 },
      {},
    );
    drawSequenceCardSurface(ctx, 420, 164, glow);
    expect(ctx.fillText).not.toHaveBeenCalled();
    expect(ctx.strokeCount).toBe(1);
  });
  test("projects local pointer to the nearest border and adds edge glow", () => {
    const ctx = createCanvasContextStub();
    const glow = readSequenceCardGlow(
      { active: true, x: 405, y: 82 },
      { width: 420, height: 164 },
      { edgeSensitivity: 0.3, glowIntensity: 1 },
    );
    expect(glow.edgeX).toBe(420);
    expect(glow.edgeY).toBe(82);
    drawSequenceCardSurface(ctx, 420, 164, glow);
    expect(ctx.createRadialGradient).toHaveBeenCalled();
    expect(ctx.shadowBlurValues).toContain(32);
    expect(ctx.strokeCount).toBeGreaterThan(2);
  });
  test("center and outside pointers cannot light an edge", () => {
    expect(
      readSequenceCardGlow(
        { active: true, x: 210, y: 82 },
        { width: 420, height: 164 },
        {},
      ).glowOpacity,
    ).toBe(0);
    expect(
      readSequenceCardGlow(
        { active: false, x: 420, y: 82 },
        { width: 420, height: 164 },
        {},
      ).glowOpacity,
    ).toBe(0);
  });
});

function createCanvasContextStub(): CanvasRenderingContext2D & {
  readonly shadowBlurValues: number[];
  readonly strokeCount: number;
} {
  const shadowBlurValues: number[] = [];
  let strokeCount = 0;
  const context = {
    canvas: document.createElement("canvas"),
    createLinearGradient: vi.fn(() => createGradientStub()),
    createRadialGradient: vi.fn(() => createGradientStub()),
    save: vi.fn(),
    restore: vi.fn(),
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(() => {
      strokeCount += 1;
    }),
    fillText: vi.fn(),
    measureText: vi.fn((text: string) => ({ width: text.length * 8 })),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    closePath: vi.fn(),
    clip: vi.fn(),
    shadowBlurValues,
    get strokeCount() {
      return strokeCount;
    },
    set shadowBlur(value: number) {
      shadowBlurValues.push(value);
    },
    get shadowBlur() {
      return shadowBlurValues.at(-1) ?? 0;
    },
  } as unknown as Partial<CanvasRenderingContext2D> & {
    shadowBlurValues: number[];
    strokeCount: number;
  };

  return context as CanvasRenderingContext2D & {
    readonly shadowBlurValues: number[];
    readonly strokeCount: number;
  };
}

function createGradientStub(): CanvasGradient {
  return {
    addColorStop: vi.fn(),
  } as unknown as CanvasGradient;
}
