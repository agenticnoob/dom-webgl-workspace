import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

const scrollTimelineProps: ScrollTimelineMockProps[] = [];
const sceneProps: SceneMockProps[] = [];
const cameraProps: CameraMockProps[] = [];
const stagePlaneProps: StagePlaneMockProps[] = [];
const lightProps: LightMockProps[] = [];

type TimelineMockProps = {
  readonly id: string;
  readonly progressKey?: string;
  readonly active?: {
    readonly from: number;
    readonly to: number;
  };
};

type ScrollTimelineMockProps = {
  readonly as?: keyof HTMLElementTagNameMap;
  readonly children?: ReactNode;
  readonly className?: string;
  readonly end?: string;
  readonly id: string;
  readonly progressKey?: string;
  readonly scrub?: boolean | number;
  readonly start?: string;
};

type SceneMockProps = {
  readonly id: string;
  readonly projection?: string;
  readonly render?: Record<string, unknown>;
  readonly timeline?: TimelineMockProps;
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
  readonly material?: Record<string, unknown>;
  readonly timeline?: TimelineMockProps;
};

type LightMockProps = {
  readonly id: string;
  readonly kind: string;
  readonly intensity?: number;
  readonly position?: readonly [number, number, number];
  readonly color?: string;
  readonly timeline?: TimelineMockProps;
};

vi.mock("@project/dom-webgl-scroll-adapters/react", () => ({
  WebGLScrollTimeline: ({
    as = "section",
    children,
    className,
    ...props
  }: ScrollTimelineMockProps) => {
    scrollTimelineProps.push({ as, children, className, ...props });
    return createElement(
      as,
      { className, "data-webgl-scroll-timeline": props.id },
      children,
    );
  },
}));

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
  WebGLLight: (props: LightMockProps) => {
    lightProps.push(props);
    return null;
  },
}));

describe("ManagedTimelineExample", () => {
  test("declares a named scroll timeline for a managed scene and stage objects", async () => {
    const { ManagedTimelineExample } = await import("../src/ManagedTimelineExample");

    const markup = renderToStaticMarkup(createElement(ManagedTimelineExample));

    expect(markup).toContain("example-timeline-dogfood");
    expect(markup).toContain("命名滚动 timeline 驱动 managed scene");
    expect(scrollTimelineProps).toEqual([
      expect.objectContaining({
        as: "section",
        className: "example-row example-timeline-dogfood",
        end: "bottom top",
        id: "example.managedTimeline",
        scrub: true,
        start: "top bottom",
      }),
    ]);
    expect(scrollTimelineProps[0]?.progressKey).toBeUndefined();
    expect(sceneProps).toEqual([
      expect.objectContaining({
        id: "example.timeline.scene",
        projection: "perspective-stage",
        render: {
          camera: "example.timeline.camera",
          order: -8,
          clearDepth: true,
        },
        timeline: {
          id: "example.managedTimeline",
          active: { from: 0.08, to: 0.94 },
        },
      }),
    ]);
    expect(cameraProps).toEqual([
      expect.objectContaining({
        id: "example.timeline.camera",
        default: true,
        type: "perspective",
        mode: "perspective-stage",
        position: [0, 96, 480],
        target: [0, -70, -40],
      }),
    ]);
    expect(cameraProps[0]).not.toHaveProperty("timeline");
    expect(stagePlaneProps).toEqual([
      expect.objectContaining({
        id: "example.timeline.floor",
        role: "floor",
        size: [780, 420],
        position: [0, -160, 0],
        material: { kind: "standard", color: "#13251f", roughness: 0.8 },
        timeline: {
          id: "example.managedTimeline",
          active: { from: 0.18, to: 0.88 },
        },
      }),
      expect.objectContaining({
        id: "example.timeline.backdrop",
        role: "backdrop",
        size: [780, 360],
        position: [0, 4, -250],
        material: { kind: "standard", color: "#234036", roughness: 0.68 },
        timeline: {
          id: "example.managedTimeline",
          active: { from: 0.26, to: 0.92 },
        },
      }),
    ]);
    expect(lightProps).toEqual([
      expect.objectContaining({
        id: "example.timeline.key",
        kind: "point",
        color: "#f6c453",
        intensity: 1.7,
        position: [-160, 120, 180],
        timeline: {
          id: "example.managedTimeline",
          active: { from: 0.34, to: 1 },
        },
      }),
    ]);
  });
});
