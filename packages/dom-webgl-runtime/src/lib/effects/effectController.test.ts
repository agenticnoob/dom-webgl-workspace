import { describe, expect, test, vi } from "vitest";

import { defineWebGLEffect } from "./effectAuthoring";
import { createWebGLEffectController } from "./effectController";
import { createWebGLEffectRegistry } from "./effectRegistry";
import type { WebGLEffectTarget } from "./effectTarget";

import type { WebGLSourceDescriptor } from "../source/sourceDescriptor";
import type { WebGLFrameInput } from "../types";

describe("createWebGLEffectController", () => {
  test("does not register preset effects by default", () => {
    expect(() =>
      createWebGLEffectController({
        key: "hero",
        declaration: [{ kind: "surface.basic" }],
        source: createElementSnapshotSource(),
        target: createEffectTarget(),
      }),
    ).toThrow(
      'WebGL target "hero" references unknown effect "surface.basic". Register it through createWebGLRuntime({ effects: [...] }).',
    );
  });

  test("rejects effects registered for a different source kind", () => {
    expect(() =>
      createWebGLEffectController({
        key: "hero.image",
        declaration: [{ kind: "custom.elementOnly" }],
        source: createImageSource(),
        target: createEffectTarget(),
        registry: createWebGLEffectRegistry([
          defineWebGLEffect({
            kind: "custom.elementOnly",
            source: "snapshot/element",
            update() {
              return;
            },
          }),
        ]),
      }),
    ).toThrow(
      'WebGL effect "custom.elementOnly" cannot be used with source "image" on target "hero.image".',
    );
  });

  test("runs setup once, update every frame, and dispose once", () => {
    const setup = vi.fn(() => ({ count: 0 }));
    const update = vi.fn((_context, state: { count: number }) => {
      state.count += 1;
    });
    const dispose = vi.fn();
    const target = createEffectTarget();
    const controller = createWebGLEffectController({
      key: "hero",
      declaration: [{ kind: "custom.counter" }],
      source: createElementSnapshotSource(),
      getSource: () => createElementEffectSource(),
      target,
      registry: createWebGLEffectRegistry([
        defineWebGLEffect({
          kind: "custom.counter",
          source: "snapshot/element",
          setup,
          update,
          dispose,
        }),
      ]),
    });

    controller.update(createFrameInput(), createLayoutSnapshot());
    controller.update(createFrameInput(), createLayoutSnapshot());
    controller.dispose();
    controller.dispose();

    expect(setup).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledTimes(2);
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(dispose.mock.calls[0]?.[0]).toMatchObject({
      key: "hero",
      sourceKind: "snapshot/element",
      source: { kind: "snapshot/element" },
      target,
    });
  });

  test("reports unknown effect kinds as configuration errors", () => {
    expect(() =>
      createWebGLEffectController({
        key: "hero",
        declaration: [{ kind: "missing.effect" }],
        source: createElementSnapshotSource(),
        target: createEffectTarget(),
      }),
    ).toThrow(
      'WebGL target "hero" references unknown effect "missing.effect". Register it through createWebGLRuntime({ effects: [...] }).',
    );
  });

  test("passes frame, layout, source, target, and resources to user effects", () => {
    const update = vi.fn();
    const source = createElementEffectSource();
    const controller = createWebGLEffectController({
      key: "custom.surface",
      declaration: [{ kind: "custom.visibleTilt" }],
      source: createElementSnapshotSource(),
      getSource: () => source,
      target: createEffectTarget(),
      registry: createWebGLEffectRegistry([
        defineWebGLEffect({
          kind: "custom.visibleTilt",
          update(ctx) {
            ctx.target?.setVisible(true);
            ctx.target?.setRotation(0, ctx.pointer.normalizedX);
            update(ctx);
          },
        }),
      ]),
    });
    const input = createFrameInput({ normalizedX: 0.5 });
    const layout = createLayoutSnapshot();

    controller.update(input, layout);

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        key: "custom.surface",
        sourceKind: "snapshot/element",
        input,
        layout,
        pointer: input.pointer,
        scroll: input.scroll,
        scrollProgress: 0,
        time: 100,
        delta: 16,
        source,
        resources: expect.objectContaining({
          addDisposable: expect.any(Function),
        }),
      }),
    );
  });

  test("skips setup and update until the source handle is ready", () => {
    const setup = vi.fn();
    const update = vi.fn();
    let source = undefined as ReturnType<typeof createModelEffectSource> | undefined;
    const controller = createWebGLEffectController({
      key: "async.model",
      declaration: [{ kind: "custom.model" }],
      source: {
        kind: "model",
        format: "glb",
        src: "/product.glb",
        anchor: document.createElement("div"),
      },
      getSource: () => source,
      target: createEffectTarget(),
      registry: createWebGLEffectRegistry([
        defineWebGLEffect({
          kind: "custom.model",
          source: "model/glb",
          setup,
          update,
        }),
      ]),
    });

    controller.update(createFrameInput(), createLayoutSnapshot());
    source = createModelEffectSource();
    controller.update(createFrameInput(), createLayoutSnapshot());

    expect(setup).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledTimes(1);
  });

  test("disposes the effect target", () => {
    const target = createEffectTarget();
    const controller = createWebGLEffectController({
      key: "hero.surface",
      declaration: undefined,
      source: createElementSnapshotSource(),
      target,
    });

    controller.dispose();
    controller.dispose();

    expect(target.disposeEffects).toHaveBeenCalledTimes(1);
  });
});

function createEffectTarget(): WebGLEffectTarget & {
  setRotation: ReturnType<typeof vi.fn>;
  setVisible: ReturnType<typeof vi.fn>;
  setScale: ReturnType<typeof vi.fn>;
  setOpacity: ReturnType<typeof vi.fn>;
  disposeEffects: ReturnType<typeof vi.fn>;
} {
  return {
    setVisible: vi.fn(),
    setRotation: vi.fn(),
    setScale: vi.fn(),
    setOpacity: vi.fn(),
    disposeEffects: vi.fn(),
  };
}

function createElementEffectSource() {
  return {
    kind: "snapshot/element" as const,
    element: document.createElement("section"),
  };
}

function createModelEffectSource() {
  return {
    kind: "model/glb" as const,
    anchor: document.createElement("div"),
    src: "/product.glb",
    model: {
      object3D: {},
      traverseMeshes() {
        return;
      },
      sampleVertices() {
        return new Float32Array();
      },
      createPointCloud() {
        return {};
      },
    },
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
