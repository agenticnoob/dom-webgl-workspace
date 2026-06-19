import type { WebGLEffectPlugin, WebGLEffectSourceKind } from "./effectPlugin";

export function assertEffectCompatibility(
  key: string,
  effectKind: string,
  plugin: WebGLEffectPlugin,
  sourceKind: WebGLEffectSourceKind,
): void {
  if (plugin.appliesTo.includes(sourceKind)) {
    return;
  }

  throw new Error(
    `WebGL effect "${effectKind}" cannot be used with source "${sourceKind}" on target "${key}".`,
  );
}
