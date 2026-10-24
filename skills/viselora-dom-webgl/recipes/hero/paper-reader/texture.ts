import { paperReaderConfig } from "./config";
import type { PaperReaderArtwork } from "./artwork";
import { drawPaperReaderText, type PaperReaderTile } from "./typography";

export function resolvePaperReaderTextureLayout(
  tiles: readonly PaperReaderTile[],
) {
  const { gutter, pixelRatio, maxDimension } = paperReaderConfig.texture;
  const columns = Math.ceil(Math.sqrt(tiles.length));
  const rows = Math.ceil(tiles.length / columns);
  const cellWidth =
    Math.ceil(Math.max(...tiles.map((tile) => tile.width))) + gutter * 2;
  const cellHeight =
    Math.ceil(Math.max(...tiles.map((tile) => tile.height))) + gutter * 2;
  const scale = Math.min(
    pixelRatio,
    maxDimension / (cellWidth * columns),
    maxDimension / (cellHeight * rows),
  );
  return {
    tiles,
    // Share exact cell origins with the shader; GPU division at row boundaries
    // can round down and sample an adjacent empty cell.
    tileOrigins: tiles.map((_, i): [number, number] => [
      (i % columns) * cellWidth + gutter,
      Math.floor(i / columns) * cellHeight + gutter,
    ]),
    columns,
    rows,
    cellWidth,
    cellHeight,
    gutter,
    width: Math.min(maxDimension, Math.ceil(cellWidth * columns * scale)),
    height: Math.min(maxDimension, Math.ceil(cellHeight * rows * scale)),
  };
}

export type PaperReaderTexture = ReturnType<
  typeof resolvePaperReaderTextureLayout
> & {
  readonly canvas: HTMLCanvasElement;
};

export function createPaperReaderTexture(
  artwork: PaperReaderArtwork,
): PaperReaderTexture {
  const packed = resolvePaperReaderTextureLayout([
    artwork.header,
    ...artwork.fans,
    ...artwork.papers,
  ]);
  const canvas = document.createElement("canvas");
  canvas.width = packed.width;
  canvas.height = packed.height;
  const context = canvas.getContext("2d");
  if (!context)
    throw new Error("PaperReader text requires a 2D canvas context.");
  context.scale(
    canvas.width / (packed.cellWidth * packed.columns),
    canvas.height / (packed.cellHeight * packed.rows),
  );
  for (const [i, tile] of packed.tiles.entries()) {
    context.save();
    const [x, y] = packed.tileOrigins[i];
    context.translate(x, y);
    context.fillStyle = "white";
    drawPaperReaderText(context, tile);
    context.restore();
  }
  return { ...packed, canvas };
}
