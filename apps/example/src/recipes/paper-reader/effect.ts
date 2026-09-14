import {
  defineWebGLEffect,
  type WebGLEffectMaterialLayerHandle,
} from "@viselora/dom-webgl";
import { createPaperReaderArtwork, type PaperReaderArtwork } from "./artwork";
import { resolvePaperReaderFrame } from "./frame";
import type {
  PaperReaderContent,
  PaperReaderPalette,
  PaperReaderViewport,
} from "./model";
import { createPaperReaderProgram, createPaperReaderUniforms } from "./program";
import { createPaperReaderTexture, type PaperReaderTexture } from "./texture";

export type PaperReaderEffectParams = {
  readonly kind: "recipe.paper-reader";
  readonly progressKey: string;
  readonly content: PaperReaderContent;
  readonly eyebrow: string;
  readonly palette: PaperReaderPalette;
  readonly onReady: (ready: boolean) => void;
  readonly onError: (error: Error) => void;
};

type PaperReaderEffectState = {
  layer: WebGLEffectMaterialLayerHandle | undefined;
  artwork: PaperReaderArtwork | undefined;
  disposed: boolean;
  failedSize: string;
  lastFrameKey: string;
};

type PaperReaderEffectDependencies = {
  readonly createArtwork?: (
    viewport: PaperReaderViewport,
    content: PaperReaderContent,
    eyebrow: string,
  ) => PaperReaderArtwork;
  readonly createTexture?: (artwork: PaperReaderArtwork) => PaperReaderTexture;
};

export function createPaperReaderEffect({
  createArtwork = createReaderArtwork,
  createTexture = createPaperReaderTexture,
}: PaperReaderEffectDependencies = {}) {
  return defineWebGLEffect<PaperReaderEffectParams, PaperReaderEffectState>({
    kind: "recipe.paper-reader",
    source: "dom/element",
    schedule: "frame",
    setup() {
      return {
        layer: undefined,
        artwork: undefined,
        disposed: false,
        failedSize: "",
        lastFrameKey: "",
      };
    },
    update(ctx, state, params) {
      if (state.disposed) return;
      const { width, height } = ctx.layout;
      if (width <= 0 || height <= 0 || !ctx.object.surface) return;
      const sizeKey = `${width}:${height}`;
      if (state.failedSize === sizeKey) return;
      // The managed orthographic camera spans the runtime viewport. Fill that
      // camera plane; this recipe's pass maps it to the measured stage rectangle.
      // DOM-anchored placement would apply the stage's offset a second time.
      ctx.object.position.set(
        ctx.layout.viewport.width / 2,
        ctx.layout.viewport.height / 2,
        0,
      );
      ctx.object.scale.set(
        ctx.layout.viewport.width,
        ctx.layout.viewport.height,
        1,
      );
      const progress = ctx.progress.get(params.progressKey);
      const frameKey = `${width}:${height}:${progress}`;
      if (state.layer && state.lastFrameKey === frameKey) return;
      try {
        if (
          !state.artwork ||
          state.artwork.layout.viewport.width !== width ||
          state.artwork.layout.viewport.height !== height
        ) {
          state.layer?.dispose();
          state.layer = undefined;
          state.artwork = createArtwork(
            { width, height },
            params.content,
            params.eyebrow,
          );
          if (state.artwork.layout.paperArea.height < 120) {
            throw new Error(
              "PaperReader stage is too short for its heading. Increase height or shorten the description.",
            );
          }
        }
        const frame = resolvePaperReaderFrame(progress, state.artwork.layout);
        if (!state.layer) {
          state.layer = ctx.object.surface.createMaterialLayer({
            key: `${ctx.key}.material`,
            mode: "replace-source",
            program: createPaperReaderProgram(
              state.artwork,
              createTexture(state.artwork),
              frame,
              params.palette,
            ),
          });
          params.onReady(true);
        }
        state.layer.setUniforms(
          createPaperReaderUniforms(state.artwork, frame, params.palette),
        );
        state.lastFrameKey = frameKey;
        state.failedSize = "";
        ctx.object.visible = true;
        ctx.object.surface.setVisible?.(true);
        ctx.object.surface.setOpacity?.(1);
      } catch (error: unknown) {
        state.failedSize = sizeKey;
        state.layer?.dispose();
        state.layer = undefined;
        ctx.object.visible = false;
        ctx.object.surface.setVisible?.(false);
        params.onReady(false);
        params.onError(
          error instanceof Error ? error : new Error(String(error)),
        );
      }
    },
    dispose(_ctx, state, params) {
      if (state.disposed) return;
      state.disposed = true;
      state.layer?.dispose();
      state.layer = undefined;
      state.artwork = undefined;
      params.onReady(false);
    },
  });
}

function createReaderArtwork(
  viewport: PaperReaderViewport,
  content: PaperReaderContent,
  eyebrow: string,
): PaperReaderArtwork {
  const context = document.createElement("canvas").getContext("2d");
  if (!context)
    throw new Error("PaperReader requires a 2D text measurement context.");
  return createPaperReaderArtwork(context, viewport, content, eyebrow);
}

export const paperReaderEffect = createPaperReaderEffect();

/** Register once on the existing WebGLScrollRuntime; do not create this array in render. */
export const paperReaderEffects = [paperReaderEffect];
