import { afterEach, describe, expect, test, vi } from "vitest";

import { createTargetDescriptor } from "../../dom/targetDescriptor";
import { createResourceManager } from "../../resources/resourceManager";
import type { WebGLSceneAdapter } from "../../renderer/sceneObject";
import type { WebGLVideoSourceDescriptor } from "../../source/sourceDescriptor";
import { compileRenderPolicy } from "../renderPolicy";
import { createVideoRenderable } from "./videoRenderable";

describe("createVideoRenderable", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("creates a media renderable and adopts the existing DOM video resource", async () => {
    const source = createVideoDescriptor("/assets/hero.mp4");
    const descriptor = createTargetDescriptor(
      source.element,
      { key: "hero.video" },
      0,
    );
    const resourceManager = createResourceManager();
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const createElementSpy = vi.spyOn(document, "createElement");
    const sceneAdapter = createSceneAdapter();
    const pause = stubPause(source.element);

    const renderable = createVideoRenderable(
      {
        descriptor,
        source,
        role: "media",
        policy: compileRenderPolicy("media"),
      },
      {
        resourceManager,
        sceneAdapter,
        measureElement: () => createMeasurement(40, 60, 320, 180),
      },
    );

    expect(renderable.key).toBe("hero.video");
    expect(renderable.role).toBe("media");
    expect(renderable.policy).toEqual(compileRenderPolicy("media"));
    expect(renderable.fallbackVisible).toBe(true);
    expect(renderable.resourceReady).toBe(false);

    const update = renderable.update();
    source.element.dispatchEvent(new Event("loadeddata"));
    await update;
    renderable.updateLayout?.(createMeasurement(40, 60, 320, 180));

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(createElementSpy).not.toHaveBeenCalledWith("video");
    expect(renderable.status).toBe("ready");
    expect(renderable.fallbackVisible).toBe(false);
    expect(renderable.resourceReady).toBe(true);
    expect(renderable.hasSceneObject).toBe(true);
    expect(sceneAdapter.objects[0]).toMatchObject({
      key: "hero.video",
      textureSource: source.element,
      visible: true,
      lastLayout: { x: 200, y: 450, width: 320, height: 180 },
    });
    expect(sceneAdapter.objects[0]?.object3D).toMatchObject({
      isMesh: true,
      geometry: { type: "PlaneGeometry" },
      material: {
        map: {
          isVideoTexture: true,
          source: { data: source.element },
        },
      },
    });
    expect(resourceManager.inspect("video:element-1:/assets/hero.mp4")).toMatchObject({
      kind: "video",
      status: "ready",
      element: source.element,
      value: source.element,
    });

    renderable.setVisible(false);
    expect(pause).toHaveBeenCalledTimes(1);
    expect(sceneAdapter.objects[0]?.visible).toBe(false);

    renderable.dispose();

    expect(pause).toHaveBeenCalledTimes(2);
    expect(sceneAdapter.removeObject).toHaveBeenCalledTimes(1);
    expect(sceneAdapter.objects[0]?.disposed).toBe(true);
    expect(resourceManager.inspect("video:element-1:/assets/hero.mp4")).toBeUndefined();
  });

  test("pauses video playback when inactive and when disposed", () => {
    const source = createVideoDescriptor("/assets/hero.mp4");
    const descriptor = createTargetDescriptor(
      source.element,
      { key: "hero.video" },
      0,
    );
    const resourceManager = createResourceManager();
    const pause = stubPause(source.element);
    const sceneAdapter = createSceneAdapter();
    const renderable = createVideoRenderable(
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

    renderable.setVisible(false);

    expect(pause).toHaveBeenCalledTimes(1);
    expect(sceneAdapter.objects[0]?.visible).toBeUndefined();

    renderable.dispose();
    renderable.dispose();

    expect(pause).toHaveBeenCalledTimes(2);
    expect(renderable.status).toBe("disposed");
    expect(resourceManager.inspect("video:element-1:/assets/hero.mp4")).toBeUndefined();
  });

  test("keeps fallback visible when the video resource fails", async () => {
    const source = createVideoDescriptor("/assets/missing.mp4");
    const descriptor = createTargetDescriptor(
      source.element,
      { key: "hero.video" },
      0,
    );
    const resourceManager = createResourceManager();
    const error = new Error("video load failed");
    const sceneAdapter = createSceneAdapter();
    const renderable = createVideoRenderable(
      {
        descriptor,
        source,
        role: "media",
        policy: compileRenderPolicy("media"),
      },
      {
        resourceManager,
        loadVideo: async () => Promise.reject(error),
        sceneAdapter,
        measureElement: () => createMeasurement(0, 0, 100, 50),
      },
    );

    await expect(renderable.update()).rejects.toThrow("video load failed");

    expect(renderable.status).toBe("error");
    expect(renderable.fallbackVisible).toBe(true);
    expect(renderable.resourceReady).toBe(false);
    expect(renderable.hasSceneObject).toBe(false);
    expect(sceneAdapter.objects).toHaveLength(0);
    expect(resourceManager.inspect("video:element-1:/assets/missing.mp4")).toMatchObject({
      status: "error",
      error,
    });
  });

  test("keeps fallback visible when the adopted DOM video has an error", async () => {
    const source = createVideoDescriptor("/assets/broken.mp4");
    const descriptor = createTargetDescriptor(
      source.element,
      { key: "hero.video" },
      0,
    );
    const resourceManager = createResourceManager();
    Object.defineProperty(source.element, "error", {
      configurable: true,
      value: { code: 4, message: "unsupported source" },
    });
    const sceneAdapter = createSceneAdapter();
    const renderable = createVideoRenderable(
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

    await expect(renderable.update()).rejects.toThrow("unsupported source");

    expect(renderable.status).toBe("error");
    expect(renderable.fallbackVisible).toBe(true);
    expect(renderable.resourceReady).toBe(false);
    expect(sceneAdapter.objects).toHaveLength(0);
    expect(resourceManager.inspect("video:element-1:/assets/broken.mp4")).toMatchObject({
      status: "error",
    });
  });

  test("keeps fallback visible when the adopted DOM video emits an error", async () => {
    const source = createVideoDescriptor("/assets/later-broken.mp4");
    const descriptor = createTargetDescriptor(
      source.element,
      { key: "hero.video" },
      0,
    );
    const resourceManager = createResourceManager();
    const sceneAdapter = createSceneAdapter();
    const renderable = createVideoRenderable(
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

    const update = renderable.update();
    Object.defineProperty(source.element, "error", {
      configurable: true,
      value: { code: 4, message: "network failed" },
    });
    source.element.dispatchEvent(new Event("error"));

    await expect(update).rejects.toThrow("network failed");

    expect(renderable.status).toBe("error");
    expect(renderable.fallbackVisible).toBe(true);
    expect(renderable.resourceReady).toBe(false);
    expect(sceneAdapter.objects).toHaveLength(0);
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
  };
}

function createVideoDescriptor(src: string): WebGLVideoSourceDescriptor {
  const element = document.createElement("video");
  element.src = src;

  return {
    kind: "video",
    element,
    src,
  };
}

function stubPause(element: HTMLVideoElement) {
  const pause = vi.fn();

  Object.defineProperty(element, "pause", {
    configurable: true,
    value: pause,
  });

  return pause;
}
