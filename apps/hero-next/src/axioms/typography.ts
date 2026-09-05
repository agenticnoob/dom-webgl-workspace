export type TextLine = {
  readonly text: string;
  readonly x: number;
  readonly y: number;
  readonly size: number;
  readonly weight: number;
};
export type TextMeasurer = {
  font: string;
  letterSpacing: string;
  measureText(text: string): { readonly width: number };
};
export type AxiomsTile = {
  readonly width: number;
  readonly height: number;
  readonly lines: readonly TextLine[];
};

export function appendText(
  context: TextMeasurer,
  lines: TextLine[],
  text: string,
  x: number,
  top: number,
  width: number,
  size: number,
  weight: number,
  leading = 1.25,
): number {
  context.font = `${weight} ${size}px Arial, Helvetica, sans-serif`;
  context.letterSpacing = "0px";
  const tokens =
    text.match(
      /\p{Script=Han}[，。！？；：、）》」』]*|[^\p{Script=Han}\s]+\s*/gu,
    ) ?? [];
  let line = "";
  let y = top;
  const flush = () => {
    lines.push({ text: line.trim(), x, y, size, weight });
    y += size * leading;
    line = "";
  };
  for (const token of tokens) {
    if (line && context.measureText(line + token).width > width) flush();
    if (context.measureText(token).width > width) {
      for (const char of token) {
        if (line && context.measureText(line + char).width > width) flush();
        line += char;
      }
    } else line += token;
  }
  if (line) flush();
  return y;
}

export function drawAxiomsText(
  context: CanvasRenderingContext2D,
  tile: AxiomsTile,
): void {
  context.textBaseline = "alphabetic";
  context.letterSpacing = "0px";
  for (const line of tile.lines) {
    context.font = `${line.weight} ${line.size}px Arial, Helvetica, sans-serif`;
    context.fillText(line.text, line.x, line.y + line.size);
  }
}
