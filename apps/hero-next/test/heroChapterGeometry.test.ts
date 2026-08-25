import { describe, expect, test } from "vitest";

import {
  resolveHeroChapterCameraFrame,
  resolveHeroChapterGeometryFrame,
  resolveHeroChapterLockProjection,
} from "../src/heroChapterGeometry";
import { resolveHeroChapterScrollState } from "../src/heroChapterScroll";
import { heroTransitionConfig } from "../src/heroTransitionConfig";

type Vector3 = readonly [number, number, number];

const desktop = { width: 1200, height: 835 } as const;
const mobile = { width: 390, height: 844 } as const;
const hubRotation = heroTransitionConfig.motion.baseRotation;
const targetFaceNormal = normalize(
  heroTransitionConfig.chapterGeometry.faces[0].normal,
);
describe("four-chapter camera-space geometry", () => {
  test.each(heroTransitionConfig.chapterGeometry.faces.map((face, index) => [index, face] as const))(
    "aligns chapter %s face normal and face up with the camera frame",
    (chapterIndex, face) => {
    const camera = resolveHeroChapterCameraFrame();
    const rotation = face.targetRotation;

    expectVector(rotateXyz(normalize(face.normal), rotation), camera.facing);
    expectVector(rotateXyz(normalize(face.up), rotation), camera.up);
    expectVector(
      resolveHeroChapterGeometryFrame(
        desktop,
        resolveHeroChapterScrollState(1, 0, chapterIndex),
        hubRotation,
      ).rotation,
      rotation,
    );
  });

  test("rotates and advances together before settling exactly on the optical axis", () => {
    const { orientEnd } = heroTransitionConfig.chapterScroll.entry;
    const earlyState = resolveHeroChapterScrollState(orientEnd / 2, 0);
    const alignedState = resolveHeroChapterScrollState(orientEnd, 0);
    const laterState = resolveHeroChapterScrollState(orientEnd + 0.12, 0);
    const early = resolveHeroChapterGeometryFrame(
      desktop,
      earlyState,
      hubRotation,
    );
    const aligned = resolveHeroChapterGeometryFrame(
      desktop,
      alignedState,
      hubRotation,
    );
    const later = resolveHeroChapterGeometryFrame(
      desktop,
      laterState,
      hubRotation,
    );
    const camera = resolveHeroChapterCameraFrame();
    const objectToCamera = normalize(subtract(camera.position, aligned.position));

    expect(early.position[2]).toBeGreaterThan(0);
    expect(early.rotation).not.toEqual(hubRotation);
    expectVector(
      rotateXyz(targetFaceNormal, aligned.rotation),
      objectToCamera,
    );
    expectVector(aligned.rotation, later.rotation);
    expect(later.position[2]).toBeGreaterThan(aligned.position[2]);
  });

  test.each([
    ["desktop", desktop],
    ["mobile", mobile],
  ] as const)(
    "reaches real DOM scale before the %s curtain starts",
    (_name, viewport) => {
      const lockState = resolveHeroChapterScrollState(
        heroTransitionConfig.chapterScroll.entry.lockEnd,
        0,
      );
      const lock = resolveHeroChapterGeometryFrame(
        viewport,
        lockState,
        hubRotation,
      );
      const heightFraction = projectedFaceHeightFraction(lock);
      const lockProjection = resolveHeroChapterLockProjection(viewport);

      expect(heightFraction).toBeCloseTo(lockProjection.heightFraction, 9);
      expect(lockState).toMatchObject({
        approach: 1,
        screenLock: 1,
        triangleReveal: 0,
      });
      expect(
        Math.max(
          heightFraction,
          lockProjection.widthFraction,
        ),
      ).toBeCloseTo(1, 9);
    },
  );

  test.each([
    ["desktop", desktop],
    ["mobile", mobile],
  ] as const)(
    "uses the projected %s lock footprint as the target-face UV scale",
    (_name, viewport) => {
      const projection = resolveHeroChapterLockProjection(viewport);
      const aspect = viewport.width / viewport.height;

      expect(projection.widthFraction).toBeCloseTo(
        projection.heightFraction / (aspect * (Math.sqrt(3) / 2)),
        12,
      );
      expect(Math.max(projection.widthFraction, projection.heightFraction))
        .toBeCloseTo(1, 12);
    },
  );

  test.each([
    ["desktop", desktop],
    ["mobile", mobile],
  ] as const)("covers the %s viewport only through curtain motion", (_name, viewport) => {
    const lock = resolveHeroChapterGeometryFrame(
      viewport,
      resolveHeroChapterScrollState(
        heroTransitionConfig.chapterScroll.entry.lockEnd,
        0,
      ),
      hubRotation,
    );
    const revealed = resolveHeroChapterGeometryFrame(
      viewport,
      resolveHeroChapterScrollState(1, 0),
      hubRotation,
    );
    const projection = projectedTriangle(viewport, revealed);

    expect(revealed.rotation).toEqual(lock.rotation);
    expect(revealed.scale).toBe(lock.scale);
    expect(revealed.position[2]).toBeGreaterThan(lock.position[2]);
    expect(projection.baseNdcY).toBeLessThanOrEqual(-1);
    expect(projection.apexNdcY).toBeGreaterThanOrEqual(1);
    expect(projection.halfWidthAtTop).toBeGreaterThanOrEqual(1);
  });

  test("returns the exact same geometry for the same scroll state", () => {
    const state = resolveHeroChapterScrollState(0.81, 0);

    expect(resolveHeroChapterGeometryFrame(desktop, state, hubRotation)).toEqual(
      resolveHeroChapterGeometryFrame(desktop, state, hubRotation),
    );
  });
});

function projectedFaceHeightFraction(
  frame: ReturnType<typeof resolveHeroChapterGeometryFrame>,
): number {
  const camera = resolveHeroChapterCameraFrame();
  const radius = heroTransitionConfig.geometry.radius;
  const faceCenter = add(
    frame.position,
    scale(camera.facing, (radius * frame.scale) / 3),
  );
  const depth = dot(subtract(faceCenter, camera.position), camera.forward);
  const tangent = Math.tan(
    (heroTransitionConfig.chapterGeometry.cameraFov * Math.PI) / 360,
  );

  return (Math.SQRT2 * radius * frame.scale) / (2 * depth * tangent);
}

function projectedTriangle(
  viewport: { readonly width: number; readonly height: number },
  frame: ReturnType<typeof resolveHeroChapterGeometryFrame>,
) {
  const camera = resolveHeroChapterCameraFrame();
  const radius = heroTransitionConfig.geometry.radius;
  const faceCenter = add(
    frame.position,
    scale(camera.facing, (radius * frame.scale) / 3),
  );
  const relative = subtract(faceCenter, camera.position);
  const depth = dot(relative, camera.forward);
  const tangent = Math.tan(
    (heroTransitionConfig.chapterGeometry.cameraFov * Math.PI) / 360,
  );
  const centroidNdcY = dot(relative, camera.up) / (depth * tangent);
  const heightFraction = projectedFaceHeightFraction(frame);
  const baseNdcY = centroidNdcY - (2 * heightFraction) / 3;
  const apexNdcY = centroidNdcY + (4 * heightFraction) / 3;
  const halfWidthAtTop =
    (apexNdcY - 1) /
    (Math.sqrt(3) * (viewport.width / viewport.height));

  return { baseNdcY, apexNdcY, halfWidthAtTop };
}

function rotateXyz(vector: Vector3, rotation: Vector3): Vector3 {
  const [x, y, z] = rotation;
  const a = Math.cos(x);
  const b = Math.sin(x);
  const c = Math.cos(y);
  const d = Math.sin(y);
  const e = Math.cos(z);
  const f = Math.sin(z);

  return [
    c * e * vector[0] - c * f * vector[1] + d * vector[2],
    (a * f + b * e * d) * vector[0] +
      (a * e - b * f * d) * vector[1] -
      b * c * vector[2],
    (b * f - a * e * d) * vector[0] +
      (b * e + a * f * d) * vector[1] +
      a * c * vector[2],
  ];
}

function expectVector(actual: Vector3, expected: Vector3): void {
  expect(actual[0]).toBeCloseTo(expected[0], 9);
  expect(actual[1]).toBeCloseTo(expected[1], 9);
  expect(actual[2]).toBeCloseTo(expected[2], 9);
}

function normalize(vector: Vector3): Vector3 {
  const length = Math.hypot(...vector);
  return scale(vector, 1 / length);
}

function add(left: Vector3, right: Vector3): Vector3 {
  return [left[0] + right[0], left[1] + right[1], left[2] + right[2]];
}

function subtract(left: Vector3, right: Vector3): Vector3 {
  return [left[0] - right[0], left[1] - right[1], left[2] - right[2]];
}

function scale(vector: Vector3, multiplier: number): Vector3 {
  return [
    vector[0] * multiplier,
    vector[1] * multiplier,
    vector[2] * multiplier,
  ];
}

function dot(left: Vector3, right: Vector3): number {
  return left[0] * right[0] + left[1] * right[1] + left[2] * right[2];
}
