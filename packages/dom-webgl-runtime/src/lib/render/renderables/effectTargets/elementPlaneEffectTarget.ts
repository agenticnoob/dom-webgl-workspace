import type { Object3D } from "three/src/core/Object3D.js";
import { MeshBasicMaterial } from "three/src/materials/MeshBasicMaterial.js";
import { Mesh } from "three/src/objects/Mesh.js";

import type { WebGLEffectTarget } from "../../../effects/effectTarget";

export function createElementPlaneEffectTarget(
  mesh: Mesh,
  material: MeshBasicMaterial,
): WebGLEffectTarget {
  return {
    applySolidMaterial(nextMaterial) {
      material.color.setHex(nextMaterial.color);
      material.opacity = nextMaterial.opacity;
      material.transparent = true;
      mesh.visible = true;
    },
    setRotation(x, y) {
      setObject3DRotation(mesh, x, y);
    },
  };
}

export function createObject3DEffectTarget(
  object3D: unknown,
): WebGLEffectTarget | undefined {
  if (!object3D || typeof object3D !== "object") {
    return undefined;
  }

  return {
    setRotation(x, y) {
      setObject3DRotation(object3D, x, y);
    },
  };
}

function setObject3DRotation(object3D: unknown, x: number, y: number): void {
  const rotation = (object3D as Partial<Object3D> | undefined)?.rotation;

  if (rotation && typeof rotation === "object" && "set" in rotation) {
    const z = (rotation as { z?: number }).z ?? 0;
    rotation.set(x, y, z);
    return;
  }

  if (rotation && typeof rotation === "object") {
    Object.assign(rotation, { x, y });
  }
}
