export {
  exampleModelDarkSceneEffect,
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
  exampleTextSpotlightPressureScrambleWaveEffect,
  exampleTextSpotlightEffect,
  exampleTextWaveEffect,
} from "./textEffects";
export { examplePinnedRevealEffect } from "./pinnedScrollEffect";
export {
  exampleImageHoverRevealEffect,
  exampleImagePanEffect,
  exampleImageKenBurnsEffect,
  exampleImageZoomEffect,
  exampleMediaPointerParallaxEffect,
  exampleVideoDriftEffect,
  exampleVideoPlaybackEffect,
} from "./mediaEffects";
export {
  exampleModelFloatGlowEffect,
  exampleModelFloatEffect,
  exampleModelSpinEffect,
} from "./modelEffects";
export { exampleSceneObjectHoverPulseEffect } from "./interactionEffects";
export { exampleManagedTimelineCardEffect } from "./managedTimelineCardEffect";
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
  exampleMediaPointerParallaxEffect,
  exampleVideoDriftEffect,
  exampleVideoPlaybackEffect,
} from "./mediaEffects";
import {
  exampleModelFloatGlowEffect,
  exampleModelFloatEffect,
  exampleModelSpinEffect,
} from "./modelEffects";
import { exampleSceneObjectHoverPulseEffect } from "./interactionEffects";
import { exampleManagedTimelineCardEffect } from "./managedTimelineCardEffect";
import { examplePinnedRevealEffect } from "./pinnedScrollEffect";
import {
  exampleSequenceCardBorderGlowEffect,
  exampleSequenceCardSlideEffect,
} from "./sequenceCardEffect";
import {
  exampleModelDarkSceneEffect,
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
  exampleTextSpotlightPressureScrambleWaveEffect,
  exampleTextSpotlightEffect,
  exampleTextWaveEffect,
} from "./textEffects";

export const exampleEffects = [
  exampleSurfaceFillEffect,
  exampleSurfacePulseEffect,
  exampleSurfaceVideoBackgroundEffect,
  exampleSurfaceGhostCursorEffect,
  exampleSurfaceWavesEffect,
  exampleManagedTimelineCardEffect,
  exampleTextWaveEffect,
  exampleTextRevealEffect,
  exampleTextSpotlightEffect,
  exampleTextPressureEffect,
  exampleTextScrambleEffect,
  exampleTextSpotlightPressureScrambleWaveEffect,
  examplePinnedRevealEffect,
  exampleSequenceCardSlideEffect,
  exampleSequenceCardBorderGlowEffect,
  exampleImagePanEffect,
  exampleImageZoomEffect,
  exampleImageKenBurnsEffect,
  exampleImageHoverRevealEffect,
  exampleMediaPointerParallaxEffect,
  exampleVideoPlaybackEffect,
  exampleVideoDriftEffect,
  exampleModelDarkSceneEffect,
  exampleModelSpinEffect,
  exampleModelFloatEffect,
  exampleModelFloatGlowEffect,
  exampleSceneObjectHoverPulseEffect,
] as const;
