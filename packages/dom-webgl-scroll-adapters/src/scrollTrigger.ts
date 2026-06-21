export type ScrollTriggerScrollerProxy = {
  scrollTop?(value?: number): number | void;
  scrollLeft?(value?: number): number | void;
  getBoundingClientRect?(): {
    top: number;
    left: number;
    width: number;
    height: number;
  };
  pinType?: "fixed" | "transform";
};

export type ScrollTriggerLike = {
  update(): void;
  refresh(safe?: boolean): void;
  scrollerProxy?(
    scroller: string | Element,
    proxy: ScrollTriggerScrollerProxy,
  ): void;
};

export type ScrollTriggerBridgeOptions = {
  ScrollTrigger: ScrollTriggerLike;
  scroller?: string | Element;
  proxy?: ScrollTriggerScrollerProxy;
};

export type ScrollTriggerBridge = {
  update(): void;
  refresh(safe?: boolean): void;
  dispose(): void;
};

export function createScrollTriggerBridge(
  options: ScrollTriggerBridgeOptions,
): ScrollTriggerBridge {
  if (options.scroller && options.proxy) {
    options.ScrollTrigger.scrollerProxy?.(options.scroller, options.proxy);
  }

  return {
    update() {
      options.ScrollTrigger.update();
    },
    refresh(safe?: boolean) {
      options.ScrollTrigger.refresh(safe);
    },
    dispose() {
      return;
    },
  };
}
