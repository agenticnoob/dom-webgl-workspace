import * as React from "react";
import {
  WebGLLight,
  WebGLCamera,
  WebGLModel,
  WebGLPassViewport,
  WebGLScene,
  WebGLStagePlane,
  WebGLTarget,
  type WebGLCameraProps,
  type WebGLModelProps,
  type WebGLSceneRenderOptions,
  type WebGLStagePlaneProps,
  type WebGLTargetProps,
} from "@project/dom-webgl-runtime/react";

const interactionSceneRender = {
  camera: "example.interaction.camera",
  order: -7,
  clearDepth: true,
  viewport: { mode: "dom-rect", scissor: true },
} satisfies WebGLSceneRenderOptions;

const cameraPosition = [120, 132, 620] satisfies NonNullable<
  WebGLCameraProps["position"]
>;
const cameraTarget = [120, -78, -70] satisfies NonNullable<
  WebGLCameraProps["target"]
>;
const cameraController = {
  pointer: {
    orbit: {
      drag: { button: "primary" },
      target: [120, -78, -70],
      sensitivity: [0.0035, 0.003],
      minPolarAngle: 0.52,
      maxPolarAngle: 1.42,
      minDistance: 240,
      maxDistance: 980,
    },
    pan: {
      drag: { button: "secondary" },
      sensitivity: [0.9, 0.9],
    },
    dolly: {
      drag: { button: "primary", modifier: "alt" },
      sensitivity: 1.4,
      minDistance: 240,
      maxDistance: 980,
    },
    parallax: {
      scope: "camera",
      strength: [16, 8],
      maxOffset: [28, 16],
    },
    damping: {
      factor: 0.18,
      settleEpsilon: 0.001,
    },
    reset: {
      onDoubleClick: true,
      durationMs: 220,
    },
  },
} satisfies NonNullable<WebGLCameraProps["controller"]>;

const floorSize = [820, 460] satisfies NonNullable<WebGLStagePlaneProps["size"]>;
const floorPosition = [0, -180, -70] satisfies NonNullable<
  WebGLStagePlaneProps["position"]
>;
const floorMaterial = {
  kind: "standard",
  color: "#23322f",
  roughness: 0.72,
} satisfies NonNullable<WebGLStagePlaneProps["material"]>;
const floorEffects = [
  {
    kind: "example.sceneObjectHoverPulse",
    baseOpacity: 0.68,
    hoverOpacity: 0.92,
    dragOpacity: 1,
  },
] as const;
const floorInteraction = {
  pickable: {
    hitTest: "bounds",
    pointer: { hover: true, press: true, click: true },
  },
} satisfies NonNullable<WebGLStagePlaneProps["interaction"]>;

const heroModelLoader = {
  draco: { decoderPath: "/draco/gltf/", preload: true },
} satisfies NonNullable<WebGLModelProps["loader"]>;
const heroModelPosition = [180, -118, -42] satisfies NonNullable<
  WebGLModelProps["position"]
>;
const heroModelPrepare = {
  renderWarmup: "idle",
} satisfies NonNullable<WebGLModelProps["prepare"]>;
const heroModelEffects = [
  {
    kind: "example.sceneObjectDragPose",
    baseScale: 4,
    hoverScale: 1.04,
    dragScale: 1.1,
    baseRotationY: -0.42,
  },
] as const;
const heroModelInteraction = {
  pickable: {
    hitTest: "bounds",
    pointer: { hover: true, press: true, drag: true, click: true },
  },
} satisfies NonNullable<WebGLModelProps["interaction"]>;

const screenPlaneTargetWebgl = {
  key: "example.interaction.screen-plane-card",
  sceneId: "example.interaction.scene",
  source: { kind: "dom", type: "element" },
  placement: {
    mode: "screen-plane",
    planeId: "example.interaction.floor",
    offset: [0, 6, 0],
    scale: 0.86,
  },
  lifecycle: { hideWhenReady: false },
  effects: [{ kind: "example.surfaceFill", opacity: 0.52 }],
} satisfies WebGLTargetProps<"article">["webgl"];

const keyLightPosition = [-160, 160, 180] satisfies NonNullable<
  WebGLCameraProps["position"]
>;

export function ManagedInteractionExample() {
  return (
    <section className="example-row example-interaction-dogfood">
      <div className="example-interaction-copy">
        <p className="example-kicker">managed interaction</p>
        <h2>Scene-native picking</h2>
        <p>
          Phase 8 keeps pointer routing inside runtime-owned objects: pickable
          stage/model descriptors feed object effects, while empty-space gestures
          keep camera orbit, pan, dolly, and reset runtime-owned.
        </p>
      </div>

      <WebGLPassViewport
        id="example.interaction.viewport"
        as="div"
        className="example-interaction-viewport"
        aria-hidden="true"
      >
        <WebGLScene
          id="example.interaction.scene"
          projection="perspective-stage"
          render={interactionSceneRender}
        >
          <WebGLCamera
            id="example.interaction.camera"
            default
            type="perspective"
            mode="perspective-stage"
            fov={42}
            position={cameraPosition}
            target={cameraTarget}
            controller={cameraController}
          />
          <WebGLStagePlane
            id="example.interaction.floor"
            role="floor"
            size={floorSize}
            position={floorPosition}
            material={floorMaterial}
            effects={floorEffects}
            interaction={floorInteraction}
          />
          <WebGLModel
            id="example.interaction.hero"
            src="/models/hero.glb"
            loader={heroModelLoader}
            position={heroModelPosition}
            scale={4}
            effects={heroModelEffects}
            interaction={heroModelInteraction}
            prepare={heroModelPrepare}
          />
          <WebGLLight id="example.interaction.ambient" kind="ambient" intensity={0.34} />
          <WebGLLight
            id="example.interaction.key"
            kind="point"
            color="#8bd6ca"
            intensity={2.35}
            position={keyLightPosition}
          />
        </WebGLScene>
      </WebGLPassViewport>

      <WebGLTarget
        as="article"
        className="example-interaction-card"
        webgl={screenPlaneTargetWebgl}
      >
        <span>screen-plane</span>
        <strong>DOM target projected onto the managed floor</strong>
      </WebGLTarget>
    </section>
  );
}
