import type {
  WebGLEffectSourceHandle,
  WebGLEffectTargetHandle,
  WebGLSceneObjectEffectSourceKind,
} from "../effects/effectAuthoring";
import type { WebGLEffectObjectHandle } from "../effects/effectObject";
import { createWebGLEffectObject } from "../effects/effectObjectContext";

import type { WebGLSceneObject } from "./sceneObject";

export type WebGLSceneObjectEffectObjectOptions = {
  readonly sourceKind: WebGLSceneObjectEffectSourceKind;
  readonly object: WebGLSceneObject;
  readonly source?: WebGLEffectSourceHandle;
};

type Object3DTransformLike = {
  visible?: boolean;
  position?: Object3DVectorLike;
  rotation?: Object3DVectorLike;
  scale?: Object3DScaleLike;
  material?: unknown;
  children?: unknown;
};

type Object3DVectorLike = {
  set?(x: number, y: number, z: number): void;
  x?: number;
  y?: number;
  z?: number;
};

type Object3DScaleLike = Object3DVectorLike & {
  setScalar?(value: number): void;
};

type Object3DMaterialLike = {
  transparent?: boolean;
  opacity?: number;
};

export function createSceneObjectEffectObject(
  options: WebGLSceneObjectEffectObjectOptions,
): WebGLEffectObjectHandle {
  return createWebGLEffectObject({
    sourceKind: options.sourceKind,
    source: options.source,
    target: createSceneObjectEffectTarget(options.object),
  });
}

function createSceneObjectEffectTarget(
  object: WebGLSceneObject,
): WebGLEffectTargetHandle {
  return {
    setVisible(visible) {
      object.setVisible(visible);
    },
    setPosition(x, y, z = 0) {
      setTuple3(readObject3D(object.object3D)?.position, x, y, z);
    },
    setRotation(x, y, z = 0) {
      setTuple3(readObject3D(object.object3D)?.rotation, x, y, z);
    },
    setScale(x, y = x, z = x) {
      const scale = readObject3D(object.object3D)?.scale;
      if (scale && x === y && y === z && typeof scale.setScalar === "function") {
        scale.setScalar(x);
        return;
      }

      setTuple3(scale, x, y, z);
    },
    setOpacity(opacity) {
      setObjectOpacity(object.object3D, opacity);
    },
  };
}

function readObject3D(object3D: unknown): Object3DTransformLike | undefined {
  if (!object3D || typeof object3D !== "object") {
    return undefined;
  }

  return object3D as Object3DTransformLike;
}

function setTuple3(
  target: Object3DVectorLike | undefined,
  x: number,
  y: number,
  z: number,
): void {
  if (!target) {
    return;
  }

  if (typeof target.set === "function") {
    target.set(x, y, z);
    return;
  }

  target.x = x;
  target.y = y;
  target.z = z;
}

function setObjectOpacity(object3D: unknown, opacity: number): void {
  const object = readObject3D(object3D);
  if (!object) {
    return;
  }

  setMaterialOpacity(object.material, opacity);

  if (!Array.isArray(object.children)) {
    return;
  }

  for (const child of object.children) {
    setObjectOpacity(child, opacity);
  }
}

function setMaterialOpacity(material: unknown, opacity: number): void {
  if (Array.isArray(material)) {
    for (const entry of material) {
      setMaterialOpacity(entry, opacity);
    }
    return;
  }

  if (!material || typeof material !== "object") {
    return;
  }

  const target = material as Object3DMaterialLike;
  target.opacity = opacity;
  target.transparent = opacity < 1;
}
