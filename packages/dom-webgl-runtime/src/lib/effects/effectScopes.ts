import type {
  WebGLProgressSignalSource,
  WebGLSceneProjection,
} from "../types";
import type { NormalizedTimelineBinding } from "../timeline/timelineDeclarations";
import { readTimelineProgress } from "../timeline/timelineDeclarations";
import type { WebGLEffectScopeSnapshot } from "./effectAuthoring";

export type WebGLEffectSceneScopeSource = {
  readonly id: string;
  readonly projection: WebGLSceneProjection;
  readonly timeline?: NormalizedTimelineBinding;
};

export type WebGLEffectScopeOptions = {
  readonly progressSignals: WebGLProgressSignalSource;
  readonly scene?: WebGLEffectSceneScopeSource;
};

export function createWebGLEffectScopeSnapshot(
  options: WebGLEffectScopeOptions,
): WebGLEffectScopeSnapshot {
  return {
    runtime: { progress: options.progressSignals },
    ...(options.scene ? { scene: createSceneScope(options.scene, options.progressSignals) } : {}),
  };
}

function createSceneScope(
  scene: WebGLEffectSceneScopeSource,
  progressSignals: WebGLProgressSignalSource,
): NonNullable<WebGLEffectScopeSnapshot["scene"]> {
  return {
    id: scene.id,
    projection: scene.projection,
    ...(scene.timeline
      ? { timeline: readTimelineProgress(scene.timeline, progressSignals) }
      : {}),
  };
}
