import { act, createElement, useState, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { WebGLDebugState } from "@project/dom-webgl-runtime";

const runtimeProps: RuntimeMockProps[] = [];
const scrollRuntimeProps: ScrollRuntimeMockProps[] = [];
const scrollSectionProps: ScrollEffectSectionMockProps[] = [];
const targetProps: TargetMockProps[] = [];
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
    renderRole?: string;
    effects?: readonly Record<string, unknown>[];
    lifecycle?: Record<string, unknown>;
    scroll?: { readonly type?: unknown };
    transformScope?: "self" | "subtree";
  };
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
    targetProps.length = 0;
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

    const finalTargetProps = targetProps.slice(-25);

    expect(finalTargetProps.map(({ webgl }) => webgl.key)).toEqual([
      "example.surface.fill",
      "example.surface.pulse",
      "example.surface.video-background",
      "example.surface.ghost-cursor",
      "example.surface.waves",
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
      "example.model.float-glow",
      "example.pinned.reveal",
    ]);
    expect(finalTargetProps.map(({ as }) => as ?? "div")).toEqual([
      "section",
      "section",
      "section",
      "section",
      "section",
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
      "p",
    ]);
    expect(finalTargetProps.map(({ webgl }) => webgl.source)).toEqual([
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
      { kind: "model", type: "glb", src: "/models/4.glb" },
      { kind: "dom", type: "text" },
    ]);
    expect(finalTargetProps.map(({ webgl }) => webgl.effects?.[0]?.kind)).toEqual([
      "example.surfaceFill",
      "example.surfacePulse",
      "example.surfaceVideoBackground",
      "example.surfaceGhostCursor",
      "example.surfaceWaves",
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
      "example.modelFloatGlow",
      "example.pinnedReveal",
    ]);
    expect(finalTargetProps[16]?.webgl.effects?.[1]?.kind).toBe("example.videoDrift");
    expect(host.querySelector(".example-media-sequence")).toBeInstanceOf(HTMLElement);
    expect(host.querySelector(".example-media-sequence .example-sequence-card")).toBeInstanceOf(HTMLElement);
    expect(host.querySelector(".example-video-scrub-row > .example-sequence-card")).toBeNull();
    expect(finalTargetProps[17]?.webgl.lifecycle).toEqual({
      hideWhenReady: true,
      hideMode: "self",
    });
    expect(finalTargetProps[17]?.webgl.effects?.[0]).toMatchObject({
      kind: "example.mediaPointerParallax",
      bleed: 0.08,
      strength: 0.72,
    });
    expect(finalTargetProps[18]?.webgl.lifecycle).toEqual({
      hideWhenReady: true,
      hideMode: "self",
    });
    expect(finalTargetProps[18]?.webgl).toMatchObject({
      key: "example.image-sequence.card",
      source: { kind: "dom", type: "element" },
      transformScope: "subtree",
    });
    expect(finalTargetProps[18]?.webgl).not.toHaveProperty("renderRole");
    expect(finalTargetProps[18]?.webgl.effects?.[0]).toMatchObject({
      kind: "example.sequenceCardSlide",
      progressKey: "example.video.scrub",
      travel: 96,
      minOpacity: 0.72,
      maxOpacity: 1,
    });
    expect(finalTargetProps[18]?.webgl.effects?.[1]).toMatchObject({
      kind: "example.sequenceCardBorderGlow",
      edgeSensitivity: 0.28,
      colorSensitivity: 0.48,
      glowRadius: 44,
      glowIntensity: 1,
      fillOpacity: 0.46,
    });
    expect(finalTargetProps[19]?.webgl).toMatchObject({
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
    expect(finalTargetProps[20]?.webgl).toMatchObject({
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
    expect(finalTargetProps[23]?.webgl).toMatchObject({
      key: "example.model.float-glow",
      source: { kind: "model", type: "glb", src: "/models/4.glb" },
      lifecycle: { hideWhenReady: true, hideMode: "subtree" },
      effects: [
        {
          kind: "example.modelFloatGlow",
          amplitude: 30,
          speed: 0.46,
          emissive: "#7dd3fc",
          lightIntensity: 2.2,
        },
      ],
    });
    expect(finalTargetProps[24]?.webgl.effects?.[0]).toMatchObject({
      kind: "example.pinnedReveal",
      progressKey: "example.pinned.reveal",
    });

    const firstSequenceCardEffects = finalTargetProps[18]?.webgl.effects;
    await act(async () => {
      root.render(createElement(App));
    });

    const firstPinnedTarget = finalTargetProps[24];
    const secondSequenceCardTarget = targetProps
      .slice(-25)
      .find(({ webgl }) => webgl.key === "example.image-sequence.card");
    const secondPinnedTarget = targetProps.at(-1);
    expect(secondSequenceCardTarget?.webgl.effects).toBe(firstSequenceCardEffects);
    expect(secondPinnedTarget?.webgl.key).toBe("example.pinned.reveal");
    expect(secondPinnedTarget?.webgl.effects).toBe(firstPinnedTarget?.webgl.effects);
  });
});
