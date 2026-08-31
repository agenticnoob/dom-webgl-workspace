import { describe, expect, test } from "vitest";

import { heroTransitionConfig } from "../src/transition/transitionConfig";

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
        entry: { introHandoffEnd: 0.28, orientEnd: 0.26, lockEnd: 0.62 },
        exit: { contractEnd: 0.38, retreatEnd: 0.74 },
      },
      portal: {
        handoffYaw: 0.42,
        pointerYaw: 0.065,
        pointerPitch: 0.045,
        pointerDampingMs: 140,
      },
      chapterGeometry: {
        cameraDistance: 3.2,
        cameraFov: 38,
        cameraTargetY: 0.32,
        lockTriangleWidthFraction: 1,
        lockTriangleMaxHeightFraction: 1,
        revealOverscan: 1.035,
        approachArcX: 0.34,
        approachArcY: 0.16,
        approachPullback: 0.18,
        approachBank: 0.14,
      },
      visual: {
        ghostBrightness: 0.72,
        facePaletteStrength: 0.45,
        fresnelStrength: 0.22,
        fresnelPower: 3.2,
        metalness: 0.62,
        roughness: 0.28,
        keyLightIntensity: 5.4,
        rimLightIntensity: 1.35,
      },
      motion: expect.objectContaining({
        emissiveIntensity: 0.035,
        breathingScaleAmplitude: 0.012,
        floatingAmplitude: 0.018,
        pointerPitch: 0.14,
        pointerYaw: 0.18,
        pointerDampingMs: 130,
        transitionAmbientFactor: 0.55,
        transitionPointerFactor: 0.72,
      }),
    });
    expect(new Set(Object.values(heroTransitionConfig.colors))).toEqual(
      new Set(["#B8B8B8", "#5F5F5F"]),
    );
  });
});
