import { describe, expect, test } from "vitest";

import { createWebGLEffectObject } from "../../../src/lib/effects/effectObjectContext";
import { createWebGLEffectResourceScope } from "../../../src/lib/effects/effectResources";
import type {
  WebGLEffectCanvasDrawer,
  WebGLEffectCanvasSurfaceHandle,
  WebGLEffectMaterialLayerHandle,
  WebGLEffectSourceHandle,
  WebGLEffectSurfaceShaderInputs,
  WebGLEffectTargetHandle,
  WebGLEffectVisualContext,
} from "../../../src/lib/effects/effectAuthoring";

describe("createWebGLEffectObject", () => {
  test("creates a controlled object facade with transform and postprocess", () => {
    const targetCalls: string[] = [];
    const postprocessCalls: string[] = [];
    const source = {
      kind: "dom",
      type: "element",
      element: document.createElement("div"),
    } satisfies WebGLEffectSourceHandle;

    const object = createWebGLEffectObject({
      sourceKind: "dom/element",
      source,
      target: createTarget(targetCalls),
      resources: createWebGLEffectResourceScope(),
      visual: createVisual(postprocessCalls),
    });

    object.position.set(4, 5, 6);
    object.postprocess.request({ key: "soft", grain: { amount: 0.1 } });

    expect(object.sourceKind).toBe("dom/element");
    expect(targetCalls).toEqual(["position:4,5,6"]);
    expect(postprocessCalls).toEqual(["soft"]);
  });

  test("merges source capabilities into the controlled object facade", () => {
    const surface = createSurface();
    const source = {
      kind: "dom",
      type: "element",
      element: document.createElement("div"),
      surface,
    } satisfies WebGLEffectSourceHandle;

    const object = createWebGLEffectObject({
      sourceKind: "dom/element",
      source,
      resources: createWebGLEffectResourceScope(),
      visual: createVisual([]),
    });

    expect(object.surface).toBe(surface);
  });

  test("exposes injected managed lights facade", () => {
    const lightCalls: string[] = [];
    const lights = {
      ambient(key: string) {
        lightCalls.push(`ambient:${key}`);
        return createManagedObjectHandle();
      },
      directional(key: string) {
        lightCalls.push(`directional:${key}`);
        return createManagedObjectHandle();
      },
      point(key: string) {
        lightCalls.push(`point:${key}`);
        return createManagedObjectHandle();
      },
      remove(key: string) {
        lightCalls.push(`remove:${key}`);
      },
    };
    const resources = createWebGLEffectResourceScope();
    const source = {
      kind: "dom",
      type: "element",
      element: document.createElement("div"),
    } satisfies WebGLEffectSourceHandle;
    const object = createWebGLEffectObject({
      sourceKind: "dom/element",
      source,
      resources,
      visual: createVisual([]),
      lights,
    });

    object.position.set(12, 24, 0);
    object.lights?.point("glow", {
      color: "#7dd3fc",
      intensity: 2,
      follow: "object",
    });
    object.lights?.remove("glow");

    expect(lightCalls).toEqual(["point:glow", "remove:glow"]);
  });
});

function createTarget(calls: string[]): WebGLEffectTargetHandle {
  return {
    setVisible() {},
    setPosition(x, y, z = 0) {
      calls.push(`position:${x},${y},${z}`);
    },
    setRotation() {},
    setScale() {},
    setOpacity() {},
  };
}

function createVisual(calls: string[]): WebGLEffectVisualContext {
  return {
    requestPostprocess(request) {
      calls.push(request.key);
      return {
        update() {},
        dispose() {},
      };
    },
  };
}

function createManagedObjectHandle() {
  return {
    setVisible() {},
    remove() {},
    dispose() {},
  };
}

function createSurface(): WebGLEffectCanvasSurfaceHandle {
  return {
    canvas: document.createElement("canvas"),
    context: null,
    shaderInputs: createSurfaceShaderInputs(),
    clear() {},
    draw(_drawer: WebGLEffectCanvasDrawer) {},
    invalidate() {},
    getSize() {
      return { width: 1, height: 1, devicePixelRatio: 1 };
    },
    createMaterialLayer() {
      return createMaterialLayer();
    },
  };
}

function createMaterialLayer(): WebGLEffectMaterialLayerHandle {
  return {
    setProgram() {},
    setUniforms() {},
    clear() {},
    dispose() {},
  };
}

function createSurfaceShaderInputs(): WebGLEffectSurfaceShaderInputs {
  return {
    size: { width: 1, height: 1, devicePixelRatio: 1 },
    contentBox: { x: 0, y: 0, width: 1, height: 1 },
    sourceTexture: {
      available: false,
      uniform: "source-texture",
      width: 0,
      height: 0,
    },
  };
}
