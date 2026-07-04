import * as React from "react";
import {
  WebGLLight,
  WebGLCamera,
  WebGLScene,
  WebGLStageBox,
  WebGLStagePlane,
  type WebGLCameraProps,
  type WebGLSceneRenderOptions,
  type WebGLStageBoxProps,
  type WebGLStagePlaneProps,
} from "@project/dom-webgl-runtime/react";

const stageSceneRender = {
  camera: "example.stage.camera",
  order: -10,
  clearDepth: true,
} satisfies WebGLSceneRenderOptions;

const cameraPosition = [0, 120, 520] satisfies NonNullable<
  WebGLCameraProps["position"]
>;
const cameraTarget = [0, -80, 0] satisfies NonNullable<
  WebGLCameraProps["target"]
>;

const floorSize = [900, 520] satisfies NonNullable<
  WebGLStagePlaneProps["size"]
>;
const floorPosition = [0, -180, 0] satisfies NonNullable<
  WebGLStagePlaneProps["position"]
>;
const floorMaterial = {
  kind: "standard",
  color: "#111827",
  roughness: 0.84,
} satisfies NonNullable<WebGLStagePlaneProps["material"]>;

const backdropSize = [900, 420] satisfies NonNullable<
  WebGLStagePlaneProps["size"]
>;
const backdropPosition = [0, 20, -260] satisfies NonNullable<
  WebGLStagePlaneProps["position"]
>;
const backdropMaterial = {
  kind: "standard",
  color: "#172554",
  roughness: 0.72,
} satisfies NonNullable<WebGLStagePlaneProps["material"]>;

const plinthSize = [180, 96, 180] satisfies NonNullable<
  WebGLStageBoxProps["size"]
>;
const plinthPosition = [0, -128, -40] satisfies NonNullable<
  WebGLStageBoxProps["position"]
>;
const plinthMaterial = {
  kind: "standard",
  color: "#475569",
  roughness: 0.58,
} satisfies NonNullable<WebGLStageBoxProps["material"]>;

const keyLightPosition = [120, 80, 160] satisfies NonNullable<
  WebGLCameraProps["position"]
>;

export function ManagedStagePrimitiveExample() {
  return (
    <section className="example-row example-stage-dogfood">
      <div className="example-stage-copy">
        <p className="example-kicker">managed stage</p>
        <h2>声明式灯光和舞台几何</h2>
        <p>
          这个例子只通过公共 React 描述符声明 floor、backdrop、box 和 scene-owned
          lights；runtime 仍拥有 Three.js mesh、material、light 和 dispose。
        </p>
      </div>

      <div className="example-stage-viewport" aria-hidden="true">
        <WebGLScene
          id="example.stage.world"
          projection="perspective-stage"
          render={stageSceneRender}
        >
          <WebGLCamera
            id="example.stage.camera"
            default
            type="perspective"
            mode="perspective-stage"
            position={cameraPosition}
            target={cameraTarget}
          />
          <WebGLStagePlane
            id="example.stage.floor"
            role="floor"
            size={floorSize}
            position={floorPosition}
            material={floorMaterial}
          />
          <WebGLStagePlane
            id="example.stage.backdrop"
            role="backdrop"
            size={backdropSize}
            position={backdropPosition}
            material={backdropMaterial}
          />
          <WebGLStageBox
            id="example.stage.plinth"
            size={plinthSize}
            position={plinthPosition}
            material={plinthMaterial}
          />
          <WebGLLight id="example.stage.ambient" kind="ambient" intensity={0.28} />
          <WebGLLight
            id="example.stage.key"
            kind="point"
            color="#7dd3fc"
            intensity={1.8}
            position={keyLightPosition}
          />
        </WebGLScene>
      </div>
    </section>
  );
}
