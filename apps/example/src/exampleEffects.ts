export {
  exampleSurfaceFillEffect,
  exampleSurfaceGhostCursorEffect,
  exampleSurfacePulseEffect,
  exampleSurfaceVideoBackgroundEffect,
  exampleSurfaceWavesEffect,
} from "./surfaceEffects";
export {
  exampleTextRevealEffect,
  exampleTextWaveEffect,
} from "./textEffects";
export { examplePinnedRevealEffect } from "./pinnedScrollEffect";
export {
  exampleImagePanEffect,
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
import { exampleTextRevealEffect, exampleTextWaveEffect } from "./textEffects";

export const exampleEffects = [
  exampleSurfaceFillEffect,
  exampleSurfacePulseEffect,
  exampleSurfaceVideoBackgroundEffect,
  exampleSurfaceGhostCursorEffect,
  exampleSurfaceWavesEffect,
  exampleTextWaveEffect,
  exampleTextRevealEffect,
  examplePinnedRevealEffect,
  exampleImagePanEffect,
  exampleImageZoomEffect,
  exampleVideoPlaybackEffect,
  exampleVideoDriftEffect,
  exampleModelSpinEffect,
  exampleModelFloatEffect,
] as const;
