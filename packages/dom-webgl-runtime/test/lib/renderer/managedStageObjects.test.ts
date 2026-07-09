import { describe, expect, test, vi } from "vitest";

import type {
  NormalizedLightDeclaration,
  NormalizedStagePrimitiveDeclaration,
} from "../../../src/lib/renderer/stageDeclarations";

describe("managed stage object factories", () => {
  test("creates a runtime-owned plane mesh from a normalized declaration", async () => {
    vi.resetModules();
    const geometry = createDisposable("geometry");
    const material = createDisposable("material");
    const mesh = createObject3D("mesh");
    const mocks = installThreeMocks({
      PlaneGeometry: vi.fn(() => geometry),
      MeshStandardMaterial: vi.fn(() => material),
      Mesh: vi.fn(() => mesh),
    });
    const { createManagedStagePrimitiveObject } = await import(
      "../../../src/lib/renderer/managedStageObjects"
    );

    const normalizedFloor = {
      id: "floor",
      sceneId: "world",
      kind: "plane",
      role: "floor",
      size: [1200, 800],
      position: [0, -180, 0],
      rotation: [-Math.PI / 2, 0, 0],
      scale: 1,
      visible: true,
      material: {
        kind: "standard",
        color: "#05070a",
        emissive: "#000000",
        emissiveIntensity: 1,
        opacity: 1,
        metalness: 0,
        roughness: 0.8,
      },
    } satisfies NormalizedStagePrimitiveDeclaration;

    const object = createManagedStagePrimitiveObject(normalizedFloor);

    expect(mocks.PlaneGeometry).toHaveBeenCalledWith(1200, 800);
    expect(mocks.MeshStandardMaterial).toHaveBeenCalledWith(
      expect.objectContaining({
        color: "#05070a",
        emissive: "#000000",
        emissiveIntensity: 1,
        roughness: 0.8,
      }),
    );
    expect(mocks.Mesh).toHaveBeenCalledWith(geometry, material);
    expect(mesh.position.set).toHaveBeenCalledWith(0, -180, 0);
    expect(mesh.rotation.set).toHaveBeenCalledWith(-Math.PI / 2, 0, 0);
    expect(mesh.scale.setScalar).toHaveBeenCalledWith(1);
    expect(object.key).toBe("floor");
    expect(object.object3D).toBe(mesh);

    object.setVisible(false);
    expect(mesh.visible).toBe(false);

    object.dispose();
    object.dispose();

    expect(geometry.dispose).toHaveBeenCalledTimes(1);
    expect(material.dispose).toHaveBeenCalledTimes(1);
  });

  test("creates a directional light with a managed target object", async () => {
    vi.resetModules();
    const group = createObject3D("group");
    const targetObject = createObject3D("target");
    const directionalLight = createObject3D("directional-light");
    const mocks = installThreeMocks({
      Group: vi.fn(() => group),
      Object3D: vi.fn(() => targetObject),
      DirectionalLight: vi.fn(() => directionalLight),
    });
    const { createManagedLightObject } = await import(
      "../../../src/lib/renderer/managedStageObjects"
    );
    const normalizedDirectionalLight = {
      id: "hero",
      sceneId: "world",
      kind: "directional",
      color: "#ffffff",
      intensity: 1,
      position: [0, 0, 120],
      target: [0, 0, 0],
      distance: 0,
      decay: 2,
      visible: true,
    } satisfies NormalizedLightDeclaration;

    const lightObject = createManagedLightObject(normalizedDirectionalLight);

    expect(mocks.DirectionalLight).toHaveBeenCalledWith("#ffffff", 1);
    expect(group.add).toHaveBeenCalledWith(directionalLight);
    expect(group.add).toHaveBeenCalledWith(targetObject);
    expect(directionalLight.position.set).toHaveBeenCalledWith(0, 0, 120);
    expect(targetObject.position.set).toHaveBeenCalledWith(0, 0, 0);
    expect(directionalLight.target).toBe(targetObject);
    expect(lightObject.key).toBe("hero");
    expect(lightObject.object3D).toBe(group);

    lightObject.dispose();
    lightObject.dispose();
  });
});

type Disposable = {
  kind: string;
  dispose: ReturnType<typeof vi.fn>;
};

type FakeObject3D = {
  kind: string;
  visible: boolean;
  add: ReturnType<typeof vi.fn>;
  position: { set: ReturnType<typeof vi.fn> };
  rotation: { set: ReturnType<typeof vi.fn> };
  scale: { set: ReturnType<typeof vi.fn>; setScalar: ReturnType<typeof vi.fn> };
  target?: FakeObject3D;
};

type ThreeMocks = {
  PlaneGeometry: ReturnType<typeof vi.fn>;
  BoxGeometry: ReturnType<typeof vi.fn>;
  MeshBasicMaterial: ReturnType<typeof vi.fn>;
  MeshStandardMaterial: ReturnType<typeof vi.fn>;
  Mesh: ReturnType<typeof vi.fn>;
  Group: ReturnType<typeof vi.fn>;
  AmbientLight: ReturnType<typeof vi.fn>;
  DirectionalLight: ReturnType<typeof vi.fn>;
  PointLight: ReturnType<typeof vi.fn>;
  Object3D: ReturnType<typeof vi.fn>;
};

function installThreeMocks(overrides: Partial<ThreeMocks>): ThreeMocks {
  const mocks = {
    PlaneGeometry: vi.fn(() => createDisposable("plane-geometry")),
    BoxGeometry: vi.fn(() => createDisposable("box-geometry")),
    MeshBasicMaterial: vi.fn(() => createDisposable("basic-material")),
    MeshStandardMaterial: vi.fn(() => createDisposable("standard-material")),
    Mesh: vi.fn(() => createObject3D("mesh")),
    Group: vi.fn(() => createObject3D("group")),
    AmbientLight: vi.fn(() => createObject3D("ambient-light")),
    DirectionalLight: vi.fn(() => createObject3D("directional-light")),
    PointLight: vi.fn(() => createObject3D("point-light")),
    Object3D: vi.fn(() => createObject3D("object")),
    ...overrides,
  };

  vi.doMock("three/src/geometries/PlaneGeometry.js", () => ({
    PlaneGeometry: mocks.PlaneGeometry,
  }));
  vi.doMock("three/src/geometries/BoxGeometry.js", () => ({
    BoxGeometry: mocks.BoxGeometry,
  }));
  vi.doMock("three/src/materials/MeshBasicMaterial.js", () => ({
    MeshBasicMaterial: mocks.MeshBasicMaterial,
  }));
  vi.doMock("three/src/materials/MeshStandardMaterial.js", () => ({
    MeshStandardMaterial: mocks.MeshStandardMaterial,
  }));
  vi.doMock("three/src/objects/Mesh.js", () => ({ Mesh: mocks.Mesh }));
  vi.doMock("three/src/objects/Group.js", () => ({ Group: mocks.Group }));
  vi.doMock("three/src/lights/AmbientLight.js", () => ({
    AmbientLight: mocks.AmbientLight,
  }));
  vi.doMock("three/src/lights/DirectionalLight.js", () => ({
    DirectionalLight: mocks.DirectionalLight,
  }));
  vi.doMock("three/src/lights/PointLight.js", () => ({
    PointLight: mocks.PointLight,
  }));
  vi.doMock("three/src/core/Object3D.js", () => ({
    Object3D: mocks.Object3D,
  }));

  return mocks;
}

function createDisposable(kind: string): Disposable {
  return {
    kind,
    dispose: vi.fn(),
  };
}

function createObject3D(kind: string): FakeObject3D {
  return {
    kind,
    visible: true,
    add: vi.fn(),
    position: { set: vi.fn() },
    rotation: { set: vi.fn() },
    scale: { set: vi.fn(), setScalar: vi.fn() },
  };
}
