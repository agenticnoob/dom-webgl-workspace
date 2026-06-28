import type {
  WebGLDebugState,
  WebGLPointerState,
  WebGLRenderRole,
  WebGLResourceStatus,
  WebGLLifecycleState,
} from "../types";

export type DebugTargetState = {
  key: string;
  sourceKind: string;
  renderRole: WebGLRenderRole;
  resourceStatus: WebGLResourceStatus;
  lifecycleState: WebGLLifecycleState;
  visible: boolean;
  parentKey?: string;
  layerDepth?: number;
  siblingIndex?: number;
  computedRenderOrder?: number;
  error?: unknown;
};

export type DebugRuntimeState = {
  targetCount: number;
  renderableCount: number;
  currentScrollMode: WebGLDebugState["currentScrollMode"];
  activeGateKey?: string;
  sceneProgress?: number;
  pointer: WebGLPointerState;
  targets: readonly DebugTargetState[];
};

export function createDebugState(
  runtimeState: DebugRuntimeState,
): WebGLDebugState {
  const state: WebGLDebugState = {
    targetCount: runtimeState.targetCount,
    renderableCount: runtimeState.renderableCount,
    currentScrollMode: runtimeState.currentScrollMode,
    pointer: { ...runtimeState.pointer },
    targets: runtimeState.targets.map((target) => {
      const error = readErrorMessage(target.error);
      const summary: WebGLDebugState["targets"][number] = {
        key: target.key,
        sourceKind: target.sourceKind,
        renderRole: target.renderRole,
        resourceStatus: target.resourceStatus,
        lifecycleState: target.lifecycleState,
        visible: target.visible,
        layerDepth: target.layerDepth ?? 0,
        siblingIndex: target.siblingIndex ?? 0,
      };

      if (target.parentKey) {
        summary.parentKey = target.parentKey;
      }

      if (target.computedRenderOrder !== undefined) {
        summary.computedRenderOrder = target.computedRenderOrder;
      }

      if (error) {
        summary.error = error;
      }

      return summary;
    }),
  };

  if (runtimeState.currentScrollMode === "gate") {
    state.activeGateKey = runtimeState.activeGateKey;
    state.sceneProgress = runtimeState.sceneProgress;
  }

  return state;
}

function readErrorMessage(error: unknown): string | undefined {
  if (error === undefined || error === null) {
    return undefined;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return String(error);
}
