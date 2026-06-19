import { describe, expect, test } from "vitest";
import { PlaneGeometry } from "three/src/geometries/PlaneGeometry.js";
import { MeshBasicMaterial } from "three/src/materials/MeshBasicMaterial.js";
import { Mesh } from "three/src/objects/Mesh.js";

import { createElementPlaneEffectTarget } from "./elementPlaneEffectTarget";

describe("createElementPlaneEffectTarget", () => {
  test("applies solid material to an element plane", () => {
    const geometry = new PlaneGeometry(1, 1);
    const material = new MeshBasicMaterial({ transparent: true, opacity: 0 });
    const mesh = new Mesh(geometry, material);
    mesh.visible = false;

    const target = createElementPlaneEffectTarget(mesh, material);

    target.applySolidMaterial?.({ color: 0x112233, opacity: 0.42 });

    expect(mesh.visible).toBe(true);
    expect(material.transparent).toBe(true);
    expect(material.opacity).toBe(0.42);
    expect(material.color.getHex()).toBe(0x112233);

    geometry.dispose();
    material.dispose();
  });
});
