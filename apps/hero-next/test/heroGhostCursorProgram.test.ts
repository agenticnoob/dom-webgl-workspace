import { describe, expect, test } from "vitest";

import {
  createHeroGhostCursorMaterialProgram,
  createHeroGhostCursorUniforms,
  heroGhostTrailLengths,
} from "../src/heroGhostCursorProgram";

const baseOptions = {
  width: 1200,
  height: 900,
  pointerX: 600,
  pointerY: 450,
  pointerIntensity: 0.8,
  time: 1200,
  color: "#3f3f3f",
  brightness: 0.9,
  trailPoints: [
    [600, 450],
    [560, 430],
  ],
} as const;

describe("hero Ghost Cursor material programs", () => {
  test("compiles an opaque 36-sample background program without source copy", () => {
    const program = createHeroGhostCursorMaterialProgram("background", baseOptions);

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
    expect(program.fragmentShader).not.toContain(
      "float radius = 0.5 + 0.3 / iScale",
    );
    expect(program.fragmentShader).toContain("vec3 base = vec3(0.72)");
    expect(program.fragmentShader).toContain("vec3 tint = iBaseColor");
    expect(program.fragmentShader).toContain(
      "vec3 fogTint = colorAcc / max(alphaAcc, 0.0001)",
    );
    expect(program.fragmentShader).toContain(
      "float fogStrength = clamp(outAlpha * iBrightness, 0.0, 1.0)",
    );
    expect(program.fragmentShader).toContain(
      "mix(base, fogTint, fogStrength)",
    );
    expect(program.fragmentShader).not.toContain("base + colorAcc * outAlpha");
    expect(program.fragmentShader).not.toContain("uSource");
    expect(program.fragmentShader).not.toContain("Boo!");
  });

  test("compiles a transparent 12-sample foreground without double alpha attenuation", () => {
    const program = createHeroGhostCursorMaterialProgram("foreground", baseOptions);

    expect(heroGhostTrailLengths.foreground).toBe(12);
    expect(program.defines).toEqual({
      HERO_FOREGROUND: 1,
      MAX_TRAIL_LENGTH: 12,
    });
    expect(program.blend).toBe("normal");
    expect(program.fragmentShader).toContain("#if HERO_FOREGROUND == 1");
    expect(program.fragmentShader).toContain(
      "vec4(foregroundTint, outAlpha * iBrightness * 1.5)",
    );
    expect(program.fragmentShader).not.toContain("colorAcc * 0.32");
    expect(program.fragmentShader).not.toContain("foregroundTint * iBrightness");
  });

  test("normalizes DOM pointer and pads the layer-specific trail", () => {
    const uniforms = createHeroGhostCursorUniforms("foreground", baseOptions);

    expect(uniforms.iTime).toBe(1.2);
    expect(uniforms.iResolution).toEqual([1200, 900, 1]);
    expect(uniforms.iMouse).toEqual([0.5, 0.5]);
    expect(uniforms.iBaseColor).toEqual([63 / 255, 63 / 255, 63 / 255]);
    expect(uniforms.iPrevMouse).toEqual(
      expect.arrayContaining([
        [0.5, 0.5],
        [560 / 1200, 1 - 430 / 900],
      ]),
    );
    expect((uniforms.iPrevMouse as readonly unknown[]).length).toBe(12);
  });
});
