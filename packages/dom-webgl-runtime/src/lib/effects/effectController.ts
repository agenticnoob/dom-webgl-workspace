import type { ElementLayoutSnapshot } from "../renderer/layoutPass";
import type { WebGLSourceDescriptor } from "../source/sourceDescriptor";
import type { WebGLEffectsDeclaration, WebGLFrameInput } from "../types";
import { builtInWebGLEffectPlugins } from "./builtins";
import { compileWebGLEffectDeclarations } from "./effectDeclaration";
import { assertEffectCompatibility } from "./effectCompatibility";
import type { WebGLEffectInstance, WebGLEffectSourceKind } from "./effectPlugin";
import {
  createWebGLEffectRegistry,
  type WebGLEffectRegistry,
} from "./effectRegistry";
import type { WebGLEffectTarget } from "./effectTarget";

export type WebGLEffectController = {
  readonly hasEffects: boolean;
  update(input: WebGLFrameInput, layout: ElementLayoutSnapshot): void;
  dispose(): void;
};

export type WebGLEffectControllerOptions = {
  key: string;
  declaration?: WebGLEffectsDeclaration;
  source: WebGLSourceDescriptor;
  target?: WebGLEffectTarget;
  getTarget?(): WebGLEffectTarget | undefined;
  registry?: WebGLEffectRegistry;
};

export function createWebGLEffectController(
  options: WebGLEffectControllerOptions,
): WebGLEffectController {
  const registry =
    options.registry ?? createWebGLEffectRegistry(builtInWebGLEffectPlugins);
  const sourceKind = readEffectSourceKind(options.source);
  const instances = compileWebGLEffectDeclarations(options.declaration).map(
    (declaration): WebGLEffectInstance => {
      const plugin = registry.resolve(declaration.kind);

      if (!plugin) {
        throw new Error(
          `WebGL target "${options.key}" references unknown effect "${declaration.kind}".`,
        );
      }

      assertEffectCompatibility(
        options.key,
        declaration.kind,
        plugin,
        sourceKind,
      );

      return plugin.create(plugin.normalize(declaration));
    },
  );
  let disposed = false;

  return {
    get hasEffects() {
      return instances.length > 0;
    },
    update(input, layout): void {
      if (disposed) {
        return;
      }

      const target = readEffectTarget(options);

      for (const instance of instances) {
        instance.update({
          key: options.key,
          sourceKind,
          input,
          layout,
          target,
        });
      }
    },
    dispose(): void {
      if (disposed) {
        return;
      }

      disposed = true;
      for (const instance of instances) {
        instance.dispose?.();
      }
      readEffectTarget(options)?.disposeEffects?.();
    },
  };
}

function readEffectTarget(
  options: WebGLEffectControllerOptions,
): WebGLEffectTarget | undefined {
  return options.getTarget?.() ?? options.target;
}

function readEffectSourceKind(
  source: WebGLSourceDescriptor,
): WebGLEffectSourceKind {
  if (source.kind === "snapshot") {
    return source.mode === "text" ? "snapshot/text" : "snapshot/element";
  }

  if (source.kind === "model") {
    return "model/glb";
  }

  return source.kind;
}
