import { extend } from "@react-three/fiber";
import * as THREE from "three";

extend({
  Mesh: THREE.Mesh,
  Group: THREE.Group,
  Object3D: THREE.Object3D,
  PlaneGeometry: THREE.PlaneGeometry,
  BoxGeometry: THREE.BoxGeometry,
  TetrahedronGeometry: THREE.TetrahedronGeometry,
  MeshStandardMaterial: THREE.MeshStandardMaterial,
  MeshBasicMaterial: THREE.MeshBasicMaterial,
  AmbientLight: THREE.AmbientLight,
  DirectionalLight: THREE.DirectionalLight,
  PointLight: THREE.PointLight,
});
Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
  configurable: true,
  value: true,
});

import { createElement } from "react";
import { create } from "@react-three/test-renderer";
import {
  Mesh,
  MeshStandardMaterial,
  MeshBasicMaterial,
  BoxGeometry,
  PlaneGeometry,
  TetrahedronGeometry,
  AmbientLight,
  DirectionalLight,
  PointLight,
} from "three";
import { describe, expect, test } from "vitest";
import { ManagedMeshScene } from "../src/ManagedMeshExample";

describe("native stage", () => {
  test("preserves stage geometry, orientation, palette and light arrangement", async () => {
    const renderer = await create(createElement(ManagedMeshScene));
    const floor = renderer.scene.findByProps({
      name: "example.stage.floor",
    }).instance;
    expect(floor).toBeInstanceOf(Mesh);
    if (!(floor instanceof Mesh)) throw new Error("Missing native floor");
    expect(floor.geometry).toBeInstanceOf(PlaneGeometry);
    if (!(floor.geometry instanceof PlaneGeometry))
      throw new Error("Missing plane geometry");
    expect(floor.geometry.parameters).toMatchObject({
      width: 900,
      height: 520,
    });
    expect(floor.position.toArray()).toEqual([0, -180, 0]);
    expect(floor.rotation.x).toBeCloseTo(-Math.PI / 2);
    expect(floor.material).toBeInstanceOf(MeshStandardMaterial);
    const rail = renderer.scene.findByProps({
      name: "example.stage.bloomRail",
    }).instance;
    if (!(rail instanceof Mesh)) throw new Error("Missing emissive rail");
    expect(rail.geometry).toBeInstanceOf(BoxGeometry);
    if (!(rail.geometry instanceof BoxGeometry))
      throw new Error("Missing box geometry");
    expect(rail.geometry.parameters).toMatchObject({
      width: 520,
      height: 18,
      depth: 22,
    });
    expect(rail.material).toBeInstanceOf(MeshBasicMaterial);
    const tetra = renderer.scene.findByProps({
      name: "example.stage.tetrahedron",
    }).instance;
    if (!(tetra instanceof Mesh)) throw new Error("Missing tetrahedron");
    expect(tetra.geometry).toBeInstanceOf(TetrahedronGeometry);
    expect(tetra.position.toArray()).toEqual([180, -82, -40]);
    const lights = renderer.scene.children
      .map((child) => child.instance)
      .filter(
        (object) =>
          object instanceof AmbientLight ||
          object instanceof DirectionalLight ||
          object instanceof PointLight,
      );
    expect(lights).toHaveLength(4);
    expect(lights.map((light) => light.intensity)).toEqual([0.83, 1, 2.6, 1.9]);
    const directional = lights.find(
      (light) => light instanceof DirectionalLight,
    );
    expect(directional?.position.toArray()).toEqual([1, 1.5, 2]);
    expect(directional?.color.getHexString()).toBe("ffffff");
    await renderer.unmount();
  });
});
