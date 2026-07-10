import * as React from "react";
import {
  WebGLScrollTimeline,
  type WebGLScrollTimelineProps,
} from "@viselora/scroll-adapters/react";
import {
  WebGLLight,
  WebGLCamera,
  WebGLPassViewport,
  WebGLScene,
  WebGLStageBox,
  WebGLStagePlane,
  WebGLTarget,
  type WebGLCameraProps,
  type WebGLLightProps,
  type WebGLSceneRenderOptions,
  type WebGLStageBoxProps,
  type WebGLStagePlaneProps,
  type WebGLTargetProps,
} from "@viselora/dom-webgl/react";

const managedTimelineId = "example.managedTimeline";
const timelineStart = "top top" satisfies NonNullable<
  WebGLScrollTimelineProps["start"]
>;
const timelineEnd = "+=240%" satisfies NonNullable<
  WebGLScrollTimelineProps["end"]
>;

const timelineSceneRender = {
  camera: "example.managedStage.camera",
  order: -8,
  clearDepth: true,
  viewport: { mode: "dom-rect", scissor: true },
} satisfies WebGLSceneRenderOptions;

const cameraPosition = [0, 136, 560] satisfies NonNullable<
  WebGLCameraProps["position"]
>;
const cameraTarget = [0, -88, -40] satisfies NonNullable<
  WebGLCameraProps["target"]
>;
const cameraController = {
  timeline: {
    id: managedTimelineId,
    range: { from: 0.12, to: 0.88 },
  },
  to: {
    position: [0, 96, 520],
    target: [0, 36, 0],
    fov: 34,
  },
  easing: "smoothstep",
} satisfies NonNullable<WebGLCameraProps["controller"]>;

const floorSize = [920, 520] satisfies NonNullable<
  WebGLStagePlaneProps["size"]
>;
const floorPosition = [0, -178, 0] satisfies NonNullable<
  WebGLStagePlaneProps["position"]
>;
const floorMaterial = {
  kind: "standard",
  color: "#16241f",
  roughness: 0.82,
} satisfies NonNullable<WebGLStagePlaneProps["material"]>;
const floorPlaneProps = {
  id: "example.managedStage.floor",
  role: "floor",
  size: floorSize,
  position: floorPosition,
  material: floorMaterial,
} satisfies WebGLStagePlaneProps;

const backdropSize = [920, 430] satisfies NonNullable<
  WebGLStagePlaneProps["size"]
>;
const backdropPosition = [0, 18, -290] satisfies NonNullable<
  WebGLStagePlaneProps["position"]
>;
const backdropMaterial = {
  kind: "standard",
  color: "#1f3a32",
  roughness: 0.7,
} satisfies NonNullable<WebGLStagePlaneProps["material"]>;
const backdropPlaneProps = {
  id: "example.managedStage.backdrop",
  role: "backdrop",
  size: backdropSize,
  position: backdropPosition,
  material: backdropMaterial,
} satisfies WebGLStagePlaneProps;

const plinthSize = [220, 96, 180] satisfies NonNullable<
  WebGLStageBoxProps["size"]
>;
const plinthPosition = [0, -130, -56] satisfies NonNullable<
  WebGLStageBoxProps["position"]
>;
const plinthMaterial = {
  kind: "standard",
  color: "#566b61",
  roughness: 0.56,
} satisfies NonNullable<WebGLStageBoxProps["material"]>;

const keyLightPosition = [-180, 160, 220] satisfies NonNullable<
  WebGLLightProps["position"]
>;

const managedStageCardWebgl = {
  key: "example.managedStage.card",
  source: { kind: "dom", type: "element" },
  placement: { mode: "screen-depth", depth: 120, size: "dom" },
  lifecycle: { hideWhenReady: true, hideMode: "subtree" },
  effects: [
    {
      kind: "example.managedTimelineCard",
      progressKey: managedTimelineId,
    },
  ],
} satisfies WebGLTargetProps<"article">["webgl"];

export function ManagedTimelineExample() {
  return (
    <WebGLScrollTimeline
      id={managedTimelineId}
      className="example-row example-managed-stage-timeline"
      start={timelineStart}
      end={timelineEnd}
      pin
      scrub
    >
      <div className="example-managed-stage-copy">
        <p className="example-kicker">pinned managed scene</p>
        <h2>滚动固定的声明式 3D 舞台</h2>
        <p>
          同一个 timeline 驱动 camera 和右侧卡片效果；scene、floor、backdrop、box、light
          直接展示，并通过 section rect 裁剪在 pinned viewport 内。
        </p>
      </div>

      <WebGLPassViewport
        id="example.managedStage.viewport"
        as="div"
        className="example-managed-stage-viewport"
      >
        <WebGLScene
          id="example.managedStage.scene"
          projection="perspective-stage"
          render={timelineSceneRender}
        >
          <WebGLCamera
            id="example.managedStage.camera"
            default
            type="perspective"
            mode="perspective-stage"
            position={cameraPosition}
            target={cameraTarget}
            fov={42}
            controller={cameraController}
          />
          <WebGLStagePlane {...floorPlaneProps} />
          <WebGLStagePlane {...backdropPlaneProps} />
          <WebGLStageBox
            id="example.managedStage.plinth"
            size={plinthSize}
            position={plinthPosition}
            material={plinthMaterial}
          />
          <WebGLLight
            id="example.managedStage.ambient"
            kind="ambient"
            intensity={0.24}
          />
          <WebGLLight
            id="example.managedStage.key"
            kind="point"
            color="#f6c453"
            intensity={1.85}
            position={keyLightPosition}
          />
          <WebGLTarget
            as="article"
            className="example-managed-stage-card"
            webgl={managedStageCardWebgl}
          >
            <span>WebGLTarget</span>
            <strong>Timeline driven card</strong>
            <em>same progress signal</em>
          </WebGLTarget>
        </WebGLScene>
      </WebGLPassViewport>
    </WebGLScrollTimeline>
  );
}
