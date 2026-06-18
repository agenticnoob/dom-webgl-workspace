export type DisposableRenderTarget = {
  dispose(): void;
};

export type PooledRenderTarget<TTarget extends DisposableRenderTarget> = {
  readonly kind: string;
  readonly width: number;
  readonly height: number;
  readonly target: TTarget;
};

export type RenderTargetPool<TTarget extends DisposableRenderTarget> = {
  acquire(kind: string, width: number, height: number): PooledRenderTarget<TTarget>;
  release(target: PooledRenderTarget<TTarget>): void;
  dispose(): void;
};

export function createRenderTargetPool<TTarget extends DisposableRenderTarget>(
  options: {
    createTarget(kind: string, width: number, height: number): TTarget;
  },
): RenderTargetPool<TTarget> {
  const retained = new Map<string, Array<PooledRenderTarget<TTarget>>>();
  const leased = new Set<PooledRenderTarget<TTarget>>();

  return {
    acquire(kind, width, height): PooledRenderTarget<TTarget> {
      const key = createPoolKey(kind, width, height);
      const available = retained.get(key)?.pop();

      if (available) {
        leased.add(available);
        return available;
      }

      const pooled = {
        kind,
        width,
        height,
        target: options.createTarget(kind, width, height),
      };

      leased.add(pooled);
      return pooled;
    },
    release(target): void {
      if (!leased.delete(target)) {
        return;
      }

      const key = createPoolKey(target.kind, target.width, target.height);
      const available = retained.get(key) ?? [];

      available.push(target);
      retained.set(key, available);
    },
    dispose(): void {
      for (const target of leased) {
        target.target.dispose();
      }
      leased.clear();

      for (const targets of retained.values()) {
        for (const target of targets) {
          target.target.dispose();
        }
      }
      retained.clear();
    },
  };
}

function createPoolKey(kind: string, width: number, height: number): string {
  return `${kind}:${width}x${height}`;
}
