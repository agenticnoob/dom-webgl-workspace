export type TextCanvasMeasurement = {
  width: number;
  height: number;
};

export type TextCanvasRenderState = {
  width: number;
  height: number;
  font: string;
  color: string;
  lineHeight: number;
  blockAlignment: TextBlockAlignment;
  textAlign: CanvasTextAlign;
  paddingTop: number;
  paddingRight: number;
  paddingBottom: number;
  paddingLeft: number;
};

type TextBlockAlignment = "start" | "center" | "end";

export function readTextCanvasRenderState(
  element: HTMLElement,
  textContent: string,
  measurement: TextCanvasMeasurement | undefined,
): TextCanvasRenderState {
  const view = element.ownerDocument.defaultView;
  const computedStyle = view?.getComputedStyle(element);
  const fontSize = parseCSSPixelValue(computedStyle?.fontSize) ?? 16;
  const lineHeight =
    parseCSSPixelValue(computedStyle?.lineHeight) ?? Math.ceil(fontSize * 1.2);
  const fallbackWidth = Math.max(1, Math.ceil(textContent.length * fontSize * 0.6));
  const fallbackHeight = Math.max(1, Math.ceil(lineHeight));
  const domRect = element.getBoundingClientRect();

  return {
    width: Math.max(
      1,
      Math.ceil(measurement?.width ?? domRect.width ?? element.clientWidth ?? fallbackWidth),
    ),
    height: Math.max(
      1,
      Math.ceil(
        measurement?.height ?? domRect.height ?? element.clientHeight ?? fallbackHeight,
      ),
    ),
    font: readCanvasFont(computedStyle),
    color: computedStyle?.color || "#000000",
    lineHeight,
    blockAlignment: readBlockAlignment(computedStyle),
    textAlign: readCanvasTextAlign(computedStyle?.textAlign),
    paddingTop: parseCSSPixelValue(computedStyle?.paddingTop) ?? 0,
    paddingRight: parseCSSPixelValue(computedStyle?.paddingRight) ?? 0,
    paddingBottom: parseCSSPixelValue(computedStyle?.paddingBottom) ?? 0,
    paddingLeft: parseCSSPixelValue(computedStyle?.paddingLeft) ?? 0,
  };
}

export function createTextCanvasRenderSignature(
  textContent: string,
  state: TextCanvasRenderState,
): string {
  return JSON.stringify([textContent, state]);
}

export function drawTextToCanvas(
  context: CanvasRenderingContext2D,
  textContent: string,
  state: TextCanvasRenderState,
): void {
  context.clearRect(0, 0, state.width, state.height);
  context.fillStyle = state.color;
  context.font = state.font;
  context.textAlign = state.textAlign;
  context.textBaseline = "top";

  const maxLineWidth = Math.max(
    1,
    state.width - state.paddingLeft - state.paddingRight,
  );
  const lines = wrapCanvasText(context, textContent, maxLineWidth);
  const x = readTextX(state);
  let y = readTextStartY(state, lines.length);
  const maxY = Math.max(state.paddingTop, state.height - state.paddingBottom);

  for (const line of lines) {
    if (y > maxY) {
      break;
    }

    context.fillText(line, x, y);
    y += state.lineHeight;
  }
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
): TextBlockAlignment {
  return normalizeBlockAlignment(
    firstNonDefaultCSSValue(
      computedStyle?.alignContent,
      computedStyle?.placeContent?.split(/\s+/)[0],
    ),
  );
}

function normalizeBlockAlignment(value: string | undefined): TextBlockAlignment {
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

function readTextX(state: TextCanvasRenderState): number {
  if (state.textAlign === "center") {
    return state.width / 2;
  }

  if (state.textAlign === "right" || state.textAlign === "end") {
    return state.width - state.paddingRight;
  }

  return state.paddingLeft;
}

function readTextStartY(
  state: TextCanvasRenderState,
  lineCount: number,
): number {
  const contentHeight = lineCount * state.lineHeight;
  const availableHeight = Math.max(
    0,
    state.height - state.paddingTop - state.paddingBottom,
  );
  const remainingHeight = Math.max(0, availableHeight - contentHeight);

  if (state.blockAlignment === "center") {
    return state.paddingTop + remainingHeight / 2;
  }

  if (state.blockAlignment === "end") {
    return state.paddingTop + remainingHeight;
  }

  return state.paddingTop;
}

function wrapCanvasText(
  context: CanvasRenderingContext2D,
  textContent: string,
  maxLineWidth: number,
): string[] {
  const lines: string[] = [];

  for (const paragraph of textContent.split(/\r?\n/)) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);

    if (words.length === 0) {
      lines.push("");
      continue;
    }

    let line = "";

    for (const word of words) {
      const nextLine = line ? `${line} ${word}` : word;

      if (line && context.measureText(nextLine).width > maxLineWidth) {
        lines.push(line);
        line = word;
      } else {
        line = nextLine;
      }
    }

    if (line) {
      lines.push(line);
    }
  }

  return lines;
}

function parseCSSPixelValue(value: string | undefined): number | undefined {
  if (!value || value === "normal") {
    return undefined;
  }

  const parsed = Number.parseFloat(value);

  return Number.isFinite(parsed) ? parsed : undefined;
}
