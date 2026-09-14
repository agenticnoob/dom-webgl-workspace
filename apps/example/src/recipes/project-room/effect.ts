import {
  defineWebGLEffect,
  type WebGLEffectMaterialLayerHandle,
} from "@viselora/dom-webgl";
import { createProjectRoomTexture } from "./artwork";
import { createProjectRoomProgram } from "./program";
import {
  projectRoomConfig,
  resolveRoomTurn,
  stepRoomAngle,
  wrapRoomAngle,
  type ProjectRoomStore,
} from "./room";
import type { ProjectRoomItems, ProjectRoomPalette } from "./types";

export type ProjectRoomEffectParams = {
  readonly kind: "recipe.project-room";
  readonly items: ProjectRoomItems;
  readonly palette: ProjectRoomPalette;
  readonly room: ProjectRoomStore;
};

type RoomState = {
  layer: WebGLEffectMaterialLayerHandle | undefined;
  yaw: number;
  parallaxX: number;
  parallaxY: number;
  armed: boolean;
  visible: boolean;
  disposed: boolean;
  error: string | undefined;
  readonly desktop: MediaQueryList;
  readonly reduced: MediaQueryList;
};

export const projectRoomEffect = defineWebGLEffect<
  ProjectRoomEffectParams,
  RoomState
>({
  kind: "recipe.project-room",
  source: "dom/element",
  schedule: "frame",
  setup() {
    return {
      layer: undefined,
      yaw: 0,
      parallaxX: 0,
      parallaxY: 0,
      armed: false,
      visible: false,
      disposed: false,
      error: undefined,
      desktop: window.matchMedia(projectRoomConfig.pointerQuery),
      reduced: window.matchMedia("(prefers-reduced-motion: reduce)"),
    };
  },
  update(ctx, state, params) {
    if (state.disposed) return;
    const enabled =
      state.desktop.matches &&
      ctx.layout.width >= projectRoomConfig.minimumWidth;
    if (!enabled) {
      state.layer?.dispose();
      state.layer = undefined;
    }
    if (enabled && !state.layer && !state.error) {
      try {
        state.layer = ctx.object.surface?.createMaterialLayer({
          key: "recipe.project-room",
          mode: "replace-source",
          program: createProjectRoomProgram(
            createProjectRoomTexture(params.items),
            params.palette,
          ),
        });
      } catch (error: unknown) {
        state.error = error instanceof Error ? error.message : String(error);
      }
    }
    const visible = enabled && !!state.layer;
    ctx.object.visible = visible;
    ctx.object.surface?.setVisible?.(visible);
    if (!visible) {
      state.visible = false;
      state.armed = false;
      params.room.publishFrame({
        ready: false,
        settled: true,
        error: state.error,
      });
      return;
    }
    if (!state.visible) {
      state.yaw = (params.room.getSnapshot().selected * Math.PI) / 2;
      state.parallaxX = 0;
      state.parallaxY = 0;
      state.armed = false;
    }
    state.visible = true;
    // Target-local input makes the same recipe work in an inset viewport.
    const x = ctx.targetPointer.normalizedX;
    const y = -ctx.targetPointer.normalizedY;
    const pointerEnabled =
      ctx.targetPointer.isInside &&
      !state.reduced.matches &&
      !params.room.pointerLocked();
    if (pointerEnabled && Math.abs(x) < projectRoomConfig.rearmThreshold)
      state.armed = true;
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
    state.parallaxX += ((pointerEnabled ? x : 0) - state.parallaxX) * smoothing;
    state.parallaxY += ((pointerEnabled ? y : 0) - state.parallaxY) * smoothing;
    if (state.reduced.matches) {
      state.parallaxX = 0;
      state.parallaxY = 0;
    }
    // The screen camera spans the runtime canvas; the pass maps that full frame
    // into the component's DOM viewport. Surface geometry is a unit plane.
    fitProjectRoomSurface(ctx.object, ctx.layout.viewport);
    state.layer?.setUniforms({
      viewport: [ctx.layout.width, Math.max(1, ctx.layout.height)],
      view: [
        wrapRoomAngle(state.yaw) + state.parallaxX * 0.045,
        -state.parallaxY * 0.025,
        state.parallaxX * 0.12,
        -state.parallaxY * 0.08,
      ],
    });
    ctx.object.surface?.setOpacity?.(1);
    params.room.publishFrame({
      ready: true,
      settled: Math.abs(wrapRoomAngle(target - state.yaw)) < 0.025,
    });
  },
  dispose(_ctx, state, params) {
    if (state.disposed) return;
    state.disposed = true;
    state.layer?.dispose();
    state.layer = undefined;
    params.room.publishFrame({ ready: false, settled: true });
  },
});

/** Register this stable array once on the ancestor runtime. */
export const projectRoomEffects = [projectRoomEffect] as const;

export function fitProjectRoomSurface(
  object: Pick<
    Parameters<typeof projectRoomEffect.update>[0]["object"],
    "position" | "scale"
  >,
  viewport: { readonly width: number; readonly height: number },
): void {
  object.position.set(viewport.width / 2, viewport.height / 2, 0);
  object.scale.set(viewport.width, viewport.height, 1);
}
