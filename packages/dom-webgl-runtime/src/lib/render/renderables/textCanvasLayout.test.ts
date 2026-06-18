import { describe, expect, test, vi } from "vitest";

import { readDOMStyleSnapshot } from "../../dom/styleSnapshot";
import {
  drawTextToCanvas,
  readTextCanvasRenderState,
} from "./textCanvasLayout";

describe("text canvas layout", () => {
  test("reads measured bounds and computed text style into a render state", () => {
    const element = document.createElement("h2");
    element.textContent = "Text snapshot target";
    Object.assign(element.style, {
      color: "rgb(29, 33, 28)",
      fontFamily: "Arial",
      fontSize: "36px",
      fontWeight: "700",
      lineHeight: "44px",
      padding: "12px 18px",
      textAlign: "center",
    });

    const style = readDOMStyleSnapshot(element);
    const state = readTextCanvasRenderState(element, element.textContent, {
      width: 240,
      height: 132,
      style,
      devicePixelRatio: 2,
    });

    expect(state).toMatchObject({
      width: 240,
      height: 132,
      lineHeight: 44,
      paddingTop: 12,
      paddingRight: 18,
      paddingBottom: 12,
      paddingLeft: 18,
      textAlign: "center",
      devicePixelRatio: 2,
    });
    expect(state.style.text).not.toHaveProperty("color");
    expect(state.style.box).not.toHaveProperty("backgroundColor");
    expect(state).not.toHaveProperty("color");
    expect(state.font).toContain("36px");
  });

  test("uses computed inline and block alignment when drawing text", () => {
    const context = createCanvasContextStub();

    drawTextToCanvas(context, "Title", {
      width: 240,
      height: 180,
      devicePixelRatio: 1,
      font: "700 36px Arial",
      lineHeight: 40,
      blockAlignment: "center",
      textAlign: "right",
      paddingTop: 20,
      paddingRight: 30,
      paddingBottom: 20,
      paddingLeft: 20,
      style: createTextStyleSnapshot(),
    });

    expect(context.font).toBe("700 36px Arial");
    expect(context.fillStyle).toBe("#000000");
    expect(context.textAlign).toBe("right");
    expect(context.fillText).toHaveBeenCalledWith("Title", 210, 70);
  });

  test("wraps text inside the computed content box", () => {
    const context = createCanvasContextStub({ characterWidth: 10 });

    drawTextToCanvas(context, "Alpha Beta Gamma", {
      width: 100,
      height: 120,
      devicePixelRatio: 1,
      font: "16px sans-serif",
      lineHeight: 20,
      blockAlignment: "start",
      textAlign: "left",
      paddingTop: 10,
      paddingRight: 10,
      paddingBottom: 10,
      paddingLeft: 10,
      style: createTextStyleSnapshot(),
    });

    expect(context.fillText).toHaveBeenCalledWith("Alpha", 10, 10);
    expect(context.fillText).toHaveBeenCalledWith("Beta", 10, 30);
    expect(context.fillText).toHaveBeenCalledWith("Gamma", 10, 50);
  });
});

function createCanvasContextStub(
  options: { characterWidth?: number } = {},
): CanvasRenderingContext2D & {
  clearRect: ReturnType<typeof vi.fn>;
  fillText: ReturnType<typeof vi.fn>;
  measureText: ReturnType<typeof vi.fn>;
  fillStyle: string;
  font: string;
  textAlign: CanvasTextAlign;
  textBaseline: CanvasTextBaseline;
} {
  const characterWidth = options.characterWidth ?? 18;

  return {
    clearRect: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn((text: string) => ({ width: text.length * characterWidth })),
    fillStyle: "",
    font: "",
    textAlign: "left",
    textBaseline: "alphabetic",
  } as unknown as CanvasRenderingContext2D & {
    clearRect: ReturnType<typeof vi.fn>;
    fillText: ReturnType<typeof vi.fn>;
    measureText: ReturnType<typeof vi.fn>;
    fillStyle: string;
    font: string;
    textAlign: CanvasTextAlign;
    textBaseline: CanvasTextBaseline;
  };
}

function createTextStyleSnapshot() {
  return readDOMStyleSnapshot(document.createElement("p"));
}
