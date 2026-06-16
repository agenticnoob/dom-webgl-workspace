import { afterEach, describe, expect, test, vi } from "vitest";

import { createTargetDescriptor } from "../../dom/targetDescriptor";
import { createResourceManager } from "../../resources/resourceManager";
import type { WebGLImageSourceDescriptor } from "../../source/sourceDescriptor";
import { compileRenderPolicy } from "../renderPolicy";
import { createImageRenderable } from "./imageRenderable";

describe("createImageRenderable", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("creates a media renderable and loads the existing DOM image resource", async () => {
    const source = createImageDescriptor("/assets/hero.png");
    const descriptor = createTargetDescriptor(
      source.element,
      { key: "hero.image" },
      0,
    );
    const resourceManager = createResourceManager();
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const decode = stubDecode(source.element);

    const renderable = createImageRenderable(
      {
        descriptor,
        source,
        role: "media",
        policy: compileRenderPolicy("media"),
      },
      { resourceManager },
    );

    expect(renderable.key).toBe("hero.image");
    expect(renderable.role).toBe("media");
    expect(renderable.policy).toEqual(compileRenderPolicy("media"));
    expect(renderable.fallbackVisible).toBe(true);

    await renderable.update();

    expect(decode).toHaveBeenCalledTimes(1);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(renderable.status).toBe("ready");
    expect(renderable.fallbackVisible).toBe(false);
    expect(resourceManager.inspect("image:element-1:/assets/hero.png")).toMatchObject({
      kind: "image",
      status: "ready",
      element: source.element,
      value: source.element,
    });
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
    const renderable = createImageRenderable(
      {
        descriptor,
        source,
        role: "media",
        policy: compileRenderPolicy("media"),
      },
      { resourceManager },
    );

    await expect(renderable.update()).rejects.toThrow("decode failed");

    expect(renderable.status).toBe("error");
    expect(renderable.fallbackVisible).toBe(true);
    expect(resourceManager.inspect("image:element-1:/assets/missing.png")).toMatchObject({
      status: "error",
      error,
    });
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
      { resourceManager },
    );
    const second = createImageRenderable(
      {
        descriptor,
        source,
        role: "media",
        policy: compileRenderPolicy("media"),
      },
      { resourceManager },
    );

    const firstUpdate = first.update();
    const secondUpdate = second.update();

    expect(decode).toHaveBeenCalledTimes(1);

    resolveDecode();
    await Promise.all([firstUpdate, secondUpdate]);

    expect(first.status).toBe("ready");
    expect(second.status).toBe("ready");
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
