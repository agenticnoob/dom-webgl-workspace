import * as React from "react";
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

const cameraPosition = [0, 160, 760] satisfies NonNullable<
  WebGLCameraProps["position"]
>;
const cameraTarget = [120, -70, -80] satisfies NonNullable<
  WebGLCameraProps["target"]
>;

const sprintModelPosition = [240, -60, -80] satisfies NonNullable<
  WebGLModelProps["position"]
>;
const sprintModelRotation = [0, 0, 0] satisfies NonNullable<
  WebGLModelProps["rotation"]
>;
const sprintModelLoader = {
  draco: { decoderPath: "/draco/gltf/", preload: true },
} satisfies NonNullable<WebGLModelProps["loader"]>;
const sprintModelAnimation = {
  defaultClips: [
    { clip: "MainSkeleton.001", loop: "repeat", fadeInMs: 160 },
    { clip: "SpeedLines.001", loop: "repeat" },
    { clip: "BagArmature.001", loop: "repeat" },
  ],
} satisfies NonNullable<WebGLModelProps["animation"]>;
const sprintModelPrepare = {
  renderWarmup: "idle",
} satisfies NonNullable<WebGLModelProps["prepare"]>;

const keyLightPosition = [-120, 120, 180] satisfies NonNullable<
  WebGLLightProps["position"]
>;

export function ManagedModelAnimationExample() {
  return (
    <section className="example-row example-managed-model-dogfood">
      <div className="example-managed-model-copy">
        <p className="example-kicker">managed model animation</p>
        <h2>Phase 7 模型动画独立验证</h2>
        <p>
          Sprint.glb 通过 public WebGLModel 声明进入 scene，Draco loader 和显式默认 clips
          都是 descriptor 数据，不混进 pinned timeline 或 stage primitive 示例。
        </p>
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
            scale={8}
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
    </section>
  );
}
