import type { WebGLEffectPlugin } from "./effectPlugin";

export type WebGLEffectRegistry = {
  register(plugin: WebGLEffectPlugin): void;
  resolve(kind: string): WebGLEffectPlugin | undefined;
  list(): readonly WebGLEffectPlugin[];
};

export function createWebGLEffectRegistry(
  plugins: readonly WebGLEffectPlugin[] = [],
): WebGLEffectRegistry {
  const byKind = new Map<string, WebGLEffectPlugin>();

  const registry: WebGLEffectRegistry = {
    register(plugin): void {
      if (byKind.has(plugin.kind)) {
        throw new Error(
          `WebGL effect plugin "${plugin.kind}" is already registered.`,
        );
      }

      byKind.set(plugin.kind, plugin);
    },
    resolve(kind): WebGLEffectPlugin | undefined {
      return byKind.get(kind);
    },
    list(): readonly WebGLEffectPlugin[] {
      return [...byKind.values()];
    },
  };

  for (const plugin of plugins) {
    registry.register(plugin);
  }

  return registry;
}
