import type {
  WebGLEffectMaterialShaderDefinition,
  WebGLEffectUniformValue,
} from "@viselora/dom-webgl";

import {
  resolveHeroRadialGeometry,
  resolveHeroTransitionVisual,
  type HeroHoldTransitionState,
  type HeroViewport,
} from "./heroHoldTransition";
import { heroTransitionConfig } from "./heroTransitionConfig";

const shaderKey = "hero.tetrahedron.radial";
const emissiveChunk = "#include <emissivemap_fragment>";

export const heroTetrahedronRadialShader = {
  key: shaderKey,
  uniforms: createHeroTetrahedronRadialUniforms(
    {
      committedScheme: "initial",
      targetScheme: "initial",
      origin: { x: 0.5, y: 0.5 },
      coverage: 0,
      phase: "idle",
      shakeActive: false,
    },
    { width: 1, height: 1 },
  ),
  compile(draft) {
    if (draft.materialKind === "basic") {
      throw new Error(
        "Hero tetrahedron radial shader requires a Standard or Physical managed material.",
      );
    }
    if (!draft.fragmentShader.includes(emissiveChunk)) {
      throw new Error(
        "Hero tetrahedron radial shader could not find the Three emissivemap fragment chunk.",
      );
    }

    const uniforms = `
uniform vec3 heroCommittedColor;
uniform vec3 heroTargetColor;
uniform vec3 heroCommittedEmissive;
uniform vec3 heroTargetEmissive;
uniform float heroCommittedEmissiveIntensity;
uniform float heroTargetEmissiveIntensity;
uniform vec2 heroRadialOrigin;
uniform float heroRadialRadiusPx;
uniform float heroRadialEdgePx;
`;
    const radialMix = `${emissiveChunk}
vec2 heroFragmentCssPx = gl_FragCoord.xy / domWebGLPixelRatio;
vec2 heroOriginCssPx = heroRadialOrigin * domWebGLViewportSize;
float heroRadialDistancePx = length(heroFragmentCssPx - heroOriginCssPx);
float heroRadialMask = 1.0 - smoothstep(
  heroRadialRadiusPx - heroRadialEdgePx,
  heroRadialRadiusPx + heroRadialEdgePx,
  heroRadialDistancePx
);
diffuseColor.rgb = mix(heroCommittedColor, heroTargetColor, heroRadialMask);
totalEmissiveRadiance = mix(
  heroCommittedEmissive * heroCommittedEmissiveIntensity,
  heroTargetEmissive * heroTargetEmissiveIntensity,
  heroRadialMask
);`;

    draft.fragmentShader = `${uniforms}\n${draft.fragmentShader.replace(
      emissiveChunk,
      radialMix,
    )}`;
  },
} satisfies WebGLEffectMaterialShaderDefinition;

export function createHeroTetrahedronRadialUniforms(
  transition: HeroHoldTransitionState,
  viewport: HeroViewport,
): Record<string, WebGLEffectUniformValue> {
  const visual = resolveHeroTransitionVisual(transition);
  const radial = resolveHeroRadialGeometry(
    transition.coverage,
    transition.origin,
    viewport,
  );
  const emissiveIntensity = heroTransitionConfig.motion.emissiveIntensity;

  return {
    heroCommittedColor: visual.committed.foreground,
    heroTargetColor: visual.target.foreground,
    heroCommittedEmissive: visual.committed.foreground,
    heroTargetEmissive: visual.target.foreground,
    heroCommittedEmissiveIntensity: emissiveIntensity,
    heroTargetEmissiveIntensity: emissiveIntensity,
    heroRadialOrigin: [radial.origin.x, radial.origin.y],
    heroRadialRadiusPx: radial.radiusPx,
    heroRadialEdgePx: radial.edgeFeatherPx,
  };
}
