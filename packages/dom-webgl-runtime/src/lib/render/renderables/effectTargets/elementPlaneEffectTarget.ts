import type { Object3D } from "three/src/core/Object3D.js";
import { MeshBasicMaterial } from "three/src/materials/MeshBasicMaterial.js";
import { Mesh } from "three/src/objects/Mesh.js";

import type { WebGLEffectTarget } from "../../../effects/effectTarget";

export function createElementPlaneEffectTarget(
  mesh: Mesh,
  material: MeshBasicMaterial,
  addObject3D?: WebGLEffectTarget["addObject3D"],
): WebGLEffectTarget {
  return {
    setVisible(visible) {
      mesh.visible = visible;
    },
    setRotation(x, y, z) {
      setObject3DRotation(mesh, x, y, z);
    },
    setScale(x, y = x, z = 1) {
      setObject3DScale(mesh, x, y, z);
    },
    setOpacity(opacity) {
      material.opacity = opacity;
      material.transparent = opacity < 1;
      material.needsUpdate = true;
    },
    addObject3D,
  };
}

export function createObject3DEffectTarget(
  object3D: unknown,
  addObject3D?: WebGLEffectTarget["addObject3D"],
): WebGLEffectTarget | undefined {
  if (!object3D || typeof object3D !== "object") {
    return undefined;
  }

  return {
    setVisible(visible) {
      (object3D as { visible?: boolean }).visible = visible;
    },
    setRotation(x, y, z) {
      setObject3DRotation(object3D, x, y, z);
    },
    setScale(x, y = x, z = x) {
      setObject3DScale(object3D, x, y, z);
    },
    setOpacity(opacity) {
      setObject3DOpacity(object3D, opacity);
    },
    addObject3D,
  };
}

function setObject3DRotation(
  object3D: unknown,
  x: number,
  y: number,
  z?: number,
): void {
  const rotation = (object3D as Partial<Object3D> | undefined)?.rotation;

  if (rotation && typeof rotation === "object" && "set" in rotation) {
    rotation.set(x, y, z ?? (rotation as { z?: number }).z ?? 0);
    return;
  }

  if (rotation && typeof rotation === "object") {
    Object.assign(rotation, { x, y, z: z ?? (rotation as { z?: number }).z ?? 0 });
  }
}

function setObject3DScale(
  object3D: unknown,
  x: number,
  y: number,
  z: number,
): void {
  const scale = (object3D as Partial<Object3D> | undefined)?.scale;

  if (scale && typeof scale === "object" && "set" in scale) {
    scale.set(x, y, z);
    return;
  }

  if (scale && typeof scale === "object") {
    Object.assign(scale, { x, y, z });
  }
}

function setObject3DOpacity(object3D: unknown, opacity: number): void {
  if (!object3D || typeof object3D !== "object") {
    return;
  }

  applyOpacityToMaterial((object3D as { material?: unknown }).material, opacity);

  const children = (object3D as { children?: unknown }).children;
  if (Array.isArray(children)) {
    for (const child of children) {
      setObject3DOpacity(child, opacity);
    }
  }
}

function applyOpacityToMaterial(material: unknown, opacity: number): void {
  const materials = Array.isArray(material) ? material : [material];

  for (const entry of materials) {
    if (entry && typeof entry === "object") {
      Object.assign(entry, {
        opacity,
        transparent: opacity < 1,
        needsUpdate: true,
      });
    }
  }
}
