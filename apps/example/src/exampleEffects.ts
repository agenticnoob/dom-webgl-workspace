export {
  exampleSurfaceFillEffect,
  exampleSurfaceGhostCursorEffect,
  exampleSurfacePulseEffect,
  exampleSurfaceVideoBackgroundEffect,
  exampleSurfaceWavesEffect,
} from "./surfaceEffects";
export {
  exampleTextRevealEffect,
  exampleTextSpotlightEffect,
  exampleTextWaveEffect,
} from "./textEffects";
export { examplePinnedRevealEffect } from "./pinnedScrollEffect";
export {
  exampleImagePanEffect,
  exampleImageKenBurnsEffect,
  exampleImageZoomEffect,
  exampleVideoDriftEffect,
  exampleVideoPlaybackEffect,
} from "./mediaEffects";
export {
  exampleModelFloatEffect,
  exampleModelSpinEffect,
} from "./modelEffects";
export {
  type ExampleEffectParams,
  typeSafeDeclarations,
} from "./exampleEffectDeclarations";

import {
  exampleImagePanEffect,
  exampleImageKenBurnsEffect,
  exampleImageZoomEffect,
  exampleVideoDriftEffect,
  exampleVideoPlaybackEffect,
} from "./mediaEffects";
import { exampleModelFloatEffect, exampleModelSpinEffect } from "./modelEffects";
import { examplePinnedRevealEffect } from "./pinnedScrollEffect";
import {
  exampleSurfaceFillEffect,
  exampleSurfaceGhostCursorEffect,
  exampleSurfacePulseEffect,
  exampleSurfaceVideoBackgroundEffect,
  exampleSurfaceWavesEffect,
} from "./surfaceEffects";
import {
  exampleTextRevealEffect,
  exampleTextSpotlightEffect,
  exampleTextWaveEffect,
} from "./textEffects";

export const exampleEffects = [
  exampleSurfaceFillEffect,
  exampleSurfacePulseEffect,
  exampleSurfaceVideoBackgroundEffect,
  exampleSurfaceGhostCursorEffect,
  exampleSurfaceWavesEffect,
  exampleTextWaveEffect,
  exampleTextRevealEffect,
  exampleTextSpotlightEffect,
  examplePinnedRevealEffect,
  exampleImagePanEffect,
  exampleImageZoomEffect,
  exampleImageKenBurnsEffect,
  exampleVideoPlaybackEffect,
  exampleVideoDriftEffect,
  exampleModelSpinEffect,
  exampleModelFloatEffect,
] as const;
