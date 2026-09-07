import {
  defineWebGLEffect,
  type WebGLEffectMaterialLayerHandle,
} from "@viselora/dom-webgl";
import { getHeroChapterContent } from "../chapters/content";
import { heroChapterDefinitions } from "../chapters/definitions";
import { readHeroChapterScrollState } from "../chapters/scrollState";
import type { HeroLocaleStore } from "../preferences/locale";
import { readHeroViewport } from "../shared/viewport";
import { readHeroTransitionSignals } from "../transition/signals";
import { heroTransitionConfig } from "../transition/transitionConfig";
import { createProjectRoomTexture } from "./artwork";
import { createProjectRoomProgram, projectRoomColors } from "./program";
import {
  projectRoomConfig,
  resolveRoomTurn,
  roomInteractionWeight,
  stepRoomAngle,
  wrapRoomAngle,
  type ProjectRoomStore,
} from "./room";

type RoomParams = {
  readonly kind: "hero.projects.room";
  readonly locale: HeroLocaleStore;
  readonly room: ProjectRoomStore;
};
type RoomState = {
  layer: WebGLEffectMaterialLayerHandle | undefined;
  locale: string;
  yaw: number;
  parallaxX: number;
  parallaxY: number;
  armed: boolean;
  wasVisible: boolean;
  disposed: boolean;
  readonly desktop: MediaQueryList;
  readonly reduced: MediaQueryList;
};

export const heroProjectRoomEffect = defineWebGLEffect<RoomParams, RoomState>({
  kind: "hero.projects.room",
  source: "dom/element",
  schedule: "frame",
  setup() {
    return {
      layer: undefined,
      locale: "",
      yaw: 0,
      parallaxX: 0,
      parallaxY: 0,
      armed: false,
      wasVisible: false,
      disposed: false,
      desktop: window.matchMedia(projectRoomConfig.desktopQuery),
      reduced: window.matchMedia("(prefers-reduced-motion: reduce)"),
    };
  },
  update(ctx, state, params) {
    if (state.disposed) return;
    const chapter = readHeroChapterScrollState(ctx.progress);
    const visible =
      state.desktop.matches &&
      chapter.chapterId === "builds" &&
      chapter.domContentActive;
    ctx.object.visible = visible;
    ctx.object.surface?.setVisible?.(visible);
    if (!state.desktop.matches) {
      state.layer?.dispose();
      state.layer = undefined;
    }
    const locale = params.locale.getSnapshot();
    if (state.layer && state.locale !== locale) {
      state.layer.dispose();
      state.layer = undefined;
    }
    if (!state.layer && state.desktop.matches) {
      state.layer = ctx.object.surface?.createMaterialLayer({
        key: "hero.projects.room",
        mode: "replace-source",
        program: createProjectRoomProgram(
          createProjectRoomTexture(
            getHeroChapterContent("builds", locale).body,
          ),
        ),
      });
      state.locale = locale;
    }
    if (!visible) {
      state.wasVisible = false;
      params.room.setHovered(false);
      params.room.setFocused(false);
      params.room.publishFrame({
        ready: state.desktop.matches && !!state.layer,
        active: false,
        settled: true,
      });
      return;
    }
    if (!state.wasVisible) {
      state.yaw = (params.room.getSnapshot().selected * Math.PI) / 2;
      state.parallaxX = 0;
      state.parallaxY = 0;
      state.armed = false;
    }
    state.wasVisible = true;
    const viewport = readHeroViewport();
    const weight = roomInteractionWeight(
      ctx.progress.get(heroChapterDefinitions.builds.signals.body),
    );
    const interactive = weight > 0.999;
    const x = ctx.pointer.normalizedX;
    const y = -ctx.pointer.normalizedY;
    const pointerEnabled =
      interactive &&
      ctx.pointer.isInside &&
      !state.reduced.matches &&
      !params.room.pointerLocked();
    if (Math.abs(x) < projectRoomConfig.rearmThreshold) state.armed = true;
    const turn = pointerEnabled ? resolveRoomTurn(x, y, state.armed) : 0;
    if (turn) {
      params.room.select(params.room.getSnapshot().selected + turn);
      state.armed = false;
    }
    const target = (params.room.getSnapshot().selected * Math.PI) / 2;
    state.yaw = stepRoomAngle(
      state.yaw,
      target,
      ctx.delta,
      state.reduced.matches,
    );
    const smoothing = 1 - Math.exp(-Math.max(0, Math.min(ctx.delta, 64)) / 120);
    const px = pointerEnabled ? x : 0;
    const py = pointerEnabled ? y : 0;
    state.parallaxX += (px - state.parallaxX) * smoothing;
    state.parallaxY += (py - state.parallaxY) * smoothing;
    if (state.reduced.matches) {
      state.parallaxX = 0;
      state.parallaxY = 0;
    }
    const camera = heroTransitionConfig.chapterGeometry;
    ctx.object.rotation.set(
      Math.atan2(camera.cameraTargetY, camera.cameraDistance),
      0,
      0,
    );
    state.layer?.setUniforms({
      viewport: [viewport.width, viewport.height],
      view: [
        (state.reduced.matches && !interactive
          ? 0
          : wrapRoomAngle(state.yaw) * weight) +
          state.parallaxX * 0.045 * weight,
        -state.parallaxY * 0.025 * weight,
        state.parallaxX * 0.12 * weight,
        -state.parallaxY * 0.08 * weight,
      ],
      ...projectRoomColors(
        readHeroTransitionSignals(ctx.progress).committedScheme === "inverted",
      ),
    });
    ctx.object.surface?.setOpacity?.(1);
    params.room.publishFrame({
      ready: !!state.layer,
      active: interactive,
      settled: Math.abs(wrapRoomAngle(target - state.yaw)) < 0.025,
    });
  },
  dispose(_ctx, state, params) {
    if (state.disposed) return;
    state.disposed = true;
    state.layer?.dispose();
    state.layer = undefined;
    params.room.publishFrame({ ready: false, active: false, settled: true });
  },
});
