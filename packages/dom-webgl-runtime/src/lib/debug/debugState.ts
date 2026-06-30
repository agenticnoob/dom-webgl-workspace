import type {
  WebGLDebugState,
  WebGLPerformanceBudget,
  WebGLPerformanceWarning,
  WebGLPointerState,
  WebGLRenderRole,
  WebGLResourceStatus,
  WebGLLifecycleState,
} from "../types";
import type { TextureUploadTelemetry } from "../render/renderables/textureUploadState";

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
  performanceBudget?: WebGLPerformanceBudget;
  textureTelemetry?: readonly TextureUploadTelemetry[];
  targets: readonly DebugTargetState[];
};

const defaultPerformanceBudget: Required<WebGLPerformanceBudget> = {
  maxActiveTargets: 50,
  maxActiveSnapshots: 30,
  maxActiveVideos: 4,
  maxActiveModels: 8,
  maxTextureSize: 4096,
  maxConcurrentResourceLoads: 6,
};

export function createDebugState(
  runtimeState: DebugRuntimeState,
): WebGLDebugState {
  const warnings = createPerformanceWarnings(runtimeState);
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

  if (warnings.length > 0) {
    state.warnings = warnings;
  }

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

function createPerformanceWarnings(
  runtimeState: DebugRuntimeState,
): WebGLPerformanceWarning[] {
  const budget = {
    ...defaultPerformanceBudget,
    ...runtimeState.performanceBudget,
  };
  const activeTargets = runtimeState.targets.filter(isActiveTarget);
  const counts = {
    activeTargets: activeTargets.length,
    activeSnapshots: activeTargets.filter(isSnapshotTarget).length,
    activeVideos: activeTargets.filter((target) =>
      isSourceKind(target, "media/video"),
    ).length,
    activeModels: activeTargets.filter((target) =>
      isSourceKind(target, "model/glb"),
    ).length,
  };
  const warnings: WebGLPerformanceWarning[] = [];
  const maxTextureSize = readMaxTextureSize(runtimeState.textureTelemetry ?? []);

  appendWarning(
    warnings,
    "activeTargets",
    counts.activeTargets,
    budget.maxActiveTargets,
  );
  appendWarning(
    warnings,
    "activeSnapshots",
    counts.activeSnapshots,
    budget.maxActiveSnapshots,
  );
  appendWarning(
    warnings,
    "activeVideos",
    counts.activeVideos,
    budget.maxActiveVideos,
  );
  appendWarning(
    warnings,
    "activeModels",
    counts.activeModels,
    budget.maxActiveModels,
  );
  appendWarning(warnings, "textureSize", maxTextureSize, budget.maxTextureSize);

  return warnings;
}

function readMaxTextureSize(
  textureTelemetry: readonly TextureUploadTelemetry[],
): number {
  return textureTelemetry.reduce(
    (maxSize, texture) => Math.max(maxSize, texture.width, texture.height),
    0,
  );
}

function appendWarning(
  warnings: WebGLPerformanceWarning[],
  target: WebGLPerformanceWarning["target"],
  count: number,
  limit: number,
): void {
  if (count <= limit) {
    return;
  }

  warnings.push({
    code: "performance-budget-exceeded",
    target,
    count,
    limit,
  });
}

function isActiveTarget(target: DebugTargetState): boolean {
  return target.lifecycleState === "active";
}

function isSnapshotTarget(target: DebugTargetState): boolean {
  return (
    isSourceKind(target, "dom/element") ||
    isSourceKind(target, "dom/text") ||
    isSourceKind(target, "media/image")
  );
}

function isSourceKind(target: DebugTargetState, sourceKind: string): boolean {
  return target.sourceKind === sourceKind;
}
