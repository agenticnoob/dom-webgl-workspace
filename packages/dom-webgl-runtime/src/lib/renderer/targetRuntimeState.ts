import type { DebugTargetState } from "../debug/debugState";
import type { FallbackVisibilityController } from "../dom/fallbackVisibility";
import type { TargetDescriptor } from "../dom/targetDescriptor";
import type { WebGLEffectController } from "../effects/effectController";
import type { WebGLEffectTarget } from "../effects/effectTarget";
import {
  isRenderableVisuallyReady,
  type Renderable,
} from "../render/renderable";

export type DisposableRenderable = {
  dispose(): void;
};

export type TargetDebugRecord = Omit<DebugTargetState, "key">;

export type TargetRuntimeState = {
  renderables: Set<DisposableRenderable>;
  retiredRenderables: WeakSet<Renderable>;
  renderablesByTargetKey: Map<string, Renderable>;
  parkedAtByTargetKey: Map<string, number>;
  parkedVisibilityByTargetKey: Map<string, boolean>;
  effectVisibilityByTargetKey: Map<string, boolean>;
  lifecycleVersionByTargetKey: Map<string, number>;
  effectControllersByTargetKey: Map<string, WebGLEffectController>;
  debugRecordsByTargetKey: Map<string, TargetDebugRecord>;
  fallbackControllersByTargetKey: Map<string, FallbackVisibilityController>;
};

export function createTargetRuntimeState(
  initialRenderables: Iterable<DisposableRenderable> = [],
): TargetRuntimeState {
  return {
    renderables: new Set<DisposableRenderable>(initialRenderables),
    retiredRenderables: new WeakSet<Renderable>(),
    renderablesByTargetKey: new Map<string, Renderable>(),
    parkedAtByTargetKey: new Map<string, number>(),
    parkedVisibilityByTargetKey: new Map<string, boolean>(),
    effectVisibilityByTargetKey: new Map<string, boolean>(),
    lifecycleVersionByTargetKey: new Map<string, number>(),
    effectControllersByTargetKey: new Map<string, WebGLEffectController>(),
    debugRecordsByTargetKey: new Map<string, TargetDebugRecord>(),
    fallbackControllersByTargetKey: new Map<string, FallbackVisibilityController>(),
  };
}

export function disposeTargetRuntimeState(state: TargetRuntimeState): void {
  try {
    for (const renderable of state.renderablesByTargetKey.values()) {
      state.retiredRenderables.add(renderable);
    }

    for (const renderable of state.renderables) {
      renderable.dispose();
    }
  } finally {
    for (const effectController of state.effectControllersByTargetKey.values()) {
      effectController.dispose();
    }
    state.effectControllersByTargetKey.clear();
    state.renderablesByTargetKey.clear();
    state.parkedAtByTargetKey.clear();
    state.parkedVisibilityByTargetKey.clear();
    state.effectVisibilityByTargetKey.clear();
    state.lifecycleVersionByTargetKey.clear();
    state.renderables.clear();
    state.debugRecordsByTargetKey.clear();
    restoreAllFallbackVisibility(state);
    state.fallbackControllersByTargetKey.clear();
  }
}

export function disposeTargetRenderable(
  state: TargetRuntimeState,
  key: string,
): void {
  const renderable = state.renderablesByTargetKey.get(key);
  const effectController = state.effectControllersByTargetKey.get(key);

  state.parkedAtByTargetKey.delete(key);
  state.parkedVisibilityByTargetKey.delete(key);
  state.lifecycleVersionByTargetKey.delete(key);
  effectController?.dispose();
  state.effectControllersByTargetKey.delete(key);
  state.effectVisibilityByTargetKey.delete(key);

  if (!renderable) {
    state.debugRecordsByTargetKey.delete(key);
    return;
  }

  state.renderablesByTargetKey.delete(key);
  state.renderables.delete(renderable);
  state.debugRecordsByTargetKey.delete(key);
  state.retiredRenderables.add(renderable);
  renderable.dispose();
}

export function syncFallbackVisibility(
  state: TargetRuntimeState,
  descriptor: TargetDescriptor,
  renderable: Renderable,
): void {
  const controller = state.fallbackControllersByTargetKey.get(descriptor.key);

  if (!controller) {
    return;
  }

  if (isRenderableVisuallyReady(renderable)) {
    controller.hide();
    return;
  }

  controller.restore();
}

export function restoreFallbackVisibility(
  state: TargetRuntimeState,
  key: string,
): void {
  const controller = state.fallbackControllersByTargetKey.get(key);

  if (!controller) {
    return;
  }

  controller.restore();
}

export function restoreAllFallbackVisibility(state: TargetRuntimeState): void {
  for (const controller of state.fallbackControllersByTargetKey.values()) {
    controller.restore();
  }
}

export function disposeOffscreenRenderable(
  state: TargetRuntimeState,
  input: {
    key: string;
    renderable: Renderable | undefined;
    restoreFallback: boolean;
  },
): void {
  if (input.restoreFallback) {
    restoreFallbackVisibility(state, input.key);
  }

  disposeTrackedEffectController(state, input.key);

  if (input.renderable) {
    state.retiredRenderables.add(input.renderable);
    input.renderable.dispose();
    state.renderables.delete(input.renderable);
  }

  state.renderablesByTargetKey.delete(input.key);
  state.parkedAtByTargetKey.delete(input.key);
  state.parkedVisibilityByTargetKey.delete(input.key);
  state.lifecycleVersionByTargetKey.delete(input.key);
}

export function createTrackedEffectTarget(
  state: TargetRuntimeState,
  key: string,
  target: WebGLEffectTarget,
): WebGLEffectTarget {
  const addObject3D = target.addObject3D;

  return {
    setVisible(visible) {
      state.effectVisibilityByTargetKey.set(key, visible);
      target.setVisible(visible);
    },
    setPosition(x, y, z) {
      target.setPosition(x, y, z);
    },
    setRotation(x, y, z) {
      target.setRotation(x, y, z);
    },
    setScale(x, y, z) {
      target.setScale(x, y, z);
    },
    setOpacity(opacity) {
      target.setOpacity(opacity);
    },
    addObject3D: addObject3D
      ? (object3D, options) => addObject3D(object3D, options)
      : undefined,
    disposeEffects: target.disposeEffects ? () => target.disposeEffects?.() : undefined,
  };
}

export function disposeTrackedEffectController(
  state: TargetRuntimeState,
  key: string,
): void {
  state.effectControllersByTargetKey.get(key)?.dispose();
  state.effectControllersByTargetKey.delete(key);
  state.effectVisibilityByTargetKey.delete(key);
}

export function readLifecycleVersion(
  state: TargetRuntimeState,
  key: string,
): number {
  return state.lifecycleVersionByTargetKey.get(key) ?? 0;
}

export function bumpLifecycleVersion(
  state: TargetRuntimeState,
  key: string,
): void {
  state.lifecycleVersionByTargetKey.set(
    key,
    readLifecycleVersion(state, key) + 1,
  );
}

export function readRenderableVisibilityForPark(
  state: TargetRuntimeState,
  key: string,
  renderable: Renderable,
): boolean {
  return (
    state.effectVisibilityByTargetKey.get(key) ??
    renderable.sceneObjectController?.visible ??
    true
  );
}
