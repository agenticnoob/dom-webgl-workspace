import type { WebGLRenderRole } from "../types";

export type RenderPolicy = {
  role: WebGLRenderRole;
  band: number;
  depthMode: "flat" | "model";
  opacityMode: "opaque" | "alpha" | "source";
};

export type SceneObjectOrdering = {
  renderOrder: number;
  transparent: boolean;
  depthWrite: boolean;
  depthTest: boolean;
};

export function compileRenderPolicy(renderRole: WebGLRenderRole): RenderPolicy {
  switch (renderRole) {
    case "surface":
      return {
        role: renderRole,
        band: 0,
        depthMode: "flat",
        opacityMode: "alpha",
      };
    case "content":
      return {
        role: renderRole,
        band: 1,
        depthMode: "flat",
        opacityMode: "alpha",
      };
    case "media":
      return {
        role: renderRole,
        band: 2,
        depthMode: "flat",
        opacityMode: "source",
      };
    case "model":
      return {
        role: renderRole,
        band: 3,
        depthMode: "model",
        opacityMode: "alpha",
      };
    case "overlay":
      return {
        role: renderRole,
        band: 4,
        depthMode: "flat",
        opacityMode: "alpha",
      };
  }
}

export function toSceneObjectOrdering(policy: RenderPolicy): SceneObjectOrdering {
  return {
    renderOrder: policy.band * 100,
    transparent: policy.opacityMode !== "opaque",
    depthWrite: policy.depthMode === "model",
    depthTest: policy.depthMode === "model",
  };
}
