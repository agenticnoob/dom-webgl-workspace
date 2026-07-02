import { describe, expect, test, vi } from "vitest";

import type { WebGLEffectContext } from "@project/dom-webgl-runtime";

import { createEffectContext } from "./effectContext";
import {
  exampleModelFloatGlowEffect,
  exampleModelFloatEffect,
  exampleModelSpinEffect,
} from "../src/modelEffects";

describe("model example effects", () => {
  test("model spin uses the object facade and model source kind", () => {
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

  test("model float glow uses managed material lights and postprocess", () => {
    const material: NonNullable<WebGLEffectContext["object"]["material"]> = {
      color: { set: vi.fn() },
      emissive: { set: vi.fn() },
      opacity: 1,
      metalness: 0,
      roughness: 1,
      createLayer: vi.fn(() => ({
        clear: vi.fn(),
        dispose: vi.fn(),
        setProgram: vi.fn(),
        setUniforms: vi.fn(),
      })),
      restore: vi.fn(),
    };
    const lightHandle = {
      dispose: vi.fn(),
      remove: vi.fn(),
      setVisible: vi.fn(),
    };
    const lights: NonNullable<WebGLEffectContext["object"]["lights"]> = {
      ambient: vi.fn(() => lightHandle),
      directional: vi.fn(() => lightHandle),
      point: vi.fn(() => lightHandle),
      remove: vi.fn(),
    };
    const bloom = {
      update: vi.fn(),
      dispose: vi.fn(),
    };
    const postprocess = {
      request: vi.fn(() => bloom),
    };
    const target = {
      setPosition: vi.fn(),
      setRotation: vi.fn(),
      setScale: vi.fn(),
      setVisible: vi.fn(),
    };
    const baseContext = createEffectContext({
      key: "example.model.float-glow",
      source: {
        kind: "model",
        type: "glb",
        anchor: document.createElement("section"),
        src: "/models/4.glb",
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
      time: 1200,
      layout: {
        left: 20,
        top: 30,
        width: 160,
        height: 80,
      },
    });
    const context = {
      ...baseContext,
      object: {
        ...baseContext.object,
        material,
        lights,
        postprocess,
      },
    } satisfies WebGLEffectContext;

    exampleModelFloatGlowEffect.setup?.(context, {
      kind: "example.modelFloatGlow",
      emissive: "#7dd3fc",
      lightIntensity: 2.2,
    });
    exampleModelFloatGlowEffect.update(context, undefined, {
      kind: "example.modelFloatGlow",
      amplitude: 30,
      speed: 0.46,
    });

    expect(material.emissive.set).toHaveBeenCalledWith("#7dd3fc", 1.4);
    expect(lights.point).toHaveBeenCalledWith("example.model.float-glow.glow", {
      color: "#7dd3fc",
      intensity: 2.2,
      distance: 460,
      follow: "object",
    });
    expect(postprocess.request).toHaveBeenCalledWith({
      key: "example.model.float-glow.bloom",
      bloom: { strength: 0.42, radius: 0.24, threshold: 0.62 },
    });
    expect(baseContext.resources.addDisposable).toHaveBeenCalledTimes(2);
    expect(target.setPosition).toHaveBeenCalledWith(100, expect.any(Number), 0);
    expect(target.setRotation).toHaveBeenCalledWith(
      expect.any(Number),
      expect.any(Number),
      0,
    );
    expect(target.setScale).toHaveBeenCalledWith(
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
    );
  });
});
