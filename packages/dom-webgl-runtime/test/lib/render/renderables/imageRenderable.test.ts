import { afterEach, describe, expect, test, vi } from "vitest";

import { createTargetDescriptor } from "../../../../src/lib/dom/targetDescriptor";
import { createResourceManager } from "../../../../src/lib/resources/resourceManager";
import type { WebGLSceneAdapter } from "../../../../src/lib/renderer/sceneObject";
import type { WebGLMediaImageSourceDescriptor } from "../../../../src/lib/source/sourceDescriptor";
import { compileRenderPolicy } from "../../../../src/lib/render/renderPolicy";
import { createImageRenderable } from "../../../../src/lib/render/renderables/imageRenderable";

describe("createImageRenderable", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("creates a media renderable and loads the existing DOM image resource", async () => {
    const source = createImageDescriptor("/assets/hero.png");
    Object.assign(source.element.style, {
      backgroundColor: "rgb(240, 248, 255)",
      border: "2px solid rgb(12, 34, 56)",
      borderRadius: "18px",
    });
    const descriptor = createTargetDescriptor(
      source.element,
      { key: "hero.image" },
      0,
    );
    const resourceManager = createResourceManager();
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const decode = stubDecode(source.element);
    const sceneAdapter = createSceneAdapter();

    const renderable = createImageRenderable(
      {
        descriptor,
        source,
        role: "media",
        policy: compileRenderPolicy("media"),
      },
      {
        resourceManager,
        sceneAdapter,
        measureElement: () => createMeasurement(20, 40, 200, 100),
      },
    );

    expect(renderable.key).toBe("hero.image");
    expect(renderable.role).toBe("media");
    expect(renderable.policy).toEqual(compileRenderPolicy("media"));
    expect(renderable.fallbackVisible).toBe(true);

    await renderable.update();
    renderable.updateLayout?.(createMeasurement(20, 40, 200, 100));

    expect(decode).toHaveBeenCalledTimes(1);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(renderable.status).toBe("ready");
    expect(renderable.fallbackVisible).toBe(false);
    expect(renderable.hasSceneObject).toBe(true);
    expect(renderable.effectSource).toMatchObject({
      kind: "media",
      type: "image",
      element: source.anchor,
      src: "/assets/hero.png",
      image: expect.objectContaining({
        source: source.element,
        createMaterialLayer: expect.any(Function),
        setTextureTransform: expect.any(Function),
        invalidate: expect.any(Function),
      }),
    });
    const effectSource = renderable.effectSource;
    if (
      effectSource?.kind !== "media" ||
      effectSource.type !== "image" ||
      !effectSource.image
    ) {
      throw new Error("Expected image effect source.");
    }
    expect("texture" in effectSource.image).toBe(false);
    expect("mesh" in effectSource.image).toBe(false);
    expect("material" in effectSource.image).toBe(false);
    expect(sceneAdapter.objects).toHaveLength(1);
    expect(sceneAdapter.objects[0]).toMatchObject({
      key: "hero.image",
      textureSource: source.element,
      visible: true,
      lastLayout: { x: 120, y: 510, width: 200, height: 100 },
    });
    expect(sceneAdapter.objects[0]?.object3D).toMatchObject({
      isGroup: true,
      children: [
        {
          isMesh: true,
          geometry: { type: "PlaneGeometry" },
          material: {
            map: {
              isTexture: true,
              source: { data: source.element },
            },
          },
        },
      ],
    });
    expect(resourceManager.inspect("image:element-1:/assets/hero.png")).toMatchObject({
      kind: "image",
      status: "ready",
      element: source.element,
      value: source.element,
    });

    renderable.setVisible(false);
    expect(sceneAdapter.objects[0]?.visible).toBe(false);

    renderable.dispose();

    expect(sceneAdapter.removeObject).toHaveBeenCalledTimes(1);
    expect(sceneAdapter.objects[0]?.disposed).toBe(true);
    expect(resourceManager.inspect("image:element-1:/assets/hero.png")).toBeUndefined();
  });

  test("keeps fallback visible when the image resource fails", async () => {
    const source = createImageDescriptor("/assets/missing.png");
    const descriptor = createTargetDescriptor(
      source.element,
      { key: "hero.image" },
      0,
    );
    const resourceManager = createResourceManager();
    const error = new Error("decode failed");
    stubDecode(source.element, async () => Promise.reject(error));
    const sceneAdapter = createSceneAdapter();
    const renderable = createImageRenderable(
      {
        descriptor,
        source,
        role: "media",
        policy: compileRenderPolicy("media"),
      },
      {
        resourceManager,
        sceneAdapter,
        measureElement: () => createMeasurement(0, 0, 100, 50),
      },
    );

    await expect(renderable.update()).rejects.toThrow("decode failed");

    expect(renderable.status).toBe("error");
    expect(renderable.fallbackVisible).toBe(true);
    expect(renderable.hasSceneObject).toBe(false);
    expect(sceneAdapter.objects).toHaveLength(0);
    expect(resourceManager.inspect("image:element-1:/assets/missing.png")).toMatchObject({
      status: "error",
      error,
    });
  });

  test("does not retry a failed image decode on later frame updates", async () => {
    const source = createImageDescriptor("/assets/broken.png");
    const descriptor = createTargetDescriptor(
      source.element,
      { key: "hero.image" },
      0,
    );
    const resourceManager = createResourceManager();
    const error = new DOMException(
      "The source image cannot be decoded.",
      "EncodingError",
    );
    const decode = stubDecode(source.element, async () => Promise.reject(error));
    const renderable = createImageRenderable(
      {
        descriptor,
        source,
        role: "media",
        policy: compileRenderPolicy("media"),
      },
      {
        resourceManager,
        sceneAdapter: createSceneAdapter(),
        measureElement: () => createMeasurement(0, 0, 100, 50),
      },
    );

    await expect(renderable.update()).rejects.toThrow(
      "The source image cannot be decoded.",
    );
    renderable.update();

    expect(decode).toHaveBeenCalledTimes(1);
    expect(renderable.status).toBe("error");
    expect(renderable.fallbackVisible).toBe(true);
  });

  test("does not duplicate DOM image loads for shared image elements", async () => {
    const source = createImageDescriptor("/assets/hero.png");
    const descriptor = createTargetDescriptor(
      source.element,
      { key: "hero.image" },
      0,
    );
    const resourceManager = createResourceManager();
    let resolveDecode!: () => void;
    const decode = stubDecode(
      source.element,
      async () =>
        new Promise<void>((resolve) => {
          resolveDecode = resolve;
        }),
    );
    const first = createImageRenderable(
      {
        descriptor,
        source,
        role: "media",
        policy: compileRenderPolicy("media"),
      },
      {
        resourceManager,
        sceneAdapter: createSceneAdapter(),
        measureElement: () => createMeasurement(0, 0, 100, 50),
      },
    );
    const second = createImageRenderable(
      {
        descriptor,
        source,
        role: "media",
        policy: compileRenderPolicy("media"),
      },
      {
        resourceManager,
        sceneAdapter: createSceneAdapter(),
        measureElement: () => createMeasurement(0, 0, 100, 50),
      },
    );

    const firstUpdate = first.update();
    const secondUpdate = second.update();

    expect(decode).toHaveBeenCalledTimes(1);

    resolveDecode();
    await Promise.all([firstUpdate, secondUpdate]);

    expect(first.status).toBe("ready");
    expect(second.status).toBe("ready");
  });

  test("uses the anchor element for layout and an off-DOM image for media texture", async () => {
    const anchor = document.createElement("section");
    const source = {
      kind: "media",
      type: "image",
      anchor,
      src: "/hero.png",
    } satisfies WebGLMediaImageSourceDescriptor;
    const descriptor = createTargetDescriptor(anchor, { key: "hero.image" }, 0);
    const sceneAdapter = createSceneAdapter();
    const image = document.createElement("img");
    const imageConstructor = vi
      .spyOn(globalThis, "Image")
      .mockImplementation(() => image);
    stubDecode(image);

    const renderable = createImageRenderable(
      {
        descriptor,
        source,
        role: "media",
        policy: compileRenderPolicy("media"),
      },
      {
        resourceManager: createResourceManager(),
        sceneAdapter,
        measureElement: () => createMeasurement(0, 0, 100, 50),
      },
    );

    await renderable.update();

    expect(imageConstructor).toHaveBeenCalledTimes(1);
    expect(image.src).toContain("/hero.png");
    expect(sceneAdapter.objects[0]?.textureSource).toBe(image);
    expect(sceneAdapter.objects[0]?.lastLayout).toBeUndefined();
    renderable.updateLayout?.(createMeasurement(0, 0, 100, 50));
    expect(sceneAdapter.objects[0]?.lastLayout).toEqual({
      x: 50,
      y: 575,
      width: 100,
      height: 50,
    });
  });
});

type TestSceneObject = {
  key: string;
  textureSource?: unknown;
  visible: boolean;
  disposed: boolean;
  lastLayout?: unknown;
  object3D?: unknown;
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

type TestImageSourceDescriptor = WebGLMediaImageSourceDescriptor & {
  anchor: HTMLImageElement;
  element: HTMLImageElement;
};

function createImageDescriptor(src: string): TestImageSourceDescriptor {
  const element = document.createElement("img");
  element.src = src;

  return {
    kind: "media",
    type: "image",
    anchor: element,
    element,
    src,
  };
}

function stubDecode(
  element: HTMLImageElement,
  implementation: () => Promise<void> = async () => undefined,
) {
  const decode = vi.fn(implementation);

  Object.defineProperty(element, "decode", {
    configurable: true,
    value: decode,
  });

  return decode;
}
