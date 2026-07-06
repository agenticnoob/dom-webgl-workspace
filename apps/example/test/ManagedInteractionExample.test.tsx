import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

const sceneProps: SceneMockProps[] = [];
const cameraProps: CameraMockProps[] = [];
const stagePlaneProps: StagePlaneMockProps[] = [];
const lightProps: LightMockProps[] = [];
const modelProps: ModelMockProps[] = [];
const targetProps: TargetMockProps[] = [];
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
  readonly rotation?: readonly [number, number, number];
  readonly material?: Record<string, unknown>;
  readonly effects?: readonly Record<string, unknown>[];
  readonly interaction?: Record<string, unknown>;
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
  readonly scale?: number | readonly [number, number, number];
  readonly prepare?: Record<string, unknown>;
  readonly effects?: readonly Record<string, unknown>[];
  readonly interaction?: Record<string, unknown>;
};

type TargetMockProps = {
  readonly as?: keyof HTMLElementTagNameMap;
  readonly children?: ReactNode;
  readonly className?: string;
  readonly webgl: {
    readonly key: string;
    readonly sceneId?: string;
    readonly source?: Record<string, unknown>;
    readonly placement?: Record<string, unknown>;
    readonly lifecycle?: Record<string, unknown>;
    readonly effects?: readonly Record<string, unknown>[];
  };
};

type PassViewportMockProps = {
  readonly id: string;
  readonly as?: string;
  readonly className?: string;
  readonly "aria-hidden"?: boolean | "true" | "false";
  readonly children?: ReactNode;
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
  WebGLStagePlane: (props: StagePlaneMockProps) => {
    stagePlaneProps.push(props);
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
  WebGLTarget: ({ as = "div", children, webgl, ...props }: TargetMockProps) => {
    targetProps.push({ as, children, webgl });
    return createElement(as, props, children);
  },
}));

describe("ManagedInteractionExample", () => {
  test("declares Phase 8 managed picking and screen-plane dogfood", async () => {
    const { ManagedInteractionExample } = await import(
      "../src/ManagedInteractionExample"
    );

    const markup = renderToStaticMarkup(createElement(ManagedInteractionExample));

    expect(markup).toContain("example-interaction-dogfood");
    expect(markup).toContain("managed interaction");
    expect(markup).toContain("screen-plane");
    expect(passViewportProps).toEqual([
      expect.objectContaining({
        id: "example.interaction.viewport",
        as: "div",
        className: "example-interaction-viewport",
        "aria-hidden": "true",
      }),
    ]);
    expect(sceneProps).toEqual([
      expect.objectContaining({
        id: "example.interaction.scene",
        projection: "perspective-stage",
        render: {
          camera: "example.interaction.camera",
          order: -7,
          clearDepth: true,
          viewport: { mode: "dom-rect", scissor: true },
        },
      }),
    ]);
    expect(cameraProps).toEqual([
      expect.objectContaining({
        id: "example.interaction.camera",
        default: true,
        type: "perspective",
        mode: "perspective-stage",
        fov: 42,
        position: [120, 132, 620],
        target: [120, -78, -70],
        controller: {
          pointer: {
            kind: "orbit",
            activation: "empty-space-drag",
            target: [120, -78, -70],
            sensitivity: [0.0035, 0.003],
            minPolarAngle: 0.52,
            maxPolarAngle: 1.42,
          },
        },
      }),
    ]);
    expect(stagePlaneProps).toEqual([
      expect.objectContaining({
        id: "example.interaction.floor",
        role: "floor",
        size: [820, 460],
        position: [0, -180, -70],
        material: { kind: "standard", color: "#23322f", roughness: 0.72 },
        effects: [
          {
            kind: "example.sceneObjectHoverPulse",
            baseOpacity: 0.68,
            hoverOpacity: 0.92,
            dragOpacity: 1,
          },
        ],
        interaction: {
          pickable: {
            hitTest: "bounds",
            pointer: { hover: true, press: true, click: true },
          },
        },
      }),
    ]);
    expect(modelProps).toEqual([
      expect.objectContaining({
        id: "example.interaction.hero",
        src: "/models/hero.glb",
        loader: { draco: { decoderPath: "/draco/gltf/", preload: true } },
        position: [180, -118, -42],
        scale: 4,
        prepare: { renderWarmup: "idle" },
        effects: [
          {
            kind: "example.sceneObjectDragPose",
            baseScale: 4,
            hoverScale: 1.04,
            dragScale: 1.1,
            baseRotationY: -0.42,
          },
        ],
        interaction: {
          pickable: {
            hitTest: "bounds",
            pointer: { hover: true, press: true, drag: true, click: true },
          },
        },
      }),
    ]);
    expect(targetProps).toEqual([
      expect.objectContaining({
        as: "article",
        webgl: {
          key: "example.interaction.screen-plane-card",
          sceneId: "example.interaction.scene",
          source: { kind: "dom", type: "element" },
          placement: {
            mode: "screen-plane",
            planeId: "example.interaction.floor",
            offset: [0, 6, 0],
            scale: 0.86,
          },
          lifecycle: { hideWhenReady: false },
          effects: [{ kind: "example.surfaceFill", opacity: 0.52 }],
        },
      }),
    ]);
    expect(lightProps).toEqual([
      { id: "example.interaction.ambient", kind: "ambient", intensity: 0.34 },
      {
        id: "example.interaction.key",
        kind: "point",
        color: "#8bd6ca",
        intensity: 2.35,
        position: [-160, 160, 180],
      },
    ]);
  });
});
