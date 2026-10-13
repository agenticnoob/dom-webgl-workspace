import type {
  DOMTextGlyph as WebGLTextGlyph,
  DOMTextGlyphCommand as WebGLTextGlyphRenderCommand,
} from "@viselora/dom-webgl";
import { clampNumber } from "./effectMath";
import type { TargetLocalPointer } from "./surfacePointer";
type TextFocusPoint = { x: number; y: number };
export type TextMode =
  | "wave"
  | "reveal"
  | "spotlight"
  | "pressure"
  | "scramble"
  | "combo"
  | "pinned";
export type TextOptions = {
  color?: string;
  amplitude?: number;
  radius?: number;
  speed?: number;
  scrambleChars?: string;
  baseColor?: string;
  spotlightColor?: string;
  progressKey?: string;
};

export function createTextGlyphCommands(
  mode: TextMode,
  glyphs: readonly WebGLTextGlyph[],
  input: {
    time: number;
    width: number;
    height: number;
    progress: number;
    pointer: TargetLocalPointer;
  },
  options: TextOptions = {},
): WebGLTextGlyphRenderCommand[] {
  const { time, pointer } = input;
  const radius = clampNumber(
    options.radius,
    48,
    420,
    mode === "scramble" ? 148 : 180,
  );
  const focus = {
    x: pointer.active
      ? pointer.x
      : input.width * (0.16 + (0.5 + Math.sin(time / 760) * 0.5) * 0.68),
    y: pointer.active ? pointer.y : input.height * 0.5,
  };
  const speed = clampNumber(options.speed, 0.1, 2, 0.45);
  const scrambleChars = Array.from(options.scrambleChars || ".:");
  switch (mode) {
    case "wave":
      return createWaveGlyphCommands(glyphs, {
        amplitude: clampNumber(options.amplitude, 0, 24, 6),
        color: options.color ?? "#1d2a2e",
        phase: time / 450,
      });
    case "reveal":
    case "pinned": {
      const count = Math.ceil(
        glyphs.length * clampNumber(input.progress, 0, 1, 0),
      );
      return glyphs.map((glyph) => ({
        index: glyph.index,
        char: glyph.char,
        opacity: glyph.index < count ? 1 : mode === "pinned" ? 0.32 : 0.18,
        scaleX: glyph.index < count ? 1 : mode === "pinned" ? 0.78 : 0.82,
        scaleY: glyph.index < count ? 1 : mode === "pinned" ? 0.78 : 0.82,
        color: options.color ?? "#f6c453",
      }));
    }
    case "spotlight":
      return createSpotlightGlyphCommands(glyphs, {
        baseColor: "#1d2a2e",
        focus: {
          x: pointer.active
            ? pointer.x
            : input.width * (0.2 + (0.5 + Math.sin(time / 700) * 0.5) * 0.6),
          y: focus.y,
        },
        highlightColor: options.color ?? "#f6c453",
        opacityBase: 0.28,
        opacityRange: 0.72,
        radius,
        scaleBase: 0.92,
        scaleRange: 0.2,
        threshold: 0.28,
      });
    case "pressure":
      return pointer.active
        ? createPressureGlyphCommands(glyphs, {
            color: options.color ?? "#f4f4f5",
            pressureX: pointer.x,
            pressureY: pointer.y,
            radius,
          })
        : createPositionedGlyphCommands(glyphs, options.color ?? "#f4f4f5");
    case "scramble":
      return createScrambleGlyphCommands(glyphs, {
        color: options.color ?? "#172124",
        focus,
        opacityBase: 0.52,
        opacityRange: 0.48,
        radius,
        scaleBase: 0.94,
        scaleRange: 0.1,
        scrambleChars,
        speed,
        threshold: 0.08,
        time,
      });
    case "combo": {
      const baseColor = options.baseColor ?? "#f4f4f5";
      const commands = pointer.active
        ? createPressureGlyphCommands(glyphs, {
            color: baseColor,
            pressureX: focus.x,
            pressureY: focus.y,
            radius,
          })
        : createPositionedGlyphCommands(glyphs, baseColor);
      const lookup = new Map(glyphs.map((glyph) => [glyph.index, glyph]));
      return commands.map((command) => {
        const glyph = lookup.get(command.index);
        const lit = applySpotlightToCommand(command, glyph, {
          baseColor,
          focus,
          highlightColor: options.spotlightColor ?? "#f6c453",
          opacityBase: 0.46,
          opacityRange: 0.62,
          radius,
          scaleBase: 1,
          scaleRange: 0.12,
          threshold: 0.24,
        });
        const scrambled = applyScrambleToCommand(lit, glyph, {
          color: lit.color ?? baseColor,
          focus,
          opacityBase: lit.opacity ?? 1,
          opacityRange: 0,
          radius,
          scaleBase: 1,
          scaleRange: 0,
          scrambleChars: Array.from(options.scrambleChars || "01"),
          speed,
          threshold: 0.1,
          time,
        });
        return applyWaveToCommand(scrambled, glyph, {
          amplitude: clampNumber(options.amplitude, 0, 24, 8),
          color: scrambled.color,
          phase: time / 450,
        });
      });
    }
  }
}

function createPressureGlyphCommands(
  glyphs: readonly WebGLTextGlyph[],
  input: {
    color: string;
    pressureX: number;
    pressureY: number;
    radius: number;
  },
): WebGLTextGlyphRenderCommand[] {
  const commands: WebGLTextGlyphRenderCommand[] = [];
  const lines = new Map<number, WebGLTextGlyph[]>();

  for (const glyph of glyphs) {
    const line = lines.get(glyph.line) ?? [];
    line.push(glyph);
    lines.set(glyph.line, line);
  }

  for (const lineGlyphs of lines.values()) {
    commands.push(...createPressureLineCommands(lineGlyphs, input));
  }

  return commands.sort((a, b) => a.index - b.index);
}

function createPressureLineCommands(
  glyphs: readonly WebGLTextGlyph[],
  input: {
    color: string;
    pressureX: number;
    pressureY: number;
    radius: number;
  },
): WebGLTextGlyphRenderCommand[] {
  const sortedGlyphs = [...glyphs].sort((a, b) => a.x - b.x);
  const initialPressureGlyphs = sortedGlyphs.map((glyph, index) => {
    const centerX = glyph.x + glyph.width * 0.5;
    const centerY = glyph.y + glyph.height * 0.5;
    const distance = Math.hypot(
      centerX - input.pressureX,
      centerY - input.pressureY,
    );
    const intensity = Math.max(0, 1 - distance / input.radius);
    const scaleX = 1 + intensity * 0.88;
    const scaleY = 1 + intensity * 0.16;
    const nextGlyph = sortedGlyphs[index + 1];
    const gap = nextGlyph
      ? Math.max(0, nextGlyph.x - (glyph.x + glyph.width))
      : 0;

    return {
      glyph,
      scaledWidth: glyph.width * scaleX,
      scaleX,
      scaleY,
      gap,
    };
  });

  const lineStart = sortedGlyphs[0]?.x ?? 0;
  const lineEnd = sortedGlyphs.reduce(
    (maxX, glyph) => Math.max(maxX, glyph.x + glyph.width),
    lineStart,
  );
  const lineCenter = lineStart + (lineEnd - lineStart) * 0.5;
  const originalGlyphWidth = sortedGlyphs.reduce(
    (total, glyph) => total + glyph.width,
    0,
  );
  const expandedGlyphWidth = initialPressureGlyphs.reduce(
    (total, item) => total + item.scaledWidth,
    0,
  );
  const expansion = Math.max(0, expandedGlyphWidth - originalGlyphWidth);
  const compressibleWidth = initialPressureGlyphs.reduce((total, item) => {
    if (item.scaleX > 1.02) {
      return total;
    }

    return total + item.glyph.width;
  }, 0);
  const compressionScale =
    compressibleWidth > 0
      ? Math.max(0.84, 1 - expansion / compressibleWidth)
      : 1;
  const pressureGlyphs = initialPressureGlyphs.map((item) => {
    if (item.scaleX > 1.02) {
      return item;
    }

    const scaleX = Math.min(item.scaleX, compressionScale);

    return {
      ...item,
      scaledWidth: item.glyph.width * scaleX,
      scaleX,
    };
  });
  const scaledLineWidth = pressureGlyphs.reduce(
    (total, item) => total + item.scaledWidth + item.gap,
    0,
  );
  const centeredStart = lineCenter - scaledLineWidth * 0.5;
  let x = Math.max(lineStart - sortedGlyphs[0]!.width * 0.12, centeredStart);

  return pressureGlyphs.map((item) => {
    const command = {
      index: item.glyph.index,
      char: item.glyph.char,
      x,
      y: item.glyph.y,
      color: input.color,
      opacity: 1,
      scaleX: item.scaleX,
      scaleY: item.scaleY,
    } satisfies WebGLTextGlyphRenderCommand;

    x += item.scaledWidth + item.gap;

    return command;
  });
}

function createWaveGlyphCommands(
  glyphs: readonly WebGLTextGlyph[],
  input: {
    amplitude: number;
    color?: string;
    phase: number;
  },
): WebGLTextGlyphRenderCommand[] {
  return glyphs.map((glyph) =>
    applyWaveToCommand(
      {
        index: glyph.index,
        char: glyph.char,
      },
      glyph,
      input,
    ),
  );
}

function applyWaveToCommand(
  command: WebGLTextGlyphRenderCommand,
  glyph: WebGLTextGlyph | undefined,
  input: {
    amplitude: number;
    color?: string;
    phase: number;
  },
): WebGLTextGlyphRenderCommand {
  return {
    ...command,
    y:
      (command.y ?? glyph?.y ?? 0) +
      Math.sin(input.phase + command.index * 0.42) * input.amplitude,
    color: input.color ?? command.color,
  };
}

function createSpotlightGlyphCommands(
  glyphs: readonly WebGLTextGlyph[],
  input: {
    baseColor: string;
    focus: TextFocusPoint;
    highlightColor: string;
    opacityBase: number;
    opacityRange: number;
    radius: number;
    scaleBase: number;
    scaleRange: number;
    threshold: number;
  },
): WebGLTextGlyphRenderCommand[] {
  return glyphs.map((glyph) =>
    applySpotlightToCommand(
      {
        index: glyph.index,
        char: glyph.char,
      },
      glyph,
      input,
    ),
  );
}

function applySpotlightToCommand(
  command: WebGLTextGlyphRenderCommand,
  glyph: WebGLTextGlyph | undefined,
  input: {
    baseColor: string;
    focus: TextFocusPoint;
    highlightColor: string;
    opacityBase: number;
    opacityRange: number;
    radius: number;
    scaleBase: number;
    scaleRange: number;
    threshold: number;
  },
): WebGLTextGlyphRenderCommand {
  const intensity = readFocusIntensity(
    command,
    glyph,
    input.focus,
    input.radius,
  );
  const scale = input.scaleBase + intensity * input.scaleRange;

  return {
    ...command,
    color: intensity > input.threshold ? input.highlightColor : input.baseColor,
    opacity: Math.min(1, input.opacityBase + intensity * input.opacityRange),
    scaleX: (command.scaleX ?? 1) * scale,
    scaleY: (command.scaleY ?? 1) * scale,
  };
}

function createScrambleGlyphCommands(
  glyphs: readonly WebGLTextGlyph[],
  input: {
    color: string;
    focus: TextFocusPoint;
    opacityBase: number;
    opacityRange: number;
    radius: number;
    scaleBase: number;
    scaleRange: number;
    scrambleChars: readonly string[];
    speed: number;
    threshold: number;
    time: number;
  },
): WebGLTextGlyphRenderCommand[] {
  return glyphs.map((glyph) =>
    applyScrambleToCommand(
      {
        index: glyph.index,
        char: glyph.char,
      },
      glyph,
      input,
    ),
  );
}

function applyScrambleToCommand(
  command: WebGLTextGlyphRenderCommand,
  glyph: WebGLTextGlyph | undefined,
  input: {
    color: string;
    focus: TextFocusPoint;
    opacityBase: number;
    opacityRange: number;
    radius: number;
    scaleBase: number;
    scaleRange: number;
    scrambleChars: readonly string[];
    speed: number;
    threshold: number;
    time: number;
  },
): WebGLTextGlyphRenderCommand {
  const intensity = readFocusIntensity(
    command,
    glyph,
    input.focus,
    input.radius,
  );
  const scrambleIndex =
    Math.abs(
      Math.floor(
        input.time * input.speed * 0.08 + command.index * 17 + intensity * 11,
      ),
    ) % input.scrambleChars.length;

  return {
    ...command,
    char:
      intensity > input.threshold
        ? input.scrambleChars[scrambleIndex]
        : command.char,
    color: input.color,
    opacity: Math.min(1, input.opacityBase + intensity * input.opacityRange),
    scaleX:
      (command.scaleX ?? 1) * (input.scaleBase + intensity * input.scaleRange),
    scaleY:
      (command.scaleY ?? 1) * (input.scaleBase + intensity * input.scaleRange),
  };
}

function createPositionedGlyphCommands(
  glyphs: readonly WebGLTextGlyph[],
  color: string,
): WebGLTextGlyphRenderCommand[] {
  return glyphs.map((glyph) => ({
    index: glyph.index,
    char: glyph.char,
    x: glyph.x,
    y: glyph.y,
    color,
    opacity: 1,
    scaleX: 1,
    scaleY: 1,
  }));
}

function readFocusIntensity(
  command: WebGLTextGlyphRenderCommand,
  glyph: WebGLTextGlyph | undefined,
  focus: TextFocusPoint,
  radius: number,
): number {
  const center = readCommandCenter(command, glyph);
  const distance = Math.hypot(center.x - focus.x, center.y - focus.y);
  return Math.max(0, 1 - distance / radius);
}

function readCommandCenter(
  command: WebGLTextGlyphRenderCommand,
  glyph: WebGLTextGlyph | undefined,
): TextFocusPoint {
  return {
    x:
      (command.x ?? glyph?.x ?? 0) +
      (glyph?.width ?? 0) * (command.scaleX ?? 1) * 0.5,
    y:
      (command.y ?? glyph?.y ?? 0) +
      (glyph?.height ?? 0) * (command.scaleY ?? 1) * 0.5,
  };
}
