import { describe, expect, test } from "vitest";

import {
  createHeroGhostCursorMaterialProgram,
  createHeroGhostCursorUniforms,
  heroGhostTrailLengths,
} from "../src/ghost/cursorProgram";

const baseOptions = {
  width: 1200,
  height: 900,
  pointerX: 600,
  pointerY: 450,
  pointerIntensity: 0.8,
  time: 1200,
  baseBackgroundColor: "#B8B8B8",
  baseForegroundColor: "#5F5F5F",
  targetBackgroundColor: "#5F5F5F",
  targetForegroundColor: "#B8B8B8",
  radialOrigin: [0.25, 0.75],
  radialRadiusPx: 420,
  radialEdgePx: 1.5,
  sceneOpacity: 1,
  brightness: 0.9,
  trailPoints: [
    [600, 450],
    [560, 430],
  ],
} as const;

describe("hero Ghost Cursor material programs", () => {
  test("renders the exact pixel-space circular semantic mask", () => {
    const program = createHeroGhostCursorMaterialProgram(
      "background",
      baseOptions,
    );

    expect(heroGhostTrailLengths.background).toBe(36);
    expect(program.defines).toEqual({
      HERO_FOREGROUND: 0,
      MAX_TRAIL_LENGTH: 36,
    });
    expect(program.blend).toBe("normal");
    expect(program.fragmentShader).toContain("float fbm(vec2 p)");
    expect(program.fragmentShader).toContain("vec4 blob(");
    expect(program.fragmentShader).toContain(
      "float radius = 0.24 + 0.14 / iScale",
    );
    expect(program.fragmentShader).toContain(
      "vec2 radialPointPx = vUv * iResolution.xy",
    );
    expect(program.fragmentShader).toContain(
      "length(radialPointPx - radialOriginPx)",
    );
    expect(program.fragmentShader).toContain("smoothstep(");
    expect(program.fragmentShader).toContain(
      "mix(iBaseBackgroundColor, iTargetBackgroundColor, radialMask)",
    );
    expect(program.fragmentShader).toContain(
      "mix(iBaseForegroundColor, iTargetForegroundColor, radialMask)",
    );
    expect(program.fragmentShader).toContain(
      "mix(radialBackground, fogTint, fogStrength)",
    );
    expect(program.fragmentShader).not.toContain("vec3(0.72)");
    expect(program.fragmentShader).not.toContain("uniform vec3 iBackgroundColor");
    expect(program.fragmentShader).not.toContain("uniform vec3 iForegroundColor");
    expect(program.fragmentShader).not.toContain("uSource");
    expect(program.fragmentShader).not.toContain("Boo!");
  });

  test("keeps the transparent foreground path on the resolved radial foreground", () => {
    const program = createHeroGhostCursorMaterialProgram(
      "foreground",
      baseOptions,
    );

    expect(heroGhostTrailLengths.foreground).toBe(12);
    expect(program.defines).toEqual({
      HERO_FOREGROUND: 1,
      MAX_TRAIL_LENGTH: 12,
    });
    expect(program.fragmentShader).toContain("#if HERO_FOREGROUND == 1");
    expect(program.fragmentShader).toContain("iBrightness * 1.5 * iSceneOpacity");
    expect(program.fragmentShader).not.toContain("colorAcc * 0.32");
  });

  test("normalizes pointer, radial, semantic colors, and trail uniforms", () => {
    const uniforms = createHeroGhostCursorUniforms("foreground", baseOptions);

    expect(uniforms).toMatchObject({
      iTime: 1.2,
      iResolution: [1200, 900, 1],
      iMouse: [0.5, 0.5],
      iBaseBackgroundColor: [184 / 255, 184 / 255, 184 / 255],
      iBaseForegroundColor: [95 / 255, 95 / 255, 95 / 255],
      iTargetBackgroundColor: [95 / 255, 95 / 255, 95 / 255],
      iTargetForegroundColor: [184 / 255, 184 / 255, 184 / 255],
      iRadialOrigin: [0.25, 0.75],
      iRadialRadiusPx: 420,
      iRadialEdgePx: 1.5,
      iSceneOpacity: 1,
    });
    expect(uniforms.iPrevMouse).toEqual(
      expect.arrayContaining([
        [0.5, 0.5],
        [560 / 1200, 1 - 430 / 900],
      ]),
    );
    expect((uniforms.iPrevMouse as readonly unknown[]).length).toBe(12);
  });
});
