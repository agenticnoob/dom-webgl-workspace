import { describe, expect, test, vi } from "vitest";
import { BufferGeometry } from "three/src/core/BufferGeometry.js";
import { Float32BufferAttribute } from "three/src/core/BufferAttribute.js";
import { MeshPhysicalMaterial } from "three/src/materials/MeshPhysicalMaterial.js";
import { Mesh } from "three/src/objects/Mesh.js";

import type {
  NormalizedLightDeclaration,
  NormalizedMeshDeclaration,
  NormalizedMeshGeometryDeclaration,
  NormalizedMeshMaterialDeclaration,
} from "../../../src/lib/renderer/stageDeclarations";

describe("managed mesh object factory", () => {
  test("creates every built-in geometry with normalized constructor arguments", async () => {
    vi.resetModules();
    const mocks = installThreeMocks({});
    const { createManagedMeshObject } = await import(
      "../../../src/lib/renderer/managedStageObjects"
    );

    createManagedMeshObject(
      createNormalizedMesh({ kind: "plane", role: "floor", size: [12, 8] }),
    );
    createManagedMeshObject(
      createNormalizedMesh({ kind: "box", size: [2, 3, 4] }),
    );
    createManagedMeshObject(
      createNormalizedMesh({
        kind: "sphere",
        radius: 2,
        widthSegments: 24,
        heightSegments: 12,
      }),
    );
    createManagedMeshObject(
      createNormalizedMesh({
        kind: "cylinder",
        radiusTop: 0.5,
        radiusBottom: 1.5,
        height: 3,
        radialSegments: 16,
        heightSegments: 2,
        openEnded: true,
      }),
    );
    createManagedMeshObject(
      createNormalizedMesh({
        kind: "cone",
        radius: 1.5,
        height: 4,
        radialSegments: 18,
        heightSegments: 3,
        openEnded: false,
      }),
    );
    createManagedMeshObject(
      createNormalizedMesh({ kind: "tetrahedron", radius: 2, detail: 1 }),
    );

    expect(mocks.PlaneGeometry).toHaveBeenCalledWith(12, 8);
    expect(mocks.BoxGeometry).toHaveBeenCalledWith(2, 3, 4);
    expect(mocks.SphereGeometry).toHaveBeenCalledWith(2, 24, 12);
    expect(mocks.CylinderGeometry).toHaveBeenCalledWith(0.5, 1.5, 3, 16, 2, true);
    expect(mocks.ConeGeometry).toHaveBeenCalledWith(1.5, 4, 18, 3, false);
    expect(mocks.TetrahedronGeometry).toHaveBeenCalledWith(2, 1);
  });

  test("calls a custom factory once, attaches its geometry, and owns disposal", async () => {
    vi.resetModules();
    const geometry = new BufferGeometry();
    const geometryDispose = vi.spyOn(geometry, "dispose");
    const material = createDisposable("material");
    const mesh = createObject3D("mesh");
    const create = vi.fn(() => geometry);
    const mocks = installThreeMocks({
      MeshStandardMaterial: vi.fn(() => material),
      Mesh: vi.fn(() => mesh),
    });
    const { createManagedMeshObject } = await import(
      "../../../src/lib/renderer/managedStageObjects"
    );

    const object = createManagedMeshObject(
      createNormalizedMesh({ kind: "custom", create }),
    );

    expect(create).toHaveBeenCalledTimes(1);
    expect(mocks.Mesh).toHaveBeenCalledWith(geometry, material);

    object.dispose();
    object.dispose();

    expect(geometryDispose).toHaveBeenCalledTimes(1);
    expect(material.dispose).toHaveBeenCalledTimes(1);
  });

  test("rejects a custom factory that does not return BufferGeometry", async () => {
    vi.resetModules();
    installThreeMocks({});
    const { createManagedMeshObject } = await import(
      "../../../src/lib/renderer/managedStageObjects"
    );
    const declaration = createNormalizedMesh({
      kind: "custom",
      // @ts-expect-error runtime validation protects JavaScript consumers too.
      create: () => ({ isBufferGeometry: false }),
    });

    expect(() => createManagedMeshObject(declaration)).toThrow(
      'WebGL mesh "mesh" custom geometry factory must return a Three.js BufferGeometry.',
    );
  });

  test("prepares missing normals and bounds on a valid custom triangle", async () => {
    vi.resetModules();
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      "position",
      new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3),
    );
    const computeVertexNormals = vi.spyOn(geometry, "computeVertexNormals");
    const computeBoundingBox = vi.spyOn(geometry, "computeBoundingBox");
    const computeBoundingSphere = vi.spyOn(geometry, "computeBoundingSphere");
    installThreeMocks({});
    const { createManagedMeshObject } = await import(
      "../../../src/lib/renderer/managedStageObjects"
    );

    createManagedMeshObject(
      createNormalizedMesh({ kind: "custom", create: () => geometry }),
    );

    expect(computeVertexNormals).toHaveBeenCalledTimes(1);
    expect(geometry.getAttribute("normal")).toBeDefined();
    expect(computeBoundingBox).toHaveBeenCalledTimes(1);
    expect(computeBoundingSphere).toHaveBeenCalledTimes(1);
    expect(geometry.boundingBox).not.toBeNull();
    expect(geometry.boundingSphere).not.toBeNull();
  });

  test("creates and disposes a real physical Three material without mocked constructors", async () => {
    uninstallThreeMocks();
    vi.resetModules();
    const { createManagedMeshObject } = await import(
      "../../../src/lib/renderer/managedStageObjects"
    );
    const object = createManagedMeshObject(
      createNormalizedMesh(
        { kind: "tetrahedron", radius: 1.5, detail: 0 },
        {
          kind: "physical",
          color: "#dbeafe",
          emissive: "#111827",
          emissiveIntensity: 0.25,
          opacity: 1,
          metalness: 0.15,
          roughness: 0.22,
          transmission: 0.8,
          thickness: 1.4,
          ior: 1.7,
        },
      ),
    );

    expect(object.object3D).toBeInstanceOf(Mesh);
    if (!(object.object3D instanceof Mesh)) {
      throw new Error("Expected a real Three Mesh.");
    }
    expect(object.object3D.material).toBeInstanceOf(MeshPhysicalMaterial);
    if (!(object.object3D.material instanceof MeshPhysicalMaterial)) {
      throw new Error("Expected a real MeshPhysicalMaterial.");
    }
    expect(object.object3D.material).toMatchObject({
      isMeshPhysicalMaterial: true,
      emissiveIntensity: 0.25,
      opacity: 1,
      metalness: 0.15,
      roughness: 0.22,
      transmission: 0.8,
      thickness: 1.4,
      ior: 1.7,
    });
    const geometryDispose = vi.spyOn(object.object3D.geometry, "dispose");
    const materialDispose = vi.spyOn(object.object3D.material, "dispose");

    object.dispose();
    object.dispose();

    expect(geometryDispose).toHaveBeenCalledTimes(1);
    expect(materialDispose).toHaveBeenCalledTimes(1);
  });
});

describe("managed light object factory", () => {
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
  SphereGeometry: ReturnType<typeof vi.fn>;
  CylinderGeometry: ReturnType<typeof vi.fn>;
  ConeGeometry: ReturnType<typeof vi.fn>;
  TetrahedronGeometry: ReturnType<typeof vi.fn>;
  MeshBasicMaterial: ReturnType<typeof vi.fn>;
  MeshStandardMaterial: ReturnType<typeof vi.fn>;
  MeshPhysicalMaterial: ReturnType<typeof vi.fn>;
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
    SphereGeometry: vi.fn(() => createDisposable("sphere-geometry")),
    CylinderGeometry: vi.fn(() => createDisposable("cylinder-geometry")),
    ConeGeometry: vi.fn(() => createDisposable("cone-geometry")),
    TetrahedronGeometry: vi.fn(() => createDisposable("tetrahedron-geometry")),
    MeshBasicMaterial: vi.fn(() => createDisposable("basic-material")),
    MeshStandardMaterial: vi.fn(() => createDisposable("standard-material")),
    MeshPhysicalMaterial: vi.fn(() => createDisposable("physical-material")),
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
  vi.doMock("three/src/geometries/SphereGeometry.js", () => ({
    SphereGeometry: mocks.SphereGeometry,
  }));
  vi.doMock("three/src/geometries/CylinderGeometry.js", () => ({
    CylinderGeometry: mocks.CylinderGeometry,
  }));
  vi.doMock("three/src/geometries/ConeGeometry.js", () => ({
    ConeGeometry: mocks.ConeGeometry,
  }));
  vi.doMock("three/src/geometries/TetrahedronGeometry.js", () => ({
    TetrahedronGeometry: mocks.TetrahedronGeometry,
  }));
  vi.doMock("three/src/materials/MeshBasicMaterial.js", () => ({
    MeshBasicMaterial: mocks.MeshBasicMaterial,
  }));
  vi.doMock("three/src/materials/MeshStandardMaterial.js", () => ({
    MeshStandardMaterial: mocks.MeshStandardMaterial,
  }));
  vi.doMock("three/src/materials/MeshPhysicalMaterial.js", () => ({
    MeshPhysicalMaterial: mocks.MeshPhysicalMaterial,
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

function uninstallThreeMocks(): void {
  for (const moduleId of [
    "three/src/geometries/PlaneGeometry.js",
    "three/src/geometries/BoxGeometry.js",
    "three/src/geometries/SphereGeometry.js",
    "three/src/geometries/CylinderGeometry.js",
    "three/src/geometries/ConeGeometry.js",
    "three/src/geometries/TetrahedronGeometry.js",
    "three/src/materials/MeshBasicMaterial.js",
    "three/src/materials/MeshStandardMaterial.js",
    "three/src/materials/MeshPhysicalMaterial.js",
    "three/src/objects/Mesh.js",
    "three/src/objects/Group.js",
    "three/src/lights/AmbientLight.js",
    "three/src/lights/DirectionalLight.js",
    "three/src/lights/PointLight.js",
    "three/src/core/Object3D.js",
  ]) {
    vi.doUnmock(moduleId);
  }
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

function createNormalizedMesh(
  geometry: NormalizedMeshGeometryDeclaration,
  material: NormalizedMeshMaterialDeclaration = {
    kind: "standard",
    color: "#ffffff",
    emissive: "#000000",
    emissiveIntensity: 1,
    opacity: 1,
    metalness: 0,
    roughness: 1,
  },
): NormalizedMeshDeclaration {
  return {
    id: "mesh",
    sceneId: "world",
    geometry,
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: 1,
    visible: true,
    material,
  };
}
