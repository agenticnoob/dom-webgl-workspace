import type { WebGLEffectMaterialShaderDraft } from "@viselora/dom-webgl";
import { describe, expect, test } from "vitest";

import {
  createHeroHoldTransitionState,
  resolveHeroRadialGeometry,
  type HeroHoldTransitionState,
} from "../src/transition/holdTransition";
import { resolveHeroChapterScrollState } from "../src/chapters/scrollState";
import { resolveHeroChapterLockProjection } from "../src/chapters/geometry";
import { heroTransitionConfig } from "../src/transition/transitionConfig";
import { heroChapterOrder } from "../src/chapters/definitions";
import {
  compileHeroTetrahedronRadialShader,
  createHeroTetrahedronRadialShader,
  createHeroTetrahedronRadialUniforms,
} from "../src/tetrahedron/shader";

const viewport = { width: 1200, height: 835 } as const;

describe("hero tetrahedron radial shader", () => {
  test("identifies flat faces and mixes face-space into locked screen-space before lighting", () => {
    const draft = createDraft("standard");

    compileHeroTetrahedronRadialShader(draft);

    expect(draft.fragmentShader).toContain(
      "gl_FragCoord.xy / domWebGLPixelRatio",
    );
    expect(draft.fragmentShader).toContain(
      "heroRadialOrigin * domWebGLViewportSize",
    );
    expect(draft.fragmentShader).toContain(
      "heroRadialRadiusPx - heroRadialEdgePx",
    );
    expect(draft.fragmentShader).toContain(
      "heroRadialRadiusPx + heroRadialEdgePx",
    );
    expect(draft.vertexShader).toContain("heroObjectPosition = position");
    expect(draft.vertexShader).toContain("heroObjectNormal = normal");
    expect(draft.fragmentShader).toContain("float heroFaceScore0 = dot(");
    expect(draft.fragmentShader).toContain(
      "heroAtlasOffset + heroFaceUv * 0.5",
    );
    expect(draft.fragmentShader).toContain(
      "mix(heroFaceUv, heroScreenUv, heroTargetFace * heroScreenLock)",
    );
    expect(draft.fragmentShader).toContain(
      "heroLockUvScale.x * dot(heroTargetLocal, heroTargetRight)",
    );
    expect(draft.fragmentShader).toContain(
      "heroLockUvScale.y * dot(heroTargetLocal, heroTargetUp)",
    );
    expect(draft.fragmentShader).toContain("uniform vec3 heroTargetFaceNormal");
    expect(draft.fragmentShader).toContain("uniform vec3 heroTargetFaceRight");
    expect(draft.fragmentShader).toContain("uniform vec3 heroTargetFaceUp");
    expect(draft.fragmentShader).toContain(
      "diffuseColor.rgb = heroChapterColor",
    );
    expect(draft.fragmentShader).toContain("totalEmissiveRadiance = mix(");
    expect(draft.fragmentShader.indexOf("heroRadialMask")).toBeLessThan(
      draft.fragmentShader.indexOf("#include <lights_fragment_begin>"),
    );
    expect(draft.fragmentShader).not.toContain("noise(");
  });

  test("keeps one inverse chapter palette across face and screen coordinates", () => {
    const draft = createDraft("standard");

    compileHeroTetrahedronRadialShader(draft);

    expect(draft.fragmentShader).toContain(
      "vec3 heroCommittedChapter = mix(\n  heroCommittedColor,\n  heroCommittedBackground,",
    );
    expect(draft.fragmentShader).toContain(
      "vec3 heroTargetChapter = mix(\n  heroTargetColor,\n  heroTargetBackground,",
    );
    expect(draft.fragmentShader).not.toContain("heroCommittedDomChapter");
    expect(draft.fragmentShader).not.toContain("heroChapterScreenMix");
    expect(draft.fragmentShader).toContain(
      "float heroFacePaletteMix = mix(\n  0.58,\n  1.0,\n  heroTargetFace * heroScreenLock",
    );
    expect(draft.fragmentShader).toContain(
      "mix(\n  outgoingLight,\n  heroChapterColor,\n  heroFacePaletteMix",
    );
  });

  test("supports Physical lit shaders but rejects Basic and missing chunks", () => {
    expect(() =>
      compileHeroTetrahedronRadialShader(createDraft("physical")),
    ).not.toThrow();
    expect(() =>
      compileHeroTetrahedronRadialShader(createDraft("basic")),
    ).toThrow("requires a Standard or Physical managed material");
    const missing = createDraft("standard");
    missing.fragmentShader = "#include <lights_fragment_begin>";
    expect(() => compileHeroTetrahedronRadialShader(missing)).toThrow(
      "could not find the Three emissivemap fragment chunk",
    );
  });

  test("declares the runtime-owned chapter atlas before setup can update it", () => {
    const canvas = document.createElement("canvas");
    const shader = createHeroTetrahedronRadialShader(canvas);

    expect(shader.uniforms).toMatchObject({
      heroChapterAtlas: { kind: "canvas-texture", source: canvas },
    });
  });

  test.each([
    {
      name: "initial",
      state: createHeroHoldTransitionState("initial"),
      committed: "#5F5F5F",
      target: "#5F5F5F",
      committedBackground: "#B8B8B8",
      targetBackground: "#B8B8B8",
    },
    {
      name: "half-expanded",
      state: transition({
        targetScheme: "inverted",
        origin: { x: 0.25, y: 0.75 },
        coverage: 0.5,
        phase: "expanding",
        shakeActive: true,
      }),
      committed: "#5F5F5F",
      target: "#B8B8B8",
      committedBackground: "#B8B8B8",
      targetBackground: "#5F5F5F",
    },
    {
      name: "retracting",
      state: transition({
        targetScheme: "inverted",
        origin: { x: 0.25, y: 0.75 },
        coverage: 0.25,
        phase: "retracting",
      }),
      committed: "#5F5F5F",
      target: "#B8B8B8",
      committedBackground: "#B8B8B8",
      targetBackground: "#5F5F5F",
    },
    {
      name: "committed-inverted",
      state: transition({
        committedScheme: "inverted",
        targetScheme: "inverted",
        coverage: 1,
        phase: "awaiting-release",
      }),
      committed: "#B8B8B8",
      target: "#B8B8B8",
      committedBackground: "#5F5F5F",
      targetBackground: "#5F5F5F",
    },
    {
      name: "second-direction",
      state: transition({
        committedScheme: "inverted",
        targetScheme: "initial",
        origin: { x: 0.8, y: 0.2 },
        coverage: 0.4,
        phase: "expanding",
        shakeActive: true,
      }),
      committed: "#B8B8B8",
      target: "#5F5F5F",
      committedBackground: "#5F5F5F",
      targetBackground: "#B8B8B8",
    },
  ])(
    "resolves exact $name palette, origin, radius, edge, and emissive inputs",
    ({ state, committed, target, committedBackground, targetBackground }) => {
      const radial = resolveHeroRadialGeometry(
        state.coverage,
        state.origin,
        viewport,
      );
      const lockProjection = resolveHeroChapterLockProjection(viewport);

      expect(createHeroTetrahedronRadialUniforms(state, viewport)).toEqual({
        heroCommittedColor: committed,
        heroTargetColor: target,
        heroCommittedEmissive: committed,
        heroTargetEmissive: target,
        heroCommittedBackground: committedBackground,
        heroTargetBackground: targetBackground,
        heroCommittedEmissiveIntensity: 0.06,
        heroTargetEmissiveIntensity: 0.06,
        heroRadialOrigin: [state.origin.x, state.origin.y],
        heroRadialRadiusPx: radial.radiusPx,
        heroRadialEdgePx: 1.5,
        heroGeometryRadius: 0.52,
        heroScreenLock: 0,
        heroTargetFaceNormal: [-1, 1, 1],
        heroTargetFaceRight: [0, -1, 1],
        heroTargetFaceUp: [2, 1, 1],
        heroLockUvScale: [
          lockProjection.widthFraction,
          lockProjection.heightFraction,
        ],
      });
    },
  );

  test("publishes progressive screen lock through the rotating reveal without changing theme state", () => {
    const { lockEnd } = heroTransitionConfig.chapterScroll.entry;
    const chapter = resolveHeroChapterScrollState(
      firstChapterFlightEntry((lockEnd + 1) / 2),
      0,
    );
    const uniforms = createHeroTetrahedronRadialUniforms(
      createHeroHoldTransitionState("inverted"),
      viewport,
      chapter,
    );

    expect(chapter.phase).toBe("triangle-reveal");
    expect(chapter.screenLock).toBeGreaterThan(0);
    expect(chapter.screenLock).toBeLessThan(1);
    expect(chapter.screenLock).toBe(chapter.triangleReveal);
    expect(uniforms.heroScreenLock).toBe(chapter.screenLock);
    expect(uniforms.heroLockUvScale).toEqual([
      resolveHeroChapterLockProjection(viewport).widthFraction,
      resolveHeroChapterLockProjection(viewport).heightFraction,
    ]);
    expect(uniforms).toMatchObject({
      heroCommittedColor: "#B8B8B8",
      heroCommittedBackground: "#5F5F5F",
    });
  });

  test("selects a distinct target face for every chapter", () => {
    const normals = heroChapterOrder.map(
      (chapterId) =>
        createHeroTetrahedronRadialUniforms(
          createHeroHoldTransitionState(),
          viewport,
          resolveHeroChapterScrollState(0.5, 0, chapterId),
        ).heroTargetFaceNormal,
    );

    expect(new Set(normals.map((normal) => JSON.stringify(normal))).size).toBe(
      4,
    );
  });
});

function firstChapterFlightEntry(flightProgress: number): number {
  const { introHandoffEnd } = heroTransitionConfig.chapterScroll.entry;
  return introHandoffEnd + (1 - introHandoffEnd) * flightProgress;
}

function createDraft(
  materialKind: WebGLEffectMaterialShaderDraft["materialKind"],
): WebGLEffectMaterialShaderDraft {
  return {
    materialKind,
    vertexShader: "#include <begin_vertex>",
    fragmentShader:
      "#include <emissivemap_fragment>\n#include <lights_fragment_begin>\nvec3 outgoingLight = vec3(0.0);\n#include <opaque_fragment>",
    uniforms: {},
    defines: {},
  } satisfies WebGLEffectMaterialShaderDraft;
}

function transition(
  values: Partial<HeroHoldTransitionState>,
): HeroHoldTransitionState {
  return { ...createHeroHoldTransitionState(), ...values };
}
