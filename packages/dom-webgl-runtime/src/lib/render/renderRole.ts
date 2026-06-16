import type { WebGLDeclaration, WebGLRenderRole } from "../types";
import type { WebGLSourceDescriptor } from "../source/sourceDescriptor";

export function inferRenderRole(
  sourceDescriptor: WebGLSourceDescriptor,
  declaration: WebGLDeclaration,
): WebGLRenderRole {
  if (declaration.renderRole) {
    return declaration.renderRole;
  }

  switch (sourceDescriptor.kind) {
    case "snapshot":
      return sourceDescriptor.mode === "text" ? "content" : "surface";
    case "image":
    case "video":
      return "media";
    case "model":
      return "model";
  }
}
