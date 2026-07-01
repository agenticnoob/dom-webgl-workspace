import { describe, expect, test, vi } from "vitest";

import type { WebGLEffectCanvasDrawer } from "@project/dom-webgl-runtime";

import { createEffectContext } from "./effectContext";

import {
  exampleSequenceCardBorderGlowEffect,
  exampleSequenceCardSlideEffect,
} from "../src/sequenceCardEffect";

describe("sequence card example effect", () => {
  test("slides a DOM card through the image sequence using adapter progress", () => {
    const target = {
      setOpacity: vi.fn(),
      setPosition: vi.fn(),
      setVisible: vi.fn(),
    };
    const context = createEffectContext({
      progress: { get: () => 0.5 },
      layout: {
        left: 120,
        top: 240,
        width: 420,
        height: 164,
        viewport: { width: 1280, height: 720 },
      },
      source: {
        kind: "dom",
        type: "element",
        element: document.createElement("aside"),
        surface: {},
      },
      target,
    });

    exampleSequenceCardSlideEffect.update(context, undefined, {
      kind: "example.sequenceCardSlide",
      progressKey: "example.video.scrub",
      travel: 280,
      minOpacity: 0.18,
      maxOpacity: 0.82,
    });

    expect(exampleSequenceCardSlideEffect.source).toBe("dom/element");
    expect(target.setVisible).toHaveBeenCalledWith(true);
    expect(target.setOpacity).toHaveBeenCalledWith(0.82);
    expect(target.setPosition).toHaveBeenCalledWith(330, 398, 0);
  });

  test("keeps the card half transparent while it waits off the left edge", () => {
    const target = {
      setOpacity: vi.fn(),
      setPosition: vi.fn(),
      setVisible: vi.fn(),
    };
    const context = createEffectContext({
      progress: { get: () => 0 },
      layout: {
        left: 120,
        top: 240,
        width: 420,
        height: 164,
        viewport: { width: 1280, height: 720 },
      },
      source: {
        kind: "dom",
        type: "element",
        element: document.createElement("aside"),
        surface: {},
      },
      target,
    });

    exampleSequenceCardSlideEffect.update(context, undefined, {
      kind: "example.sequenceCardSlide",
      progressKey: "example.video.scrub",
      travel: 280,
      minOpacity: 0.18,
      maxOpacity: 0.82,
    });

    expect(target.setVisible).toHaveBeenCalledWith(true);
    expect(target.setOpacity).toHaveBeenCalledWith(0.18);
    expect(target.setPosition).toHaveBeenCalledWith(50, 398, 0);
  });

  test("projects pinned DOM layout without reading runtime scene internals", () => {
    const target = {
      setOpacity: vi.fn(),
      setPosition: vi.fn(),
      setVisible: vi.fn(),
    };
    const context = createEffectContext({
      progress: { get: () => 0.5 },
      layout: {
        left: 120,
        top: -256,
        width: 420,
        height: 164,
        viewport: { width: 1280, height: 720 },
      },
      source: {
        kind: "dom",
        type: "element",
        element: document.createElement("aside"),
        surface: {},
      },
      target,
    });

    exampleSequenceCardSlideEffect.update(context, undefined, {
      kind: "example.sequenceCardSlide",
      progressKey: "example.video.scrub",
      travel: 280,
      minOpacity: 0.18,
      maxOpacity: 0.82,
    });

    expect(target.setPosition).toHaveBeenCalledWith(330, 894, 0);
  });

  test("draws the nested card surface instead of moving an empty element plane", () => {
    const draw = vi.fn();
    const setVisible = vi.fn();
    const setOpacity = vi.fn();
    const element = document.createElement("aside");
    const title = document.createElement("strong");
    const copy = document.createElement("span");
    title.textContent = "嵌套 WebGLTarget";
    copy.textContent = "图片序列只负责 pinned scrub，卡片作为 sibling 跟随页面滚动。";
    element.append(title, copy);
    const context = createEffectContext({
      progress: { get: () => 0.5 },
      layout: { width: 420, height: 164, devicePixelRatio: 1 },
      source: {
        kind: "dom",
        type: "element",
        element,
        surface: {
          draw,
          setVisible,
          setOpacity,
        },
      },
      target: {
        setOpacity: vi.fn(),
        setPosition: vi.fn(),
        setVisible: vi.fn(),
      },
    });

    exampleSequenceCardBorderGlowEffect.update(context, undefined, {
      kind: "example.sequenceCardBorderGlow",
    });

    expect(draw).toHaveBeenCalledTimes(1);
    expect(setVisible).toHaveBeenCalledWith(true);
    expect(setOpacity).toHaveBeenCalledWith(1);
  });

  test("adds pointer-driven border glow when the cursor is near the card edge", () => {
    let drawSurface: WebGLEffectCanvasDrawer | undefined;
    const context2d = createCanvasContextStub();
    const element = document.createElement("aside");
    const title = document.createElement("strong");
    const copy = document.createElement("span");
    title.textContent = "Border glow";
    copy.textContent = "Mouse edge glow";
    element.append(title, copy);
    const context = createEffectContext({
      progress: { get: () => 0.5 },
      layout: {
        left: 100,
        top: 120,
        width: 420,
        height: 164,
        viewport: { width: 1280, height: 720 },
      },
      pointer: { isInside: true, x: 505, y: 202 },
      source: {
        kind: "dom",
        type: "element",
        element,
        surface: {
          draw(drawer) {
            drawSurface = drawer;
          },
        },
      },
      target: {
        setOpacity: vi.fn(),
        setPosition: vi.fn(),
        setVisible: vi.fn(),
      },
    });

    exampleSequenceCardBorderGlowEffect.update(context, undefined, {
      kind: "example.sequenceCardBorderGlow",
      edgeSensitivity: 0.3,
      glowIntensity: 1,
    });
    drawSurface?.({
      canvas: document.createElement("canvas"),
      context: context2d,
      width: 420,
      height: 164,
      devicePixelRatio: 1,
    });

    expect(context2d.createRadialGradient).toHaveBeenCalled();
    expect(context2d.shadowBlurValues).toContain(32);
    expect(context2d.strokeCount).toBeGreaterThan(2);
  });

  test("tracks pointer glow against the WebGL-translated card position", () => {
    let drawSurface: WebGLEffectCanvasDrawer | undefined;
    const context2d = createCanvasContextStub();
    const element = document.createElement("aside");
    const title = document.createElement("strong");
    const copy = document.createElement("span");
    title.textContent = "Translated card";
    copy.textContent = "Pointer follows WebGL position";
    element.append(title, copy);
    const context = createEffectContext({
      progress: { get: () => 1 },
      layout: {
        left: 120,
        top: 240,
        width: 420,
        height: 164,
        viewport: { width: 1280, height: 720 },
      },
      pointer: { isInside: true, x: 812, y: 322 },
      source: {
        kind: "dom",
        type: "element",
        element,
        surface: {
          draw(drawer) {
            drawSurface = drawer;
          },
        },
      },
      target: {
        setOpacity: vi.fn(),
        setPosition: vi.fn(),
        setVisible: vi.fn(),
      },
    });

    exampleSequenceCardBorderGlowEffect.update(context, undefined, {
      kind: "example.sequenceCardBorderGlow",
      progressKey: "example.video.scrub",
      travel: 280,
      edgeSensitivity: 0.3,
      glowIntensity: 1,
    });
    drawSurface?.({
      canvas: document.createElement("canvas"),
      context: context2d,
      width: 420,
      height: 164,
      devicePixelRatio: 1,
    });

    expect(context2d.createRadialGradient).toHaveBeenCalled();
    expect(context2d.strokeCount).toBeGreaterThan(2);
  });
});

function createCanvasContextStub(): CanvasRenderingContext2D & {
  readonly shadowBlurValues: number[];
  readonly strokeCount: number;
} {
  const shadowBlurValues: number[] = [];
  let strokeCount = 0;
  const context = {
    canvas: document.createElement("canvas"),
    createLinearGradient: vi.fn(() => createGradientStub()),
    createRadialGradient: vi.fn(() => createGradientStub()),
    save: vi.fn(),
    restore: vi.fn(),
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(() => {
      strokeCount += 1;
    }),
    fillText: vi.fn(),
    measureText: vi.fn((text: string) => ({ width: text.length * 8 })),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    closePath: vi.fn(),
    clip: vi.fn(),
    shadowBlurValues,
    get strokeCount() {
      return strokeCount;
    },
    set shadowBlur(value: number) {
      shadowBlurValues.push(value);
    },
    get shadowBlur() {
      return shadowBlurValues.at(-1) ?? 0;
    },
  } as unknown as Partial<CanvasRenderingContext2D> & {
    shadowBlurValues: number[];
    strokeCount: number;
  };

  return context as CanvasRenderingContext2D & {
    readonly shadowBlurValues: number[];
    readonly strokeCount: number;
  };
}

function createGradientStub(): CanvasGradient {
  return {
    addColorStop: vi.fn(),
  } as unknown as CanvasGradient;
}
