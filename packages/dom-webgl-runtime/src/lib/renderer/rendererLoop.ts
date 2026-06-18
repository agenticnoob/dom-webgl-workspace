export type RendererLoopOptions = {
  renderer: {
    setAnimationLoop?(callback: ((time: number) => void) | null): void;
  };
  beforeRender(time: number): void;
  render(): void;
};

export type RendererLoop = {
  start(): void;
  dispose(): void;
};

export function createRendererLoop(options: RendererLoopOptions): RendererLoop {
  let disposed = false;
  let started = false;

  const tick = (time: number) => {
    if (disposed) {
      return;
    }

    options.beforeRender(time);
    options.render();
  };

  return {
    start(): void {
      if (started || disposed) {
        return;
      }

      started = true;
      options.renderer.setAnimationLoop?.(tick);
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
