import { afterEach, describe, expect, test, vi } from "vitest";

import { createTargetDescriptor } from "../../dom/targetDescriptor";
import type { WebGLSceneAdapter } from "../../renderer/sceneObject";
import type { WebGLDOMSourceDescriptor } from "../../source/sourceDescriptor";
import { compileRenderPolicy } from "../renderPolicy";
import { createTextSnapshotRenderable } from "./textSnapshotRenderable";

const originalCanvasRenderingContext2D = window.CanvasRenderingContext2D;

describe("createTextSnapshotRenderable", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(window, "CanvasRenderingContext2D", {
      configurable: true,
      value: originalCanvasRenderingContext2D,
    });
  });

  test("creates a content renderable and captures target text on update", async () => {
    const element = document.createElement("h1");
    element.textContent = "Hello WebGL text";
    const descriptor = createTargetDescriptor(element, { key: "hero.title" }, 1);
    const sceneAdapter = createSceneAdapter();

    const renderable = createTextSnapshotRenderable(
      {
        descriptor,
        source: createTextSnapshotDescriptor(element),
        role: "content",
        policy: compileRenderPolicy("content"),
      },
      {
        sceneAdapter,
        measureElement: () => createMeasurement(12, 24, 200, 40),
      },
    );

    expect(renderable.key).toBe("hero.title");
    expect(renderable.role).toBe("content");
    expect(renderable.policy).toEqual(compileRenderPolicy("content"));
    expect(renderable.status).toBe("idle");

    await renderable.update();
    renderable.updateLayout?.(createMeasurement(12, 24, 200, 40));

    expect(renderable.textContent).toBe("Hello WebGL text");
    expect(sceneAdapter.objects[0]).toMatchObject({
      key: "hero.title",
      textContent: "Hello WebGL text",
      visible: true,
      lastLayout: { x: 112, y: 556, width: 200, height: 40 },
    });
    expect(renderable.status).toBe("ready");
    expect(renderable.effectSource).toMatchObject({
      kind: "dom",
      type: "text",
      text: "Hello WebGL text",
      textLayer: expect.objectContaining({
        canvas: expect.any(HTMLCanvasElement),
        createMaterialLayer: expect.any(Function),
        getGlyphs: expect.any(Function),
        setGlyphs: expect.any(Function),
        setText: expect.any(Function),
      }),
    });
    const effectSource = renderable.effectSource;
    if (
      effectSource?.kind !== "dom" ||
      effectSource.type !== "text" ||
      !effectSource.textLayer
    ) {
      throw new Error("Expected text effect source.");
    }
    expect("texture" in effectSource.textLayer).toBe(false);
    expect("mesh" in effectSource.textLayer).toBe(false);
    expect("material" in effectSource.textLayer).toBe(false);

    element.textContent = "Updated WebGL text";
    renderable.updateLayout?.(createMeasurement(12, 24, 200, 40));

    expect(sceneAdapter.objects).toHaveLength(1);
    expect(sceneAdapter.objects[0]?.textContent).toBe("Hello WebGL text");
    const root = sceneAdapter.objects[0]?.object3D as
      | {
          isGroup?: boolean;
          children?: Array<{ isMesh?: boolean; geometry?: { type?: string } }>;
        }
      | undefined;
    expect(root?.isGroup).toBe(true);
    expect(root?.children?.[0]).toMatchObject({
      isMesh: true,
      geometry: { type: "PlaneGeometry" },
    });
  });

  test("redraws text content only after internal content invalidation", async () => {
    const element = document.createElement("h1");
    element.textContent = "Initial";
    const descriptor = createTargetDescriptor(element, { key: "hero.title" }, 1);
    const renderable = createTextSnapshotRenderable(
      {
        descriptor,
        source: createTextSnapshotDescriptor(element),
        role: "content",
        policy: compileRenderPolicy("content"),
      },
      {
        sceneAdapter: createSceneAdapter(),
        measureElement: () => createMeasurement(0, 0, 200, 50),
      },
    );

    await renderable.update();
    element.textContent = "Changed";
    renderable.updateLayout?.(createMeasurement(0, 0, 200, 50));

    expect(renderable.textContent).toBe("Initial");

    renderable.invalidateContent?.();
    await renderable.update();

    expect(renderable.textContent).toBe("Changed");
  });

  test("does not redraw text content during repeated frame updates", async () => {
    const element = document.createElement("h1");
    element.textContent = "Initial";
    const descriptor = createTargetDescriptor(element, { key: "hero.title" }, 1);
    const renderable = createTextSnapshotRenderable(
      {
        descriptor,
        source: createTextSnapshotDescriptor(element),
        role: "content",
        policy: compileRenderPolicy("content"),
      },
      {
        sceneAdapter: createSceneAdapter(),
        measureElement: () => createMeasurement(0, 0, 200, 50),
      },
    );

    await renderable.update();
    element.textContent = "Changed";
    await renderable.update();

    expect(renderable.textContent).toBe("Initial");
  });

  test("sizes the text texture to the measured DOM box so it is not stretched", async () => {
    const element = document.createElement("h2");
    element.textContent = "Text snapshot target";
    Object.assign(element.style, {
      color: "rgb(29, 33, 28)",
      fontFamily: "Arial",
      fontSize: "36px",
      fontWeight: "700",
      lineHeight: "44px",
      textAlign: "center",
    });
    const descriptor = createTargetDescriptor(element, { key: "hero.title" }, 1);
    const sceneAdapter = createSceneAdapter();
    const fillText = vi.fn();
    const context = createCanvasContextStub({ fillText });
    const createElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tagName) => {
      const createdElement = createElement(tagName);

      if (tagName === "canvas") {
        Object.assign(createdElement, {
          getContext: vi.fn(() => context),
        });
      }

      return createdElement;
    });
    Object.defineProperty(window, "CanvasRenderingContext2D", {
      configurable: true,
      value: function CanvasRenderingContext2D() {},
    });
    const renderable = createTextSnapshotRenderable(
      {
        descriptor,
        source: createTextSnapshotDescriptor(element),
        role: "content",
        policy: compileRenderPolicy("content"),
      },
      {
        sceneAdapter,
        measureElement: () => createMeasurement(0, 0, 240, 132),
      },
    );

    await renderable.update();
    renderable.updateLayout?.(createMeasurement(0, 0, 240, 132));

    const textureCanvas = sceneAdapter.objects[0]?.textureSource as
      | HTMLCanvasElement
      | undefined;
    expect(textureCanvas?.width).toBe(240);
    expect(textureCanvas?.height).toBe(132);
    expect(context.font).toContain("36px");
    expect(context.fillStyle).toBe("#000000");
    expect(context.textAlign).toBe("center");
    expect(fillText).toHaveBeenCalled();
  });

  test("uses computed block alignment when positioning text in the texture", async () => {
    const element = document.createElement("h2");
    element.textContent = "Title";
    Object.assign(element.style, {
      alignContent: "center",
      color: "rgb(29, 33, 28)",
      display: "grid",
      fontFamily: "Arial",
      fontSize: "36px",
      lineHeight: "40px",
      padding: "20px",
    });
    const descriptor = createTargetDescriptor(element, { key: "hero.title" }, 1);
    const sceneAdapter = createSceneAdapter();
    const fillText = vi.fn();
    const context = createCanvasContextStub({ fillText });
    const createElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tagName) => {
      const createdElement = createElement(tagName);

      if (tagName === "canvas") {
        Object.assign(createdElement, {
          getContext: vi.fn(() => context),
        });
      }

      return createdElement;
    });
    Object.defineProperty(window, "CanvasRenderingContext2D", {
      configurable: true,
      value: function CanvasRenderingContext2D() {},
    });
    const renderable = createTextSnapshotRenderable(
      {
        descriptor,
        source: createTextSnapshotDescriptor(element),
        role: "content",
        policy: compileRenderPolicy("content"),
      },
      {
        sceneAdapter,
        measureElement: () => createMeasurement(0, 0, 240, 180),
      },
    );

    await renderable.update();
    renderable.updateLayout?.(createMeasurement(0, 0, 240, 180));

    expect(fillText).toHaveBeenCalledWith("Title", 20, 70);
  });

  test("disposes idempotently", async () => {
    const element = document.createElement("p");
    element.textContent = "Disposable copy";
    const descriptor = createTargetDescriptor(element, { key: "body.copy" }, 2);
    const sceneAdapter = createSceneAdapter();
    const renderable = createTextSnapshotRenderable(
      {
        descriptor,
        source: createTextSnapshotDescriptor(element),
        role: "content",
        policy: compileRenderPolicy("content"),
      },
      {
        sceneAdapter,
        measureElement: () => createMeasurement(0, 0, 100, 20),
      },
    );

    await renderable.update();
    expect(renderable.textContent).toBe("Disposable copy");

    renderable.dispose();
    renderable.dispose();

    expect(renderable.status).toBe("disposed");
    expect(renderable.textContent).toBe("");
    expect(sceneAdapter.removeObject).toHaveBeenCalledTimes(1);
    expect(sceneAdapter.objects[0]?.disposed).toBe(true);
  });
});

type TestSceneObject = {
  key: string;
  textContent?: string;
  visible: boolean;
  disposed: boolean;
  lastLayout?: unknown;
  object3D?: unknown;
  textureSource?: unknown;
};

function createSceneAdapter(): WebGLSceneAdapter & {
  objects: TestSceneObject[];
  removeObject: ReturnType<typeof vi.fn>;
} {
  const objects: TestSceneObject[] = [];

  return {
    objects,
    addObject(object: TestSceneObject) {
      objects.push(object);
    },
    removeObject: vi.fn(),
    render() {
      return;
    },
  } as unknown as WebGLSceneAdapter & {
    objects: TestSceneObject[];
    removeObject: ReturnType<typeof vi.fn>;
  };
}

function createMeasurement(
  left: number,
  top: number,
  width: number,
  height: number,
) {
  return {
    x: left,
    y: top,
    width,
    height,
    top,
    right: left + width,
    bottom: top + height,
    left,
    viewport: { width: 800, height: 600 },
    devicePixelRatio: 1,
    layoutSignature: JSON.stringify([left, top, width, height, 800, 600, 1]),
  };
}

function createCanvasContextStub({
  fillText = vi.fn(),
}: {
  fillText?: ReturnType<typeof vi.fn>;
} = {}) {
  return {
    beginPath: vi.fn(),
    clearRect: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    fillText,
    lineTo: vi.fn(),
    measureText: vi.fn((text: string) => ({ width: text.length * 18 })),
    moveTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    restore: vi.fn(),
    save: vi.fn(),
    scale: vi.fn(),
    setTransform: vi.fn(),
    stroke: vi.fn(),
    textBaseline: "",
    textAlign: "",
    fillStyle: "",
    font: "",
  };
}

function createTextSnapshotDescriptor(
  element: HTMLElement,
): WebGLDOMSourceDescriptor {
  return {
    kind: "dom",
    type: "text",
    element,
  };
}
