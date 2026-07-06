import { act, createElement, useState, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { WebGLDebugState } from "@project/dom-webgl-runtime";

const runtimeProps: RuntimeMockProps[] = [];
const scrollRuntimeProps: ScrollRuntimeMockProps[] = [];
const scrollSectionProps: ScrollEffectSectionMockProps[] = [];
const scrollTimelineProps: ScrollTimelineMockProps[] = [];
const expectedManagedModelSpeedLinePlaneClips = [
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
const targetProps: TargetMockProps[] = [];
const sceneProps: SceneMockProps[] = [];
const cameraProps: CameraMockProps[] = [];
const stagePlaneProps: StagePlaneMockProps[] = [];
const stageBoxProps: StageBoxMockProps[] = [];
const lightProps: LightMockProps[] = [];
const modelProps: ModelMockProps[] = [];
const passViewportProps: PassViewportMockProps[] = [];
const roots: Root[] = [];

vi.mock("gsap", () => ({
  default: {
    registerPlugin: vi.fn(),
  },
}));

vi.mock("gsap/ScrollTrigger", () => ({
  ScrollTrigger: vi.fn(),
}));

vi.mock("lenis", () => ({
  default: vi.fn(() => ({
    destroy: vi.fn(),
    raf: vi.fn(),
  })),
}));

vi.mock("lenis/dist/lenis.css", () => ({}));

type ScrollRuntimeMockProps = RuntimeMockProps & {
  readonly className?: string;
  readonly smooth?: unknown;
};

type ScrollEffectSectionMockProps = {
  readonly as?: keyof HTMLElementTagNameMap;
  readonly children?: ReactNode;
  readonly className?: string;
  readonly end?: string;
  readonly pin?: boolean | string | Element;
  readonly progressKey: string;
  readonly scrub?: boolean | number;
  readonly start?: string;
};

type ScrollTimelineMockProps = Omit<
  ScrollEffectSectionMockProps,
  "progressKey"
> & {
  readonly id: string;
  readonly progressKey?: string;
};

type RuntimeMockProps = {
  children?: ReactNode;
  effects?: readonly unknown[];
  scrollAdapter?: unknown;
  onDebugStateChange?: (state: WebGLDebugState) => void;
};

type TargetMockProps = {
  as?: keyof HTMLElementTagNameMap;
  children?: ReactNode;
  webgl: {
    key: string;
    source?: Record<string, unknown>;
    placement?: Record<string, unknown>;
    renderRole?: string;
    effects?: readonly Record<string, unknown>[];
    lifecycle?: Record<string, unknown>;
    scroll?: { readonly type?: unknown };
    transformScope?: "self" | "subtree";
    timeline?: Record<string, unknown>;
  };
};

type SceneMockProps = {
  readonly id: string;
  readonly projection?: string;
  readonly render?: Record<string, unknown>;
  readonly timeline?: Record<string, unknown>;
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
  readonly timeline?: Record<string, unknown>;
  readonly effects?: readonly Record<string, unknown>[];
  readonly interaction?: Record<string, unknown>;
};

type StageBoxMockProps = {
  readonly id: string;
  readonly size?: readonly [number, number, number];
  readonly position?: readonly [number, number, number];
  readonly material?: Record<string, unknown>;
  readonly timeline?: Record<string, unknown>;
};

type LightMockProps = {
  readonly id: string;
  readonly kind: string;
  readonly intensity?: number;
  readonly position?: readonly [number, number, number];
  readonly color?: string;
  readonly timeline?: Record<string, unknown>;
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
  readonly effects?: readonly Record<string, unknown>[];
  readonly interaction?: Record<string, unknown>;
};

type PassViewportMockProps = {
  readonly id: string;
  readonly as?: keyof HTMLElementTagNameMap;
  readonly className?: string;
  readonly "aria-hidden"?: boolean | "true" | "false";
  readonly children?: ReactNode;
};

vi.mock("@project/dom-webgl-scroll-adapters/react", () => ({
  WebGLScrollRuntime: (props: ScrollRuntimeMockProps) => {
    scrollRuntimeProps.push(props);
    return createElement("div", { "data-testid": "example-scroll-runtime" }, props.children);
  },
  ScrollEffectSection: ({
    as = "section",
    children,
    className,
    progressKey,
    ...props
  }: ScrollEffectSectionMockProps) => {
    scrollSectionProps.push({ as, children, className, progressKey, ...props });
    return createElement(as, { className, "data-progress-key": progressKey }, children);
  },
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
  useScrollEffectProgressStore: () => ({
    source: {
      get: () => 0,
    },
    set: vi.fn(),
    reset: vi.fn(),
    clear: vi.fn(),
  }),
}));

vi.mock("@project/dom-webgl-runtime/react", () => ({
  WebGLRuntime: (props: RuntimeMockProps) => {
    runtimeProps.push(props);
    return createElement("div", { "data-testid": "example-runtime" }, props.children);
  },
  WebGLTarget: ({ as = "div", children, webgl, ...props }: TargetMockProps) => {
    targetProps.push({ as, children, webgl });
    return createElement(as, props, children);
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
  WebGLPassViewport: ({ as = "div", children, ...props }: PassViewportMockProps) => {
    passViewportProps.push({ as, children, ...props });
    return createElement(as, props, children);
  },
  WebGLDebugPanel: () => null,
  useWebGLDebugState: () => {
    const [state, setState] = useState<WebGLDebugState>({
      targetCount: 0,
      renderableCount: 0,
      currentScrollMode: "page",
      pointer: {
        x: 0, y: 0, normalizedX: 0, normalizedY: 0,
        isInside: false, isDown: false, downTime: 0,
        pressDuration: 0, isDragging: false,
        dragStartX: 0, dragStartY: 0,
        dragDeltaX: 0, dragDeltaY: 0, clickCount: 0,
        buttons: [],
        modifiers: { shift: false, alt: false, ctrl: false, meta: false },
      },
      targets: [],
    });
    return [state, setState];
  },
}));

vi.mock("../src/exampleResourceScheduler", () => ({
  useExampleResources: () => ({
    imageSequenceFrames: Array.from({ length: 454 }, () => document.createElement("img")),
    imageSequenceReady: true,
    modelReady: true,
  }),
}));

describe("effect authoring example app", () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    runtimeProps.length = 0;
    scrollRuntimeProps.length = 0;
    scrollSectionProps.length = 0;
    scrollTimelineProps.length = 0;
    targetProps.length = 0;
    sceneProps.length = 0;
    cameraProps.length = 0;
    stagePlaneProps.length = 0;
    stageBoxProps.length = 0;
    lightProps.length = 0;
    modelProps.length = 0;
    passViewportProps.length = 0;
    for (const root of roots.splice(0)) {
      act(() => {
        root.unmount();
      });
    }
    document.body.replaceChildren();
  });

  test("registers a stable React runtime effect array and the vertical effect catalog", async () => {
    const { default: App } = await import("../src/App");
    const { exampleEffects } = await import("../src/exampleEffects");
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    roots.push(root);

    await act(async () => {
      root.render(createElement(App));
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(scrollRuntimeProps.length).toBeGreaterThanOrEqual(1);
    expect(scrollRuntimeProps.every(({ effects }) => effects === exampleEffects)).toBe(true);
    expect(scrollRuntimeProps.at(-1)?.smooth).toMatchObject({
      gsap: expect.any(Object),
      ScrollTrigger: expect.any(Function),
      getViewportHeight: expect.any(Function),
      createLenis: expect.any(Function),
    });
    expect(scrollRuntimeProps.at(-1)?.scrollAdapter).toBeUndefined();
    expect(scrollRuntimeProps.at(-1)?.onDebugStateChange).toBeTypeOf("function");
    expect(host.querySelector('[data-testid="example-scroll-runtime"]')).not.toBeNull();
    expect(host.querySelectorAll(".example-row-copy")).toHaveLength(0);
    expect(host.querySelectorAll(".example-effect-pill")).toHaveLength(22);
    expect(host.querySelectorAll(".example-effect-panel")).toHaveLength(0);
    expect(host.querySelector(".example-text-pressure")).toBeInstanceOf(HTMLElement);
    expect(host.querySelector(".example-text-scramble")).toBeInstanceOf(HTMLElement);
    expect(host.querySelector(".example-stage-dogfood")).toBeInstanceOf(HTMLElement);
    expect(host.querySelector(".example-stage-viewport")).toBeInstanceOf(HTMLElement);
    expect(host.querySelector(".example-managed-model-dogfood")).toBeInstanceOf(HTMLElement);
    expect(host.querySelector(".example-managed-model-viewport")).toBeInstanceOf(HTMLElement);
    expect(host.querySelector(".example-timeline-dogfood")).toBeNull();
    expect(host.querySelector(".example-managed-stage-timeline")).toBeInstanceOf(HTMLElement);
    expect(host.querySelector(".example-managed-stage-viewport")).toBeInstanceOf(HTMLElement);
    expect(host.querySelector(".example-interaction-dogfood")).toBeInstanceOf(HTMLElement);
    expect(host.querySelector(".example-interaction-viewport")).toBeInstanceOf(HTMLElement);
    expect(host.querySelector(".example-interaction-card")).toBeInstanceOf(HTMLElement);
    expect(
      Array.from(
        host.querySelectorAll(
          ".example-stage-dogfood, .example-managed-model-dogfood, .example-managed-stage-timeline, .example-interaction-dogfood",
        ),
        (element) => {
          if (element.classList.contains("example-stage-dogfood")) {
            return "stage";
          }
          if (element.classList.contains("example-managed-model-dogfood")) {
            return "model";
          }
          if (element.classList.contains("example-managed-stage-timeline")) {
            return "timeline";
          }
          return "interaction";
        },
      ),
    ).toEqual(["stage", "model", "timeline", "interaction"]);
    expect(passViewportProps).toContainEqual(
      expect.objectContaining({
        id: "example.stage.viewport",
        as: "div",
        className: "example-stage-viewport",
        "aria-hidden": "true",
      }),
    );
    expect(passViewportProps).toContainEqual(
      expect.objectContaining({
        id: "example.managedModel.viewport",
        as: "div",
        className: "example-managed-model-viewport",
        "aria-hidden": "true",
      }),
    );
    expect(passViewportProps).toContainEqual(
      expect.objectContaining({
        id: "example.managedStage.viewport",
        as: "div",
        className: "example-managed-stage-viewport",
      }),
    );
    expect(passViewportProps).toContainEqual(
      expect.objectContaining({
        id: "example.interaction.viewport",
        as: "div",
        className: "example-interaction-viewport",
        "aria-hidden": "true",
      }),
    );
    expect(sceneProps).toContainEqual(
      expect.objectContaining({
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
      }),
    );
    expect(sceneProps).toContainEqual(
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
    );
    expect(sceneProps).toContainEqual(
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
    );
    expect(sceneProps.find(({ id }) => id === "example.managedStage.scene")).not.toHaveProperty("timeline");
    expect(sceneProps).toContainEqual(
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
    );
    expect(cameraProps).toContainEqual(
      expect.objectContaining({
        id: "example.managedModel.camera",
        mode: "perspective-stage",
      }),
    );
    expect(cameraProps).toContainEqual(
      expect.objectContaining({
        id: "example.managedStage.camera",
        mode: "perspective-stage",
      }),
    );
    expect(cameraProps.find(({ id }) => id === "example.managedStage.camera")).not.toHaveProperty("timeline");
    expect(cameraProps).toContainEqual(
      expect.objectContaining({
        id: "example.interaction.camera",
        mode: "perspective-stage",
        controller: expect.objectContaining({
          pointer: expect.objectContaining({
            orbit: expect.objectContaining({
              drag: { button: "primary" },
              target: [120, -78, -70],
              sensitivity: [0.0035, 0.003],
              minPolarAngle: 0.52,
              maxPolarAngle: 1.42,
            }),
            pan: expect.objectContaining({
              drag: { button: "secondary" },
            }),
            dolly: expect.objectContaining({
              drag: { button: "primary", modifier: "alt" },
            }),
            parallax: expect.objectContaining({ scope: "camera" }),
            damping: expect.objectContaining({ factor: 0.18 }),
            reset: expect.objectContaining({ onDoubleClick: true }),
          }),
        }),
      }),
    );
    expect(stagePlaneProps.map(({ id }) => id)).toEqual([
      "example.stage.floor",
      "example.stage.backdrop",
      "example.managedStage.floor",
      "example.managedStage.backdrop",
      "example.interaction.floor",
    ]);
    expect(stageBoxProps.map(({ id }) => id)).toEqual([
      "example.stage.plinth",
      "example.stage.bloomRail",
      "example.managedStage.plinth",
    ]);
    expect(lightProps.map(({ id }) => id)).toEqual([
      "example.stage.ambient",
      "example.stage.key",
      "example.stage.rim",
      "example.managedModel.ambient",
      "example.managedModel.key",
      "example.managedStage.ambient",
      "example.managedStage.key",
      "example.interaction.ambient",
      "example.interaction.key",
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
            ...expectedManagedModelSpeedLinePlaneClips.map((clip) => ({
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
      expect.objectContaining({
        id: "example.interaction.hero",
        src: "/models/hero.glb",
        loader: { draco: { decoderPath: "/draco/gltf/", preload: true } },
        position: [180, -118, -42],
        scale: 4,
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
        prepare: { renderWarmup: "idle" },
      }),
    ]);
    expect(stagePlaneProps.find(({ id }) => id === "example.interaction.floor")).toMatchObject({
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
    });
    expect(
      stagePlaneProps
        .filter(({ id }) => id.startsWith("example.managedStage."))
        .every((prop) => prop.timeline === undefined),
    ).toBe(true);
    expect(stageBoxProps.find(({ id }) => id === "example.managedStage.plinth")).not.toHaveProperty("timeline");
    expect(
      lightProps
        .filter(({ id }) => id.startsWith("example.managedStage."))
        .every((prop) => prop.timeline === undefined),
    ).toBe(true);

    const firstDescriptionToggle = host.querySelector<HTMLButtonElement>(".example-effect-pill");
    expect(firstDescriptionToggle).not.toBeNull();
    await act(async () => {
      firstDescriptionToggle?.click();
    });
    expect(host.querySelectorAll(".example-effect-pill")).toHaveLength(21);
    expect(host.querySelectorAll(".example-effect-panel")).toHaveLength(1);
    expect(host.querySelector(".example-effect-panel")?.textContent).toContain("表面填充");

    const expandedDescriptionToggle = host.querySelector<HTMLButtonElement>(".example-effect-panel-header");
    expect(expandedDescriptionToggle).not.toBeNull();
    await act(async () => {
      expandedDescriptionToggle?.click();
    });
    expect(host.querySelectorAll(".example-effect-pill")).toHaveLength(22);
    expect(host.querySelectorAll(".example-effect-panel")).toHaveLength(0);

    const finalTargetProps = targetProps.slice(-28);

    expect(finalTargetProps.map(({ webgl }) => webgl.key)).toEqual([
      "example.surface.fill",
      "example.surface.pulse",
      "example.surface.video-background",
      "example.surface.ghost-cursor",
      "example.surface.waves",
      "example.managedStage.card",
      "example.interaction.screen-plane-card",
      "example.text.wave",
      "example.text.reveal",
      "example.text.spotlight",
      "example.text.pressure",
      "example.text.scramble",
      "example.text.combo",
      "example.image.pan",
      "example.image.zoom",
      "example.image.ken-burns",
      "example.image.hover-reveal",
      "example.video.playback",
      "example.video.drift",
      "example.image-sequence.scrub",
      "example.image-sequence.card",
      "example.image-sequence.card.title",
      "example.image-sequence.card.description",
      "example.model.spin",
      "example.model.float",
      "example.model.dark-scene",
      "example.model.float-glow",
      "example.pinned.reveal",
    ]);
    expect(finalTargetProps.map(({ as }) => as ?? "div")).toEqual([
      "section",
      "section",
      "section",
      "section",
      "section",
      "article",
      "article",
      "p",
      "p",
      "p",
      "p",
      "p",
      "p",
      "img",
      "img",
      "img",
      "img",
      "video",
      "video",
      "section",
      "aside",
      "strong",
      "span",
      "section",
      "section",
      "section",
      "section",
      "p",
    ]);
    expect(finalTargetProps.map(({ webgl }) => webgl.source)).toEqual([
      { kind: "dom", type: "element" },
      { kind: "dom", type: "element" },
      { kind: "dom", type: "element" },
      { kind: "dom", type: "element" },
      { kind: "dom", type: "element" },
      { kind: "dom", type: "element" },
      { kind: "dom", type: "element" },
      { kind: "dom", type: "text" },
      { kind: "dom", type: "text" },
      { kind: "dom", type: "text" },
      { kind: "dom", type: "text" },
      { kind: "dom", type: "text" },
      { kind: "dom", type: "text" },
      { kind: "media", type: "image", src: "/example/image.png" },
      { kind: "media", type: "image", src: "/example/image.png" },
      { kind: "media", type: "image", src: "/example/bg.png" },
      { kind: "media", type: "image", src: "/example/show.png" },
      { kind: "media", type: "video", src: "/example/video.mp4" },
      { kind: "media", type: "video", src: "/example/video.mp4" },
      {
        kind: "media",
        type: "image-sequence",
        frameCount: 454,
        frames: expect.arrayContaining([expect.any(HTMLImageElement)]),
        progressKey: "example.video.scrub",
      },
      { kind: "dom", type: "element" },
      { kind: "dom", type: "text" },
      { kind: "dom", type: "text" },
      { kind: "model", type: "glb", src: "/models/hero.glb" },
      { kind: "model", type: "glb", src: "/models/hero.glb" },
      { kind: "dom", type: "element" },
      {
        kind: "model",
        type: "glb",
        src: "/models/4.glb",
        loader: { draco: { decoderPath: "/draco/gltf/" } },
      },
      { kind: "dom", type: "text" },
    ]);
    expect(finalTargetProps.map(({ webgl }) => webgl.effects?.[0]?.kind)).toEqual([
      "example.surfaceFill",
      "example.surfacePulse",
      "example.surfaceVideoBackground",
      "example.surfaceGhostCursor",
      "example.surfaceWaves",
      "example.managedTimelineCard",
      "example.surfaceFill",
      "example.textWave",
      "example.textReveal",
      "example.textSpotlight",
      "example.textPressure",
      "example.textScramble",
      "example.textSpotlightPressureScrambleWave",
      "example.imagePan",
      "example.imageZoom",
      "example.imageKenBurns",
      "example.imageHoverReveal",
      "example.videoPlayback",
      "example.videoPlayback",
      "example.mediaPointerParallax",
      "example.sequenceCardSlide",
      "example.textReveal",
      "example.textReveal",
      "example.modelSpin",
      "example.modelFloat",
      "example.modelDarkScene",
      "example.modelFloatGlow",
      "example.pinnedReveal",
    ]);
    expect(finalTargetProps[18]?.webgl.effects?.[1]?.kind).toBe("example.videoDrift");
    expect(finalTargetProps[5]?.webgl).toMatchObject({
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
    });
    expect(finalTargetProps[5]?.webgl).not.toHaveProperty("timeline");
    expect(finalTargetProps[6]?.webgl).toMatchObject({
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
    });
    expect(host.querySelector(".example-media-sequence")).toBeInstanceOf(HTMLElement);
    expect(host.querySelector(".example-media-sequence .example-sequence-card")).toBeInstanceOf(HTMLElement);
    expect(host.querySelector(".example-video-scrub-row > .example-sequence-card")).toBeNull();
    expect(finalTargetProps[19]?.webgl.lifecycle).toEqual({
      hideWhenReady: true,
      hideMode: "self",
    });
    expect(finalTargetProps[19]?.webgl.effects?.[0]).toMatchObject({
      kind: "example.mediaPointerParallax",
      bleed: 0.08,
      strength: 0.72,
    });
    expect(finalTargetProps[20]?.webgl.lifecycle).toEqual({
      hideWhenReady: true,
      hideMode: "self",
    });
    expect(finalTargetProps[20]?.webgl).toMatchObject({
      key: "example.image-sequence.card",
      source: { kind: "dom", type: "element" },
      transformScope: "subtree",
    });
    expect(finalTargetProps[20]?.webgl).not.toHaveProperty("renderRole");
    expect(finalTargetProps[20]?.webgl.effects?.[0]).toMatchObject({
      kind: "example.sequenceCardSlide",
      progressKey: "example.video.scrub",
      travel: 96,
      minOpacity: 0.72,
      maxOpacity: 1,
    });
    expect(finalTargetProps[20]?.webgl.effects?.[1]).toMatchObject({
      kind: "example.sequenceCardBorderGlow",
      edgeSensitivity: 0.28,
      colorSensitivity: 0.48,
      glowRadius: 44,
      glowIntensity: 1,
      fillOpacity: 0.46,
    });
    expect(finalTargetProps[21]?.webgl).toMatchObject({
      key: "example.image-sequence.card.title",
      source: { kind: "dom", type: "text" },
      lifecycle: { hideWhenReady: true, hideMode: "self" },
      effects: [
        {
          kind: "example.textReveal",
          color: "#f4f4f5",
          progressKey: "example.video.scrub",
        },
      ],
    });
    expect(finalTargetProps[22]?.webgl).toMatchObject({
      key: "example.image-sequence.card.description",
      source: { kind: "dom", type: "text" },
      lifecycle: { hideWhenReady: true, hideMode: "self" },
      effects: [
        {
          kind: "example.textReveal",
          color: "#b7c4c8",
          progressKey: "example.video.scrub",
        },
      ],
    });
    expect(
      finalTargetProps.every(({ webgl }) => webgl.scroll?.type !== "gate"),
    ).toBe(true);
    expect(scrollSectionProps.slice(-2).map(({ progressKey }) => progressKey)).toEqual([
      "example.video.scrub",
      "example.pinned.reveal",
    ]);
    expect(scrollTimelineProps.map(({ id }) => id)).toEqual([
      "example.managedModel.timeline",
      "example.managedTimeline",
    ]);
    expect(scrollTimelineProps[0]).toMatchObject({
      className: "example-row example-managed-model-dogfood",
      end: "+=180%",
      id: "example.managedModel.timeline",
      pin: true,
      scrub: true,
      start: "top top",
    });
    expect(scrollTimelineProps[1]).toMatchObject({
      className: "example-row example-managed-stage-timeline",
      end: "+=240%",
      id: "example.managedTimeline",
      pin: true,
      scrub: true,
      start: "top top",
    });
    expect(scrollTimelineProps[0]?.progressKey).toBeUndefined();
    expect(scrollTimelineProps[1]?.progressKey).toBeUndefined();
    expect(scrollSectionProps.at(-2)).toMatchObject({
      className: "example-row example-video-scrub-row",
      end: "+=900%",
      pin: true,
      progressKey: "example.video.scrub",
    });
    expect(scrollSectionProps.at(-1)).toMatchObject({
      className: "example-row example-pinned-row",
      end: "+=140%",
      pin: true,
      progressKey: "example.pinned.reveal",
    });
    const pinnedSection = host.querySelector(".example-pinned-row");
    expect(pinnedSection).not.toBeNull();
    expect(host.querySelector('[data-scroll-runway="post-pinned"]')).toBeNull();
    expect(finalTargetProps[25]?.webgl).toMatchObject({
      key: "example.model.dark-scene",
      source: { kind: "dom", type: "element" },
      renderRole: "surface",
      lifecycle: { hideWhenReady: true, hideMode: "self" },
      effects: [{ kind: "example.modelDarkScene" }],
    });
    expect(finalTargetProps[26]?.webgl).toMatchObject({
      key: "example.model.float-glow",
      source: {
        kind: "model",
        type: "glb",
        src: "/models/4.glb",
        loader: { draco: { decoderPath: "/draco/gltf/" } },
      },
      lifecycle: { hideWhenReady: true, hideMode: "subtree" },
      effects: [
        {
          kind: "example.modelFloatGlow",
          speed: 0.46,
          emissive: "#7dd3fc",
          lightIntensity: 1.8,
        },
      ],
    });
    expect(finalTargetProps[27]?.webgl.effects?.[0]).toMatchObject({
      kind: "example.pinnedReveal",
      progressKey: "example.pinned.reveal",
    });

    const firstSequenceCardEffects = finalTargetProps[20]?.webgl.effects;
    await act(async () => {
      root.render(createElement(App));
    });

    const firstManagedStageTarget = finalTargetProps[5];
    const firstPinnedTarget = finalTargetProps[27];
    const secondSequenceCardTarget = targetProps
      .slice(-28)
      .find(({ webgl }) => webgl.key === "example.image-sequence.card");
    const secondManagedStageTarget = targetProps
      .slice(-28)
      .find(({ webgl }) => webgl.key === "example.managedStage.card");
    const secondPinnedTarget = targetProps.at(-1);
    expect(secondSequenceCardTarget?.webgl.effects).toBe(firstSequenceCardEffects);
    expect(secondManagedStageTarget?.webgl.effects).toBe(firstManagedStageTarget?.webgl.effects);
    expect(secondPinnedTarget?.webgl.key).toBe("example.pinned.reveal");
    expect(secondPinnedTarget?.webgl.effects).toBe(firstPinnedTarget?.webgl.effects);
  });
});
