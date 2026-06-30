import {
  projectDOMRectToSceneLayout,
  type DOMViewportSize,
  type ProjectedDOMRect,
} from "../../renderer/domProjection";
import {
  applySceneObjectOrdering,
  createSceneObjectController,
  type WebGLSceneAdapter,
  type WebGLSceneObject,
  type WebGLSceneObjectController,
  type WebGLSceneObjectOrdering,
} from "../../renderer/sceneObject";
import { CanvasTexture } from "three/src/textures/CanvasTexture.js";

import type {
  WebGLEffectCanvasSurfaceHandle,
  WebGLEffectManagedObjectHandle,
  WebGLEffectTextLayerHandle,
  WebGLEffectTextureLayerHandle,
  WebGLEffectVideoLayerHandle,
} from "../../effects/effectAuthoring";
import type { WebGLEffectTarget } from "../../effects/effectTarget";
import { createObject3DEffectTarget } from "./effectTargets/elementPlaneEffectTarget";
import type { TextureUploadTelemetry } from "./textureUploadState";

export type ElementMeasurement = {
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
  updateTextureSource?(source: HTMLImageElement | HTMLCanvasElement | ImageBitmap): void;
  invalidateContent?(): void;
  inspectTextureTelemetry?(): readonly TextureUploadTelemetry[];
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
  requestTextureFrame?(): void;
  getManagedObjectOrdering?(): WebGLSceneObjectOrdering;
  layoutObject3D?(object3D: unknown, layout: ProjectedDOMRect): void;
};

export type SceneRenderableController = {
  readonly object: SceneRenderableObject;
  readonly controller: WebGLSceneObjectController;
  updateLayout(measurement?: ElementMeasurement): void;
  updateTextContent(textContent: string): void;
  attach(): void;
};

export const defaultViewport = {
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

export function createManagedObject3DFactory(
  options: Pick<
    SceneRenderableControllerOptions,
    "key" | "sceneAdapter" | "getManagedObjectOrdering"
  >,
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
    applySceneObjectOrdering(sceneObject, options.getManagedObjectOrdering?.());
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

export function updateObject3DLayout(
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

export function setObject3DVisible(object3D: unknown, visible: boolean): void {
  if (!object3D || typeof object3D !== "object") {
    return;
  }

  (object3D as { visible?: boolean }).visible = visible;
}

export function setVector3(
  vector: unknown,
  x: number,
  y: number,
  z: number,
): void {
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

export function disposeObject3D(object3D: unknown): void {
  if (!object3D || typeof object3D !== "object") {
    return;
  }

  const dispose = (object3D as { dispose?: unknown }).dispose;

  if (typeof dispose === "function") {
    dispose.call(object3D);
  }
}

export function readCanvasContext(
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

export function readSurfaceSize(measurement: ElementMeasurement | undefined): {
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

export function resizeCanvasToMeasurement(
  canvas: HTMLCanvasElement,
  texture: CanvasTexture,
  measurement: ElementMeasurement,
  markTextureDirty?: () => void,
): void {
  const size = readSurfaceSize(measurement);
  const dpr = Math.min(Math.max(1, size.devicePixelRatio), 1.5);
  const width = Math.max(1, Math.ceil(size.width * dpr));
  const height = Math.max(1, Math.ceil(size.height * dpr));
  const changed = canvas.width !== width || canvas.height !== height;

  if (canvas.width !== width) {
    canvas.width = width;
  }
  if (canvas.height !== height) {
    canvas.height = height;
  }
  if (!changed) {
    return;
  }

  if (markTextureDirty) {
    markTextureDirty();
  } else {
    texture.needsUpdate = true;
  }
}

export function applyDOMActivityVisibility(
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
