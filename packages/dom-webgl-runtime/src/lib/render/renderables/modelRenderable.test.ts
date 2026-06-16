import { describe, expect, test, vi } from "vitest";

import { createTargetDescriptor } from "../../dom/targetDescriptor";
import { createResourceManager } from "../../resources/resourceManager";
import type { WebGLModelSourceDescriptor } from "../../source/sourceDescriptor";
import { compileRenderPolicy } from "../renderPolicy";
import { createModelRenderable } from "./modelRenderable";

describe("createModelRenderable", () => {
  test("creates a model renderable and loads a GLB through the adapter resource boundary", async () => {
    const source = createModelDescriptor("/models/hero.glb");
    const descriptor = createTargetDescriptor(
      source.anchor,
      { key: "hero.model" },
      0,
    );
    const resourceManager = createResourceManager();
    const model = { scene: {} };
    const loadModel = vi.fn(async () => model);

    const renderable = createModelRenderable(
      {
        descriptor,
        source,
        role: "model",
        policy: compileRenderPolicy("model"),
      },
      { resourceManager, loadModel },
    );

    expect(renderable.key).toBe("hero.model");
    expect(renderable.role).toBe("model");
    expect(renderable.policy).toEqual(compileRenderPolicy("model"));
    expect(renderable.fallbackVisible).toBe(true);
    expect(renderable.resourceReady).toBe(false);

    await renderable.update();

    expect(loadModel).toHaveBeenCalledTimes(1);
    expect(loadModel).toHaveBeenCalledWith(source);
    expect(renderable.status).toBe("ready");
    expect(renderable.fallbackVisible).toBe(false);
    expect(renderable.resourceReady).toBe(true);
    expect(resourceManager.inspect("model:glb:/models/hero.glb")).toMatchObject({
      kind: "model/glb",
      status: "ready",
      value: model,
    });
  });

  test("keeps fallback visible when the model loader fails", async () => {
    const source = createModelDescriptor("/models/missing.glb");
    const descriptor = createTargetDescriptor(
      source.anchor,
      { key: "hero.model" },
      0,
    );
    const resourceManager = createResourceManager();
    const error = new Error("model load failed");
    const renderable = createModelRenderable(
      {
        descriptor,
        source,
        role: "model",
        policy: compileRenderPolicy("model"),
      },
      {
        resourceManager,
        loadModel: async () => Promise.reject(error),
      },
    );

    await expect(renderable.update()).rejects.toThrow("model load failed");

    expect(renderable.status).toBe("error");
    expect(renderable.fallbackVisible).toBe(true);
    expect(renderable.resourceReady).toBe(false);
    expect(resourceManager.inspect("model:glb:/models/missing.glb")).toMatchObject(
      {
        kind: "model/glb",
        status: "error",
        error,
      },
    );
  });
});

function createModelDescriptor(src: string): WebGLModelSourceDescriptor {
  const anchor = document.createElement("div");

  return {
    kind: "model",
    format: "glb",
    anchor,
    src,
  };
}
