import type { WebGLEffectDefinition } from "./effectAuthoring";

export type WebGLEffectRegistry = {
  resolve(kind: string): WebGLEffectDefinition | undefined;
  list(): readonly WebGLEffectDefinition[];
};

export function createWebGLEffectRegistry(
  effects: readonly WebGLEffectDefinition[] = [],
): WebGLEffectRegistry {
  const byKind = new Map<string, WebGLEffectDefinition>();

  for (const effect of effects) {
    if (byKind.has(effect.kind)) {
      throw new Error(`WebGL effect "${effect.kind}" is already registered.`);
    }

    byKind.set(effect.kind, effect);
  }

  return {
    resolve(kind) {
      return byKind.get(kind);
    },
    list() {
      return [...byKind.values()];
    },
  };
}
