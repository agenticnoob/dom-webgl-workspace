import type {
  WebGLFrameInput,
  WebGLProgressSignalSource,
} from "../types";
import type {
  WebGLEffectResourceScope,
  WebGLEffectScopeSnapshot,
  WebGLEffectVisualContext,
  WebGLSceneObjectEffectContext,
  WebGLSceneObjectEffectSourceKind,
  WebGLSceneObjectPointerState,
} from "./effectAuthoring";
import type { WebGLEffectObjectHandle } from "./effectObject";
import {
  completeEffectScopes,
  createResourceManagedVisualContext,
} from "./effectContext";

export type WebGLSceneObjectEffectContextOptions = {
  readonly objectId: string;
  readonly sourceKind: WebGLSceneObjectEffectSourceKind;
  readonly input: WebGLFrameInput;
  readonly object: WebGLEffectObjectHandle;
  readonly objectPointer?: WebGLSceneObjectPointerState;
  readonly resources: WebGLEffectResourceScope;
  readonly progressSignals?: WebGLProgressSignalSource;
  readonly scopes: WebGLEffectScopeSnapshot;
  readonly visual?: WebGLEffectVisualContext;
};

export const inactiveSceneObjectPointerState: WebGLSceneObjectPointerState = {
  isHovered: false,
  isPressed: false,
  isDragging: false,
  wasClicked: false,
  dragStartX: 0,
  dragStartY: 0,
  dragDeltaX: 0,
  dragDeltaY: 0,
};

const emptyProgressSignals: WebGLProgressSignalSource = {
  get() {
    return 0;
  },
};

export function createWebGLSceneObjectEffectContext(
  options: WebGLSceneObjectEffectContextOptions,
): WebGLSceneObjectEffectContext {
  const visual = createResourceManagedVisualContext(
    options.visual,
    options.resources,
  );
  const scopes = completeEffectScopes(options.scopes, visual);

  if (!scopes.scene) {
    throw new Error(
      `WebGL scene-object effect "${options.objectId}" requires scene scope.`,
    );
  }

  return {
    objectId: options.objectId,
    sourceKind: options.sourceKind,
    input: options.input,
    pointer: options.input.pointer,
    objectPointer: options.objectPointer ?? inactiveSceneObjectPointerState,
    progress:
      options.progressSignals ?? options.scopes.runtime.progress ?? emptyProgressSignals,
    runtime: scopes.runtime,
    scene: scopes.scene,
    time: options.input.time,
    delta: options.input.delta,
    object: options.object,
    resources: options.resources,
  };
}
