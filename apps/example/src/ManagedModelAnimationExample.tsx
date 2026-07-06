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

const sprintModelPosition = [116, -86, -80] satisfies NonNullable<
  WebGLModelProps["position"]
>;
const sprintModelRotation = [0, -0.58, 0] satisfies NonNullable<
  WebGLModelProps["rotation"]
>;
const sprintModelLoader = {
  draco: { decoderPath: "/draco/gltf/", preload: true },
} satisfies NonNullable<WebGLModelProps["loader"]>;
const sprintModelClipLabels = [
  "Main skeleton",
  "Speed-line planes",
  "Checkout scrub",
  "Bag rig",
] as const;
const sprintSpeedLinePlaneClips = [
  "Plane.250",
  "Plane.251",
  "Plane.252",
  "Plane.253",
  "Plane.254",
  "Plane.256",
  "Plane.258",
  "Plane.262",
  "Plane.263",
  "Plane.264",
  "Ray.001",
] as const;
const sprintModelAnimation = {
  defaultClips: [
    { clip: "MainSkeleton.001", loop: "repeat", fadeInMs: 160, timeScale: 2.4 },
    { clip: "SpeedLines.001", loop: "repeat", timeScale: 2.8 },
    ...sprintSpeedLinePlaneClips.map((clip) => ({
      clip,
      loop: "repeat" as const,
      timeScale: 3.2,
    })),
    { clip: "checkoutCTRL.001", loop: "repeat", timeScale: 2.4 },
    { clip: "BagArmature.001", loop: "repeat", timeScale: 2.4 },
  ],
  scrub: {
    clip: "checkoutCTRL.001",
    timeline: { id: managedModelTimelineId, active: { from: 0.08, to: 0.92 } },
    durationSeconds: 8.333,
  },
} satisfies NonNullable<WebGLModelProps["animation"]>;
const sprintModelPrepare = {
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
          Sprint.glb 通过 public WebGLModel 声明进入 scene，显式 defaultClips
          同时启动主骨骼、速度线平面和 checkout 组合，并用固定滚动区间 scrub
          可见动作。
        </p>
        <ul className="example-managed-model-clips" aria-label="Active default clips">
          {sprintModelClipLabels.map((label) => (
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
            id="example.managedModel.sprint"
            src="/models/Sprint.glb"
            loader={sprintModelLoader}
            position={sprintModelPosition}
            rotation={sprintModelRotation}
            scale={9.5}
            animation={sprintModelAnimation}
            prepare={sprintModelPrepare}
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
