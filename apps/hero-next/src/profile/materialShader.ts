import type { MeshStandardMaterial } from "three";

export const heroProfileMaterialShaderKey = "hero.profile.material";

const opaqueChunk = "#include <opaque_fragment>";
const normalMapChunk = "#include <normal_fragment_maps>";

export function compileHeroProfileMaterialShader(draft: {
  fragmentShader: string;
}): void {
  if (!draft.fragmentShader.includes(opaqueChunk)) {
    throw new Error(
      "Hero profile material shader could not find the Three opaque fragment chunk.",
    );
  }
  if (!draft.fragmentShader.includes(normalMapChunk)) {
    throw new Error(
      "Hero profile material shader could not find the Three normal-map fragment chunk.",
    );
  }

  draft.fragmentShader = draft.fragmentShader
    .replace(normalMapChunk, "")
    .replace(
      opaqueChunk,
      `outgoingLight = mix(outgoingLight, diffuseColor.rgb, 0.32);\n${opaqueChunk}`,
    );
}

export function configureHeroProfileMaterial(
  material: MeshStandardMaterial,
): void {
  material.onBeforeCompile = compileHeroProfileMaterialShader;
  material.customProgramCacheKey = () => heroProfileMaterialShaderKey;
}
