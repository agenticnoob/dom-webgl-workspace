import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

const scrollTimelineProps: ScrollTimelineMockProps[] = [];
const sceneProps: SceneMockProps[] = [];
const cameraProps: CameraMockProps[] = [];
const lightProps: LightMockProps[] = [];
const modelProps: ModelMockProps[] = [];
const passViewportProps: PassViewportMockProps[] = [];
const expectedSpeedLinePlaneClips = [
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

type ScrollTimelineMockProps = {
  readonly as?: string;
  readonly children?: ReactNode;
  readonly className?: string;
  readonly end?: string;
  readonly id: string;
  readonly pin?: boolean;
  readonly scrub?: boolean | number;
  readonly start?: string;
};

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

vi.mock("@project/dom-webgl-scroll-adapters/react", () => ({
  WebGLScrollTimeline: ({
    as = "section",
    children,
    className,
    id,
    ...props
  }: ScrollTimelineMockProps) => {
    scrollTimelineProps.push({ as, children, className, id, ...props });
    return createElement(as, { className, "data-timeline-id": id }, children);
  },
}));

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
    expect(markup).toContain("Main skeleton");
    expect(markup).toContain("Speed-line planes");
    expect(markup).toContain("Checkout scrub");
    expect(markup).toContain("Bag rig");
    expect(scrollTimelineProps).toEqual([
      expect.objectContaining({
        id: "example.managedModel.timeline",
        className: "example-row example-managed-model-dogfood",
        start: "top top",
        end: "+=180%",
        pin: true,
        scrub: true,
      }),
    ]);
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
        position: [80, 132, 640],
        target: [116, -76, -80],
      }),
    ]);
    expect(modelProps).toEqual([
      expect.objectContaining({
        id: "example.managedModel.sprint",
        src: "/models/Sprint.glb",
        loader: { draco: { decoderPath: "/draco/gltf/", preload: true } },
        position: [116, -86, -80],
        rotation: [0, -0.58, 0],
        scale: 9.5,
        animation: {
          defaultClips: [
            {
              clip: "MainSkeleton.001",
              loop: "repeat",
              fadeInMs: 160,
              timeScale: 2.4,
            },
            { clip: "SpeedLines.001", loop: "repeat", timeScale: 2.8 },
            ...expectedSpeedLinePlaneClips.map((clip) => ({
              clip,
              loop: "repeat",
              timeScale: 3.2,
            })),
            { clip: "checkoutCTRL.001", loop: "repeat", timeScale: 2.4 },
            { clip: "BagArmature.001", loop: "repeat", timeScale: 2.4 },
          ],
          scrub: {
            clip: "checkoutCTRL.001",
            timeline: {
              id: "example.managedModel.timeline",
              active: { from: 0.08, to: 0.92 },
            },
            durationSeconds: 8.333,
          },
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
