import * as React from "react";
import {
  WebGLLight,
  WebGLCamera,
  WebGLModel,
  WebGLPassViewport,
  WebGLScene,
  WebGLStageBox,
  WebGLStagePlane,
  type WebGLCameraProps,
  type WebGLModelProps,
  type WebGLSceneRenderOptions,
  type WebGLStageBoxProps,
  type WebGLStagePlaneProps,
} from "@viselora/dom-webgl/react";

const physicsSceneRender = {
  camera: "example.physics.camera",
  order: -6,
  clearDepth: true,
  viewport: { mode: "dom-rect", scissor: true },
} satisfies WebGLSceneRenderOptions;

const cameraPosition = [40, 118, 560] satisfies NonNullable<
  WebGLCameraProps["position"]
>;
const cameraTarget = [40, -104, -70] satisfies NonNullable<
  WebGLCameraProps["target"]
>;

const floorSize = [760, 420] satisfies NonNullable<WebGLStagePlaneProps["size"]>;
const floorRole = "floor" satisfies NonNullable<WebGLStagePlaneProps["role"]>;
const floorPosition = [40, -182, -70] satisfies NonNullable<
  WebGLStagePlaneProps["position"]
>;
const floorMaterial = {
  kind: "standard",
  color: "#1f3531",
  roughness: 0.74,
} satisfies NonNullable<WebGLStagePlaneProps["material"]>;
const floorInteraction = {
  pickable: {
    hitTest: "mesh",
    pointer: { hover: true, click: true },
  },
} satisfies NonNullable<WebGLStagePlaneProps["interaction"]>;
const floorPhysics = {
  body: { type: "static" },
  collider: { kind: "plane", normal: [0, 1, 0], offset: 0 },
} satisfies NonNullable<WebGLStagePlaneProps["physics"]>;

const crateSize = [72, 72, 72] satisfies NonNullable<WebGLStageBoxProps["size"]>;
const cratePosition = [40, -118, -70] satisfies NonNullable<
  WebGLStageBoxProps["position"]
>;
const crateMaterial = {
  kind: "standard",
  color: "#c87f47",
  roughness: 0.56,
} satisfies NonNullable<WebGLStageBoxProps["material"]>;
const crateInteraction = {
  pickable: {
    hitTest: "bounds",
    pointer: { hover: true, press: true, drag: true },
  },
} satisfies NonNullable<WebGLStageBoxProps["interaction"]>;
const cratePhysics = {
  body: {
    type: "dynamic",
    mass: 1.6,
    damping: 0.02,
    restitution: 0.42,
    friction: 0.62,
  },
  collider: { kind: "box", size: crateSize },
  pointerDrag: true,
} satisfies NonNullable<WebGLStageBoxProps["physics"]>;

const anchorBoxSize = [44, 44, 44] satisfies NonNullable<WebGLStageBoxProps["size"]>;
const anchorBoxPosition = [-236, -122, -70] satisfies NonNullable<
  WebGLStageBoxProps["position"]
>;
const anchorBoxMaterial = {
  kind: "standard",
  color: "#7dd3fc",
  roughness: 0.42,
} satisfies NonNullable<WebGLStageBoxProps["material"]>;
const anchorBoxPhysics = {
  body: {
    type: "dynamic",
    mass: 0.9,
    velocity: [520, 0, 0],
    gravityScale: 0,
    damping: 0,
  },
  collider: { kind: "box", size: anchorBoxSize },
  constraints: [
    { kind: "anchor", target: [-176, -122, -70], stiffness: 0.95, damping: 0 },
  ],
} satisfies NonNullable<WebGLStageBoxProps["physics"]>;

const springBoxSize = [54, 54, 54] satisfies NonNullable<WebGLStageBoxProps["size"]>;
const springBoxPosition = [216, -118, -70] satisfies NonNullable<
  WebGLStageBoxProps["position"]
>;
const springBoxMaterial = {
  kind: "standard",
  color: "#f6c453",
  roughness: 0.38,
} satisfies NonNullable<WebGLStageBoxProps["material"]>;
const springBoxPhysics = {
  body: {
    type: "dynamic",
    mass: 1.1,
    velocity: [-480, 0, 0],
    gravityScale: 0,
    damping: 0,
    restitution: 0.18,
  },
  collider: { kind: "sphere", radius: 32 },
  constraints: [
    { kind: "spring", target: [146, -118, -70], restLength: 92, stiffness: 0.72, damping: 0 },
  ],
} satisfies NonNullable<WebGLStageBoxProps["physics"]>;

const bumperSize = [58, 150, 72] satisfies NonNullable<WebGLStageBoxProps["size"]>;
const bumperPosition = [-84, -112, -70] satisfies NonNullable<
  WebGLStageBoxProps["position"]
>;
const bumperMaterial = {
  kind: "standard",
  color: "#94663f",
  roughness: 0.66,
} satisfies NonNullable<WebGLStageBoxProps["material"]>;
const bumperPhysics = {
  body: { type: "static" },
  collider: { kind: "box", size: bumperSize },
} satisfies NonNullable<WebGLStageBoxProps["physics"]>;

const collisionWallSize = [32, 140, 80] satisfies NonNullable<WebGLStageBoxProps["size"]>;
const leftWallPosition = [-330, -116, 24] satisfies NonNullable<
  WebGLStageBoxProps["position"]
>;
const rightWallPosition = [-40, -116, 24] satisfies NonNullable<
  WebGLStageBoxProps["position"]
>;
const collisionWallMaterial = {
  kind: "standard",
  color: "#4f5f5b",
  roughness: 0.7,
} satisfies NonNullable<WebGLStageBoxProps["material"]>;
const collisionWallPhysics = {
  body: { type: "static" },
  collider: { kind: "box", size: collisionWallSize },
} satisfies NonNullable<WebGLStageBoxProps["physics"]>;

const inertiaBlockSize = [56, 56, 56] satisfies NonNullable<WebGLStageBoxProps["size"]>;
const inertiaBlockPosition = [-236, -70, 24] satisfies NonNullable<
  WebGLStageBoxProps["position"]
>;
const inertiaBlockMaterial = {
  kind: "standard",
  color: "#d95f42",
  roughness: 0.34,
} satisfies NonNullable<WebGLStageBoxProps["material"]>;
const inertiaBlockInteraction = {
  pickable: {
    hitTest: "bounds",
    pointer: { hover: true, press: true, drag: true },
  },
} satisfies NonNullable<WebGLStageBoxProps["interaction"]>;
const inertiaBlockEffects = [
  {
    kind: "example.sceneObjectHoverPulse",
    baseOpacity: 0.88,
    hoverOpacity: 1,
    clickOpacity: 1,
  },
] as const;
const inertiaBlockPhysics = {
  body: {
    type: "dynamic",
    mass: 1.2,
    velocity: [0, 0, 0],
    gravityScale: 1,
    damping: 0.006,
    restitution: 0.86,
    friction: 0.08,
  },
  collider: { kind: "sphere", radius: 34 },
  pointerDrag: true,
} satisfies NonNullable<WebGLStageBoxProps["physics"]>;

const modelPosition = [252, -132, -70] satisfies NonNullable<
  WebGLModelProps["position"]
>;
const modelRotation = [0, -0.42, 0] satisfies NonNullable<
  WebGLModelProps["rotation"]
>;
const modelPrepare = {
  renderWarmup: "idle",
} satisfies NonNullable<WebGLModelProps["prepare"]>;
const modelEffects = [
  {
    kind: "example.physicsKinematicSweep",
    baseX: 252,
    amplitude: 96,
    y: -132,
    z: -70,
    speed: 0.0024,
  },
] as const;
const modelPhysics = {
  body: { type: "kinematic" },
  collider: { kind: "bounds", padding: 10 },
} satisfies NonNullable<WebGLModelProps["physics"]>;

const keyLightPosition = [-120, 170, 190] satisfies NonNullable<
  WebGLCameraProps["position"]
>;

const physicsCoverageLabels = [
  "static/dynamic/kinematic",
  "plane/box/sphere/bounds",
  "anchor + spring",
  "pointerDrag",
  "collision + inertia",
  "stage + model physics",
] as const;

export function ManagedPhysicsExample() {
  return (
    <section className="example-row example-physics-dogfood">
      <div className="example-physics-copy">
        <p className="example-kicker">managed dynamics</p>
        <h2>Scene-native physics</h2>
        <p>
          Phase 9 keeps physics in its own managed scene: static, dynamic, and
          kinematic bodies run with plane, box, sphere, and bounds colliders.
          The blue and yellow bodies keep moving from anchor and spring
          constraints, the model sweeps as a kinematic body, and the orange
          crate responds to direct descriptor-owned dragging. Drag and release
          the red block to test gravity, wall/floor collision response, and
          inertia.
        </p>
        <ul className="example-physics-coverage" aria-label="Phase 9 coverage">
          {physicsCoverageLabels.map((label) => (
            <li key={label}>{label}</li>
          ))}
        </ul>
      </div>

      <WebGLPassViewport
        id="example.physics.viewport"
        as="div"
        className="example-physics-viewport"
        aria-hidden="true"
      >
        <WebGLScene
          id="example.physics.scene"
          projection="perspective-stage"
          render={physicsSceneRender}
        >
          <WebGLCamera
            id="example.physics.camera"
            default
            type="perspective"
            mode="perspective-stage"
            fov={40}
            position={cameraPosition}
            target={cameraTarget}
          />
          <WebGLStagePlane
            id="example.physics.floor"
            role={floorRole}
            size={floorSize}
            position={floorPosition}
            material={floorMaterial}
            interaction={floorInteraction}
            physics={floorPhysics}
          />
          <WebGLStageBox
            id="example.physics.crate"
            size={crateSize}
            position={cratePosition}
            material={crateMaterial}
            interaction={crateInteraction}
            physics={cratePhysics}
          />
          <WebGLStageBox
            id="example.physics.anchor"
            size={anchorBoxSize}
            position={anchorBoxPosition}
            material={anchorBoxMaterial}
            physics={anchorBoxPhysics}
          />
          <WebGLStageBox
            id="example.physics.spring"
            size={springBoxSize}
            position={springBoxPosition}
            material={springBoxMaterial}
            physics={springBoxPhysics}
          />
          <WebGLStageBox
            id="example.physics.bumper"
            size={bumperSize}
            position={bumperPosition}
            material={bumperMaterial}
            physics={bumperPhysics}
          />
          <WebGLStageBox
            id="example.physics.leftWall"
            size={collisionWallSize}
            position={leftWallPosition}
            material={collisionWallMaterial}
            physics={collisionWallPhysics}
          />
          <WebGLStageBox
            id="example.physics.rightWall"
            size={collisionWallSize}
            position={rightWallPosition}
            material={collisionWallMaterial}
            physics={collisionWallPhysics}
          />
          <WebGLStageBox
            id="example.physics.inertia"
            size={inertiaBlockSize}
            position={inertiaBlockPosition}
            material={inertiaBlockMaterial}
            interaction={inertiaBlockInteraction}
            effects={inertiaBlockEffects}
            physics={inertiaBlockPhysics}
          />
          <WebGLModel
            id="example.physics.model"
            src="/models/hero.glb"
            position={modelPosition}
            rotation={modelRotation}
            scale={8}
            prepare={modelPrepare}
            effects={modelEffects}
            physics={modelPhysics}
          />
          <WebGLLight id="example.physics.ambient" kind="ambient" intensity={0.36} />
          <WebGLLight
            id="example.physics.key"
            kind="point"
            color="#f6c453"
            intensity={2.2}
            position={keyLightPosition}
          />
        </WebGLScene>
      </WebGLPassViewport>
    </section>
  );
}
