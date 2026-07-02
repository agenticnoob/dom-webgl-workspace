import type { WebGLEffectSourceHandle } from "./effectAuthoring";
import type {
  WebGLEffectObjectHandle,
  WebGLEffectTextureFacade,
} from "./effectObject";
import { readManagedMaterialFacade } from "./effectManagedMaterialRegistry";

export type WebGLEffectObjectCapabilities = {
  material?: WebGLEffectObjectHandle["material"];
  animation?: WebGLEffectObjectHandle["animation"];
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
        material: readManagedMaterialFacade(source.surface),
        surface: source.surface,
      };
    case "text":
      if (!source.textLayer) {
        return {};
      }

      return {
        material: readManagedMaterialFacade(source.textLayer),
        text: createTextFacade(source, source.textLayer),
      };
  }
}

function createMediaCapabilities(
  source: MediaSourceHandle,
): WebGLEffectObjectCapabilities {
  switch (source.type) {
    case "image":
      return source.image
        ? {
            material: readManagedMaterialFacade(source.image),
            texture: createTextureFacade(source.image, { src: source.src }),
          }
        : {};
    case "video":
      return source.video
        ? {
            material: readManagedMaterialFacade(source.video),
            texture: createTextureFacade(source.video, { src: source.src }),
            video: createVideoFacade(source.video),
          }
        : {};
    case "image-sequence":
      return source.image
        ? {
            material: readManagedMaterialFacade(source.image),
            texture: createTextureFacade(source.image, {
              src: source.src,
              frame: source.frame,
            }),
          }
        : {};
  }
}

function createModelCapabilities(
  source: ModelSourceHandle,
): WebGLEffectObjectCapabilities {
  return {
    animation: source.model.animation,
    get material() {
      return source.model.getMeshes()[0]?.material;
    },
    model: {
      src: source.src,
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

function createTextFacade(
  source: Extract<DOMSourceHandle, { type: "text" }>,
  textLayer: NonNullable<Extract<DOMSourceHandle, { type: "text" }>["textLayer"]>,
): NonNullable<WebGLEffectObjectCapabilities["text"]> {
  return {
    get text() {
      return textLayer.text ?? source.text;
    },
    get style() {
      return textLayer.style;
    },
    get shaderInputs() {
      return textLayer.shaderInputs;
    },
    getGlyphs() {
      return textLayer.getGlyphs();
    },
    setText(text) {
      textLayer.setText(text);
    },
    setGlyphs(transform) {
      textLayer.setGlyphs(transform);
    },
    material: textLayer,
  };
}

function createTextureFacade(
  layer: TextureLayer,
  metadata: { src?: string; frame?: number },
): WebGLEffectTextureFacade {
  return {
    src: metadata.src,
    frame: metadata.frame,
    get shaderInputs() {
      return layer.shaderInputs;
    },
    setTransform(transform) {
      layer.setTextureTransform(transform);
    },
    invalidate() {
      layer.invalidate();
    },
    material: layer,
  };
}

function createVideoFacade(
  video: NonNullable<Extract<MediaSourceHandle, { type: "video" }>["video"]>,
): NonNullable<WebGLEffectObjectCapabilities["video"]> {
  return {
    play() {
      return video.play();
    },
    pause() {
      video.pause();
    },
    setMuted(muted) {
      video.setMuted(muted);
    },
    setPlaybackRate(rate) {
      video.setPlaybackRate(rate);
    },
  };
}
