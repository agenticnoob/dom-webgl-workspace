import * as React from "react";
import {
  WebGLScrollTimeline,
  type WebGLScrollTimelineProps,
} from "@project/dom-webgl-scroll-adapters/react";
import {
  WebGLLight,
  WebGLCamera,
  WebGLModel,
  WebGLPassViewport,
  WebGLScene,
  type WebGLCameraProps,
  type WebGLLightProps,
  type WebGLModelProps,
  type WebGLSceneRenderOptions,
} from "@project/dom-webgl-runtime/react";

const modelSceneRender = {
  camera: "example.managedModel.camera",
  order: -9,
  clearDepth: true,
  viewport: { mode: "dom-rect", scissor: true },
} satisfies WebGLSceneRenderOptions;

const managedModelTimelineId = "example.managedModel.timeline";
const modelTimelineStart = "top top" satisfies NonNullable<
  WebGLScrollTimelineProps["start"]
>;
const modelTimelineEnd = "+=180%" satisfies NonNullable<
  WebGLScrollTimelineProps["end"]
>;
const cameraPosition = [80, 132, 640] satisfies NonNullable<
  WebGLCameraProps["position"]
>;
const cameraTarget = [116, -76, -80] satisfies NonNullable<
  WebGLCameraProps["target"]
>;

const humanModelPosition = [116, -92, -80] satisfies NonNullable<
  WebGLModelProps["position"]
>;
const humanModelRotation = [0, -0.36, 0] satisfies NonNullable<
  WebGLModelProps["rotation"]
>;
const humanModelClipLabels = [
  "Pinned walk scrub",
] as const;
const humanModelAnimation = {
  scrub: {
    clip: "WalkCycle",
    timeline: { id: managedModelTimelineId, active: { from: 0.08, to: 0.92 } },
    durationSeconds: 2.4,
  },
} satisfies NonNullable<WebGLModelProps["animation"]>;
const humanModelPrepare = {
  renderWarmup: "idle",
} satisfies NonNullable<WebGLModelProps["prepare"]>;

const keyLightPosition = [-120, 120, 180] satisfies NonNullable<
  WebGLLightProps["position"]
>;

export function ManagedModelAnimationExample() {
  return (
    <WebGLScrollTimeline
      id={managedModelTimelineId}
      className="example-row example-managed-model-dogfood"
      start={modelTimelineStart}
      end={modelTimelineEnd}
      pin
      scrub
    >
      <div className="example-managed-model-copy">
        <p className="example-kicker">managed model animation</p>
        <h2>Phase 7 模型动画独立验证</h2>
        <p>
          human_male_base.glb 通过 public WebGLModel 声明进入 scene，并用
          pinned scroll 区间 scrub WalkCycle。
        </p>
        <ul className="example-managed-model-clips" aria-label="Phase 7 animation coverage">
          {humanModelClipLabels.map((label) => (
            <li key={label}>{label}</li>
          ))}
        </ul>
      </div>

      <WebGLPassViewport
        id="example.managedModel.viewport"
        as="div"
        className="example-managed-model-viewport"
        aria-hidden="true"
      >
        <WebGLScene
          id="example.managedModel.scene"
          projection="perspective-stage"
          render={modelSceneRender}
        >
          <WebGLCamera
            id="example.managedModel.camera"
            default
            type="perspective"
            mode="perspective-stage"
            fov={40}
            position={cameraPosition}
            target={cameraTarget}
          />
          <WebGLModel
            id="example.managedModel.human"
            src="/models/human_male_base.glb"
            position={humanModelPosition}
            rotation={humanModelRotation}
            scale={126}
            animation={humanModelAnimation}
            prepare={humanModelPrepare}
          />
          <WebGLLight id="example.managedModel.ambient" kind="ambient" intensity={0.3} />
          <WebGLLight
            id="example.managedModel.key"
            kind="point"
            color="#f6c453"
            intensity={2.15}
            position={keyLightPosition}
          />
        </WebGLScene>
      </WebGLPassViewport>
    </WebGLScrollTimeline>
  );
}
