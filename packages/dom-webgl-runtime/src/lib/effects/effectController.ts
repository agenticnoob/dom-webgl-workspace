import type { ElementLayoutSnapshot } from "../renderer/layoutPass";
import type { WebGLSourceDescriptor } from "../source/sourceDescriptor";
import type {
  WebGLEffectsDeclaration,
  WebGLFrameInput,
  WebGLProgressSignalSource,
} from "../types";
import type {
  WebGLEffectContext,
  WebGLEffectDefinition,
  WebGLEffectSourceHandle,
  WebGLEffectSourceKind,
} from "./effectAuthoring";
import { createWebGLEffectContext, readScrollProgress } from "./effectContext";
import { compileWebGLEffectDeclarations } from "./effectDeclaration";
import { assertEffectCompatibility } from "./effectCompatibility";
import {
  createWebGLEffectRegistry,
  type WebGLEffectRegistry,
} from "./effectRegistry";
import { createWebGLEffectResourceScope } from "./effectResources";
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
  getSource?(): WebGLEffectSourceHandle | undefined;
  getTarget?(): WebGLEffectTarget | undefined;
  registry?: WebGLEffectRegistry;
  progressSignals?: WebGLProgressSignalSource;
};

type RunningEffect = {
  definition: WebGLEffectDefinition;
  params: ReturnType<typeof compileWebGLEffectDeclarations>[number];
  resources: ReturnType<typeof createWebGLEffectResourceScope>;
  state: unknown;
  initialized: boolean;
  reusableContext: WebGLEffectContext | null;
};

export function createWebGLEffectController(
  options: WebGLEffectControllerOptions,
): WebGLEffectController {
  const registry = options.registry ?? createWebGLEffectRegistry();
  const sourceKind = readEffectSourceKind(options.source);
  const effects = compileWebGLEffectDeclarations(options.declaration).map(
    (declaration): RunningEffect => {
      const definition = registry.resolve(declaration.kind);

      if (!definition) {
        throw new Error(
          `WebGL target "${options.key}" references unknown effect "${declaration.kind}". Register it through createWebGLRuntime({ effects: [...] }).`,
        );
      }

      assertEffectCompatibility(
        options.key,
        declaration.kind,
        definition,
        sourceKind,
      );

      return {
        definition,
        params: declaration,
        resources: createWebGLEffectResourceScope(),
        state: undefined,
        initialized: false,
        reusableContext: null,
      };
    },
  );
  let disposed = false;

  return {
    get hasEffects() {
      return effects.length > 0;
    },
    update(input, layout): void {
      if (disposed) {
        return;
      }

      const source = readEffectSource(options);
      if (!source) {
        return;
      }

      const target = readEffectTarget(options);

      for (const effect of effects) {
        let context: WebGLEffectContext;

        if (effect.reusableContext) {
          context = effect.reusableContext;
          context.layout = layout;
          context.input = input;
          context.pointer = input.pointer;
          context.scroll = input.scroll;
          context.scrollProgress = readScrollProgress(input.scroll);
          context.time = input.time;
          context.delta = input.delta;
          context.source = source;
          context.target = target ?? undefined;
        } else {
          context = createWebGLEffectContext({
            key: options.key,
            sourceKind,
            input,
            layout,
            source,
            target,
            resources: effect.resources,
            progressSignals: options.progressSignals,
          });
          effect.reusableContext = context;
        }

        updateRunningEffect(effect, context);
      }
    },
    dispose(): void {
      if (disposed) {
        return;
      }

      disposed = true;
      for (const effect of effects) {
        disposeRunningEffect(effect);
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

function readEffectSource(
  options: WebGLEffectControllerOptions,
): WebGLEffectSourceHandle | undefined {
  return options.getSource?.() ?? createStaticEffectSource(options.source);
}

function createStaticEffectSource(
  source: WebGLSourceDescriptor,
): WebGLEffectSourceHandle | undefined {
  if (source.kind === "snapshot") {
    if (source.mode === "text") {
      return {
        kind: "snapshot/text",
        element: source.element,
        text: source.element.textContent ?? "",
      };
    }

    return { kind: "snapshot/element", element: source.element };
  }

  if (source.kind === "image") {
    return { kind: "image", element: source.element, src: source.src };
  }

  if (source.kind === "video") {
    return { kind: "video", element: source.element, src: source.src };
  }

  return undefined;
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

function updateRunningEffect(
  effect: RunningEffect,
  context: WebGLEffectContext,
): void {
  if (!effect.initialized) {
    effect.state = effect.definition.setup?.(context, effect.params);
    effect.initialized = true;
  }

  effect.definition.update(context, effect.state, effect.params);
}

function disposeRunningEffect(effect: RunningEffect): void {
  if (effect.initialized && effect.reusableContext) {
    effect.definition.dispose?.(
      effect.reusableContext,
      effect.state,
      effect.params,
    );
  }

  effect.resources.dispose();
}
