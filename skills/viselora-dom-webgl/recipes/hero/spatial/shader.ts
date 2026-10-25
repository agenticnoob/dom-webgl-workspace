import type { MeshStandardMaterial } from "three";
import { faceDefinitions } from "./config";
import { resolvePortalLockProjection } from "./geometry";
import { radialRadius } from "./frame";
import type { SpatialStage } from "./stage";
import type { SpatialPalette } from "./types";

export const spatialShaderKey = "recipe.spatial.material";
const vertexChunk = "#include <begin_vertex>";
const emissiveChunk = "#include <emissivemap_fragment>";
const opaqueChunk = "#include <opaque_fragment>";
const spatialChapterFaceAtlasShader = createFaceAtlasShader();

export function compileSpatialShader(
  draft: Parameters<MeshStandardMaterial["onBeforeCompile"]>[0],
): void {
  if (!draft.fragmentShader.includes(emissiveChunk)) {
    throw new Error(
      "Spatial recipe radial shader could not find the Three emissivemap fragment chunk.",
    );
  }
  if (!draft.vertexShader.includes(vertexChunk)) {
    throw new Error(
      "Spatial recipe chapter shader could not find the Three begin_vertex chunk.",
    );
  }
  if (!draft.fragmentShader.includes(opaqueChunk)) {
    throw new Error(
      "Spatial recipe chapter shader could not find the Three opaque fragment chunk.",
    );
  }

  const varyings = `
varying vec3 spatialObjectPosition;
varying vec3 spatialObjectNormal;
`;
  const facePaletteStrength = 0.3;
  const fresnelPower = 3.2;
  const uniforms = `${varyings}
uniform float domWebGLPixelRatio;
uniform vec4 spatialViewport;
uniform float spatialRimStrength;
uniform vec3 spatialCommittedColor;
uniform vec3 spatialTargetColor;
uniform vec3 spatialCommittedEmissive;
uniform vec3 spatialTargetEmissive;
uniform vec3 spatialCommittedBackground;
uniform vec3 spatialTargetBackground;
uniform float spatialCommittedEmissiveIntensity;
uniform float spatialTargetEmissiveIntensity;
uniform vec2 spatialRadialOrigin;
uniform float spatialRadialRadiusPx;
uniform float spatialRadialEdgePx;
uniform float spatialGeometryRadius;
uniform float spatialFaceLock;
uniform float spatialScreenLock;
uniform vec2 spatialLockUvScale;
uniform vec3 spatialTargetFaceNormal;
uniform vec3 spatialTargetFaceRight;
uniform vec3 spatialTargetFaceUp;
uniform vec4 spatialTailFaces;
uniform sampler2D spatialChapterAtlas;
`;
  const radialMix = `${emissiveChunk}
vec2 spatialFragmentCssPx = gl_FragCoord.xy / domWebGLPixelRatio - spatialViewport.xy;
vec2 spatialOriginCssPx = spatialRadialOrigin * spatialViewport.zw;
float spatialRadialDistancePx = length(spatialFragmentCssPx - spatialOriginCssPx);
float spatialRadialMask = 1.0 - smoothstep(
  spatialRadialRadiusPx - spatialRadialEdgePx,
  spatialRadialRadiusPx + spatialRadialEdgePx,
  spatialRadialDistancePx
);
vec3 spatialFaceNormal = normalize(spatialObjectNormal);
vec3 spatialNormalizedTargetFaceNormal = normalize(spatialTargetFaceNormal);
float spatialTargetFace = step(0.999, dot(spatialFaceNormal, spatialNormalizedTargetFaceNormal));
vec3 spatialFaceCenter = spatialFaceNormal * (spatialGeometryRadius / 3.0);
vec3 spatialFaceUp = normalize(vec3(0.0, 1.0, 0.0) - spatialFaceNormal * spatialFaceNormal.y);
vec3 spatialFaceRight = normalize(cross(spatialFaceUp, spatialFaceNormal));
vec3 spatialFaceLocal = spatialObjectPosition - spatialFaceCenter;
vec2 spatialFaceUv = vec2(
  0.5 + dot(spatialFaceLocal, spatialFaceRight) / (1.632993162 * spatialGeometryRadius),
  0.5 + dot(spatialFaceLocal, spatialFaceUp) / (1.414213562 * spatialGeometryRadius)
);
vec3 spatialTargetRight = normalize(spatialTargetFaceRight);
vec3 spatialTargetUp = normalize(spatialTargetFaceUp);
vec3 spatialTargetLocal = spatialObjectPosition - spatialNormalizedTargetFaceNormal * (spatialGeometryRadius / 3.0);
vec2 spatialTargetUv = vec2(
  0.5 + spatialLockUvScale.x * dot(spatialTargetLocal, spatialTargetRight) / (1.632993162 * spatialGeometryRadius),
  0.5 + spatialLockUvScale.y * dot(spatialTargetLocal, spatialTargetUp) / (1.414213562 * spatialGeometryRadius)
);
spatialFaceUv = mix(spatialFaceUv, spatialTargetUv, spatialTargetFace * spatialFaceLock);
vec2 spatialScreenUv = spatialFragmentCssPx / spatialViewport.zw;
spatialFaceUv = mix(spatialFaceUv, spatialScreenUv, spatialTargetFace * spatialScreenLock);
spatialFaceUv = clamp(spatialFaceUv, vec2(0.0), vec2(1.0));
${spatialChapterFaceAtlasShader}
float spatialChapterMask = texture2D(
  spatialChapterAtlas,
  spatialAtlasOffset + spatialFaceUv * vec2(0.5, 0.25)
).r;
vec3 spatialCommittedChapter = mix(
  spatialCommittedColor,
  spatialCommittedBackground,
  spatialChapterMask
);
vec3 spatialTargetChapter = mix(
  spatialTargetColor,
  spatialTargetBackground,
  spatialChapterMask
);
vec3 spatialChapterColor = mix(
  spatialCommittedChapter,
  spatialTargetChapter,
  spatialRadialMask
);
diffuseColor.rgb = spatialChapterColor;
totalEmissiveRadiance = mix(
  spatialChapterColor * spatialCommittedEmissiveIntensity,
  spatialChapterColor * spatialTargetEmissiveIntensity,
  spatialRadialMask
);`;
  const depthLighting = `float spatialScreenLockedFace = spatialTargetFace * spatialScreenLock;
float spatialFacePaletteMix = mix(
  ${facePaletteStrength},
  1.0,
  spatialScreenLockedFace
);
outgoingLight = mix(
  outgoingLight,
  spatialChapterColor,
  spatialFacePaletteMix
);
float spatialFresnel = pow(
  1.0 - clamp(
    dot(normalize(normal), normalize(vViewPosition)),
    0.0,
    1.0
  ),
  ${fresnelPower}
);
float spatialFresnelWeight = spatialFresnel * spatialRimStrength * (1.0 - spatialScreenLockedFace);
outgoingLight += spatialChapterColor * spatialFresnelWeight;`;

  draft.vertexShader = `${varyings}\n${draft.vertexShader.replace(
    vertexChunk,
    `${vertexChunk}\nspatialObjectPosition = position;\nspatialObjectNormal = normal;`,
  )}`;

  draft.fragmentShader = `${uniforms}\n${draft.fragmentShader
    .replace(emissiveChunk, radialMix)
    .replace(opaqueChunk, `${depthLighting}\n${opaqueChunk}`)}`;
}

export function spatialUniforms(
  stage: SpatialStage,
  palette: SpatialPalette,
  rimStrength: number,
): Record<string, unknown> {
  const { viewport, hold, frame } = stage;
  const foreground =
    hold.scheme === 0 ? palette.foreground : palette.background;
  const background =
    hold.scheme === 0 ? palette.background : palette.foreground;
  const face = faceDefinitions[frame.faceIndex];
  const lock = resolvePortalLockProjection(viewport);
  const tails = stage.tails;
  return {
    spatialViewport: [
      viewport.left,
      viewport.windowHeight - viewport.top - viewport.height,
      viewport.width,
      viewport.height,
    ],
    spatialRimStrength: rimStrength,
    spatialCommittedColor: foreground,
    spatialTargetColor: background,
    spatialCommittedEmissive: foreground,
    spatialTargetEmissive: background,
    spatialCommittedBackground: background,
    spatialTargetBackground: foreground,
    spatialCommittedEmissiveIntensity: 0.035,
    spatialTargetEmissiveIntensity: 0.035,
    spatialRadialOrigin: [hold.origin[0], 1 - hold.origin[1]],
    spatialRadialRadiusPx: stage.reducedMotion
      ? 0
      : radialRadius(
          hold.coverage,
          hold.origin,
          viewport.width,
          viewport.height,
        ),
    spatialRadialEdgePx: 1.5,
    spatialGeometryRadius: 0.52,
    spatialFaceLock: frame.approach,
    spatialScreenLock: frame.screenLock,
    spatialTargetFaceNormal: face.normal,
    spatialTargetFaceRight: face.right,
    spatialTargetFaceUp: face.up,
    spatialTailFaces: [
      tails[0] ?? 0,
      tails[1] ?? 0,
      tails[2] ?? 0,
      tails[3] ?? 0,
    ],
    spatialLockUvScale: [lock.widthFraction, lock.heightFraction],
  };
}

function createFaceAtlasShader(): string {
  const scores = faceDefinitions
    .map(
      (face, index) =>
        `float spatialScore${index} = dot(spatialFaceNormal, normalize(vec3(${face.normal.map((n) => n.toFixed(1)).join(",")})));`,
    )
    .join("\n");
  const branches = faceDefinitions
    .map((face, index) => {
      const condition = faceDefinitions
        .slice(index + 1)
        .map(
          (_, next) =>
            `spatialScore${index} >= spatialScore${index + next + 1}`,
        )
        .join(" && ");
      const prefix =
        index === 0
          ? `if (${condition})`
          : index === 3
            ? "else"
            : `else if (${condition})`;
      const component = ["x", "y", "z", "w"][index];
      return `${prefix} { spatialAtlasOffset = vec2(${face.uvOffset.map((n) => n.toFixed(1)).join(",")}); spatialTailFace = spatialTailFaces.${component}; }`;
    })
    .join("\n");
  return `${scores}\nvec2 spatialAtlasOffset;\nfloat spatialTailFace;\n${branches}\nspatialAtlasOffset.y = spatialAtlasOffset.y * 0.5 + 0.5 * (1.0 - spatialTailFace);`;
}
