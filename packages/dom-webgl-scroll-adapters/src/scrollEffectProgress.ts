import type { WebGLProgressSignalSource } from "@viselora/dom-webgl";

/** Keyed progress values shared with the runtime through `source`. */
export type ScrollEffectProgressStore = {
  /** Pass as `progressSignals`; scenes read `runtime.progress.get(key)` in `useFrame`. */
  readonly source: WebGLProgressSignalSource;
  /** Stores `value` clamped to 0..1 (non-finite becomes 0) and notifies subscribers. */
  set(key: string, value: number): void;
  /** Removes `key`, which then reads 0. */
  reset(key: string): void;
  /** Removes `key`, which then reads 0. */
  clear(key: string): void;
};

export function createScrollEffectProgressStore(): ScrollEffectProgressStore {
  const values = new Map<string, number>();
  const listeners = new Set<() => void>();
  const source = {
    get(key: string): number {
      return values.get(key) ?? 0;
    },
    subscribe(listener: () => void): () => void {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
  } satisfies WebGLProgressSignalSource;

  return {
    source,
    set(key, value) {
      values.set(key, clampProgress(value));
      notifyListeners(listeners);
    },
    reset(key) {
      values.delete(key);
      notifyListeners(listeners);
    },
    clear(key) {
      values.delete(key);
      notifyListeners(listeners);
    },
  };
}

function notifyListeners(listeners: ReadonlySet<() => void>): void {
  for (const listener of listeners) {
    listener();
  }
}

function clampProgress(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  if (value < 0) {
    return 0;
  }

  if (value > 1) {
    return 1;
  }

  return value;
}
