"use client";

import {
  WebGLCamera,
  WebGLLight,
  WebGLModel,
  WebGLScene,
  type WebGLCameraProps,
  type WebGLLightProps,
  type WebGLModelProps,
  type WebGLSceneRenderOptions,
} from "@viselora/dom-webgl/react";
import { WebGLScrollRuntime } from "@viselora/scroll-adapters/react";
import React from "react";

import { heroEffects } from "./heroEffect";
import { heroSmoothScroll } from "./heroScroll";

const renderOptions = {
  id: "hero.tetrahedron.pass",
  camera: "hero.tetrahedron.camera",
  order: 0,
  clear: true,
  clearDepth: true,
} satisfies WebGLSceneRenderOptions;

const modelLoader = {
  draco: { decoderPath: "/draco/gltf/" },
} satisfies NonNullable<WebGLModelProps["loader"]>;

const modelEffects = [
  { kind: "hero.tetrahedron.breathe", baseScale: 1.08 },
] satisfies NonNullable<WebGLModelProps["effects"]>;

const modelPrepare = {
  renderWarmup: "idle",
} satisfies NonNullable<WebGLModelProps["prepare"]>;

const cameraPosition = [
  0,
  0.18,
  3.2,
] satisfies NonNullable<WebGLCameraProps["position"]>;
const cameraTarget = [
  0,
  0.12,
  0,
] satisfies NonNullable<WebGLCameraProps["target"]>;
const coolLightPosition = [
  -2.4,
  1.2,
  2.2,
] satisfies NonNullable<WebGLLightProps["position"]>;
const warmLightPosition = [
  2.1,
  -0.4,
  1.4,
] satisfies NonNullable<WebGLLightProps["position"]>;

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
          <WebGLModel
            id="hero.tetrahedron.model"
            src="/models/4.glb"
            loader={modelLoader}
            effects={modelEffects}
            prepare={modelPrepare}
          />
          <WebGLLight
            id="hero.tetrahedron.fill"
            kind="ambient"
            color="#dfe3e5"
            intensity={0.42}
          />
          <WebGLLight
            id="hero.tetrahedron.cool-rim"
            kind="point"
            color="#d9e5ec"
            intensity={10.5}
            distance={8}
            decay={2}
            position={coolLightPosition}
          />
          <WebGLLight
            id="hero.tetrahedron.warm-rim"
            kind="point"
            color="#e8ded2"
            intensity={8.2}
            distance={7}
            decay={2}
            position={warmLightPosition}
          />
        </WebGLScene>
      </main>
    </WebGLScrollRuntime>
  );
}
