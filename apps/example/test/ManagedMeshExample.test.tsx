import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

const sceneProps: SceneMockProps[] = [];
const cameraProps: CameraMockProps[] = [];
const meshProps: MeshMockProps[] = [];
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
  readonly position?: readonly [number, number, number];
  readonly target?: readonly [number, number, number];
};

type MeshMockProps = {
  readonly id: string;
  readonly geometry: {
    readonly kind: string;
    readonly role?: string;
    readonly size?: readonly number[];
    readonly radius?: number;
  };
  readonly position?: readonly [number, number, number];
  readonly rotation?: readonly [number, number, number];
  readonly material?: Record<string, unknown>;
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
  WebGLMesh: (props: MeshMockProps) => {
    meshProps.push(props);
    return null;
  },
  WebGLLight: (props: LightMockProps) => {
    lightProps.push(props);
    return null;
  },
}));

describe("ManagedMeshExample", () => {
  test("declares a lit managed scene with public mesh descriptors", async () => {
    const { ManagedMeshExample } = await import(
      "../src/ManagedMeshExample"
    );

    const markup = renderToStaticMarkup(createElement(ManagedMeshExample));

    expect(markup).toContain("example-stage-dogfood");
    expect(markup).toContain("同一张 runtime canvas");
    expect(sceneProps).toHaveLength(1);
    expect(sceneProps[0]).toMatchObject({
      id: "example.stage.world",
      projection: "perspective-stage",
      render: {
        camera: "example.stage.camera",
        order: -10,
        clearDepth: true,
        viewport: { mode: "dom-rect", scissor: true },
        postprocess: {
          bloom: { strength: 0.88, radius: 0.58, threshold: 0.18 },
          grain: { amount: 0.2 },
          blur: { radius: 0.12 },
        },
      },
    });
    expect(passViewportProps[0]).toMatchObject({
      id: "example.stage.viewport",
      as: "div",
      className: "example-stage-viewport",
      "aria-hidden": "true",
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
    expect(meshProps).toEqual([
      expect.objectContaining({
        id: "example.stage.floor",
        geometry: { kind: "plane", role: "floor", size: [900, 520] },
        position: [0, -180, 0],
        material: { kind: "standard", color: "#0f172a", roughness: 0.64 },
      }),
      expect.objectContaining({
        id: "example.stage.backdrop",
        geometry: { kind: "plane", role: "backdrop", size: [900, 420] },
        position: [0, 20, -260],
        material: { kind: "standard", color: "#1d4ed8", roughness: 0.48 },
      }),
      expect.objectContaining({
        id: "example.stage.plinth",
        geometry: { kind: "box", size: [180, 96, 180] },
        position: [0, -128, -40],
        material: { kind: "standard", color: "#f6c453", roughness: 0.38 },
      }),
      expect.objectContaining({
        id: "example.stage.bloomRail",
        geometry: { kind: "box", size: [520, 18, 22] },
        position: [0, -34, -236],
        material: { kind: "basic", color: "#f8fafc" },
      }),
      expect.objectContaining({
        id: "example.stage.tetrahedron",
        geometry: { kind: "tetrahedron", radius: 72 },
      }),
    ]);
    expect(lightProps).toEqual([
      { id: "example.stage.ambient", kind: "ambient", intensity: 0.38 },
      {
        id: "example.stage.key",
        kind: "point",
        color: "#7dd3fc",
        intensity: 2.6,
        position: [120, 80, 160],
      },
      {
        id: "example.stage.rim",
        kind: "point",
        color: "#fef3c7",
        intensity: 1.9,
        position: [-220, -12, 120],
      },
    ]);
  });
});
