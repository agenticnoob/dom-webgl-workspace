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

import { createElement, Fragment, Suspense, useEffect } from "react";
import { act, create } from "@react-three/test-renderer";
import { Physics, useRapier } from "@react-three/rapier";
import {
  Ray,
  Vector3,
  BoxGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
} from "three";
import { describe, expect, test, vi } from "vitest";
import { dragReleaseVelocity } from "../src/physicsDrag";
import { PhysicsStage } from "../src/ManagedPhysicsExample";

vi.mock("../src/recipes/shared/useClonedModel", () => ({
  useClonedModel: () => {
    const scene = new Group();
    scene.add(new Mesh(new BoxGeometry(5, 10, 4), new MeshStandardMaterial()));
    return { scene, animations: [] };
  },
}));

describe("native Rapier dynamics", () => {
  test("preserves release velocity direction and caps unstable pointer samples", () => {
    expect(
      dragReleaseVelocity(
        new Vector3(),
        new Vector3(0.2, -0.1, 0),
        100,
      ).toArray(),
    ).toEqual([2, -1, 0]);
    expect(
      dragReleaseVelocity(new Vector3(), new Vector3(100, 0, 0), 1).length(),
    ).toBeCloseTo(12);
    expect(
      dragReleaseVelocity(
        new Vector3(1, 1, 1),
        new Vector3(1, 1, 1),
        0,
      ).length(),
    ).toBe(0);
  });
  test("runs actual rigid bodies, colliders, springs and the kinematic sweep", async () => {
    let physics: ReturnType<typeof useRapier> | undefined;
    function CaptureWorld() {
      const world = useRapier();
      useEffect(() => {
        physics = world;
      }, [world]);
      return null;
    }
    const renderer = await create(
      createElement(
        Suspense,
        { fallback: null },
        createElement(Physics, {
          gravity: [0, -9.81, 0],
          timeStep: 1 / 60,
          children: createElement(
            Fragment,
            null,
            createElement(PhysicsStage),
            createElement(CaptureWorld),
          ),
        }),
      ),
    );
    await vi.waitFor(
      async () => {
        await act(async () => {});
        expect(physics?.world.bodies.len()).toBe(11);
      },
      { timeout: 10000 },
    );
    if (!physics) throw new Error("Physics initialization failed");
    expect(physics.world.bodies.len()).toBe(11);
    expect(physics.world.colliders.len()).toBeGreaterThanOrEqual(9);
    expect(physics.world.impulseJoints.len()).toBe(2);
    const bodies = Array.from(physics.rigidBodyStates.values());
    const crateState = bodies.find(
      (state) => state.object.name === "example.physics.crate",
    );
    const modelState = bodies.find(
      (state) => state.object.name === "example.physics.model",
    );
    if (!crateState || !modelState)
      throw new Error("Scene bodies were not registered");
    const crateEntry = Array.from(physics.rigidBodyStates.entries()).find(
      ([, state]) => state === crateState,
    );
    if (!crateEntry) throw new Error("Missing crate handle");
    const crate = physics.world.getRigidBody(crateEntry[0]);
    const modelEntry = Array.from(physics.rigidBodyStates.entries()).find(
      ([, state]) => state === modelState,
    );
    if (!modelEntry) throw new Error("Missing model handle");
    const model = physics.world.getRigidBody(modelEntry[0]);
    const startX = model.translation().x;
    for (let frame = 0; frame < 180; frame += 1) physics.step(1 / 60);
    expect(crate.translation().y).toBeGreaterThan(-1.55);
    expect(crate.translation().y).toBeLessThan(-1.35);
    expect(model.translation().x).not.toBeCloseTo(startX);
    expect(model.isKinematic()).toBe(true);
    const crateMesh = renderer.scene
      .findByProps({ name: "example.physics.crate" })
      .findByType("Mesh");
    const point = new Vector3().copy(crate.translation());
    await renderer.fireEvent(crateMesh, "pointerDown", {
      button: 0,
      pointerId: 1,
      timeStamp: 100,
      point,
    });
    expect(crate.isKinematic()).toBe(true);
    const destination = point.clone().add(new Vector3(0.6, 0.3, 0));
    await renderer.fireEvent(crateMesh, "pointerMove", {
      pointerId: 1,
      timeStamp: 200,
      ray: new Ray(
        destination.clone().add(new Vector3(0, 0, 5)),
        new Vector3(0, 0, -1),
      ),
    });
    physics.step(1 / 60);
    expect(crate.translation().x).toBeCloseTo(destination.x, 2);
    await renderer.fireEvent(crateMesh, "pointerUp", {
      pointerId: 1,
      timeStamp: 210,
    });
    expect(crate.isDynamic()).toBe(true);
    expect(crate.linvel().x).toBeCloseTo(6, 2);
    expect(crate.linvel().y).toBeCloseTo(3, 2);
    await renderer.fireEvent(crateMesh, "pointerDown", {
      button: 0,
      pointerId: 2,
      timeStamp: 300,
      point: destination,
    });
    window.dispatchEvent(new Event("pointercancel"));
    expect(crate.isDynamic()).toBe(true);
    expect(crate.linvel()).toMatchObject({ x: 0, y: 0, z: 0 });
    await renderer.unmount();
  });
});
