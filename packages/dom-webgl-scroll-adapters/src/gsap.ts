export type GsapTickerLike = {
  ticker: {
    add(callback: (time: number) => void): void;
    remove(callback: (time: number) => void): void;
    lagSmoothing?(threshold: number): void;
  };
};

export type LenisRafLike = {
  raf(time: number): void;
  on?(event: "scroll", listener: () => void): void | (() => void);
};

export type ScrollTriggerUpdateLike = {
  update(): void;
};

export type GsapTickerLenisBridgeOptions = {
  gsap: GsapTickerLike;
  lenis: LenisRafLike;
  scrollTrigger?: ScrollTriggerUpdateLike;
  disableLagSmoothing?: boolean;
};

export type GsapTickerLenisBridge = {
  dispose(): void;
};

export function createGsapTickerLenisBridge(
  options: GsapTickerLenisBridgeOptions,
): GsapTickerLenisBridge {
  const updateLenis = (time: number) => {
    options.lenis.raf(time * 1000);
  };
  const unsubscribeScrollTrigger = options.scrollTrigger
    ? options.lenis.on?.("scroll", () => {
        options.scrollTrigger?.update();
      })
    : undefined;

  options.gsap.ticker.add(updateLenis);

  if (options.disableLagSmoothing !== false) {
    options.gsap.ticker.lagSmoothing?.(0);
  }

  return {
    dispose() {
      options.gsap.ticker.remove(updateLenis);

      if (typeof unsubscribeScrollTrigger === "function") {
        unsubscribeScrollTrigger();
      }
    },
  };
}
