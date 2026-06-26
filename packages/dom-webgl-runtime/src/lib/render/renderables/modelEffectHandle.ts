import { BufferAttribute } from "three/src/core/BufferAttribute.js";
import { BufferGeometry } from "three/src/core/BufferGeometry.js";
import { Matrix4 } from "three/src/math/Matrix4.js";
import { Vector3 } from "three/src/math/Vector3.js";
import { PointsMaterial } from "three/src/materials/PointsMaterial.js";
import { Points } from "three/src/objects/Points.js";

import type {
  WebGLEffectManagedObjectHandle,
  WebGLEffectMaterialLayerHandle,
  WebGLEffectPointLayerOptions,
  WebGLModelEffectHandle,
  WebGLModelMeshHandle,
} from "../../effects/effectAuthoring";
import { createMaterialLayer } from "./materialLayer";
import { createObject3DControls } from "./object3DControls";

export function createModelEffectHandle(object3D: unknown): WebGLModelEffectHandle {
  return {
    ...createObject3DControls(object3D, {
      scaleZ: "x",
      opacity: { kind: "object" },
    }),
    traverseMeshes(visitor) {
      traverseObject(object3D, (candidate) => {
        if (isMeshLike(candidate)) {
          visitor(candidate);
        }
      });
    },
    getMeshes() {
      return collectMeshHandles(object3D);
    },
    forEachMesh(visitor) {
      for (const mesh of collectMeshHandles(object3D)) {
        visitor(mesh);
      }
    },
    sampleVertices(options = {}) {
      return sampleModelVertices(object3D, options.maxPoints ?? 2048);
    },
    createPointCloud(options) {
      const vertices = sampleModelVertices(
        object3D,
        Math.max(1, Math.floor(2048 * (options.density ?? 1))),
      );
      const geometry = new BufferGeometry();
      geometry.setAttribute("position", new BufferAttribute(vertices, 3));
      const material = new PointsMaterial({
        color: options.color ?? 0xffffff,
        size: options.size ?? 0.02,
      });

      return new Points(geometry, material);
    },
    createPointLayer(options) {
      return createPointLayer(object3D, options);
    },
  };
}

function collectMeshHandles(object3D: unknown): readonly WebGLModelMeshHandle[] {
  const meshes: WebGLModelMeshHandle[] = [];

  traverseObject(object3D, (candidate) => {
    if (isMeshLike(candidate)) {
      meshes.push(createModelMeshHandle(candidate, meshes.length));
    }
  });

  return meshes;
}

function createModelMeshHandle(mesh: unknown, index: number): WebGLModelMeshHandle {
  const materialName = readMaterialName(mesh);
  const activeLayers: WebGLEffectMaterialLayerHandle[] = [];

  return {
    ...createObject3DControls(mesh, {
      scaleZ: "x",
      opacity: { kind: "object" },
    }),
    object3D: mesh,
    index,
    name: readStringProperty(mesh, "name"),
    materialName,
    createMaterialLayer(options) {
      const layer = createMaterialLayer({
        ...options,
        target: createMaterialTarget(mesh),
      });
      activeLayers.push(layer);
      return layer;
    },
    restoreMaterial() {
      for (const layer of activeLayers.splice(0)) {
        layer.dispose();
      }
    },
  };
}

function createPointLayer(
  object3D: unknown,
  options: WebGLEffectPointLayerOptions,
): WebGLEffectManagedObjectHandle {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(options.positions, 3));
  const material = new PointsMaterial({
    color: options.color ?? 0xffffff,
    size: options.size ?? 0.02,
  });
  const points = new Points(geometry, material);
  const materialLayer = options.material
    ? createMaterialLayer({
        key: "model.pointLayer",
        target: points,
        program: options.material,
      })
    : undefined;
  let disposed = false;

  addChild(object3D, points);

  return {
    setVisible(visible) {
      points.visible = visible;
    },
    remove() {
      removeChild(object3D, points);
    },
    dispose() {
      if (disposed) {
        return;
      }

      disposed = true;
      removeChild(object3D, points);
      materialLayer?.dispose();
      geometry.dispose();
      material.dispose();
    },
  };
}

function traverseObject(object3D: unknown, visitor: (object: unknown) => void): void {
  if (!object3D || typeof object3D !== "object") {
    return;
  }

  visitor(object3D);

  const children = (object3D as { children?: unknown }).children;
  if (Array.isArray(children)) {
    for (const child of children) {
      traverseObject(child, visitor);
    }
  }
}

function isMeshLike(object: unknown): boolean {
  return Boolean(
    object &&
      typeof object === "object" &&
      "geometry" in object &&
      (object as { geometry?: unknown }).geometry,
  );
}

function readStringProperty(object: unknown, key: string): string | undefined {
  if (!object || typeof object !== "object" || !(key in object)) {
    return undefined;
  }

  const value = (object as Record<string, unknown>)[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readMaterialName(object: unknown): string | undefined {
  if (!object || typeof object !== "object" || !("material" in object)) {
    return undefined;
  }

  const material = (object as { material?: unknown }).material;
  if (Array.isArray(material)) {
    for (const entry of material) {
      const name = readStringProperty(entry, "name");
      if (name) {
        return name;
      }
    }
    return undefined;
  }

  return readStringProperty(material, "name");
}

function addChild(parent: unknown, child: unknown): void {
  if (parent && typeof parent === "object" && "add" in parent) {
    (parent as { add: (child: unknown) => void }).add(child);
  }
}

function removeChild(parent: unknown, child: unknown): void {
  if (parent && typeof parent === "object" && "remove" in parent) {
    (parent as { remove: (child: unknown) => void }).remove(child);
  }
}

function createMaterialTarget(mesh: unknown): { material: unknown } {
  if (mesh && typeof mesh === "object" && "material" in mesh) {
    return mesh as { material: unknown };
  }

  return { material: undefined };
}

function sampleModelVertices(object3D: unknown, maxPoints: number): Float32Array {
  const vertices: number[] = [];
  const rootInverse = readRootInverseMatrix(object3D);
  const vertex = new Vector3();
  let sampledPoints = 0;

  traverseObject(object3D, (candidate) => {
    if (sampledPoints >= maxPoints) {
      return;
    }

    const mesh = candidate as {
      geometry?: {
        attributes?: {
          position?: { array?: ArrayLike<number>; count?: number };
        };
      };
      matrixWorld?: Matrix4;
      updateWorldMatrix?: (updateParents: boolean, updateChildren: boolean) => void;
    };
    const position = mesh.geometry?.attributes?.position;

    if (!position?.array || !position.count) {
      return;
    }

    mesh.updateWorldMatrix?.(true, false);
    const stride = Math.max(1, Math.ceil(position.count / Math.max(1, maxPoints)));
    for (let index = 0; index < position.count; index += stride) {
      const offset = index * 3;
      vertex
        .set(
          Number(position.array[offset] ?? 0),
          Number(position.array[offset + 1] ?? 0),
          Number(position.array[offset + 2] ?? 0),
        )
        .applyMatrix4(mesh.matrixWorld ?? identityMatrix)
        .applyMatrix4(rootInverse);

      vertices.push(
        vertex.x,
        vertex.y,
        vertex.z,
      );
      sampledPoints += 1;
      if (sampledPoints >= maxPoints) {
        return;
      }
    }
  });

  return new Float32Array(vertices);
}

const identityMatrix = new Matrix4();

function readRootInverseMatrix(object3D: unknown): Matrix4 {
  const root = object3D as {
    matrixWorld?: Matrix4;
    updateWorldMatrix?: (updateParents: boolean, updateChildren: boolean) => void;
  };

  root.updateWorldMatrix?.(true, true);

  if (!root.matrixWorld) {
    return identityMatrix.clone();
  }

  return root.matrixWorld.clone().invert();
}
