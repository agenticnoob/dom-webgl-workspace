import {
  projectDOMRectToSceneLayout,
  type DOMViewportSize,
  type ProjectedDOMRect,
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
import { Group } from "three/src/objects/Group.js";
import { Box3 } from "three/src/math/Box3.js";
import { Vector3 } from "three/src/math/Vector3.js";
import type { Object3D } from "three/src/core/Object3D.js";
import { CanvasTexture } from "three/src/textures/CanvasTexture.js";
import { Texture } from "three/src/textures/Texture.js";
import { VideoTexture } from "three/src/textures/VideoTexture.js";

import { readDOMStyleSnapshot } from "../../dom/styleSnapshot";
import type {
  WebGLEffectCanvasSurfaceHandle,
  WebGLEffectManagedObjectHandle,
  WebGLEffectTextLayerHandle,
  WebGLEffectTextureTransform,
  WebGLEffectTextureLayerHandle,
  WebGLEffectVideoLayerHandle,
  WebGLTextGlyph,
  WebGLTextGlyphRenderCommand,
  WebGLTextLayerStyle,
} from "../../effects/effectAuthoring";
import type { WebGLEffectTarget } from "../../effects/effectTarget";
import type { ElementLayoutSnapshot } from "../../renderer/layoutPass";
import {
  computeObjectFitContentBox,
  computeObjectFitTextureTransform,
} from "./objectFit";
import {
  computeTextGlyphLayout,
  createTextCanvasRenderSignature,
  drawTextSnapshotToCanvas,
  readTextCanvasRenderState,
  type TextCanvasRenderState,
} from "./textCanvasLayout";
import {
  createCanvasSurfaceCapabilityHandle,
  createTextLayerCapabilityHandle,
  createTextureLayerCapabilityHandle,
  createVideoLayerCapabilityHandle,
  drawTextGlyphCommands,
  type TextLayerCapabilityOptions,
} from "./sourceCapabilityHandles";
import {
  createElementPlaneEffectTarget,
  createObject3DEffectTarget,
} from "./effectTargets/elementPlaneEffectTarget";

type ElementMeasurement = {
  x: number;
  y: number;
  width: number;
  height: number;
  top: number;
  right: number;
  bottom: number;
  left: number;
  devicePixelRatio?: number;
};

export type SceneRenderableObject = WebGLSceneObject & {
  visible: boolean;
  disposed: boolean;
  lastLayout?: ReturnType<typeof projectDOMRectToSceneLayout>;
  textContent?: string;
  textureSource?: unknown;
  effectTarget?: WebGLEffectTarget;
  surfaceCapability?: WebGLEffectCanvasSurfaceHandle;
  textLayerCapability?: WebGLEffectTextLayerHandle;
  textureLayerCapability?: WebGLEffectTextureLayerHandle<HTMLImageElement>;
  videoLayerCapability?: WebGLEffectVideoLayerHandle;
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
  effectTarget?: WebGLEffectTarget;
  disposeObject3D?: boolean;
  disposeResources?(): void;
  layoutObject3D?(object3D: unknown, layout: ProjectedDOMRect): void;
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
  const addEffectObject3D = createManagedObject3DFactory(options);
  const object: SceneRenderableObject = {
    key: options.key,
    object3D: options.object3D,
    visible: true,
    disposed: false,
    textContent: options.textContent,
    textureSource: options.textureSource,
    effectTarget:
      options.effectTarget ??
      createObject3DEffectTarget(options.object3D, addEffectObject3D),
    setVisible(visible) {
      object.visible = visible;
      setObject3DVisible(options.object3D, visible);
    },
    updateLayout(layout) {
      object.lastLayout = layout;
      if (options.layoutObject3D) {
        options.layoutObject3D(options.object3D, layout);
        return;
      }

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
  const context = readCanvasContext(canvas);
  const texture = new CanvasTexture(canvas);
  const geometry = new PlaneGeometry(1, 1);
  const material = new MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: 0,
  });
  material.transparent = true;
  const mesh = new Mesh(geometry, material);
  let lastMeasurement: ElementMeasurement | undefined;

  mesh.visible = false;

  const controller = createSceneRenderableController({
    ...options,
    object3D: mesh,
    effectTarget: createElementPlaneEffectTarget(
      mesh,
      material,
      createManagedObject3DFactory(options),
    ),
    disposeResources() {
      texture.dispose();
      geometry.dispose();
      material.dispose();
    },
  });
  controller.object.surfaceCapability = createCanvasSurfaceCapabilityHandle({
    object3D: mesh,
    mesh,
    material,
    canvas,
    context,
    texture,
    getSize() {
      return readSurfaceSize(lastMeasurement);
    },
    invalidate() {
      texture.needsUpdate = true;
    },
  });
  controller.object.updateTextLayout = (measurement) => {
    lastMeasurement = measurement;
    resizeCanvasToMeasurement(canvas, texture, measurement);
  };

  return controller;
}

function createManagedObject3DFactory(
  options: Pick<SceneRenderableControllerOptions, "key" | "sceneAdapter">,
): NonNullable<WebGLEffectTarget["addObject3D"]> {
  let nextManagedObjectId = 0;

  return (object3D, managedOptions = {}): WebGLEffectManagedObjectHandle => {
    let disposed = false;
    let attached = true;
    const sceneObject: SceneRenderableObject = {
      key: `${options.key}:effect:${nextManagedObjectId}`,
      object3D,
      visible: true,
      disposed: false,
      setVisible(visible) {
        sceneObject.visible = visible;
        setObject3DVisible(object3D, visible);
      },
      updateLayout() {
        return;
      },
      dispose() {
        sceneObject.disposed = true;
      },
    };

    nextManagedObjectId += 1;
    options.sceneAdapter.addObject(sceneObject);

    return {
      setVisible(visible) {
        if (!disposed) {
          sceneObject.setVisible(visible);
        }
      },
      remove() {
        if (!attached) {
          return;
        }

        attached = false;
        options.sceneAdapter.removeObject(sceneObject);
      },
      dispose() {
        if (disposed) {
          return;
        }

        disposed = true;
        this.remove();
        managedOptions.dispose?.(object3D);
        sceneObject.dispose();
      },
    };
  };
}

export function createModelSceneRenderableController(
  options: Omit<SceneRenderableControllerOptions, "layoutObject3D"> & {
    object3D: unknown;
  },
): SceneRenderableController {
  const fit = readModelObjectFit(options.object3D);

  return createSceneRenderableController({
    ...options,
    layoutObject3D(object3D, layout) {
      updateModelObject3DLayout(object3D, layout, fit);
    },
  });
}

export function createTextPlaneSceneRenderableController(
  options: Omit<SceneRenderableControllerOptions, "object3D" | "disposeResources">,
): SceneRenderableController {
  const canvas = options.element.ownerDocument.createElement("canvas");
  const context = readCanvasContext(canvas);
  const texture = new CanvasTexture(canvas);
  const geometry = new PlaneGeometry(1, 1);
  const material = new MeshBasicMaterial({
    map: texture,
    transparent: true,
  });
  const mesh = new Mesh(geometry, material);
  let textContent = options.textContent ?? "";
  const initialStyle = readDOMStyleSnapshot(options.element);
  let lastMeasurement: ElementLayoutSnapshot | undefined;
  let lastRenderSignature = "";
  let lastRasterGeometrySignature = "";
  let glyphs: readonly WebGLTextGlyph[] = [];
  let glyphCommandTransform:
    | ((
        glyphs: readonly WebGLTextGlyph[],
      ) => readonly WebGLTextGlyphRenderCommand[])
    | undefined;
  let textLayerStyle = readTextLayerStyle(
    readTextCanvasRenderState(options.element, textContent, {
      width: 1,
      height: 1,
      devicePixelRatio: 1,
      style: initialStyle,
    }),
  );
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

    const state = readTextCanvasRenderState(
      options.element,
      textContent,
      {
        width: measurement.width,
        height: measurement.height,
        devicePixelRatio: measurement.devicePixelRatio ?? 1,
        style: initialStyle,
      },
    );
    const signature = createTextCanvasRenderSignature(textContent, state);

    if (!force && signature === lastRenderSignature) {
      return;
    }

    lastRenderSignature = signature;
    lastRasterGeometrySignature = rasterGeometrySignature;
    updateTextCanvas(canvas, texture, textContent, state);
    glyphs = context ? computeTextGlyphLayout(context, textContent, state) : [];
    textLayerStyle = readTextLayerStyle(state);
    applyGlyphCommandTransform();
    applyDOMActivityVisibility(mesh, initialStyle);
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
        style: initialStyle,
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
  const textLayerOptions: TextLayerCapabilityOptions = {
    object3D: mesh,
    mesh,
    material,
    canvas,
    context,
    texture,
    getSize() {
      return readSurfaceSize(lastMeasurement);
    },
    getText() {
      return textContent;
    },
    getStyle() {
      return textLayerStyle;
    },
    getGlyphs() {
      return glyphs;
    },
    setText(nextText) {
      controller.updateTextContent(nextText);
    },
    setGlyphs(transform) {
      glyphCommandTransform = transform;
      applyGlyphCommandTransform();
    },
    invalidate() {
      texture.needsUpdate = true;
    },
  };
  const applyGlyphCommandTransform = () => {
    if (!glyphCommandTransform) {
      return;
    }

    drawTextGlyphCommands(textLayerOptions, glyphCommandTransform(glyphs));
  };
  controller.object.textLayerCapability =
    createTextLayerCapabilityHandle(textLayerOptions);

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
      invalidate() {
        controller.object.invalidateContent?.();
      },
    });
  }

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

type ModelObjectFit = {
  center: Vector3;
  width: number;
  height: number;
  depth: number;
};

function readModelObjectFit(object3D: unknown): ModelObjectFit | undefined {
  if (!isObject3D(object3D)) {
    return undefined;
  }

  const bounds = new Box3().setFromObject(object3D);

  if (
    !Number.isFinite(bounds.min.x) ||
    !Number.isFinite(bounds.min.y) ||
    !Number.isFinite(bounds.min.z) ||
    !Number.isFinite(bounds.max.x) ||
    !Number.isFinite(bounds.max.y) ||
    !Number.isFinite(bounds.max.z) ||
    bounds.isEmpty()
  ) {
    return undefined;
  }

  const size = new Vector3();
  const center = new Vector3();

  bounds.getSize(size);
  bounds.getCenter(center);

  return {
    center,
    width: size.x,
    height: size.y,
    depth: size.z,
  };
}

function updateModelObject3DLayout(
  object3D: unknown,
  layout: ProjectedDOMRect,
  fit: ModelObjectFit | undefined,
): void {
  if (!fit || fit.width <= 0 || fit.height <= 0) {
    updateObject3DLayout(object3D, layout);
    return;
  }

  const scale = Math.min(layout.width / fit.width, layout.height / fit.height);

  if (!Number.isFinite(scale) || scale <= 0) {
    updateObject3DLayout(object3D, layout);
    return;
  }

  setVector3(
    (object3D as { position?: unknown }).position,
    normalizeSignedZero(layout.x - fit.center.x * scale),
    normalizeSignedZero(layout.y - fit.center.y * scale),
    normalizeSignedZero(-fit.center.z * scale),
  );
  setVector3((object3D as { scale?: unknown }).scale, scale, scale, scale);
}

function normalizeSignedZero(value: number): number {
  return Object.is(value, -0) ? 0 : value;
}

function isObject3D(object3D: unknown): object3D is Object3D {
  return (
    !!object3D &&
    typeof object3D === "object" &&
    "isObject3D" in object3D &&
    (object3D as { isObject3D?: unknown }).isObject3D === true
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

function readCanvasContext(
  canvas: HTMLCanvasElement,
): CanvasRenderingContext2D | null {
  if (!canvas.ownerDocument.defaultView?.CanvasRenderingContext2D) {
    return null;
  }

  try {
    return canvas.getContext("2d");
  } catch {
    return null;
  }
}

function readSurfaceSize(measurement: ElementMeasurement | undefined): {
  width: number;
  height: number;
  devicePixelRatio: number;
} {
  return {
    width: Math.max(1, Math.ceil(measurement?.width ?? 1)),
    height: Math.max(1, Math.ceil(measurement?.height ?? 1)),
    devicePixelRatio: measurement?.devicePixelRatio ?? 1,
  };
}

function resizeCanvasToMeasurement(
  canvas: HTMLCanvasElement,
  texture: CanvasTexture,
  measurement: ElementMeasurement,
): void {
  const size = readSurfaceSize(measurement);
  const dpr = Math.min(Math.max(1, size.devicePixelRatio), 1.5);
  const width = Math.max(1, Math.ceil(size.width * dpr));
  const height = Math.max(1, Math.ceil(size.height * dpr));

  if (canvas.width !== width) {
    canvas.width = width;
  }
  if (canvas.height !== height) {
    canvas.height = height;
  }
  texture.needsUpdate = true;
}

function readTextLayerStyle(state: TextCanvasRenderState): WebGLTextLayerStyle {
  return {
    font: state.font,
    lineHeight: state.lineHeight,
    letterSpacing: state.letterSpacing,
    wordSpacing: state.wordSpacing,
    textAlign: state.textAlign,
    color: "#000000",
  };
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
    drawTextSnapshotToCanvas(canvas, context, textContent, state);
    texture.needsUpdate = true;
  } catch {
    texture.needsUpdate = true;
  }
}

function applyDOMActivityVisibility(
  object3D: unknown,
  style: { box: { display: string; visibility: string } },
): void {
  setObject3DVisible(object3D, isDOMTargetRenderable(style));
}

function isDOMTargetRenderable(style: {
  box: { display: string; visibility: string };
}): boolean {
  return style.box.display !== "none" && style.box.visibility !== "hidden";
}
