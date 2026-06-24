import type { ElementMeasurement } from "./layoutPass";

export type ViewportLifecycleState =
  | "active"
  | "mounted"
  | "preloading"
  | "disposed";

// Margin configuration captured at creation time.
// viewportHeight is provided at classify() time so the same lifecycle
// instance works across window resize without recreating the object.
export type ViewportLifecycleMarginOptions = {
  activeMargin: `${number}vh`;
  preloadMargin: `${number}vh`;
  mountMargin: `${number}vh`;
  unloadMargin: `${number}vh`;
};

// Future: expose partial overrides through WebGLRuntimeOptions
// e.g. runtime-level: createWebGLRuntime({ viewportLifecycle: { activeMargin: "30vh" } })
// e.g. per-target:    <WebGLTarget webgl={{ lifecycle: { activeMargin: "20vh" } }} />
const DEFAULT_MARGINS = {
  activeMargin: "50vh",
  preloadMargin: "150vh",
  mountMargin: "100vh",
  unloadMargin: "250vh",
} satisfies ViewportLifecycleMarginOptions;

export type ViewportLifecycle = {
  classify(rect: ElementMeasurement, viewportHeight: number): ViewportLifecycleState;
};

export function createViewportLifecycle(
  options: ViewportLifecycleMarginOptions = DEFAULT_MARGINS,
): ViewportLifecycle {
  return {
    classify(rect, viewportHeight): ViewportLifecycleState {
      const activeMargin = vhToPixels(options.activeMargin, viewportHeight);
      const preloadMargin = vhToPixels(options.preloadMargin, viewportHeight);
      const mountMargin = vhToPixels(options.mountMargin, viewportHeight);
      const unloadMargin = vhToPixels(options.unloadMargin, viewportHeight);
      const distance = readViewportDistance(rect, viewportHeight);

      if (distance <= activeMargin) {
        return "active";
      }

      if (distance <= mountMargin) {
        return "mounted";
      }

      if (distance <= preloadMargin) {
        return "preloading";
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
