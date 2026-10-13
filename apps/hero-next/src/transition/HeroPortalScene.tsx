import { useFrame, useThree } from "@react-three/fiber";
import { createDOMTextTexture } from "@viselora/dom-webgl";
import { useWebGLRuntime } from "@viselora/dom-webgl/react";
import React, { useEffect, useMemo, useRef } from "react";
import { MeshBasicMaterial, PerspectiveCamera, type Mesh } from "three";
import { heroChapterOrder } from "../chapters/definitions";
import { placeHeroScreenPlane } from "../shared/screenPlane";
import {
  portalDepth,
  readPortalDeclarations,
  useHeroPortalRenderKey,
  type HeroPortalTarget,
} from "./HeroPortalStage";
import {
  createHeroPortalParallaxState,
  resolvePortalOpacity,
  stepHeroPortalParallax,
} from "./portalEffect";
import {
  readHeroPortalViewState,
  resolveHeroPortalMotion,
  type HeroPortalContentId,
} from "./portalState";
import { heroTransitionConfig } from "./transitionConfig";

export function HeroPortalScene({
  textKey,
  pointerActive,
}: {
  readonly textKey: string;
  readonly pointerActive: { current: boolean };
}) {
  const runtime = useWebGLRuntime();
  const renderKey = useHeroPortalRenderKey(runtime.progress);
  const size = useThree((state) => state.size);
  const ids: readonly HeroPortalContentId[] =
    renderKey === "site"
      ? ["site"]
      : renderKey === "none"
        ? []
        : renderKey === "site+content"
          ? ["site", heroChapterOrder[0]]
          : [renderKey];
  return (
    <>
      {ids.flatMap((id) => {
        const pair = readPortalDeclarations(id);
        return [...pair.left, ...pair.right].map((target) => (
          <PortalPlane
            key={`${textKey}:${size.width}:${size.height}:${target.id}`}
            target={target}
            pointerActive={pointerActive}
          />
        ));
      })}
    </>
  );
}

function PortalPlane({
  target,
  pointerActive,
}: {
  readonly target: HeroPortalTarget;
  readonly pointerActive: { current: boolean };
}) {
  const runtime = useWebGLRuntime();
  const mesh = useRef<Mesh>(null);
  const snapshot = useRef<ReturnType<typeof createDOMTextTexture> | undefined>(
    undefined,
  );
  const capturedTarget =
    useRef<ReturnType<typeof runtime.getTarget>>(undefined);
  const capturedRevision = useRef(-1);
  const material = useMemo(
    () =>
      new MeshBasicMaterial({
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      }),
    [],
  );
  const motion = useMemo(
    () => ({
      parallax: createHeroPortalParallaxState(),
      reduced: window.matchMedia("(prefers-reduced-motion: reduce)"),
    }),
    [],
  );
  useEffect(
    () => () => {
      runtime.setTargetReady(target.id, false, capturedTarget.current);
      snapshot.current?.dispose();
      snapshot.current = undefined;
      material.dispose();
    },
    [material, runtime, target.id],
  );
  useFrame(({ camera, size, pointer }, delta) => {
    if (!mesh.current || !(camera instanceof PerspectiveCamera)) return;
    const binding = runtime.getTarget(target.id);
    if (!binding || binding.rect.width <= 0 || binding.rect.height <= 0) {
      mesh.current.visible = false;
      return;
    }
    if (
      !snapshot.current ||
      capturedTarget.current !== binding ||
      capturedRevision.current !== binding.revision
    ) {
      snapshot.current?.dispose();
      snapshot.current = createDOMTextTexture(binding.element, {
        devicePixelRatio: Math.min(window.devicePixelRatio, 2),
      });
      material.map = snapshot.current.texture;
      material.needsUpdate = true;
      capturedTarget.current = binding;
      capturedRevision.current = binding.revision;
      runtime.setTargetReady(target.id, true, binding);
    }
    const params = target.motion;
    const frame = resolveHeroPortalMotion(
      readHeroPortalViewState(runtime.progress),
      params,
    );
    const hidden =
      params.hideAfterProgressKey !== undefined &&
      runtime.progress.get(params.hideAfterProgressKey) >= 1 - 0.0001;
    const opacity = hidden
      ? 0
      : resolvePortalOpacity(frame.opacity, size.width);
    stepHeroPortalParallax(motion.parallax, {
      delta: delta * 1000,
      pointerInside: pointerActive.current,
      pointerX: pointer.x,
      pointerY: pointer.y,
      reducedMotion: motion.reduced.matches,
      visible: frame.visible && opacity > 0.001,
    });
    const travelPx = motion.reduced.matches
      ? 0
      : Math.min(
          params.maxTravelPx,
          size.width * params.travelViewportFraction,
        );
    placeHeroScreenPlane(mesh.current, camera, size, portalDepth, {
      ...binding.rect,
      left: binding.rect.left + frame.horizontalOffsetProgress * travelPx,
    });
    mesh.current.rotation.set(
      -motion.parallax.y * heroTransitionConfig.portal.pointerPitch,
      (motion.reduced.matches ? 0 : frame.rotationY) +
        motion.parallax.x * heroTransitionConfig.portal.pointerYaw,
      0,
    );
    mesh.current.visible = !hidden && frame.visible && opacity > 0.001;
    material.opacity = opacity;
  });
  return (
    <mesh ref={mesh} name={target.id} material={material} visible={false}>
      <planeGeometry args={[1, 1]} />
    </mesh>
  );
}
