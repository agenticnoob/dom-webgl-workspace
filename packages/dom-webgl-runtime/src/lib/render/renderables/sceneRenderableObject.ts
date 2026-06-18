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
      object.updateTextLayout?.(measurement);
      controller.updateLayout(
        projectDOMRectToSceneLayout(
          measurement,
          options.getViewportSize?.() ?? defaultViewport,
        ),
      );
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
  const geometry = new PlaneGeometry(1, 1);
  const material = new MeshBasicMaterial({
    color: readElementColor(options.element),
  });
  const mesh = new Mesh(geometry, material);

  return createSceneRenderableController({
    ...options,
    object3D: mesh,
    disposeResources() {
      geometry.dispose();
      material.dispose();
    },
  });
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
  let lastMeasurement: ElementMeasurement | undefined;
  let lastRenderSignature = "";
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
  const renderTextSnapshot = (measurement = lastMeasurement) => {
    const state = readTextCanvasRenderState(
      options.element,
      textContent,
      measurement,
    );
    const signature = createTextCanvasRenderSignature(textContent, state);

    if (signature === lastRenderSignature) {
      return;
    }

    lastRenderSignature = signature;
    updateTextCanvas(canvas, texture, textContent, state);
  };

  controller.object.updateTextContent = (nextTextContent) => {
    textContent = nextTextContent;
    lastRenderSignature = "";
    updateTextCanvas(
      canvas,
      texture,
      textContent,
      readTextCanvasRenderState(options.element, textContent, lastMeasurement),
    );
  };
  controller.object.updateTextLayout = (measurement) => {
    lastMeasurement = measurement;
    renderTextSnapshot(measurement);
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

  texture.needsUpdate = true;

  return createSceneRenderableController({
    ...options,
    object3D: mesh,
    disposeResources() {
      texture.dispose();
      geometry.dispose();
      material.dispose();
    },
  });
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

function readElementColor(element: HTMLElement): string {
  const view = element.ownerDocument.defaultView;
  const backgroundColor = view
    ?.getComputedStyle(element)
    .backgroundColor.trim();

  if (!backgroundColor || backgroundColor === "rgba(0, 0, 0, 0)") {
    return "#ffffff";
  }

  return backgroundColor;
}

function updateTextCanvas(
  canvas: HTMLCanvasElement,
  texture: CanvasTexture,
  textContent: string,
  state: TextCanvasRenderState,
): void {
  canvas.width = state.width;
  canvas.height = state.height;

  if (!canvas.ownerDocument.defaultView?.CanvasRenderingContext2D) {
    texture.needsUpdate = true;
    return;
  }

  try {
    const context = canvas.getContext("2d");

    if (!context) {
      return;
    }

    drawTextToCanvas(context, textContent, state);
    texture.needsUpdate = true;
  } catch {
    texture.needsUpdate = true;
  }
}
