import { describe, expect, test } from "vitest";

import { heroTransitionConfig } from "../src/heroTransitionConfig";

describe("hero transition config", () => {
  test("defines the confirmed hold-driven radial contract", () => {
    expect(heroTransitionConfig).toMatchObject({
      signalKeys: {
        committedScheme: "hero.transition.hold.committed-scheme",
        targetScheme: "hero.transition.hold.target-scheme",
        coverage: "hero.transition.hold.coverage",
        originX: "hero.transition.hold.origin-x",
        originY: "hero.transition.hold.origin-y",
        phase: "hero.transition.hold.phase",
        chapters: [
          { entry: "hero.chapter-1.entry", exit: "hero.chapter-1.exit" },
          { entry: "hero.chapter-2.entry", exit: "hero.chapter-2.exit" },
          { entry: "hero.chapter-3.entry", exit: "hero.chapter-3.exit" },
          { entry: "hero.chapter-4.entry", exit: "hero.chapter-4.exit" },
        ],
      },
      signalCodes: {
        scheme: { initial: 0, inverted: 1 },
        phase: {
          idle: 0,
          expanding: 1 / 3,
          retracting: 2 / 3,
          "awaiting-release": 1,
        },
      },
      colors: { light: "#B8B8B8", dark: "#5F5F5F" },
      schemes: {
        initial: { background: "light", foreground: "dark" },
        inverted: { background: "dark", foreground: "light" },
      },
      timing: {
        expandMs: 1000,
        retractMs: 300,
        maxFrameDeltaMs: 64,
      },
      radial: { overscan: 1.02, edgeFeatherPx: 1.5 },
      shake: {
        positionAmplitude: 0.008,
        rotationAmplitude: 0.018,
        frequenciesHz: [11, 13, 17],
      },
      chapterScroll: {
        entry: { orientEnd: 0.26, lockEnd: 0.62 },
        exit: { contractEnd: 0.38, retreatEnd: 0.74 },
      },
      chapterGeometry: {
        faces: expect.arrayContaining([
          expect.objectContaining({
            normal: [-1, 1, 1],
            up: [2, 1, 1],
            right: [0, -1, 1],
            targetRotation: [-0.5158110562, 0.7853981634, 1.5707963268],
          }),
        ]),
        cameraDistance: 3.2,
        cameraFov: 38,
        cameraTargetY: 0.32,
        lockTriangleWidthFraction: 1,
        lockTriangleMaxHeightFraction: 1,
        revealOverscan: 1.035,
      },
      visual: { ghostBrightness: 0.72, facePaletteStrength: 0.92 },
    });
    expect(new Set(Object.values(heroTransitionConfig.colors))).toEqual(
      new Set(["#B8B8B8", "#5F5F5F"]),
    );
    expect(heroTransitionConfig.chapterGeometry.faces).toHaveLength(4);
  });
});
