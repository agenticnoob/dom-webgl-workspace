import type { WebGLFrameInput } from "../types";
import type { ScrollStateController } from "./frameInput";

export type PageScrollMetrics = {
  scrollY: number;
  scrollHeight: number;
  viewportHeight: number;
};

export type PageScrollStateController = ScrollStateController;

export function createPageScrollState(
  getScrollMetrics: () => PageScrollMetrics,
): PageScrollStateController {
  const initialMetrics = getScrollMetrics();
  let previousScrollY = initialMetrics.scrollY;
  let state = createPageScrollFrameState(initialMetrics, 0);

  return {
    getState(): WebGLFrameInput["scroll"] {
      return state;
    },
    update(): WebGLFrameInput["scroll"] {
      const metrics = getScrollMetrics();
      const deltaY = metrics.scrollY - previousScrollY;

      previousScrollY = metrics.scrollY;
      state = createPageScrollFrameState(metrics, deltaY);

      return state;
    },
  };
}

export function createPageScrollFrameState(
  metrics: PageScrollMetrics,
  deltaY: number,
): WebGLFrameInput["scroll"] {
  return {
    mode: "page",
    pageProgress: calculatePageProgress(metrics),
    direction: readDirection(deltaY),
    velocity: deltaY,
  };
}

function calculatePageProgress(metrics: PageScrollMetrics): number {
  const maxScrollY = metrics.scrollHeight - metrics.viewportHeight;

  if (maxScrollY <= 0) {
    return 0;
  }

  return clamp(metrics.scrollY / maxScrollY, 0, 1);
}

function readDirection(deltaY: number): -1 | 0 | 1 {
  if (deltaY > 0) {
    return 1;
  }

  if (deltaY < 0) {
    return -1;
  }

  return 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
