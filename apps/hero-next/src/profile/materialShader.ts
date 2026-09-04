import type { WebGLEffectMaterialShaderDefinition } from "@viselora/dom-webgl";

export const heroProfileMaterialShaderKey = "hero.profile.material";

const opaqueChunk = "#include <opaque_fragment>";

export const heroProfileMaterialShader = {
  key: heroProfileMaterialShaderKey,
  compile(draft) {
    if (!draft.fragmentShader.includes(opaqueChunk)) {
      throw new Error(
        "Hero profile material shader could not find the Three opaque fragment chunk.",
      );
    }

    draft.fragmentShader = draft.fragmentShader.replace(
      opaqueChunk,
      `outgoingLight = diffuseColor.rgb * 0.92;\n${opaqueChunk}`,
    );
  },
} satisfies WebGLEffectMaterialShaderDefinition;
