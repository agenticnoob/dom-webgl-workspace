import { projectRoomConfig as config } from "./room";
import type { ProjectRoomItems } from "./types";

type TextMeasurer = { measureText(text: string): { readonly width: number } };

/** Word wrapping also handles CJK, explicit newlines and unbroken URLs. */
export function wrapRoomText(
  context: TextMeasurer,
  text: string,
  width: number,
): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    const tokens =
      paragraph.match(
        /\p{Script=Han}[，。！？；：、）》」』]*|[^\p{Script=Han}\s]+\s*/gu,
      ) ?? [];
    let line = "";
    for (const token of tokens) {
      if (line && context.measureText(line + token).width > width) {
        lines.push(line.trim());
        line = "";
      }
      if (context.measureText(token).width > width) {
        for (const character of token) {
          if (line && context.measureText(line + character).width > width) {
            lines.push(line.trim());
            line = "";
          }
          line += character;
        }
      } else line += token;
    }
    lines.push(line.trim());
  }
  return lines;
}

export function createProjectRoomTexture(
  items: ProjectRoomItems,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  // 2048 × 1440 remains inside WebGL's baseline texture-size limit.
  canvas.width = config.textureWidth * 2;
  canvas.height = config.textureHeight * 2;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("ProjectRoom could not create a text canvas.");
  context.textBaseline = "top";
  items.forEach((item, index) => {
    context.save();
    context.translate(
      (index % 2) * config.textureWidth,
      Math.floor(index / 2) * config.textureHeight,
    );
    context.fillStyle = "white";
    context.fillRect(90, 112, 844, 1);
    const write = (
      text: string,
      top: number,
      size: number,
      leading: number,
    ): number => {
      context.font = `400 ${size}px Arial, Helvetica, sans-serif`;
      const lines = wrapRoomText(context, text, 844);
      const bottom = top + lines.length * size * leading;
      if (bottom > 660)
        throw new Error(
          `ProjectRoom text exceeds wall capacity: ${item.id}. Shorten its title or description.`,
        );
      lines.forEach((line, lineIndex) =>
        context.fillText(line, 90, top + lineIndex * size * leading),
      );
      return bottom;
    };
    write(
      `${String(index + 1).padStart(2, "0")} / ${item.label}`,
      65,
      20,
      1.25,
    );
    const bottom = write(item.title, 150, 68, 1.05);
    write(item.description, bottom + 46, 25, 1.65);
    context.restore();
  });
  return canvas;
}
