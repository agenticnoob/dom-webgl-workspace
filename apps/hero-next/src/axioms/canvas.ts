import type { AxiomsArtwork } from "./artwork";
import type { AxiomsFrame } from "./frame";
import type { AxiomsRect } from "./layout";
import { axiomsReaderConfig } from "./config";
import { drawAxiomsText, type AxiomsTile } from "./typography";
import { traceAxiomsStamp } from "./stamp";

export function drawAxiomsFrame(
  context: CanvasRenderingContext2D,
  artwork: AxiomsArtwork,
  frame: AxiomsFrame,
): void {
  const { layout } = artwork;
  context.fillStyle = "black";
  context.fillRect(0, 0, layout.viewport.width, layout.viewport.height);
  context.save();
  context.translate(layout.header.x, layout.header.y);
  context.fillStyle = "white";
  drawAxiomsText(context, artwork.header);
  context.restore();
  context.save();
  context.beginPath();
  context.rect(
    0,
    layout.paperArea.y - axiomsReaderConfig.fan.clipInset,
    layout.viewport.width,
    layout.viewport.height,
  );
  context.clip();
  for (const [i, fan] of frame.fans.entries()) {
    if (!fan.visible) continue;
    drawSheet(
      context,
      fan.rect,
      fan.angle,
      i === frame.selected ? 1 : 0,
      artwork.fans[i],
      0,
      true,
    );
  }
  context.restore();
  for (const [i, paper] of frame.papers.entries()) {
    if (!paper.visible) continue;
    const overflow = Math.max(
      paper.angle,
      artwork.papers[i].height - layout.papers[i].height,
    );
    drawSheet(
      context,
      paper.rect,
      0,
      paper.emphasis,
      artwork.papers[i],
      overflow * paper.scroll,
      false,
    );
  }
}

function drawSheet(
  context: CanvasRenderingContext2D,
  rect: AxiomsRect,
  angle: number,
  emphasis: number,
  tile: AxiomsTile,
  scroll: number,
  scaleText: boolean,
): void {
  context.save();
  context.translate(rect.x + rect.width / 2, rect.y + rect.height / 2);
  context.rotate(angle);
  context.translate(-rect.width / 2, -rect.height / 2);
  if (!scaleText) {
    traceAxiomsStamp(context, rect.width, rect.height);
    context.clip();
  }
  context.fillStyle = scaleText ? "white" : "black";
  context.fillRect(0, 0, rect.width, rect.height);
  const shade = scaleText ? Math.round(emphasis * 255) : 255;
  context.fillStyle = `rgb(${shade}, ${shade}, ${shade})`;
  context.fillRect(1, 1, rect.width - 2, rect.height - 2);
  if (!scaleText) {
    context.strokeStyle = "black";
    context.lineWidth = 2;
    context.stroke();
  }
  context.beginPath();
  context.rect(2, 2, rect.width - 4, rect.height - 4);
  context.clip();
  const ink = scaleText ? 255 - shade : 0;
  context.fillStyle = `rgb(${ink}, ${ink}, ${ink})`;
  if (scaleText)
    context.scale(rect.width / tile.width, rect.height / tile.height);
  context.translate(0, -scroll);
  drawAxiomsText(context, tile);
  context.restore();
}
