import type { WebGLRenderQualityDeclaration } from "../types";

export type NormalizedWebGLRenderQuality = {
  antialias: boolean;
  maxDevicePixelRatio: number;
};

const defaultRenderQuality = {
  antialias: false,
  maxDevicePixelRatio: 1.5,
} satisfies NormalizedWebGLRenderQuality;

export function normalizeWebGLRenderQuality(
  declaration?: WebGLRenderQualityDeclaration,
): NormalizedWebGLRenderQuality {
  const maxDevicePixelRatio =
    declaration?.maxDevicePixelRatio ?? defaultRenderQuality.maxDevicePixelRatio;

  if (!Number.isFinite(maxDevicePixelRatio) || maxDevicePixelRatio <= 0) {
    throw new Error(
      "WebGL render quality maxDevicePixelRatio must be a finite positive number.",
    );
  }

  return {
    antialias: declaration?.antialias ?? defaultRenderQuality.antialias,
    maxDevicePixelRatio,
  };
}
