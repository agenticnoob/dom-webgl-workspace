import type {
  WebGLDebugState,
  WebGLPointerState,
  WebGLRenderRole,
  WebGLResourceStatus,
} from "../types";

export type DebugTargetState = {
  key: string;
  sourceKind: string;
  renderRole: WebGLRenderRole;
  resourceStatus: WebGLResourceStatus;
  visible: boolean;
  error?: unknown;
};

export type DebugRuntimeState = {
  targetCount: number;
  renderableCount: number;
  currentScrollMode: WebGLDebugState["currentScrollMode"];
  pointer: WebGLPointerState;
  targets: readonly DebugTargetState[];
};

export function createDebugState(
  runtimeState: DebugRuntimeState,
): WebGLDebugState {
  return {
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
        visible: target.visible,
      };

      if (error) {
        summary.error = error;
      }

      return summary;
    }),
  };
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
