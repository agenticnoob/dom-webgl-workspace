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
    expect(target.setPosition).toHaveBeenCalledWith(0, 0, 0);
  });

  test("keeps the card half transparent while it waits off the left edge", () => {
    const target = {
      setOpacity: vi.fn(),
      setPosition: vi.fn(),
      setVisible: vi.fn(),
    };
    const context = createEffectContext({
      progress: { get: () => 0 },
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
    expect(target.setPosition).toHaveBeenCalledWith(-280, 0, 0);
  });
});
