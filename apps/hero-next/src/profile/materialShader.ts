import type { WebGLEffectMaterialShaderDefinition } from "@viselora/dom-webgl";

export const heroProfileMaterialShaderKey = "hero.profile.material";

const opaqueChunk = "#include <opaque_fragment>";
const normalMapChunk = "#include <normal_fragment_maps>";

export const heroProfileMaterialShader = {
  key: heroProfileMaterialShaderKey,
  compile(draft) {
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
  },
} satisfies WebGLEffectMaterialShaderDefinition;
