export {
  exampleSurfaceFillEffect,
  exampleSurfaceGhostCursorEffect,
  exampleSurfacePulseEffect,
  exampleSurfaceVideoBackgroundEffect,
  exampleSurfaceWavesEffect,
} from "./surfaceEffects";
export {
  exampleTextPressureEffect,
  exampleTextRevealEffect,
  exampleTextScrambleEffect,
  exampleTextSpotlightEffect,
  exampleTextWaveEffect,
} from "./textEffects";
export { examplePinnedRevealEffect } from "./pinnedScrollEffect";
export {
  exampleImageHoverRevealEffect,
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
  exampleSequenceCardBorderGlowEffect,
  exampleSequenceCardSlideEffect,
} from "./sequenceCardEffect";
export {
  type ExampleEffectParams,
  typeSafeDeclarations,
} from "./exampleEffectDeclarations";

import {
  exampleImageHoverRevealEffect,
  exampleImagePanEffect,
  exampleImageKenBurnsEffect,
  exampleImageZoomEffect,
  exampleVideoDriftEffect,
  exampleVideoPlaybackEffect,
} from "./mediaEffects";
import { exampleModelFloatEffect, exampleModelSpinEffect } from "./modelEffects";
import { examplePinnedRevealEffect } from "./pinnedScrollEffect";
import {
  exampleSequenceCardBorderGlowEffect,
  exampleSequenceCardSlideEffect,
} from "./sequenceCardEffect";
import {
  exampleSurfaceFillEffect,
  exampleSurfaceGhostCursorEffect,
  exampleSurfacePulseEffect,
  exampleSurfaceVideoBackgroundEffect,
  exampleSurfaceWavesEffect,
} from "./surfaceEffects";
import {
  exampleTextPressureEffect,
  exampleTextRevealEffect,
  exampleTextScrambleEffect,
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
  exampleTextPressureEffect,
  exampleTextScrambleEffect,
  examplePinnedRevealEffect,
  exampleSequenceCardSlideEffect,
  exampleSequenceCardBorderGlowEffect,
  exampleImagePanEffect,
  exampleImageZoomEffect,
  exampleImageKenBurnsEffect,
  exampleImageHoverRevealEffect,
  exampleVideoPlaybackEffect,
  exampleVideoDriftEffect,
  exampleModelSpinEffect,
  exampleModelFloatEffect,
] as const;
