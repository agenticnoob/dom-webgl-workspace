import { describe, expect, test, vi } from "vitest";
import { PlaneGeometry } from "three/src/geometries/PlaneGeometry.js";
import { MeshBasicMaterial } from "three/src/materials/MeshBasicMaterial.js";
import { Mesh } from "three/src/objects/Mesh.js";

import { createElementPlaneEffectTarget } from "./elementPlaneEffectTarget";

describe("createElementPlaneEffectTarget", () => {
  test("applies generic visibility transform and opacity controls", () => {
    const geometry = new PlaneGeometry(1, 1);
    const material = new MeshBasicMaterial({ transparent: true, opacity: 0 });
    const mesh = new Mesh(geometry, material);
    mesh.visible = false;

    const target = createElementPlaneEffectTarget(mesh, material);

    target.setVisible(true);
    target.setRotation(0.1, -0.2, 0.3);
    target.setScale(1.2, 0.9, 1);
    target.setOpacity(0.42);

    expect(mesh.visible).toBe(true);
    expect(mesh.rotation.x).toBe(0.1);
    expect(mesh.rotation.y).toBe(-0.2);
    expect(mesh.rotation.z).toBe(0.3);
    expect(mesh.scale.x).toBe(1.2);
    expect(mesh.scale.y).toBe(0.9);
    expect(material.opacity).toBe(0.42);
    expect(material.transparent).toBe(true);

    geometry.dispose();
    material.dispose();
  });

  test("forwards managed object creation to the scene adapter callback", () => {
    const geometry = new PlaneGeometry(1, 1);
    const material = new MeshBasicMaterial();
    const mesh = new Mesh(geometry, material);
    const dispose = vi.fn();
    const managedHandle = {
      setVisible: vi.fn(),
      remove: vi.fn(),
      dispose: vi.fn(),
    };
    const addObject3D = vi.fn(() => managedHandle);
    const target = createElementPlaneEffectTarget(mesh, material, addObject3D);
    const object3D = {};

    const handle = target.addObject3D?.(object3D, { dispose });

    expect(addObject3D).toHaveBeenCalledWith(object3D, { dispose });
    expect(handle).toBe(managedHandle);

    geometry.dispose();
    material.dispose();
  });
});
