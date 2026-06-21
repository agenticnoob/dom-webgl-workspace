import { BufferAttribute } from "three/src/core/BufferAttribute.js";
import { BufferGeometry } from "three/src/core/BufferGeometry.js";
import { Matrix4 } from "three/src/math/Matrix4.js";
import { Vector3 } from "three/src/math/Vector3.js";
import { PointsMaterial } from "three/src/materials/PointsMaterial.js";
import { Points } from "three/src/objects/Points.js";

import type { WebGLModelEffectHandle } from "../../effects/effectAuthoring";

export function createModelEffectHandle(object3D: unknown): WebGLModelEffectHandle {
  return {
    object3D,
    setVisible(visible) {
      if (object3D && typeof object3D === "object") {
        (object3D as { visible?: boolean }).visible = visible;
      }
    },
    setRotation(x, y, z) {
      const rotation = (object3D as { rotation?: unknown } | undefined)?.rotation;
      if (rotation && typeof rotation === "object" && "set" in rotation) {
        (rotation as { set: (x: number, y: number, z: number) => void }).set(
          x,
          y,
          z ?? 0,
        );
      }
    },
    setScale(x, y = x, z = x) {
      const scale = (object3D as { scale?: unknown } | undefined)?.scale;
      if (scale && typeof scale === "object" && "set" in scale) {
        (scale as { set: (x: number, y: number, z: number) => void }).set(
          x,
          y,
          z,
        );
      }
    },
    setOpacity(opacity) {
      traverseObject(object3D, (candidate) => {
        const material = (candidate as { material?: unknown } | undefined)
          ?.material;
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
      });
    },
    traverseMeshes(visitor) {
      traverseObject(object3D, (candidate) => {
        if (isMeshLike(candidate)) {
          visitor(candidate);
        }
      });
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

function sampleModelVertices(object3D: unknown, maxPoints: number): Float32Array {
  const vertices: number[] = [];
  const rootInverse = readRootInverseMatrix(object3D);
  const vertex = new Vector3();

  traverseObject(object3D, (candidate) => {
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
      if (vertices.length / 3 >= maxPoints) {
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
