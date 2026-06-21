import type { WebGLScrollAdapter } from "@project/dom-webgl-runtime";

import {
  createGsapTickerLenisBridge,
  type GsapTickerLike,
  type LenisRafLike,
} from "./gsap";
import {
  createLenisScrollAdapter,
  type LenisLike,
  type LenisScrollAdapterOptions,
} from "./lenis";
import {
  createScrollTriggerBridge,
  type ScrollTriggerBridge,
  type ScrollTriggerLike,
  type ScrollTriggerScrollerProxy,
} from "./scrollTrigger";

export type LenisGsapScrollStackLenis = LenisLike & LenisRafLike;

export type LenisGsapScrollStackOptions = {
  lenis: LenisGsapScrollStackLenis;
  gsap: GsapTickerLike;
  ScrollTrigger?: ScrollTriggerLike;
  scroller?: string | Element;
  proxy?: ScrollTriggerScrollerProxy;
  getViewportHeight?: LenisScrollAdapterOptions["getViewportHeight"];
  getScrollHeight?: LenisScrollAdapterOptions["getScrollHeight"];
  manageLenis?: boolean;
  disableLagSmoothing?: boolean;
};

export type LenisGsapScrollStack = {
  scrollAdapter: WebGLScrollAdapter;
  update(): void;
  refresh(safe?: boolean): void;
  dispose(): void;
};

export function createLenisGsapScrollStack(
  options: LenisGsapScrollStackOptions,
): LenisGsapScrollStack {
  const scrollAdapter = createLenisScrollAdapter(options.lenis, {
    getViewportHeight: options.getViewportHeight,
    getScrollHeight: options.getScrollHeight,
    manageInstance: options.manageLenis,
  });
  const scrollTriggerBridge = createOptionalScrollTriggerBridge(options);
  const tickerBridge = createGsapTickerLenisBridge({
    gsap: options.gsap,
    lenis: options.lenis,
    scrollTrigger: options.ScrollTrigger,
    disableLagSmoothing: options.disableLagSmoothing,
  });

  return {
    scrollAdapter,
    update() {
      scrollTriggerBridge?.update();
    },
    refresh(safe?: boolean) {
      scrollTriggerBridge?.refresh(safe);
    },
    dispose() {
      tickerBridge.dispose();
      scrollTriggerBridge?.dispose();
      scrollAdapter.dispose?.();
    },
  };
}

function createOptionalScrollTriggerBridge(
  options: LenisGsapScrollStackOptions,
): ScrollTriggerBridge | null {
  if (!options.ScrollTrigger) {
    return null;
  }

  return createScrollTriggerBridge({
    ScrollTrigger: options.ScrollTrigger,
    scroller: options.scroller,
    proxy: options.proxy,
  });
}
