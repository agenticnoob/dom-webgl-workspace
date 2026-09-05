import {
  defineWebGLEffect,
  type WebGLEffectMaterialLayerHandle,
} from "@viselora/dom-webgl";
import { heroChapterDefinitions } from "../chapters/definitions";
import { readHeroChapterScrollState } from "../chapters/scrollState";
import type { HeroLocaleStore } from "../preferences/locale";
import { readHeroViewport, type HeroViewport } from "../shared/viewport";
import { readHeroTransitionSignals } from "../transition/signals";
import { heroTransitionConfig } from "../transition/transitionConfig";
import type { AxiomsArtwork } from "./artwork";
import { createAxiomsTexture } from "./texture";
import { createHeroAxiomsArtwork } from "./reader";
import { resolveAxiomsFrame } from "./frame";
import { createAxiomsProgram, createAxiomsUniforms } from "./program";

type AxiomsEffectParams = {
  readonly kind: "hero.axioms.reader";
  readonly locale: HeroLocaleStore;
};
type AxiomsEffectState = {
  layer: WebGLEffectMaterialLayerHandle | undefined;
  artwork: AxiomsArtwork | undefined;
  locale: string;
  disposed: boolean;
  readonly motionPreference: MediaQueryList;
  lastFrameKey: string;
};

export function createAxiomsReaderArtwork(
  viewport: HeroViewport,
  locale: ReturnType<HeroLocaleStore["getSnapshot"]>,
): AxiomsArtwork {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Axioms reader requires text measurement.");
  return createHeroAxiomsArtwork(context, viewport, locale);
}

export const heroAxiomsReaderEffect = defineWebGLEffect<
  AxiomsEffectParams,
  AxiomsEffectState
>({
  kind: "hero.axioms.reader",
  source: "dom/element",
  schedule: "frame",
  setup() {
    return {
      layer: undefined,
      artwork: undefined,
      locale: "",
      disposed: false,
      motionPreference: window.matchMedia("(prefers-reduced-motion: reduce)"),
      lastFrameKey: "",
    };
  },
  update(ctx, state, params) {
    if (state.disposed) return;
    const chapter = readHeroChapterScrollState(ctx.progress);
    const visible = chapter.chapterId === "axioms" && chapter.domContentActive;
    ctx.object.visible = visible;
    ctx.object.surface?.setVisible?.(visible);
    if (!visible) return;
    const camera = heroTransitionConfig.chapterGeometry;
    ctx.object.rotation.set(
      Math.atan2(camera.cameraTargetY, camera.cameraDistance),
      0,
      0,
    );
    const viewport = readHeroViewport();
    const locale = params.locale.getSnapshot();
    const reducedMotion = state.motionPreference.matches;
    const progress = ctx.progress.get(
      heroChapterDefinitions.axioms.signals.body,
    );
    const inverted =
      readHeroTransitionSignals(ctx.progress).committedScheme === "inverted";
    const frameKey = `${viewport.width}:${viewport.height}:${locale}:${progress}:${reducedMotion}:${inverted}`;
    if (state.layer && state.lastFrameKey === frameKey) return;
    if (
      !state.artwork ||
      state.artwork.layout.viewport.width !== viewport.width ||
      state.artwork.layout.viewport.height !== viewport.height ||
      state.locale !== locale
    ) {
      state.layer?.dispose();
      state.artwork = createAxiomsReaderArtwork(viewport, locale);
      state.locale = locale;
      state.layer = undefined;
    }
    const frame = resolveAxiomsFrame(
      progress,
      state.artwork.layout,
      reducedMotion,
    );
    if (!state.layer) {
      state.layer = ctx.object.surface?.createMaterialLayer({
        key: "hero.axioms.reader",
        mode: "replace-source",
        program: createAxiomsProgram(
          state.artwork,
          createAxiomsTexture(state.artwork),
          frame,
        ),
      });
    }
    state.layer?.setUniforms(
      createAxiomsUniforms(state.artwork, frame, inverted),
    );
    state.lastFrameKey = frameKey;
    ctx.object.surface?.setOpacity?.(1);
  },
  dispose(_ctx, state) {
    if (state.disposed) return;
    state.disposed = true;
    state.layer?.dispose();
    state.layer = undefined;
    state.artwork = undefined;
  },
});
