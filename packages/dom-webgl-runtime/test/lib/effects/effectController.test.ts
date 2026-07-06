import { describe, expect, test, vi } from "vitest";

import { defineWebGLEffect } from "../../../src/lib/effects/effectAuthoring";
import { createWebGLEffectController } from "../../../src/lib/effects/effectController";
import { createWebGLEffectRegistry } from "../../../src/lib/effects/effectRegistry";
import type { WebGLEffectTarget } from "../../../src/lib/effects/effectTarget";
import type { ElementLayoutSnapshot } from "../../../src/lib/renderer/layoutPass";

import type { WebGLSourceDescriptor } from "../../../src/lib/source/sourceDescriptor";
import type { WebGLFrameInput, WebGLProgressSignalSource } from "../../../src/lib/types";

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
            source: "dom/element",
            update() {
              return;
            },
          }),
        ]),
      }),
    ).toThrow(
      'WebGL effect "custom.elementOnly" cannot be used with source "media/image" on target "hero.image".',
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
          source: "dom/element",
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
      sourceKind: "dom/element",
      object: expect.objectContaining({
        sourceKind: "dom/element",
      }),
    });
  });

  test("reports static reactive and frame scheduling needs", () => {
    const registry = createWebGLEffectRegistry([
      defineWebGLEffect({ kind: "test.static", schedule: "static", update() {} }),
      defineWebGLEffect({
        kind: "test.reactive",
        schedule: "reactive",
        update() {},
      }),
      defineWebGLEffect({ kind: "test.frame", schedule: "frame", update() {} }),
    ]);

    expect(
      createWebGLEffectController({
        key: "static",
        declaration: [{ kind: "test.static" }],
        source: createElementSnapshotSource(),
        registry,
      }).schedulingMode,
    ).toBe("static");
    expect(
      createWebGLEffectController({
        key: "reactive",
        declaration: [{ kind: "test.reactive" }],
        source: createElementSnapshotSource(),
        registry,
      }).schedulingMode,
    ).toBe("reactive");
    expect(
      createWebGLEffectController({
        key: "frame",
        declaration: [{ kind: "test.frame" }],
        source: createElementSnapshotSource(),
        registry,
      }).schedulingMode,
    ).toBe("frame");
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

  test("passes frame, layout, object, and resources to user effects", () => {
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
            ctx.object.visible = true;
            ctx.object.rotation.set(0, ctx.pointer.normalizedX, 0);
            update(ctx);
          },
        }),
      ]),
    });
    const input = createFrameInput({
      x: 140,
      y: 90,
      normalizedX: 0.5,
      isInside: true,
      isDown: true,
      downTime: 50,
    });
    const layout = createLayoutSnapshot({
      left: 100,
      top: 50,
      width: 200,
      height: 100,
    });

    controller.update(input, layout);

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        key: "custom.surface",
        sourceKind: "dom/element",
        input,
        layout,
        pointer: input.pointer,
        targetPointer: expect.objectContaining({
          localX: 40,
          localY: 40,
          normalizedX: -0.6,
          normalizedY: 0.2,
          isInside: true,
          isPressed: true,
          pressDuration: 50,
        }),
        scroll: input.scroll,
        scrollProgress: 0,
        time: 100,
        delta: 16,
        object: expect.objectContaining({
          sourceKind: "dom/element",
          rotation: expect.objectContaining({
            set: expect.any(Function),
          }),
        }),
        resources: expect.objectContaining({
          addDisposable: expect.any(Function),
        }),
      }),
    );
    expect(update.mock.calls[0]?.[0].progress.get("missing")).toBe(0);
  });

  test("reads keyed progress signals across reusable effect context updates", () => {
    type ProgressEffectDeclaration = {
      kind: "custom.progressDriven";
      progressKey: string;
    };
    const declaration = {
      kind: "custom.progressDriven",
      progressKey: "section.reveal",
    } satisfies ProgressEffectDeclaration;
    let progressValue = 0.25;
    const progressSignals = {
      get(key) {
        return key === "section.reveal" ? progressValue : 0;
      },
    } satisfies WebGLProgressSignalSource;
    const setupProgress: number[] = [];
    const updateProgress: number[] = [];
    const missingProgress: number[] = [];
    const updateParams: ProgressEffectDeclaration[] = [];
    let disposeProgress = 0;
    const controller = createWebGLEffectController({
      key: "custom.progress",
      declaration: [declaration],
      source: createElementSnapshotSource(),
      getSource: () => createElementEffectSource(),
      target: createEffectTarget(),
      progressSignals,
      registry: createWebGLEffectRegistry([
        defineWebGLEffect({
          kind: "custom.progressDriven",
          source: "dom/element",
          setup(ctx) {
            setupProgress.push(ctx.progress.get("section.reveal"));
          },
          update(ctx, _state, params: ProgressEffectDeclaration) {
            updateParams.push(params);
            updateProgress.push(ctx.progress.get(params.progressKey));
            missingProgress.push(ctx.progress.get("missing"));
          },
          dispose(ctx) {
            disposeProgress = ctx.progress.get("section.reveal");
          },
        }),
      ]),
    });

    controller.update(createFrameInput(), createLayoutSnapshot());
    progressValue = 0.75;
    controller.update(createFrameInput(), createLayoutSnapshot());
    controller.dispose();

    expect(setupProgress).toEqual([0.25]);
    expect(updateProgress).toEqual([0.25, 0.75]);
    expect(missingProgress).toEqual([0, 0]);
    expect(updateParams).toEqual([declaration, declaration]);
    expect(disposeProgress).toBe(0.75);
  });

  test("refreshes managed runtime and scene scopes across reusable context updates", () => {
    let progressValue = 0.25;
    const progressSignals = {
      get(key) {
        return key === "hero.3d" ? progressValue : 0;
      },
    } satisfies WebGLProgressSignalSource;
    const scopeSnapshots: Array<{
      runtimeProgress: number;
      sceneId: string | undefined;
      projection: string | undefined;
      timelineProgress: number | undefined;
      timelineActive: boolean | undefined;
    }> = [];
    const controller = createWebGLEffectController({
      key: "custom.scoped",
      declaration: [{ kind: "custom.scopeReader" }],
      source: createElementSnapshotSource(),
      getSource: () => createElementEffectSource(),
      target: createEffectTarget(),
      progressSignals,
      readScopes() {
        return {
          runtime: { progress: progressSignals },
          scene: {
            id: "world",
            projection: "perspective-stage",
            timeline: {
              id: "hero.3d",
              progressKey: "hero.3d",
              progress: progressSignals.get("hero.3d"),
              active: progressValue >= 0.2 && progressValue <= 0.8,
            },
          },
        };
      },
      registry: createWebGLEffectRegistry([
        defineWebGLEffect({
          kind: "custom.scopeReader",
          update(ctx) {
            scopeSnapshots.push({
              runtimeProgress: ctx.runtime.progress.get("hero.3d"),
              sceneId: ctx.scene?.id,
              projection: ctx.scene?.projection,
              timelineProgress: ctx.scene?.timeline?.progress,
              timelineActive: ctx.scene?.timeline?.active,
            });
          },
        }),
      ]),
    });

    controller.update(createFrameInput(), createLayoutSnapshot());
    progressValue = 0.9;
    controller.update(createFrameInput(), createLayoutSnapshot());

    expect(scopeSnapshots).toEqual([
      {
        runtimeProgress: 0.25,
        sceneId: "world",
        projection: "perspective-stage",
        timelineProgress: 0.25,
        timelineActive: true,
      },
      {
        runtimeProgress: 0.9,
        sceneId: "world",
        projection: "perspective-stage",
        timelineProgress: 0.9,
        timelineActive: false,
      },
    ]);
  });

  test("keeps scrollProgress mapped to page and gate scroll modes", () => {
    const scrollProgress: number[] = [];
    const controller = createWebGLEffectController({
      key: "custom.scroll",
      declaration: [{ kind: "custom.scrollReader" }],
      source: createElementSnapshotSource(),
      getSource: () => createElementEffectSource(),
      target: createEffectTarget(),
      registry: createWebGLEffectRegistry([
        defineWebGLEffect({
          kind: "custom.scrollReader",
          update(ctx) {
            scrollProgress.push(ctx.scrollProgress);
          },
        }),
      ]),
    });

    controller.update(
      createFrameInputWithScroll({
        mode: "page",
        pageProgress: 0.42,
        direction: 1,
        velocity: 0.1,
      }),
      createLayoutSnapshot(),
    );
    controller.update(
      createFrameInputWithScroll({
        mode: "gate",
        sceneProgress: 0.64,
        activeGateKey: "scene.gate",
        direction: -1,
        velocity: -0.2,
      }),
      createLayoutSnapshot(),
    );

    expect(scrollProgress).toEqual([0.42, 0.64]);
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
        type: "glb",
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

  test.each([
    [
      "dom/element",
      createElementSnapshotSource(),
      {
        kind: "dom" as const,
        type: "element" as const,
        element: document.createElement("section"),
        surface: createCanvasSurfaceHandle(),
      },
    ],
    [
      "dom/text",
      {
        kind: "dom" as const,
        type: "text" as const,
        element: document.createElement("p"),
      },
      {
        kind: "dom" as const,
        type: "text" as const,
        element: document.createElement("p"),
        text: "Hello",
        textLayer: createTextLayerHandle(),
      },
    ],
    [
      "media/image",
      createImageSource(),
      {
        kind: "media" as const,
        type: "image" as const,
        element: document.createElement("section"),
        src: "/hero.png",
        image: createTextureLayerHandle(document.createElement("img")),
      },
    ],
    [
      "media/video",
      {
        kind: "media" as const,
        type: "video" as const,
        anchor: document.createElement("section"),
        element: document.createElement("video"),
        src: "/intro.mp4",
      },
      {
        kind: "media" as const,
        type: "video" as const,
        element: document.createElement("section"),
        src: "/intro.mp4",
        video: createVideoLayerHandle(document.createElement("video")),
      },
    ],
    [
      "model/glb",
      {
        kind: "model" as const,
        type: "glb" as const,
        anchor: document.createElement("div"),
        src: "/model.glb",
      },
      createModelEffectSource(),
    ],
  ])("passes dynamic %s object capabilities to effects", (kind, source, handle) => {
    const update = vi.fn();
    const controller = createWebGLEffectController({
      key: "custom.source",
      declaration: [{ kind: "custom.inspect" }],
      source,
      getSource: () => handle,
      target: createEffectTarget(),
      registry: createWebGLEffectRegistry([
        defineWebGLEffect({
          kind: "custom.inspect",
          update,
        }),
      ]),
    });

    controller.update(createFrameInput(), createLayoutSnapshot());

    const context = update.mock.calls[0]?.[0];
    expect(context.object.sourceKind).toBe(kind);
    switch (kind) {
      case "dom/element":
        expect(context.object.surface).toBeDefined();
        break;
      case "dom/text":
        expect(context.object.text).toBeDefined();
        break;
      case "media/image":
      case "media/image-sequence":
        expect(context.object.texture).toBeDefined();
        break;
      case "media/video":
        expect(context.object.texture).toBeDefined();
        expect(context.object.video).toBeDefined();
        break;
      case "model/glb":
        expect(context.object.model?.src).toBe("/product.glb");
        break;
    }
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
  setPosition: ReturnType<typeof vi.fn>;
  setRotation: ReturnType<typeof vi.fn>;
  setVisible: ReturnType<typeof vi.fn>;
  setScale: ReturnType<typeof vi.fn>;
  setOpacity: ReturnType<typeof vi.fn>;
  disposeEffects: ReturnType<typeof vi.fn>;
} {
  return {
    setVisible: vi.fn(),
    setPosition: vi.fn(),
    setRotation: vi.fn(),
    setScale: vi.fn(),
    setOpacity: vi.fn(),
    disposeEffects: vi.fn(),
  };
}

function createElementEffectSource() {
  return {
    kind: "dom" as const,
    type: "element" as const,
    element: document.createElement("section"),
  };
}

function createModelEffectSource() {
  return {
    kind: "model" as const,
    type: "glb" as const,
    anchor: document.createElement("div"),
    src: "/product.glb",
    model: {
      object3D: {},
      traverseMeshes() {
        return;
      },
      getMeshes() {
        return [];
      },
      forEachMesh() {
        return;
      },
      sampleVertices() {
        return new Float32Array();
      },
      createPointCloud() {
        return {};
      },
      createPointLayer() {
        return {
          setVisible() {
            return;
          },
          remove() {
            return;
          },
          dispose() {
            return;
          },
        };
      },
    },
  };
}

function createCanvasSurfaceHandle() {
  return {
    object3D: {},
    canvas: document.createElement("canvas"),
    context: null,
    texture: {},
    mesh: {},
    material: {},
    shaderInputs: {
      size: { width: 1, height: 1, devicePixelRatio: 1 },
      contentBox: { x: 0, y: 0, width: 1, height: 1 },
      sourceTexture: {
        available: false,
        uniform: "source-texture" as const,
        width: 1,
        height: 1,
        devicePixelRatio: 1,
      },
    },
    createMaterialLayer() {
      return {
        setProgram() {
          return;
        },
        setUniforms() {
          return;
        },
        clear() {
          return;
        },
        dispose() {
          return;
        },
      };
    },
    clear() {
      return;
    },
    draw() {
      return;
    },
    invalidate() {
      return;
    },
    getSize() {
      return { width: 1, height: 1, devicePixelRatio: 1 };
    },
  };
}

function createTextLayerHandle() {
  return {
    ...createCanvasSurfaceHandle(),
    text: "Hello",
    style: {
      font: "16px sans-serif",
      lineHeight: 20,
      letterSpacing: 0,
      wordSpacing: 0,
      textAlign: "left" as const,
      color: "#000000",
    },
    shaderInputs: {
      size: { width: 1, height: 1, devicePixelRatio: 1 },
      contentBox: { x: 0, y: 0, width: 1, height: 1 },
      sourceTexture: {
        available: false,
        uniform: "source-texture" as const,
        width: 1,
        height: 1,
        devicePixelRatio: 1,
      },
      text: "Hello",
      style: {
        font: "16px sans-serif",
        lineHeight: 20,
        letterSpacing: 0,
        wordSpacing: 0,
        textAlign: "left" as const,
        color: "#000000",
      },
      glyphs: [],
    },
    getGlyphs() {
      return [];
    },
    setText() {
      return;
    },
    setGlyphs() {
      return;
    },
  };
}

function createTextureLayerHandle<TSource extends HTMLImageElement | HTMLVideoElement>(
  source: TSource,
) {
  return {
    object3D: {},
    source,
    texture: {},
    mesh: {},
    material: {},
    shaderInputs: {
      naturalSize: { width: 1, height: 1 },
      contentBox: { x: 0, y: 0, width: 1, height: 1 },
      uvTransform: { repeatX: 1, repeatY: 1, offsetX: 0, offsetY: 0 },
      objectFit: "fill",
      objectPosition: "50% 50%",
      sourceTexture: {
        available: false,
        uniform: "source-texture" as const,
        width: 1,
        height: 1,
      },
    },
    createMaterialLayer() {
      return {
        setProgram() {
          return;
        },
        setUniforms() {
          return;
        },
        clear() {
          return;
        },
        dispose() {
          return;
        },
      };
    },
    setTextureTransform() {
      return;
    },
    invalidate() {
      return;
    },
  };
}

function createVideoLayerHandle(source: HTMLVideoElement) {
  return {
    ...createTextureLayerHandle(source),
    source,
    play() {
      return;
    },
    pause() {
      return;
    },
    setMuted() {
      return;
    },
    setPlaybackRate() {
      return;
    },
  };
}

function createElementSnapshotSource(): WebGLSourceDescriptor {
  return {
    kind: "dom",
    type: "element",
    element: document.createElement("section"),
  };
}

function createImageSource(): WebGLSourceDescriptor {
  const element = document.createElement("img");

  return {
    kind: "media",
    type: "image",
    anchor: element,
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
      buttons: [],
      modifiers: { shift: false, alt: false, ctrl: false, meta: false },
      ...pointer,
    },
  };
}

function createFrameInputWithScroll(
  scroll: WebGLFrameInput["scroll"],
): WebGLFrameInput {
  return {
    ...createFrameInput(),
    scroll,
  };
}

function createLayoutSnapshot(
  rect: Partial<Pick<ElementLayoutSnapshot, "left" | "top" | "width" | "height">> = {},
): ElementLayoutSnapshot {
  const left = rect.left ?? 0;
  const top = rect.top ?? 0;
  const width = rect.width ?? 100;
  const height = rect.height ?? 100;

  return {
    x: left,
    y: top,
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height,
    viewport: { width: 800, height: 600 },
    devicePixelRatio: 1,
    layoutSignature: JSON.stringify([left, top, width, height, 800, 600, 1]),
  };
}
