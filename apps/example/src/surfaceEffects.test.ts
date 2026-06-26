import { describe, expect, test, vi } from "vitest";

import { createEffectContext } from "../test/effectContext";
import {
  exampleSurfaceFillEffect,
  exampleSurfacePulseEffect,
} from "./surfaceEffects";

describe("surface example effects", () => {
  test("surface fill draws once for element snapshots and no-ops for unsupported sources", () => {
    const surface = {
      draw: vi.fn(),
      setOpacity: vi.fn(),
      setVisible: vi.fn(),
    };
    const target = {
      setOpacity: vi.fn(),
      setVisible: vi.fn(),
    };
    const context = createEffectContext({
      source: {
        kind: "snapshot/element",
        element: document.createElement("section"),
        surface,
      },
      target,
    });

    const state = exampleSurfaceFillEffect.setup?.(context, {
      kind: "example.surfaceFill",
      imageSrc: "/example/bg.png",
      opacity: 0.72,
    });
    if (!state) {
      throw new Error("Expected example.surfaceFill setup state");
    }
    exampleSurfaceFillEffect.update(context, state, {
      kind: "example.surfaceFill",
      imageSrc: "/example/bg.png",
      opacity: 0.72,
    });
    exampleSurfaceFillEffect.update(
      createEffectContext({
        source: {
          kind: "snapshot/text",
          element: document.createElement("p"),
          text: "Wrong source",
        },
      }),
      state,
      { kind: "example.surfaceFill", imageSrc: "/example/bg.png", opacity: 1 },
    );

    expect(exampleSurfaceFillEffect.source).toBe("snapshot/element");
    expect(surface.draw).toHaveBeenCalledTimes(1);
    expect(surface.setVisible).toHaveBeenCalledWith(true);
    expect(surface.setOpacity).toHaveBeenCalledWith(0.72);
    expect(target.setVisible).toHaveBeenCalledWith(true);
    expect(target.setOpacity).not.toHaveBeenCalled();
  });

  test("surface pulse visibly animates surface opacity for element snapshots", () => {
    const surface = {
      draw: vi.fn(),
      setOpacity: vi.fn(),
      setVisible: vi.fn(),
    };
    const target = {
      setOpacity: vi.fn(),
      setScale: vi.fn(),
      setVisible: vi.fn(),
    };
    const layout = {
      key: "example.test",
      left: 0,
      top: 0,
      width: 120,
      height: 60,
      viewport: { width: 1024, height: 768 },
    };
    const context = createEffectContext({
      source: {
        kind: "snapshot/element",
        element: document.createElement("section"),
        surface,
      },
      layout,
      target,
      time: 520,
    });

    exampleSurfacePulseEffect.update(context, undefined, {
      kind: "example.surfacePulse",
      scale: 1.2,
      opacity: 0.76,
    });
    exampleSurfacePulseEffect.update(
      createEffectContext({
        source: {
          kind: "snapshot/element",
          element: document.createElement("section"),
          surface,
        },
        target,
        time: 1040,
      }),
      undefined,
      {
        kind: "example.surfacePulse",
        scale: 1.2,
        opacity: 0.76,
      },
    );

    expect(exampleSurfacePulseEffect.source).toBe("snapshot/element");
    expect(target.setVisible).toHaveBeenCalledWith(true);
    expect(target.setScale).not.toHaveBeenCalled();
    expect(target.setOpacity).not.toHaveBeenCalled();
    expect(surface.setVisible).toHaveBeenCalledWith(true);
    expect(surface.draw).toHaveBeenCalledTimes(2);
    expect(surface.setOpacity).toHaveBeenCalledTimes(2);
    expect(surface.setOpacity).toHaveBeenCalledWith(1);
  });
});
