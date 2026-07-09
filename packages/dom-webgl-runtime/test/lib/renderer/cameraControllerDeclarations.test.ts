import { describe, expect, test } from "vitest";

import {
  normalizeCameraControllerDeclaration,
  readCameraControllerFrame,
  readCameraControllerProgress,
} from "../../../src/lib/renderer/cameraControllerDeclarations";

describe("camera controller declarations", () => {
  test("normalizes progress range and smoothstep easing", () => {
    const declaration = normalizeCameraControllerDeclaration({
      timeline: {
        id: " hero.timeline ",
        progressKey: " hero.progress ",
        range: { from: 0.25, to: 0.75 },
      },
      to: {
        position: [0, 120, 520],
        target: [0, 48, 0],
        fov: 34,
      },
      easing: "smoothstep",
    });

    expect(declaration).toMatchObject({
      timeline: {
        id: "hero.timeline",
        progressKey: "hero.progress",
        range: { from: 0.25, to: 0.75 },
      },
      to: {
        position: [0, 120, 520],
        target: [0, 48, 0],
        fov: 34,
      },
      easing: "smoothstep",
    });

    expect(readCameraControllerProgress(declaration, { get: () => 0.5 })).toBe(
      0.5,
    );
    expect(readCameraControllerProgress(declaration, { get: () => 0.25 })).toBe(
      0,
    );
    expect(readCameraControllerProgress(declaration, { get: () => 0.75 })).toBe(
      1,
    );
  });

  test("uses the timeline id as the default progress key", () => {
    expect(
      normalizeCameraControllerDeclaration({
        timeline: " hero.timeline ",
        to: { fov: 34 },
      }).timeline,
    ).toEqual({
      id: "hero.timeline",
      progressKey: "hero.timeline",
    });
  });

  test("normalizes legacy orbit pointer controller shorthand", () => {
    expect(
      normalizeCameraControllerDeclaration({
        pointer: {
          kind: "orbit",
          activation: "empty-space-drag",
          target: [1, 2, 3],
        },
      }).pointer,
    ).toEqual({
      activation: "empty-space",
      orbit: {
        drag: { button: "primary" },
        target: [1, 2, 3],
        sensitivity: [0.004, 0.004],
      },
    });
  });

  test("normalizes rich camera gesture descriptors", () => {
    expect(
      normalizeCameraControllerDeclaration({
        pointer: {
          orbit: { target: [0, 0, 0], minDistance: 240, maxDistance: 980 },
          pan: true,
          dolly: { drag: { button: "primary", modifier: "alt" } },
          parallax: { scope: "camera", strength: [16, 8] },
          damping: { factor: 0.18 },
          reset: { onDoubleClick: true, durationMs: 220 },
        },
      }).pointer,
    ).toMatchObject({
      activation: "empty-space",
      orbit: { minDistance: 240, maxDistance: 980 },
      pan: { drag: { button: "secondary" } },
      dolly: { drag: { button: "primary", modifier: "alt" } },
      parallax: { scope: "camera", strength: [16, 8] },
      damping: { factor: 0.18, settleEpsilon: 0.001 },
      reset: { onDoubleClick: true, durationMs: 220 },
    });
  });

  test("rejects invalid camera gesture distance ranges", () => {
    expect(() =>
      normalizeCameraControllerDeclaration({
        pointer: {
          orbit: { minDistance: 600, maxDistance: 200 },
        },
      }),
    ).toThrow("WebGL camera orbit gesture minDistance must be <= maxDistance.");
  });

  test("interpolates only declared frame fields from base camera framing", () => {
    const declaration = normalizeCameraControllerDeclaration({
      timeline: "hero.timeline",
      from: { position: [0, 0, 700] },
      to: {
        position: [0, 120, 520],
        target: [0, 48, 0],
        fov: 34,
      },
    });

    expect(
      readCameraControllerFrame(
        declaration,
        {
          position: [0, 0, 500],
          target: [0, 0, 0],
          fov: 44,
        },
        0.5,
      ),
    ).toEqual({
      position: [0, 60, 610],
      target: [0, 24, 0],
      fov: 39,
    });
  });

  test("rejects empty target frames", () => {
    expect(() =>
      normalizeCameraControllerDeclaration({
        timeline: "hero.timeline",
        to: {},
      }),
    ).toThrow(
      'WebGL camera controller "to" must include position, target, or fov.',
    );
  });
});
