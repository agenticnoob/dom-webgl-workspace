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
    Object.assign(source.element.style, {
      backgroundColor: "rgb(240, 248, 255)",
      border: "2px solid rgb(12, 34, 56)",
      borderRadius: "18px",
    });
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
      isGroup: true,
      children: [
        {
          isMesh: true,
          geometry: { type: "PlaneGeometry" },
          material: {
            map: {
              isCanvasTexture: true,
            },
          },
        },
        {
          isMesh: true,
          geometry: { type: "PlaneGeometry" },
          material: {
            map: {
              isVideoTexture: true,
              source: { data: source.element },
            },
          },
        },
      ],
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

  test("keeps the video mesh sized to the measured DOM rect for cover media", async () => {
    const source = createVideoDescriptor("/assets/hero.mp4");
    source.element.style.objectFit = "cover";
    Object.defineProperties(source.element, {
      videoWidth: { configurable: true, value: 720 },
      videoHeight: { configurable: true, value: 1280 },
    });
    const descriptor = createTargetDescriptor(
      source.element,
      { key: "hero.video" },
      0,
    );
    const sceneAdapter = createSceneAdapter();
    const renderable = createVideoRenderable(
      {
        descriptor,
        source,
        role: "media",
        policy: compileRenderPolicy("media"),
      },
      {
        resourceManager: createResourceManager(),
        sceneAdapter,
        measureElement: () => createMeasurement(40, 60, 320, 180),
      },
    );

    const update = renderable.update();
    source.element.dispatchEvent(new Event("loadeddata"));
    await update;
    renderable.updateLayout?.(createMeasurement(40, 60, 320, 180));

    const mediaMesh = readMediaMesh(sceneAdapter.objects[0]?.object3D);

    expect(mediaMesh?.scale).toMatchObject({ x: 320, y: 180, z: 1 });
    expect(mediaMesh?.position).toMatchObject({ x: 0, y: 0, z: 1 });
  });

  test("sizes the video mesh to the CSS content box inside padding and border", async () => {
    const source = createVideoDescriptor("/assets/hero.mp4");
    Object.assign(source.element.style, {
      objectFit: "cover",
      padding: "10px 20px 30px 40px",
      border: "2px solid rgb(12, 34, 56)",
    });
    Object.defineProperties(source.element, {
      videoWidth: { configurable: true, value: 720 },
      videoHeight: { configurable: true, value: 1280 },
    });
    const descriptor = createTargetDescriptor(
      source.element,
      { key: "hero.video" },
      0,
    );
    const sceneAdapter = createSceneAdapter();
    const renderable = createVideoRenderable(
      {
        descriptor,
        source,
        role: "media",
        policy: compileRenderPolicy("media"),
      },
      {
        resourceManager: createResourceManager(),
        sceneAdapter,
        measureElement: () => createMeasurement(40, 60, 320, 180),
      },
    );

    const update = renderable.update();
    source.element.dispatchEvent(new Event("loadeddata"));
    await update;
    renderable.updateLayout?.(createMeasurement(40, 60, 320, 180));

    const mediaMesh = readMediaMesh(sceneAdapter.objects[0]?.object3D);

    expect(mediaMesh?.scale).toMatchObject({ x: 256, y: 136, z: 1 });
    expect(mediaMesh?.position).toMatchObject({ x: 10, y: 10, z: 1 });
  });

  test("sizes contained video content inside the CSS content box", async () => {
    const source = createVideoDescriptor("/assets/hero.mp4");
    source.element.style.objectFit = "contain";
    Object.defineProperties(source.element, {
      videoWidth: { configurable: true, value: 720 },
      videoHeight: { configurable: true, value: 1280 },
    });
    const descriptor = createTargetDescriptor(
      source.element,
      { key: "hero.video" },
      0,
    );
    const sceneAdapter = createSceneAdapter();
    const renderable = createVideoRenderable(
      {
        descriptor,
        source,
        role: "media",
        policy: compileRenderPolicy("media"),
      },
      {
        resourceManager: createResourceManager(),
        sceneAdapter,
        measureElement: () => createMeasurement(40, 60, 320, 180),
      },
    );

    const update = renderable.update();
    source.element.dispatchEvent(new Event("loadeddata"));
    await update;
    renderable.updateLayout?.(createMeasurement(40, 60, 320, 180));

    const mediaMesh = readMediaMesh(sceneAdapter.objects[0]?.object3D);

    expect(mediaMesh?.scale).toMatchObject({ x: 101.25, y: 180, z: 1 });
    expect(mediaMesh?.position).toMatchObject({ x: 0, y: 0, z: 1 });
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
    viewport: { width: 800, height: 600 },
    devicePixelRatio: 1,
    layoutSignature: JSON.stringify([left, top, width, height, 800, 600, 1]),
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

function readMediaMesh(object3D: unknown): {
  position: { x: number; y: number; z: number };
  scale: { x: number; y: number; z: number };
} | undefined {
  if (!object3D || typeof object3D !== "object") {
    return undefined;
  }

  const children = (object3D as { children?: unknown }).children;

  if (!Array.isArray(children)) {
    return undefined;
  }

  return children[1] as
    | {
        position: { x: number; y: number; z: number };
        scale: { x: number; y: number; z: number };
      }
    | undefined;
}

function stubPause(element: HTMLVideoElement) {
  const pause = vi.fn();

  Object.defineProperty(element, "pause", {
    configurable: true,
    value: pause,
  });

  return pause;
}
