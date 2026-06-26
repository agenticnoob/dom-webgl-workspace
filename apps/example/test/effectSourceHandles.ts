import { vi } from "vitest";

import type {
  WebGLEffectCanvasSurfaceHandle,
  WebGLEffectSourceHandle,
  WebGLEffectTextLayerHandle,
  WebGLEffectTextureLayerHandle,
  WebGLEffectVideoLayerHandle,
  WebGLModelEffectHandle,
} from "@project/dom-webgl-runtime";

export type TestEffectSource =
  | {
      kind: "snapshot/element";
      element: HTMLElement;
      surface?: Partial<WebGLEffectCanvasSurfaceHandle>;
    }
  | {
      kind: "snapshot/text";
      element: HTMLElement;
      text: string;
      textLayer?: Partial<WebGLEffectTextLayerHandle>;
    }
  | {
      kind: "image";
      element: HTMLImageElement;
      src: string;
      image?: Partial<WebGLEffectTextureLayerHandle<HTMLImageElement>>;
    }
  | {
      kind: "video";
      element: HTMLVideoElement;
      src: string;
      video?: Partial<WebGLEffectVideoLayerHandle>;
    }
  | {
      kind: "model/glb";
      anchor: HTMLElement;
      src: string;
      model: Partial<WebGLModelEffectHandle>;
    };

export function createEffectSource(
  source: TestEffectSource | undefined,
): WebGLEffectSourceHandle {
  if (source === undefined) {
    return {
      kind: "snapshot/element",
      element: document.createElement("section"),
      surface: createCanvasSurface(),
    };
  }

  switch (source.kind) {
    case "snapshot/element":
      return {
        kind: "snapshot/element",
        element: source.element,
        surface:
          source.surface === undefined
            ? undefined
            : createCanvasSurface(source.surface),
      };
    case "snapshot/text":
      return {
        kind: "snapshot/text",
        element: source.element,
        text: source.text,
        textLayer:
          source.textLayer === undefined
            ? undefined
            : createTextLayer(source.text, source.textLayer),
      };
    case "image":
      return {
        kind: "image",
        element: source.element,
        src: source.src,
        image:
          source.image === undefined
            ? undefined
            : createTextureLayer(source.element, source.image),
      };
    case "video":
      return {
        kind: "video",
        element: source.element,
        src: source.src,
        video:
          source.video === undefined
            ? undefined
            : createVideoLayer(source.element, source.video),
      };
    case "model/glb":
      return {
        kind: "model/glb",
        anchor: source.anchor,
        src: source.src,
        model: createModelHandle(source.model),
      };
  }
}

function createCanvasSurface(
  overrides: Partial<WebGLEffectCanvasSurfaceHandle> = {},
): WebGLEffectCanvasSurfaceHandle {
  const canvas = document.createElement("canvas");

  return {
    object3D: {},
    canvas,
    context: null,
    texture: {},
    mesh: {},
    material: {},
    clear: vi.fn(),
    draw: vi.fn(),
    invalidate: vi.fn(),
    getSize: () => ({ width: 120, height: 60, devicePixelRatio: 1 }),
    ...overrides,
  };
}

function createTextLayer(
  text: string,
  overrides: Partial<WebGLEffectTextLayerHandle>,
): WebGLEffectTextLayerHandle {
  return {
    ...createCanvasSurface(overrides),
    text,
    style: {
      font: "16px sans-serif",
      lineHeight: 20,
      letterSpacing: 0,
      wordSpacing: 0,
      textAlign: "start",
      color: "#000000",
    },
    getGlyphs: () => [],
    setText: vi.fn(),
    setGlyphs: vi.fn(),
    ...overrides,
  };
}

function createTextureLayer<TSource extends HTMLImageElement | HTMLVideoElement>(
  source: TSource,
  overrides: Partial<WebGLEffectTextureLayerHandle<TSource>> = {},
): WebGLEffectTextureLayerHandle<TSource> {
  return {
    object3D: {},
    source,
    texture: {},
    mesh: {},
    material: {},
    setTextureTransform: vi.fn(),
    invalidate: vi.fn(),
    ...overrides,
  };
}

function createVideoLayer(
  source: HTMLVideoElement,
  overrides: Partial<WebGLEffectVideoLayerHandle> = {},
): WebGLEffectVideoLayerHandle {
  return {
    ...createTextureLayer(source, overrides),
    play: vi.fn(),
    pause: vi.fn(),
    setMuted: vi.fn(),
    setPlaybackRate: vi.fn(),
    ...overrides,
  };
}

function createModelHandle(
  overrides: Partial<WebGLModelEffectHandle>,
): WebGLModelEffectHandle {
  return {
    object3D: {},
    traverseMeshes: vi.fn(),
    sampleVertices: vi.fn(() => new Float32Array()),
    createPointCloud: vi.fn(() => ({})),
    ...overrides,
  };
}
