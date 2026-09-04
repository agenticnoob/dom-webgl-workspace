import { defineWebGLEffect } from "@viselora/dom-webgl";

import {
  readHeroPortalViewState,
  resolveHeroPortalMotion,
  type HeroPortalContentId,
  type HeroPortalSide,
} from "./portalState";
import { heroTransitionConfig } from "./transitionConfig";

export type HeroPortalMotionParams = {
  readonly kind: "hero.portal.motion";
  readonly contentId: HeroPortalContentId;
  readonly side: HeroPortalSide;
  readonly travelViewportFraction: number;
  readonly maxTravelPx: number;
  readonly hideAfterProgressKey?: string;
};

type HeroPortalEffectState = {
  readonly reducedMotion: boolean;
  readonly parallax: HeroPortalParallaxState;
};

export type HeroPortalParallaxState = {
  x: number;
  y: number;
};

export type HeroPortalParallaxInput = {
  readonly delta: number;
  readonly pointerInside: boolean;
  readonly pointerX: number;
  readonly pointerY: number;
  readonly reducedMotion: boolean;
  readonly visible: boolean;
};

export function createHeroPortalParallaxState(): HeroPortalParallaxState {
  return { x: 0, y: 0 };
}

export function stepHeroPortalParallax(
  state: HeroPortalParallaxState,
  input: HeroPortalParallaxInput,
): void {
  const active = !input.reducedMotion && input.visible && input.pointerInside;
  const targetX = active ? clamp(input.pointerX, -1, 1) : 0;
  const targetY = active ? clamp(input.pointerY, -1, 1) : 0;
  const damping =
    1 -
    Math.exp(
      -Math.max(0, input.delta) / heroTransitionConfig.portal.pointerDampingMs,
    );

  state.x += (targetX - state.x) * damping;
  state.y += (targetY - state.y) * damping;
}

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
      parallax: createHeroPortalParallaxState(),
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
    const hiddenByProgress =
      params.hideAfterProgressKey !== undefined &&
      ctx.progress.get(params.hideAfterProgressKey) >= 1 - 0.0001;
    const opacity = hiddenByProgress
      ? 0
      : resolvePortalOpacity(motion.opacity, ctx.layout.viewport.width);
    stepHeroPortalParallax(state.parallax, {
      delta: ctx.delta,
      pointerInside: ctx.pointer.isInside,
      pointerX: ctx.pointer.normalizedX,
      pointerY: ctx.pointer.normalizedY,
      reducedMotion: state.reducedMotion,
      visible: motion.visible && opacity > 0.001,
    });

    ctx.object.visible = !hiddenByProgress && motion.visible && opacity > 0.001;
    ctx.object.rotation.set(
      -state.parallax.y * heroTransitionConfig.portal.pointerPitch,
      (state.reducedMotion ? 0 : motion.rotationY) +
        state.parallax.x * heroTransitionConfig.portal.pointerYaw,
      0,
    );
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

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
