import type { Object3D } from "three/src/core/Object3D.js";
import { Group } from "three/src/objects/Group.js";

export function createModelRuntimeRoot(modelScene: unknown): unknown {
  const group = new Group() as Group & { dispose?: () => void };

  if (isObject3D(modelScene)) {
    group.add(modelScene);
  }
  group.dispose = () => {
    disposeModelSceneObject(modelScene);
  };

  return group;
}

export function disposeModelSceneObject(modelScene: unknown): void {
  if (!modelScene || typeof modelScene !== "object") {
    return;
  }

  const dispose = (modelScene as { dispose?: unknown }).dispose;
  if (typeof dispose === "function") {
    dispose.call(modelScene);
  }
}

export function instantiateModelSceneObject(model: unknown): unknown {
  const sceneObject = readModelSceneObject(model);

  if (
    sceneObject &&
    typeof sceneObject === "object" &&
    "clone" in sceneObject &&
    typeof (sceneObject as { clone?: unknown }).clone === "function"
  ) {
    return (sceneObject as { clone: () => unknown }).clone();
  }

  return sceneObject;
}

function isObject3D(object: unknown): object is Object3D {
  return (
    !!object &&
    typeof object === "object" &&
    "isObject3D" in object &&
    (object as { isObject3D?: unknown }).isObject3D === true
  );
}

function readModelSceneObject(model: unknown): unknown {
  if (
    model &&
    typeof model === "object" &&
    "scene" in model &&
    (model as { scene?: unknown }).scene
  ) {
    return (model as { scene: unknown }).scene;
  }

  return model;
}
