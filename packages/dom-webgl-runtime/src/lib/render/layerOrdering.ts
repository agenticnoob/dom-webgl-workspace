import type { TargetLayerRecord } from "../dom/targetTree";
import type { WebGLRenderRole } from "../types";
import type { RenderPolicy, SceneObjectOrdering } from "./renderPolicy";

const targetLayerStride = 100;

const localRoleOffsets = {
  surface: 0,
  media: 10,
  model: 20,
  content: 30,
  overlay: 40,
} satisfies Record<WebGLRenderRole, number>;

export function toScopedSceneObjectOrdering(
  policy: RenderPolicy,
  layer: TargetLayerRecord,
): SceneObjectOrdering {
  return {
    renderOrder:
      layer.paintIndex * targetLayerStride + localRoleOffsets[policy.role],
    transparent: policy.opacityMode !== "opaque",
    depthWrite: policy.depthMode === "model",
  };
}

export function toScopedManagedObjectOrdering(
  layer: TargetLayerRecord,
): SceneObjectOrdering {
  return {
    renderOrder: layer.paintIndex * targetLayerStride + localRoleOffsets.overlay,
    transparent: true,
    depthWrite: false,
  };
}
