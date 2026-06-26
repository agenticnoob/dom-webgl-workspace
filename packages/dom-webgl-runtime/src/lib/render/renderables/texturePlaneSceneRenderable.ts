import { Group } from "three/src/objects/Group.js";
import { Mesh } from "three/src/objects/Mesh.js";
import { PlaneGeometry } from "three/src/geometries/PlaneGeometry.js";
import { MeshBasicMaterial } from "three/src/materials/MeshBasicMaterial.js";
import { Texture } from "three/src/textures/Texture.js";
import { VideoTexture } from "three/src/textures/VideoTexture.js";

import { readDOMStyleSnapshot } from "../../dom/styleSnapshot";
import {
  projectDOMRectToSceneLayout,
  type ProjectedDOMRect,
} from "../../renderer/domProjection";
import type { ElementLayoutSnapshot } from "../../renderer/layoutPass";
import type {
  WebGLEffectMediaShaderInputs,
  WebGLEffectTextureTransform,
} from "../../effects/effectAuthoring";
import {
  computeObjectFitContentBox,
  computeObjectFitTextureTransform,
} from "./objectFit";
import {
  createTextureLayerCapabilityHandle,
  createVideoLayerCapabilityHandle,
} from "./sourceCapabilityHandles";
import {
  applyDOMActivityVisibility,
  createSceneRenderableController,
  defaultViewport,
  setVector3,
  updateObject3DLayout,
  type ElementMeasurement,
  type SceneRenderableController,
  type SceneRenderableControllerOptions,
} from "./sceneRenderableController";

export function createTexturePlaneSceneRenderableController(
  options: Omit<SceneRenderableControllerOptions, "object3D" | "disposeResources"> & {
    textureKind: "image" | "video";
    textureSource: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement | ImageBitmap;
  },
): SceneRenderableController {
  let currentTextureSource = options.textureSource;
  const texture =
    options.textureKind === "video"
      ? new VideoTexture(options.textureSource as HTMLVideoElement)
      : new Texture(options.textureSource);
  const mediaGeometry = new PlaneGeometry(1, 1);
  const material = new MeshBasicMaterial({
    map: texture,
    transparent: true,
  });
  const mediaMesh = new Mesh(mediaGeometry, material);
  const group = new Group();
  const initialStyle = readDOMStyleSnapshot(options.element);
  let lastTextureTransformSignature = "";
  let textureLayerTransform: WebGLEffectTextureTransform | undefined;
  let shaderInputs: WebGLEffectMediaShaderInputs | undefined;

  group.add(mediaMesh);
  texture.needsUpdate = true;
  const controller = createSceneRenderableController({
    ...options,
    object3D: group,
    disposeResources() {
      texture.dispose();
      mediaGeometry.dispose();
      material.dispose();
    },
    layoutObject3D(object3D, layout) {
      updateMediaGroupLayout(object3D, layout);
    },
  });

  const updateTextureTransform = (
    measurement: ElementMeasurement,
    force = false,
  ) => {
    const mediaSize = readMediaSize(currentTextureSource);
    const textureGeometrySignature = JSON.stringify([
      measurement.width,
      measurement.height,
      mediaSize.width,
      mediaSize.height,
    ]);

    if (!force && textureGeometrySignature === lastTextureTransformSignature) {
      return;
    }

    const mediaBox = computeMediaContentArea(measurement, initialStyle);
    const box = { width: mediaBox.width, height: mediaBox.height };
    const transform = computeObjectFitTextureTransform({
      fit: initialStyle.media.objectFit,
      position: initialStyle.media.objectPosition,
      box,
      media: mediaSize,
    });
    const contentBox = computeObjectFitContentBox({
      fit: initialStyle.media.objectFit,
      position: initialStyle.media.objectPosition,
      box,
      media: mediaSize,
    });
    shaderInputs = {
      naturalSize: mediaSize,
      contentBox: {
        x: mediaBox.x,
        y: mediaBox.y,
        width: mediaBox.width,
        height: mediaBox.height,
      },
      uvTransform: transform,
      objectFit: initialStyle.media.objectFit,
      objectPosition: initialStyle.media.objectPosition,
      sourceTexture: {
        available: true,
        uniform: "source-texture",
        width: mediaSize.width,
        height: mediaSize.height,
      },
    };

    lastTextureTransformSignature = textureGeometrySignature;
    applyTextureTransform(texture, transform);
    applyTextureLayerTransform();
    applyMediaContentBox(mediaMesh, mediaBox, contentBox);
    applyDOMActivityVisibility(group, initialStyle);
    applyDOMActivityVisibility(mediaMesh, initialStyle);
  };
  controller.object.updateTextLayout = (measurement) => {
    updateTextureTransform(measurement);
  };
  controller.object.invalidateContent = () => {
    lastTextureTransformSignature = "";
  };
  controller.object.updateTextureSource = (nextSource) => {
    currentTextureSource = nextSource;
    controller.object.textureSource = nextSource;
    texture.image = nextSource;
    texture.needsUpdate = true;
    lastTextureTransformSignature = "";
  };
  if (options.textureKind === "video") {
    controller.object.videoLayerCapability = createVideoLayerCapabilityHandle({
      object3D: group,
      mesh: mediaMesh,
      material,
      texture,
      source: options.textureSource as HTMLVideoElement,
      setTextureTransform(transform) {
        textureLayerTransform = transform;
        applyTextureLayerTransform();
      },
      getShaderInputs() {
        return shaderInputs ?? createFallbackShaderInputs(currentTextureSource);
      },
      invalidate() {
        controller.object.invalidateContent?.();
      },
    });
  } else {
    controller.object.textureLayerCapability = createTextureLayerCapabilityHandle({
      object3D: group,
      mesh: mediaMesh,
      material,
      texture,
      source: options.textureSource as HTMLImageElement,
      setTextureTransform(transform) {
        textureLayerTransform = transform;
        applyTextureLayerTransform();
      },
      getShaderInputs() {
        return shaderInputs ?? createFallbackShaderInputs(currentTextureSource);
      },
      invalidate() {
        controller.object.invalidateContent?.();
      },
    });
  }
  updateTextureTransform(options.measureElement(options.element), true);

  return controller;

  function applyTextureLayerTransform(): void {
    if (!textureLayerTransform) {
      return;
    }

    applyTextureTransform(texture, {
      repeatX: textureLayerTransform.repeatX ?? 1,
      repeatY: textureLayerTransform.repeatY ?? 1,
      offsetX: textureLayerTransform.offsetX ?? 0,
      offsetY: textureLayerTransform.offsetY ?? 0,
    });
  }
}

function createFallbackShaderInputs(
  source: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement | ImageBitmap,
): WebGLEffectMediaShaderInputs {
  const naturalSize = readMediaSize(source);
  const style = "style" in source ? source.style : undefined;

  return {
    naturalSize,
    contentBox: { x: 0, y: 0, width: naturalSize.width, height: naturalSize.height },
    uvTransform: { repeatX: 1, repeatY: 1, offsetX: 0, offsetY: 0 },
    objectFit: style?.objectFit || "fill",
    objectPosition: style?.objectPosition || "50% 50%",
    sourceTexture: {
      available: true,
      uniform: "source-texture",
      width: naturalSize.width,
      height: naturalSize.height,
    },
  };
}

function readMediaSize(
  source: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement | ImageBitmap,
): {
  width: number;
  height: number;
} {
  if ("naturalWidth" in source && source.naturalWidth && source.naturalHeight) {
    return { width: source.naturalWidth, height: source.naturalHeight };
  }

  if ("videoWidth" in source && source.videoWidth && source.videoHeight) {
    return { width: source.videoWidth, height: source.videoHeight };
  }

  if ("width" in source && "height" in source && source.width && source.height) {
    return { width: source.width, height: source.height };
  }

  return {
    width: 1,
    height: 1,
  };
}

function applyTextureTransform(
  texture: Texture | VideoTexture,
  transform: ReturnType<typeof computeObjectFitTextureTransform>,
): void {
  setTextureVector(texture.repeat, transform.repeatX, transform.repeatY);
  setTextureVector(texture.offset, transform.offsetX, transform.offsetY);
  texture.needsUpdate = true;
}

function updateMediaGroupLayout(
  object3D: unknown,
  layout: ProjectedDOMRect,
): void {
  if (!object3D || typeof object3D !== "object") {
    return;
  }

  setVector3((object3D as { position?: unknown }).position, layout.x, layout.y, 0);
  setVector3((object3D as { scale?: unknown }).scale, 1, 1, 1);
}

function computeMediaContentArea(
  measurement: ElementMeasurement,
  style: ReturnType<typeof readDOMStyleSnapshot>,
): {
  width: number;
  height: number;
  x: number;
  y: number;
} {
  const leftInset = style.box.borderLeftWidth + style.box.paddingLeft;
  const rightInset = style.box.borderRightWidth + style.box.paddingRight;
  const topInset = style.box.borderTopWidth + style.box.paddingTop;
  const bottomInset = style.box.borderBottomWidth + style.box.paddingBottom;
  const width = Math.max(1, measurement.width - leftInset - rightInset);
  const height = Math.max(1, measurement.height - topInset - bottomInset);

  return {
    width,
    height,
    x: -measurement.width / 2 + leftInset + width / 2,
    y: measurement.height / 2 - topInset - height / 2,
  };
}

function applyMediaContentBox(
  object3D: unknown,
  mediaBox: ReturnType<typeof computeMediaContentArea>,
  contentBox: ReturnType<typeof computeObjectFitContentBox>,
): void {
  const x =
    mediaBox.x -
    mediaBox.width / 2 +
    contentBox.offsetX +
    contentBox.width / 2;
  const y =
    mediaBox.y +
    mediaBox.height / 2 -
    contentBox.offsetY -
    contentBox.height / 2;

  setVector3((object3D as { position?: unknown }).position, x, y, 1);
  setVector3(
    (object3D as { scale?: unknown }).scale,
    contentBox.width,
    contentBox.height,
    1,
  );
}

function applyObjectFitContentBox(
  object3D: unknown,
  layout: ElementLayoutSnapshot,
  contentBox: ReturnType<typeof computeObjectFitContentBox>,
): void {
  const viewport = layout.viewport ?? defaultViewport;
  const fullLayout = projectDOMRectToSceneLayout(layout, viewport);
  const x =
    fullLayout.x -
    layout.width / 2 +
    contentBox.offsetX +
    contentBox.width / 2;
  const y =
    fullLayout.y +
    layout.height / 2 -
    contentBox.offsetY -
    contentBox.height / 2;

  updateObject3DLayout(object3D, {
    x,
    y,
    width: contentBox.width,
    height: contentBox.height,
  });
}

function setTextureVector(vector: unknown, x: number, y: number): void {
  if (vector && typeof vector === "object" && "set" in vector) {
    const set = (vector as { set?: unknown }).set;

    if (typeof set === "function") {
      set.call(vector, x, y);
      return;
    }
  }

  if (vector && typeof vector === "object") {
    Object.assign(vector, { x, y });
  }
}
