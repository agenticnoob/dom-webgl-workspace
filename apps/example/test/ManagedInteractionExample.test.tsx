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
  PointLight: THREE.PointLight,
});
Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
  configurable: true,
  value: true,
});

import { createElement } from "react";
import { create } from "@react-three/test-renderer";
import { Mesh, MeshStandardMaterial } from "three";
import { describe, expect, test, vi } from "vitest";
import {
  InteractiveFloor,
  InteractiveModel,
} from "../src/ManagedInteractionExample";

const useClonedModel = vi.hoisted(() => vi.fn());
vi.mock("../src/useClonedModel", () => ({ useClonedModel }));

describe("native scene picking", () => {
  test("real mesh hover and click mutate its owned native material", async () => {
    const renderer = await create(createElement(InteractiveFloor));
    const floor = renderer.scene.findByProps({
      name: "example.interaction.floor",
    });
    if (
      !(floor.instance instanceof Mesh) ||
      !(floor.instance.material instanceof MeshStandardMaterial)
    )
      throw new Error("Missing floor material");
    await renderer.advanceFrames(1, 1 / 60);
    expect(floor.instance.material.opacity).toBe(0.68);
    await renderer.fireEvent(floor, "pointerOver");
    await renderer.advanceFrames(1, 1 / 60);
    expect(floor.instance.material.opacity).toBe(0.92);
    await renderer.fireEvent(floor, "pointerOut");
    await renderer.advanceFrames(1, 1 / 60);
    expect(floor.instance.material.opacity).toBe(0.68);
    await renderer.fireEvent(floor, "click");
    await renderer.advanceFrames(1, 1 / 60);
    expect(floor.instance.material.opacity).toBe(1);
    expect(floor.instance.rotation.x).toBeCloseTo(-Math.PI / 2);
    await renderer.unmount();
  });

  test("model interaction owns material clones without mutating or disposing the GLTF cache", async () => {
    const cachedMaterial = new MeshStandardMaterial({ color: "#d8d8d8" });
    const geometry = new THREE.BoxGeometry();
    const cachedScene = new THREE.Group();
    cachedScene.add(new Mesh(geometry, cachedMaterial));
    const scene = cachedScene.clone(true);
    useClonedModel.mockReturnValue({ scene });
    const disposeCachedMaterial = vi.spyOn(cachedMaterial, "dispose");
    const disposeCachedGeometry = vi.spyOn(geometry, "dispose");
    const renderer = await create(createElement(InteractiveModel));
    const model = renderer.scene.findByProps({
      name: "example.interaction.hero",
    });
    const mesh = scene.children[0];
    if (
      !(mesh instanceof Mesh) ||
      !(mesh.material instanceof MeshStandardMaterial)
    )
      throw new Error("Missing model material");
    const ownedMaterial = mesh.material;
    const disposeOwnedMaterial = vi.spyOn(ownedMaterial, "dispose");
    expect(ownedMaterial).not.toBe(cachedMaterial);
    expect(ownedMaterial.color.getHexString()).toBe("d8d8d8");
    await renderer.advanceFrames(1, 1 / 60);
    expect(ownedMaterial.opacity).toBe(0.86);
    await renderer.fireEvent(model, "pointerOver");
    await renderer.advanceFrames(1, 1 / 60);
    expect(ownedMaterial.opacity).toBe(1);
    expect(cachedMaterial.opacity).toBe(1);
    expect(cachedMaterial.transparent).toBe(false);
    await renderer.unmount();
    expect(disposeOwnedMaterial).toHaveBeenCalledOnce();
    expect(disposeCachedMaterial).not.toHaveBeenCalled();
    expect(disposeCachedGeometry).not.toHaveBeenCalled();
    cachedMaterial.dispose();
    geometry.dispose();
  });
});
