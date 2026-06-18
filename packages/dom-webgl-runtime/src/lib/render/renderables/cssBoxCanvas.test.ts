import { describe, expect, test, vi } from "vitest";

import type { DOMStyleSnapshot } from "../../dom/styleSnapshot";
import { drawCSSBoxToCanvas } from "./cssBoxCanvas";

describe("drawCSSBoxToCanvas", () => {
  test("draws supported CSS box paint at DPR-scaled canvas size", () => {
    const canvas = document.createElement("canvas");
    const context = createCanvasContextStub();

    drawCSSBoxToCanvas(canvas, context, {
      width: 120,
      height: 80,
      devicePixelRatio: 2,
      style: createStyleSnapshot({
        backgroundColor: "rgb(240, 248, 255)",
        borderTopWidth: 2,
        borderRightWidth: 2,
        borderBottomWidth: 2,
        borderLeftWidth: 2,
        borderTopLeftRadius: 12,
        borderTopRightRadius: 12,
        borderBottomRightRadius: 8,
        borderBottomLeftRadius: 8,
        boxShadow: "0px 8px 16px rgba(0, 0, 0, 0.2)",
      }),
    });

    expect(canvas.width).toBe(180);
    expect(canvas.height).toBe(120);
    expect(context.scale).toHaveBeenCalledWith(1.5, 1.5);
    expect(context.fillStyle).toBe("rgb(240, 248, 255)");
    expect(context.fill).toHaveBeenCalled();
    expect(context.stroke).toHaveBeenCalled();
    expect(context.moveTo).toHaveBeenCalledWith(0, 1);
    expect(context.lineTo).toHaveBeenCalledWith(120, 1);
  });
});

function createCanvasContextStub() {
  return {
    setTransform: vi.fn(),
    clearRect: vi.fn(),
    scale: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 0,
    shadowBlur: 0,
    shadowColor: "",
    shadowOffsetX: 0,
    shadowOffsetY: 0,
  } as unknown as CanvasRenderingContext2D & {
    scale: ReturnType<typeof vi.fn>;
    fill: ReturnType<typeof vi.fn>;
    moveTo: ReturnType<typeof vi.fn>;
    lineTo: ReturnType<typeof vi.fn>;
    stroke: ReturnType<typeof vi.fn>;
  };
}

function createStyleSnapshot(
  overrides: Partial<DOMStyleSnapshot["box"]>,
): DOMStyleSnapshot {
  return {
    box: {
      opacity: 1,
      visibility: "visible",
      display: "block",
      backgroundColor: "rgba(0, 0, 0, 0)",
      borderTopWidth: 0,
      borderRightWidth: 0,
      borderBottomWidth: 0,
      borderLeftWidth: 0,
      borderTopColor: "rgba(0, 0, 0, 0)",
      borderRightColor: "rgba(0, 0, 0, 0)",
      borderBottomColor: "rgba(0, 0, 0, 0)",
      borderLeftColor: "rgba(0, 0, 0, 0)",
      borderTopLeftRadius: 0,
      borderTopRightRadius: 0,
      borderBottomRightRadius: 0,
      borderBottomLeftRadius: 0,
      paddingTop: 0,
      paddingRight: 0,
      paddingBottom: 0,
      paddingLeft: 0,
      boxShadow: "none",
      overflow: "visible",
      transform: "none",
      transformOrigin: "50% 50%",
      ...overrides,
    },
    text: {
      font: "16px sans-serif",
      color: "#000000",
      lineHeight: 20,
      blockAlignment: "start",
      textAlign: "left",
      paddingTop: 0,
      paddingRight: 0,
      paddingBottom: 0,
      paddingLeft: 0,
    },
    media: {
      objectFit: "fill",
      objectPosition: "50% 50%",
    },
    rasterSignature: JSON.stringify(overrides),
  };
}
