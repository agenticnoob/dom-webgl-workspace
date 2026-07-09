import * as React from "react";
import {
  WebGLLight,
  WebGLCamera,
  WebGLPassViewport,
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
  viewport: { mode: "dom-rect", scissor: true },
  postprocess: {
    bloom: { strength: 0.88, radius: 0.58, threshold: 0.18 },
    grain: { amount: 0.2 },
    blur: { radius: 0.12 },
  },
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
  color: "#0f172a",
  roughness: 0.64,
} satisfies NonNullable<WebGLStagePlaneProps["material"]>;
const floorPlaneProps = {
  id: "example.stage.floor",
  role: "floor",
  size: floorSize,
  position: floorPosition,
  material: floorMaterial,
} satisfies WebGLStagePlaneProps;

const backdropSize = [900, 420] satisfies NonNullable<
  WebGLStagePlaneProps["size"]
>;
const backdropPosition = [0, 20, -260] satisfies NonNullable<
  WebGLStagePlaneProps["position"]
>;
const backdropMaterial = {
  kind: "standard",
  color: "#1d4ed8",
  roughness: 0.48,
} satisfies NonNullable<WebGLStagePlaneProps["material"]>;
const backdropPlaneProps = {
  id: "example.stage.backdrop",
  role: "backdrop",
  size: backdropSize,
  position: backdropPosition,
  material: backdropMaterial,
} satisfies WebGLStagePlaneProps;

const plinthSize = [180, 96, 180] satisfies NonNullable<
  WebGLStageBoxProps["size"]
>;
const plinthPosition = [0, -128, -40] satisfies NonNullable<
  WebGLStageBoxProps["position"]
>;
const plinthMaterial = {
  kind: "standard",
  color: "#f6c453",
  roughness: 0.38,
} satisfies NonNullable<WebGLStageBoxProps["material"]>;

const bloomRailSize = [520, 18, 22] satisfies NonNullable<
  WebGLStageBoxProps["size"]
>;
const bloomRailPosition = [0, -34, -236] satisfies NonNullable<
  WebGLStageBoxProps["position"]
>;
const bloomRailMaterial = {
  kind: "basic",
  color: "#f8fafc",
} satisfies NonNullable<WebGLStageBoxProps["material"]>;

const keyLightPosition = [120, 80, 160] satisfies NonNullable<
  WebGLCameraProps["position"]
>;
const rimLightPosition = [-220, -12, 120] satisfies NonNullable<
  WebGLCameraProps["position"]
>;

export function ManagedStagePrimitiveExample() {
  return (
    <section className="example-row example-stage-dogfood">
      <div className="example-stage-copy">
        <p className="example-kicker">managed stage</p>
        <h2>声明式灯光和舞台几何</h2>
        <p>
          同一张 runtime canvas 里，只有右侧 pass 按 DOM rect 裁剪；grain、blur
          和 bloom 来自 pass descriptor，不是局部 canvas。
        </p>
      </div>

      <WebGLPassViewport
        id="example.stage.viewport"
        as="div"
        className="example-stage-viewport"
        aria-hidden="true"
      >
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
          <WebGLStagePlane {...floorPlaneProps} />
          <WebGLStagePlane {...backdropPlaneProps} />
          <WebGLStageBox
            id="example.stage.plinth"
            size={plinthSize}
            position={plinthPosition}
            material={plinthMaterial}
          />
          <WebGLStageBox
            id="example.stage.bloomRail"
            size={bloomRailSize}
            position={bloomRailPosition}
            material={bloomRailMaterial}
          />
          <WebGLLight id="example.stage.ambient" kind="ambient" intensity={0.38} />
          <WebGLLight
            id="example.stage.key"
            kind="point"
            color="#7dd3fc"
            intensity={2.6}
            position={keyLightPosition}
          />
          <WebGLLight
            id="example.stage.rim"
            kind="point"
            color="#fef3c7"
            intensity={1.9}
            position={rimLightPosition}
          />
        </WebGLScene>
      </WebGLPassViewport>
    </section>
  );
}
