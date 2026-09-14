export type PerspectiveTimelineEntry = {
  readonly id: string;
  readonly label: string;
  readonly meta: string;
  readonly body: string;
};

export type TimelineViewport = {
  readonly width: number;
  readonly height: number;
};
export type TimelinePanel = PerspectiveTimelineEntry & {
  readonly offset: number;
  readonly height: number;
};

export const timelineConfig = {
  slots: 16,
  rate: 0.7,
  horizon: 0.035,
  slope: 0.62,
  farScale: 0.12,
  exitScale: 1.6,
  initialScale: 0.76,
  depth: 3.65,
  fov: 38,
  cameraZ: 4,
  scrollPerUnit: 1.1,
} as const;

export function timelineGeometry(viewport: TimelineViewport) {
  return {
    width: Math.min(420, viewport.width * 0.3),
    fontSize: 20,
    labelSize: 30,
  };
}

export function clampProgress(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}

export function createTimelinePanels(
  entries: readonly PerspectiveTimelineEntry[],
  viewport: TimelineViewport,
): readonly TimelinePanel[] {
  const geometry = timelineGeometry(viewport);
  const lines = (text: string, fontSize: number) =>
    text
      .split("\n")
      .reduce(
        (total, line) =>
          total +
          Math.max(
            1,
            Math.ceil(
              Array.from(line).reduce(
                (sum, char) => sum + (/[^\x00-\xff]/.test(char) ? 1 : 0.62),
                0,
              ) /
                (geometry.width / fontSize),
            ),
          ) +
          1,
        0,
      );
  let offset = 0;
  return entries.map((entry, index) => {
    const height = Math.max(
      lines(entry.body, geometry.fontSize) * geometry.fontSize * 1.5,
      lines(entry.label, geometry.labelSize) * geometry.labelSize * 1.15 +
        lines(entry.meta, geometry.fontSize) * geometry.fontSize * 1.5 +
        20,
    );
    // A later panel's complete height must fit between its top and the previous
    // panel at every scale. Exponential spacing preserves that gap on reversal.
    if (index > 0)
      offset +=
        Math.log(
          1 +
            (height / Math.max(1, viewport.height) + 0.085) /
              timelineConfig.slope,
        ) / timelineConfig.rate;
    return { ...entry, offset, height };
  });
}

export function timelineTravel(
  progress: number,
  panels: readonly TimelinePanel[],
) {
  const start = Math.log(timelineConfig.initialScale) / timelineConfig.rate;
  const end =
    (panels.at(-1)?.offset ?? 0) +
    Math.log(timelineConfig.exitScale) / timelineConfig.rate;
  return start + clampProgress(progress) * (end - start);
}

export function timelineWindowStart(
  progress: number,
  panels: readonly TimelinePanel[],
) {
  const travel = timelineTravel(progress, panels);
  const exit = Math.log(timelineConfig.exitScale) / timelineConfig.rate;
  const first = panels.findIndex((panel) => travel - panel.offset <= exit);
  return Math.max(
    0,
    Math.min(
      Math.max(0, panels.length - timelineConfig.slots),
      first < 0 ? panels.length - 1 : first,
    ),
  );
}

export function timelinePanelMotion(
  progress: number,
  panel: TimelinePanel,
  panels: readonly TimelinePanel[],
) {
  // Capping invisible near-plane positions prevents overflow for large datasets.
  const scale = Math.exp(
    Math.min(
      8,
      (timelineTravel(progress, panels) - panel.offset) * timelineConfig.rate,
    ),
  );
  const fade = (min: number, max: number) => {
    const p = clampProgress((scale - min) / (max - min));
    return p * p * (3 - 2 * p);
  };
  return {
    scale,
    y: timelineConfig.horizon + timelineConfig.slope * scale,
    opacity:
      fade(timelineConfig.farScale, timelineConfig.farScale + 0.08) *
      (1 - fade(timelineConfig.exitScale - 0.05, timelineConfig.exitScale)),
  };
}

export function timelineLanePosition(
  motion: ReturnType<typeof timelinePanelMotion>,
  side: "left" | "right",
  viewport: TimelineViewport,
): readonly [number, number, number] {
  const depth = timelineConfig.depth / Math.max(0.001, motion.scale);
  const viewHeight = depth * 2 * Math.tan((timelineConfig.fov * Math.PI) / 360);
  const inset = 0.3 - 0.26 * Math.min(1, motion.scale);
  const x =
    ((side === "left" ? -1 : 1) *
      (0.5 -
        inset -
        ((timelineGeometry(viewport).width / viewport.width) * motion.scale) /
          2) *
      viewHeight *
      viewport.width) /
    viewport.height;
  return [x, (0.5 - motion.y) * viewHeight, timelineConfig.cameraZ - depth];
}
