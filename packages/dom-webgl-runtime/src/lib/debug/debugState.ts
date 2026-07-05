import type {
  WebGLDebugLightSummary,
  WebGLDebugCameraControllerSummary,
  WebGLDebugModelSummary,
  WebGLDebugPostprocessRequestSummary,
  WebGLDebugRenderPassSummary,
  WebGLDebugState,
  WebGLDebugStagePrimitiveSummary,
  WebGLPerformanceBudget,
  WebGLPerformanceWarning,
  WebGLPlacementMode,
  WebGLPointerState,
  WebGLRenderRole,
  WebGLResourceStatus,
  WebGLSceneProjection,
  WebGLTargetPointerState,
  WebGLLifecycleState,
} from "../types";
import type { TextureUploadTelemetry } from "../render/renderables/textureUploadState";

export type DebugTargetState = {
  key: string;
  sceneId?: string;
  projection?: WebGLSceneProjection;
  placementMode?: WebGLPlacementMode;
  sourceKind: string;
  renderRole: WebGLRenderRole;
  resourceStatus: WebGLResourceStatus;
  lifecycleState: WebGLLifecycleState;
  visible: boolean;
  pointer?: WebGLTargetPointerState;
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
  rendererStats?: DebugRendererStats;
  postprocessStats?: DebugPostprocessStats;
  stagePrimitives?: readonly WebGLDebugStagePrimitiveSummary[];
  lights?: readonly WebGLDebugLightSummary[];
  models?: readonly WebGLDebugModelSummary[];
  cameraControllers?: readonly WebGLDebugCameraControllerSummary[];
  renderPasses?: readonly WebGLDebugRenderPassSummary[];
  targets: readonly DebugTargetState[];
};

export type DebugRendererStats = {
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
  programs?: number;
};

export type DebugPostprocessStats = {
  activeRequests: number;
  passCount: number;
  maxRenderTargetSize: number;
  requests?: readonly WebGLDebugPostprocessRequestSummary[];
};

export type BatchCandidateSummary = {
  compatiblePlaneCount: number;
  largestFamilySize: number;
};

const defaultPerformanceBudget: Required<WebGLPerformanceBudget> = {
  maxActiveTargets: 50,
  maxActiveSnapshots: 30,
  maxActiveVideos: 4,
  maxActiveModels: 8,
  maxTextureSize: 4096,
  maxConcurrentResourceLoads: 6,
  maxDrawCalls: 300,
  maxTextureCount: 256,
  maxRenderTargetSize: 4096,
  maxPostprocessRequests: 4,
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

      if (target.sceneId) {
        summary.sceneId = target.sceneId;
      }

      if (target.projection) {
        summary.projection = target.projection;
      }

      if (target.placementMode) {
        summary.placementMode = target.placementMode;
      }

      if (target.computedRenderOrder !== undefined) {
        summary.computedRenderOrder = target.computedRenderOrder;
      }

      if (target.pointer) {
        summary.pointer = { ...target.pointer };
      }

      if (error) {
        summary.error = error;
      }

      return summary;
    }),
  };

  if (runtimeState.stagePrimitives && runtimeState.stagePrimitives.length > 0) {
    state.stagePrimitiveCount = runtimeState.stagePrimitives.length;
    state.stagePrimitives = runtimeState.stagePrimitives.map((entry) => ({
      id: entry.id,
      sceneId: entry.sceneId,
      kind: entry.kind,
      ...(entry.timeline
        ? {
            timeline: {
              id: entry.timeline.id,
              progressKey: entry.timeline.progressKey,
              ...(entry.timeline.active !== undefined
                ? { active: entry.timeline.active }
                : {}),
            },
          }
        : {}),
    }));
  }

  if (runtimeState.lights && runtimeState.lights.length > 0) {
    state.lightCount = runtimeState.lights.length;
    state.lights = runtimeState.lights.map((entry) => ({
      id: entry.id,
      sceneId: entry.sceneId,
      kind: entry.kind,
      ...(entry.timeline
        ? {
            timeline: {
              id: entry.timeline.id,
              progressKey: entry.timeline.progressKey,
              ...(entry.timeline.active !== undefined
                ? { active: entry.timeline.active }
                : {}),
            },
          }
        : {}),
    }));
  }

  if (runtimeState.models && runtimeState.models.length > 0) {
    state.modelCount = runtimeState.models.length;
    state.models = runtimeState.models.map((entry) => ({
      id: entry.id,
      sceneId: entry.sceneId,
      src: entry.src,
      resourceStatus: entry.resourceStatus,
      visible: entry.visible,
      clips: entry.clips.slice(),
      activeClips: entry.activeClips.slice(),
      ...(entry.timeline ? { timeline: { ...entry.timeline } } : {}),
      ...(entry.morphs ? { morphs: entry.morphs.slice() } : {}),
      ...(entry.bones ? { bones: entry.bones.slice() } : {}),
      ...(entry.diagnostics
        ? {
            diagnostics: entry.diagnostics.map((diagnostic) => ({
              kind: diagnostic.kind,
              name: diagnostic.name,
            })),
          }
        : {}),
    }));
  }

  if (runtimeState.renderPasses && runtimeState.renderPasses.length > 0) {
    state.renderPasses = runtimeState.renderPasses.map((entry) => ({
      id: entry.id,
      sceneId: entry.sceneId,
      ...(entry.cameraId ? { cameraId: entry.cameraId } : {}),
      viewportMode: entry.viewportMode,
      ...(entry.viewportAnchorId
        ? { viewportAnchorId: entry.viewportAnchorId }
        : {}),
      postprocess: entry.postprocess,
    }));
  }

  if (
    runtimeState.cameraControllers &&
    runtimeState.cameraControllers.length > 0
  ) {
    state.cameraControllers = runtimeState.cameraControllers.map((entry) => ({
      cameraId: entry.cameraId,
      sceneId: entry.sceneId,
      timelineId: entry.timelineId,
      progressKey: entry.progressKey,
      progress: entry.progress,
      applied: entry.applied,
    }));
  }

  if (
    runtimeState.postprocessStats?.requests &&
    runtimeState.postprocessStats.requests.length > 0
  ) {
    state.postprocessRequests = runtimeState.postprocessStats.requests.map(
      (request) => ({
        key: request.key,
        scope: { ...request.scope },
      }),
    );
  }

  if (warnings.length > 0) {
    state.warnings = warnings;
  }

  if (runtimeState.currentScrollMode === "gate") {
    state.activeGateKey = runtimeState.activeGateKey;
    state.sceneProgress = runtimeState.sceneProgress;
  }

  return state;
}

export function createBatchCandidateSummary(
  targets: readonly DebugTargetState[],
): BatchCandidateSummary {
  const familyCounts = new Map<string, number>();
  let compatiblePlaneCount = 0;
  let largestFamilySize = 0;

  for (const target of targets) {
    if (!isBatchCompatiblePlaneTarget(target)) {
      continue;
    }

    const family = `${target.sourceKind}:${target.renderRole}`;
    const count = (familyCounts.get(family) ?? 0) + 1;
    familyCounts.set(family, count);
    compatiblePlaneCount += 1;
    largestFamilySize = Math.max(largestFamilySize, count);
  }

  return {
    compatiblePlaneCount,
    largestFamilySize,
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
    activeModels:
      activeTargets.filter((target) => isSourceKind(target, "model/glb"))
        .length +
      (runtimeState.models ?? []).filter(
        (model) => model.visible && model.resourceStatus === "ready",
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
  appendWarning(
    warnings,
    "drawCalls",
    runtimeState.rendererStats?.drawCalls ?? 0,
    budget.maxDrawCalls,
  );
  appendWarning(
    warnings,
    "textureCount",
    runtimeState.rendererStats?.textures ?? 0,
    budget.maxTextureCount,
  );
  appendWarning(
    warnings,
    "renderTargetSize",
    runtimeState.postprocessStats?.maxRenderTargetSize ?? 0,
    budget.maxRenderTargetSize,
  );
  appendWarning(
    warnings,
    "postprocessRequests",
    runtimeState.postprocessStats?.activeRequests ?? 0,
    budget.maxPostprocessRequests,
  );

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

function isBatchCompatiblePlaneTarget(target: DebugTargetState): boolean {
  return (
    target.lifecycleState === "active" &&
    target.visible &&
    target.renderRole !== "model" &&
    !target.sourceKind.startsWith("model/")
  );
}
