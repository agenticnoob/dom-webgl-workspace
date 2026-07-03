import { useContext, useEffect } from "react";

import type { WebGLCameraDeclaration } from "../types";

import { WebGLSceneContext } from "./sceneContext";
import { useWebGLRuntime } from "./useWebGLRuntime";

export type WebGLCameraProps = Omit<WebGLCameraDeclaration, "sceneId"> & {
  scene?: string;
};

export function WebGLCamera({
  id,
  scene,
  type,
  mode,
  default: isDefault,
}: WebGLCameraProps) {
  const runtime = useWebGLRuntime();
  const inheritedSceneId = useContext(WebGLSceneContext);
  const sceneId = scene ?? inheritedSceneId;

  useEffect(() => {
    if (!sceneId) {
      throw new Error(
        `WebGL camera "${id}" requires a scene prop or a parent WebGLScene.`,
      );
    }

    runtime.registerCamera({
      id,
      sceneId,
      type,
      mode,
      default: isDefault,
    });

    return () => {
      runtime.unregisterCamera(id);
    };
  }, [runtime, id, sceneId, type, mode, isDefault]);

  return null;
}
