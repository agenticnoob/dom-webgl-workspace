import { afterEach, describe, expect, test, vi } from "vitest";

import { createTargetDescriptor } from "../../dom/targetDescriptor";
import { createResourceManager } from "../../resources/resourceManager";
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

    const renderable = createVideoRenderable(
      {
        descriptor,
        source,
        role: "media",
        policy: compileRenderPolicy("media"),
      },
      { resourceManager },
    );

    expect(renderable.key).toBe("hero.video");
    expect(renderable.role).toBe("media");
    expect(renderable.policy).toEqual(compileRenderPolicy("media"));
    expect(renderable.fallbackVisible).toBe(true);
    expect(renderable.resourceReady).toBe(false);

    const update = renderable.update();
    source.element.dispatchEvent(new Event("loadeddata"));
    await update;

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(createElementSpy).not.toHaveBeenCalledWith("video");
    expect(renderable.status).toBe("ready");
    expect(renderable.fallbackVisible).toBe(false);
    expect(renderable.resourceReady).toBe(true);
    expect(resourceManager.inspect("video:element-1:/assets/hero.mp4")).toMatchObject({
      kind: "video",
      status: "ready",
      element: source.element,
      value: source.element,
    });
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
    const renderable = createVideoRenderable(
      {
        descriptor,
        source,
        role: "media",
        policy: compileRenderPolicy("media"),
      },
      { resourceManager },
    );

    renderable.setVisible(false);

    expect(pause).toHaveBeenCalledTimes(1);

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
      },
    );

    await expect(renderable.update()).rejects.toThrow("video load failed");

    expect(renderable.status).toBe("error");
    expect(renderable.fallbackVisible).toBe(true);
    expect(renderable.resourceReady).toBe(false);
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
    const renderable = createVideoRenderable(
      {
        descriptor,
        source,
        role: "media",
        policy: compileRenderPolicy("media"),
      },
      { resourceManager },
    );

    await expect(renderable.update()).rejects.toThrow("unsupported source");

    expect(renderable.status).toBe("error");
    expect(renderable.fallbackVisible).toBe(true);
    expect(renderable.resourceReady).toBe(false);
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
    const renderable = createVideoRenderable(
      {
        descriptor,
        source,
        role: "media",
        policy: compileRenderPolicy("media"),
      },
      { resourceManager },
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
  });
});

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
