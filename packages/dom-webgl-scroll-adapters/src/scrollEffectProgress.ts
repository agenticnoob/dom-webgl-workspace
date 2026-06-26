import type { WebGLProgressSignalSource } from "@project/dom-webgl-runtime";

export type ScrollEffectProgressStore = {
  readonly source: WebGLProgressSignalSource;
  set(key: string, value: number): void;
  reset(key: string): void;
  clear(key: string): void;
};

export function createScrollEffectProgressStore(): ScrollEffectProgressStore {
  const values = new Map<string, number>();
  const source = {
    get(key: string): number {
      return values.get(key) ?? 0;
    },
  } satisfies WebGLProgressSignalSource;

  return {
    source,
    set(key, value) {
      values.set(key, clampProgress(value));
    },
    reset(key) {
      values.delete(key);
    },
    clear(key) {
      values.delete(key);
    },
  };
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
