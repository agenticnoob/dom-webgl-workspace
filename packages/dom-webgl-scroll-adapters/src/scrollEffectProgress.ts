import type { WebGLProgressSignalSource } from "@viselora/dom-webgl";

export type ScrollEffectProgressStore = {
  readonly source: WebGLProgressSignalSource;
  set(key: string, value: number): void;
  reset(key: string): void;
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
