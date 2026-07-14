"use client";

import type { WebGLDeclaration } from "@viselora/dom-webgl";
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
import { WebGLScrollRuntime } from "@viselora/scroll-adapters/react";
import React from "react";

import { heroTetrahedronEffect } from "./heroEffect";
import { heroGhostEffects } from "./heroGhostEffects";
import { heroSmoothScroll } from "./heroScroll";

const heroEffects = [heroTetrahedronEffect, ...heroGhostEffects] as const;

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
      color: "#b497cf",
      brightness: 0.72,
      depth: 5,
      fov: 38,
      overscan: 1.06,
    },
  ],
} satisfies WebGLDeclaration;

const tetrahedronGeometry = {
  kind: "tetrahedron",
  radius: 0.52,
} satisfies WebGLMeshProps["geometry"];

const tetrahedronMaterial = {
  kind: "standard",
  color: "#30343b",
  emissive: "#0a1012",
  emissiveIntensity: 0.03,
  metalness: 0.8,
  roughness: 0.12,
} satisfies NonNullable<WebGLMeshProps["material"]>;

const tetrahedronEffects = [
  { kind: "hero.tetrahedron.motion", baseScale: 1.12 },
] satisfies NonNullable<WebGLMeshProps["effects"]>;

const cameraPosition = [0, 0.18, 3.2] satisfies NonNullable<
  WebGLCameraProps["position"]
>;
const cameraTarget = [0, 0.32, 0] satisfies NonNullable<
  WebGLCameraProps["target"]
>;
const keyLightPosition = [-2.4, 1.2, 2.2] satisfies NonNullable<
  WebGLLightProps["position"]
>;
const rimLightPosition = [2.8, -2.4, 2] satisfies NonNullable<
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
      smooth={heroSmoothScroll}
    >
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
          />
          {/* <WebGLLight
            id="hero.tetrahedron.fill"
            kind="ambient"
            color="#d9dce3"
            intensity={0.22}
          /> */}
          {/* <WebGLLight
            id="hero.tetrahedron.key"
            kind="directional"
            color="#eef2f7"
            intensity={3.8}
            position={keyLightPosition}
            target={lightTarget}
          /> */}
          {/* <WebGLLight
            id="hero.tetrahedron.rim"
            kind="directional"
            color="#b497cf"
            intensity={3.2}
            position={rimLightPosition}
            target={lightTarget}
          /> */}
        </WebGLScene>
      </main>
    </WebGLScrollRuntime>
  );
}
