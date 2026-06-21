import type { WebGLScrollAdapter, WebGLScrollMetrics } from "../types";
import {
  createScrollEventRouter,
  type ScrollControllerEventTarget,
} from "./scrollDeltaRouter";

export type NativeScrollAdapterOptions = {
  readMetrics(): WebGLScrollMetrics;
  eventTarget?: ScrollControllerEventTarget;
  lineHeight?: number;
};

export function createNativeScrollAdapter(
  options: NativeScrollAdapterOptions,
): WebGLScrollAdapter {
  return {
    kind: "native.page",
    readMetrics: options.readMetrics,
    connectDeltaRouter(router) {
      if (!options.eventTarget) {
        return () => {};
      }

      const eventRouter = createScrollEventRouter({
        target: options.eventTarget,
        getViewportHeight: () => options.readMetrics().viewportHeight,
        lineHeight: options.lineHeight,
        consumeDelta: router,
      });

      return () => {
        eventRouter.dispose();
      };
    },
  };
}
