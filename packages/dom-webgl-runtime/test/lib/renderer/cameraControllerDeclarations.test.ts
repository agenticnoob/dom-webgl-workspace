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
