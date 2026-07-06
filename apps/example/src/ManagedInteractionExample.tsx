import * as React from "react";
import {
  WebGLLight,
  WebGLCamera,
  WebGLPassViewport,
  WebGLScene,
  WebGLStagePlane,
  type WebGLCameraProps,
  type WebGLSceneRenderOptions,
  type WebGLStagePlaneProps,
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
  },
} satisfies NonNullable<WebGLCameraProps["controller"]>;

const floorSize = [820, 460] satisfies NonNullable<WebGLStagePlaneProps["size"]>;
const floorRole = "floor" satisfies NonNullable<WebGLStagePlaneProps["role"]>;
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
    clickOpacity: 1,
  },
] as const;
const floorInteraction = {
  pickable: {
    hitTest: "mesh",
    pointer: { hover: true, click: true },
  },
} satisfies NonNullable<WebGLStagePlaneProps["interaction"]>;

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
          Phase 8 keeps this dogfood intentionally narrow: the floor is the
          only pickable scene object, and primary drag stays camera-owned for
          orbit checks.
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
            role={floorRole}
            size={floorSize}
            position={floorPosition}
            material={floorMaterial}
            effects={floorEffects}
            interaction={floorInteraction}
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
    </section>
  );
}
