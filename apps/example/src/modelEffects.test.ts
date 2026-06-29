import { describe, expect, test, vi } from "vitest";

import { createEffectContext } from "../test/effectContext";
import {
  exampleModelFloatEffect,
  exampleModelSpinEffect,
} from "./modelEffects";

describe("model example effects", () => {
  test("model spin uses the public target handle and model source kind", () => {
    const target = {
      setRotation: vi.fn(),
      setVisible: vi.fn(),
    };
    const context = createEffectContext({
      source: {
        kind: "model",
          type: "glb",
        anchor: document.createElement("section"),
        src: "/models/hero.glb",
        model: {
          getMeshes: vi.fn(() => []),
          forEachMesh: vi.fn(),
          sampleVertices: vi.fn(),
          createPointLayer: vi.fn(() => ({
            setVisible: vi.fn(),
            remove: vi.fn(),
            dispose: vi.fn(),
          })),
        },
      },
      target,
      time: 2000,
    });

    exampleModelSpinEffect.update(context, undefined, {
      kind: "example.modelSpin",
      speed: 0.25,
    });

    expect(exampleModelSpinEffect.source).toBe("model/glb");
    expect(target.setVisible).toHaveBeenCalledWith(true);
    expect(target.setRotation).toHaveBeenCalledWith(0, 0.5, 0);
  });

  test("model float combines layout position and runtime time", () => {
    const target = {
      setPosition: vi.fn(),
      setRotation: vi.fn(),
      setVisible: vi.fn(),
    };
    const context = createEffectContext({
      source: {
        kind: "model",
          type: "glb",
        anchor: document.createElement("section"),
        src: "/models/hero.glb",
        model: {
          getMeshes: vi.fn(() => []),
          forEachMesh: vi.fn(),
          sampleVertices: vi.fn(),
          createPointLayer: vi.fn(() => ({
            setVisible: vi.fn(),
            remove: vi.fn(),
            dispose: vi.fn(),
          })),
        },
      },
      target,
      time: 1400,
      layout: {
        left: 10,
        top: 20,
        width: 120,
        height: 60,
        viewport: { width: 1024, height: 768 },
      },
    });

    exampleModelFloatEffect.update(context, undefined, {
      kind: "example.modelFloat",
      amplitude: 24,
    });

    expect(exampleModelFloatEffect.source).toBe("model/glb");
    expect(target.setVisible).toHaveBeenCalledWith(true);
    expect(target.setPosition).toHaveBeenCalledWith(70, expect.any(Number), 0);
    expect(target.setRotation).toHaveBeenCalledWith(expect.any(Number), expect.any(Number), 0);
  });
});
