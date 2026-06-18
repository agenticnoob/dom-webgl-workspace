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

export type LayoutPass = {
  measure(targets: readonly LayoutTarget[]): Map<string, ElementMeasurement>;
};

export function createLayoutPass(options: {
  measureElement(element: HTMLElement): ElementMeasurement;
}): LayoutPass {
  return {
    measure(targets): Map<string, ElementMeasurement> {
      const measurements = new Map<string, ElementMeasurement>();

      for (const target of targets) {
        if (!target.active) {
          continue;
        }

        measurements.set(target.key, options.measureElement(target.element));
      }

      return measurements;
    },
  };
}
