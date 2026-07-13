import { describe, expect, test } from "vitest";
import { BufferGeometry } from "three/src/core/BufferGeometry.js";

import {
  normalizeLightDeclaration,
  normalizeMeshDeclaration,
  normalizeStagePrimitiveDeclaration,
} from "../../../src/lib/renderer/stageDeclarations";

describe("managed mesh declaration normalization", () => {
  test("normalizes common fields and plane role rotation", () => {
    expect(
      normalizeMeshDeclaration({
        id: " floor ",
        sceneId: " world ",
        geometry: { kind: "plane", role: "floor", size: [12, 8] },
        position: [1, 2, 3],
        scale: [2, 3, 4],
        visible: false,
        material: { kind: "basic", color: 0xff0000, opacity: 0.5 },
        timeline: " hero.timeline ",
        effects: [{ kind: "app.mesh" }],
        interaction: {
          pickable: { hitTest: "mesh", pointer: { hover: true, click: true } },
        },
        physics: {
          body: { type: "dynamic", mass: 2 },
          collider: { kind: "box", size: [2, 1, 2] },
        },
      }),
    ).toEqual({
      id: "floor",
      sceneId: "world",
      geometry: { kind: "plane", role: "floor", size: [12, 8] },
      position: [1, 2, 3],
      rotation: [-Math.PI / 2, 0, 0],
      scale: [2, 3, 4],
      visible: false,
      material: { kind: "basic", color: 0xff0000, opacity: 0.5 },
      timeline: {
        id: "hero.timeline",
        progressKey: "hero.timeline",
      },
      effects: [{ kind: "app.mesh" }],
      interaction: {
        pickable: {
          hitTest: "mesh",
          pointer: { hover: true, press: false, click: true, drag: false },
        },
      },
      physics: {
        body: {
          type: "dynamic",
          mass: 2,
          damping: 0,
          velocity: [0, 0, 0],
          gravityScale: 1,
          friction: 0.5,
          restitution: 0,
        },
        collider: { kind: "box", size: [2, 1, 2], center: [0, 0, 0] },
        constraints: [],
        pointerDrag: undefined,
      },
    });
  });

  test("fills deterministic defaults for every built-in geometry", () => {
    expect(
      normalizeMeshDeclaration({
        id: "plane",
        sceneId: "world",
        geometry: { kind: "plane" },
      }).geometry,
    ).toEqual({ kind: "plane", size: [1, 1] });
    expect(
      normalizeMeshDeclaration({
        id: "box",
        sceneId: "world",
        geometry: { kind: "box" },
      }).geometry,
    ).toEqual({ kind: "box", size: [1, 1, 1] });
    expect(
      normalizeMeshDeclaration({
        id: "sphere",
        sceneId: "world",
        geometry: { kind: "sphere" },
      }).geometry,
    ).toEqual({
      kind: "sphere",
      radius: 1,
      widthSegments: 32,
      heightSegments: 16,
    });
    expect(
      normalizeMeshDeclaration({
        id: "cylinder",
        sceneId: "world",
        geometry: { kind: "cylinder" },
      }).geometry,
    ).toEqual({
      kind: "cylinder",
      radiusTop: 1,
      radiusBottom: 1,
      height: 1,
      radialSegments: 32,
      heightSegments: 1,
      openEnded: false,
    });
    expect(
      normalizeMeshDeclaration({
        id: "cone",
        sceneId: "world",
        geometry: { kind: "cone" },
      }).geometry,
    ).toEqual({
      kind: "cone",
      radius: 1,
      height: 1,
      radialSegments: 32,
      heightSegments: 1,
      openEnded: false,
    });
    expect(
      normalizeMeshDeclaration({
        id: "tetrahedron",
        sceneId: "world",
        geometry: { kind: "tetrahedron" },
      }).geometry,
    ).toEqual({ kind: "tetrahedron", radius: 1, detail: 0 });
  });

  test("preserves explicit built-in values and custom factories", () => {
    const create = () => new BufferGeometry();

    expect(
      normalizeMeshDeclaration({
        id: "sphere",
        sceneId: "world",
        geometry: {
          kind: "sphere",
          radius: 2,
          widthSegments: 8,
          heightSegments: 4,
        },
      }).geometry,
    ).toEqual({ kind: "sphere", radius: 2, widthSegments: 8, heightSegments: 4 });
    expect(
      normalizeMeshDeclaration({
        id: "cylinder",
        sceneId: "world",
        geometry: {
          kind: "cylinder",
          radiusTop: 0,
          radiusBottom: 2,
          height: 3,
          radialSegments: 12,
          heightSegments: 2,
          openEnded: true,
        },
      }).geometry,
    ).toEqual({
      kind: "cylinder",
      radiusTop: 0,
      radiusBottom: 2,
      height: 3,
      radialSegments: 12,
      heightSegments: 2,
      openEnded: true,
    });
    expect(
      normalizeMeshDeclaration({
        id: "cone",
        sceneId: "world",
        geometry: {
          kind: "cone",
          radius: 2,
          height: 3,
          radialSegments: 12,
          heightSegments: 2,
          openEnded: true,
        },
      }).geometry,
    ).toEqual({
      kind: "cone",
      radius: 2,
      height: 3,
      radialSegments: 12,
      heightSegments: 2,
      openEnded: true,
    });
    expect(
      normalizeMeshDeclaration({
        id: "tetrahedron",
        sceneId: "world",
        geometry: { kind: "tetrahedron", radius: 2, detail: 1 },
      }).geometry,
    ).toEqual({ kind: "tetrahedron", radius: 2, detail: 1 });
    expect(
      normalizeMeshDeclaration({
        id: "custom",
        sceneId: "world",
        geometry: { kind: "custom", create },
      }).geometry,
    ).toEqual({ kind: "custom", create });
  });

  test("keeps wall and backdrop flat while explicit rotation wins", () => {
    expect(
      normalizeMeshDeclaration({
        id: "wall",
        sceneId: "world",
        geometry: { kind: "plane", role: "wall" },
      }).rotation,
    ).toEqual([0, 0, 0]);
    expect(
      normalizeMeshDeclaration({
        id: "backdrop",
        sceneId: "world",
        geometry: { kind: "plane", role: "backdrop" },
      }).rotation,
    ).toEqual([0, 0, 0]);
    expect(
      normalizeMeshDeclaration({
        id: "floor",
        sceneId: "world",
        geometry: { kind: "plane", role: "floor" },
        rotation: [1, 2, 3],
      }).rotation,
    ).toEqual([1, 2, 3]);
  });

  test("rejects invalid mesh ids, sizes, radii, heights, and finite values", () => {
    expect(() =>
      normalizeMeshDeclaration({
        id: " ",
        sceneId: "world",
        geometry: { kind: "plane" },
      }),
    ).toThrow("WebGL mesh declaration requires a non-empty id.");
    expect(() =>
      normalizeMeshDeclaration({
        id: "mesh",
        sceneId: " ",
        geometry: { kind: "plane" },
      }),
    ).toThrow("WebGL scene declaration requires a non-empty id.");
    expect(() =>
      normalizeMeshDeclaration({
        id: "plane",
        sceneId: "world",
        geometry: { kind: "plane", size: [0, 1] },
      }),
    ).toThrow("WebGL mesh plane size must contain finite positive numbers.");
    expect(() =>
      normalizeMeshDeclaration({
        id: "box",
        sceneId: "world",
        geometry: { kind: "box", size: [1, Number.NaN, 1] },
      }),
    ).toThrow("WebGL mesh box size must contain finite positive numbers.");
    expect(() =>
      normalizeMeshDeclaration({
        id: "sphere",
        sceneId: "world",
        geometry: { kind: "sphere", radius: 0 },
      }),
    ).toThrow("WebGL mesh sphere radius must be a finite positive number.");
    expect(() =>
      normalizeMeshDeclaration({
        id: "cylinder",
        sceneId: "world",
        geometry: { kind: "cylinder", radiusTop: -1 },
      }),
    ).toThrow("WebGL mesh cylinder radiusTop must be a finite non-negative number.");
    expect(() =>
      normalizeMeshDeclaration({
        id: "cylinder",
        sceneId: "world",
        geometry: { kind: "cylinder", radiusTop: 0, radiusBottom: 0 },
      }),
    ).toThrow("WebGL mesh cylinder radii cannot both be zero.");
    expect(() =>
      normalizeMeshDeclaration({
        id: "cylinder",
        sceneId: "world",
        geometry: { kind: "cylinder", height: 0 },
      }),
    ).toThrow("WebGL mesh cylinder height must be a finite positive number.");
    expect(() =>
      normalizeMeshDeclaration({
        id: "cone",
        sceneId: "world",
        geometry: { kind: "cone", radius: 0 },
      }),
    ).toThrow("WebGL mesh cone radius must be a finite positive number.");
    expect(() =>
      normalizeMeshDeclaration({
        id: "cone",
        sceneId: "world",
        geometry: { kind: "cone", height: 0 },
      }),
    ).toThrow("WebGL mesh cone height must be a finite positive number.");
    expect(() =>
      normalizeMeshDeclaration({
        id: "tetrahedron",
        sceneId: "world",
        geometry: { kind: "tetrahedron", radius: 0 },
      }),
    ).toThrow("WebGL mesh tetrahedron radius must be a finite positive number.");
    expect(() =>
      normalizeMeshDeclaration({
        id: "material",
        sceneId: "world",
        geometry: { kind: "box" },
        material: { kind: "basic", opacity: Number.POSITIVE_INFINITY },
      }),
    ).toThrow("WebGL mesh material opacity must be a finite non-negative number.");
  });

  test("rejects unsafe segment and detail counts", () => {
    expect(() =>
      normalizeMeshDeclaration({
        id: "sphere",
        sceneId: "world",
        geometry: { kind: "sphere", widthSegments: 2 },
      }),
    ).toThrow("WebGL mesh sphere widthSegments must be an integer greater than or equal to 3.");
    expect(() =>
      normalizeMeshDeclaration({
        id: "sphere",
        sceneId: "world",
        geometry: { kind: "sphere", heightSegments: 1 },
      }),
    ).toThrow("WebGL mesh sphere heightSegments must be an integer greater than or equal to 2.");
    expect(() =>
      normalizeMeshDeclaration({
        id: "cylinder",
        sceneId: "world",
        geometry: { kind: "cylinder", radialSegments: 3.5 },
      }),
    ).toThrow("WebGL mesh cylinder radialSegments must be an integer greater than or equal to 3.");
    expect(() =>
      normalizeMeshDeclaration({
        id: "cylinder",
        sceneId: "world",
        geometry: { kind: "cylinder", heightSegments: 0 },
      }),
    ).toThrow("WebGL mesh cylinder heightSegments must be an integer greater than or equal to 1.");
    expect(() =>
      normalizeMeshDeclaration({
        id: "cone",
        sceneId: "world",
        geometry: { kind: "cone", radialSegments: 2 },
      }),
    ).toThrow("WebGL mesh cone radialSegments must be an integer greater than or equal to 3.");
    expect(() =>
      normalizeMeshDeclaration({
        id: "cone",
        sceneId: "world",
        geometry: { kind: "cone", heightSegments: 0 },
      }),
    ).toThrow("WebGL mesh cone heightSegments must be an integer greater than or equal to 1.");
    expect(() =>
      normalizeMeshDeclaration({
        id: "tetrahedron",
        sceneId: "world",
        geometry: { kind: "tetrahedron", detail: -1 },
      }),
    ).toThrow("WebGL mesh tetrahedron detail must be an integer greater than or equal to 0.");
  });

  test("rejects missing and non-function custom factories", () => {
    expect(() =>
      normalizeMeshDeclaration({
        id: "custom",
        sceneId: "world",
        // @ts-expect-error runtime validation protects JavaScript consumers too.
        geometry: { kind: "custom" },
      }),
    ).toThrow("WebGL mesh custom geometry requires a create function.");
    expect(() =>
      normalizeMeshDeclaration({
        id: "custom",
        sceneId: "world",
        // @ts-expect-error runtime validation protects JavaScript consumers too.
        geometry: { kind: "custom", create: 1 },
      }),
    ).toThrow("WebGL mesh custom geometry requires a create function.");
  });
});

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
