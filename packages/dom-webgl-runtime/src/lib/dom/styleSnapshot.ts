import { readFallbackStyleSnapshot } from "./fallbackVisibility";

export type DOMBoxStyleSnapshot = {
  visibility: string;
  display: string;
  borderTopWidth: number;
  borderRightWidth: number;
  borderBottomWidth: number;
  borderLeftWidth: number;
  paddingTop: number;
  paddingRight: number;
  paddingBottom: number;
  paddingLeft: number;
  overflow: string;
};

export type DOMTextStyleSnapshot = {
  font: string;
  lineHeight: number;
  blockAlignment: "start" | "center" | "end";
  textAlign: CanvasTextAlign;
  paddingTop: number;
  paddingRight: number;
  paddingBottom: number;
  paddingLeft: number;
};

export type DOMMediaStyleSnapshot = {
  objectFit: "fill" | "contain" | "cover" | "none" | "scale-down";
  objectPosition: string;
};

export type DOMStyleSnapshot = {
  box: DOMBoxStyleSnapshot;
  text: DOMTextStyleSnapshot;
  media: DOMMediaStyleSnapshot;
  rasterSignature: string;
};

export function readDOMStyleSnapshot(element: HTMLElement): DOMStyleSnapshot {
  const computedStyle =
    element.ownerDocument.defaultView?.getComputedStyle(element);
  const fallbackStyle = readFallbackStyleSnapshot(element);
  const fontSize = readCSSPixelValue(computedStyle?.fontSize) || 16;
  const paddingTop = readCSSPixelValue(computedStyle?.paddingTop);
  const paddingRight = readCSSPixelValue(computedStyle?.paddingRight);
  const paddingBottom = readCSSPixelValue(computedStyle?.paddingBottom);
  const paddingLeft = readCSSPixelValue(computedStyle?.paddingLeft);
  const box: DOMBoxStyleSnapshot = {
    visibility: fallbackStyle?.visibility || computedStyle?.visibility || "visible",
    display: computedStyle?.display || "block",
    borderTopWidth: readCSSPixelValue(computedStyle?.borderTopWidth),
    borderRightWidth: readCSSPixelValue(computedStyle?.borderRightWidth),
    borderBottomWidth: readCSSPixelValue(computedStyle?.borderBottomWidth),
    borderLeftWidth: readCSSPixelValue(computedStyle?.borderLeftWidth),
    paddingTop,
    paddingRight,
    paddingBottom,
    paddingLeft,
    overflow: computedStyle?.overflow || "visible",
  };
  const text: DOMTextStyleSnapshot = {
    font: readCanvasFont(computedStyle),
    lineHeight:
      readCSSPixelValue(computedStyle?.lineHeight) || Math.ceil(fontSize * 1.2),
    blockAlignment: readBlockAlignment(computedStyle),
    textAlign: readCanvasTextAlign(computedStyle?.textAlign),
    paddingTop,
    paddingRight,
    paddingBottom,
    paddingLeft,
  };
  const media: DOMMediaStyleSnapshot = {
    objectFit: readObjectFit(computedStyle?.objectFit),
    objectPosition: computedStyle?.objectPosition || "50% 50%",
  };

  return {
    box,
    text,
    media,
    rasterSignature: JSON.stringify({ box, text, media }),
  };
}

function readCSSPixelValue(value: string | undefined): number {
  if (!value || value === "normal") {
    return 0;
  }

  const parsed = Number.parseFloat(value);

  return Number.isFinite(parsed) ? parsed : 0;
}

function readCanvasFont(computedStyle: CSSStyleDeclaration | undefined): string {
  if (computedStyle?.font) {
    return computedStyle.font;
  }

  const fontStyle =
    computedStyle?.fontStyle && computedStyle.fontStyle !== "normal"
      ? computedStyle.fontStyle
      : "";
  const fontVariant =
    computedStyle?.fontVariant && computedStyle.fontVariant !== "normal"
      ? computedStyle.fontVariant
      : "";
  const fontWeight = computedStyle?.fontWeight || "400";
  const fontSize = computedStyle?.fontSize || "16px";
  const fontFamily = computedStyle?.fontFamily || "sans-serif";

  return [fontStyle, fontVariant, fontWeight, fontSize, fontFamily]
    .filter(Boolean)
    .join(" ");
}

function readBlockAlignment(
  computedStyle: CSSStyleDeclaration | undefined,
): DOMTextStyleSnapshot["blockAlignment"] {
  const value = firstNonDefaultCSSValue(
    computedStyle?.alignContent,
    computedStyle?.placeContent?.split(/\s+/)[0],
  );

  if (value === "center") {
    return "center";
  }

  if (
    value === "end" ||
    value === "flex-end" ||
    value === "self-end" ||
    value === "last baseline"
  ) {
    return "end";
  }

  return "start";
}

function firstNonDefaultCSSValue(
  ...values: Array<string | undefined>
): string | undefined {
  return values.find(
    (value) =>
      value !== undefined &&
      value !== "" &&
      value !== "normal" &&
      value !== "stretch",
  );
}

function readCanvasTextAlign(textAlign: string | undefined): CanvasTextAlign {
  if (
    textAlign === "center" ||
    textAlign === "right" ||
    textAlign === "start" ||
    textAlign === "end"
  ) {
    return textAlign;
  }

  return "left";
}

function readObjectFit(
  objectFit: string | undefined,
): DOMMediaStyleSnapshot["objectFit"] {
  if (
    objectFit === "contain" ||
    objectFit === "cover" ||
    objectFit === "none" ||
    objectFit === "scale-down"
  ) {
    return objectFit;
  }

  return "fill";
}
