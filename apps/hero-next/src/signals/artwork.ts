import type { HeroChapterBodyContent } from "../chapters/content";
import type { HeroLocale } from "../preferences/locale";
import type { HeroViewport } from "../shared/viewport";
import {
  resolveSignalsLayout,
  resolveSignalsMobileLayout,
  signalsHoverEnabled,
} from "./layout";
import { getSignalImage } from "./images";

export function drawSignalsEndpoint(
  context: CanvasRenderingContext2D,
  viewport: HeroViewport,
  content: HeroChapterBodyContent,
  locale: HeroLocale,
  endpoint: "entry" | "exit" = "entry",
  hover = signalsHoverEnabled(),
) {
  const { width, height } = viewport;
  const layout = resolveSignalsLayout(viewport, locale);
  context.fillStyle = "black";
  context.fillRect(0, 0, width, height);
  context.fillStyle = "white";
  if (!hover) {
    drawMobileEndpoint(context, viewport, content, locale, endpoint);
    return;
  }
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
    const label = item.directory
      ? `${item.title} · ${item.directory.name}`
      : item.title;
    const detail = item.directory?.detail ?? "";
    const gap = Math.min(width * 0.015, 24);
    const detailSize = Math.min(width * 0.014, 20);
    context.font = `400 ${detailSize}px Arial, Helvetica, sans-serif`;
    context.letterSpacing = "0px";
    const detailWidth = context.measureText(detail).width;
    context.font = `700 ${layout.fontSize}px Arial, Helvetica, sans-serif`;
    context.letterSpacing = `${layout.fontSize * -0.04}px`;
    const labelWidth = context.measureText(label).width;
    const left = (width - labelWidth - gap - detailWidth) / 2;
    const y = layout.top + layout.rowHeight * (index + 0.5);
    drawCenteredLine(context, label, left, y);
    context.font = `400 ${detailSize}px Arial, Helvetica, sans-serif`;
    context.letterSpacing = "0px";
    drawCenteredLine(context, detail, left + labelWidth + gap, y);
    context.font = `400 ${layout.fontSize * 0.42}px Arial, Helvetica, sans-serif`;
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
      ? "移动预览 · 点击前往"
      : "Move to preview · Click to visit",
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

function drawMobileEndpoint(
  context: CanvasRenderingContext2D,
  viewport: HeroViewport,
  content: HeroChapterBodyContent,
  locale: HeroLocale,
  endpoint: "entry" | "exit",
) {
  const layout = resolveSignalsMobileLayout(viewport, content);
  const inset = resolveSignalsLayout(viewport).inset;
  context.save();
  context.translate(
    0,
    endpoint === "exit" ? viewport.height - layout.height : 0,
  );
  context.textAlign = "center";
  context.letterSpacing = "0px";
  context.font = `400 ${resolveSignalsLayout(viewport).captionSize}px Arial, Helvetica, sans-serif`;
  drawCenteredLine(
    context,
    locale === "zh" ? "04 / 在别处，继续" : "04 / ELSEWHERE",
    viewport.width / 2,
    viewport.height * 0.1,
  );
  content.sections.forEach((item, index) => {
    const row = layout.rows[index];
    context.font = `700 ${layout.fontSize}px Arial, Helvetica, sans-serif`;
    context.letterSpacing = `${layout.fontSize * -0.04}px`;
    drawCenteredLine(
      context,
      item.title,
      viewport.width / 2,
      row.top + 32 + layout.fontSize * 0.55,
    );
    context.letterSpacing = "0px";
    context.font = "700 22px Arial, Helvetica, sans-serif";
    drawCenteredLine(
      context,
      item.directory?.name ?? "",
      viewport.width / 2,
      row.top + 53 + layout.fontSize * 1.1,
    );
    context.font = "400 14px Arial, Helvetica, sans-serif";
    drawCenteredLine(
      context,
      item.directory?.detail ?? "",
      viewport.width / 2,
      row.top + 85 + layout.fontSize * 1.1,
    );
    if (item.image) {
      const image = getSignalImage(item.image.src);
      if (image)
        context.drawImage(
          image,
          (viewport.width - layout.imageWidth) / 2,
          row.contentTop,
          layout.imageWidth,
          row.contentHeight,
        );
    } else {
      context.font = "400 16px Arial, Helvetica, sans-serif";
      const tokens =
        locale === "zh" ? Array.from(item.body) : item.body.split(/(\s+)/);
      const lines: string[] = [];
      let line = "";
      for (const token of tokens) {
        if (
          line &&
          context.measureText(line + token).width >
            Math.min(560, viewport.width - inset * 2)
        ) {
          lines.push(line.trim());
          line = token.trimStart();
        } else line += token;
      }
      if (line) lines.push(line.trim());
      lines.forEach((text, i) =>
        drawCenteredLine(
          context,
          text,
          viewport.width / 2,
          row.contentTop + 13 + i * 26,
        ),
      );
    }
  });
  context.font = `400 ${resolveSignalsLayout(viewport).captionSize}px Arial, Helvetica, sans-serif`;
  drawCenteredLine(
    context,
    locale === "zh" ? "点击内容，前往主页 ↗" : "Tap to visit the profile ↗",
    viewport.width / 2,
    layout.footerTop + viewport.height * 0.07,
  );
  context.restore();
  context.textAlign = "left";
  context.textBaseline = "alphabetic";
}
