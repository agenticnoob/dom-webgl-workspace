import type { Object3D } from "three/src/core/Object3D.js";
import { Group } from "three/src/objects/Group.js";

type SkeletonLike = {
  bones?: Object3D[];
  clone?: () => SkeletonLike;
};

type SkinnedMeshLike = Object3D & {
  isSkinnedMesh?: unknown;
  skeleton?: SkeletonLike;
  bindMatrix?: unknown;
  bind?: (skeleton: SkeletonLike, bindMatrix?: unknown) => void;
};

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

  if (!isCloneableObject3D(sceneObject)) {
    return sceneObject;
  }

  if (containsSkinnedMesh(sceneObject)) {
    return cloneSkeletonHierarchy(sceneObject);
  }

  return sceneObject.clone();
}

function isObject3D(object: unknown): object is Object3D {
  return (
    !!object &&
    typeof object === "object" &&
    "isObject3D" in object &&
    (object as { isObject3D?: unknown }).isObject3D === true
  );
}

function isCloneableObject3D(
  object: unknown,
): object is Object3D & { clone(): Object3D } {
  return (
    isObject3D(object) &&
    "clone" in object &&
    typeof (object as { clone?: unknown }).clone === "function"
  );
}

function containsSkinnedMesh(object: Object3D): boolean {
  let found = false;

  object.traverse((child) => {
    if (isSkinnedMesh(child)) {
      found = true;
    }
  });

  return found;
}

function cloneSkeletonHierarchy(object: Object3D): Object3D {
  const clonedObject = object.clone(true);
  const sourceByClone = new Map<Object3D, Object3D>();
  const cloneBySource = new Map<Object3D, Object3D>();

  parallelTraverse(object, clonedObject, (sourceNode, clonedNode) => {
    sourceByClone.set(clonedNode, sourceNode);
    cloneBySource.set(sourceNode, clonedNode);
  });

  clonedObject.traverse((clonedNode) => {
    const clonedMesh = readSkinnedMesh(clonedNode);

    if (!clonedMesh) {
      return;
    }

    const sourceMesh = readSkinnedMesh(sourceByClone.get(clonedNode));
    const clonedSkeleton = sourceMesh?.skeleton?.clone?.();

    if (!sourceMesh || !clonedSkeleton) {
      return;
    }

    const bones = sourceMesh.skeleton?.bones;

    if (Array.isArray(bones)) {
      clonedSkeleton.bones = bones.map((bone) => cloneBySource.get(bone) ?? bone);
    }

    if (typeof clonedMesh.bind === "function") {
      clonedMesh.bind(clonedSkeleton, clonedMesh.bindMatrix ?? sourceMesh.bindMatrix);
      return;
    }

    clonedMesh.skeleton = clonedSkeleton;
  });

  return clonedObject;
}

function parallelTraverse(
  sourceNode: Object3D,
  clonedNode: Object3D,
  visit: (sourceNode: Object3D, clonedNode: Object3D) => void,
): void {
  visit(sourceNode, clonedNode);

  for (let index = 0; index < sourceNode.children.length; index += 1) {
    const sourceChild = sourceNode.children[index];
    const clonedChild = clonedNode.children[index];

    if (sourceChild && clonedChild) {
      parallelTraverse(sourceChild, clonedChild, visit);
    }
  }
}

function readSkinnedMesh(object: Object3D | undefined): SkinnedMeshLike | undefined {
  if (!object || !isSkinnedMesh(object)) {
    return undefined;
  }

  return object;
}

function isSkinnedMesh(object: Object3D): object is SkinnedMeshLike {
  return (object as { isSkinnedMesh?: unknown }).isSkinnedMesh === true;
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
