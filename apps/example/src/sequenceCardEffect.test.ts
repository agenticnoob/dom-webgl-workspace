import { describe, expect, test, vi } from "vitest";

import { createEffectContext } from "../test/effectContext";

import { exampleSequenceCardEffect } from "./sequenceCardEffect";

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

    exampleSequenceCardEffect.update(context, undefined, {
      kind: "example.sequenceCard",
      progressKey: "example.video.scrub",
      travel: 280,
      minOpacity: 0.18,
      maxOpacity: 0.82,
    });

    expect(exampleSequenceCardEffect.source).toBe("dom/element");
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

    exampleSequenceCardEffect.update(context, undefined, {
      kind: "example.sequenceCard",
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

    exampleSequenceCardEffect.update(context, undefined, {
      kind: "example.sequenceCard",
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
    copy.textContent = "父级是图片序列，卡片是它的 DOM child 和 WebGL 子层。";
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

    exampleSequenceCardEffect.update(context, undefined, {
      kind: "example.sequenceCard",
      progressKey: "example.video.scrub",
    });

    expect(draw).toHaveBeenCalledTimes(1);
    expect(setVisible).toHaveBeenCalledWith(true);
    expect(setOpacity).toHaveBeenCalledWith(1);
  });
});
