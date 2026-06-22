import { MeshBasicMaterial } from "three/src/materials/MeshBasicMaterial.js";
import { Mesh } from "three/src/objects/Mesh.js";

import type { WebGLEffectTarget } from "../../../effects/effectTarget";
import { createObject3DControls } from "../object3DControls";

export function createElementPlaneEffectTarget(
  mesh: Mesh,
  material: MeshBasicMaterial,
  addObject3D?: WebGLEffectTarget["addObject3D"],
): WebGLEffectTarget {
  return {
    ...createObject3DControls(mesh, {
      positionZ: "current",
      rotationZ: "current",
      scaleZ: 1,
      opacity: { kind: "material", material },
    }),
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
    ...createObject3DControls(object3D, {
      positionZ: "current",
      rotationZ: "current",
      scaleZ: "x",
      opacity: { kind: "object" },
    }),
    addObject3D,
  };
}
