import { defineWebGLEffect } from "@viselora/dom-webgl";

import {
  readHeroPortalViewState,
  resolveHeroPortalMotion,
  type HeroPortalContentId,
  type HeroPortalSide,
} from "./portalState";

export type HeroPortalMotionParams = {
  readonly kind: "hero.portal.motion";
  readonly contentId: HeroPortalContentId;
  readonly side: HeroPortalSide;
  readonly travelViewportFraction: number;
  readonly maxTravelPx: number;
};

type HeroPortalEffectState = {
  readonly reducedMotion: boolean;
};

export const heroPortalMotionEffect = defineWebGLEffect<
  HeroPortalMotionParams,
  HeroPortalEffectState
>({
  kind: "hero.portal.motion",
  source: "dom/text",
  schedule: "frame",
  setup() {
    return {
      reducedMotion:
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    };
  },
  update(ctx, state, params) {
    const text = ctx.object.text;
    if (!text) {
      return;
    }

    const motion = resolveHeroPortalMotion(
      readHeroPortalViewState(ctx.progress),
      {
        contentId: params.contentId,
        side: params.side,
      },
    );
    const travelPx = state.reducedMotion
      ? 0
      : Math.min(
          params.maxTravelPx,
          ctx.layout.viewport.width * params.travelViewportFraction,
        );
    const offsetX = motion.horizontalOffsetProgress * travelPx;
    const opacity = resolvePortalOpacity(
      motion.opacity,
      ctx.layout.viewport.width,
    );

    ctx.object.visible = motion.visible && opacity > 0.001;
    text.setGlyphs((glyphs) =>
      glyphs.map((glyph) => ({
        index: glyph.index,
        char: glyph.char,
        x: glyph.x + offsetX,
        opacity,
      })),
    );
  },
});

function resolvePortalOpacity(presence: number, viewportWidth: number): number {
  const fadeFloor = viewportWidth <= 700 ? 0.3 : 0.12;
  const progress = Math.max(
    0,
    Math.min(1, (presence - fadeFloor) / (1 - fadeFloor)),
  );
  return progress * progress * (3 - 2 * progress);
}
