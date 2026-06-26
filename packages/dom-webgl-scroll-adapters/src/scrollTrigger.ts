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

export type ScrollTriggerSectionUpdate = {
  readonly progress: number;
};

export type ScrollTriggerSectionVars = {
  readonly trigger: string | Element;
  readonly start: string;
  readonly end: string;
  readonly pin?: boolean | string | Element;
  readonly scrub?: boolean | number;
  readonly onUpdate?: (state: ScrollTriggerSectionUpdate) => void;
};

export type ScrollTriggerSectionInstance = {
  kill(): void;
};

export type ScrollTriggerSectionCreator = ScrollTriggerLike & {
  create(vars: ScrollTriggerSectionVars): ScrollTriggerSectionInstance;
};

export type ScrollTriggerSectionOptions = ScrollTriggerSectionVars & {
  readonly ScrollTrigger: ScrollTriggerSectionCreator;
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

export function createScrollTriggerSection(
  options: ScrollTriggerSectionOptions,
): ScrollTriggerSectionInstance {
  return options.ScrollTrigger.create({
    trigger: options.trigger,
    start: options.start,
    end: options.end,
    pin: options.pin,
    scrub: options.scrub,
    onUpdate: options.onUpdate,
  });
}
