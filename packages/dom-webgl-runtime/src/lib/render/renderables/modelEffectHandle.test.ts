import { BufferAttribute } from "three/src/core/BufferAttribute.js";
import { BufferGeometry } from "three/src/core/BufferGeometry.js";
import { Group } from "three/src/objects/Group.js";
import { Mesh } from "three/src/objects/Mesh.js";
import { MeshBasicMaterial } from "three/src/materials/MeshBasicMaterial.js";
import { Points } from "three/src/objects/Points.js";
import { describe, expect, test, vi } from "vitest";

import { createModelEffectHandle } from "./modelEffectHandle";

describe("createModelEffectHandle", () => {
  test("exposes common renderable controls for loaded models", () => {
    const material = { opacity: 1, transparent: false, needsUpdate: false };
    const object3D = {
      visible: true,
      rotation: { set: vi.fn() },
      scale: { set: vi.fn() },
      children: [{ material }],
    };
    const handle = createModelEffectHandle(object3D);

    handle.setVisible?.(false);
    handle.setRotation?.(0, 1, 0);
    handle.setScale?.(1.2);
    handle.setOpacity?.(0.6);

    expect(object3D.visible).toBe(false);
    expect(object3D.rotation.set).toHaveBeenCalledWith(0, 1, 0);
    expect(object3D.scale.set).toHaveBeenCalledWith(1.2, 1.2, 1.2);
    expect(material).toMatchObject({
      opacity: 0.6,
      transparent: true,
      needsUpdate: true,
    });
  });

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

  test("caps sampled vertices across multiple meshes", () => {
    const root = new Group();
    const firstGeometry = new BufferGeometry();
    firstGeometry.setAttribute(
      "position",
      new BufferAttribute(new Float32Array([1, 0, 0, 2, 0, 0]), 3),
    );
    const secondGeometry = new BufferGeometry();
    secondGeometry.setAttribute(
      "position",
      new BufferAttribute(new Float32Array([3, 0, 0, 4, 0, 0]), 3),
    );
    root.add(new Mesh(firstGeometry, new MeshBasicMaterial()));
    root.add(new Mesh(secondGeometry, new MeshBasicMaterial()));

    const vertices = createModelEffectHandle(root).sampleVertices({
      maxPoints: 1,
    });

    expect(vertices.length).toBe(3);
  });
});
