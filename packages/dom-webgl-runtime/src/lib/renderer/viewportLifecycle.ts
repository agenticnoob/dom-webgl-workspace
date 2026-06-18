import type { ElementMeasurement } from "./layoutPass";

export type ViewportLifecycleState =
  | "active"
  | "mounted"
  | "preloading"
  | "disposed";

export type ViewportLifecycleOptions = {
  viewportHeight: number;
  activeMargin: `${number}vh`;
  preloadMargin: `${number}vh`;
  mountMargin: `${number}vh`;
  unloadMargin: `${number}vh`;
};

export type ViewportLifecycle = {
  classify(rect: ElementMeasurement): ViewportLifecycleState;
};

export function createViewportLifecycle(
  options: ViewportLifecycleOptions,
): ViewportLifecycle {
  const activeMargin = vhToPixels(options.activeMargin, options.viewportHeight);
  const preloadMargin = vhToPixels(options.preloadMargin, options.viewportHeight);
  const mountMargin = vhToPixels(options.mountMargin, options.viewportHeight);
  const unloadMargin = vhToPixels(options.unloadMargin, options.viewportHeight);

  return {
    classify(rect): ViewportLifecycleState {
      const distance = readViewportDistance(rect, options.viewportHeight);

      if (distance <= activeMargin) {
        return "active";
      }

      if (distance <= preloadMargin) {
        return "preloading";
      }

      if (distance <= mountMargin) {
        return "mounted";
      }

      if (distance <= unloadMargin) {
        return "mounted";
      }

      return "disposed";
    },
  };
}

function readViewportDistance(
  rect: ElementMeasurement,
  viewportHeight: number,
): number {
  if (rect.bottom < 0) {
    return Math.abs(rect.bottom);
  }

  if (rect.top > viewportHeight) {
    return rect.top - viewportHeight;
  }

  return 0;
}

function vhToPixels(value: `${number}vh`, viewportHeight: number): number {
  return (Number.parseFloat(value) / 100) * viewportHeight;
}
