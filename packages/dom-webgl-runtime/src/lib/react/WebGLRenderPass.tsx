import { useContext, useEffect } from "react";

import type { WebGLRenderPassDeclaration } from "../types";

import { WebGLSceneContext } from "./sceneContext";
import { useWebGLRuntime } from "./useWebGLRuntime";

export type WebGLRenderPassProps = {
  id?: string;
  scene?: string;
  camera?: string;
  order?: number;
};

export function WebGLRenderPass({
  id,
  scene,
  camera,
  order,
}: WebGLRenderPassProps) {
  const runtime = useWebGLRuntime();
  const inheritedSceneId = useContext(WebGLSceneContext);
  const sceneId = scene ?? inheritedSceneId;

  useEffect(() => {
    if (!sceneId) {
      throw new Error(
        "WebGL render pass requires a scene prop or a parent WebGLScene.",
      );
    }

    const declaration: WebGLRenderPassDeclaration = {
      id,
      sceneId,
      cameraId: camera,
      order,
    };

    runtime.registerRenderPass(declaration);

    return () => {
      runtime.unregisterRenderPass(
        id ?? `${sceneId.trim()}:${camera?.trim() ?? "default"}:pass`,
      );
    };
  }, [runtime, id, sceneId, camera, order]);

  return null;
}
