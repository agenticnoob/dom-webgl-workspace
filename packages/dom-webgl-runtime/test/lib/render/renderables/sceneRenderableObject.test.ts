import { describe, expect, test, vi } from "vitest";

import {
  createElementPlaneSceneRenderableController,
  createTextPlaneSceneRenderableController,
  createTexturePlaneSceneRenderableController,
} from "../../../../src/lib/render/renderables/sceneRenderableObject";

describe("element plane scene renderable", () => {
  test("does not make element snapshots visible from DOM visual CSS paint", () => {
    const element = document.createElement("section");

    Object.assign(element.style, {
      backgroundColor: "rgb(240, 248, 255)",
      border: "2px solid rgb(12, 34, 56)",
      borderRadius: "18px",
      boxShadow: "0px 8px 16px rgba(0, 0, 0, 0.2)",
    });

    const controller = createElementPlaneSceneRenderableController({
      key: "visual.surface",
      sceneAdapter: {
        addObject: vi.fn(),
        removeObject: vi.fn(),
        render: vi.fn(),
      },
      measureElement: () => createMeasurement(),
      getViewportSize: () => ({ width: 800, height: 600 }),
      element,
    });

    controller.updateLayout(createMeasurement());

    expect((controller.object.object3D as { visible?: boolean }).visible).toBe(
      false,
    );

    controller.controller.dispose();
  });

  test("keeps transparent layout-only element snapshots invisible", () => {
    const element = document.createElement("section");
    const controller = createElementPlaneSceneRenderableController({
      key: "layout.container",
      sceneAdapter: {
        addObject: vi.fn(),
        removeObject: vi.fn(),
        render: vi.fn(),
      },
      measureElement: () => createMeasurement(),
      getViewportSize: () => ({ width: 800, height: 600 }),
      element,
    });

    controller.updateLayout(createMeasurement());

    expect((controller.object.object3D as { visible?: boolean }).visible).toBe(
      false,
    );

    controller.controller.dispose();
  });

  test("exposes a generic effect target for user-authored effects", () => {
    const element = document.createElement("section");
    const controller = createElementPlaneSceneRenderableController({
      key: "effect.surface",
      sceneAdapter: {
        addObject: vi.fn(),
        removeObject: vi.fn(),
        render: vi.fn(),
      },
      measureElement: () => createMeasurement(),
      getViewportSize: () => ({ width: 800, height: 600 }),
      element,
    });
    const group = controller.object.object3D as {
      visible?: boolean;
      rotation?: { x?: number; y?: number };
      children?: Array<{
        material?: {
          opacity?: number;
          transparent?: boolean;
        };
      }>;
    };
    const mesh = group.children?.[0];

    controller.object.effectTarget?.setVisible(true);
    controller.object.effectTarget?.setRotation(0.1, -0.2, 0.3);
    controller.object.effectTarget?.setScale(1.2, 0.9, 1);
    controller.object.effectTarget?.setOpacity(0.42);

    expect(group.visible).toBe(true);
    expect(mesh).toBeDefined();
    if (!mesh) {
      throw new Error("Expected element plane group to contain a mesh child.");
    }
    expect(mesh.material?.transparent).toBe(true);
    expect(mesh.material?.opacity).toBe(0.42);
    expect(group.rotation?.x).toBe(0.1);
    expect(group.rotation?.y).toBe(-0.2);

    controller.controller.dispose();
  });

  test("element surface texture telemetry records effect draw invalidation", () => {
    const context = createCanvasContextStub();
    const restoreCanvas = stubCanvasContext(context);

    try {
      const controller = createElementPlaneSceneRenderableController({
        key: "effect.surface",
        sceneAdapter: createSceneAdapter(),
        measureElement: () => createMeasurement(),
        getViewportSize: () => ({ width: 800, height: 600 }),
        element: document.createElement("section"),
      });

      controller.updateLayout({ ...createMeasurement(), devicePixelRatio: 2 });
      controller.object.surfaceCapability?.draw(({ context: drawingContext }) => {
        drawingContext.clearRect(0, 0, 8, 8);
      });

      expect(controller.object.inspectTextureTelemetry).toEqual(expect.any(Function));
      expect(controller.object.inspectTextureTelemetry?.()).toEqual([
        expect.objectContaining({
          key: "effect.surface",
          width: 400,
          height: 300,
          devicePixelRatio: 2,
          sourceKind: "canvas",
          dirty: true,
          dirtyReason: "effect-draw",
        }),
      ]);

      controller.controller.dispose();
    } finally {
      restoreCanvas();
    }
  });

  test("text texture telemetry records glyph command invalidation", () => {
    const context = createCanvasContextStub();
    const restoreCanvas = stubCanvasContext(context);
    const element = document.createElement("h2");
    element.textContent = "Hi";

    try {
      const controller = createTextPlaneSceneRenderableController({
        key: "effect.text",
        sceneAdapter: createSceneAdapter(),
        measureElement: () => createMeasurement(),
        getViewportSize: () => ({ width: 800, height: 600 }),
        element,
        textContent: "Hi",
      });

      controller.updateLayout({ ...createMeasurement(), devicePixelRatio: 1.5 });
      controller.object.textLayerCapability?.setGlyphs((glyphs) =>
        glyphs.map((glyph) => ({
          index: glyph.index,
          char: "X",
        })),
      );

      expect(controller.object.inspectTextureTelemetry).toEqual(expect.any(Function));
      expect(controller.object.inspectTextureTelemetry?.()).toEqual([
        expect.objectContaining({
          key: "effect.text",
          width: 400,
          height: 300,
          devicePixelRatio: 1.5,
          sourceKind: "canvas",
          dirty: true,
          dirtyReason: "glyph-commands",
        }),
      ]);

      controller.controller.dispose();
    } finally {
      restoreCanvas();
    }
  });

  test("uses group target roots for plane-like layer renderables", () => {
    const element = createElementPlaneSceneRenderableController({
      key: "root.element",
      sceneAdapter: createSceneAdapter(),
      measureElement: () => createMeasurement(),
      getViewportSize: () => ({ width: 800, height: 600 }),
      element: document.createElement("section"),
    });
    const text = createTextPlaneSceneRenderableController({
      key: "root.text",
      sceneAdapter: createSceneAdapter(),
      measureElement: () => createMeasurement(),
      getViewportSize: () => ({ width: 800, height: 600 }),
      element: document.createElement("p"),
      textContent: "Layer text",
    });
    const image = document.createElement("img");
    Object.defineProperties(image, {
      naturalWidth: { value: 200 },
      naturalHeight: { value: 100 },
    });
    const texture = createTexturePlaneSceneRenderableController({
      key: "root.texture",
      sceneAdapter: createSceneAdapter(),
      measureElement: () => createMeasurement(),
      getViewportSize: () => ({ width: 800, height: 600 }),
      element: image,
      textureKind: "image",
      textureSource: image,
    });

    expectGroupRootWithChild(element.object.object3D);
    expectGroupRootWithChild(text.object.object3D);
    expectGroupRootWithChild(texture.object.object3D);

    element.controller.dispose();
    text.controller.dispose();
    texture.controller.dispose();
  });

  test("keeps text layer glyph overrides after text layout rerenders", () => {
    const context = createCanvasContextStub();
    const restoreCanvas = stubCanvasContext(context);
    const element = document.createElement("h2");
    element.textContent = "Hi";

    try {
      const controller = createTextPlaneSceneRenderableController({
        key: "effect.text",
        sceneAdapter: createSceneAdapter(),
        measureElement: () => createMeasurement(),
        getViewportSize: () => ({ width: 800, height: 600 }),
        element,
        textContent: "Hi",
      });

      controller.updateLayout(createMeasurement());
      expect(controller.object.textLayerCapability?.getGlyphs().length).toBeGreaterThan(0);
      controller.object.textLayerCapability?.setGlyphs((glyphs) =>
        glyphs.map((glyph) => ({
          index: glyph.index,
          char: "X",
          y: glyph.y + 12,
        })),
      );
      expect(context.fillText).toHaveBeenCalledWith("X", 0, 0);
      context.fillText.mockClear();

      controller.updateLayout({ ...createMeasurement(), width: 420, right: 452 });

      expect(context.fillText).toHaveBeenCalledWith("X", 0, 0);

      controller.controller.dispose();
    } finally {
      restoreCanvas();
    }
  });

  test("keeps image texture overrides after media layout rerenders", () => {
    const image = document.createElement("img");
    Object.defineProperties(image, {
      naturalWidth: { value: 200 },
      naturalHeight: { value: 100 },
    });

    const controller = createTexturePlaneSceneRenderableController({
      key: "effect.image",
      sceneAdapter: createSceneAdapter(),
      measureElement: () => createMeasurement(),
      getViewportSize: () => ({ width: 800, height: 600 }),
      element: image,
      textureKind: "image",
      textureSource: image,
    });

    controller.updateLayout(createMeasurement());
    controller.object.textureLayerCapability?.setTextureTransform({
      repeatX: 1.5,
      repeatY: 1.25,
      offsetX: -0.2,
      offsetY: -0.1,
    });

    const texture = readMediaTexture(controller.object.object3D);
    expect(texture.repeat.x).toBe(1.5);
    expect(texture.repeat.y).toBe(1.25);
    expect(texture.offset.x).toBe(-0.2);
    expect(texture.offset.y).toBe(-0.1);

    controller.updateLayout({ ...createMeasurement(), width: 420, right: 452 });

    expect(texture.repeat.x).toBe(1.5);
    expect(texture.repeat.y).toBe(1.25);
    expect(texture.offset.x).toBe(-0.2);
    expect(texture.offset.y).toBe(-0.1);

    controller.controller.dispose();
  });

  test("texture plane can replace an image texture source without recreating layout", () => {
    const first = document.createElement("img");
    Object.defineProperties(first, {
      naturalWidth: { value: 1600 },
      naturalHeight: { value: 900 },
    });
    const second = document.createElement("img");
    Object.defineProperties(second, {
      naturalWidth: { value: 1600 },
      naturalHeight: { value: 900 },
    });

    const controller = createTexturePlaneSceneRenderableController({
      key: "sequence.hero",
      sceneAdapter: createSceneAdapter(),
      measureElement: () => createMeasurement(),
      getViewportSize: () => ({ width: 800, height: 600 }),
      element: document.createElement("section"),
      textureKind: "image",
      textureSource: first,
    });

    controller.object.updateTextureSource?.(second);

    expect(controller.object.textureSource).toBe(second);

    controller.controller.dispose();
  });

  test("texture plane telemetry records source changes without owning source frames", () => {
    const first = document.createElement("img");
    Object.defineProperties(first, {
      naturalWidth: { value: 1600 },
      naturalHeight: { value: 900 },
    });
    const second = document.createElement("img");
    Object.defineProperties(second, {
      naturalWidth: { value: 800 },
      naturalHeight: { value: 600 },
    });

    const controller = createTexturePlaneSceneRenderableController({
      key: "sequence.hero",
      sceneAdapter: createSceneAdapter(),
      measureElement: () => createMeasurement(),
      getViewportSize: () => ({ width: 800, height: 600 }),
      element: document.createElement("section"),
      textureKind: "image",
      textureSource: first,
    });

    controller.object.updateTextureSource?.(second);

    expect(controller.object.inspectTextureTelemetry).toEqual(expect.any(Function));
    expect(controller.object.inspectTextureTelemetry?.()).toEqual([
      expect.objectContaining({
        key: "sequence.hero",
        width: 800,
        height: 600,
        sourceKind: "image",
        dirty: true,
        dirtyReason: "source-change",
      }),
    ]);

    controller.controller.dispose();
  });
});

function createSceneAdapter() {
  return {
    addObject: vi.fn(),
    removeObject: vi.fn(),
    render: vi.fn(),
  };
}

function createMeasurement() {
  return {
    x: 0,
    y: 0,
    left: 32,
    top: 40,
    right: 432,
    bottom: 340,
    width: 400,
    height: 300,
  };
}

function expectGroupRootWithChild(object3D: unknown): void {
  expect(object3D).toMatchObject({
    children: expect.any(Array),
  });
  expect((object3D as { children: unknown[] }).children.length).toBeGreaterThan(0);
}

function createCanvasContextStub(): CanvasRenderingContext2D & {
  clearRect: ReturnType<typeof vi.fn>;
  fillText: ReturnType<typeof vi.fn>;
  measureText: ReturnType<typeof vi.fn>;
  save: ReturnType<typeof vi.fn>;
  restore: ReturnType<typeof vi.fn>;
  translate: ReturnType<typeof vi.fn>;
  rotate: ReturnType<typeof vi.fn>;
  scale: ReturnType<typeof vi.fn>;
  setTransform: ReturnType<typeof vi.fn>;
  fillStyle: string;
  font: string;
  globalAlpha: number;
  textAlign: CanvasTextAlign;
  textBaseline: CanvasTextBaseline;
} {
  return {
    clearRect: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn((text: string) => ({ width: text.length * 10 })),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    scale: vi.fn(),
    setTransform: vi.fn(),
    fillStyle: "",
    font: "",
    globalAlpha: 1,
    textAlign: "left",
    textBaseline: "alphabetic",
  } as unknown as CanvasRenderingContext2D & {
    clearRect: ReturnType<typeof vi.fn>;
    fillText: ReturnType<typeof vi.fn>;
    measureText: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    restore: ReturnType<typeof vi.fn>;
    translate: ReturnType<typeof vi.fn>;
    rotate: ReturnType<typeof vi.fn>;
    scale: ReturnType<typeof vi.fn>;
    setTransform: ReturnType<typeof vi.fn>;
    fillStyle: string;
    font: string;
    globalAlpha: number;
    textAlign: CanvasTextAlign;
    textBaseline: CanvasTextBaseline;
  };
}

function stubCanvasContext(context: CanvasRenderingContext2D): () => void {
  const originalCreateElement = document.createElement.bind(document);
  const createElement = vi.spyOn(document, "createElement");
  const originalCanvasRenderingContext2D = window.CanvasRenderingContext2D;

  Object.defineProperty(window, "CanvasRenderingContext2D", {
    configurable: true,
    value: function CanvasRenderingContext2D() {
      return undefined;
    },
  });

  createElement.mockImplementation(((tagName: string, options?: ElementCreationOptions) => {
    const element = originalCreateElement(tagName, options);
    if (tagName.toLowerCase() === "canvas") {
      vi.spyOn(element as HTMLCanvasElement, "getContext").mockReturnValue(
        context,
      );
    }

    return element;
  }) as typeof document.createElement);

  return () => {
    createElement.mockRestore();
    Object.defineProperty(window, "CanvasRenderingContext2D", {
      configurable: true,
      value: originalCanvasRenderingContext2D,
    });
  };
}

function readMediaTexture(object3D: unknown) {
  const group = object3D as {
    children: Array<{
      material: { map: { repeat: { x: number; y: number }; offset: { x: number; y: number } } };
    }>;
  };

  return group.children[0].material.map;
}
