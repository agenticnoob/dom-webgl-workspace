import type { WebGLTuple3 } from "../types";

import type { WebGLSceneObject } from "./sceneObject";

export type SceneObjectTransformSnapshot = {
  readonly position: WebGLTuple3;
  readonly rotation: WebGLTuple3;
  readonly scale: WebGLTuple3;
};

type Object3DTransformLike = {
  readonly position?: Object3DVectorLike;
  readonly rotation?: Object3DVectorLike;
  readonly scale?: Object3DVectorLike;
};

type Object3DVectorLike = {
  set?(x: number, y: number, z: number): void;
  x?: number;
  y?: number;
  z?: number;
};

export function readSceneObjectTransform(
  object: WebGLSceneObject,
): SceneObjectTransformSnapshot {
  const object3D = readObject3D(object.object3D);

  return {
    position: readTuple3(object3D?.position, [0, 0, 0]),
    rotation: readTuple3(object3D?.rotation, [0, 0, 0]),
    scale: readTuple3(object3D?.scale, [1, 1, 1]),
  };
}

export function writeSceneObjectPosition(
  object: WebGLSceneObject,
  position: WebGLTuple3,
): void {
  setTuple3(readObject3D(object.object3D)?.position, position);
}

function readObject3D(object3D: unknown): Object3DTransformLike | undefined {
  if (!object3D || typeof object3D !== "object") {
    return undefined;
  }

  return object3D as Object3DTransformLike;
}

function readTuple3(
  vector: Object3DVectorLike | undefined,
  fallback: WebGLTuple3,
): WebGLTuple3 {
  if (!vector) {
    return fallback;
  }

  return [
    readFiniteNumber(vector.x, fallback[0]),
    readFiniteNumber(vector.y, fallback[1]),
    readFiniteNumber(vector.z, fallback[2]),
  ];
}

function setTuple3(
  target: Object3DVectorLike | undefined,
  value: WebGLTuple3,
): void {
  if (!target) {
    return;
  }

  if (typeof target.set === "function") {
    target.set(value[0], value[1], value[2]);
    return;
  }

  target.x = value[0];
  target.y = value[1];
  target.z = value[2];
}

function readFiniteNumber(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) ? value : fallback;
}
