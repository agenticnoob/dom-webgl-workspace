export {
  exampleSurfaceFillEffect,
  exampleSurfacePulseEffect,
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
import { exampleSurfaceFillEffect, exampleSurfacePulseEffect } from "./surfaceEffects";
import { exampleTextRevealEffect, exampleTextWaveEffect } from "./textEffects";

export const exampleEffects = [
  exampleSurfaceFillEffect,
  exampleSurfacePulseEffect,
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
