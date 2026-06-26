import {
  defaultWavesConfig,
  type WavesConfig,
} from "./wavesConfig";
import {
  createWavesNoise,
  perlin2,
  type WavesNoise,
} from "./wavesNoise";

type WavesOptions = {
  readonly lineColor: string;
  readonly opacity: number;
  readonly pointerActive: boolean;
  readonly pointerX: number;
  readonly pointerY: number;
  readonly time: number;
};

export type WavesSurfaceContext = Pick<
  CanvasRenderingContext2D,
  | "beginPath"
  | "clearRect"
  | "globalAlpha"
  | "lineTo"
  | "lineWidth"
  | "moveTo"
  | "restore"
  | "save"
  | "stroke"
  | "strokeStyle"
>;

export type SurfaceWavesState = {
  layoutSignature: string | undefined;
  lines: WavesPoint[][];
  mouse: WavesMouse;
  noise: WavesNoise;
};

type WavesPoint = {
  x: number;
  y: number;
  wave: { x: number; y: number };
  cursor: { x: number; y: number; vx: number; vy: number };
};

type WavesMouse = {
  x: number;
  y: number;
  lx: number;
  ly: number;
  sx: number;
  sy: number;
  v: number;
  vs: number;
  a: number;
  active: boolean;
  set: boolean;
};

type MovedPoint = {
  readonly x: number;
  readonly y: number;
};

export function createSurfaceWavesState(): SurfaceWavesState {
  return {
    layoutSignature: undefined,
    lines: [],
    mouse: {
      x: -10,
      y: 0,
      lx: 0,
      ly: 0,
      sx: 0,
      sy: 0,
      v: 0,
      vs: 0,
      a: 0,
      active: false,
      set: false,
    },
    noise: createWavesNoise(0.42),
  };
}

export function drawReactBitsWavesSurface(
  context: WavesSurfaceContext,
  width: number,
  height: number,
  options: WavesOptions,
  state: SurfaceWavesState,
): void {
  const config = defaultWavesConfig;
  const signature = createLayoutSignature(width, height, config);
  if (state.layoutSignature !== signature) {
    state.lines = createWavesLines(width, height, config);
    state.layoutSignature = signature;
  }

  updateWavesMouse(state.mouse, options, config);
  moveWavesPoints(state.lines, state.mouse, state.noise, options.time, config);
  drawWavesLines(context, width, height, options, state.lines);
}

function createWavesLines(
  width: number,
  height: number,
  config: WavesConfig,
): WavesPoint[][] {
  const lines: WavesPoint[][] = [];
  const outerWidth = width + 200;
  const outerHeight = height + 30;
  const totalLines = Math.ceil(outerWidth / config.xGap);
  const totalPoints = Math.ceil(outerHeight / config.yGap);
  const xStart = (width - config.xGap * totalLines) / 2;
  const yStart = (height - config.yGap * totalPoints) / 2;

  for (let lineIndex = 0; lineIndex <= totalLines; lineIndex += 1) {
    const points: WavesPoint[] = [];
    for (let pointIndex = 0; pointIndex <= totalPoints; pointIndex += 1) {
      points.push({
        x: xStart + config.xGap * lineIndex,
        y: yStart + config.yGap * pointIndex,
        wave: { x: 0, y: 0 },
        cursor: { x: 0, y: 0, vx: 0, vy: 0 },
      });
    }
    lines.push(points);
  }

  return lines;
}

function updateWavesMouse(
  mouse: WavesMouse,
  options: WavesOptions,
  config: WavesConfig,
): void {
  if (options.pointerActive) {
    mouse.x = options.pointerX;
    mouse.y = options.pointerY;
    mouse.active = true;
    if (!mouse.set) {
      mouse.sx = mouse.x;
      mouse.sy = mouse.y;
      mouse.lx = mouse.x;
      mouse.ly = mouse.y;
      mouse.set = true;
    }
  } else {
    mouse.active = false;
  }

  mouse.sx += (mouse.x - mouse.sx) * config.pointerFollow;
  mouse.sy += (mouse.y - mouse.sy) * config.pointerFollow;

  const dx = mouse.x - mouse.lx;
  const dy = mouse.y - mouse.ly;
  const distance = Math.hypot(dx, dy);
  mouse.v = distance;
  mouse.vs += (distance - mouse.vs) * config.velocityFollow;
  mouse.vs = Math.min(100, mouse.vs);
  mouse.lx = mouse.x;
  mouse.ly = mouse.y;
  mouse.a = Math.atan2(dy, dx);
}

function moveWavesPoints(
  lines: WavesPoint[][],
  mouse: WavesMouse,
  noise: WavesNoise,
  time: number,
  config: WavesConfig,
): void {
  for (const points of lines) {
    for (const point of points) {
      const move =
        perlin2(
          noise,
          (point.x + time * config.waveSpeedX) * 0.002,
          (point.y + time * config.waveSpeedY) * 0.0015,
        ) * 12;
      point.wave.x = Math.cos(move) * config.waveAmpX;
      point.wave.y = Math.sin(move) * config.waveAmpY;

      const dx = point.x - mouse.sx;
      const dy = point.y - mouse.sy;
      const distance = Math.hypot(dx, dy);
      const hoverVelocity = mouse.active
        ? Math.max(mouse.vs, config.minHoverVelocity)
        : mouse.vs;
      const radius = Math.max(175, hoverVelocity);
      if (distance < radius) {
        const strength = 1 - distance / radius;
        const force = Math.cos(distance * 0.001) * strength;
        point.cursor.vx +=
          Math.cos(mouse.a) * force * radius * hoverVelocity * config.cursorForce;
        point.cursor.vy +=
          Math.sin(mouse.a) * force * radius * hoverVelocity * config.cursorForce;
      }

      point.cursor.vx += -point.cursor.x * config.tension;
      point.cursor.vy += -point.cursor.y * config.tension;
      point.cursor.vx *= config.friction;
      point.cursor.vy *= config.friction;
      point.cursor.x += point.cursor.vx * config.cursorStep;
      point.cursor.y += point.cursor.vy * config.cursorStep;
      point.cursor.x = clamp(point.cursor.x, -config.maxCursorMove, config.maxCursorMove);
      point.cursor.y = clamp(point.cursor.y, -config.maxCursorMove, config.maxCursorMove);
    }
  }
}

function drawWavesLines(
  context: WavesSurfaceContext,
  width: number,
  height: number,
  options: WavesOptions,
  lines: readonly (readonly WavesPoint[])[],
): void {
  context.clearRect(0, 0, width, height);
  context.save();
  context.globalAlpha = options.opacity;
  context.strokeStyle = options.lineColor;
  context.lineWidth = Math.max(1, Math.min(width, height) * 0.006);
  context.beginPath();

  for (const points of lines) {
    const first = points[0];
    if (!first) {
      continue;
    }

    const start = moved(first, false);
    context.moveTo(start.x, start.y);
    for (let index = 0; index < points.length; index += 1) {
      const current = points[index];
      if (!current) {
        continue;
      }

      const isLast = index === points.length - 1;
      const point = moved(current, !isLast);
      const next = moved(points[index + 1] ?? current, !isLast);
      context.lineTo(point.x, point.y);
      if (isLast) {
        context.moveTo(next.x, next.y);
      }
    }
  }

  context.stroke();
  context.restore();
}

function moved(point: WavesPoint, withCursor: boolean): MovedPoint {
  const x = point.x + point.wave.x + (withCursor ? point.cursor.x : 0);
  const y = point.y + point.wave.y + (withCursor ? point.cursor.y : 0);
  return {
    x: Math.round(x * 10) / 10,
    y: Math.round(y * 10) / 10,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function createLayoutSignature(
  width: number,
  height: number,
  config: WavesConfig,
): string {
  return [width, height, config.xGap, config.yGap].join(":");
}
