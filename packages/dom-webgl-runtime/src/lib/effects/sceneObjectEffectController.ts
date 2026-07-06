import type {
  WebGLEffectsDeclaration,
  WebGLFrameInput,
  WebGLProgressSignalSource,
} from "../types";
import type {
  WebGLEffectResourceScope,
  WebGLEffectSchedule,
  WebGLEffectScopeSnapshot,
  WebGLEffectVisualContext,
  WebGLSceneObjectEffectContext,
  WebGLSceneObjectEffectDefinition,
  WebGLSceneObjectEffectSourceKind,
  WebGLSceneObjectPointerState,
} from "./effectAuthoring";
import type { WebGLEffectObjectHandle } from "./effectObject";
import { compileWebGLEffectDeclarations } from "./effectDeclaration";
import {
  createWebGLEffectRegistry,
  type WebGLEffectRegistry,
} from "./effectRegistry";
import { createWebGLEffectResourceScope } from "./effectResources";
import {
  createWebGLSceneObjectEffectContext,
  inactiveSceneObjectPointerState,
} from "./sceneObjectEffectContext";

export type WebGLSceneObjectEffectController = {
  readonly hasEffects: boolean;
  readonly schedulingMode: WebGLEffectSchedule;
  update(input: WebGLFrameInput): void;
  dispose(): void;
};

export type WebGLSceneObjectEffectControllerOptions = {
  readonly objectId: string;
  readonly sourceKind: WebGLSceneObjectEffectSourceKind;
  readonly declaration?: WebGLEffectsDeclaration;
  getObject(): WebGLEffectObjectHandle | undefined;
  getObjectPointerState?(): WebGLSceneObjectPointerState | undefined;
  readonly registry?: WebGLEffectRegistry;
  readonly progressSignals?: WebGLProgressSignalSource;
  readScopes(): WebGLEffectScopeSnapshot;
  readonly visual?: WebGLEffectVisualContext;
};

type RunningSceneObjectEffect = {
  readonly definition: WebGLSceneObjectEffectDefinition;
  readonly params: ReturnType<typeof compileWebGLEffectDeclarations>[number];
  readonly resources: WebGLEffectResourceScope;
  state: unknown;
  initialized: boolean;
};

export function createWebGLSceneObjectEffectController(
  options: WebGLSceneObjectEffectControllerOptions,
): WebGLSceneObjectEffectController {
  const registry = options.registry ?? createWebGLEffectRegistry();
  const effects = compileWebGLEffectDeclarations(options.declaration).map(
    (declaration): RunningSceneObjectEffect => {
      const definition = registry.resolveSceneObject(declaration.kind);

      if (!definition) {
        throw new Error(
          `WebGL scene object "${options.objectId}" references unknown effect "${declaration.kind}". Register it through createWebGLRuntime({ effects: [...] }).`,
        );
      }

      assertSceneObjectEffectCompatibility(
        options.objectId,
        declaration.kind,
        definition,
        options.sourceKind,
      );

      return {
        definition,
        params: declaration,
        resources: createWebGLEffectResourceScope(),
        state: undefined,
        initialized: false,
      };
    },
  );
  const schedulingMode = readSchedulingMode(effects);
  let disposed = false;

  return {
    get hasEffects() {
      return effects.length > 0;
    },
    get schedulingMode() {
      return schedulingMode;
    },
    update(input): void {
      if (disposed) {
        return;
      }

      const object = options.getObject();
      if (!object) {
        return;
      }

      for (const effect of effects) {
        const context = createContext(options, effect, input, object);
        updateRunningSceneObjectEffect(effect, context);
      }
    },
    dispose(): void {
      if (disposed) {
        return;
      }

      disposed = true;
      for (const effect of effects) {
        const object = options.getObject();
        const context = object
          ? createContext(options, effect, createDisposedFrameInput(), object)
          : undefined;
        if (effect.initialized && context) {
          effect.definition.dispose?.(context, effect.state, effect.params);
        }
        effect.resources.dispose();
      }
    },
  };
}

function createContext(
  options: WebGLSceneObjectEffectControllerOptions,
  effect: RunningSceneObjectEffect,
  input: WebGLFrameInput,
  object: WebGLEffectObjectHandle,
): WebGLSceneObjectEffectContext {
  return createWebGLSceneObjectEffectContext({
    objectId: options.objectId,
    sourceKind: options.sourceKind,
    input,
    object,
    objectPointer:
      options.getObjectPointerState?.() ?? inactiveSceneObjectPointerState,
    resources: effect.resources,
    progressSignals: options.progressSignals,
    scopes: options.readScopes(),
    visual: options.visual,
  });
}

function updateRunningSceneObjectEffect(
  effect: RunningSceneObjectEffect,
  context: WebGLSceneObjectEffectContext,
): void {
  if (!effect.initialized) {
    effect.state = effect.definition.setup?.(context, effect.params);
    effect.initialized = true;
  }

  effect.definition.update(context, effect.state, effect.params);
}

function assertSceneObjectEffectCompatibility(
  objectId: string,
  kind: string,
  definition: WebGLSceneObjectEffectDefinition,
  sourceKind: WebGLSceneObjectEffectSourceKind,
): void {
  const compatibleSources = definition.source;
  if (!compatibleSources) {
    return;
  }

  const compatible = Array.isArray(compatibleSources)
    ? compatibleSources.includes(sourceKind)
    : compatibleSources === sourceKind;

  if (compatible) {
    return;
  }

  throw new Error(
    `WebGL scene-object effect "${kind}" cannot be used with source "${sourceKind}" on object "${objectId}".`,
  );
}

function readSchedulingMode(
  effects: readonly RunningSceneObjectEffect[],
): WebGLEffectSchedule {
  let mode: WebGLEffectSchedule = "static";

  for (const effect of effects) {
    const schedule = effect.definition.schedule ?? "frame";
    if (schedule === "frame") {
      return "frame";
    }
    if (schedule === "reactive") {
      mode = "reactive";
    }
  }

  return mode;
}

function createDisposedFrameInput(): WebGLFrameInput {
  return {
    time: 0,
    delta: 0,
    scroll: {
      mode: "page",
      pageProgress: 0,
      direction: 0,
      velocity: 0,
    },
    pointer: {
      x: 0,
      y: 0,
      normalizedX: 0,
      normalizedY: 0,
      isInside: false,
      isDown: false,
      downTime: 0,
      pressDuration: 0,
      isDragging: false,
      dragStartX: 0,
      dragStartY: 0,
      dragDeltaX: 0,
      dragDeltaY: 0,
      clickCount: 0,
      buttons: [],
      modifiers: { shift: false, alt: false, ctrl: false, meta: false },
    },
  };
}
