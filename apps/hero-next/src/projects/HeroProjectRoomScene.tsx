import { useFrame } from "@react-three/fiber";
import { useWebGLRuntime } from "@viselora/dom-webgl/react";
import React, { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { PerspectiveCamera, ShaderMaterial, Texture, type Mesh } from "three";
import { getHeroChapterContent } from "../chapters/content";
import { heroChapterDefinitions } from "../chapters/definitions";
import { readHeroChapterScrollState } from "../chapters/scrollState";
import type { HeroLocaleStore } from "../preferences/locale";
import { placeHeroScreenPlane } from "../shared/screenPlane";
import { updateHeroUniforms } from "../shared/shaderUniforms";
import { readHeroTransitionSignals } from "../transition/signals";
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

export function HeroProjectRoomScene({
  locale: localeStore,
  room,
  pointerActive,
}: {
  readonly locale: HeroLocaleStore;
  readonly room: ProjectRoomStore;
  readonly pointerActive: { current: boolean };
}) {
  const runtime = useWebGLRuntime();
  const locale = useSyncExternalStore(
    localeStore.subscribe,
    localeStore.getSnapshot,
    localeStore.getServerSnapshot,
  );
  const mesh = useRef<Mesh>(null);
  const desktop = useMemo(
    () => window.matchMedia(projectRoomConfig.desktopQuery),
    [],
  );
  const reduced = useMemo(
    () => window.matchMedia("(prefers-reduced-motion: reduce)"),
    [],
  );
  const material = useMemo(
    () =>
      new ShaderMaterial(
        createProjectRoomProgram(
          createProjectRoomTexture(
            getHeroChapterContent("builds", locale).body,
          ),
        ),
      ),
    [locale],
  );
  const motion = useRef({
    yaw: 0,
    parallaxX: 0,
    parallaxY: 0,
    armed: false,
    wasVisible: false,
  });
  useEffect(
    () => () => {
      const texture = material.uniforms.inkAtlas?.value;
      if (texture instanceof Texture) texture.dispose();
      material.dispose();
      room.publishFrame({ ready: false, active: false, settled: true });
    },
    [material, room],
  );
  useFrame(({ pointer, size: viewport, camera }, delta) => {
    const state = motion.current;
    const chapter = readHeroChapterScrollState(runtime.progress);
    const visible =
      desktop.matches &&
      chapter.chapterId === "builds" &&
      chapter.domContentActive;
    if (!mesh.current || !(camera instanceof PerspectiveCamera)) return;
    mesh.current.visible = visible;
    if (!visible) {
      state.wasVisible = false;
      room.setHovered(false);
      room.setFocused(false);
      room.publishFrame({
        ready: desktop.matches,
        active: false,
        settled: true,
      });
      return;
    }
    if (!state.wasVisible) {
      state.yaw = (room.getSnapshot().selected * Math.PI) / 2;
      state.parallaxX = 0;
      state.parallaxY = 0;
      state.armed = false;
    }
    state.wasVisible = true;
    const weight = roomInteractionWeight(
      runtime.progress.get(heroChapterDefinitions.builds.signals.body),
    );
    const interactive = weight > 0.999;
    const x = pointer.x;
    const y = -pointer.y;
    const pointerEnabled =
      interactive &&
      pointerActive.current &&
      !reduced.matches &&
      !room.pointerLocked();
    if (Math.abs(x) < projectRoomConfig.rearmThreshold) state.armed = true;
    const turn = pointerEnabled ? resolveRoomTurn(x, y, state.armed) : 0;
    if (turn) {
      room.select(room.getSnapshot().selected + turn);
      state.armed = false;
    }
    const target = (room.getSnapshot().selected * Math.PI) / 2;
    state.yaw = stepRoomAngle(state.yaw, target, delta * 1000, reduced.matches);
    const smoothing =
      1 - Math.exp(-Math.max(0, Math.min(delta * 1000, 64)) / 120);
    const px = pointerEnabled ? x : 0;
    const py = pointerEnabled ? y : 0;
    state.parallaxX += (px - state.parallaxX) * smoothing;
    state.parallaxY += (py - state.parallaxY) * smoothing;
    if (reduced.matches) {
      state.parallaxX = 0;
      state.parallaxY = 0;
    }
    placeHeroScreenPlane(mesh.current, camera, viewport, 3);
    updateHeroUniforms(material.uniforms, {
      viewport: [viewport.width, viewport.height],
      view: [
        (reduced.matches && !interactive
          ? 0
          : wrapRoomAngle(state.yaw) * weight) +
          state.parallaxX * 0.045 * weight,
        -state.parallaxY * 0.025 * weight,
        state.parallaxX * 0.12 * weight,
        -state.parallaxY * 0.08 * weight,
      ],
      ...projectRoomColors(
        readHeroTransitionSignals(runtime.progress).committedScheme ===
          "inverted",
      ),
    });
    room.publishFrame({
      ready: true,
      active: interactive,
      settled: Math.abs(wrapRoomAngle(target - state.yaw)) < 0.025,
    });
  });
  return (
    <mesh
      ref={mesh}
      name="hero.projects.room"
      material={material}
      visible={false}
    >
      <planeGeometry args={[1, 1]} />
    </mesh>
  );
}
