import { describe, expect, test } from "vitest";

import {
  calculateGhostCursorScale,
  createGhostCursorMaterialProgram,
  createGhostCursorUniforms,
} from "./ghostCursorSurface";

describe("ghost cursor material program", () => {
  test("uses the controlled ReactBits fbm blob and trail shader model", () => {
    const program = createGhostCursorMaterialProgram({
      color: "#b497cf",
      opacity: 0.9,
      pointerActive: true,
      pointerIntensity: 1,
      pointerX: 160,
      pointerY: 90,
      time: 1200,
      trailLength: 32,
      width: 320,
      height: 180,
    });

    expect(program.defines).toMatchObject({ MAX_TRAIL_LENGTH: 50 });
    expect(program.fragmentShader).toContain("uniform vec2  iPrevMouse[MAX_TRAIL_LENGTH]");
    expect(program.fragmentShader).toContain("float fbm(vec2 p)");
    expect(program.fragmentShader).toContain("vec4 blob(");
    expect(program.fragmentShader).toContain("for (int i = 0; i < MAX_TRAIL_LENGTH; i++)");
    expect(program.fragmentShader).not.toContain("smokeLine");
    expect(program.fragmentShader).not.toContain("lineField");
    expect(program.fragmentShader).not.toContain("cursorColor");
  });

  test("maps DOM pointer and trail points into normalized shader coordinates", () => {
    const uniforms = createGhostCursorUniforms({
      color: "#b497cf",
      opacity: 0.9,
      pointerActive: true,
      pointerIntensity: 0.5,
      pointerX: 320,
      pointerY: 0,
      trailPoints: [
        [0, 180],
        [160, 90],
      ],
      time: 1200,
      trailLength: 32,
      width: 320,
      height: 180,
    });

    expect(uniforms.iMouse).toEqual([1, 1]);
    expect(uniforms.iPrevMouse).toEqual(
      expect.arrayContaining([
        [0, 0],
        [0.5, 0.5],
      ]),
    );
    expect(Array.isArray(uniforms.iPrevMouse)).toBe(true);
    expect((uniforms.iPrevMouse as readonly unknown[]).length).toBe(50);
  });

  test("keeps ReactBits controls as scalar/vector uniforms only", () => {
    const uniforms = createGhostCursorUniforms({
      color: "#b497cf",
      opacity: 1.2,
      pointerActive: true,
      pointerIntensity: 2,
      pointerX: 160,
      pointerY: 90,
      time: 1200,
      trailLength: 32,
      width: 1200,
      height: 900,
    });

    expect(uniforms.iResolution).toEqual([1200, 900, 1]);
    expect(uniforms.iTime).toBe(1.2);
    expect(uniforms.iOpacity).toBe(1);
    expect(uniforms.iBrightness).toBe(1.2);
    expect(uniforms.iBaseColor).toEqual([
      180 / 255,
      151 / 255,
      207 / 255,
    ]);
    expect(uniforms.iScale).toBe(calculateGhostCursorScale(1200, 900));
  });
});
