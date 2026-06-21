import type {
  WebGLScrollAdapter,
  WebGLScrollMetrics,
} from "@project/dom-webgl-runtime";

export type LenisLike = {
  readonly scroll?: number;
  readonly animatedScroll?: number;
  readonly actualScroll?: number;
  readonly limit?: number;
  on?(event: "scroll", listener: () => void): void | (() => void);
  destroy?(): void;
};

export type LenisScrollAdapterOptions = {
  getViewportHeight?: () => number;
  getScrollHeight?: () => number;
  manageInstance?: boolean;
};

export function createLenisScrollAdapter(
  lenis: LenisLike,
  options: LenisScrollAdapterOptions = {},
): WebGLScrollAdapter {
  const ownedUnsubscribes = new Set<() => void>();

  return {
    kind: "lenis",
    readMetrics(): WebGLScrollMetrics {
      const viewportHeight = readViewportHeight(options);
      const scrollY = readFirstFiniteNumber(
        lenis.scroll,
        lenis.animatedScroll,
        lenis.actualScroll,
        0,
      );
      const scrollHeight =
        options.getScrollHeight?.() ??
        readFirstFiniteNumber(lenis.limit, 0) + viewportHeight;

      return {
        scrollY,
        scrollHeight,
        viewportHeight,
      };
    },
    subscribe(listener) {
      const unsubscribe = lenis.on?.("scroll", listener);

      if (typeof unsubscribe !== "function") {
        return () => {};
      }

      ownedUnsubscribes.add(unsubscribe);

      return () => {
        unsubscribe();
        ownedUnsubscribes.delete(unsubscribe);
      };
    },
    dispose() {
      for (const unsubscribe of ownedUnsubscribes) {
        unsubscribe();
      }
      ownedUnsubscribes.clear();

      if (options.manageInstance) {
        lenis.destroy?.();
      }
    },
  };
}

function readViewportHeight(options: LenisScrollAdapterOptions): number {
  const viewportHeight = options.getViewportHeight?.();

  if (typeof viewportHeight === "number" && Number.isFinite(viewportHeight)) {
    return viewportHeight;
  }

  if (typeof window !== "undefined" && Number.isFinite(window.innerHeight)) {
    return window.innerHeight;
  }

  return 0;
}

function readFirstFiniteNumber(...values: Array<number | undefined>): number {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }

  return 0;
}
