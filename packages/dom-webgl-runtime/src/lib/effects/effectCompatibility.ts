import type { WebGLEffectDefinition, WebGLEffectSourceKind } from "./effectAuthoring";

export function assertEffectCompatibility(
  key: string,
  effectKind: string,
  definition: WebGLEffectDefinition,
  sourceKind: WebGLEffectSourceKind,
): void {
  if (!definition.source) {
    return;
  }

  const allowedSources = Array.isArray(definition.source)
    ? definition.source
    : [definition.source];

  if (allowedSources.includes(sourceKind)) {
    return;
  }

  throw new Error(
    `WebGL effect "${effectKind}" cannot be used with source "${sourceKind}" on target "${key}".`,
  );
}
