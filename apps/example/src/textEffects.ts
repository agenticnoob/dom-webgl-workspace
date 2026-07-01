import {
  defineWebGLEffect,
  type WebGLTextGlyph,
  type WebGLTextGlyphRenderCommand,
} from "@project/dom-webgl-runtime";

import { clampNumber, readTargetViewportProgress } from "./effectMath";
import { readTargetLocalPointer } from "./surfacePointer";

type TextWaveParams = {
  kind: "example.textWave";
  amplitude?: number;
};

type TextRevealParams = {
  kind: "example.textReveal";
  color?: string;
  progressKey?: string;
};

type TextSpotlightParams = {
  kind: "example.textSpotlight";
  color?: string;
  radius?: number;
};

type TextPressureParams = {
  kind: "example.textPressure";
  color?: string;
  radius?: number;
};

type TextScrambleParams = {
  kind: "example.textScramble";
  color?: string;
  scrambleChars?: string;
  radius?: number;
  speed?: number;
};

type TextSpotlightPressureScrambleWaveParams = {
  kind: "example.textSpotlightPressureScrambleWave";
  baseColor?: string;
  spotlightColor?: string;
  scrambleChars?: string;
  radius?: number;
  amplitude?: number;
  speed?: number;
};

type TextFocusPoint = {
  x: number;
  y: number;
};

export const exampleTextWaveEffect = defineWebGLEffect<TextWaveParams>({
  kind: "example.textWave",
  source: "dom/text",
  update(ctx, _state, params) {
    if (ctx.source.kind !== "dom" || ctx.source.type !== "text") {
      return;
    }

    const amplitude = clampNumber(params.amplitude, 0, 24, 6);
    const phase = ctx.time / 450;
    ctx.source.textLayer?.setGlyphs((glyphs) =>
      createWaveGlyphCommands(glyphs, {
        amplitude,
        color: "#1d2a2e",
        phase,
      }),
    );
  },
});

export const exampleTextRevealEffect = defineWebGLEffect<TextRevealParams>({
  kind: "example.textReveal",
  source: "dom/text",
  update(ctx, _state, params) {
    if (ctx.source.kind !== "dom" || ctx.source.type !== "text") {
      return;
    }

    const progress = params.progressKey
      ? clampNumber(ctx.progress.get(params.progressKey), 0, 1, 0)
      : Math.max(
        clampNumber(ctx.scrollProgress, 0, 1, 0),
        readTargetViewportProgress(ctx.layout),
      );
    const color = params.color ?? "#f6c453";

    ctx.source.textLayer?.setGlyphs((glyphs) => {
      const visibleCount = Math.ceil(glyphs.length * progress);

      return glyphs.map((glyph) => ({
        index: glyph.index,
        char: glyph.char,
        opacity: glyph.index < visibleCount ? 1 : 0.18,
        scaleX: glyph.index < visibleCount ? 1 : 0.82,
        scaleY: glyph.index < visibleCount ? 1 : 0.82,
        color,
      }));
    });
  },
});

export const exampleTextSpotlightEffect = defineWebGLEffect<TextSpotlightParams>({
  kind: "example.textSpotlight",
  source: "dom/text",
  update(ctx, _state, params) {
    if (ctx.source.kind !== "dom" || ctx.source.type !== "text") {
      return;
    }

    const pointer = readTargetLocalPointer({
      layout: ctx.layout,
      pointer: ctx.targetPointer,
    });
    const radius = clampNumber(params.radius, 48, 360, 180);
    const phase = 0.5 + Math.sin(ctx.time / 700) * 0.5;
    const fallbackX = ctx.layout.width * (0.2 + phase * 0.6);
    const fallbackY = ctx.layout.height * 0.5;
    const spotlightX = pointer.active ? pointer.x : fallbackX;
    const spotlightY = pointer.active ? pointer.y : fallbackY;
    const highlightColor = params.color ?? "#f6c453";

    ctx.source.textLayer?.setGlyphs((glyphs) =>
      createSpotlightGlyphCommands(glyphs, {
        baseColor: "#1d2a2e",
        focus: { x: spotlightX, y: spotlightY },
        highlightColor,
        opacityBase: 0.28,
        opacityRange: 0.72,
        radius,
        scaleBase: 0.92,
        scaleRange: 0.2,
        threshold: 0.28,
      }),
    );
  },
});

export const exampleTextPressureEffect = defineWebGLEffect<TextPressureParams>({
  kind: "example.textPressure",
  source: "dom/text",
  update(ctx, _state, params) {
    if (ctx.source.kind !== "dom" || ctx.source.type !== "text") {
      return;
    }

    const pointer = readTargetLocalPointer({
      layout: ctx.layout,
      pointer: ctx.targetPointer,
    });
    const color = params.color ?? "#f4f4f5";

    if (!pointer.active) {
      ctx.source.textLayer?.setGlyphs((glyphs) =>
        glyphs.map((glyph) => ({
          index: glyph.index,
          char: glyph.char,
          color,
          opacity: 1,
          scaleX: 1,
          scaleY: 1,
        })),
      );
      return;
    }

    const radius = clampNumber(params.radius, 64, 420, 180);
    const pressureX = pointer.x;
    const pressureY = pointer.y;

    ctx.source.textLayer?.setGlyphs((glyphs) =>
      createPressureGlyphCommands(glyphs, {
        color,
        pressureX,
        pressureY,
        radius,
      }),
    );
  },
});

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
    const distance = Math.hypot(centerX - input.pressureX, centerY - input.pressureY);
    const intensity = Math.max(0, 1 - distance / input.radius);
    const scaleX = 1 + intensity * 0.88;
    const scaleY = 1 + intensity * 0.16;
    const nextGlyph = sortedGlyphs[index + 1];
    const gap = nextGlyph ? Math.max(0, nextGlyph.x - (glyph.x + glyph.width)) : 0;

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
  const originalGlyphWidth = sortedGlyphs.reduce((total, glyph) => total + glyph.width, 0);
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
  const compressionScale = compressibleWidth > 0
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

export const exampleTextScrambleEffect = defineWebGLEffect<TextScrambleParams>({
  kind: "example.textScramble",
  source: "dom/text",
  update(ctx, _state, params) {
    if (ctx.source.kind !== "dom" || ctx.source.type !== "text") {
      return;
    }

    const pointer = readTargetLocalPointer({
      layout: ctx.layout,
      pointer: ctx.targetPointer,
    });
    const radius = clampNumber(params.radius, 48, 360, 148);
    const speed = clampNumber(params.speed, 0.1, 2, 0.45);
    const scrambleChars = params.scrambleChars && params.scrambleChars.length > 0
      ? Array.from(params.scrambleChars)
      : [".", ":"];
    const color = params.color ?? "#172124";
    const phase = 0.5 + Math.sin(ctx.time / 760) * 0.5;
    const scrambleX = pointer.active ? pointer.x : ctx.layout.width * (0.16 + phase * 0.68);
    const scrambleY = pointer.active ? pointer.y : ctx.layout.height * 0.5;

    ctx.source.textLayer?.setGlyphs((glyphs) =>
      createScrambleGlyphCommands(glyphs, {
        color,
        focus: { x: scrambleX, y: scrambleY },
        opacityBase: 0.52,
        opacityRange: 0.48,
        radius,
        scaleBase: 0.94,
        scaleRange: 0.1,
        scrambleChars,
        speed,
        threshold: 0.08,
        time: ctx.time,
      }),
    );
  },
});

export const exampleTextSpotlightPressureScrambleWaveEffect =
  defineWebGLEffect<TextSpotlightPressureScrambleWaveParams>({
    kind: "example.textSpotlightPressureScrambleWave",
    source: "dom/text",
    update(ctx, _state, params) {
      if (ctx.source.kind !== "dom" || ctx.source.type !== "text") {
        return;
      }

      const pointer = readTargetLocalPointer({
        layout: ctx.layout,
        pointer: ctx.targetPointer,
      });
      const radius = clampNumber(params.radius, 64, 420, 190);
      const amplitude = clampNumber(params.amplitude, 0, 24, 8);
      const speed = clampNumber(params.speed, 0.1, 2, 0.42);
      const baseColor = params.baseColor ?? "#f4f4f5";
      const spotlightColor = params.spotlightColor ?? "#f6c453";
      const scrambleChars = params.scrambleChars && params.scrambleChars.length > 0
        ? Array.from(params.scrambleChars)
        : ["0", "1"];
      const phase = 0.5 + Math.sin(ctx.time / 760) * 0.5;
      const focusX = pointer.active ? pointer.x : ctx.layout.width * (0.16 + phase * 0.68);
      const focusY = pointer.active ? pointer.y : ctx.layout.height * 0.5;
      const wavePhase = ctx.time / 450;

      ctx.source.textLayer?.setGlyphs((glyphs) => {
        const pressureCommands = pointer.active
          ? createPressureGlyphCommands(glyphs, {
            color: baseColor,
            pressureX: focusX,
            pressureY: focusY,
            radius,
          })
          : createPositionedGlyphCommands(glyphs, baseColor);
        const glyphByIndex = new Map(glyphs.map((glyph) => [glyph.index, glyph]));

        const spotlightCommands = pressureCommands.map((command) => {
          const glyph = glyphByIndex.get(command.index);
          return applySpotlightToCommand(command, glyph, {
            baseColor,
            focus: { x: focusX, y: focusY },
            highlightColor: spotlightColor,
            opacityBase: 0.46,
            opacityRange: 0.62,
            radius,
            scaleBase: 1,
            scaleRange: 0.12,
            threshold: 0.24,
          });
        });

        const scrambleCommands = spotlightCommands.map((command) => {
          const glyph = glyphByIndex.get(command.index);
          return applyScrambleToCommand(command, glyph, {
            color: command.color ?? baseColor,
            focus: { x: focusX, y: focusY },
            opacityBase: command.opacity ?? 1,
            opacityRange: 0,
            radius,
            scaleBase: 1,
            scaleRange: 0,
            scrambleChars,
            speed,
            threshold: 0.1,
            time: ctx.time,
          });
        });

        return scrambleCommands.map((command) => {
          const glyph = glyphByIndex.get(command.index);
          return applyWaveToCommand(command, glyph, {
            amplitude,
            color: command.color,
            phase: wavePhase,
          });
        });
      });
    },
  });

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
    y: (command.y ?? glyph?.y ?? 0) +
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
  const intensity = readFocusIntensity(command, glyph, input.focus, input.radius);
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
  const intensity = readFocusIntensity(command, glyph, input.focus, input.radius);
  const scrambleIndex = Math.abs(
    Math.floor(input.time * input.speed * 0.08 + command.index * 17 + intensity * 11),
  ) % input.scrambleChars.length;

  return {
    ...command,
    char: intensity > input.threshold ? input.scrambleChars[scrambleIndex] : command.char,
    color: input.color,
    opacity: Math.min(1, input.opacityBase + intensity * input.opacityRange),
    scaleX: (command.scaleX ?? 1) * (input.scaleBase + intensity * input.scaleRange),
    scaleY: (command.scaleY ?? 1) * (input.scaleBase + intensity * input.scaleRange),
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
    x: (command.x ?? glyph?.x ?? 0) +
      (glyph?.width ?? 0) * (command.scaleX ?? 1) * 0.5,
    y: (command.y ?? glyph?.y ?? 0) +
      (glyph?.height ?? 0) * (command.scaleY ?? 1) * 0.5,
  };
}
