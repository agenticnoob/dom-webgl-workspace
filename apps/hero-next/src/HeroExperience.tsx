"use client";

import type {
  WebGLDeclaration,
  WebGLRenderQualityDeclaration,
} from "@viselora/dom-webgl";
import {
  WebGLCamera,
  WebGLLight,
  WebGLMesh,
  WebGLScene,
  WebGLTarget,
  type WebGLCameraProps,
  type WebGLLightProps,
  type WebGLMeshProps,
  type WebGLSceneRenderOptions,
} from "@viselora/dom-webgl/react";
import {
  WebGLScrollRuntime,
  useScrollEffectProgressStore,
} from "@viselora/scroll-adapters/react";
import React, { useMemo } from "react";

import { heroTetrahedronEffect } from "./heroEffect";
import { heroGhostEffects } from "./heroGhostEffects";
import { heroSmoothScroll } from "./heroScroll";
import { heroTransitionConfig } from "./heroTransitionConfig";
import type { HeroTransitionSignalWriter } from "./heroTransitionSignals";

const heroEffects = [heroTetrahedronEffect, ...heroGhostEffects] as const;

const heroRenderQuality = {
  antialias: true,
  maxDevicePixelRatio: 2,
} satisfies WebGLRenderQualityDeclaration;

const renderOptions = {
  id: "hero.tetrahedron.pass",
  camera: "hero.tetrahedron.camera",
  order: 0,
  clear: true,
  clearDepth: true,
} satisfies WebGLSceneRenderOptions;

const ghostBackgroundDeclaration = {
  key: "hero.ghost.background",
  placement: { mode: "screen-depth", depth: 5, size: "dom" },
  source: { kind: "dom", type: "element" },
  renderRole: "model",
  lifecycle: { hideWhenReady: true, hideMode: "self" },
  effects: [
    {
      kind: "hero.ghost.background",
      depth: 5,
      fov: 38,
      overscan: 1.06,
    },
  ],
} satisfies WebGLDeclaration;

const tetrahedronGeometry = {
  kind: "tetrahedron",
  radius: heroTransitionConfig.geometry.radius,
} satisfies WebGLMeshProps["geometry"];

const tetrahedronMaterial = {
  kind: "standard",
  color: heroTransitionConfig.colors.dark,
  emissive: heroTransitionConfig.colors.dark,
  emissiveIntensity: heroTransitionConfig.motion.emissiveIntensity,
  opacity: heroTransitionConfig.motion.initialOpacity,
  metalness: 0.9,
  roughness: 0.12,
} satisfies NonNullable<WebGLMeshProps["material"]>;

const tetrahedronInteraction = {
  pickable: {
    hitTest: "mesh",
    pointer: { press: true },
  },
} satisfies NonNullable<WebGLMeshProps["interaction"]>;

const cameraPosition = [0, 0, 3.2] satisfies NonNullable<
  WebGLCameraProps["position"]
>;
const cameraTarget = [0, 0.32, 0] satisfies NonNullable<
  WebGLCameraProps["target"]
>;
const keyLightPosition = [1.2, 1.2, 2] satisfies NonNullable<
  WebGLLightProps["position"]
>;
const rimLightPosition = [1.8, -1.4, 2] satisfies NonNullable<
  WebGLLightProps["position"]
>;
const lightTarget = [0, 0, 0] satisfies NonNullable<
  WebGLLightProps["target"]
>;

export function HeroExperience() {
  return (
    <WebGLScrollRuntime
      className="hero-runtime"
      effects={heroEffects}
      renderQuality={heroRenderQuality}
      smooth={heroSmoothScroll}
    >
      <HeroScene />
    </WebGLScrollRuntime>
  );
}

function HeroScene() {
  const store = useScrollEffectProgressStore();
  const signalWriter = useMemo<HeroTransitionSignalWriter>(
    () => ({ set: (key, value) => store.set(key, value) }),
    [store],
  );
  const tetrahedronEffects = useMemo(
    () =>
      ([
        { kind: "hero.tetrahedron.motion", signals: signalWriter },
      ] satisfies NonNullable<WebGLMeshProps["effects"]>),
    [signalWriter],
  );

  return (
    <main className="hero-space" aria-label="Tetrahedron visual study">
      <WebGLScene
        id="hero.tetrahedron.scene"
        projection="perspective-stage"
        render={renderOptions}
      >
        <WebGLCamera
          id="hero.tetrahedron.camera"
          default
          type="perspective"
          mode="perspective-stage"
          fov={38}
          near={0.1}
          far={50}
          position={cameraPosition}
          target={cameraTarget}
        />
        <WebGLTarget
          as="div"
          className="hero-ghost-surface hero-ghost-surface--background"
          aria-hidden="true"
          webgl={ghostBackgroundDeclaration}
        />
        <WebGLMesh
          id="hero.tetrahedron.mesh"
          geometry={tetrahedronGeometry}
          material={tetrahedronMaterial}
          effects={tetrahedronEffects}
          interaction={tetrahedronInteraction}
        />
        {/* <WebGLLight
          id="hero.tetrahedron.fill"
          kind="ambient"
          color="#d8d8d8"
          intensity={0.22}
        /> */}
        <WebGLLight
          id="hero.tetrahedron.key"
          kind="directional"
          color="#f2f2f2"
          intensity={4.8}
          position={keyLightPosition}
          target={lightTarget}
        />
        <WebGLLight
          id="hero.tetrahedron.rim"
          kind="directional"
          color="#b8b8b8"
          intensity={2.2}
          position={rimLightPosition}
          target={lightTarget}
        />
      </WebGLScene>
    </main>
  );
}
