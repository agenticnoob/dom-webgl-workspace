import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

const scrollTimelineProps: ScrollTimelineMockProps[] = [];
const targetProps: TargetMockProps[] = [];
const sceneProps: SceneMockProps[] = [];
const cameraProps: CameraMockProps[] = [];
const stagePlaneProps: StagePlaneMockProps[] = [];
const stageBoxProps: StageBoxMockProps[] = [];
const lightProps: LightMockProps[] = [];
const modelProps: ModelMockProps[] = [];
const passViewportProps: PassViewportMockProps[] = [];

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

type TargetMockProps = {
  readonly as?: keyof HTMLElementTagNameMap;
  readonly children?: ReactNode;
  readonly className?: string;
  readonly webgl: {
    readonly key: string;
    readonly source?: Record<string, unknown>;
    readonly placement?: Record<string, unknown>;
    readonly lifecycle?: Record<string, unknown>;
    readonly effects?: readonly Record<string, unknown>[];
    readonly transformScope?: "self" | "subtree";
    readonly timeline?: TimelineMockProps;
  };
};

type SceneMockProps = {
  readonly id: string;
  readonly projection?: string;
  readonly render?: Record<string, unknown>;
  readonly timeline?: TimelineMockProps;
  readonly children?: ReactNode;
};

type PassViewportMockProps = {
  readonly id: string;
  readonly as?: keyof HTMLElementTagNameMap;
  readonly className?: string;
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
  readonly controller?: {
    readonly timeline: {
      readonly id: string;
      readonly range?: {
        readonly from: number;
        readonly to: number;
      };
    };
    readonly to: {
      readonly position?: readonly [number, number, number];
      readonly target?: readonly [number, number, number];
      readonly fov?: number;
    };
    readonly easing?: string;
  };
};

type StagePlaneMockProps = {
  readonly id: string;
  readonly role?: string;
  readonly size?: readonly [number, number];
  readonly position?: readonly [number, number, number];
  readonly material?: Record<string, unknown>;
  readonly timeline?: TimelineMockProps;
};

type StageBoxMockProps = {
  readonly id: string;
  readonly size?: readonly [number, number, number];
  readonly position?: readonly [number, number, number];
  readonly rotation?: readonly [number, number, number];
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

type ModelMockProps = {
  readonly id: string;
  readonly src: string;
  readonly loader?: Record<string, unknown>;
  readonly position?: readonly [number, number, number];
  readonly rotation?: readonly [number, number, number];
  readonly scale?: number | readonly [number, number, number];
  readonly animation?: Record<string, unknown>;
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
  WebGLPassViewport: ({
    as = "div",
    children,
    ...props
  }: PassViewportMockProps) => {
    passViewportProps.push({ as, children, ...props });
    return createElement(as, props, children);
  },
  WebGLTarget: ({ as = "div", children, className, webgl }: TargetMockProps) => {
    targetProps.push({ as, children, className, webgl });
    return createElement(as, { className }, children);
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
  WebGLLight: (props: LightMockProps) => {
    lightProps.push(props);
    return null;
  },
  WebGLModel: (props: ModelMockProps) => {
    modelProps.push(props);
    return null;
  },
}));

describe("ManagedTimelineExample", () => {
  test("dogfoods pinned viewport progress without timeline-gating visible scene objects", async () => {
    const { ManagedTimelineExample } = await import("../src/ManagedTimelineExample");

    const markup = renderToStaticMarkup(createElement(ManagedTimelineExample));

    expect(markup).toContain("example-managed-stage-timeline");
    expect(markup).toContain("pinned managed scene");
    expect(markup).toContain("camera 和右侧卡片效果");
    expect(markup).toContain("Timeline driven card");
    expect(markup).toContain("example-managed-stage-viewport");
    expect(markup).toMatch(
      /<div data-webgl-scene="example\.managedStage\.scene"><article class="example-managed-stage-card">/,
    );
    expect(scrollTimelineProps).toEqual([
      expect.objectContaining({
        as: "section",
        className: "example-row example-managed-stage-timeline",
        end: "+=240%",
        id: "example.managedTimeline",
        pin: true,
        scrub: true,
        start: "top top",
      }),
    ]);
    expect(scrollTimelineProps[0]?.progressKey).toBeUndefined();
    expect(passViewportProps).toEqual([
      expect.objectContaining({
        id: "example.managedStage.viewport",
        as: "div",
        className: "example-managed-stage-viewport",
      }),
    ]);
    expect(sceneProps).toEqual([
      expect.objectContaining({
        id: "example.managedStage.scene",
        projection: "perspective-stage",
        render: {
          camera: "example.managedStage.camera",
          order: -8,
          clearDepth: true,
          viewport: { mode: "dom-rect", scissor: true },
        },
      }),
    ]);
    expect(sceneProps[0]).not.toHaveProperty("timeline");
    expect(cameraProps).toEqual([
      expect.objectContaining({
        id: "example.managedStage.camera",
        default: true,
        type: "perspective",
        mode: "perspective-stage",
        fov: 42,
        position: [0, 136, 560],
        target: [0, -88, -40],
        controller: {
          timeline: {
            id: "example.managedTimeline",
            range: { from: 0.12, to: 0.88 },
          },
          to: {
            position: [0, 96, 520],
            target: [0, 36, 0],
            fov: 34,
          },
          easing: "smoothstep",
        },
      }),
    ]);
    expect(cameraProps[0]).not.toHaveProperty("timeline");
    expect(stagePlaneProps).toEqual([
      expect.objectContaining({
        id: "example.managedStage.floor",
        role: "floor",
        size: [920, 520],
        position: [0, -178, 0],
        material: { kind: "standard", color: "#16241f", roughness: 0.82 },
      }),
      expect.objectContaining({
        id: "example.managedStage.backdrop",
        role: "backdrop",
        size: [920, 430],
        position: [0, 18, -290],
        material: { kind: "standard", color: "#1f3a32", roughness: 0.7 },
      }),
    ]);
    expect(stagePlaneProps.every((props) => props.timeline === undefined)).toBe(true);
    expect(stageBoxProps).toEqual([
      expect.objectContaining({
        id: "example.managedStage.plinth",
        size: [220, 96, 180],
        position: [0, -130, -56],
        material: { kind: "standard", color: "#566b61", roughness: 0.56 },
      }),
    ]);
    expect(stageBoxProps.every((props) => props.timeline === undefined)).toBe(true);
    expect(modelProps).toEqual([]);
    expect(lightProps).toEqual([
      expect.objectContaining({
        id: "example.managedStage.ambient",
        kind: "ambient",
        intensity: 0.24,
      }),
      expect.objectContaining({
        id: "example.managedStage.key",
        kind: "point",
        color: "#f6c453",
        intensity: 1.85,
        position: [-180, 160, 220],
      }),
    ]);
    expect(lightProps.every((props) => props.timeline === undefined)).toBe(true);
    expect(targetProps).toEqual([
      expect.objectContaining({
        as: "article",
        className: "example-managed-stage-card",
        webgl: expect.objectContaining({
          key: "example.managedStage.card",
          source: { kind: "dom", type: "element" },
          placement: { mode: "screen-depth", depth: 120, size: "dom" },
          lifecycle: { hideWhenReady: true, hideMode: "subtree" },
          effects: [
            {
              kind: "example.managedTimelineCard",
              progressKey: "example.managedTimeline",
            },
          ],
        }),
      }),
    ]);
    expect(targetProps[0]?.webgl).not.toHaveProperty("timeline");
  });
});
