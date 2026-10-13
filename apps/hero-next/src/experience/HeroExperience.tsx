"use client";

import type { CanvasProps } from "@react-three/fiber";
import { useWebGLRuntime } from "@viselora/dom-webgl/react";
import {
  WebGLScrollRuntime,
  useScrollEffectProgressStore,
} from "@viselora/scroll-adapters/react";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";

import { HeroChapterNarrative } from "../chapters/HeroChapterNarrative";
import { heroSiteContent } from "../chapters/content";
import { HeroTetrahedron } from "../tetrahedron/HeroTetrahedron";
import { HeroProfileModel } from "../profile/HeroProfileModel";
import {
  useHeroDomContentActive,
  useHeroLocaleState,
  useHeroThemeState,
} from "./useHeroExperienceState";
import { HeroGhostBackground } from "../ghost/HeroGhostBackground";
import { heroSmoothScroll, refreshHeroScrollLayout } from "./smoothScroll";
import { HeroPortalStage } from "../transition/HeroPortalStage";
import { HeroPortalScene } from "../transition/HeroPortalScene";
import { heroTransitionConfig } from "../transition/transitionConfig";
import { HeroAxiomsScene } from "../axioms/HeroAxiomsScene";
import { HeroProjectRoomScene } from "../projects/HeroProjectRoomScene";
import {
  createProjectRoomStore,
  type ProjectRoomStore,
} from "../projects/room";

export const heroCanvasOptions = {
  gl: { antialias: true, alpha: true },
  orthographic: false,
  dpr: [1, 2],
  camera: {
    fov: heroTransitionConfig.chapterGeometry.cameraFov,
    near: 0.1,
    far: 50,
    position: [0, 0, heroTransitionConfig.chapterGeometry.cameraDistance],
  },
  onCreated: ({ camera }) => {
    camera.lookAt(0, heroTransitionConfig.chapterGeometry.cameraTargetY, 0);
    camera.updateMatrixWorld();
  },
} satisfies Omit<CanvasProps, "children">;

type HeroState = {
  readonly theme: ReturnType<typeof useHeroThemeState>;
  readonly locale: ReturnType<typeof useHeroLocaleState>;
  readonly projectRoom: ProjectRoomStore;
};

export function HeroExperience() {
  const theme = useHeroThemeState();
  const locale = useHeroLocaleState();
  const projectRoom = useMemo(createProjectRoomStore, []);
  return (
    <WebGLScrollRuntime
      className="hero-runtime"
      smooth={heroSmoothScroll}
      canvas={heroCanvasOptions}
      scene={
        <HeroCanvasScene
          theme={theme}
          locale={locale}
          projectRoom={projectRoom}
        />
      }
    >
      <HeroSemanticScene
        theme={theme}
        locale={locale}
        projectRoom={projectRoom}
      />
    </WebGLScrollRuntime>
  );
}

function HeroCanvasScene({ theme, locale, projectRoom }: HeroState) {
  const pointerActive = useRef(false);
  useEffect(() => {
    const enter = () => {
      pointerActive.current = true;
    };
    const leave = () => {
      pointerActive.current = false;
    };
    window.addEventListener("pointermove", enter, { passive: true });
    document.documentElement.addEventListener("pointerleave", leave);
    window.addEventListener("blur", leave);
    return () => {
      window.removeEventListener("pointermove", enter);
      document.documentElement.removeEventListener("pointerleave", leave);
      window.removeEventListener("blur", leave);
    };
  }, []);
  return (
    <group name="hero.tetrahedron.scene">
      <HeroTetrahedron
        theme={theme.store}
        locale={locale.store}
        pointerActive={pointerActive}
      />
      <HeroGhostBackground pointerActive={pointerActive} />
      <HeroPortalScene
        textKey={`${theme.scheme}:${locale.locale}`}
        pointerActive={pointerActive}
      />
      <HeroProfileModel pointerActive={pointerActive} />
      <HeroAxiomsScene locale={locale.store} />
      <HeroProjectRoomScene
        locale={locale.store}
        room={projectRoom}
        pointerActive={pointerActive}
      />
      <ambientLight name="hero.scene.ambient" intensity={0.45} />
      <directionalLight
        name="hero.scene.fill"
        intensity={1}
        position={[1, 1.5, 2]}
      />
      <directionalLight
        name="hero.tetrahedron.key"
        color="#f2f2f2"
        intensity={heroTransitionConfig.visual.keyLightIntensity}
        position={[1.6, 2.2, 2.6]}
      />
      <directionalLight
        name="hero.tetrahedron.rim"
        color="#b8b8b8"
        intensity={heroTransitionConfig.visual.rimLightIntensity}
        position={[-2.2, -1.2, 0.8]}
      />
    </group>
  );
}

function HeroSemanticScene({ theme, locale, projectRoom }: HeroState) {
  const runtime = useWebGLRuntime();
  const readReady = useCallback(() => runtime.getDebugState().ready, [runtime]);
  const ready = useSyncExternalStore(runtime.subscribe, readReady, () => false);
  const store = useScrollEffectProgressStore();
  const domContentActive = useHeroDomContentActive(store.source);
  useEffect(() => {
    if (!ready)
      projectRoom.publishFrame({ ready: false, active: false, settled: true });
    refreshHeroScrollLayout();
  }, [ready, projectRoom]);
  return (
    <main
      className="hero-space"
      aria-label={heroSiteContent[locale.locale].ariaLabel}
      data-hero-theme={theme.scheme}
      data-hero-locale={locale.locale}
      data-dom-active={domContentActive ? "true" : "false"}
      data-webgl-ready={ready ? "true" : "false"}
    >
      <HeroPortalStage
        locale={locale.locale}
        progress={store.source}
        styleKey={theme.scheme}
      />
      <HeroChapterNarrative
        locale={locale.locale}
        onLocaleChange={locale.store.commit}
        onLayoutChange={refreshHeroScrollLayout}
        projectRoom={projectRoom}
      />
    </main>
  );
}
