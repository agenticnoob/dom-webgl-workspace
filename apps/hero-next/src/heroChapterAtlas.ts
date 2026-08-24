import type { HeroViewport } from "./heroHoldTransition";
import {
  heroChapterFaces,
  heroChapterOneContent,
} from "./heroChapterContent";
import {
  resolveHeroChapterAtlasResolution,
  resolveHeroChapterLayout,
  type HeroChapterLayout,
} from "./heroChapterLayout";

export type HeroChapterAtlas = {
  readonly canvas: HTMLCanvasElement;
  readonly tileWidth: number;
  readonly tileHeight: number;
  readonly layoutWidth: number;
  readonly layoutHeight: number;
};

export function createHeroChapterAtlas(
  viewport: HeroViewport,
): HeroChapterAtlas {
  const layout = resolveHeroChapterLayout(viewport);
  const { tileWidth, tileHeight } =
    resolveHeroChapterAtlasResolution(viewport);
  const canvas = document.createElement("canvas");
  canvas.width = tileWidth * 2;
  canvas.height = tileHeight * 2;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Hero chapter atlas requires a 2D canvas context.");
  }

  context.textBaseline = "alphabetic";
  for (const [index, chapter] of heroChapterFaces.entries()) {
    context.save();
    context.translate(
      (index % 2) * tileWidth,
      Math.floor(index / 2) * tileHeight,
    );
    context.scale(
      tileWidth / layout.viewport.width,
      tileHeight / layout.viewport.height,
    );
    drawTile(
      context,
      layout,
      chapter.number,
      chapter.label,
      index === 0,
    );
    context.restore();
  }

  return {
    canvas,
    tileWidth,
    tileHeight,
    layoutWidth: layout.viewport.width,
    layoutHeight: layout.viewport.height,
  };
}

export function heroChapterAtlasMatchesViewport(
  atlas: HeroChapterAtlas,
  viewport: HeroViewport,
): boolean {
  const layout = resolveHeroChapterLayout(viewport);
  const resolution = resolveHeroChapterAtlasResolution(viewport);
  return (
    atlas.layoutWidth === layout.viewport.width &&
    atlas.layoutHeight === layout.viewport.height &&
    atlas.tileWidth === resolution.tileWidth &&
    atlas.tileHeight === resolution.tileHeight
  );
}

function drawTile(
  context: CanvasRenderingContext2D,
  layout: HeroChapterLayout,
  number: string,
  label: string,
  chapterOne: boolean,
): void {
  const { width, height } = layout.viewport;

  context.fillStyle = "black";
  context.fillRect(0, 0, width, height);
  context.fillStyle = "white";
  setTextStyle(
    context,
    600,
    layout.smallFontSize,
    layout.headerLetterSpacing,
  );
  fillTextInLineBox(
    context,
    `PROTOTYPE / ${number}`,
    layout.inset,
    layout.inset,
    layout.smallLineHeight,
    layout.smallFontSize,
  );
  setTextStyle(
    context,
    700,
    layout.headingFontSize,
    layout.headingLetterSpacing,
  );
  const headingY =
    layout.inset + layout.smallLineHeight + layout.headingMarginTop;
  const headingLines = label.split(/\s+/);
  for (const [index, text] of headingLines.entries()) {
    fillTextInLineBox(
      context,
      text,
      layout.inset,
      headingY + index * layout.headingLineHeight,
      layout.headingLineHeight,
      layout.headingFontSize,
    );
  }

  setTextStyle(
    context,
    600,
    layout.smallFontSize,
    layout.headerLetterSpacing,
  );
  const summaryY =
    headingY +
    headingLines.length * layout.headingLineHeight +
    layout.headingMarginBottom;
  const summary = chapterOne
    ? heroChapterOneContent.summary.toUpperCase()
    : `TEMPORARY FACE ${number}`;
  const summaryLines = wrapWords(context, summary, layout.summaryMaxWidth);
  for (const [index, text] of summaryLines.entries()) {
    fillTextInLineBox(
      context,
      text,
      layout.inset,
      summaryY + index * layout.smallLineHeight,
      layout.smallLineHeight,
      layout.smallFontSize,
    );
  }

  context.globalAlpha = 0.18;
  for (let index = 0; index < 2; index += 1) {
    context.fillRect(
      layout.inset +
        (layout.mobile ? 0 : index * (layout.cardWidth + layout.cardsGap)),
      layout.cardsTop +
        (layout.mobile ? index * (layout.cardHeight + layout.cardsGap) : 0),
      layout.cardWidth,
      layout.cardHeight,
    );
  }
  context.globalAlpha = 0.82;
  for (let index = 0; index < 2; index += 1) {
    context.fillRect(
      layout.inset +
        (layout.mobile ? 0 : index * (layout.cardWidth + layout.cardsGap)),
      layout.cardsTop +
        (layout.mobile ? index * (layout.cardHeight + layout.cardsGap) : 0),
      layout.cardBorderWidth,
      layout.cardHeight,
    );
  }
  if (chapterOne) {
    context.globalAlpha = 0.82;
    setTextStyle(
      context,
      600,
      layout.smallFontSize,
      layout.cardLetterSpacing,
    );
    for (const [
      index,
      [cardNumber, cardLabel],
    ] of heroChapterOneContent.cards.entries()) {
      const cardX =
        layout.inset +
        (layout.mobile
          ? 0
          : index * (layout.cardWidth + layout.cardsGap)) +
        layout.cardPadding;
      const cardY =
        layout.cardsTop +
        (layout.mobile
          ? index * (layout.cardHeight + layout.cardsGap)
          : 0) +
        layout.cardPadding;
      fillTextInLineBox(
        context,
        cardNumber,
        cardX,
        cardY,
        layout.smallLineHeight,
        layout.smallFontSize,
      );
      fillTextInLineBox(
        context,
        cardLabel.toUpperCase(),
        cardX,
        cardY + layout.smallLineHeight + layout.cardLabelGap,
        layout.smallLineHeight,
        layout.smallFontSize,
      );
    }
  }
}

function setTextStyle(
  context: CanvasRenderingContext2D,
  weight: 600 | 700,
  fontSize: number,
  letterSpacing: number,
): void {
  context.font = `${weight} ${fontSize}px Arial, Helvetica, sans-serif`;
  context.letterSpacing = `${letterSpacing}px`;
}

function fillTextInLineBox(
  context: CanvasRenderingContext2D,
  value: string,
  x: number,
  lineTop: number,
  lineHeight: number,
  fontSize: number,
): void {
  const metrics = context.measureText(value || "Hg");
  const ascent = firstFinitePositive(
    metrics.fontBoundingBoxAscent,
    metrics.actualBoundingBoxAscent,
    fontSize * 0.8,
  );
  const descent = firstFiniteNonNegative(
    metrics.fontBoundingBoxDescent,
    metrics.actualBoundingBoxDescent,
    fontSize * 0.2,
  );
  const baseline =
    lineTop + (lineHeight - ascent - descent) / 2 + ascent;
  context.fillText(value, x, baseline);
}

function wrapWords(
  context: CanvasRenderingContext2D,
  value: string,
  maxWidth: number,
): readonly string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of value.split(/\s+/)) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && context.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) {
    lines.push(line);
  }
  return lines;
}

function firstFinitePositive(...values: readonly number[]): number {
  for (const value of values) {
    if (Number.isFinite(value) && value > 0) {
      return value;
    }
  }
  return 1;
}

function firstFiniteNonNegative(...values: readonly number[]): number {
  for (const value of values) {
    if (Number.isFinite(value) && value >= 0) {
      return value;
    }
  }
  return 0;
}
