import { describe, expect, test, vi } from "vitest";

import { createEffectContext, createGlyph } from "./effectContext";
import { examplePinnedRevealEffect } from "../src/pinnedScrollEffect";

describe("pinned scroll reveal effect", () => {
  test("maps keyed adapter progress to high-contrast glyph reveal", () => {
    const progressGet = vi.fn((key: string) => (key === "example.pinned.reveal" ? 0.75 : 0));
    const textLayer = {
      setGlyphs: vi.fn(),
    };
    const context = createEffectContext({
      source: {
        kind: "dom",
          type: "text",
        element: document.createElement("p"),
        text: "Pinned",
        textLayer,
      },
      progress: {
        get: progressGet,
      },
      scrollProgress: 0,
    });

    examplePinnedRevealEffect.update(context, undefined, {
      kind: "example.pinnedReveal",
      color: "#172124",
      progressKey: "example.pinned.reveal",
    });

    expect(examplePinnedRevealEffect.source).toBe("dom/text");
    expect(progressGet).toHaveBeenCalledWith("example.pinned.reveal");
    const transform = textLayer.setGlyphs.mock.calls[0]?.[0];
    const commands = transform?.([
      createGlyph(0, "P"),
      createGlyph(1, "i"),
      createGlyph(2, "n"),
      createGlyph(3, "n"),
    ]);
    expect(commands?.[0]).toMatchObject({ index: 0, opacity: 1, color: "#172124" });
    expect(commands?.[3]).toMatchObject({ index: 3, opacity: 0.32, scaleX: 0.78 });
  });
});
