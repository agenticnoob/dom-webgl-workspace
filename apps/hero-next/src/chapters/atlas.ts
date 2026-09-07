import type { HeroViewport } from "../shared/viewport";
import {
  createProjectRoomTexture,
  drawProjectRoomEndpoint,
} from "../projects/artwork";
import { projectRoomEnabled } from "../projects/room";
import { createHeroAxiomsArtwork } from "../axioms/reader";
import { drawAxiomsFrame } from "../axioms/canvas";
import { resolveAxiomsFrame } from "../axioms/frame";
import { getHeroProfileSpeechBubbleCopy } from "../profile/speechBubble";
import { resolveHeroProfileLineShiftForExclusions } from "../profile/wrap";
import { getHeroChapterContent, type HeroChapterBodyContent } from "./content";
import {
  formatHeroChapterCounter,
  getHeroChapterDefinition,
  heroChapterOrder,
} from "./definitions";
import type { HeroLocale } from "../preferences/locale";
import {
  resolveHeroChapterAtlasResolution,
  resolveHeroChapterLayout,
  type HeroChapterLayout,
  type HeroChapterTextLayout,
} from "./layout";

export type HeroChapterAtlas = {
  readonly canvas: HTMLCanvasElement;
  readonly tileWidth: number;
  readonly tileHeight: number;
  readonly layoutWidth: number;
  readonly layoutHeight: number;
  readonly locale: HeroLocale;
  readonly projectRoom: boolean;
};

export function createHeroChapterAtlas(
  viewport: HeroViewport,
  locale: HeroLocale = "zh",
): HeroChapterAtlas {
  const normalizedViewport = resolveHeroChapterLayout(
    viewport,
    "self",
  ).viewport;
  const { tileWidth, tileHeight } = resolveHeroChapterAtlasResolution(viewport);
  const canvas = document.createElement("canvas");
  canvas.width = tileWidth * 2;
  canvas.height = tileHeight * 4;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Hero chapter atlas requires a 2D canvas context.");
  }

  context.textBaseline = "alphabetic";
  const projectRoom = projectRoomEnabled();
  for (const chapterId of heroChapterOrder) {
    const definition = getHeroChapterDefinition(chapterId);
    const layout = resolveHeroChapterLayout(viewport, chapterId);
    const content = getHeroChapterContent(chapterId, locale);
    const axioms =
      chapterId === "axioms"
        ? createHeroAxiomsArtwork(context, layout.viewport, locale)
        : undefined;
    const roomTexture =
      chapterId === "builds" && projectRoom
        ? createProjectRoomTexture(content.body)
        : undefined;
    const speechBubbleText =
      layout.kind === "profile"
        ? getHeroProfileSpeechBubbleCopy(locale).front
        : undefined;
    drawAtlasTile(
      context,
      layout,
      definition.atlas.column,
      definition.atlas.row,
      tileWidth,
      tileHeight,
      () =>
        roomTexture
          ? drawProjectRoomEndpoint(context, layout.viewport, roomTexture)
          : axioms
            ? drawAxiomsFrame(
                context,
                axioms,
                resolveAxiomsFrame(0, axioms.layout),
              )
            : drawTile(
                context,
                layout,
                formatHeroChapterCounter(definition),
                content.body,
                speechBubbleText,
              ),
    );
    drawAtlasTile(
      context,
      layout,
      definition.atlas.column,
      definition.atlas.row + 2,
      tileWidth,
      tileHeight,
      () =>
        roomTexture
          ? drawProjectRoomEndpoint(context, layout.viewport, roomTexture)
          : axioms
            ? drawAxiomsFrame(
                context,
                axioms,
                resolveAxiomsFrame(1, axioms.layout),
              )
            : drawTailTile(context, layout, content.body, speechBubbleText),
    );
  }

  return {
    canvas,
    tileWidth,
    tileHeight,
    layoutWidth: normalizedViewport.width,
    layoutHeight: normalizedViewport.height,
    locale,
    projectRoom,
  };
}

export function heroChapterAtlasMatchesViewport(
  atlas: HeroChapterAtlas,
  viewport: HeroViewport,
  locale: HeroLocale = "zh",
): boolean {
  const layout = resolveHeroChapterLayout(viewport, "self");
  const resolution = resolveHeroChapterAtlasResolution(viewport);
  return (
    atlas.layoutWidth === layout.viewport.width &&
    atlas.layoutHeight === layout.viewport.height &&
    atlas.tileWidth === resolution.tileWidth &&
    atlas.tileHeight === resolution.tileHeight &&
    atlas.locale === locale &&
    atlas.projectRoom === projectRoomEnabled()
  );
}

function drawAtlasTile(
  context: CanvasRenderingContext2D,
  layout: HeroChapterLayout,
  column: number,
  row: number,
  tileWidth: number,
  tileHeight: number,
  draw: () => void,
): void {
  context.save();
  context.beginPath();
  context.rect(column * tileWidth, row * tileHeight, tileWidth, tileHeight);
  context.clip();
  context.translate(column * tileWidth, row * tileHeight);
  context.scale(
    tileWidth / layout.viewport.width,
    tileHeight / layout.viewport.height,
  );
  draw();
  context.restore();
}

function drawTile(
  context: CanvasRenderingContext2D,
  layout: HeroChapterLayout,
  chapterCounter: string,
  content: Pick<HeroChapterBodyContent, "title" | "intro">,
  speechBubbleText?: string,
): void {
  const { width, height } = layout.viewport;

  fillTileBackground(context, width, height);
  if (layout.kind === "profile" && speechBubbleText) {
    drawProfileSpeechBubble(context, layout, speechBubbleText);
  }
  setTextStyle(context, layout.index);
  drawTextLines(
    context,
    [chapterCounter],
    layout.index,
    layout.index.top,
    layout.kind === "profile" ? { layout, side: "left" } : undefined,
  );

  setTextStyle(context, layout.heading);
  const headingLines = wrapText(
    context,
    content.title,
    layout.heading.width,
    layout.heading.balance,
  );
  drawTextLines(
    context,
    headingLines,
    layout.heading,
    layout.heading.top,
    layout.kind === "profile" ? { layout, side: "left" } : undefined,
  );

  setTextStyle(context, layout.intro);
  const introLines = wrapText(
    context,
    content.intro,
    layout.intro.width,
    layout.intro.balance,
  );
  const headingBottom =
    layout.heading.top + headingLines.length * layout.heading.lineHeight;
  const introTop =
    layout.kind === "profile"
      ? headingBottom - introLines.length * layout.intro.lineHeight
      : headingBottom + layout.introGap;
  drawTextLines(
    context,
    introLines,
    layout.intro,
    introTop,
    layout.kind === "profile" ? { layout, side: "right" } : undefined,
  );
}

function drawTailTile(
  context: CanvasRenderingContext2D,
  layout: HeroChapterLayout,
  content: HeroChapterBodyContent,
  speechBubbleText?: string,
): void {
  const { width, height } = layout.viewport;
  fillTileBackground(context, width, height);

  if (layout.kind === "profile") {
    drawProfileTail(context, layout, content, speechBubbleText);
    return;
  }

  drawStandardTail(context, layout, content);
}

function drawProfileTail(
  context: CanvasRenderingContext2D,
  layout: Extract<HeroChapterLayout, { readonly kind: "profile" }>,
  content: HeroChapterBodyContent,
  speechBubbleText?: string,
): void {
  const { width, height } = layout.viewport;
  const mobile = width <= 700;
  const fontSize = mobile
    ? clamp(width * 0.055, 20, 28.8)
    : clamp(width * 0.034, 28, 56);
  const lineHeight = fontSize * 1.12;
  const closing = content.closing ?? content.sections.at(-1)?.title;
  if (speechBubbleText) {
    drawProfileSpeechBubble(context, layout, speechBubbleText);
  }
  if (!closing) {
    return;
  }
  const closingLayout = {
    ...layout.index,
    fontSize,
    lineHeight,
    letterSpacing: fontSize * -0.035,
    fontWeight: 400,
    align: "right",
    balance: false,
  } as const satisfies HeroChapterTextLayout;
  setTextStyle(context, closingLayout);
  const lines = wrapText(context, closing, closingLayout.width);
  const bottom = height * (mobile ? 0.84 : 0.82);
  drawTextLines(
    context,
    lines,
    closingLayout,
    bottom - lines.length * lineHeight,
    { layout, side: "left" },
  );
}

function drawStandardTail(
  context: CanvasRenderingContext2D,
  layout: Extract<HeroChapterLayout, { readonly kind: "standard" }>,
  content: HeroChapterBodyContent,
): void {
  const { width, height } = layout.viewport;
  const mobile = width <= 700;
  const inset = Math.max(24, width * 0.07);
  const gap = clamp(width * 0.03, 16, 48);
  const sections = content.sections
    .map((section, index) => ({ number: index + 1, section }))
    .slice(mobile ? -1 : -2);
  const cardWidth = mobile ? width - inset * 2 : (width - inset * 2 - gap) / 2;
  const bottomPadding = height * 0.18;
  const closingLayout = content.closing
    ? createStandardClosingLayout(layout.viewport, inset)
    : undefined;
  let closingTop = height - bottomPadding;

  if (closingLayout && content.closing) {
    setTextStyle(context, closingLayout);
    const closingLines = wrapText(
      context,
      content.closing,
      closingLayout.width,
    );
    closingTop -= closingLines.length * closingLayout.lineHeight;
    drawTextLines(context, closingLines, closingLayout, closingTop);
  }

  const cardsBottom = closingLayout
    ? closingTop - height * 0.18
    : height - bottomPadding;
  const cardHeight = height * (mobile ? 0.55 : 0.53);
  const cardTop = cardsBottom - cardHeight;
  for (const [index, item] of sections.entries()) {
    drawTailCard(
      context,
      item.number,
      item.section,
      inset + index * (cardWidth + gap),
      cardTop,
      cardWidth,
      cardHeight,
      layout.viewport,
    );
  }
}

function createStandardClosingLayout(
  viewport: HeroViewport,
  inset: number,
): HeroChapterTextLayout {
  const fontSize = clamp(viewport.width * 0.05, 32, 80);
  const width = Math.min(
    viewport.width - inset * 2,
    22 * 0.55615234375 * fontSize,
  );
  return {
    left: viewport.width - inset - width,
    right: viewport.width - inset,
    width,
    fontSize,
    lineHeight: fontSize * 1.1,
    letterSpacing: fontSize * -0.035,
    fontWeight: 400,
    align: "left",
    balance: false,
  };
}

function drawTailCard(
  context: CanvasRenderingContext2D,
  number: number,
  section: HeroChapterBodyContent["sections"][number],
  left: number,
  top: number,
  width: number,
  height: number,
  viewport: HeroViewport,
): void {
  const padding = clamp(viewport.width * 0.03, 19.2, 48);
  const contentWidth = Math.max(1, width - padding * 2);
  const labelFontSize = clamp(viewport.width * 0.012, 12, 16);
  const headingFontSize = clamp(viewport.width * 0.04, 32, 64);
  const bodyFontSize = clamp(viewport.width * 0.0125, 14, 17.6);
  const labelLayout = createCardTextLayout(
    left + padding,
    contentWidth,
    labelFontSize,
    labelFontSize * 1.45,
    labelFontSize * 0.08,
    400,
  );
  const headingLayout = createCardTextLayout(
    left + padding,
    contentWidth,
    headingFontSize,
    headingFontSize,
    headingFontSize * -0.035,
    700,
  );
  const bodyLayout = createCardTextLayout(
    left + padding,
    contentWidth,
    bodyFontSize,
    bodyFontSize * 1.55,
    0,
    400,
  );

  drawRectOutline(context, left, top, width, height);
  setTextStyle(context, labelLayout);
  drawTextLines(
    context,
    [`${String(number).padStart(2, "0")} / ${section.label}`],
    labelLayout,
    top + padding,
  );

  setTextStyle(context, headingLayout);
  const headingLines = wrapText(context, section.title, contentWidth, true);
  const headingTop = top + padding + viewport.height * 0.1;
  drawTextLines(context, headingLines, headingLayout, headingTop);

  setTextStyle(context, bodyLayout);
  const bodyTop =
    headingTop + headingLines.length * headingLayout.lineHeight + 32;
  const bodyLines = wrapText(context, section.body, contentWidth);
  drawTextLines(context, bodyLines, bodyLayout, bodyTop);
  if (section.link) {
    drawTextLines(
      context,
      [`${section.link.label} ↗`],
      bodyLayout,
      bodyTop + bodyLines.length * bodyLayout.lineHeight + 24,
    );
  }
}

function createCardTextLayout(
  left: number,
  width: number,
  fontSize: number,
  lineHeight: number,
  letterSpacing: number,
  fontWeight: 400 | 700,
): HeroChapterTextLayout {
  return {
    left,
    right: left + width,
    width,
    fontSize,
    lineHeight,
    letterSpacing,
    fontWeight,
    align: "left",
    balance: false,
  };
}

function drawRectOutline(
  context: CanvasRenderingContext2D,
  left: number,
  top: number,
  width: number,
  height: number,
): void {
  const edge = 1;
  context.fillRect(left, top, width, edge);
  context.fillRect(left, top + height - edge, width, edge);
  context.fillRect(left, top, edge, height);
  context.fillRect(left + width - edge, top, edge, height);
}

function fillTileBackground(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
): void {
  context.fillStyle = "black";
  context.fillRect(0, 0, width, height);
  context.fillStyle = "white";
}

function setTextStyle(
  context: CanvasRenderingContext2D,
  layout: HeroChapterTextLayout,
): void {
  context.font = `${layout.fontWeight} ${layout.fontSize}px Arial, Helvetica, sans-serif`;
  context.letterSpacing = `${layout.letterSpacing}px`;
}

function drawTextLines(
  context: CanvasRenderingContext2D,
  lines: readonly string[],
  textLayout: HeroChapterTextLayout,
  top: number,
  wrap?: {
    readonly layout: Extract<HeroChapterLayout, { readonly kind: "profile" }>;
    readonly side: "left" | "right";
  },
): void {
  for (const [index, text] of lines.entries()) {
    const width = context.measureText(text).width;
    const lineTop = top + index * textLayout.lineHeight;
    const left =
      textLayout.align === "right" ? textLayout.right - width : textLayout.left;
    const shift = wrap
      ? resolveHeroProfileLineShiftForExclusions(
          {
            left,
            right: left + width,
            top: lineTop,
            bottom: lineTop + textLayout.lineHeight,
            width,
            height: textLayout.lineHeight,
          },
          wrap.layout.wrap.exclusions,
          wrap.layout.wrap.bounds,
          wrap.side,
          wrap.layout.wrap.gap,
        )
      : 0;
    fillTextInLineBox(
      context,
      text,
      left + shift,
      lineTop,
      textLayout.lineHeight,
      textLayout.fontSize,
    );
  }
}

function drawProfileSpeechBubble(
  context: CanvasRenderingContext2D,
  layout: Extract<HeroChapterLayout, { readonly kind: "profile" }>,
  text: string,
): void {
  const { rect, tailHeight, cornerRadius, fontSize, lineHeight } =
    layout.speechBubble;
  const balloonBottom = rect.bottom - tailHeight;
  const balloonHeight = balloonBottom - rect.top;
  const radius = Math.min(cornerRadius, rect.width / 2, balloonHeight / 2);
  const curveControl = radius * 0.5522847498;
  const centerX = rect.left + rect.width / 2;
  const tailLeft = rect.left + rect.width * 0.45;
  const tailTip = rect.left + rect.width * 0.52;
  const tailRight = rect.left + rect.width * 0.61;

  context.save();
  context.fillStyle = "white";
  context.strokeStyle = "black";
  context.lineWidth = 2;
  context.lineJoin = "round";
  context.beginPath();
  context.moveTo(rect.left + radius, rect.top);
  context.lineTo(rect.right - radius, rect.top);
  context.bezierCurveTo(
    rect.right - radius + curveControl,
    rect.top,
    rect.right,
    rect.top + radius - curveControl,
    rect.right,
    rect.top + radius,
  );
  context.lineTo(rect.right, balloonBottom - radius);
  context.bezierCurveTo(
    rect.right,
    balloonBottom - radius + curveControl,
    rect.right - radius + curveControl,
    balloonBottom,
    rect.right - radius,
    balloonBottom,
  );
  context.lineTo(tailRight, balloonBottom);
  context.lineTo(tailTip, rect.bottom);
  context.lineTo(tailLeft, balloonBottom);
  context.lineTo(rect.left + radius, balloonBottom);
  context.bezierCurveTo(
    rect.left + radius - curveControl,
    balloonBottom,
    rect.left,
    balloonBottom - radius + curveControl,
    rect.left,
    balloonBottom - radius,
  );
  context.lineTo(rect.left, rect.top + radius);
  context.bezierCurveTo(
    rect.left,
    rect.top + radius - curveControl,
    rect.left + radius - curveControl,
    rect.top,
    rect.left + radius,
    rect.top,
  );
  context.closePath();
  context.fill();
  context.stroke();

  context.fillStyle = "black";
  context.font = `700 ${fontSize}px Arial, Helvetica, sans-serif`;
  context.letterSpacing = "0px";
  const textWidth = context.measureText(text).width;
  fillTextInLineBox(
    context,
    text,
    centerX - textWidth / 2,
    rect.top + (balloonHeight - lineHeight) / 2,
    lineHeight,
    fontSize,
  );
  context.restore();
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
  const baseline = lineTop + (lineHeight - ascent - descent) / 2 + ascent;
  context.fillText(value, x, baseline);
}

function wrapText(
  context: CanvasRenderingContext2D,
  value: string,
  maxWidth: number,
  balance = false,
): readonly string[] {
  const tokens = tokenizeText(value);
  const greedyLines = wrapTokens(context, tokens, maxWidth);
  return balance && greedyLines.length > 1
    ? balanceTokens(context, tokens, maxWidth, greedyLines.length)
    : greedyLines;
}

type TextToken = {
  readonly value: string;
  readonly spaceBefore: boolean;
};

function tokenizeText(value: string): readonly TextToken[] {
  const segments =
    value.match(/\p{Script=Han}|\s+|[^\p{Script=Han}\s]+/gu) ?? [];
  const tokens: TextToken[] = [];
  let pendingSpace = false;
  for (const segment of segments) {
    if (/^\s+$/.test(segment)) {
      pendingSpace = tokens.length > 0;
      continue;
    }
    tokens.push({ value: segment, spaceBefore: pendingSpace });
    pendingSpace = false;
  }
  return tokens;
}

function wrapTokens(
  context: CanvasRenderingContext2D,
  tokens: readonly TextToken[],
  maxWidth: number,
): readonly string[] {
  const lines: string[] = [];
  let start = 0;
  for (let end = 1; end <= tokens.length; end += 1) {
    const candidate = formatTokens(tokens, start, end);
    if (end - start > 1 && context.measureText(candidate).width > maxWidth) {
      lines.push(formatTokens(tokens, start, end - 1));
      start = end - 1;
    }
  }
  if (start < tokens.length) {
    lines.push(formatTokens(tokens, start, tokens.length));
  }
  return lines;
}

function balanceTokens(
  context: CanvasRenderingContext2D,
  tokens: readonly TextToken[],
  maxWidth: number,
  lineCount: number,
): readonly string[] {
  const tokenCount = tokens.length;
  const targetWidth =
    context.measureText(formatTokens(tokens, 0, tokenCount)).width / lineCount;
  const targetTokenCount = Math.max(1, Math.round(tokenCount / lineCount));
  const costs = Array.from({ length: lineCount + 1 }, () =>
    Array.from({ length: tokenCount + 1 }, () => Number.POSITIVE_INFINITY),
  );
  const breaks = Array.from({ length: lineCount + 1 }, () =>
    Array.from({ length: tokenCount + 1 }, () => -1),
  );
  costs[0][0] = 0;

  for (let line = 1; line <= lineCount; line += 1) {
    for (let end = line; end <= tokenCount; end += 1) {
      const remainingTokens = tokenCount - end;
      if (remainingTokens < lineCount - line) {
        continue;
      }
      for (let start = line - 1; start < end; start += 1) {
        if (!Number.isFinite(costs[line - 1][start])) {
          continue;
        }
        const text = formatTokens(tokens, start, end);
        const width = context.measureText(text).width;
        if (width > maxWidth) {
          continue;
        }
        const difference = width - targetWidth;
        const lastLineOverflow =
          line === lineCount ? Math.max(0, difference) : 0;
        // Match text-wrap: balance's short final line without copy-specific breaks.
        const lastLineTokenOverflow =
          line === lineCount ? Math.max(0, end - start - targetTokenCount) : 0;
        const cost =
          costs[line - 1][start] +
          difference * difference +
          lastLineOverflow * lastLineOverflow * 0.01 +
          lastLineTokenOverflow * lastLineTokenOverflow * maxWidth * maxWidth;
        if (cost < costs[line][end]) {
          costs[line][end] = cost;
          breaks[line][end] = start;
        }
      }
    }
  }

  if (breaks[lineCount][tokenCount] < 0) {
    return wrapTokens(context, tokens, maxWidth);
  }
  const lines = Array.from({ length: lineCount }, () => "");
  let end = tokenCount;
  for (let line = lineCount; line > 0; line -= 1) {
    const start = breaks[line][end];
    lines[line - 1] = formatTokens(tokens, start, end);
    end = start;
  }
  return lines;
}

function formatTokens(
  tokens: readonly TextToken[],
  start: number,
  end: number,
): string {
  let value = "";
  for (let index = start; index < end; index += 1) {
    const token = tokens[index];
    if (value && token.spaceBefore) {
      value += " ";
    }
    value += token.value;
  }
  return value;
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

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
