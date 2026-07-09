import { BoxGeometry } from "three/src/geometries/BoxGeometry.js";
import { PlaneGeometry } from "three/src/geometries/PlaneGeometry.js";
import { AmbientLight } from "three/src/lights/AmbientLight.js";
import { DirectionalLight } from "three/src/lights/DirectionalLight.js";
import { PointLight } from "three/src/lights/PointLight.js";
import { MeshBasicMaterial } from "three/src/materials/MeshBasicMaterial.js";
import { MeshStandardMaterial } from "three/src/materials/MeshStandardMaterial.js";
import { Object3D } from "three/src/core/Object3D.js";
import { Group } from "three/src/objects/Group.js";
import { Mesh } from "three/src/objects/Mesh.js";

import type { WebGLColorValue, WebGLTuple3 } from "../types";

import type {
  NormalizedLightDeclaration,
  NormalizedStageMaterialDeclaration,
  NormalizedStagePrimitiveDeclaration,
} from "./stageDeclarations";
import type { WebGLSceneObject } from "./sceneObject";

export function createManagedStagePrimitiveObject(
  declaration: NormalizedStagePrimitiveDeclaration,
): WebGLSceneObject {
  const geometry =
    declaration.kind === "plane"
      ? new PlaneGeometry(declaration.size[0], declaration.size[1])
      : new BoxGeometry(
          declaration.size[0],
          declaration.size[1],
          declaration.size[2],
        );
  const material = createMaterial(declaration.material);
  const mesh = new Mesh(geometry, material);
  let disposed = false;

  applyTransform(mesh, declaration.position, declaration.rotation, declaration.scale);
  mesh.visible = declaration.visible;

  return {
    key: declaration.id,
    object3D: mesh,
    setVisible(visible): void {
      mesh.visible = visible;
    },
    updateLayout(): void {
      return;
    },
    dispose(): void {
      if (disposed) {
        return;
      }

      disposed = true;
      geometry.dispose();
      material.dispose();
    },
  };
}

export function createManagedLightObject(
  declaration: NormalizedLightDeclaration,
): WebGLSceneObject {
  const object3D = createLightObject3D(declaration);
  let disposed = false;

  object3D.visible = declaration.visible;

  return {
    key: declaration.id,
    object3D,
    setVisible(visible): void {
      object3D.visible = visible;
    },
    updateLayout(): void {
      return;
    },
    dispose(): void {
      if (disposed) {
        return;
      }

      disposed = true;
      disposeObject(object3D);
    },
  };
}

function createMaterial(
  declaration: NormalizedStageMaterialDeclaration,
): MeshBasicMaterial | MeshStandardMaterial {
  switch (declaration.kind) {
    case "basic":
      return new MeshBasicMaterial({
        color: readColor(declaration.color),
        opacity: declaration.opacity,
        transparent: declaration.opacity < 1,
      });
    case "standard":
      return new MeshStandardMaterial({
        color: readColor(declaration.color),
        emissive: readColor(declaration.emissive),
        emissiveIntensity: declaration.emissiveIntensity,
        opacity: declaration.opacity,
        metalness: declaration.metalness,
        roughness: declaration.roughness,
        transparent: declaration.opacity < 1,
      });
  }
}

function createLightObject3D(declaration: NormalizedLightDeclaration): Object3D {
  switch (declaration.kind) {
    case "ambient": {
      const light = new AmbientLight(
        readColor(declaration.color),
        declaration.intensity,
      );
      light.visible = declaration.visible;
      return light;
    }
    case "directional": {
      const group = new Group();
      const light = new DirectionalLight(
        readColor(declaration.color),
        declaration.intensity,
      );
      const target = new Object3D();

      applyPosition(light, declaration.position);
      applyPosition(target, declaration.target);
      light.target = target;
      light.visible = declaration.visible;
      group.visible = declaration.visible;
      group.add(light);
      group.add(target);

      return group;
    }
    case "point": {
      const light = new PointLight(
        readColor(declaration.color),
        declaration.intensity,
        declaration.distance,
        declaration.decay,
      );

      applyPosition(light, declaration.position);
      light.visible = declaration.visible;
      return light;
    }
  }
}

function applyTransform(
  object: Object3D,
  position: WebGLTuple3,
  rotation: WebGLTuple3,
  scale: number | WebGLTuple3,
): void {
  applyPosition(object, position);
  object.rotation.set(rotation[0], rotation[1], rotation[2]);

  if (typeof scale === "number") {
    object.scale.setScalar(scale);
    return;
  }

  object.scale.set(scale[0], scale[1], scale[2]);
}

function applyPosition(object: Object3D, position: WebGLTuple3): void {
  object.position.set(position[0], position[1], position[2]);
}

function readColor(value: WebGLColorValue): string | number {
  if (typeof value === "string" || typeof value === "number") {
    return value;
  }

  return colorTupleToHex(value);
}

function colorTupleToHex(value: readonly [number, number, number]): number {
  const red = Math.round(Math.min(1, Math.max(0, value[0])) * 255);
  const green = Math.round(Math.min(1, Math.max(0, value[1])) * 255);
  const blue = Math.round(Math.min(1, Math.max(0, value[2])) * 255);

  return (red << 16) + (green << 8) + blue;
}

function disposeObject(object: Object3D): void {
  if (!("dispose" in object)) {
    return;
  }

  if (typeof object.dispose === "function") {
    object.dispose();
  }
}
