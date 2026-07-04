import * as React from "react";
import {
  WebGLScrollTimeline,
  type WebGLScrollTimelineProps,
} from "@project/dom-webgl-scroll-adapters/react";
import {
  WebGLLight,
  WebGLCamera,
  WebGLScene,
  WebGLStageBox,
  WebGLStagePlane,
  WebGLTarget,
  type WebGLCameraProps,
  type WebGLLightProps,
  type WebGLSceneProps,
  type WebGLSceneRenderOptions,
  type WebGLStageBoxProps,
  type WebGLStagePlaneProps,
  type WebGLTargetProps,
} from "@project/dom-webgl-runtime/react";

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
} satisfies WebGLSceneRenderOptions;
const timelineSceneBinding = {
  id: managedTimelineId,
  active: { from: 0.02, to: 0.94 },
} satisfies NonNullable<WebGLSceneProps["timeline"]>;

const floorTimelineBinding = {
  id: managedTimelineId,
  active: { from: 0.02, to: 0.9 },
} satisfies NonNullable<WebGLStagePlaneProps["timeline"]>;
const backdropTimelineBinding = {
  id: managedTimelineId,
  active: { from: 0.02, to: 0.94 },
} satisfies NonNullable<WebGLStagePlaneProps["timeline"]>;
const plinthTimelineBinding = {
  id: managedTimelineId,
  active: { from: 0.02, to: 0.86 },
} satisfies NonNullable<WebGLStageBoxProps["timeline"]>;
const ambientTimelineBinding = {
  id: managedTimelineId,
  active: { from: 0.02, to: 0.94 },
} satisfies NonNullable<WebGLLightProps["timeline"]>;
const lightTimelineBinding = {
  id: managedTimelineId,
  active: { from: 0.02, to: 0.92 },
} satisfies NonNullable<WebGLLightProps["timeline"]>;
const targetTimelineBinding = {
  id: managedTimelineId,
  active: { from: 0.2, to: 0.9 },
} satisfies NonNullable<WebGLTargetProps<"article">["webgl"]["timeline"]>;

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
  timeline: floorTimelineBinding,
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
  timeline: backdropTimelineBinding,
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
  timeline: targetTimelineBinding,
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
          同一个 timeline 驱动 scene、floor、backdrop、box、light；右侧卡片同样是
          scene 内的 WebGLTarget，通过 screen-depth 投影进入 managed scene。
        </p>
      </div>

      <WebGLScene
        id="example.managedStage.scene"
        projection="perspective-stage"
        render={timelineSceneRender}
        timeline={timelineSceneBinding}
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
          timeline={plinthTimelineBinding}
        />
        <WebGLLight
          id="example.managedStage.ambient"
          kind="ambient"
          intensity={0.24}
          timeline={ambientTimelineBinding}
        />
        <WebGLLight
          id="example.managedStage.key"
          kind="point"
          color="#f6c453"
          intensity={1.85}
          position={keyLightPosition}
          timeline={lightTimelineBinding}
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
    </WebGLScrollTimeline>
  );
}
