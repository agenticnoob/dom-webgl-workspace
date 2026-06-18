export type DOMBoxStyleSnapshot = {
  opacity: number;
  visibility: string;
  display: string;
  backgroundColor: string;
  borderTopWidth: number;
  borderRightWidth: number;
  borderBottomWidth: number;
  borderLeftWidth: number;
  borderTopColor: string;
  borderRightColor: string;
  borderBottomColor: string;
  borderLeftColor: string;
  borderTopLeftRadius: number;
  borderTopRightRadius: number;
  borderBottomRightRadius: number;
  borderBottomLeftRadius: number;
  boxShadow: string;
  overflow: string;
  transform: string;
  transformOrigin: string;
};

export type DOMTextStyleSnapshot = {
  font: string;
  color: string;
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
  const fontSize = readCSSPixelValue(computedStyle?.fontSize) || 16;
  const borderRadii = readBoxRadii(computedStyle);
  const box: DOMBoxStyleSnapshot = {
    opacity: readOpacity(computedStyle?.opacity),
    visibility: computedStyle?.visibility || "visible",
    display: computedStyle?.display || "block",
    backgroundColor: computedStyle?.backgroundColor || "rgba(0, 0, 0, 0)",
    borderTopWidth: readCSSPixelValue(computedStyle?.borderTopWidth),
    borderRightWidth: readCSSPixelValue(computedStyle?.borderRightWidth),
    borderBottomWidth: readCSSPixelValue(computedStyle?.borderBottomWidth),
    borderLeftWidth: readCSSPixelValue(computedStyle?.borderLeftWidth),
    borderTopColor: computedStyle?.borderTopColor || "rgba(0, 0, 0, 0)",
    borderRightColor: computedStyle?.borderRightColor || "rgba(0, 0, 0, 0)",
    borderBottomColor: computedStyle?.borderBottomColor || "rgba(0, 0, 0, 0)",
    borderLeftColor: computedStyle?.borderLeftColor || "rgba(0, 0, 0, 0)",
    borderTopLeftRadius: borderRadii.topLeft,
    borderTopRightRadius: borderRadii.topRight,
    borderBottomRightRadius: borderRadii.bottomRight,
    borderBottomLeftRadius: borderRadii.bottomLeft,
    boxShadow: computedStyle?.boxShadow || "none",
    overflow: computedStyle?.overflow || "visible",
    transform: computedStyle?.transform || "none",
    transformOrigin: computedStyle?.transformOrigin || "50% 50%",
  };
  const text: DOMTextStyleSnapshot = {
    font: readCanvasFont(computedStyle),
    color: computedStyle?.color || "#000000",
    lineHeight:
      readCSSPixelValue(computedStyle?.lineHeight) || Math.ceil(fontSize * 1.2),
    blockAlignment: readBlockAlignment(computedStyle),
    textAlign: readCanvasTextAlign(computedStyle?.textAlign),
    paddingTop: readCSSPixelValue(computedStyle?.paddingTop),
    paddingRight: readCSSPixelValue(computedStyle?.paddingRight),
    paddingBottom: readCSSPixelValue(computedStyle?.paddingBottom),
    paddingLeft: readCSSPixelValue(computedStyle?.paddingLeft),
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

function readBoxRadii(computedStyle: CSSStyleDeclaration | undefined): {
  topLeft: number;
  topRight: number;
  bottomRight: number;
  bottomLeft: number;
} {
  const explicit = {
    topLeft: readCSSPixelValue(computedStyle?.borderTopLeftRadius),
    topRight: readCSSPixelValue(computedStyle?.borderTopRightRadius),
    bottomRight: readCSSPixelValue(computedStyle?.borderBottomRightRadius),
    bottomLeft: readCSSPixelValue(computedStyle?.borderBottomLeftRadius),
  };

  if (
    explicit.topLeft ||
    explicit.topRight ||
    explicit.bottomRight ||
    explicit.bottomLeft
  ) {
    return explicit;
  }

  const values = (computedStyle?.borderRadius || "")
    .split(/\s+/)
    .filter(Boolean)
    .map(readCSSPixelValue);

  if (values.length === 0) {
    return explicit;
  }

  const [topLeft, topRight = topLeft, bottomRight = topLeft, bottomLeft = topRight] =
    values;

  return { topLeft, topRight, bottomRight, bottomLeft };
}

function readOpacity(value: string | undefined): number {
  const parsed = Number.parseFloat(value || "1");

  if (!Number.isFinite(parsed)) {
    return 1;
  }

  return Math.min(1, Math.max(0, parsed));
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
