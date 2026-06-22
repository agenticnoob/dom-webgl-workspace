import type {
  WebGLEffectDeclaration,
  WebGLEffectsDeclaration,
} from "../types";

export function compileWebGLEffectDeclarations(
  declaration: WebGLEffectsDeclaration | undefined,
): WebGLEffectDeclaration[] {
  if (!declaration) {
    return [];
  }

  if (!Array.isArray(declaration)) {
    throw new Error(
      "WebGL effects must be declared as an array of effect entries.",
    );
  }

  return [...declaration];
}
