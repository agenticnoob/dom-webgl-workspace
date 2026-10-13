import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useWebGLRuntime } from "@viselora/dom-webgl/react";
import React, { Suspense, useEffect, useMemo, useRef } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { Mesh, MeshStandardMaterial, type Group, type Material } from "three";
import { clone } from "three/addons/utils/SkeletonUtils.js";

import { heroChapterDefinitions } from "../chapters/definitions";
import { readHeroChapterScrollState } from "../chapters/scrollState";
import {
  createHeroMotionState,
  stepHeroMotionState,
} from "../tetrahedron/motion";
import { readHeroTransitionSignals } from "../transition/signals";
import { configureHeroProfileMaterial } from "./materialShader";
import {
  heroProfileMaterialRoughness,
  resolveHeroProfileMaterialColor,
  resolveHeroProfileModelFrame,
} from "./modelEffect";

export function HeroProfileModel({
  pointerActive,
}: {
  readonly pointerActive: { current: boolean };
}) {
  return (
    <ErrorBoundary fallback={null}>
      <Suspense fallback={null}>
        <ProfileModel pointerActive={pointerActive} />
      </Suspense>
    </ErrorBoundary>
  );
}

function ProfileModel({
  pointerActive,
}: {
  readonly pointerActive: { current: boolean };
}) {
  const gltf = useGLTF("/models/noobli-profile.glb", "/draco/gltf/");
  const runtime = useWebGLRuntime();
  const root = useRef<Group>(null);
  const resources = useMemo(() => {
    const object = clone(gltf.scene);
    const materials = new Set<MeshStandardMaterial>();
    object.traverse((child) => {
      if (!(child instanceof Mesh)) return;
      const prepare = (source: Material) => {
        if (!(source instanceof MeshStandardMaterial)) return source;
        const material = source.clone();
        configureHeroProfileMaterial(material);
        material.color.set(resolveHeroProfileMaterialColor("initial"));
        material.emissiveIntensity = 0;
        material.metalness = 0;
        material.roughness = heroProfileMaterialRoughness;
        materials.add(material);
        return material;
      };
      child.material = Array.isArray(child.material)
        ? child.material.map(prepare)
        : prepare(child.material);
    });
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    return {
      object,
      materials,
      reducedMotion,
      motion: createHeroMotionState(reducedMotion),
    };
  }, [gltf.scene]);
  useEffect(
    () => () => {
      resources.materials.forEach((material) => material.dispose());
    },
    [resources],
  );
  useFrame(({ pointer, size, clock }, delta) => {
    if (!root.current) return;
    const time = clock.elapsedTime * 1000;
    stepHeroMotionState(resources.motion, {
      time,
      delta: delta * 1000,
      pointerInside: pointerActive.current,
      pointerX: pointer.x,
      pointerY: pointer.y,
    });
    const transition = readHeroTransitionSignals(runtime.progress);
    const frame = resolveHeroProfileModelFrame({
      chapter: readHeroChapterScrollState(runtime.progress),
      spinProgress: runtime.progress.get(
        heroChapterDefinitions.self.signals.body,
      ),
      viewport: size,
      reducedMotion: resources.reducedMotion,
      motion: resources.motion,
      time,
      transition: {
        coverage: transition.coverage,
        phase: transition.phase,
        shakeActive: transition.phase === "expanding",
      },
    });
    root.current.visible = frame.visible;
    root.current.position.set(...frame.position);
    root.current.rotation.set(...frame.rotation);
    root.current.scale.set(...frame.scale);
  });
  return (
    <group ref={root} name="hero.profile.model" dispose={null}>
      <primitive object={resources.object} />
    </group>
  );
}
