import type { WebGLEffectMaterialShaderDraft } from "@viselora/dom-webgl";
import { describe, expect, test } from "vitest";

import {
  createHeroHoldTransitionState,
  resolveHeroRadialGeometry,
  type HeroHoldTransitionState,
} from "../src/heroHoldTransition";
import {
  createHeroTetrahedronRadialUniforms,
  heroTetrahedronRadialShader,
} from "../src/heroTetrahedronShader";

const viewport = { width: 1200, height: 835 } as const;

describe("hero tetrahedron radial shader", () => {
  test("mixes diffuse and emissive inputs through the shared CSS-pixel circle before lighting", () => {
    const draft = createDraft("standard");

    heroTetrahedronRadialShader.compile(draft);

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
    expect(draft.fragmentShader).toContain(
      "diffuseColor.rgb = mix(heroCommittedColor, heroTargetColor, heroRadialMask)",
    );
    expect(draft.fragmentShader).toContain(
      "totalEmissiveRadiance = mix(",
    );
    expect(draft.fragmentShader.indexOf("heroRadialMask")).toBeLessThan(
      draft.fragmentShader.indexOf("#include <lights_fragment_begin>"),
    );
    expect(draft.fragmentShader).not.toContain("noise(");
  });

  test("supports Physical lit shaders but rejects Basic and missing chunks", () => {
    expect(() => heroTetrahedronRadialShader.compile(createDraft("physical"))).not
      .toThrow();
    expect(() => heroTetrahedronRadialShader.compile(createDraft("basic"))).toThrow(
      "requires a Standard or Physical managed material",
    );
    const missing = createDraft("standard");
    missing.fragmentShader = "#include <lights_fragment_begin>";
    expect(() => heroTetrahedronRadialShader.compile(missing)).toThrow(
      "could not find the Three emissivemap fragment chunk",
    );
  });

  test.each([
    {
      name: "initial",
      state: createHeroHoldTransitionState("initial"),
      committed: "#5F5F5F",
      target: "#5F5F5F",
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
    },
  ])("resolves exact $name palette, origin, radius, edge, and emissive inputs", ({
    state,
    committed,
    target,
  }) => {
    const radial = resolveHeroRadialGeometry(
      state.coverage,
      state.origin,
      viewport,
    );

    expect(createHeroTetrahedronRadialUniforms(state, viewport)).toEqual({
      heroCommittedColor: committed,
      heroTargetColor: target,
      heroCommittedEmissive: committed,
      heroTargetEmissive: target,
      heroCommittedEmissiveIntensity: 0.06,
      heroTargetEmissiveIntensity: 0.06,
      heroRadialOrigin: [state.origin.x, state.origin.y],
      heroRadialRadiusPx: radial.radiusPx,
      heroRadialEdgePx: 1.5,
    });
  });
});

function createDraft(
  materialKind: WebGLEffectMaterialShaderDraft["materialKind"],
): WebGLEffectMaterialShaderDraft {
  return {
    materialKind,
    vertexShader: "#include <begin_vertex>",
    fragmentShader:
      "#include <emissivemap_fragment>\n#include <lights_fragment_begin>",
    uniforms: {},
    defines: {},
  } satisfies WebGLEffectMaterialShaderDraft;
}

function transition(
  values: Partial<HeroHoldTransitionState>,
): HeroHoldTransitionState {
  return { ...createHeroHoldTransitionState(), ...values };
}
