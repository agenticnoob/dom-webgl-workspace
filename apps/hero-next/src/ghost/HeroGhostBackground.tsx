import { useFrame } from "@react-three/fiber";
import { useWebGLRuntime } from "@viselora/dom-webgl/react";
import React, { useEffect, useMemo, useRef } from "react";
import {
  PerspectiveCamera,
  ShaderMaterial,
  type Mesh,
  type PointLight,
} from "three";

import { updateHeroUniforms } from "../shared/shaderUniforms";
import { placeHeroScreenPlane } from "../shared/screenPlane";
import { readHeroViewport } from "../shared/viewport";
import { heroTransitionConfig } from "../transition/transitionConfig";
import {
  resolveHeroGhostCursorIntensityScale,
  resolveHeroGhostProgramState,
  resolveHeroPointerLightIntensityScale,
} from "./backgroundEffect";
import {
  createHeroGhostCursorMaterialProgram,
  createHeroGhostCursorUniforms,
} from "./cursorProgram";
import {
  createHeroGhostCursorState,
  stepHeroGhostCursorState,
} from "./cursorState";
import {
  createHeroPointerLightState,
  updateHeroPointerLight,
} from "./pointerLight";

export function HeroGhostBackground({
  pointerActive,
}: {
  readonly pointerActive: { current: boolean };
}) {
  const runtime = useWebGLRuntime();
  const plane = useRef<Mesh>(null);
  const light = useRef<PointLight>(null);
  const resources = useMemo(() => {
    const viewport = readHeroViewport();
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const motion = createHeroGhostCursorState(
      "background",
      viewport.width,
      viewport.height,
      reduced,
    );
    const options = {
      ...viewport,
      pointerX: motion.pointerX,
      pointerY: motion.pointerY,
      pointerIntensity: 0,
      time: 0,
      brightness: heroTransitionConfig.visual.ghostBrightness,
      trailPoints: motion.trail,
      ...resolveHeroGhostProgramState(runtime.progress, viewport),
    };
    return {
      motion,
      pointerLight: createHeroPointerLightState(reduced),
      material: new ShaderMaterial(
        createHeroGhostCursorMaterialProgram("background", options),
      ),
    };
  }, [runtime]);
  useEffect(() => () => resources.material.dispose(), [resources]);
  useFrame(({ pointer, size, camera, clock }, delta) => {
    if (!plane.current || !(camera instanceof PerspectiveCamera)) return;
    const localX = ((pointer.x + 1) * size.width) / 2;
    const localY = ((1 - pointer.y) * size.height) / 2;
    const active = pointerActive.current;
    stepHeroGhostCursorState(resources.motion, {
      active,
      x: localX,
      y: localY,
    });
    updateHeroPointerLight(light.current ?? undefined, resources.pointerLight, {
      active,
      localX,
      localY,
      width: size.width,
      height: size.height,
      delta: delta * 1000,
      intensityScale: resolveHeroPointerLightIntensityScale(runtime.progress),
    });
    placeHeroScreenPlane(plane.current, camera, size, 5, undefined, 1.06);
    const visual = resolveHeroGhostProgramState(runtime.progress, size);
    plane.current.visible = visual.sceneOpacity > 0;
    updateHeroUniforms(
      resources.material.uniforms,
      createHeroGhostCursorUniforms("background", {
        ...size,
        ...visual,
        pointerX: resources.motion.pointerX,
        pointerY: resources.motion.pointerY,
        pointerIntensity:
          resources.motion.intensity *
          resolveHeroGhostCursorIntensityScale(runtime.progress),
        time: resources.motion.reducedMotion ? 0 : clock.elapsedTime * 1000,
        brightness: heroTransitionConfig.visual.ghostBrightness,
        trailPoints: resources.motion.trail,
      }),
    );
  });
  return (
    <>
      <mesh
        ref={plane}
        name="hero.ghost.background"
        material={resources.material}
        renderOrder={-10}
      >
        <planeGeometry args={[1, 1]} />
      </mesh>
      <pointLight ref={light} name="hero.pointer-light" intensity={0} />
    </>
  );
}
