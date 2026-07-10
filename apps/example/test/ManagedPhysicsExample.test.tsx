import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

const sceneProps: SceneMockProps[] = [];
const cameraProps: CameraMockProps[] = [];
const stagePlaneProps: StagePlaneMockProps[] = [];
const stageBoxProps: StageBoxMockProps[] = [];
const modelProps: ModelMockProps[] = [];
const lightProps: LightMockProps[] = [];
const passViewportProps: PassViewportMockProps[] = [];

type SceneMockProps = {
  readonly id: string;
  readonly projection?: string;
  readonly render?: Record<string, unknown>;
  readonly children?: ReactNode;
};

type CameraMockProps = {
  readonly id: string;
  readonly default?: boolean;
  readonly type?: string;
  readonly mode?: string;
  readonly fov?: number;
  readonly position?: readonly [number, number, number];
  readonly target?: readonly [number, number, number];
  readonly controller?: Record<string, unknown>;
};

type StagePlaneMockProps = {
  readonly id: string;
  readonly role?: string;
  readonly size?: readonly [number, number];
  readonly position?: readonly [number, number, number];
  readonly material?: Record<string, unknown>;
  readonly interaction?: Record<string, unknown>;
  readonly physics?: Record<string, unknown>;
};

type StageBoxMockProps = {
  readonly id: string;
  readonly size?: readonly [number, number, number];
  readonly position?: readonly [number, number, number];
  readonly material?: Record<string, unknown>;
  readonly interaction?: Record<string, unknown>;
  readonly physics?: Record<string, unknown>;
};

type ModelMockProps = {
  readonly id: string;
  readonly src: string;
  readonly position?: readonly [number, number, number];
  readonly rotation?: readonly [number, number, number];
  readonly scale?: number | readonly [number, number, number];
  readonly prepare?: Record<string, unknown>;
  readonly effects?: readonly Record<string, unknown>[];
  readonly physics?: Record<string, unknown>;
};

type LightMockProps = {
  readonly id: string;
  readonly kind: string;
  readonly intensity?: number;
  readonly position?: readonly [number, number, number];
  readonly color?: string;
};

type PassViewportMockProps = {
  readonly id: string;
  readonly as?: string;
  readonly className?: string;
  readonly "aria-hidden"?: boolean | "true" | "false";
  readonly children?: ReactNode;
};

vi.mock("@viselora/dom-webgl/react", () => ({
  WebGLPassViewport: ({ children, ...props }: PassViewportMockProps) => {
    const { as, ...domProps } = props;
    passViewportProps.push({ ...props, children });
    return createElement(as ?? "div", domProps, children);
  },
  WebGLScene: ({ children, ...props }: SceneMockProps) => {
    sceneProps.push({ ...props, children });
    return createElement("div", { "data-webgl-scene": props.id }, children);
  },
  WebGLCamera: (props: CameraMockProps) => {
    cameraProps.push(props);
    return null;
  },
  WebGLStagePlane: (props: StagePlaneMockProps) => {
    stagePlaneProps.push(props);
    return null;
  },
  WebGLStageBox: (props: StageBoxMockProps) => {
    stageBoxProps.push(props);
    return null;
  },
  WebGLModel: (props: ModelMockProps) => {
    modelProps.push(props);
    return null;
  },
  WebGLLight: (props: LightMockProps) => {
    lightProps.push(props);
    return null;
  },
}));

describe("ManagedPhysicsExample", () => {
  test("declares an isolated Phase 9 dynamics and physics dogfood scene", async () => {
    const { ManagedPhysicsExample } = await import("../src/ManagedPhysicsExample");

    const markup = renderToStaticMarkup(createElement(ManagedPhysicsExample));

    expect(markup).toContain("example-physics-dogfood");
    expect(markup).toContain("managed dynamics");
    expect(markup).toContain("Scene-native physics");
    expect(markup).toContain("static/dynamic/kinematic");
    expect(markup).toContain("plane/box/sphere/bounds");
    expect(markup).toContain("anchor + spring");
    expect(markup).toContain("pointerDrag");
    expect(markup).toContain("collision + inertia");
    expect(markup).toContain("stage + model physics");
    expect(passViewportProps).toEqual([
      expect.objectContaining({
        id: "example.physics.viewport",
        as: "div",
        className: "example-physics-viewport",
        "aria-hidden": "true",
      }),
    ]);
    expect(sceneProps).toEqual([
      expect.objectContaining({
        id: "example.physics.scene",
        projection: "perspective-stage",
        render: {
          camera: "example.physics.camera",
          order: -6,
          clearDepth: true,
          viewport: { mode: "dom-rect", scissor: true },
        },
      }),
    ]);
    expect(cameraProps).toEqual([
      expect.objectContaining({
        id: "example.physics.camera",
        default: true,
        type: "perspective",
        mode: "perspective-stage",
        fov: 40,
        position: [40, 118, 560],
        target: [40, -104, -70],
      }),
    ]);
    expect(cameraProps[0]).not.toHaveProperty("controller");
    expect(stagePlaneProps).toEqual([
      expect.objectContaining({
        id: "example.physics.floor",
        role: "floor",
        size: [760, 420],
        position: [40, -182, -70],
        material: { kind: "standard", color: "#1f3531", roughness: 0.74 },
        interaction: {
          pickable: {
            hitTest: "mesh",
            pointer: { hover: true, click: true },
          },
        },
        physics: {
          body: { type: "static" },
          collider: { kind: "plane", normal: [0, 1, 0], offset: 0 },
        },
      }),
    ]);
    expect(stageBoxProps).toEqual([
      expect.objectContaining({
        id: "example.physics.crate",
        size: [72, 72, 72],
        position: [40, -118, -70],
        material: { kind: "standard", color: "#c87f47", roughness: 0.56 },
        interaction: {
          pickable: {
            hitTest: "bounds",
            pointer: { hover: true, press: true, drag: true },
          },
        },
        physics: {
          body: {
            type: "dynamic",
            mass: 1.6,
            damping: 0.02,
            restitution: 0.42,
            friction: 0.62,
          },
          collider: { kind: "box", size: [72, 72, 72] },
          pointerDrag: true,
        },
      }),
      expect.objectContaining({
        id: "example.physics.anchor",
        size: [44, 44, 44],
        position: [-236, -122, -70],
        material: { kind: "standard", color: "#7dd3fc", roughness: 0.42 },
        physics: {
          body: {
            type: "dynamic",
            mass: 0.9,
            velocity: [520, 0, 0],
            gravityScale: 0,
            damping: 0,
          },
          collider: { kind: "box", size: [44, 44, 44] },
          constraints: [
            {
              kind: "anchor",
              target: [-176, -122, -70],
              stiffness: 0.95,
              damping: 0,
            },
          ],
        },
      }),
      expect.objectContaining({
        id: "example.physics.spring",
        size: [54, 54, 54],
        position: [216, -118, -70],
        material: { kind: "standard", color: "#f6c453", roughness: 0.38 },
        physics: {
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
            {
              kind: "spring",
              target: [146, -118, -70],
              restLength: 92,
              stiffness: 0.72,
              damping: 0,
            },
          ],
        },
      }),
      expect.objectContaining({
        id: "example.physics.bumper",
        size: [58, 150, 72],
        position: [-84, -112, -70],
        material: { kind: "standard", color: "#94663f", roughness: 0.66 },
        physics: {
          body: { type: "static" },
          collider: { kind: "box", size: [58, 150, 72] },
        },
      }),
      expect.objectContaining({
        id: "example.physics.leftWall",
        size: [32, 140, 80],
        position: [-330, -116, 24],
        material: { kind: "standard", color: "#4f5f5b", roughness: 0.7 },
        physics: {
          body: { type: "static" },
          collider: { kind: "box", size: [32, 140, 80] },
        },
      }),
      expect.objectContaining({
        id: "example.physics.rightWall",
        size: [32, 140, 80],
        position: [-40, -116, 24],
        material: { kind: "standard", color: "#4f5f5b", roughness: 0.7 },
        physics: {
          body: { type: "static" },
          collider: { kind: "box", size: [32, 140, 80] },
        },
      }),
      expect.objectContaining({
        id: "example.physics.inertia",
        size: [56, 56, 56],
        position: [-236, -70, 24],
        material: { kind: "standard", color: "#d95f42", roughness: 0.34 },
        interaction: {
          pickable: {
            hitTest: "bounds",
            pointer: { hover: true, press: true, drag: true },
          },
        },
        effects: [
          {
            kind: "example.sceneObjectHoverPulse",
            baseOpacity: 0.88,
            hoverOpacity: 1,
            clickOpacity: 1,
          },
        ],
        physics: {
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
        },
      }),
    ]);
    expect(modelProps).toEqual([
      expect.objectContaining({
        id: "example.physics.model",
        src: "/models/hero.glb",
        position: [252, -132, -70],
        rotation: [0, -0.42, 0],
        scale: 8,
        prepare: { renderWarmup: "idle" },
        effects: [
          {
            kind: "example.physicsKinematicSweep",
            baseX: 252,
            amplitude: 96,
            y: -132,
            z: -70,
            speed: 0.0024,
          },
        ],
        physics: {
          body: { type: "kinematic" },
          collider: { kind: "bounds", padding: 10 },
        },
      }),
    ]);
    expect(lightProps).toEqual([
      { id: "example.physics.ambient", kind: "ambient", intensity: 0.36 },
      {
        id: "example.physics.key",
        kind: "point",
        color: "#f6c453",
        intensity: 2.2,
        position: [-120, 170, 190],
      },
    ]);
  });
});
