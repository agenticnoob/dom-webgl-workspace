import {
  isWebGLSceneObjectEffectDefinition,
  type WebGLEffectDefinition,
  type WebGLSceneObjectEffectDefinition,
} from "./effectAuthoring";

export type WebGLEffectRegistryDefinition =
  | WebGLEffectDefinition
  | WebGLSceneObjectEffectDefinition;

export type WebGLEffectRegistry = {
  resolve(kind: string): WebGLEffectRegistryDefinition | undefined;
  resolveTarget(kind: string): WebGLEffectDefinition | undefined;
  resolveSceneObject(kind: string): WebGLSceneObjectEffectDefinition | undefined;
  list(): readonly WebGLEffectRegistryDefinition[];
};

type WebGLEffectRegistryEntry =
  | {
      readonly definition: WebGLEffectDefinition;
      readonly scope: "target";
    }
  | {
      readonly definition: WebGLSceneObjectEffectDefinition;
      readonly scope: "scene-object";
    };

export function createWebGLEffectRegistry(
  effects: readonly WebGLEffectRegistryDefinition[] = [],
): WebGLEffectRegistry {
  const byKind = new Map<string, WebGLEffectRegistryEntry>();

  for (const effect of effects) {
    if (byKind.has(effect.kind)) {
      throw new Error(`WebGL effect "${effect.kind}" is already registered.`);
    }

    byKind.set(
      effect.kind,
      isWebGLSceneObjectEffectDefinition(effect)
        ? { definition: effect, scope: "scene-object" }
        : { definition: effect, scope: "target" },
    );
  }

  return {
    resolve(kind) {
      return byKind.get(kind)?.definition;
    },
    resolveTarget(kind) {
      const entry = byKind.get(kind);
      if (!entry) {
        return undefined;
      }
      if (entry.scope !== "target") {
        throw new Error(`Effect "${kind}" is not a target effect.`);
      }

      return entry.definition;
    },
    resolveSceneObject(kind) {
      const entry = byKind.get(kind);
      if (!entry) {
        return undefined;
      }
      if (entry.scope !== "scene-object") {
        throw new Error(`Effect "${kind}" is not a scene-object effect.`);
      }

      return entry.definition;
    },
    list() {
      return [...byKind.values()].map((entry) => entry.definition);
    },
  };
}
