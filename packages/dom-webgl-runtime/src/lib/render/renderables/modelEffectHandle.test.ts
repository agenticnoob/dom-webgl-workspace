import { BufferAttribute } from "three/src/core/BufferAttribute.js";
import { BufferGeometry } from "three/src/core/BufferGeometry.js";
import { Group } from "three/src/objects/Group.js";
import { Mesh } from "three/src/objects/Mesh.js";
import type { Material } from "three/src/materials/Material.js";
import { MeshBasicMaterial } from "three/src/materials/MeshBasicMaterial.js";
import { ShaderMaterial } from "three/src/materials/ShaderMaterial.js";
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

  test("exposes controlled mesh handles that restore original material arrays", () => {
    const root = new Group();
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      "position",
      new BufferAttribute(new Float32Array([0, 0, 0]), 3),
    );
    const firstMaterial = new MeshBasicMaterial({ name: "first" });
    const secondMaterial = new MeshBasicMaterial({ name: "second" });
    const originalMaterials = [firstMaterial, secondMaterial];
    const mesh = new Mesh(geometry, originalMaterials);
    mesh.name = "product-shell";
    root.add(mesh);

    const [meshHandle] = createModelEffectHandle(root).getMeshes();
    const layer = meshHandle?.createMaterialLayer({
      key: "model.mesh",
      program: {
        fragmentShader: "void main(){ gl_FragColor = vec4(1.0); }",
      },
    });

    expect(meshHandle).toMatchObject({
      index: 0,
      name: "product-shell",
      materialName: "first",
    });
    expect(mesh.material).toBeInstanceOf(ShaderMaterial);

    layer?.dispose();
    meshHandle?.restoreMaterial();

    expect(mesh.material).toBe(originalMaterials);
  });

  test("creates managed point layers and disposes generated geometry/material once", () => {
    const root = new Group();
    const handle = createModelEffectHandle(root);
    const layer = handle.createPointLayer({
      positions: new Float32Array([0, 0, 0, 1, 1, 1]),
      color: "#7dd3fc",
      size: 0.04,
    });
    const points = root.children[0] as Points;
    const geometryDispose = vi.spyOn(points.geometry, "dispose");
    const materialDispose = vi.spyOn(readPointsMaterial(points), "dispose");

    layer.setVisible(false);
    expect(points.visible).toBe(false);

    layer.dispose();
    layer.dispose();

    expect(root.children).toHaveLength(0);
    expect(geometryDispose).toHaveBeenCalledTimes(1);
    expect(materialDispose).toHaveBeenCalledTimes(1);
  });
});

function readPointsMaterial(points: Points): Material {
  if (Array.isArray(points.material)) {
    throw new Error("Expected a single points material.");
  }

  return points.material;
}
