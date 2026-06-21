import {
  readDOMStyleSnapshot,
  type DOMStyleSnapshot,
} from "../../dom/styleSnapshot";
import type { WebGLTextGlyph } from "../../effects/effectAuthoring";

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
  lineHeight: number;
  letterSpacing: number;
  wordSpacing: number;
  whiteSpace: DOMStyleSnapshot["text"]["whiteSpace"];
  blockAlignment: TextBlockAlignment;
  textAlign: CanvasTextAlign;
  paddingTop: number;
  paddingRight: number;
  paddingBottom: number;
  paddingLeft: number;
  style: DOMStyleSnapshot;
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
    lineHeight: style.text.lineHeight,
    letterSpacing: style.text.letterSpacing,
    wordSpacing: style.text.wordSpacing,
    whiteSpace: style.text.whiteSpace,
    blockAlignment: style.text.blockAlignment,
    textAlign: style.text.textAlign,
    paddingTop: style.text.paddingTop,
    paddingRight: style.text.paddingRight,
    paddingBottom: style.text.paddingBottom,
    paddingLeft: style.text.paddingLeft,
    style,
  };
}

export function drawTextSnapshotToCanvas(
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
  textContent: string,
  state: TextCanvasRenderState,
): void {
  const dpr = Math.min(Math.max(1, state.devicePixelRatio), 1.5);

  canvas.width = Math.max(1, Math.ceil(state.width * dpr));
  canvas.height = Math.max(1, Math.ceil(state.height * dpr));
  context.setTransform?.(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.scale?.(dpr, dpr);
  drawTextToCanvas(context, textContent, state);
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
  context.fillStyle = "#000000";
  context.font = state.font;
  context.textAlign = state.textAlign;
  context.textBaseline = "top";

  const maxLineWidth = Math.max(
    1,
    state.width - state.paddingLeft - state.paddingRight,
  );
  const lines = wrapCanvasText(context, textContent, state, maxLineWidth);
  const x = readTextX(state);
  let y = readTextStartY(state, lines.length);
  const maxY = Math.max(state.paddingTop, state.height - state.paddingBottom);

  for (const line of lines) {
    if (y > maxY) {
      break;
    }

    drawTextLine(context, line, x, y, state);
    y += state.lineHeight;
  }
}

export function computeTextGlyphLayout(
  context: Pick<CanvasRenderingContext2D, "font" | "measureText">,
  textContent: string,
  state: TextCanvasRenderState,
): WebGLTextGlyph[] {
  context.font = state.font;

  const maxLineWidth = Math.max(
    1,
    state.width - state.paddingLeft - state.paddingRight,
  );
  const lines = wrapCanvasText(
    context as CanvasRenderingContext2D,
    textContent,
    state,
    maxLineWidth,
  );
  const x = readTextX(state);
  let y = readTextStartY(state, lines.length);
  let index = 0;
  const glyphs: WebGLTextGlyph[] = [];

  lines.forEach((line, lineIndex) => {
    let cursorX = readTextLineStartX(
      context as CanvasRenderingContext2D,
      line,
      x,
      state,
    );

    for (const char of Array.from(line)) {
      const width = context.measureText(char).width;

      glyphs.push({
        index,
        char,
        line: lineIndex,
        x: cursorX,
        y,
        width,
        height: state.lineHeight,
        baseline: y + state.lineHeight,
      });
      index += 1;
      cursorX += width + readTextSpacing(char, state);
    }

    y += state.lineHeight;
  });

  return glyphs;
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
  state: TextCanvasRenderState,
  maxLineWidth: number,
): string[] {
  if (state.whiteSpace === "pre" || state.whiteSpace === "nowrap") {
    return normalizeTextParagraphs(textContent, state.whiteSpace);
  }

  const lines: string[] = [];

  for (const paragraph of normalizeTextParagraphs(textContent, state.whiteSpace)) {
    const tokens = tokenizeTextForWrapping(paragraph);
    let line = "";

    for (const token of tokens) {
      if (token === " " && !line) {
        continue;
      }

      const nextLine = line ? `${line}${token}` : token;

      if (line && measureTextLine(context, nextLine, state) > maxLineWidth) {
        lines.push(line.trimEnd());
        line = token === " " ? "" : token;

        if (measureTextLine(context, line, state) > maxLineWidth) {
          const broken = breakLongToken(context, line, state, maxLineWidth);
          lines.push(...broken.completed);
          line = broken.remainder;
        }
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

function normalizeTextParagraphs(
  textContent: string,
  whiteSpace: TextCanvasRenderState["whiteSpace"],
): string[] {
  if (whiteSpace === "pre" || whiteSpace === "pre-wrap") {
    return textContent.split(/\r?\n/);
  }

  const collapsed = textContent.replace(/[ \t\f\v]+/g, " ").trim();

  if (whiteSpace === "pre-line") {
    return collapsed.split(/\r?\n/);
  }

  return [collapsed.replace(/\r?\n/g, " ")];
}

function tokenizeTextForWrapping(paragraph: string): string[] {
  return (
    paragraph.match(
      /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]|[^\s\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]+|\s+/gu,
    ) ?? []
  );
}

function breakLongToken(
  context: CanvasRenderingContext2D,
  token: string,
  state: TextCanvasRenderState,
  maxLineWidth: number,
): { completed: string[]; remainder: string } {
  const completed: string[] = [];
  let line = "";

  for (const part of Array.from(token)) {
    const nextLine = `${line}${part}`;

    if (line && measureTextLine(context, nextLine, state) > maxLineWidth) {
      completed.push(line);
      line = part;
    } else {
      line = nextLine;
    }
  }

  return { completed, remainder: line };
}

function drawTextLine(
  context: CanvasRenderingContext2D,
  line: string,
  x: number,
  y: number,
  state: TextCanvasRenderState,
): void {
  if (state.letterSpacing === 0 && state.wordSpacing === 0) {
    context.fillText(line, x, y);
    return;
  }

  let cursorX = readTextLineStartX(context, line, x, state);

  for (const part of Array.from(line)) {
    context.fillText(part, cursorX, y);
    cursorX += context.measureText(part).width + readTextSpacing(part, state);
  }
}

function readTextLineStartX(
  context: CanvasRenderingContext2D,
  line: string,
  x: number,
  state: TextCanvasRenderState,
): number {
  if (state.textAlign === "center") {
    return x - measureTextLine(context, line, state) / 2;
  }

  if (state.textAlign === "right" || state.textAlign === "end") {
    return x - measureTextLine(context, line, state);
  }

  return x;
}

function measureTextLine(
  context: CanvasRenderingContext2D,
  line: string,
  state: TextCanvasRenderState,
): number {
  const characters = Array.from(line);
  const baseWidth = context.measureText(line).width;
  const letterSpacing = Math.max(0, characters.length - 1) * state.letterSpacing;
  const wordSpacing =
    characters.filter((character) => character === " ").length *
    state.wordSpacing;

  return baseWidth + letterSpacing + wordSpacing;
}

function readTextSpacing(
  character: string,
  state: TextCanvasRenderState,
): number {
  return state.letterSpacing + (character === " " ? state.wordSpacing : 0);
}

function parseFontSize(font: string): number {
  const match = font.match(/(\d+(?:\.\d+)?)px/);
  const parsed = Number.parseFloat(match?.[1] ?? "16");

  return Number.isFinite(parsed) ? parsed : 16;
}
