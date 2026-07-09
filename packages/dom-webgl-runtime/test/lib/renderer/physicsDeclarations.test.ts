import { describe, expect, test } from "vitest";

import {
  inspectPhysicsDeclaration,
  normalizePhysicsDeclaration,
} from "../../../src/lib/renderer/physicsDeclarations";

describe("managed physics declaration normalization", () => {
  test("keeps absent physics undefined", () => {
    expect(normalizePhysicsDeclaration(undefined)).toBeUndefined();
  });

  test("normalizes dynamic body defaults", () => {
    expect(normalizePhysicsDeclaration({ body: {} })).toMatchObject({
      body: {
        type: "dynamic",
        mass: 1,
        gravityScale: 1,
        damping: 0,
        restitution: 0,
        friction: 0.5,
        velocity: [0, 0, 0],
      },
      collider: { kind: "bounds", padding: 0 },
      constraints: [],
      pointerDrag: undefined,
    });
  });

  test("normalizes static body mass and collider opt-out", () => {
    expect(
      normalizePhysicsDeclaration({ body: { type: "static" } }),
    ).toMatchObject({
      body: { type: "static", mass: 0, velocity: [0, 0, 0] },
    });

    expect(normalizePhysicsDeclaration({ collider: false })).toMatchObject({
      collider: undefined,
    });
  });

  test("normalizes pointer drag shorthand and clamps invalid numbers", () => {
    expect(normalizePhysicsDeclaration({ pointerDrag: true })).toMatchObject({
      pointerDrag: { stiffness: 0.24, damping: 0.18, maxForce: 1600 },
    });

    expect(
      normalizePhysicsDeclaration({
        body: {
          type: "dynamic",
          mass: Number.NaN,
          velocity: [Number.NaN, 4, Number.POSITIVE_INFINITY],
          gravityScale: Number.NaN,
          damping: 8,
          restitution: -1,
          friction: Number.POSITIVE_INFINITY,
        },
      }),
    ).toMatchObject({
      body: {
        mass: 1,
        velocity: [0, 4, 0],
        gravityScale: 1,
        damping: 1,
        restitution: 0,
        friction: 0.5,
      },
    });
  });

  test("normalizes collider and constraint descriptors", () => {
    expect(
      normalizePhysicsDeclaration({
        collider: { kind: "sphere", radius: Number.NaN, center: [1, 2, 3] },
        constraints: [
          {
            kind: "anchor",
            target: [0, Number.NaN, 2],
            stiffness: 2,
            damping: -1,
          },
          {
            kind: "spring",
            target: [4, 5, 6],
            restLength: Number.NaN,
            stiffness: 0.18,
          },
        ],
      }),
    ).toMatchObject({
      collider: { kind: "sphere", radius: 1, center: [1, 2, 3] },
      constraints: [
        { kind: "anchor", target: [0, 0, 2], stiffness: 1, damping: 0 },
        { kind: "spring", target: [4, 5, 6], restLength: 0, stiffness: 0.18 },
      ],
    });
  });

  test("inspects collider summaries without leaking body state", () => {
    expect(
      inspectPhysicsDeclaration(
        normalizePhysicsDeclaration({ collider: { kind: "box" } }),
      ),
    ).toEqual({ kind: "box" });

    expect(inspectPhysicsDeclaration(undefined)).toBeUndefined();
  });
});
