export type RenderSchedulingMode = "continuous" | "on-demand";

export type RenderDirtyReason =
  | "initial"
  | "target-register"
  | "target-unregister"
  | "dom-invalidation"
  | "resource-ready"
  | "manual-sync"
  | "layout"
  | "pointer"
  | "scroll";

export type RenderFrameSchedule = {
  readonly dirtyReasons: readonly RenderDirtyReason[];
};

export type RenderFrameResult = {
  readonly mode: RenderSchedulingMode;
  readonly render?: boolean;
};

export type RendererLoopOptions = {
  renderer: {
    setAnimationLoop?(callback: ((time: number) => void) | null): void;
  };
  beforeRender(
    time: number,
    frame: RenderFrameSchedule,
  ): void | RenderFrameResult;
  render(): void;
};

export type RendererLoop = {
  start(): void;
  requestFrame(reason: RenderDirtyReason): void;
  dispose(): void;
};

export function createRendererLoop(options: RendererLoopOptions): RendererLoop {
  let disposed = false;
  let started = false;
  let mode: RenderSchedulingMode = "on-demand";
  const dirtyReasons = new Set<RenderDirtyReason>(["initial"]);

  const tick = (time: number) => {
    if (disposed) {
      return;
    }

    if (mode === "on-demand" && dirtyReasons.size === 0) {
      return;
    }

    const frameDirtyReasons = Array.from(dirtyReasons);
    dirtyReasons.clear();
    const result = options.beforeRender(time, {
      dirtyReasons: frameDirtyReasons,
    });

    mode = result?.mode ?? "continuous";

    if (result?.render !== false) {
      options.render();
    }
  };

  return {
    start(): void {
      if (started || disposed) {
        return;
      }

      started = true;
      options.renderer.setAnimationLoop?.(tick);
    },
    requestFrame(reason): void {
      if (disposed) {
        return;
      }

      dirtyReasons.add(reason);
    },
    dispose(): void {
      if (disposed) {
        return;
      }

      disposed = true;
      options.renderer.setAnimationLoop?.(null);
    },
  };
}
