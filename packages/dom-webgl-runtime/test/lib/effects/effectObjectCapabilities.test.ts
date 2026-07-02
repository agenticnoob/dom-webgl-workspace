import { describe, expect, test } from "vitest";

import { createEffectObjectCapabilities } from "../../../src/lib/effects/effectObjectCapabilities";
import type {
  WebGLEffectCanvasDrawer,
  WebGLEffectCanvasSurfaceHandle,
  WebGLEffectImageSequenceLayerHandle,
  WebGLEffectMaterialLayerHandle,
  WebGLEffectMediaShaderInputs,
  WebGLEffectSourceHandle,
  WebGLEffectSurfaceShaderInputs,
  WebGLEffectTextLayerHandle,
  WebGLEffectTextureLayerHandle,
  WebGLEffectVideoLayerHandle,
  WebGLModelEffectHandle,
  WebGLModelMeshHandle,
} from "../../../src/lib/effects/effectAuthoring";

describe("createEffectObjectCapabilities", () => {
  test("maps dom element surfaces to object.surface", () => {
    const surface = createSurface();
    const source = {
      kind: "dom",
      type: "element",
      element: document.createElement("div"),
      surface,
    } satisfies WebGLEffectSourceHandle;

    expect(createEffectObjectCapabilities(source).surface).toBe(surface);
  });

  test("maps dom text to object.text", () => {
    const glyphCalls: string[] = [];
    const textLayer = createTextLayer("Hello", glyphCalls);
    const source = {
      kind: "dom",
      type: "text",
      element: document.createElement("p"),
      text: "Hello",
      textLayer,
    } satisfies WebGLEffectSourceHandle;

    const text = createEffectObjectCapabilities(source).text;

    expect(text?.text).toBe("Hello");
    expect(text?.getGlyphs()).toEqual([]);
    text?.setText("Updated");
    text?.setGlyphs((glyphs) => glyphs.map((glyph) => ({ index: glyph.index })));
    expect(glyphCalls).toEqual(["setText:Updated", "setGlyphs"]);
  });

  test("maps media image handles to object.texture", () => {
    const calls: string[] = [];
    const image = createImageLayer(calls);
    const source = {
      kind: "media",
      type: "image",
      element: document.createElement("img"),
      src: "/image.png",
      image,
    } satisfies WebGLEffectSourceHandle;

    const texture = createEffectObjectCapabilities(source).texture;

    texture?.setTransform({ repeatX: 2 });
    texture?.invalidate();
    texture?.material.createMaterialLayer({
      key: "image",
      program: { fragmentShader: "void main(){}" },
    });

    expect(calls).toEqual(["transform:2", "invalidate", "material:image"]);
  });

  test("maps media video to object.texture and object.video", () => {
    const calls: string[] = [];
    const video = createVideoLayer(calls);
    const source = {
      kind: "media",
      type: "video",
      element: document.createElement("video"),
      src: "/video.mp4",
      video,
    } satisfies WebGLEffectSourceHandle;

    const capabilities = createEffectObjectCapabilities(source);

    expect(capabilities.video).toBe(video);
    capabilities.texture?.setTransform({ offsetY: 0.5 });
    expect(calls).toEqual(["transform:0.5"]);
  });

  test("maps image sequences to object.texture", () => {
    const calls: string[] = [];
    const image = createImageSequenceLayer(calls);
    const source = {
      kind: "media",
      type: "image-sequence",
      element: document.createElement("div"),
      frame: 3,
      src: "/frames/003.png",
      image,
    } satisfies WebGLEffectSourceHandle;

    createEffectObjectCapabilities(source).texture?.invalidate();

    expect(calls).toEqual(["invalidate"]);
  });

  test("maps model handles to object.model facades", () => {
    const calls: string[] = [];
    const mesh = createMesh("Body");
    const vertices = new Float32Array([1, 2, 3]);
    const pointLayer = createManagedObject();
    const model = createModel(calls, mesh, vertices, pointLayer);
    const source = {
      kind: "model",
      type: "glb",
      anchor: document.createElement("div"),
      src: "/model.glb",
      model,
    } satisfies WebGLEffectSourceHandle;

    const objectModel = createEffectObjectCapabilities(source).model;
    const visited: string[] = [];

    expect(objectModel?.meshes.all()).toEqual([mesh]);
    objectModel?.meshes.forEach((item) => {
      visited.push(item.name ?? "");
    });
    expect(visited).toEqual(["Body"]);
    expect(objectModel?.sampling.vertices({ maxPoints: 3 })).toBe(vertices);
    expect(objectModel?.points.create({ positions: vertices })).toBe(pointLayer);
    expect(calls).toEqual(["all", "forEach", "vertices:3", "points:3"]);
  });
});

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

function createTextLayer(
  text: string,
  calls: string[],
): WebGLEffectTextLayerHandle {
  const style = {
    font: "16px sans-serif",
    lineHeight: 16,
    letterSpacing: 0,
    wordSpacing: 0,
    textAlign: "left",
    color: "#fff",
  } satisfies WebGLEffectTextLayerHandle["style"];

  return {
    ...createSurface(),
    text,
    style,
    shaderInputs: {
      ...createSurfaceShaderInputs(),
      text,
      style,
      glyphs: [],
    },
    getGlyphs() {
      return [];
    },
    setText(nextText) {
      calls.push(`setText:${nextText}`);
    },
    setGlyphs(transform) {
      calls.push("setGlyphs");
      transform([]);
    },
  };
}

function createImageLayer(
  calls: string[],
): WebGLEffectTextureLayerHandle<HTMLImageElement> {
  return createTextureLayer(document.createElement("img"), calls, "repeatX");
}

function createVideoLayer(calls: string[]): WebGLEffectVideoLayerHandle {
  return {
    ...createTextureLayer(document.createElement("video"), calls, "offsetY"),
    play() {},
    pause() {},
    setMuted() {},
    setPlaybackRate() {},
  };
}

function createImageSequenceLayer(
  calls: string[],
): WebGLEffectImageSequenceLayerHandle {
  return {
    source: document.createElement("canvas"),
    shaderInputs: createMediaShaderInputs(),
    setTextureTransform(transform) {
      calls.push(`transform:${transform.repeatX}`);
    },
    invalidate() {
      calls.push("invalidate");
    },
    createMaterialLayer(options) {
      calls.push(`material:${options.key}`);
      return createMaterialLayer();
    },
  };
}

function createTextureLayer<TSource extends HTMLImageElement | HTMLVideoElement>(
  source: TSource,
  calls: string[],
  loggedField: "offsetY" | "repeatX",
): WebGLEffectTextureLayerHandle<TSource> {
  return {
    source,
    shaderInputs: createMediaShaderInputs(),
    setTextureTransform(transform) {
      calls.push(`transform:${transform[loggedField]}`);
    },
    invalidate() {
      calls.push("invalidate");
    },
    createMaterialLayer(options) {
      calls.push(`material:${options.key}`);
      return createMaterialLayer();
    },
  };
}

function createModel(
  calls: string[],
  mesh: WebGLModelMeshHandle,
  vertices: Float32Array,
  pointLayer: ReturnType<typeof createManagedObject>,
): WebGLModelEffectHandle {
  return {
    getMeshes() {
      calls.push("all");
      return [mesh];
    },
    forEachMesh(visitor) {
      calls.push("forEach");
      visitor(mesh);
    },
    sampleVertices(options) {
      calls.push(`vertices:${options?.maxPoints ?? 0}`);
      return vertices;
    },
    createPointLayer(options) {
      calls.push(`points:${options.positions.length}`);
      return pointLayer;
    },
  };
}

function createMesh(name: string): WebGLModelMeshHandle {
  return {
    index: 0,
    name,
    materialName: "Base",
    restoreMaterial() {},
    createMaterialLayer() {
      return createMaterialLayer();
    },
  };
}

function createManagedObject() {
  return {
    setVisible() {},
    remove() {},
    dispose() {},
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

function createMediaShaderInputs(): WebGLEffectMediaShaderInputs {
  return {
    naturalSize: { width: 1, height: 1 },
    contentBox: { x: 0, y: 0, width: 1, height: 1 },
    uvTransform: { repeatX: 1, repeatY: 1, offsetX: 0, offsetY: 0 },
    objectFit: "cover",
    objectPosition: "center",
    sourceTexture: {
      available: false,
      uniform: "source-texture",
      width: 0,
      height: 0,
    },
  };
}
