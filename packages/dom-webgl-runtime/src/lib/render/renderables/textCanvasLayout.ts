import {
  readDOMStyleSnapshot,
  type DOMStyleSnapshot,
} from "../../dom/styleSnapshot";

export type TextCanvasMeasurement = {
  width: number;
  height: number;
};

export type TextCanvasRenderInput = TextCanvasMeasurement & {
  style?: DOMStyleSnapshot;
  devicePixelRatio?: number;
};

export type TextCanvasRenderState = {
  width: number;
  height: number;
  devicePixelRatio: number;
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
  input: TextCanvasRenderInput | undefined,
): TextCanvasRenderState {
  const style = input?.style ?? readDOMStyleSnapshot(element);
  const fontSize = parseFontSize(style.text.font);
  const fallbackWidth = Math.max(
    1,
    Math.ceil(textContent.length * fontSize * 0.6),
  );
  const fallbackHeight = Math.max(1, Math.ceil(style.text.lineHeight));
  const domRect = element.getBoundingClientRect();

  return {
    width: Math.max(
      1,
      Math.ceil(input?.width ?? domRect.width ?? element.clientWidth ?? fallbackWidth),
    ),
    height: Math.max(
      1,
      Math.ceil(
        input?.height ?? domRect.height ?? element.clientHeight ?? fallbackHeight,
      ),
    ),
    devicePixelRatio: input?.devicePixelRatio ?? 1,
    font: style.text.font,
    color: style.text.color,
    lineHeight: style.text.lineHeight,
    blockAlignment: style.text.blockAlignment,
    textAlign: style.text.textAlign,
    paddingTop: style.text.paddingTop,
    paddingRight: style.text.paddingRight,
    paddingBottom: style.text.paddingBottom,
    paddingLeft: style.text.paddingLeft,
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

function parseFontSize(font: string): number {
  const match = font.match(/(\d+(?:\.\d+)?)px/);
  const parsed = Number.parseFloat(match?.[1] ?? "16");

  return Number.isFinite(parsed) ? parsed : 16;
}
