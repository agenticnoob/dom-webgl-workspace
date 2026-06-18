import type { DOMStyleSnapshot } from "../dom/styleSnapshot";
import type { DOMViewportSize } from "./domProjection";

export type LayoutTarget = {
  key: string;
  element: HTMLElement;
  active: boolean;
};

export type ElementMeasurement = {
  x: number;
  y: number;
  width: number;
  height: number;
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type ElementLayoutSnapshot = ElementMeasurement & {
  viewport: DOMViewportSize;
  devicePixelRatio: number;
  layoutSignature: string;
};

export type ElementRasterSnapshot = {
  style: DOMStyleSnapshot;
  rasterSignature: string;
};

export type LayoutPass = {
  measure(targets: readonly LayoutTarget[]): Map<string, ElementLayoutSnapshot>;
};

export function createLayoutPass(options: {
  measureElement(element: HTMLElement): ElementMeasurement;
  getViewportSize?(): DOMViewportSize;
  getDevicePixelRatio?(): number;
}): LayoutPass {
  return {
    measure(targets): Map<string, ElementLayoutSnapshot> {
      const measurements = new Map<string, ElementLayoutSnapshot>();
      const viewport = options.getViewportSize?.() ?? readViewportSize();
      const devicePixelRatio = capDevicePixelRatio(
        options.getDevicePixelRatio?.() ?? globalThis.window?.devicePixelRatio ?? 1,
      );

      for (const target of targets) {
        if (!target.active) {
          continue;
        }

        const measurement = options.measureElement(target.element);
        const snapshot: ElementLayoutSnapshot = {
          x: measurement.x,
          y: measurement.y,
          width: measurement.width,
          height: measurement.height,
          top: measurement.top,
          right: measurement.right,
          bottom: measurement.bottom,
          left: measurement.left,
          viewport,
          devicePixelRatio,
          layoutSignature: createLayoutSignature(
            measurement,
            viewport,
            devicePixelRatio,
          ),
        };

        measurements.set(target.key, snapshot);
      }

      return measurements;
    },
  };
}

export function capDevicePixelRatio(devicePixelRatio: number): number {
  if (!Number.isFinite(devicePixelRatio) || devicePixelRatio <= 0) {
    return 1;
  }

  return Math.min(devicePixelRatio, 1.5);
}

function readViewportSize(): DOMViewportSize {
  return {
    width: globalThis.window?.innerWidth || 800,
    height: globalThis.window?.innerHeight || 600,
  };
}

function createLayoutSignature(
  measurement: ElementMeasurement,
  viewport: DOMViewportSize,
  devicePixelRatio: number,
): string {
  return JSON.stringify([
    measurement.left,
    measurement.top,
    measurement.width,
    measurement.height,
    viewport.width,
    viewport.height,
    devicePixelRatio,
  ]);
}
