import { afterEach, describe, expect, test, vi } from "vitest";

import { drawDOMText, measureDOMText } from "../src/lib/domTextLayout";

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

function createContext() {
  return {
    font: "",
    fillStyle: "",
    textAlign: "left",
    textBaseline: "top",
    globalAlpha: 1,
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    scale: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn((text: string): TextMetrics => ({
      width: Array.from(text).length * 10,
      actualBoundingBoxAscent: 10,
      actualBoundingBoxDescent: 2,
      actualBoundingBoxLeft: 0,
      actualBoundingBoxRight: text.length * 10,
      alphabeticBaseline: 0,
      emHeightAscent: 10,
      emHeightDescent: 2,
      fontBoundingBoxAscent: 10,
      fontBoundingBoxDescent: 2,
      hangingBaseline: 10,
      ideographicBaseline: -2,
    })),
  } satisfies Parameters<typeof drawDOMText>[0] &
    NonNullable<Parameters<typeof measureDOMText>[1]>["context"];
}

function createText(text: string, width = 100, height = 120) {
  const element = document.createElement("h2");
  element.textContent = text;
  Object.assign(element.style, {
    fontSize: "16px",
    lineHeight: "20px",
    fontFamily: "Arial",
  });
  document.body.append(element);
  vi.spyOn(element, "getBoundingClientRect").mockReturnValue(
    new DOMRect(0, 0, width, height),
  );
  return element;
}

describe("DOM text layout", () => {
  test("retains computed typography, color, spacing, padding, and CSS dimensions", () => {
    const element = createText("Text snapshot target", 240, 132);
    Object.assign(element.style, {
      color: "rgb(29, 33, 28)",
      fontSize: "36px",
      fontWeight: "700",
      fontStyle: "italic",
      lineHeight: "44px",
      padding: "12px 18px",
      letterSpacing: "1px",
      textAlign: "center",
      whiteSpace: "pre-wrap",
      wordSpacing: "4px",
    });
    const layout = measureDOMText(element, {
      context: createContext(),
      devicePixelRatio: 2,
    });
    expect(layout).toMatchObject({
      width: 240,
      height: 132,
      devicePixelRatio: 2,
      color: "rgb(29, 33, 28)",
      lineHeight: 44,
      paddingTop: 12,
      paddingRight: 18,
      paddingBottom: 12,
      paddingLeft: 18,
      letterSpacing: 1,
      textAlign: "center",
      whiteSpace: "pre-wrap",
      wordSpacing: 4,
    });
    expect(layout.font).toBe(getComputedStyle(element).font);
    expect(layout.font).toContain("italic");
    expect(layout.font).toContain("700");
    expect(layout.font).toContain("36px");
    expect(layout.font).toContain("Arial");
  });

  test("wraps Latin words inside padding and draws at the measured positions", () => {
    const context = createContext();
    const element = createText("Alpha Beta Gamma");
    element.style.padding = "10px";
    const layout = measureDOMText(element, { context });
    drawDOMText(context, layout);
    expect(layout.lines.map((line) => line.text)).toEqual([
      "Alpha",
      "Beta",
      "Gamma",
    ]);
    expect(context.fillText.mock.calls).toEqual([
      ["Alpha", 10, 10],
      ["Beta", 10, 30],
      ["Gamma", 10, 50],
    ]);
  });

  test("wraps CJK without whitespace and preserves stable glyph indices", () => {
    const layout = measureDOMText(createText("中文测试", 20, 80), {
      context: createContext(),
    });
    expect(layout.lines.map((line) => line.text)).toEqual(["中文", "测试"]);
    expect(layout.glyphs[2]).toEqual({
      index: 2,
      char: "测",
      line: 1,
      x: 0,
      y: 20,
      width: 10,
      height: 20,
      baseline: 40,
    });
  });

  test("applies letter and word spacing to wrapping and per-glyph positions", () => {
    const context = createContext();
    const element = createText("A B");
    element.style.letterSpacing = "1px";
    element.style.wordSpacing = "3px";
    const layout = measureDOMText(element, { context });
    expect(layout.lines[0]?.width).toBe(35);
    expect(layout.glyphs.map((glyph) => glyph.x)).toEqual([0, 11, 25]);
    drawDOMText(context, layout);
    expect(context.translate.mock.calls).toEqual([
      [0, 0],
      [11, 0],
      [25, 0],
    ]);
  });

  test("matches inline and block alignment without shifting each spaced glyph twice", () => {
    const context = createContext();
    const element = createText("Title", 240, 180);
    Object.assign(element.style, {
      textAlign: "right",
      alignContent: "center",
      padding: "20px 30px 20px 20px",
      lineHeight: "40px",
    });
    const layout = measureDOMText(element, { context });
    expect(layout.lines[0]).toEqual({
      text: "Title",
      x: 160,
      y: 70,
      width: 50,
    });
    drawDOMText(context, layout);
    expect(context.fillText).toHaveBeenCalledWith("Title", 160, 70);
    expect(context.textAlign).toBe("left");
  });

  test("retains blank lines and spaces for pre-wrap and respects nowrap", () => {
    const context = createContext();
    const element = createText("A\n\n B", 100, 100);
    element.style.whiteSpace = "pre-wrap";
    const layout = measureDOMText(element, { context });
    expect(layout.lines.map((line) => line.text)).toEqual(["A", "", " B"]);
    expect(layout.glyphs.at(-1)).toMatchObject({
      char: "B",
      line: 2,
      x: 10,
      y: 40,
    });
    element.textContent = "Alpha Beta";
    element.style.whiteSpace = "nowrap";
    expect(measureDOMText(element, { context }).lines).toHaveLength(1);
  });

  test("breaks a long first token and caps finite DPR while preserving fractional CSS size", () => {
    const context = createContext();
    const element = createText("ABCDEF", 20.5, 80.25);
    const layout = measureDOMText(element, { context, devicePixelRatio: 3 });
    expect(layout.lines.map((line) => line.text)).toEqual(["AB", "CD", "EF"]);
    expect(layout).toMatchObject({
      width: 20.5,
      height: 80.25,
      devicePixelRatio: 2,
    });
    expect(
      measureDOMText(element, { context, devicePixelRatio: Number.NaN })
        .devicePixelRatio,
    ).toBe(1);
  });

  test("supports glyph substitution, displacement, opacity, rotation, and scale directly on canvas", () => {
    const context = createContext();
    const layout = measureDOMText(createText("AB"), { context });
    drawDOMText(context, layout, [
      {
        index: 1,
        char: "X",
        x: 30,
        y: 40,
        opacity: 0.5,
        rotation: 0.2,
        scaleX: 1.5,
        scaleY: 0.8,
        color: "red",
      },
    ]);
    expect(context.translate).toHaveBeenCalledWith(30, 40);
    expect(context.rotate).toHaveBeenCalledWith(0.2);
    expect(context.scale).toHaveBeenCalledWith(1.5, 0.8);
    expect(context.fillText).toHaveBeenCalledWith("X", 0, 0);
    expect(context.globalAlpha).toBe(0.5);
    expect(context.fillStyle).toBe("red");
    expect(layout.glyphs[1]).toMatchObject({ char: "B", x: 10, y: 0 });
  });
});
