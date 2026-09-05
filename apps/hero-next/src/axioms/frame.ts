import { axiomsReaderConfig } from "./config";
import type { AxiomsLayout, AxiomsRect } from "./layout";

export type AxiomsSheetFrame = {
  readonly rect: AxiomsRect;
  readonly angle: number;
  readonly emphasis: number;
  readonly scroll: number;
  readonly visible: boolean;
};

export type AxiomsFrame = {
  readonly selected: number;
  readonly cursor: number;
  readonly fans: readonly AxiomsSheetFrame[];
  readonly papers: readonly AxiomsSheetFrame[];
};

// Only overflowing text consumes reading distance. Otherwise the entire interval
// drives the next arrival, without a hold or a second easing curve.
export function resolveAxiomsReadingStops(layout: AxiomsLayout) {
  let end = 0;
  const stops = layout.papers.map((_, i) => {
    const arrival = end + (i === 0 ? 0 : 1);
    end = arrival + layout.paperOverflow[i] / layout.viewport.height;
    return { arrival, readEnd: end };
  });
  return stops.map((stop) => ({
    arrival: end > 0 ? stop.arrival / end : 0,
    readEnd: end > 0 ? stop.readEnd / end : 0,
  }));
}

export function resolveAxiomsFrame(
  progress: number,
  layout: AxiomsLayout,
  reducedMotion = false,
): AxiomsFrame {
  const count = layout.papers.length;
  if (count === 0) return { selected: -1, cursor: 0, fans: [], papers: [] };
  const stops = resolveAxiomsReadingStops(layout);
  const phase = clamp(progress);
  const cursor = stops.reduce((value, stop, i) => {
    if (i === 0) return value;
    const start = stops[i - 1].readEnd;
    return value + clamp((phase - start) / (stop.arrival - start));
  }, 0);
  const selected = Math.min(count - 1, Math.round(cursor));
  const visualCursor = reducedMotion ? selected : cursor;
  const spacing = axiomsReaderConfig.fan.angleStep;
  const fans = layout.papers.map((_, i) => {
    const distance = i - visualCursor;
    const angle = distance * spacing;
    const emphasis = 1 - smooth(Math.abs(distance));
    const inactiveScale = axiomsReaderConfig.fan.inactiveScale;
    const scale = inactiveScale + emphasis * (1 - inactiveScale);
    const width = layout.fan.width * scale;
    const height = layout.fan.height * scale;
    return {
      rect: {
        x: layout.fan.x + layout.radius * (Math.cos(angle) - 1),
        y: layout.focusY + layout.radius * Math.sin(angle) - height / 2,
        width,
        height,
      },
      angle,
      emphasis,
      scroll: 0,
      visible: Math.abs(angle) <= axiomsReaderConfig.fan.maxAngle,
    };
  });
  const stack = axiomsReaderConfig.stack;
  const papers = layout.papers.map((rect, i) => {
    // Each paper keeps its resting geometry after arrival, including when covered.
    const arrival = clamp(visualCursor - i + 1);
    const restY =
      layout.paperArea.y +
      (layout.paperArea.height - rect.height) * stack.verticalAlignment;
    const startX = layout.viewport.width + rect.width * stack.entryMargin;
    const startY = restY + layout.paperArea.height * stack.entryDrop;
    const controlX = rect.x + (startX - rect.x) * stack.controlPosition;
    const controlY =
      restY -
      Math.min(
        layout.paperArea.height * stack.arcLift,
        restY - layout.paperArea.y,
      );
    return {
      rect: {
        ...rect,
        x: quadratic(startX, controlX, rect.x, arrival),
        y: quadratic(startY, controlY, restY, arrival),
      },
      angle:
        arrival === 0 || arrival === 1
          ? 0
          : -stack.tilt * Math.sin(Math.PI * arrival),
      visible: arrival > 0,
      emphasis: arrival,
      scroll:
        stops[i].readEnd > stops[i].arrival
          ? clamp(
              (phase - stops[i].arrival) /
                (stops[i].readEnd - stops[i].arrival),
            )
          : 0,
    };
  });
  return { selected, cursor, fans, papers };
}

function quadratic(
  start: number,
  control: number,
  end: number,
  t: number,
): number {
  return (1 - t) ** 2 * start + 2 * (1 - t) * t * control + t ** 2 * end;
}

function clamp(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}

function smooth(value: number): number {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
}
