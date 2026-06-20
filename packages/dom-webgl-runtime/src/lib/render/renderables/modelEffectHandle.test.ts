import { BufferAttribute } from "three/src/core/BufferAttribute.js";
import { BufferGeometry } from "three/src/core/BufferGeometry.js";
import { Group } from "three/src/objects/Group.js";
import { Mesh } from "three/src/objects/Mesh.js";
import { MeshBasicMaterial } from "three/src/materials/MeshBasicMaterial.js";
import { Points } from "three/src/objects/Points.js";
import { describe, expect, test } from "vitest";

import { createModelEffectHandle } from "./modelEffectHandle";

describe("createModelEffectHandle", () => {
  test("samples mesh vertices in the model root coordinate space", () => {
    const root = new Group();
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      "position",
      new BufferAttribute(new Float32Array([1, 2, 3]), 3),
    );
    const mesh = new Mesh(geometry, new MeshBasicMaterial());
    mesh.position.set(10, 20, 30);
    root.add(mesh);

    const pointCloud = createModelEffectHandle(root).createPointCloud({
      density: 1,
    }) as Points;
    const positions = pointCloud.geometry.getAttribute("position").array;

    expect(Array.from(positions)).toEqual([11, 22, 33]);
  });
});
