/** One glyph in CSS pixels relative to the measured element's border box. */
export type DOMTextGlyph = {
  index: number;
  char: string;
  line: number;
  x: number;
  /** Top of the glyph's line box; per-glyph transforms pivot here. */
  y: number;
  width: number;
  /** Line height. */
  height: number;
  /** Alphabetic baseline, including CSS half-leading. */
  baseline: number;
};

export type DOMTextGlyphCommand = {
  index: number;
  char?: string;
  x?: number;
  y?: number;
  opacity?: number;
  scaleX?: number;
  scaleY?: number;
  rotation?: number;
  color?: string;
};

type TextStyle = {
  font: string;
  color: string;
  lineHeight: number;
  letterSpacing: number;
  wordSpacing: number;
  whiteSpace: "normal" | "nowrap" | "pre" | "pre-line" | "pre-wrap";
  /** CSS `word-break`; `break-word` is read as `overflowWrap: "anywhere"`. */
  wordBreak: "normal" | "break-all" | "keep-all";
  /** Whether a word wider than the line may break between characters. */
  overflowWrap: "normal" | "anywhere";
  textAlign: CanvasTextAlign;
  blockAlignment: "start" | "center" | "end";
  paddingTop: number;
  paddingRight: number;
  paddingBottom: number;
  paddingLeft: number;
};

export type DOMTextLayout = TextStyle & {
  width: number;
  height: number;
  devicePixelRatio: number;
  text: string;
  glyphs: readonly DOMTextGlyph[];
  lines: readonly { text: string; x: number; y: number; width: number }[];
};

type MeasuringContext = Pick<CanvasRenderingContext2D, "font" | "measureText">;
type DrawingContext = Pick<
  CanvasRenderingContext2D,
  | "font"
  | "fillStyle"
  | "textAlign"
  | "textBaseline"
  | "globalAlpha"
  | "save"
  | "restore"
  | "translate"
  | "rotate"
  | "scale"
  | "fillText"
>;

export type DOMTextMeasureOptions = {
  devicePixelRatio?: number;
  context?: MeasuringContext;
};

/**
 * Measures one element's text with its computed typography: wrapped lines and
 * indexed glyphs in CSS pixels. Uses a single font for the element; it does not
 * lay out rich nested HTML. Re-measure when the target `revision` changes.
 */
export function measureDOMText(
  element: HTMLElement,
  options: DOMTextMeasureOptions = {},
): DOMTextLayout {
  const context =
    options.context ??
    element.ownerDocument.createElement("canvas").getContext("2d");
  if (!context)
    throw new Error("DOM text measurement requires a 2D canvas context.");
  const text = element.textContent ?? "";
  const { style, ascent, descent } = readTextStyle(element, context, text);
  const rect = element.getBoundingClientRect();
  const width = Math.max(1, rect.width);
  const height = Math.max(1, rect.height);
  const rawDpr =
    options.devicePixelRatio ??
    element.ownerDocument.defaultView?.devicePixelRatio ??
    1;
  const devicePixelRatio = Number.isFinite(rawDpr)
    ? Math.min(2, Math.max(1, rawDpr))
    : 1;
  // CSS centres the font's content area in each line box (half-leading), so
  // the alphabetic baseline sits this far below the line-box top.
  const baselineOffset = (style.lineHeight - ascent - descent) / 2 + ascent;

  const contentWidth = Math.max(
    1,
    width - style.paddingLeft - style.paddingRight,
  );
  const texts = wrapText(context, text, style, contentWidth);
  const remainingHeight = Math.max(
    0,
    height -
      style.paddingTop -
      style.paddingBottom -
      texts.length * style.lineHeight,
  );
  let y =
    style.paddingTop +
    (style.blockAlignment === "center"
      ? remainingHeight / 2
      : style.blockAlignment === "end"
        ? remainingHeight
        : 0);
  const glyphs: DOMTextGlyph[] = [];
  const lines = texts.map((line, lineIndex) => {
    const lineWidth = measureLine(context, line, style);
    const x =
      style.textAlign === "center"
        ? style.paddingLeft + (contentWidth - lineWidth) / 2
        : style.textAlign === "right" || style.textAlign === "end"
          ? width - style.paddingRight - lineWidth
          : style.paddingLeft;
    let cursor = x;
    for (const char of Array.from(line)) {
      const glyphWidth = context.measureText(char).width;
      glyphs.push({
        index: glyphs.length,
        char,
        line: lineIndex,
        x: cursor,
        y,
        width: glyphWidth,
        height: style.lineHeight,
        baseline: y + baselineOffset,
      });
      cursor +=
        glyphWidth +
        style.letterSpacing +
        (char === " " ? style.wordSpacing : 0);
    }
    const lineLayout = { text: line, x, y, width: lineWidth };
    y += style.lineHeight;
    return lineLayout;
  });
  return { ...style, width, height, devicePixelRatio, text, glyphs, lines };
}

/** Draws in CSS pixels; the caller owns clearing, canvas size, and the DPR transform. */
export function drawDOMText(
  context: DrawingContext,
  layout: DOMTextLayout,
  commands?: readonly DOMTextGlyphCommand[],
): void {
  context.save();
  context.font = layout.font;
  context.fillStyle = layout.color;
  context.textAlign = "left";
  context.textBaseline = "alphabetic";
  const baselineOffset = readBaselineOffset(layout);

  if (!commands && layout.letterSpacing === 0 && layout.wordSpacing === 0) {
    for (const line of layout.lines) {
      if (line.y <= layout.height - layout.paddingBottom) {
        context.fillText(line.text, line.x, line.y + baselineOffset);
      }
    }
  } else {
    for (const command of commands ?? layout.glyphs) {
      const glyph = layout.glyphs[command.index];
      if (!glyph) continue;
      drawGlyph(context, glyph, command, layout.color);
    }
  }
  context.restore();
}

function drawGlyph(
  context: DrawingContext,
  glyph: DOMTextGlyph,
  command: DOMTextGlyphCommand,
  color: string,
): void {
  context.save();
  context.fillStyle = command.color ?? color;
  context.globalAlpha *= Math.min(1, Math.max(0, command.opacity ?? 1));
  context.translate(command.x ?? glyph.x, command.y ?? glyph.y);
  context.rotate(command.rotation ?? 0);
  context.scale(command.scaleX ?? 1, command.scaleY ?? 1);
  // Transforms pivot on the glyph's line-box top; the text sits on its baseline.
  context.fillText(command.char ?? glyph.char, 0, glyph.baseline - glyph.y);
  context.restore();
}

// Every line shares one font and line height, so any glyph carries the offset.
function readBaselineOffset(layout: DOMTextLayout): number {
  const glyph = layout.glyphs[0];
  return glyph ? glyph.baseline - glyph.y : layout.lineHeight;
}

// Close and open punctuation that CSS keeps off the start and end of a line.
const noLineStart = /^[、。，．：；？！）〕〉》」』】〙〗｝］”’…‥・ー々ゝゞヽヾぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ]$/u;
const noLineEnd = /[（〔〈《「『【〘〖｛［“‘]$/u;
const cjk =
  "\\p{Script=Han}\\p{Script=Hiragana}\\p{Script=Katakana}\\p{Script=Hangul}\\u3000-\\u303F\\uFF00-\\uFFEF";
const cjkChar = new RegExp(`[${cjk}]`, "gu");
const cjkRun = new RegExp(`[${cjk}]+`, "gu");
const otherRun = new RegExp(`[^\\s${cjk}]+`, "gu");
const space = /^\s+$/u;

/** Break opportunities CSS allows for this `word-break`, as unbreakable tokens. */
function tokenize(paragraph: string, wordBreak: TextStyle["wordBreak"]): string[] {
  const pattern = new RegExp(
    [
      wordBreak === "keep-all" ? cjkRun.source : cjkChar.source,
      wordBreak === "break-all" ? `[^\\s${cjk}]` : otherRun.source,
      "\\s+",
    ].join("|"),
    "gu",
  );
  const tokens: string[] = [];
  for (const token of paragraph.match(pattern) ?? []) {
    const previous = tokens.at(-1);
    if (
      previous !== undefined &&
      !space.test(previous) &&
      !space.test(token) &&
      (noLineStart.test(Array.from(token)[0] ?? "") || noLineEnd.test(previous))
    )
      tokens[tokens.length - 1] = previous + token;
    else tokens.push(token);
  }
  return tokens;
}

/**
 * Measured widths come from canvas text, CSS widths from layout units; a line
 * this much wider than the box still fits, as a `fit-content` box shows.
 */
const fitTolerance = 0.5;

function wrapText(
  context: MeasuringContext,
  text: string,
  style: TextStyle,
  width: number,
): string[] {
  const preserveWhitespace =
    style.whiteSpace === "pre" || style.whiteSpace === "pre-wrap";
  const paragraphs = preserveWhitespace
    ? text.split(/\r?\n/)
    : style.whiteSpace === "pre-line"
      ? text
          .split(/\r?\n/)
          .map((line) => line.replace(/[\t\f\v ]+/g, " ").trim())
      : [text.replace(/\s+/g, " ").trim()];
  if (style.whiteSpace === "pre" || style.whiteSpace === "nowrap")
    return paragraphs;
  const fits = (value: string) =>
    measureLine(context, value, style) <= width + fitTolerance;
  const lines: string[] = [];
  for (const paragraph of paragraphs) {
    let line = "";
    for (const token of tokenize(paragraph, style.wordBreak)) {
      if (!preserveWhitespace && !line && /^\s+$/.test(token)) continue;
      if (line && !fits(line + token)) {
        lines.push(preserveWhitespace ? line : line.trimEnd());
        line = "";
        if (!preserveWhitespace && /^\s+$/.test(token)) continue;
      }
      // A word wider than the line overflows unless CSS lets it break anywhere.
      if (style.overflowWrap === "anywhere" && !fits(token)) {
        for (const char of Array.from(token)) {
          if (line && !fits(line + char)) {
            lines.push(line);
            line = "";
          }
          line += char;
        }
      } else {
        line += token;
      }
    }
    lines.push(preserveWhitespace ? line : line.trimEnd());
  }
  return lines;
}

function measureLine(
  context: MeasuringContext,
  text: string,
  style: TextStyle,
): number {
  const characters = Array.from(text);
  // Browsers add letter spacing after every character, the last one included.
  return (
    context.measureText(text).width +
    characters.length * style.letterSpacing +
    characters.filter((char) => char === " ").length * style.wordSpacing
  );
}

function readTextStyle(
  element: HTMLElement,
  context: MeasuringContext,
  text: string,
): { style: TextStyle; ascent: number; descent: number } {
  const style = element.ownerDocument.defaultView?.getComputedStyle(element);
  const fontSize = pixels(style?.fontSize) || 16;
  const font =
    style?.font ||
    [
      style?.fontStyle,
      style?.fontVariant,
      style?.fontWeight || "400",
      style?.fontSize || "16px",
      style?.fontFamily || "sans-serif",
    ]
      .filter((value) => value && value !== "normal")
      .join(" ");
  context.font = font;
  const metrics = readFontMetrics(context, text, fontSize);
  const textAlign = style?.textAlign;
  const whiteSpace = style?.whiteSpace;
  const wordBreak = style?.wordBreak;
  const overflowWrap = style?.overflowWrap || style?.getPropertyValue("word-wrap");
  const alignment = [
    style?.alignContent,
    style?.placeContent?.split(/\s+/)[0],
  ].find((value) => value && value !== "normal" && value !== "stretch");
  const textStyle: TextStyle = {
    font,
    color: style?.color || "#000000",
    lineHeight: resolveLineHeight(style?.lineHeight, fontSize, metrics),
    letterSpacing: pixels(style?.letterSpacing),
    wordSpacing: pixels(style?.wordSpacing),
    whiteSpace:
      whiteSpace === "nowrap" ||
      whiteSpace === "pre" ||
      whiteSpace === "pre-line" ||
      whiteSpace === "pre-wrap"
        ? whiteSpace
        : "normal",
    wordBreak:
      wordBreak === "break-all" || wordBreak === "keep-all" ? wordBreak : "normal",
    overflowWrap:
      overflowWrap === "anywhere" ||
      overflowWrap === "break-word" ||
      wordBreak === "break-word"
        ? "anywhere"
        : "normal",
    textAlign:
      textAlign === "center" ||
      textAlign === "right" ||
      textAlign === "end" ||
      textAlign === "start"
        ? textAlign
        : "left",
    blockAlignment:
      alignment === "center"
        ? "center"
        : alignment === "end" ||
            alignment === "flex-end" ||
            alignment === "self-end" ||
            alignment === "last baseline"
          ? "end"
          : "start",
    paddingTop: pixels(style?.paddingTop),
    paddingRight: pixels(style?.paddingRight),
    paddingBottom: pixels(style?.paddingBottom),
    paddingLeft: pixels(style?.paddingLeft),
  };
  return { style: textStyle, ascent: metrics.ascent, descent: metrics.descent };
}

type FontMetrics = { ascent: number; descent: number; measured: boolean };

// The font bounding box is per font, not per string, and matches the content
// area browsers place inside each line box.
function readFontMetrics(
  context: MeasuringContext,
  text: string,
  fontSize: number,
): FontMetrics {
  const metrics = context.measureText(text || "M");
  const ascent = metrics.fontBoundingBoxAscent;
  const descent = metrics.fontBoundingBoxDescent;
  return Number.isFinite(ascent) &&
    Number.isFinite(descent) &&
    ascent + descent > 0
    ? { ascent, descent, measured: true }
    : { ascent: fontSize * 0.8, descent: fontSize * 0.2, measured: false };
}

function resolveLineHeight(
  value: string | undefined,
  fontSize: number,
  metrics: FontMetrics,
): number {
  const trimmed = value?.trim() ?? "";
  const number = Number.parseFloat(trimmed);
  if (Number.isFinite(number) && number > 0) {
    if (/^[\d.]+$/.test(trimmed)) return number * fontSize;
    if (trimmed.endsWith("%")) return (number / 100) * fontSize;
    return number;
  }
  // `normal` follows the font's own ascent and descent.
  return metrics.measured
    ? Math.round(metrics.ascent) + Math.round(metrics.descent)
    : Math.ceil(fontSize * 1.2);
}

function pixels(value: string | undefined): number {
  const number = Number.parseFloat(value ?? "");
  return Number.isFinite(number) ? number : 0;
}
