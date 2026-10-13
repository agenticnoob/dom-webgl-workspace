import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useWebGLRuntime } from "@viselora/dom-webgl/react";
import { useScrollEffectProgressStore } from "@viselora/scroll-adapters/react";
import React, { useEffect, useMemo, useRef } from "react";
import type { BufferGeometry, Mesh, MeshStandardMaterial } from "three";

import {
  createHeroChapterAtlas,
  heroChapterAtlasMatchesViewport,
} from "../chapters/atlas";
import {
  readHeroChapterScrollState,
  readHeroChapterTailAtlasIds,
} from "../chapters/scrollState";
import type { HeroLocaleStore } from "../preferences/locale";
import type { HeroThemeStore } from "../preferences/theme";
import { updateHeroUniforms } from "../shared/shaderUniforms";
import { readHeroViewport } from "../shared/viewport";
import { heroTransitionConfig } from "../transition/transitionConfig";
import {
  advanceHeroHoldTransition,
  applyHeroFrame,
  createHeroEffectState,
  stepHeroMotionState,
} from "./effect";
import {
  createHeroTetrahedronMaterial,
  createHeroTetrahedronRadialUniforms,
} from "./shader";

export function HeroTetrahedron({
  theme,
  locale,
  pointerActive,
}: {
  readonly theme: HeroThemeStore;
  readonly locale: HeroLocaleStore;
  readonly pointerActive: { current: boolean };
}) {
  const runtime = useWebGLRuntime();
  const progressStore = useScrollEffectProgressStore();
  const mesh = useRef<Mesh<BufferGeometry, MeshStandardMaterial>>(null);
  const press = useRef({ primary: false, hit: false });
  const resources = useMemo(() => {
    const atlas = createHeroChapterAtlas(
      readHeroViewport(),
      locale.getSnapshot(),
    );
    return {
      ...createHeroTetrahedronMaterial(atlas.canvas),
      state: createHeroEffectState(
        window.matchMedia("(prefers-reduced-motion: reduce)").matches,
        theme.getSnapshot(),
        atlas,
      ),
    };
  }, [locale, theme]);

  useEffect(() => {
    const release = () => {
      press.current.primary = false;
    };
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    window.addEventListener("blur", release);
    return () => {
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
      window.removeEventListener("blur", release);
      resources.texture.dispose();
      resources.material.dispose();
    };
  }, [resources]);

  useFrame(({ pointer, clock, size, gl }, delta) => {
    if (!mesh.current) return;
    const { state, uniforms, texture } = resources;
    const time = clock.elapsedTime * 1000;
    const deltaMs = delta * 1000;
    stepHeroMotionState(state.motion, {
      time,
      delta: deltaMs,
      pointerInside: pointerActive.current,
      pointerX: pointer.x,
      pointerY: pointer.y,
    });
    const chapter = readHeroChapterScrollState(runtime.progress);
    if (
      state.chapterAtlas &&
      !heroChapterAtlasMatchesViewport(
        state.chapterAtlas,
        size,
        locale.getSnapshot(),
      )
    ) {
      state.chapterAtlas = createHeroChapterAtlas(size, locale.getSnapshot());
      texture.image = state.chapterAtlas.canvas;
      texture.needsUpdate = true;
    }
    advanceHeroHoldTransition(
      state,
      {
        interactionEnabled: chapter.hubInteractive,
        meshPressed: press.current.primary,
        primaryPointerDown: press.current.primary,
        hitConfirmed: press.current.hit,
        pointer: { x: (pointer.x + 1) / 2, y: (pointer.y + 1) / 2 },
        viewport: size,
        deltaMs,
      },
      progressStore,
      theme,
    );
    applyHeroFrame(
      mesh.current,
      state.motion,
      time,
      state.transition,
      size,
      state.reducedMotion,
      chapter,
    );
    updateHeroUniforms(uniforms, {
      ...createHeroTetrahedronRadialUniforms(
        state.transition,
        size,
        chapter,
        readHeroChapterTailAtlasIds(runtime.progress),
      ),
      domWebGLPixelRatio: gl.getPixelRatio(),
      domWebGLViewportSize: [size.width, size.height],
    });
  }, -2);

  const down = (event: ThreeEvent<PointerEvent>) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    press.current = { primary: true, hit: true };
  };
  return (
    <mesh
      ref={mesh}
      name="hero.tetrahedron.mesh"
      material={resources.material}
      onPointerDown={down}
      onPointerOver={() => {
        press.current.hit = true;
      }}
      onPointerOut={() => {
        press.current.hit = false;
      }}
      onPointerUp={() => {
        press.current.primary = false;
      }}
    >
      <tetrahedronGeometry args={[heroTransitionConfig.geometry.radius, 0]} />
    </mesh>
  );
}
