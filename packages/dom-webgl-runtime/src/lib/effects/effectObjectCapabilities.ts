import type { WebGLEffectSourceHandle } from "./effectAuthoring";
import type {
  WebGLEffectObjectHandle,
  WebGLEffectTextureFacade,
} from "./effectObject";

export type WebGLEffectObjectCapabilities = {
  surface?: WebGLEffectObjectHandle["surface"];
  text?: WebGLEffectObjectHandle["text"];
  texture?: WebGLEffectObjectHandle["texture"];
  video?: WebGLEffectObjectHandle["video"];
  model?: WebGLEffectObjectHandle["model"];
};

type DOMSourceHandle = Extract<WebGLEffectSourceHandle, { kind: "dom" }>;
type MediaSourceHandle = Extract<WebGLEffectSourceHandle, { kind: "media" }>;
type ModelSourceHandle = Extract<WebGLEffectSourceHandle, { kind: "model" }>;
type TextureLayer =
  | NonNullable<Extract<MediaSourceHandle, { type: "image" }>["image"]>
  | NonNullable<Extract<MediaSourceHandle, { type: "video" }>["video"]>
  | NonNullable<
      Extract<MediaSourceHandle, { type: "image-sequence" }>["image"]
    >;

export function createEffectObjectCapabilities(
  source: WebGLEffectSourceHandle,
): WebGLEffectObjectCapabilities {
  switch (source.kind) {
    case "dom":
      return createDOMCapabilities(source);
    case "media":
      return createMediaCapabilities(source);
    case "model":
      return createModelCapabilities(source);
  }
}

function createDOMCapabilities(
  source: DOMSourceHandle,
): WebGLEffectObjectCapabilities {
  switch (source.type) {
    case "element":
      return {
        surface: source.surface,
      };
    case "text":
      if (!source.textLayer) {
        return {};
      }

      return {
        text: {
          get text() {
            return source.textLayer?.text ?? source.text;
          },
          getGlyphs() {
            return source.textLayer?.getGlyphs() ?? [];
          },
          setText(text) {
            source.textLayer?.setText(text);
          },
          setGlyphs(transform) {
            source.textLayer?.setGlyphs(transform);
          },
          material: source.textLayer,
        },
      };
  }
}

function createMediaCapabilities(
  source: MediaSourceHandle,
): WebGLEffectObjectCapabilities {
  switch (source.type) {
    case "image":
      return source.image ? { texture: createTextureFacade(source.image) } : {};
    case "video":
      return source.video
        ? {
            texture: createTextureFacade(source.video),
            video: source.video,
          }
        : {};
    case "image-sequence":
      return source.image ? { texture: createTextureFacade(source.image) } : {};
  }
}

function createModelCapabilities(
  source: ModelSourceHandle,
): WebGLEffectObjectCapabilities {
  return {
    model: {
      meshes: {
        all() {
          return source.model.getMeshes();
        },
        forEach(visitor) {
          source.model.forEachMesh(visitor);
        },
      },
      sampling: {
        vertices(options) {
          return source.model.sampleVertices(options);
        },
      },
      points: {
        create(options) {
          return source.model.createPointLayer(options);
        },
      },
    },
  };
}

function createTextureFacade(layer: TextureLayer): WebGLEffectTextureFacade {
  return {
    setTransform(transform) {
      layer.setTextureTransform(transform);
    },
    invalidate() {
      layer.invalidate();
    },
    material: layer,
  };
}
