import type {
  WebGLLifecycleDeclaration,
  WebGLOffscreenStrategy,
} from "../types";

export type RuntimeOffscreenPolicy = {
  strategy: WebGLOffscreenStrategy;
  warmTtlMs: number;
};

export function compileOffscreenPolicy(
  lifecycle: WebGLLifecycleDeclaration | undefined,
): RuntimeOffscreenPolicy {
  const offscreen = lifecycle?.offscreen;

  return {
    strategy: offscreen?.strategy ?? "restore-dom",
    warmTtlMs: normalizeWarmTtl(offscreen?.warmTtlMs),
  };
}

function normalizeWarmTtl(warmTtlMs: number | undefined): number {
  if (warmTtlMs === undefined || !Number.isFinite(warmTtlMs) || warmTtlMs <= 0) {
    return 0;
  }

  return Math.min(warmTtlMs, 30_000);
}
