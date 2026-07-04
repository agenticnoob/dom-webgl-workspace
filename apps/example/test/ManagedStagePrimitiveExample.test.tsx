import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

const sceneProps: SceneMockProps[] = [];
const cameraProps: CameraMockProps[] = [];
const stagePlaneProps: StagePlaneMockProps[] = [];
const stageBoxProps: StageBoxMockProps[] = [];
const lightProps: LightMockProps[] = [];

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
  readonly position?: readonly [number, number, number];
  readonly target?: readonly [number, number, number];
};

type StagePlaneMockProps = {
  readonly id: string;
  readonly role?: string;
  readonly size?: readonly [number, number];
  readonly position?: readonly [number, number, number];
  readonly rotation?: readonly [number, number, number];
  readonly material?: Record<string, unknown>;
};

type StageBoxMockProps = {
  readonly id: string;
  readonly size?: readonly [number, number, number];
  readonly position?: readonly [number, number, number];
  readonly material?: Record<string, unknown>;
};

type LightMockProps = {
  readonly id: string;
  readonly kind: string;
  readonly intensity?: number;
  readonly position?: readonly [number, number, number];
  readonly color?: string;
};

vi.mock("@project/dom-webgl-runtime/react", () => ({
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
  WebGLLight: (props: LightMockProps) => {
    lightProps.push(props);
    return null;
  },
}));

describe("ManagedStagePrimitiveExample", () => {
  test("declares a lit managed scene with public stage descriptors", async () => {
    const { ManagedStagePrimitiveExample } = await import(
      "../src/ManagedStagePrimitiveExample"
    );

    const markup = renderToStaticMarkup(createElement(ManagedStagePrimitiveExample));

    expect(markup).toContain("example-stage-dogfood");
    expect(sceneProps).toHaveLength(1);
    expect(sceneProps[0]).toMatchObject({
      id: "example.stage.world",
      projection: "perspective-stage",
      render: { camera: "example.stage.camera", order: -10, clearDepth: true },
    });
    expect(cameraProps).toEqual([
      expect.objectContaining({
        id: "example.stage.camera",
        default: true,
        type: "perspective",
        mode: "perspective-stage",
        position: [0, 120, 520],
        target: [0, -80, 0],
      }),
    ]);
    expect(stagePlaneProps).toEqual([
      expect.objectContaining({
        id: "example.stage.floor",
        role: "floor",
        size: [900, 520],
        position: [0, -180, 0],
        material: { kind: "standard", color: "#111827", roughness: 0.84 },
      }),
      expect.objectContaining({
        id: "example.stage.backdrop",
        role: "backdrop",
        size: [900, 420],
        position: [0, 20, -260],
        material: { kind: "standard", color: "#172554", roughness: 0.72 },
      }),
    ]);
    expect(stageBoxProps).toEqual([
      expect.objectContaining({
        id: "example.stage.plinth",
        size: [180, 96, 180],
        position: [0, -128, -40],
        material: { kind: "standard", color: "#475569", roughness: 0.58 },
      }),
    ]);
    expect(lightProps).toEqual([
      { id: "example.stage.ambient", kind: "ambient", intensity: 0.28 },
      {
        id: "example.stage.key",
        kind: "point",
        color: "#7dd3fc",
        intensity: 1.8,
        position: [120, 80, 160],
      },
    ]);
  });
});
