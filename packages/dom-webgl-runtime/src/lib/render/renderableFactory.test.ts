import { describe, expect, test, vi } from "vitest";

import { createTargetDescriptor } from "../dom/targetDescriptor";
import { createResourceManager } from "../resources/resourceManager";
import type {
  WebGLImageSequenceSourceDescriptor,
  WebGLImageSourceDescriptor,
  WebGLModelSourceDescriptor,
  WebGLSnapshotSourceDescriptor,
  WebGLSourceDescriptor,
  WebGLVideoSourceDescriptor,
} from "../source/sourceDescriptor";
import { compileRenderPolicy, toSceneObjectOrdering } from "./renderPolicy";
import { createRenderable } from "./renderableFactory";

describe("createRenderable factory", () => {
  test("creates an element snapshot renderable for snapshot/element sources", () => {
    const element = document.createElement("section");
    const descriptor = createTargetDescriptor(
      element,
      { key: "hero.snapshot" },
      0,
    );
    const source: WebGLSnapshotSourceDescriptor = {
      kind: "snapshot",
      mode: "element",
      element,
    };
    const measureElement = vi.fn(() => ({
      x: 1,
      y: 2,
      width: 300,
      height: 120,
      top: 2,
      right: 301,
      bottom: 122,
      left: 1,
    }));
    const sceneAdapter = createSceneAdapter();
    const getViewportSize = vi.fn(() => ({ width: 1000, height: 700 }));

    const renderable = createRenderable(
      descriptor,
      source,
      "surface",
      compileRenderPolicy("surface"),
      {
        resourceManager: createResourceManager(),
        sceneAdapter,
        measureElement,
        getViewportSize,
      },
    );

    renderable.update();
    renderable.updateLayout?.(createMeasurement(1, 2, 300, 120));

    expect(renderable.key).toBe("hero.snapshot");
    expect(renderable.role).toBe("surface");
    expect(renderable.policy).toEqual(compileRenderPolicy("surface"));
    expect(measureElement).not.toHaveBeenCalled();
    expect(sceneAdapter.objects[0]?.key).toBe("hero.snapshot");
    expect(sceneAdapter.objects[0]?.lastLayout).toEqual({
      x: 151,
      y: 638,
      width: 300,
      height: 120,
    });
    expect(getViewportSize).toHaveBeenCalledTimes(1);
  });

  test("creates a text snapshot renderable for snapshot/text sources", () => {
    const element = document.createElement("p");
    element.textContent = "Readable overlay copy";
    const descriptor = createTargetDescriptor(element, { key: "hero.copy" }, 0);
    const source: WebGLSnapshotSourceDescriptor = {
      kind: "snapshot",
      mode: "text",
      element,
    };
    const sceneAdapter = createSceneAdapter();

    const renderable = createRenderable(
      descriptor,
      source,
      "content",
      compileRenderPolicy("content"),
      {
        resourceManager: createResourceManager(),
        sceneAdapter,
        measureElement: () => createMeasurement(0, 0, 200, 40),
      },
    );

    renderable.update();

    expect(renderable.key).toBe("hero.copy");
    expect(renderable.role).toBe("content");
    expect(renderable.policy).toEqual(compileRenderPolicy("content"));
    expect("textContent" in renderable).toBe(true);
    expect((renderable as unknown as { textContent: string }).textContent).toBe(
      "Readable overlay copy",
    );
    expect(sceneAdapter.objects[0]).toMatchObject({
      key: "hero.copy",
      textContent: "Readable overlay copy",
    });
  });

  test("creates an image renderable for image sources", async () => {
    const source = createImageDescriptor("/assets/hero.png");
    const descriptor = createTargetDescriptor(source.element, { key: "hero.image" }, 0);
    const resourceManager = createResourceManager();
    const sceneAdapter = createSceneAdapter();
    const decode = vi.fn(async () => undefined);
    Object.defineProperty(source.element, "decode", {
      configurable: true,
      value: decode,
    });

    const renderable = createRenderable(
      descriptor,
      source,
      "media",
      compileRenderPolicy("media"),
      {
        resourceManager,
        sceneAdapter,
        measureElement: () => createMeasurement(0, 0, 100, 50),
      },
    );

    await renderable.update();

    expect(renderable.role).toBe("media");
    expect(decode).toHaveBeenCalledTimes(1);
    expect((renderable as unknown as { fallbackVisible: boolean }).fallbackVisible).toBe(
      false,
    );
    expect(sceneAdapter.objects[0]).toMatchObject({
      key: "hero.image",
      textureSource: source.element,
    });
    expect(resourceManager.inspect("image:element-1:/assets/hero.png")).toMatchObject({
      kind: "image",
      status: "ready",
      element: source.element,
      value: source.element,
    });
  });

  test("creates a video renderable for video sources", async () => {
    const source = createVideoDescriptor("/assets/intro.mp4");
    const descriptor = createTargetDescriptor(source.element, { key: "hero.video" }, 0);
    const loadVideo = vi.fn(async () => source.element);
    const sceneAdapter = createSceneAdapter();

    const renderable = createRenderable(
      descriptor,
      source,
      "media",
      compileRenderPolicy("media"),
      {
        resourceManager: createResourceManager(),
        sceneAdapter,
        measureElement: () => createMeasurement(0, 0, 100, 50),
        loadVideo,
      },
    );

    await renderable.update();

    expect(renderable.role).toBe("media");
    expect(loadVideo).toHaveBeenCalledWith(source);
    expect((renderable as unknown as { resourceReady: boolean }).resourceReady).toBe(
      true,
    );
    expect(sceneAdapter.objects[0]).toMatchObject({
      key: "hero.video",
      textureSource: source.element,
    });
  });

  test("creates an image sequence renderable for image-sequence sources", () => {
    const source = createImageSequenceDescriptor();
    const descriptor = createTargetDescriptor(
      source.anchor,
      { key: "hero.sequence" },
      0,
    );

    const renderable = createRenderable(
      descriptor,
      source,
      "media",
      compileRenderPolicy("media"),
      {
        resourceManager: createResourceManager(),
        sceneAdapter: createSceneAdapter(),
        measureElement: () => createMeasurement(0, 0, 100, 50),
        progressSignals: { get: () => 0.5 },
      },
    );

    expect(renderable.key).toBe("hero.sequence");
    expect(renderable.role).toBe("media");
    expect(renderable.policy).toEqual(compileRenderPolicy("media"));
  });

  test("creates a model renderable for model/glb sources", async () => {
    const source = createModelDescriptor("/assets/product.glb");
    const descriptor = createTargetDescriptor(source.anchor, { key: "hero.model" }, 0);
    const loadedModel = { scene: "model" };
    const loadModel = vi.fn(async () => loadedModel);
    const sceneAdapter = createSceneAdapter();

    const renderable = createRenderable(
      descriptor,
      source,
      "model",
      compileRenderPolicy("model"),
      {
        resourceManager: createResourceManager(),
        sceneAdapter,
        measureElement: () => createMeasurement(0, 0, 100, 50),
        loadModel,
      },
    );

    await renderable.update();

    expect(renderable.role).toBe("model");
    expect(loadModel).toHaveBeenCalledWith(source);
    expect((renderable as unknown as { resourceReady: boolean }).resourceReady).toBe(
      true,
    );
    expect(sceneAdapter.objects[0]).toMatchObject({
      key: "hero.model",
      object3D: "model",
    });
  });

  test("preserves the upstream role and policy for explicit role overrides", async () => {
    const source = createImageDescriptor("/assets/overlay.png");
    const descriptor = createTargetDescriptor(
      source.element,
      { key: "hero.overlay" },
      0,
    );
    const policy = compileRenderPolicy("overlay");
    const sceneAdapter = createSceneAdapter();
    Object.defineProperty(source.element, "decode", {
      configurable: true,
      value: vi.fn(async () => undefined),
    });

    const renderable = createRenderable(
      descriptor,
      source,
      "overlay",
      policy,
      {
        resourceManager: createResourceManager(),
        sceneAdapter,
        measureElement: () => source.element.getBoundingClientRect(),
      },
    );

    await renderable.update();

    expect(renderable.role).toBe("overlay");
    expect(renderable.policy).toBe(policy);
    expect(sceneAdapter.objects[0]?.ordering).toEqual(
      toSceneObjectOrdering(policy),
    );
  });

  test("throws a clear runtime error for unsupported source descriptor kinds", () => {
    const element = document.createElement("canvas");
    const descriptor = createTargetDescriptor(element, { key: "hero.canvas" }, 0);
    const source = {
      kind: "canvas",
      element,
    } as unknown as WebGLSourceDescriptor;

    expect(() =>
      createRenderable(
        descriptor,
        source,
        "surface",
        compileRenderPolicy("surface"),
        {
          resourceManager: createResourceManager(),
          sceneAdapter: createSceneAdapter(),
          measureElement: () => element.getBoundingClientRect(),
        },
      ),
    ).toThrow("Unsupported WebGL source descriptor kind: canvas");
  });

  test("throws a clear runtime error for unsupported snapshot modes", () => {
    const element = document.createElement("section");
    const descriptor = createTargetDescriptor(element, { key: "hero.snapshot" }, 0);
    const source = {
      kind: "snapshot",
      mode: "canvas",
      element,
    } as unknown as WebGLSourceDescriptor;

    expect(() =>
      createRenderable(
        descriptor,
        source,
        "surface",
        compileRenderPolicy("surface"),
        {
          resourceManager: createResourceManager(),
          sceneAdapter: createSceneAdapter(),
          measureElement: () => element.getBoundingClientRect(),
        },
      ),
    ).toThrow("Unsupported WebGL source descriptor kind: snapshot/canvas");
  });

  test("throws a clear runtime error for unsupported model formats", () => {
    const anchor = document.createElement("div");
    const descriptor = createTargetDescriptor(anchor, { key: "hero.model" }, 0);
    const source = {
      kind: "model",
      format: "gltf",
      anchor,
      src: "/assets/product.gltf",
    } as unknown as WebGLSourceDescriptor;

    expect(() =>
      createRenderable(
        descriptor,
        source,
        "model",
        compileRenderPolicy("model"),
        {
          resourceManager: createResourceManager(),
          sceneAdapter: createSceneAdapter(),
          measureElement: () => anchor.getBoundingClientRect(),
        },
      ),
    ).toThrow("Unsupported WebGL source descriptor kind: model/gltf");
  });
});

function createImageDescriptor(src: string): WebGLImageSourceDescriptor {
  const element = document.createElement("img");
  element.src = src;

  return {
    kind: "image",
    element,
    src,
  };
}

function createVideoDescriptor(src: string): WebGLVideoSourceDescriptor {
  const element = document.createElement("video");
  element.src = src;
  element.pause = vi.fn();

  return {
    kind: "video",
    element,
    src,
  };
}

function createModelDescriptor(src: string): WebGLModelSourceDescriptor {
  return {
    kind: "model",
    format: "glb",
    anchor: document.createElement("div"),
    src,
  };
}

function createImageSequenceDescriptor(): WebGLImageSequenceSourceDescriptor {
  return {
    kind: "image-sequence",
    anchor: document.createElement("section"),
    frameCount: 10,
    frameSrc: "/frames/frame_{frame:0000}.webp",
    progressKey: "scrub",
    startFrame: 1,
    preloadBefore: 1,
    preloadAfter: 2,
    maxCachedFrames: 4,
  };
}

type TestSceneObject = {
  key?: string;
  ordering?: unknown;
  textContent?: string;
  textureSource?: unknown;
  object3D?: unknown;
  lastLayout?: unknown;
};

function createSceneAdapter() {
  const objects: TestSceneObject[] = [];

  return {
    objects,
    addObject(object: TestSceneObject) {
      objects.push(object);
    },
    removeObject() {
      return;
    },
    render() {
      return;
    },
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
