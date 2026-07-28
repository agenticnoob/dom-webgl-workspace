import { describe, expect, test, vi } from "vitest";
import { MeshPhysicalMaterial } from "three/src/materials/MeshPhysicalMaterial.js";
import { MeshStandardMaterial } from "three/src/materials/MeshStandardMaterial.js";

import type { WebGLEffectMaterialShaderFacade } from "../../../../src/lib/effects/effectMaterial";
import { createManagedMaterialFacade } from "../../../../src/lib/render/renderables/managedMaterialControls";

describe("managed material controls", () => {
  test("exposes only an injected controlled shader facade", () => {
    const material = new MeshStandardMaterial();
    const shader = {
      onBeforeCompile: vi.fn(),
      setUniforms: vi.fn(),
      remove: vi.fn(),
    } satisfies WebGLEffectMaterialShaderFacade;

    const facade = createManagedMaterialFacade({ material, shader });

    expect(facade.shader).toBe(shader);
    if (!facade.shader) {
      throw new Error("Expected a managed shader facade.");
    }
    expect("material" in facade.shader).toBe(false);
    expect("dispose" in facade.shader).toBe(false);
  });

  test("writes controlled base properties without exposing a layer host", () => {
    const material = new MeshStandardMaterial();
    const facade = createManagedMaterialFacade({ material });

    facade.color.set("#123456");
    facade.emissive.set("#654321", 1.4);
    facade.opacity = 0.6;
    facade.metalness = 0.25;
    facade.roughness = 0.75;

    expect(material.color.getHexString()).toBe("123456");
    expect(material.emissive.getHexString()).toBe("654321");
    expect(material.emissiveIntensity).toBe(1.4);
    expect(material.opacity).toBe(0.6);
    expect(material.transparent).toBe(true);
    expect(material.metalness).toBe(0.25);
    expect(material.roughness).toBe(0.75);
    expect(facade.physical).toBeUndefined();
    expect(() =>
      facade.createLayer({
        key: "not.available",
        program: { fragmentShader: "void main() {}" },
      }),
    ).toThrow("This WebGL object does not expose a material layer host.");
  });

  test("exposes physical controls only when every material entry is physical", () => {
    const first = new MeshPhysicalMaterial();
    const second = new MeshPhysicalMaterial();
    const initialVersions = [first.version, second.version];
    const facade = createManagedMaterialFacade({ material: [first, second] });

    expect(facade.physical).toBeDefined();
    if (!facade.physical) {
      throw new Error("Expected physical material controls.");
    }

    facade.physical.transmission = 0.72;
    facade.physical.thickness = 1.8;
    facade.physical.ior = 1.66;

    for (const [index, material] of [first, second].entries()) {
      expect(material.transmission).toBe(0.72);
      expect(material.thickness).toBe(1.8);
      expect(material.ior).toBe(1.66);
      expect(material.version).toBeGreaterThan(initialVersions[index] ?? 0);
    }
  });

  test("hides physical controls for mixed, empty, and non-physical arrays", () => {
    const physical = new MeshPhysicalMaterial();
    const standard = new MeshStandardMaterial();

    expect(
      createManagedMaterialFacade({ material: [physical, standard] }).physical,
    ).toBeUndefined();
    expect(createManagedMaterialFacade({ material: [] }).physical).toBeUndefined();
    expect(
      createManagedMaterialFacade({ material: [standard] }).physical,
    ).toBeUndefined();
  });

  test("clamps physical setters consistently across material arrays", () => {
    const entries = [new MeshPhysicalMaterial(), new MeshPhysicalMaterial()];
    const facade = createManagedMaterialFacade({ material: entries });
    const physical = facade.physical;
    if (!physical) {
      throw new Error("Expected physical material controls.");
    }

    physical.transmission = 2;
    physical.thickness = -4;
    physical.ior = Number.NaN;

    for (const material of entries) {
      expect(material.transmission).toBe(1);
      expect(material.thickness).toBe(0);
      expect(material.ior).toBe(1.5);
    }
  });
});
