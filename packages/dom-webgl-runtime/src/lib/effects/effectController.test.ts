import { describe, expect, test, vi } from "vitest";

import { createWebGLEffectController } from "./effectController";
import type { WebGLEffectTarget } from "./effectTarget";
import { normalizeWebGLEffectsDeclaration } from "./effectNormalization";

import type { WebGLSourceDescriptor } from "../source/sourceDescriptor";
import type { WebGLFrameInput } from "../types";

describe("normalizeWebGLEffectsDeclaration", () => {
  test("defaults solid material and pointer tilt values", () => {
    expect(
      normalizeWebGLEffectsDeclaration({
        material: { kind: "solid" },
        motion: { kind: "pointer-tilt" },
      }),
    ).toEqual({
      material: { kind: "solid", color: 0xffffff, opacity: 1 },
      motion: { kind: "pointer-tilt", strength: 1, maxDegrees: 8 },
    });
  });

  test("clamps numeric effect values", () => {
    expect(
      normalizeWebGLEffectsDeclaration({
        material: { kind: "solid", color: 0x1ffffff, opacity: 2 },
        motion: { kind: "pointer-tilt", strength: -1, maxDegrees: 90 },
      }),
    ).toEqual({
      material: { kind: "solid", color: 0xffffff, opacity: 1 },
      motion: { kind: "pointer-tilt", strength: 0, maxDegrees: 30 },
    });
  });
});

describe("createWebGLEffectController", () => {
  test("applies solid material to element snapshot effect targets", () => {
    const target = createEffectTarget();
    const controller = createWebGLEffectController({
      key: "hero.surface",
      declaration: {
        material: { kind: "solid", color: 0x111827, opacity: 0.82 },
      },
      source: createElementSnapshotSource(),
      target,
    });

    controller.update(createFrameInput(), createLayoutSnapshot());

    expect(target.applySolidMaterial).toHaveBeenCalledWith({
      color: 0x111827,
      opacity: 0.82,
    });
  });

  test("rejects solid material on non-element sources", () => {
    expect(() =>
      createWebGLEffectController({
        key: "hero.image",
        declaration: {
          material: { kind: "solid", color: 0x111827 },
        },
        source: createImageSource(),
        target: createEffectTarget(),
      }),
    ).toThrow(
      'WebGL target "hero.image" uses solid material on unsupported source "image". Solid material effects support only snapshot/element targets.',
    );
  });

  test("updates pointer tilt from shared frame input and resets outside target", () => {
    const target = createEffectTarget();
    const controller = createWebGLEffectController({
      key: "hero.surface",
      declaration: {
        motion: { kind: "pointer-tilt", strength: 0.5, maxDegrees: 10 },
      },
      source: createElementSnapshotSource(),
      target,
    });

    controller.update(
      createFrameInput({
        isInside: true,
        normalizedX: 1,
        normalizedY: -0.5,
      }),
      createLayoutSnapshot(),
    );
    controller.update(
      createFrameInput({
        isInside: false,
        normalizedX: 1,
        normalizedY: 1,
      }),
      createLayoutSnapshot(),
    );

    expect(target.setRotation).toHaveBeenNthCalledWith(
      1,
      expect.closeTo(-0.0436332313),
      expect.closeTo(0.0872664626),
    );
    expect(target.setRotation).toHaveBeenNthCalledWith(2, 0, 0);
  });

  test("disposes the effect target", () => {
    const target = createEffectTarget();
    const controller = createWebGLEffectController({
      key: "hero.surface",
      declaration: {
        motion: { kind: "pointer-tilt" },
      },
      source: createElementSnapshotSource(),
      target,
    });

    controller.dispose();
    controller.dispose();

    expect(target.disposeEffects).toHaveBeenCalledTimes(1);
  });
});

function createEffectTarget(): WebGLEffectTarget & {
  applySolidMaterial: ReturnType<typeof vi.fn>;
  setRotation: ReturnType<typeof vi.fn>;
  disposeEffects: ReturnType<typeof vi.fn>;
} {
  return {
    applySolidMaterial: vi.fn(),
    setRotation: vi.fn(),
    disposeEffects: vi.fn(),
  };
}

function createElementSnapshotSource(): WebGLSourceDescriptor {
  return {
    kind: "snapshot",
    mode: "element",
    element: document.createElement("section"),
  };
}

function createImageSource(): WebGLSourceDescriptor {
  const element = document.createElement("img");

  return {
    kind: "image",
    element,
    src: "/hero.png",
  };
}

function createFrameInput(
  pointer: Partial<WebGLFrameInput["pointer"]> = {},
): WebGLFrameInput {
  return {
    time: 100,
    delta: 16,
    scroll: {
      mode: "page",
      pageProgress: 0,
      direction: 0,
      velocity: 0,
    },
    pointer: {
      x: 0,
      y: 0,
      normalizedX: 0,
      normalizedY: 0,
      isInside: false,
      isDown: false,
      downTime: 0,
      pressDuration: 0,
      isDragging: false,
      dragStartX: 0,
      dragStartY: 0,
      dragDeltaX: 0,
      dragDeltaY: 0,
      clickCount: 0,
      ...pointer,
    },
  };
}

function createLayoutSnapshot() {
  return {
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: 200,
    bottom: 100,
    width: 200,
    height: 100,
    viewport: { width: 800, height: 600 },
    devicePixelRatio: 1,
    layoutSignature: JSON.stringify([0, 0, 200, 100, 800, 600, 1]),
  };
}
