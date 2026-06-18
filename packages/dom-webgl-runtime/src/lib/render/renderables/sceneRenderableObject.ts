import {
  projectDOMRectToSceneLayout,
  type DOMViewportSize,
} from "../../renderer/domProjection";
import {
  createSceneObjectController,
  type WebGLSceneAdapter,
  type WebGLSceneObject,
  type WebGLSceneObjectController,
  type WebGLSceneObjectOrdering,
} from "../../renderer/sceneObject";
import { PlaneGeometry } from "three/src/geometries/PlaneGeometry.js";
import { MeshBasicMaterial } from "three/src/materials/MeshBasicMaterial.js";
import { Mesh } from "three/src/objects/Mesh.js";
import { CanvasTexture } from "three/src/textures/CanvasTexture.js";
import { Texture } from "three/src/textures/Texture.js";
import { VideoTexture } from "three/src/textures/VideoTexture.js";

import { readDOMStyleSnapshot } from "../../dom/styleSnapshot";
import type { ElementLayoutSnapshot } from "../../renderer/layoutPass";
import {
  createCSSBoxCanvasSignature,
  drawCSSBoxToCanvas,
} from "./cssBoxCanvas";
import {
  computeObjectFitContentBox,
  computeObjectFitTextureTransform,
} from "./objectFit";
import {
  createTextCanvasRenderSignature,
  drawTextToCanvas,
  readTextCanvasRenderState,
  type TextCanvasRenderState,
} from "./textCanvasLayout";

type ElementMeasurement = {
  x: number;
  y: number;
  width: number;
  height: number;
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type SceneRenderableObject = WebGLSceneObject & {
  visible: boolean;
  disposed: boolean;
  lastLayout?: ReturnType<typeof projectDOMRectToSceneLayout>;
  textContent?: string;
  textureSource?: unknown;
  updateTextContent?(textContent: string): void;
  updateTextLayout?(measurement: ElementMeasurement): void;
  invalidateContent?(): void;
};

export type SceneRenderableControllerOptions = {
  key: string;
  sceneAdapter: WebGLSceneAdapter;
  measureElement(element: HTMLElement): ElementMeasurement;
  getViewportSize?(): DOMViewportSize;
  element: HTMLElement;
  object3D?: unknown;
  ordering?: WebGLSceneObjectOrdering;
  textContent?: string;
  textureSource?: unknown;
  disposeObject3D?: boolean;
  disposeResources?(): void;
};

export type SceneRenderableController = {
  readonly object: SceneRenderableObject;
  readonly controller: WebGLSceneObjectController;
  updateLayout(measurement?: ElementMeasurement): void;
  updateTextContent(textContent: string): void;
  attach(): void;
};

const defaultViewport = {
  width: 800,
  height: 600,
};

export function createSceneRenderableController(
  options: SceneRenderableControllerOptions,
): SceneRenderableController {
  const object: SceneRenderableObject = {
    key: options.key,
    object3D: options.object3D,
    visible: true,
    disposed: false,
    textContent: options.textContent,
    textureSource: options.textureSource,
    setVisible(visible) {
      object.visible = visible;
      setObject3DVisible(options.object3D, visible);
    },
    updateLayout(layout) {
      object.lastLayout = layout;
      updateObject3DLayout(options.object3D, layout);
    },
    dispose() {
      object.disposed = true;
      options.disposeResources?.();

      if (options.disposeObject3D) {
        disposeObject3D(options.object3D);
      }
    },
  };
  const controller = createSceneObjectController(
    options.sceneAdapter,
    object,
    options.ordering,
  );

  return {
    object,
    controller,
    updateLayout(measurement = options.measureElement(options.element)): void {
      controller.updateLayout(
        projectDOMRectToSceneLayout(
          measurement,
          options.getViewportSize?.() ?? defaultViewport,
        ),
      );
      object.updateTextLayout?.(measurement);
    },
    updateTextContent(textContent): void {
      object.textContent = textContent;
      object.updateTextContent?.(textContent);
    },
    attach(): void {
      controller.attach();
    },
  };
}

export function createElementPlaneSceneRenderableController(
  options: Omit<SceneRenderableControllerOptions, "object3D" | "disposeResources">,
): SceneRenderableController {
  const canvas = options.element.ownerDocument.createElement("canvas");
  const texture = new CanvasTexture(canvas);
  const geometry = new PlaneGeometry(1, 1);
  const material = new MeshBasicMaterial({
    map: texture,
    transparent: true,
  });
  const mesh = new Mesh(geometry, material);
  let lastLayout: ElementLayoutSnapshot | undefined;
  let lastRenderSignature = "";
  let lastRasterGeometrySignature = "";

  const controller = createSceneRenderableController({
    ...options,
    object3D: mesh,
    textureSource: canvas,
    disposeResources() {
      texture.dispose();
      geometry.dispose();
      material.dispose();
    },
  });

  const renderCSSBox = (layout = lastLayout, force = false) => {
    if (!layout) {
      return;
    }

    const rasterGeometrySignature = createRasterGeometrySignature(layout);

    if (
      !force &&
      lastRenderSignature &&
      rasterGeometrySignature === lastRasterGeometrySignature
    ) {
      return;
    }

    const style = readDOMStyleSnapshot(options.element);
    const state = {
      width: layout.width,
      height: layout.height,
      devicePixelRatio: layout.devicePixelRatio,
      style,
    };
    const signature = createCSSBoxCanvasSignature(state);

    if (!force && signature === lastRenderSignature) {
      return;
    }

    lastRenderSignature = signature;
    lastRasterGeometrySignature = rasterGeometrySignature;
    updateCSSBoxCanvas(canvas, texture, state);
    applyBoxStyleToMaterialAndObject(material, mesh, style);
  };

  controller.object.updateTextLayout = (measurement) => {
    lastLayout = measurement as ElementLayoutSnapshot;
    renderCSSBox(lastLayout);
  };
  controller.object.invalidateContent = () => {
    lastRenderSignature = "";
    renderCSSBox(lastLayout, true);
  };

  return controller;
}

export function createTextPlaneSceneRenderableController(
  options: Omit<SceneRenderableControllerOptions, "object3D" | "disposeResources">,
): SceneRenderableController {
  const canvas = options.element.ownerDocument.createElement("canvas");
  const texture = new CanvasTexture(canvas);
  const geometry = new PlaneGeometry(1, 1);
  const material = new MeshBasicMaterial({
    map: texture,
    transparent: true,
  });
  const mesh = new Mesh(geometry, material);
  let textContent = options.textContent ?? "";
  let lastMeasurement: ElementLayoutSnapshot | undefined;
  let lastRenderSignature = "";
  let lastRasterGeometrySignature = "";
  const controller = createSceneRenderableController({
    ...options,
    object3D: mesh,
    textureSource: canvas,
    disposeResources() {
      texture.dispose();
      geometry.dispose();
      material.dispose();
    },
  });
  const renderTextSnapshot = (measurement = lastMeasurement, force = false) => {
    if (!measurement) {
      return;
    }

    const rasterGeometrySignature = createRasterGeometrySignature(measurement);

    if (
      !force &&
      lastRenderSignature &&
      rasterGeometrySignature === lastRasterGeometrySignature
    ) {
      return;
    }

    const style = readDOMStyleSnapshot(options.element);
    const state = readTextCanvasRenderState(
      options.element,
      textContent,
      {
        width: measurement.width,
        height: measurement.height,
        devicePixelRatio: measurement.devicePixelRatio ?? 1,
        style,
      },
    );
    const signature = createTextCanvasRenderSignature(textContent, state);

    if (!force && signature === lastRenderSignature) {
      return;
    }

    lastRenderSignature = signature;
    lastRasterGeometrySignature = rasterGeometrySignature;
    updateTextCanvas(canvas, texture, textContent, state);
    applyBoxStyleToMaterialAndObject(material, mesh, style);
  };

  controller.object.updateTextContent = (nextTextContent) => {
    textContent = nextTextContent;
    lastRenderSignature = "";
    updateTextCanvas(
      canvas,
      texture,
      textContent,
      readTextCanvasRenderState(options.element, textContent, {
        width: lastMeasurement?.width ?? 1,
        height: lastMeasurement?.height ?? 1,
        devicePixelRatio: lastMeasurement?.devicePixelRatio ?? 1,
        style: readDOMStyleSnapshot(options.element),
      }),
    );
  };
  controller.object.updateTextLayout = (measurement) => {
    lastMeasurement = measurement as ElementLayoutSnapshot;
    renderTextSnapshot(lastMeasurement);
  };
  controller.object.invalidateContent = () => {
    lastRenderSignature = "";
    renderTextSnapshot(lastMeasurement, true);
  };

  if (options.textContent) {
    controller.updateTextContent(options.textContent);
  }

  return controller;
}

export function createTexturePlaneSceneRenderableController(
  options: Omit<SceneRenderableControllerOptions, "object3D" | "disposeResources"> & {
    textureKind: "image" | "video";
    textureSource: HTMLImageElement | HTMLVideoElement;
  },
): SceneRenderableController {
  const texture =
    options.textureKind === "video"
      ? new VideoTexture(options.textureSource as HTMLVideoElement)
      : new Texture(options.textureSource);
  const geometry = new PlaneGeometry(1, 1);
  const material = new MeshBasicMaterial({
    map: texture,
    transparent: true,
  });
  const mesh = new Mesh(geometry, material);
  let lastTextureTransformSignature = "";

  texture.needsUpdate = true;
  const controller = createSceneRenderableController({
    ...options,
    object3D: mesh,
    disposeResources() {
      texture.dispose();
      geometry.dispose();
      material.dispose();
    },
  });

  const updateTextureTransform = (
    measurement: ElementMeasurement,
    force = false,
  ) => {
    const mediaSize = readMediaSize(options.textureSource);
    const textureGeometrySignature = JSON.stringify([
      measurement.width,
      measurement.height,
      mediaSize.width,
      mediaSize.height,
    ]);

    if (!force && textureGeometrySignature === lastTextureTransformSignature) {
      return;
    }

    const style = readDOMStyleSnapshot(options.element);
    const box = { width: measurement.width, height: measurement.height };
    const transform = computeObjectFitTextureTransform({
      fit: style.media.objectFit,
      position: style.media.objectPosition,
      box,
      media: mediaSize,
    });
    const contentBox = computeObjectFitContentBox({
      fit: style.media.objectFit,
      position: style.media.objectPosition,
      box,
      media: mediaSize,
    });

    lastTextureTransformSignature = textureGeometrySignature;
    applyTextureTransform(texture, transform);
    applyObjectFitContentBox(
      mesh,
      measurement as ElementLayoutSnapshot,
      contentBox,
    );
    applyBoxStyleToMaterialAndObject(material, mesh, style);
  };
  controller.object.updateTextLayout = (measurement) => {
    updateTextureTransform(measurement);
  };
  controller.object.invalidateContent = () => {
    lastTextureTransformSignature = "";
  };

  return controller;
}

function createRasterGeometrySignature(layout: ElementLayoutSnapshot): string {
  return JSON.stringify([
    layout.width,
    layout.height,
    layout.devicePixelRatio ?? 1,
  ]);
}

function readMediaSize(source: HTMLImageElement | HTMLVideoElement): {
  width: number;
  height: number;
} {
  if ("naturalWidth" in source && source.naturalWidth && source.naturalHeight) {
    return { width: source.naturalWidth, height: source.naturalHeight };
  }

  if ("videoWidth" in source && source.videoWidth && source.videoHeight) {
    return { width: source.videoWidth, height: source.videoHeight };
  }

  return {
    width: source.width || source.clientWidth || 1,
    height: source.height || source.clientHeight || 1,
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

function updateObject3DLayout(
  object3D: unknown,
  layout: ReturnType<typeof projectDOMRectToSceneLayout>,
): void {
  if (!object3D || typeof object3D !== "object") {
    return;
  }

  setVector3((object3D as { position?: unknown }).position, layout.x, layout.y, 0);
  setVector3(
    (object3D as { scale?: unknown }).scale,
    layout.width,
    layout.height,
    1,
  );
}

function setObject3DVisible(object3D: unknown, visible: boolean): void {
  if (!object3D || typeof object3D !== "object") {
    return;
  }

  (object3D as { visible?: boolean }).visible = visible;
}

function setVector3(vector: unknown, x: number, y: number, z: number): void {
  if (vector && typeof vector === "object" && "set" in vector) {
    const set = (vector as { set?: unknown }).set;

    if (typeof set === "function") {
      set.call(vector, x, y, z);
      return;
    }
  }

  if (vector && typeof vector === "object") {
    Object.assign(vector, { x, y, z });
  }
}

function disposeObject3D(object3D: unknown): void {
  if (!object3D || typeof object3D !== "object") {
    return;
  }

  const dispose = (object3D as { dispose?: unknown }).dispose;

  if (typeof dispose === "function") {
    dispose.call(object3D);
  }
}

function updateTextCanvas(
  canvas: HTMLCanvasElement,
  texture: CanvasTexture,
  textContent: string,
  state: TextCanvasRenderState,
): void {
  const dpr = Math.min(Math.max(1, state.devicePixelRatio), 1.5);

  canvas.width = Math.max(1, Math.ceil(state.width * dpr));
  canvas.height = Math.max(1, Math.ceil(state.height * dpr));

  if (!canvas.ownerDocument.defaultView?.CanvasRenderingContext2D) {
    texture.needsUpdate = true;
    return;
  }

  try {
    const context = canvas.getContext("2d");

    if (!context) {
      return;
    }

    context.setTransform?.(1, 0, 0, 1, 0, 0);
    context.scale?.(dpr, dpr);
    drawTextToCanvas(context, textContent, state);
    texture.needsUpdate = true;
  } catch {
    texture.needsUpdate = true;
  }
}

function updateCSSBoxCanvas(
  canvas: HTMLCanvasElement,
  texture: CanvasTexture,
  state: Parameters<typeof drawCSSBoxToCanvas>[2],
): void {
  if (!canvas.ownerDocument.defaultView?.CanvasRenderingContext2D) {
    texture.needsUpdate = true;
    return;
  }

  try {
    const context = canvas.getContext("2d");

    if (!context) {
      return;
    }

    drawCSSBoxToCanvas(canvas, context, state);
    texture.needsUpdate = true;
  } catch {
    texture.needsUpdate = true;
  }
}

function applyBoxStyleToMaterialAndObject(
  material: MeshBasicMaterial,
  object3D: unknown,
  style: { box: { opacity: number; display: string; visibility: string } },
): void {
  material.opacity = style.box.opacity;
  material.transparent = style.box.opacity < 1 || material.transparent;
  setObject3DVisible(
    object3D,
    style.box.display !== "none" &&
      style.box.visibility !== "hidden" &&
      style.box.opacity > 0,
  );
}
