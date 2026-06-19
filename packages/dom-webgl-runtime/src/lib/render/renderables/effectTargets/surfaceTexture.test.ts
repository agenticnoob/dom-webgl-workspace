import { describe, expect, test, vi } from "vitest";

import { createSurfaceTextureController } from "./surfaceTexture";

describe("createSurfaceTextureController", () => {
  test("sizes the backing canvas from layout and capped DPR", () => {
    const canvas = createCanvas();
    const controller = createSurfaceTextureController(canvas);

    const texture = controller.update({
      material: { color: 0x111827, opacity: 0.8, radius: 12 },
      layout: { width: 200, height: 100, devicePixelRatio: 3 },
    });

    expect(canvas.width).toBe(300);
    expect(canvas.height).toBe(150);
    expect(texture.version).toBeGreaterThan(0);
  });

  test("returns the same texture for unchanged input", () => {
    const canvas = createCanvas();
    const controller = createSurfaceTextureController(canvas);
    const input = {
      material: { color: 0x111827, opacity: 0.8, radius: 12 },
      layout: { width: 200, height: 100, devicePixelRatio: 1 },
    };

    const first = controller.update(input);
    const second = controller.update(input);

    expect(second).toBe(first);
  });
});

function createCanvas(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  const context = {
    beginPath: vi.fn(),
    clearRect: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    lineTo: vi.fn(),
    moveTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
  } as unknown as CanvasRenderingContext2D;

  Object.defineProperty(canvas, "getContext", {
    value: vi.fn(() => context),
  });

  return canvas;
}
