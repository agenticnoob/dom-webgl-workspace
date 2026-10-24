import type {
  FourFaces,
  PortalChapter,
  PortalPanelContent,
  SpatialViewport,
} from "./types";

export function panelLayout(
  viewport: Pick<SpatialViewport, "width" | "height">,
  relief: boolean,
) {
  const { width, height } = viewport;
  const narrow = width <= 700;
  const size = Math.max(26, Math.min(72, width * 0.065, height * 0.105));
  return {
    titleSize: relief ? size * 0.72 : size,
    descriptionSize: Math.max(16, Math.min(24, width * 0.021)),
    labelSize: 13,
    title: {
      x: width * 0.08,
      y: height * (relief && narrow ? 0.16 : 0.2),
      width: width * (relief && !narrow ? 0.28 : 0.84),
    },
    description: {
      x: width * (relief && !narrow ? 0.67 : 0.08),
      y: height * (relief ? (narrow ? 0.76 : 0.4) : 0.62),
      width: width * (relief && !narrow ? 0.25 : 0.78),
    },
  };
}

export function createPortalAtlas(
  viewport: SpatialViewport,
  chapters: FourFaces<PortalChapter> | undefined,
  reliefFace?: number,
) {
  // Eight tiles share one texture; bound the complete atlas to 4096px.
  const ratio = Math.min(1.5, 2048 / viewport.width, 1024 / viewport.height);
  const width = chapters ? Math.max(1, Math.floor(viewport.width * ratio)) : 1;
  const height = chapters
    ? Math.max(1, Math.floor(viewport.height * ratio))
    : 1;
  const canvas = document.createElement("canvas");
  canvas.width = width * 2;
  canvas.height = height * 4;
  const ctx = canvas.getContext("2d");
  if (!ctx)
    throw new Error(
      "FacePortal requires a Canvas 2D context for its text atlas.",
    );
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  chapters?.forEach((chapter, index) => {
    for (const endpoint of [0, 1]) {
      const column = index % 2;
      const row = Math.floor(index / 2) + endpoint * 2;
      ctx.save();
      ctx.translate(column * width, row * height);
      ctx.beginPath();
      ctx.rect(0, 0, width, height);
      ctx.clip();
      ctx.scale(width / viewport.width, height / viewport.height);
      drawPanel(
        ctx,
        endpoint === 1 ? (chapter.exit ?? chapter.entry) : chapter.entry,
        viewport,
        index === reliefFace,
      );
      ctx.restore();
    }
  });
  return canvas;
}

function drawPanel(
  ctx: CanvasRenderingContext2D,
  content: PortalPanelContent,
  viewport: SpatialViewport,
  relief: boolean,
) {
  const layout = panelLayout(viewport, relief);
  ctx.fillStyle = "white";
  ctx.textBaseline = "alphabetic";
  ctx.font = `${layout.labelSize}px Arial, sans-serif`;
  ctx.fillText(
    content.label,
    layout.title.x,
    layout.title.y - 28 + baselineOffset(ctx, layout.labelSize * 1.2),
  );
  ctx.font = `700 ${layout.titleSize}px Arial, sans-serif`;
  drawLines(
    ctx,
    content.title,
    layout.title.x,
    layout.title.y,
    layout.title.width,
    layout.titleSize * 1.08,
  );
  ctx.font = `${layout.descriptionSize}px Arial, sans-serif`;
  drawLines(
    ctx,
    content.description,
    layout.description.x,
    layout.description.y,
    layout.description.width,
    layout.descriptionSize * 1.5,
  );
}

function drawLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  width: number,
  lineHeight: number,
) {
  y += baselineOffset(ctx, lineHeight);
  let line = "";
  for (const token of text.match(/\S+\s*|\s+/gu) ?? []) {
    if (line && ctx.measureText(line + token).width > width) {
      ctx.fillText(line.trimEnd(), x, y);
      y += lineHeight;
      line = "";
    }
    // Long words and CJK paragraphs must also wrap instead of leaving the tile.
    for (const glyph of token) {
      if (line && ctx.measureText(line + glyph).width > width) {
        ctx.fillText(line.trimEnd(), x, y);
        y += lineHeight;
        line = "";
      }
      line += glyph;
    }
  }
  if (line) ctx.fillText(line.trimEnd(), x, y);
}

function baselineOffset(ctx: CanvasRenderingContext2D, lineHeight: number) {
  // CSS centers the font em box in its line box; Canvas's "top" baseline
  // ignores that leading and visibly jumps at the atlas-to-DOM handoff.
  const metrics = ctx.measureText("Mg");
  const ascent = metrics.fontBoundingBoxAscent ?? lineHeight * 0.8;
  const descent = metrics.fontBoundingBoxDescent ?? lineHeight * 0.2;
  return (lineHeight - ascent - descent) / 2 + ascent;
}
