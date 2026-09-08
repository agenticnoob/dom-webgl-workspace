import type { HeroChapterBodyContent } from "../chapters/content";
import type { HeroLocale } from "../preferences/locale";
import type { HeroViewport } from "../shared/viewport";
import { resolveSignalsLayout } from "./layout";

export function drawSignalsEndpoint(
  context: CanvasRenderingContext2D,
  viewport: HeroViewport,
  content: HeroChapterBodyContent,
  locale: HeroLocale,
) {
  const { width, height } = viewport;
  const layout = resolveSignalsLayout(viewport);
  context.fillStyle = "black";
  context.fillRect(0, 0, width, height);
  context.fillStyle = "white";
  context.textBaseline = "alphabetic";
  context.textAlign = "left";
  context.letterSpacing = "0px";
  context.font = `400 ${layout.captionSize}px Arial, Helvetica, sans-serif`;
  drawCenteredLine(
    context,
    locale === "zh" ? "04 / 在别处，继续" : "04 / ELSEWHERE",
    layout.inset,
    height * 0.14,
  );
  context.textAlign = "right";
  if (width > 700)
    drawCenteredLine(
      context,
      content.title,
      width - layout.inset,
      height * 0.14,
    );
  context.textAlign = "left";
  content.sections.forEach((item, index) => {
    context.font = `700 ${layout.fontSize}px Arial, Helvetica, sans-serif`;
    context.letterSpacing = `${layout.fontSize * -0.055}px`;
    const y = layout.top + layout.rowHeight * (index + 0.5);
    drawCenteredLine(context, item.title, layout.inset, y);
    context.font = `400 ${layout.fontSize * 0.42}px Arial, Helvetica, sans-serif`;
    context.letterSpacing = "0px";
    context.textAlign = "right";
    drawCenteredLine(context, item.link ? "↗" : "·", width - layout.inset, y);
    context.textAlign = "left";
  });
  context.font = `400 ${layout.captionSize}px Arial, Helvetica, sans-serif`;
  if (width > 700 && content.closing)
    drawCenteredLine(context, content.closing, layout.inset, height * 0.88);
  context.textAlign = width > 700 ? "right" : "left";
  drawCenteredLine(
    context,
    locale === "zh"
      ? "悬停预览 · 点击前往"
      : "Hover to preview · Click to visit",
    width > 700 ? width - layout.inset : layout.inset,
    height * 0.88,
  );
  context.textAlign = "left";
  context.textBaseline = "alphabetic";
}

/** Canvas middle baseline differs from the DOM's centered line box. */
function drawCenteredLine(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  centerY: number,
) {
  const metrics = context.measureText(text);
  const ascent =
    metrics.fontBoundingBoxAscent ?? metrics.actualBoundingBoxAscent;
  const descent =
    metrics.fontBoundingBoxDescent ?? metrics.actualBoundingBoxDescent;
  context.fillText(text, x, centerY + (ascent - descent) / 2);
}
