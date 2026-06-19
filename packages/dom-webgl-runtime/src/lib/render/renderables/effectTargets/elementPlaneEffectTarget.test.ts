import { describe, expect, test, vi } from "vitest";
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

    const target = createElementPlaneEffectTarget(
      mesh,
      material,
      createDocumentWithCanvas(),
    );

    target.applySolidMaterial?.({ color: 0x112233, opacity: 0.42 });

    expect(mesh.visible).toBe(true);
    expect(material.transparent).toBe(true);
    expect(material.opacity).toBe(0.42);
    expect(material.color.getHex()).toBe(0x112233);

    geometry.dispose();
    material.dispose();
  });

  test("applies minimal surface material through a canvas texture", () => {
    const geometry = new PlaneGeometry(1, 1);
    const material = new MeshBasicMaterial();
    const mesh = new Mesh(geometry, material);
    mesh.visible = false;
    const target = createElementPlaneEffectTarget(
      mesh,
      material,
      createDocumentWithCanvas(),
    );

    target.applySurfaceMaterial?.(
      { color: 0x111827, opacity: 0.84, radius: 16 },
      { width: 240, height: 120, devicePixelRatio: 1 },
    );

    expect(mesh.visible).toBe(true);
    expect(material.transparent).toBe(true);
    expect(material.opacity).toBe(1);
    expect(material.map).toBeTruthy();

    target.disposeEffects?.();
    geometry.dispose();
    material.dispose();
  });
});

function createDocumentWithCanvas(): Document {
  const canvas = document.createElement("canvas");
  const context = {
    beginPath: vi.fn(),
    clearRect: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    lineTo: vi.fn(),
    moveTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
  } as unknown as CanvasRenderingContext2D;

  Object.defineProperty(canvas, "getContext", {
    value: vi.fn(() => context),
  });

  return {
    ...document,
    createElement: vi.fn((tagName: string) =>
      tagName === "canvas" ? canvas : document.createElement(tagName),
    ),
  } as unknown as Document;
}
