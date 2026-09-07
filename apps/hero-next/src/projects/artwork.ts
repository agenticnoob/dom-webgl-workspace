import type { HeroChapterBodyContent } from "../chapters/content";
import {
  appendText,
  drawAxiomsText,
  type TextLine,
} from "../axioms/typography";
import type { HeroViewport } from "../shared/viewport";
import { projectRoomConfig as config, projectRoomPoint } from "./room";

export function createProjectRoomTexture(
  content: HeroChapterBodyContent,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = config.textureWidth * 2 * config.texturePixelRatio;
  canvas.height = config.textureHeight * 2 * config.texturePixelRatio;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Project room requires a 2D text context.");
  ctx.scale(config.texturePixelRatio, config.texturePixelRatio);
  content.sections.forEach((section, index) => {
    ctx.save();
    ctx.translate(
      (index % 2) * config.textureWidth,
      Math.floor(index / 2) * config.textureHeight,
    );
    ctx.fillStyle = "white";
    ctx.strokeStyle = "white";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(90, 112);
    ctx.lineTo(934, 112);
    ctx.stroke();
    const lines: TextLine[] = [];
    appendText(
      ctx,
      lines,
      `${String(index + 1).padStart(2, "0")} / ${section.label}`,
      90,
      65,
      844,
      20,
      400,
    );
    let y = appendText(ctx, lines, section.title, 90, 150, 844, 68, 400, 1.05);
    y = appendText(ctx, lines, section.body, 94, y + 46, 820, 25, 400, 1.65);
    if (y > 660)
      throw new Error(`Project room copy exceeds its wall: ${section.title}`);
    drawAxiomsText(ctx, {
      width: config.textureWidth,
      height: config.textureHeight,
      lines,
    });
    ctx.restore();
  });
  return canvas;
}

function polygon(
  ctx: CanvasRenderingContext2D,
  points: readonly (readonly [number, number])[],
  fill: string,
) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.fill();
}

// Project the side wall in thin affine strips; the front wall is exactly affine.
function drawWall(
  ctx: CanvasRenderingContext2D,
  texture: HTMLCanvasElement,
  viewport: HeroViewport,
  index: number,
  side: -1 | 0 | 1,
) {
  const {
    radius: r,
    halfHeight: h,
    textureWidth: tw,
    textureHeight: th,
  } = config;
  const point = (u: number, v: number) =>
    side === 0
      ? projectRoomPoint(viewport, (u * 2 - 1) * r, (1 - v * 2) * h, -r)
      : projectRoomPoint(
          viewport,
          side * r,
          (1 - v * 2) * h,
          -r + u * (r - 0.2),
        );
  const strips = side === 0 ? 1 : 64;
  for (let i = 0; i < strips; i++) {
    const u0 = i / strips,
      u1 = (i + 1) / strips;
    const a = point(u0, 0),
      b = point(u1, 0),
      d = point(u0, 1),
      c = point(u1, 1);
    const textureU0 =
      side === 0
        ? u0
        : side === 1
          ? (u0 * (r - 0.2)) / (2 * r)
          : 1 - (u0 * (r - 0.2)) / (2 * r);
    const textureU1 =
      side === 0
        ? u1
        : side === 1
          ? (u1 * (r - 0.2)) / (2 * r)
          : 1 - (u1 * (r - 0.2)) / (2 * r);
    const sx0 = ((index % 2) + textureU0) * tw,
      sx1 = ((index % 2) + textureU1) * tw;
    const sy = Math.floor(index / 2) * th;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(...a);
    ctx.lineTo(...b);
    ctx.lineTo(...c);
    ctx.lineTo(...d);
    ctx.closePath();
    ctx.clip();
    const dx = sx1 - sx0;
    ctx.transform(
      (b[0] - a[0]) / dx,
      (b[1] - a[1]) / dx,
      (d[0] - a[0]) / th,
      (d[1] - a[1]) / th,
      a[0],
      a[1],
    );
    ctx.drawImage(
      texture,
      Math.min(sx0, sx1) * config.texturePixelRatio,
      sy * config.texturePixelRatio,
      Math.abs(dx) * config.texturePixelRatio,
      th * config.texturePixelRatio,
      Math.min(0, dx),
      0,
      Math.abs(dx),
      th,
    );
    ctx.restore();
  }
}

export function drawProjectRoomEndpoint(
  ctx: CanvasRenderingContext2D,
  viewport: HeroViewport,
  texture: HTMLCanvasElement,
) {
  const { width: w, height: h } = viewport;
  const { radius: r, halfHeight: wallHeight } = config;
  const tl = projectRoomPoint(viewport, -r, wallHeight, -r),
    tr = projectRoomPoint(viewport, r, wallHeight, -r);
  const bl = projectRoomPoint(viewport, -r, -wallHeight, -r),
    br = projectRoomPoint(viewport, r, -wallHeight, -r);
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, w, h);
  polygon(ctx, [[0, 0], [w, 0], tr, tl], "rgb(16,16,16)");
  polygon(ctx, [bl, br, [w, h], [0, h]], "rgb(16,16,16)");
  polygon(ctx, [[0, 0], tl, bl, [0, h]], "rgb(28,28,28)");
  polygon(ctx, [tr, [w, 0], [w, h], br], "rgb(28,28,28)");
  drawWall(ctx, texture, viewport, 0, 0);
  ctx.globalAlpha = 0.65;
  drawWall(ctx, texture, viewport, 1, 1);
  drawWall(ctx, texture, viewport, 3, -1);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = "rgb(80,80,80)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(...tl);
  ctx.lineTo(...tr);
  ctx.lineTo(...br);
  ctx.lineTo(...bl);
  ctx.closePath();
  [
    [tl, [0, 0]],
    [tr, [w, 0]],
    [bl, [0, h]],
    [br, [w, h]],
  ].forEach(([a, b]) => {
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
  });
  ctx.stroke();
}
