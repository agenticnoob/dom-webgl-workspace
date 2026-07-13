import * as React from "react";
import {
  WebGLLight,
  WebGLCamera,
  WebGLMesh,
  WebGLPassViewport,
  WebGLScene,
  type WebGLCameraProps,
  type WebGLMeshProps,
  type WebGLSceneRenderOptions,
} from "@viselora/dom-webgl/react";

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

const floorPosition = [0, -180, 0] satisfies NonNullable<
  WebGLMeshProps["position"]
>;
const floorMaterial = {
  kind: "standard",
  color: "#0f172a",
  roughness: 0.64,
} satisfies NonNullable<WebGLMeshProps["material"]>;
const floorMeshProps = {
  id: "example.stage.floor",
  geometry: { kind: "plane", role: "floor", size: [900, 520] },
  position: floorPosition,
  material: floorMaterial,
} satisfies WebGLMeshProps;

const backdropPosition = [0, 20, -260] satisfies NonNullable<
  WebGLMeshProps["position"]
>;
const backdropMaterial = {
  kind: "standard",
  color: "#1d4ed8",
  roughness: 0.48,
} satisfies NonNullable<WebGLMeshProps["material"]>;
const backdropMeshProps = {
  id: "example.stage.backdrop",
  geometry: { kind: "plane", role: "backdrop", size: [900, 420] },
  position: backdropPosition,
  material: backdropMaterial,
} satisfies WebGLMeshProps;

const plinthGeometry = {
  kind: "box",
  size: [180, 96, 180],
} satisfies WebGLMeshProps["geometry"];
const plinthPosition = [0, -128, -40] satisfies NonNullable<
  WebGLMeshProps["position"]
>;
const plinthMaterial = {
  kind: "standard",
  color: "#f6c453",
  roughness: 0.38,
} satisfies NonNullable<WebGLMeshProps["material"]>;

const bloomRailGeometry = {
  kind: "box",
  size: [520, 18, 22],
} satisfies WebGLMeshProps["geometry"];
const bloomRailPosition = [0, -34, -236] satisfies NonNullable<
  WebGLMeshProps["position"]
>;
const bloomRailMaterial = {
  kind: "basic",
  color: "#f8fafc",
} satisfies NonNullable<WebGLMeshProps["material"]>;

const tetrahedronGeometry = {
  kind: "tetrahedron",
  radius: 72,
} satisfies WebGLMeshProps["geometry"];

const keyLightPosition = [120, 80, 160] satisfies NonNullable<
  WebGLCameraProps["position"]
>;
const rimLightPosition = [-220, -12, 120] satisfies NonNullable<
  WebGLCameraProps["position"]
>;

export function ManagedMeshExample() {
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
          <WebGLMesh {...floorMeshProps} />
          <WebGLMesh {...backdropMeshProps} />
          <WebGLMesh
            id="example.stage.plinth"
            geometry={plinthGeometry}
            position={plinthPosition}
            material={plinthMaterial}
          />
          <WebGLMesh
            id="example.stage.bloomRail"
            geometry={bloomRailGeometry}
            position={bloomRailPosition}
            material={bloomRailMaterial}
          />
          <WebGLMesh
            id="example.stage.tetrahedron"
            geometry={tetrahedronGeometry}
            position={[180, -82, -40]}
            material={{ kind: "standard", color: "#7dd3fc", roughness: 0.28 }}
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
