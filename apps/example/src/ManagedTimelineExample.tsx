import * as React from "react";
import {
  WebGLScrollTimeline,
  type WebGLScrollTimelineProps,
} from "@project/dom-webgl-scroll-adapters/react";
import {
  WebGLLight,
  WebGLCamera,
  WebGLScene,
  WebGLStagePlane,
  type WebGLCameraProps,
  type WebGLLightProps,
  type WebGLSceneProps,
  type WebGLSceneRenderOptions,
  type WebGLStagePlaneProps,
} from "@project/dom-webgl-runtime/react";

const managedTimelineId = "example.managedTimeline";
const timelineStart = "top bottom" satisfies NonNullable<
  WebGLScrollTimelineProps["start"]
>;
const timelineEnd = "bottom top" satisfies NonNullable<
  WebGLScrollTimelineProps["end"]
>;

const timelineSceneRender = {
  camera: "example.timeline.camera",
  order: -8,
  clearDepth: true,
} satisfies WebGLSceneRenderOptions;
const timelineSceneBinding = {
  id: managedTimelineId,
  active: { from: 0.08, to: 0.94 },
} satisfies NonNullable<WebGLSceneProps["timeline"]>;

const floorTimelineBinding = {
  id: managedTimelineId,
  active: { from: 0.18, to: 0.88 },
} satisfies NonNullable<WebGLStagePlaneProps["timeline"]>;
const backdropTimelineBinding = {
  id: managedTimelineId,
  active: { from: 0.26, to: 0.92 },
} satisfies NonNullable<WebGLStagePlaneProps["timeline"]>;
const lightTimelineBinding = {
  id: managedTimelineId,
  active: { from: 0.34, to: 1 },
} satisfies NonNullable<WebGLLightProps["timeline"]>;

const cameraPosition = [0, 96, 480] satisfies NonNullable<
  WebGLCameraProps["position"]
>;
const cameraTarget = [0, -70, -40] satisfies NonNullable<
  WebGLCameraProps["target"]
>;

const floorSize = [780, 420] satisfies NonNullable<
  WebGLStagePlaneProps["size"]
>;
const floorPosition = [0, -160, 0] satisfies NonNullable<
  WebGLStagePlaneProps["position"]
>;
const floorMaterial = {
  kind: "standard",
  color: "#13251f",
  roughness: 0.8,
} satisfies NonNullable<WebGLStagePlaneProps["material"]>;

const backdropSize = [780, 360] satisfies NonNullable<
  WebGLStagePlaneProps["size"]
>;
const backdropPosition = [0, 4, -250] satisfies NonNullable<
  WebGLStagePlaneProps["position"]
>;
const backdropMaterial = {
  kind: "standard",
  color: "#234036",
  roughness: 0.68,
} satisfies NonNullable<WebGLStagePlaneProps["material"]>;

const keyLightPosition = [-160, 120, 180] satisfies NonNullable<
  WebGLLightProps["position"]
>;

export function ManagedTimelineExample() {
  return (
    <WebGLScrollTimeline
      id={managedTimelineId}
      className="example-row example-timeline-dogfood"
      start={timelineStart}
      end={timelineEnd}
      scrub
    >
      <div className="example-timeline-copy">
        <p className="example-kicker">managed timeline</p>
        <h2>命名滚动 timeline 驱动 managed scene</h2>
        <p>
          这个例子只声明一个 app-owned progress 名字；scene、stage primitive 和
          light 绑定同一个 timeline，runtime 决定舞台对象何时参与渲染。
        </p>
      </div>

      <div className="example-timeline-stage" aria-hidden="true">
        <WebGLScene
          id="example.timeline.scene"
          projection="perspective-stage"
          render={timelineSceneRender}
          timeline={timelineSceneBinding}
        >
          <WebGLCamera
            id="example.timeline.camera"
            default
            type="perspective"
            mode="perspective-stage"
            position={cameraPosition}
            target={cameraTarget}
          />
          <WebGLStagePlane
            id="example.timeline.floor"
            role="floor"
            size={floorSize}
            position={floorPosition}
            material={floorMaterial}
            timeline={floorTimelineBinding}
          />
          <WebGLStagePlane
            id="example.timeline.backdrop"
            role="backdrop"
            size={backdropSize}
            position={backdropPosition}
            material={backdropMaterial}
            timeline={backdropTimelineBinding}
          />
          <WebGLLight
            id="example.timeline.key"
            kind="point"
            color="#f6c453"
            intensity={1.7}
            position={keyLightPosition}
            timeline={lightTimelineBinding}
          />
        </WebGLScene>
      </div>
    </WebGLScrollTimeline>
  );
}
