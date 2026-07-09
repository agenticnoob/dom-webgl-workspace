import type { Object3D } from "three/src/core/Object3D.js";
import { BoxGeometry } from "three/src/geometries/BoxGeometry.js";
import { MeshBasicMaterial } from "three/src/materials/MeshBasicMaterial.js";
import { Bone } from "three/src/objects/Bone.js";
import { Group } from "three/src/objects/Group.js";
import { SkinnedMesh } from "three/src/objects/SkinnedMesh.js";
import { Skeleton } from "three/src/objects/Skeleton.js";
import { describe, expect, test, vi } from "vitest";

describe("instantiateModelSceneObject", () => {
  test("uses ordinary Object3D clone for non-skinned model scenes", async () => {
    const { instantiateModelSceneObject } = await importModelSceneObjects();
    const source = new Group();
    const cloned = new Group();
    const clone = vi.spyOn(source, "clone").mockReturnValue(cloned);

    expect(instantiateModelSceneObject({ scene: source })).toBe(cloned);
    expect(clone).toHaveBeenCalledTimes(1);
  });

  test("uses skeleton-safe clone for skinned model scenes", async () => {
    const { instantiateModelSceneObject } = await importModelSceneObjects();
    const source = new Group();
    const hips = new Bone();
    const material = new MeshBasicMaterial();
    const mesh = new SkinnedMesh(new BoxGeometry(1, 1, 1), material);

    hips.name = "mixamorig:Hips";
    source.add(hips);
    source.add(mesh);
    mesh.bind(new Skeleton([hips]));

    const clonedSource = instantiateModelSceneObject({ scene: source });

    expect(clonedSource).toBeInstanceOf(Group);

    if (!(clonedSource instanceof Group)) {
      throw new Error("Expected skinned model clone to preserve the root group");
    }

    const clonedMesh = findSkinnedMesh(clonedSource);

    expect(clonedMesh).toBeDefined();

    if (!clonedMesh) {
      throw new Error("Expected skinned model clone to preserve the skinned mesh");
    }

    expect(clonedMesh).not.toBe(mesh);
    expect(clonedMesh.skeleton).not.toBe(mesh.skeleton);
    expect(clonedMesh.skeleton.bones[0]).not.toBe(hips);
    expect(clonedMesh.skeleton.bones[0]?.name).toBe("mixamorig:Hips");
    expect(clonedMesh.skeleton.bones[0]?.parent).toBe(clonedSource);
  });
});

function importModelSceneObjects() {
  return import("../../../../src/lib/render/renderables/modelSceneObjects");
}

function findSkinnedMesh(object: Object3D): SkinnedMesh | undefined {
  let result: SkinnedMesh | undefined;

  object.traverse((child) => {
    if ((child as { isSkinnedMesh?: unknown }).isSkinnedMesh === true) {
      result = child as SkinnedMesh;
    }
  });

  return result;
}
