import { createTargetPointerState } from "../input/targetPointer";
import type { ElementLayoutSnapshot } from "../renderer/layoutPass";
import type { RenderDirtyReason } from "../renderer/rendererLoop";
import type { WebGLSourceDescriptor } from "../source/sourceDescriptor";
import type {
  WebGLEffectsDeclaration,
  WebGLFrameInput,
  WebGLProgressSignalSource,
} from "../types";
import type {
  WebGLEffectContext,
  WebGLEffectDefinition,
  WebGLEffectResourceScope,
  WebGLEffectScopeSnapshot,
  WebGLEffectSchedule,
  WebGLEffectSourceHandle,
  WebGLEffectSourceKind,
  WebGLEffectVisualContext,
} from "./effectAuthoring";
import type { WebGLEffectObjectHandle } from "./effectObject";
import {
  completeEffectScopes,
  createResourceManagedVisualContext,
  createWebGLEffectContext,
  readScrollProgress,
} from "./effectContext";
import { createWebGLEffectObject } from "./effectObjectContext";
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
  readonly schedulingMode: WebGLEffectSchedule;
  needsUpdate(
    input: WebGLFrameInput,
    dirtyReasons: readonly RenderDirtyReason[],
  ): boolean;
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
  readScopes?(): WebGLEffectScopeSnapshot;
  visual?: WebGLEffectVisualContext;
  createLights?: WebGLEffectLightsFactory;
};

export type WebGLEffectLightsFactory = (options: {
  target?: WebGLEffectTarget;
  resources: WebGLEffectResourceScope;
  readObjectPosition(): { x: number; y: number; z: number };
}) => WebGLEffectObjectHandle["lights"];

type RunningEffect = {
  definition: WebGLEffectDefinition;
  params: ReturnType<typeof compileWebGLEffectDeclarations>[number];
  resources: ReturnType<typeof createWebGLEffectResourceScope>;
  visual: WebGLEffectVisualContext;
  lights?: WebGLEffectObjectHandle["lights"];
  lightsTarget?: WebGLEffectTarget;
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
      const definition = registry.resolveTarget(declaration.kind);

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

      const resources = createWebGLEffectResourceScope();
      return {
        definition,
        params: declaration,
        resources,
        visual: createResourceManagedVisualContext(
          options.visual,
          resources,
        ),
        state: undefined,
        initialized: false,
        reusableContext: null,
      };
    },
  );
  let disposed = false;
  const schedulingMode = readSchedulingMode(effects);

  return {
    get hasEffects() {
      return effects.length > 0;
    },
    get schedulingMode() {
      return schedulingMode;
    },
    needsUpdate(input, dirtyReasons): boolean {
      if (disposed || effects.length === 0) {
        return false;
      }

      if (effects.some((effect) => !effect.initialized)) {
        return true;
      }

      switch (schedulingMode) {
        case "frame":
          return true;
        case "reactive":
          return (
            hasReactiveDirtyReason(dirtyReasons) || input.scroll.mode === "gate"
          );
        case "static":
          return hasStaticDirtyReason(dirtyReasons);
      }
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
        const lights = readEffectLights(effect, target, options);
        const scopes = completeEffectScopes(
          readEffectScopes(options),
          effect.visual,
        );

        if (effect.reusableContext) {
          context = effect.reusableContext;
          context.layout = layout;
          context.input = input;
          context.pointer = input.pointer;
          context.targetPointer = createTargetPointerState(input, layout);
          context.scroll = input.scroll;
          context.scrollProgress = readScrollProgress(input.scroll);
          context.runtime = scopes.runtime;
          context.scene = scopes.scene;
          context.time = input.time;
          context.delta = input.delta;
          context.object = createWebGLEffectObject({
            sourceKind,
            source,
            target,
            lights,
          });
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
            scopes,
            managedVisual: effect.visual,
            lights,
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

function readEffectLights(
  effect: RunningEffect,
  target: WebGLEffectTarget | undefined,
  options: WebGLEffectControllerOptions,
): WebGLEffectObjectHandle["lights"] {
  if (!options.createLights) {
    return undefined;
  }

  if (effect.lights && effect.lightsTarget === target) {
    return effect.lights;
  }

  if (!target) {
    return undefined;
  }

  effect.lightsTarget = target;
  effect.lights = options.createLights({
    target,
    resources: effect.resources,
    readObjectPosition() {
      return effect.reusableContext?.object.position ?? zeroObjectPosition;
    },
  });
  return effect.lights;
}

function readEffectScopes(
  options: WebGLEffectControllerOptions,
): WebGLEffectScopeSnapshot {
  const scopes = options.readScopes?.();
  if (scopes) {
    return scopes;
  }

  return {
    runtime: {
      progress: options.progressSignals ?? emptyProgressSignals,
    },
  };
}

const emptyProgressSignals: WebGLProgressSignalSource = {
  get() {
    return 0;
  },
};

const zeroObjectPosition = { x: 0, y: 0, z: 0 };

function readSchedulingMode(
  effects: readonly RunningEffect[],
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

function hasReactiveDirtyReason(
  dirtyReasons: readonly RenderDirtyReason[],
): boolean {
  return dirtyReasons.some((reason) => {
    switch (reason) {
      case "initial":
      case "target-register":
      case "target-unregister":
      case "dom-invalidation":
      case "resource-ready":
      case "manual-sync":
      case "layout":
      case "pointer":
      case "scroll":
        return true;
    }
  });
}

function hasStaticDirtyReason(
  dirtyReasons: readonly RenderDirtyReason[],
): boolean {
  return dirtyReasons.some((reason) => {
    switch (reason) {
      case "target-register":
      case "target-unregister":
      case "dom-invalidation":
      case "resource-ready":
      case "manual-sync":
      case "layout":
        return true;
      case "initial":
      case "pointer":
      case "scroll":
        return false;
    }
  });
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
  if (source.kind === "dom") {
    if (source.type === "text") {
      return {
        kind: "dom",
        type: "text",
        element: source.element,
        text: source.element.textContent ?? "",
      };
    }

    return { kind: "dom", type: "element", element: source.element };
  }

  if (source.kind === "media") {
    if (source.type === "image") {
      return {
        kind: "media",
        type: "image",
        element: source.anchor,
        src: source.src,
      };
    }

    if (source.type === "video") {
      return {
        kind: "media",
        type: "video",
        element: source.anchor,
        src: source.src,
      };
    }

    return {
      kind: "media",
      type: "image-sequence",
      element: source.anchor,
      frame: source.startFrame,
      src: "",
    };
  }

  return undefined;
}

function readEffectSourceKind(
  source: WebGLSourceDescriptor,
): WebGLEffectSourceKind {
  return `${source.kind}/${source.type}` as WebGLEffectSourceKind;
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
