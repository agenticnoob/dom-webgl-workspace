import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

const sceneProps: SceneMockProps[] = [];
const cameraProps: CameraMockProps[] = [];
const lightProps: LightMockProps[] = [];
const modelProps: ModelMockProps[] = [];
const passViewportProps: PassViewportMockProps[] = [];

type SceneMockProps = {
  readonly id: string;
  readonly projection?: string;
  readonly render?: Record<string, unknown>;
  readonly children?: ReactNode;
};

type PassViewportMockProps = {
  readonly id: string;
  readonly as?: string;
  readonly className?: string;
  readonly "aria-hidden"?: boolean | "true" | "false";
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
};

type LightMockProps = {
  readonly id: string;
  readonly kind: string;
  readonly intensity?: number;
  readonly position?: readonly [number, number, number];
  readonly color?: string;
};

type ModelMockProps = {
  readonly id: string;
  readonly src: string;
  readonly loader?: Record<string, unknown>;
  readonly position?: readonly [number, number, number];
  readonly rotation?: readonly [number, number, number];
  readonly scale?: number | readonly [number, number, number];
  readonly animation?: Record<string, unknown>;
  readonly prepare?: Record<string, unknown>;
  readonly timeline?: Record<string, unknown>;
};

vi.mock("@project/dom-webgl-runtime/react", () => ({
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
  WebGLLight: (props: LightMockProps) => {
    lightProps.push(props);
    return null;
  },
  WebGLModel: (props: ModelMockProps) => {
    modelProps.push(props);
    return null;
  },
}));

describe("ManagedModelAnimationExample", () => {
  test("keeps Phase 7 model animation dogfood in its own scene", async () => {
    const { ManagedModelAnimationExample } = await import(
      "../src/ManagedModelAnimationExample"
    );

    const markup = renderToStaticMarkup(createElement(ManagedModelAnimationExample));

    expect(markup).toContain("example-managed-model-dogfood");
    expect(markup).toContain("managed model animation");
    expect(markup).toContain("Sprint.glb");
    expect(passViewportProps).toEqual([
      expect.objectContaining({
        id: "example.managedModel.viewport",
        as: "div",
        className: "example-managed-model-viewport",
        "aria-hidden": "true",
      }),
    ]);
    expect(sceneProps).toEqual([
      expect.objectContaining({
        id: "example.managedModel.scene",
        projection: "perspective-stage",
        render: {
          camera: "example.managedModel.camera",
          order: -9,
          clearDepth: true,
          viewport: { mode: "dom-rect", scissor: true },
        },
      }),
    ]);
    expect(cameraProps).toEqual([
      expect.objectContaining({
        id: "example.managedModel.camera",
        default: true,
        type: "perspective",
        mode: "perspective-stage",
        fov: 40,
        position: [0, 160, 760],
        target: [120, -70, -80],
      }),
    ]);
    expect(modelProps).toEqual([
      expect.objectContaining({
        id: "example.managedModel.sprint",
        src: "/models/Sprint.glb",
        loader: { draco: { decoderPath: "/draco/gltf/", preload: true } },
        position: [240, -60, -80],
        rotation: [0, 0, 0],
        scale: 8,
        animation: {
          defaultClip: { clip: "MainSkeleton.001", loop: "repeat", fadeInMs: 160 },
        },
        prepare: { renderWarmup: "idle" },
      }),
    ]);
    expect(modelProps[0]).not.toHaveProperty("timeline");
    expect(lightProps).toEqual([
      { id: "example.managedModel.ambient", kind: "ambient", intensity: 0.3 },
      {
        id: "example.managedModel.key",
        kind: "point",
        color: "#f6c453",
        intensity: 2.15,
        position: [-120, 120, 180],
      },
    ]);
  });
});
