import type { NormalizedWebGLMaterialDeclaration } from "./effectNormalization";
import type { WebGLSourceDescriptor } from "../source/sourceDescriptor";

export function assertMaterialSourceCompatibility(
  key: string,
  material: NormalizedWebGLMaterialDeclaration,
  source: WebGLSourceDescriptor,
): void {
  if (source.kind === "snapshot" && source.mode === "element") {
    return;
  }

  throw new Error(
    `WebGL target "${key}" uses ${material.kind} material on unsupported source "${readSourceKind(
      source,
    )}". ${readMaterialLabel(material.kind)} material effects support only snapshot/element targets.`,
  );
}

function readMaterialLabel(kind: NormalizedWebGLMaterialDeclaration["kind"]) {
  return kind === "solid" ? "Solid" : "Surface";
}

function readSourceKind(source: WebGLSourceDescriptor): string {
  if (source.kind === "snapshot") {
    return `snapshot/${source.mode}`;
  }

  if (source.kind === "model") {
    return `model/${source.format}`;
  }

  return source.kind;
}
