import { describe, expect, test } from "vitest";

import {
  normalizeLightDeclaration,
  normalizeStagePrimitiveDeclaration,
} from "../../../src/lib/renderer/stageDeclarations";

describe("managed stage declaration normalization", () => {
  test("normalizes floor plane defaults", () => {
    expect(
      normalizeStagePrimitiveDeclaration({
        id: "floor",
        sceneId: "world",
        kind: "plane",
        role: "floor",
      }),
    ).toMatchObject({
      id: "floor",
      sceneId: "world",
      kind: "plane",
      role: "floor",
      size: [1, 1],
      position: [0, 0, 0],
      rotation: [-Math.PI / 2, 0, 0],
      scale: 1,
      visible: true,
      material: {
        kind: "standard",
        color: "#ffffff",
        emissive: "#000000",
        emissiveIntensity: 1,
        opacity: 1,
        metalness: 0,
        roughness: 1,
      },
    });
  });

  test("normalizes primitive and light timeline metadata", () => {
    expect(
      normalizeStagePrimitiveDeclaration({
        id: "floor",
        sceneId: "world",
        kind: "plane",
        timeline: {
          id: " hero.3d ",
          progressKey: " scroll.hero ",
          active: { from: 0.1, to: 0.9 },
        },
      }),
    ).toMatchObject({
      id: "floor",
      timeline: {
        id: "hero.3d",
        progressKey: "scroll.hero",
        active: { from: 0.1, to: 0.9 },
      },
    });

    expect(
      normalizeLightDeclaration({
        id: "hero",
        sceneId: "world",
        kind: "point",
        timeline: " hero.3d ",
      }),
    ).toMatchObject({
      id: "hero",
      timeline: {
        id: "hero.3d",
        progressKey: "hero.3d",
      },
    });
  });

  test("normalizes box and basic material declarations", () => {
    expect(
      normalizeStagePrimitiveDeclaration({
        id: "box",
        sceneId: "world",
        kind: "box",
        size: [2, 3, 4],
        material: { kind: "basic", color: 0xff0000, opacity: 0.5 },
      }),
    ).toMatchObject({
      id: "box",
      sceneId: "world",
      kind: "box",
      size: [2, 3, 4],
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: 1,
      visible: true,
      material: { kind: "basic", color: 0xff0000, opacity: 0.5 },
    });
  });

  test("normalizes physics declarations on stage primitives", () => {
    expect(
      normalizeStagePrimitiveDeclaration({
        id: "box",
        sceneId: "world",
        kind: "box",
        physics: {
          body: { type: "dynamic", mass: 1, damping: 0.08 },
          collider: { kind: "box", size: [120, 20, 120] },
          pointerDrag: true,
          constraints: [
            {
              kind: "spring",
              target: [0, 20, 0],
              restLength: 0,
              stiffness: 0.18,
            },
          ],
        },
      }),
    ).toMatchObject({
      physics: {
        body: {
          type: "dynamic",
          mass: 1,
          damping: 0.08,
          velocity: [0, 0, 0],
        },
        collider: { kind: "box", size: [120, 20, 120], center: [0, 0, 0] },
        pointerDrag: { stiffness: 0.24, damping: 0.18, maxForce: 1600 },
        constraints: [
          {
            kind: "spring",
            target: [0, 20, 0],
            restLength: 0,
            stiffness: 0.18,
          },
        ],
      },
    });
  });

  test("normalizes light defaults", () => {
    expect(
      normalizeLightDeclaration({
        id: "hero",
        sceneId: "world",
        kind: "point",
      }),
    ).toMatchObject({
      id: "hero",
      sceneId: "world",
      kind: "point",
      color: "#ffffff",
      intensity: 1,
      position: [0, 0, 120],
      target: [0, 0, 0],
      distance: 0,
      decay: 2,
      visible: true,
    });
  });

  test("rejects invalid ids and non-finite primitive sizes", () => {
    expect(() =>
      normalizeStagePrimitiveDeclaration({
        id: " ",
        sceneId: "world",
        kind: "plane",
      }),
    ).toThrow("WebGL stage primitive declaration requires a non-empty id.");

    expect(() =>
      normalizeStagePrimitiveDeclaration({
        id: "floor",
        sceneId: " ",
        kind: "plane",
      }),
    ).toThrow("WebGL scene declaration requires a non-empty id.");

    expect(() =>
      normalizeStagePrimitiveDeclaration({
        id: "bad",
        sceneId: "world",
        kind: "plane",
        size: [Number.NaN, 1],
      }),
    ).toThrow("WebGL stage plane size must contain finite positive numbers.");
  });

  test("rejects invalid light intensity", () => {
    expect(() =>
      normalizeLightDeclaration({
        id: "bad.light",
        sceneId: "world",
        kind: "point",
        intensity: -1,
      }),
    ).toThrow("WebGL light intensity must be a finite non-negative number.");
  });
});
