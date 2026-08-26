import type {
  WebGLEffectMaterialShaderDefinition,
  WebGLEffectUniformValue,
} from "@viselora/dom-webgl";

import {
  resolveHeroRadialGeometry,
  resolveHeroTransitionVisual,
  type HeroHoldTransitionState,
} from "../transition/holdTransition";
import type { HeroViewport } from "../shared/viewport";
import {
  resolveHeroChapterScrollState,
  type HeroChapterScrollState,
} from "../chapters/scrollState";
import {
  resolveHeroChapterFace,
  resolveHeroChapterLockProjection,
} from "../chapters/geometry";
import {
  getHeroChapterDefinition,
  heroChapterOrder,
} from "../chapters/definitions";
import { heroTransitionConfig } from "../transition/transitionConfig";

export const heroTetrahedronRadialShaderKey = "hero.tetrahedron.radial";
const vertexChunk = "#include <begin_vertex>";
const emissiveChunk = "#include <emissivemap_fragment>";
const opaqueChunk = "#include <opaque_fragment>";
const heroChapterFaceAtlasShader = createHeroChapterFaceAtlasShader();

export function createHeroTetrahedronRadialShader(
  chapterAtlas: HTMLCanvasElement,
): WebGLEffectMaterialShaderDefinition {
  return {
    key: heroTetrahedronRadialShaderKey,
    uniforms: {
      ...createHeroTetrahedronRadialUniforms(
        {
          committedScheme: "initial",
          targetScheme: "initial",
          origin: { x: 0.5, y: 0.5 },
          coverage: 0,
          phase: "idle",
          shakeActive: false,
        },
        { width: 1, height: 1 },
        resolveHeroChapterScrollState(0, 0),
      ),
      heroChapterAtlas: { kind: "canvas-texture", source: chapterAtlas },
    },
    compile: compileHeroTetrahedronRadialShader,
  } satisfies WebGLEffectMaterialShaderDefinition;
}

export function compileHeroTetrahedronRadialShader(
  draft: Parameters<WebGLEffectMaterialShaderDefinition["compile"]>[0],
): void {
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
  if (!draft.vertexShader.includes(vertexChunk)) {
    throw new Error(
      "Hero tetrahedron chapter shader could not find the Three begin_vertex chunk.",
    );
  }
  if (!draft.fragmentShader.includes(opaqueChunk)) {
    throw new Error(
      "Hero tetrahedron chapter shader could not find the Three opaque fragment chunk.",
    );
  }

  const varyings = `
varying vec3 heroObjectPosition;
varying vec3 heroObjectNormal;
`;
  const facePaletteStrength = heroTransitionConfig.visual.facePaletteStrength;
  const uniforms = `${varyings}
uniform vec3 heroCommittedColor;
uniform vec3 heroTargetColor;
uniform vec3 heroCommittedEmissive;
uniform vec3 heroTargetEmissive;
uniform vec3 heroCommittedBackground;
uniform vec3 heroTargetBackground;
uniform float heroCommittedEmissiveIntensity;
uniform float heroTargetEmissiveIntensity;
uniform vec2 heroRadialOrigin;
uniform float heroRadialRadiusPx;
uniform float heroRadialEdgePx;
uniform float heroGeometryRadius;
uniform float heroScreenLock;
uniform vec2 heroLockUvScale;
uniform vec3 heroTargetFaceNormal;
uniform vec3 heroTargetFaceRight;
uniform vec3 heroTargetFaceUp;
uniform sampler2D heroChapterAtlas;
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
vec3 heroFaceNormal = normalize(heroObjectNormal);
vec3 heroNormalizedTargetFaceNormal = normalize(heroTargetFaceNormal);
float heroTargetFace = step(0.999, dot(heroFaceNormal, heroNormalizedTargetFaceNormal));
vec3 heroFaceCenter = heroFaceNormal * (heroGeometryRadius / 3.0);
vec3 heroFaceUp = normalize(vec3(0.0, 1.0, 0.0) - heroFaceNormal * heroFaceNormal.y);
vec3 heroFaceRight = normalize(cross(heroFaceUp, heroFaceNormal));
vec3 heroFaceLocal = heroObjectPosition - heroFaceCenter;
vec2 heroFaceUv = vec2(
  0.5 + dot(heroFaceLocal, heroFaceRight) / (1.632993162 * heroGeometryRadius),
  0.5 + dot(heroFaceLocal, heroFaceUp) / (1.414213562 * heroGeometryRadius)
);
vec3 heroTargetRight = normalize(heroTargetFaceRight);
vec3 heroTargetUp = normalize(heroTargetFaceUp);
vec3 heroTargetLocal = heroObjectPosition - heroNormalizedTargetFaceNormal * (heroGeometryRadius / 3.0);
vec2 heroTargetUv = vec2(
  0.5 + heroLockUvScale.x * dot(heroTargetLocal, heroTargetRight) / (1.632993162 * heroGeometryRadius),
  0.5 + heroLockUvScale.y * dot(heroTargetLocal, heroTargetUp) / (1.414213562 * heroGeometryRadius)
);
heroFaceUv = mix(heroFaceUv, heroTargetUv, heroTargetFace);
vec2 heroScreenUv = heroFragmentCssPx / domWebGLViewportSize;
heroFaceUv = mix(heroFaceUv, heroScreenUv, heroTargetFace * heroScreenLock);
heroFaceUv = clamp(heroFaceUv, vec2(0.0), vec2(1.0));
${heroChapterFaceAtlasShader}
float heroChapterMask = texture2D(
  heroChapterAtlas,
  heroAtlasOffset + heroFaceUv * 0.5
).r;
vec3 heroCommittedChapter = mix(
  heroCommittedColor,
  heroCommittedBackground,
  heroChapterMask
);
vec3 heroTargetChapter = mix(
  heroTargetColor,
  heroTargetBackground,
  heroChapterMask
);
vec3 heroChapterColor = mix(
  heroCommittedChapter,
  heroTargetChapter,
  heroRadialMask
);
diffuseColor.rgb = heroChapterColor;
totalEmissiveRadiance = mix(
  heroChapterColor * heroCommittedEmissiveIntensity,
  heroChapterColor * heroTargetEmissiveIntensity,
  heroRadialMask
);`;

  draft.vertexShader = `${varyings}\n${draft.vertexShader.replace(
    vertexChunk,
    `${vertexChunk}\nheroObjectPosition = position;\nheroObjectNormal = normal;`,
  )}`;

  draft.fragmentShader = `${uniforms}\n${draft.fragmentShader
    .replace(emissiveChunk, radialMix)
    .replace(
      opaqueChunk,
      `float heroFacePaletteMix = mix(\n  ${facePaletteStrength},\n  1.0,\n  heroTargetFace * heroScreenLock\n);\noutgoingLight = mix(\n  outgoingLight,\n  heroChapterColor,\n  heroFacePaletteMix\n);\n${opaqueChunk}`,
    )}`;
}

export function createHeroTetrahedronRadialUniforms(
  transition: HeroHoldTransitionState,
  viewport: HeroViewport,
  chapter: HeroChapterScrollState = resolveHeroChapterScrollState(0, 0),
): Record<string, WebGLEffectUniformValue> {
  const visual = resolveHeroTransitionVisual(transition);
  const radial = resolveHeroRadialGeometry(
    transition.coverage,
    transition.origin,
    viewport,
  );
  const emissiveIntensity = heroTransitionConfig.motion.emissiveIntensity;
  const lockProjection = resolveHeroChapterLockProjection(viewport);
  const targetFace = resolveHeroChapterFace(chapter.chapterId);

  return {
    heroCommittedColor: visual.committed.foreground,
    heroTargetColor: visual.target.foreground,
    heroCommittedEmissive: visual.committed.foreground,
    heroTargetEmissive: visual.target.foreground,
    heroCommittedBackground: visual.committed.background,
    heroTargetBackground: visual.target.background,
    heroCommittedEmissiveIntensity: emissiveIntensity,
    heroTargetEmissiveIntensity: emissiveIntensity,
    heroRadialOrigin: [radial.origin.x, radial.origin.y],
    heroRadialRadiusPx: radial.radiusPx,
    heroRadialEdgePx: radial.edgeFeatherPx,
    heroGeometryRadius: heroTransitionConfig.geometry.radius,
    heroScreenLock: chapter.screenLock,
    heroTargetFaceNormal: targetFace.normal,
    heroTargetFaceRight: targetFace.right,
    heroTargetFaceUp: targetFace.up,
    heroLockUvScale: [
      lockProjection.widthFraction,
      lockProjection.heightFraction,
    ],
  };
}

function createHeroChapterFaceAtlasShader(): string {
  const definitions = heroChapterOrder.map((chapterId) =>
    getHeroChapterDefinition(chapterId),
  );
  const scoreDeclarations = definitions
    .map(
      (definition, index) =>
        `float heroFaceScore${index} = dot(heroFaceNormal, normalize(${glslVector3(definition.face.normal)}));`,
    )
    .join("\n");
  const lastDefinition = definitions.at(-1);
  if (!lastDefinition) {
    throw new TypeError(
      "Hero tetrahedron shader requires chapter definitions.",
    );
  }
  const branches = definitions
    .slice(0, -1)
    .map((definition, index) => {
      const comparisons = definitions
        .slice(index + 1)
        .map(
          (_, comparedIndex) =>
            `heroFaceScore${index} >= heroFaceScore${index + comparedIndex + 1}`,
        )
        .join(" && ");
      const prefix = index === 0 ? "if" : "else if";
      return `${prefix} (${comparisons}) {\n  heroAtlasOffset = ${glslVector2(definition.atlas.uvOffset)};\n}`;
    })
    .join(" ");

  return `${scoreDeclarations}\nvec2 heroAtlasOffset = ${glslVector2(lastDefinition.atlas.uvOffset)};\n${branches}`;
}

function glslVector2(value: readonly [number, number]): string {
  return `vec2(${glslNumber(value[0])}, ${glslNumber(value[1])})`;
}

function glslVector3(value: readonly [number, number, number]): string {
  return `vec3(${glslNumber(value[0])}, ${glslNumber(value[1])}, ${glslNumber(value[2])})`;
}

function glslNumber(value: number): string {
  return Number.isInteger(value) ? `${value.toFixed(1)}` : String(value);
}
