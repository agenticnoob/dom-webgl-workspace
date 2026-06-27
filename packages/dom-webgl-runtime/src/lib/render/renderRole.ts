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
    case "dom":
      return sourceDescriptor.type === "text" ? "content" : "surface";
    case "media":
      return "media";
    case "model":
      return "model";
  }
}
