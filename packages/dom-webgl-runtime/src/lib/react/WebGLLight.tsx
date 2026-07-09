import { useContext, useEffect } from "react";

import type { WebGLLightDeclaration } from "../types";

import { WebGLSceneContext } from "./sceneContext";
import { useWebGLRuntime } from "./useWebGLRuntime";

export type WebGLLightProps = Omit<WebGLLightDeclaration, "sceneId"> & {
  scene?: string;
};

export function WebGLLight({
  id,
  scene,
  kind,
  color,
  intensity,
  position,
  target,
  distance,
  decay,
  visible,
  timeline,
}: WebGLLightProps) {
  const runtime = useWebGLRuntime();
  const inheritedSceneId = useContext(WebGLSceneContext);
  const sceneId = scene ?? inheritedSceneId;

  if (!sceneId) {
    throw new Error(
      `WebGL light "${id}" requires a scene prop or a parent WebGLScene.`,
    );
  }

  useEffect(() => {
    runtime.registerLight({
      id,
      sceneId,
      kind,
      ...(color !== undefined ? { color } : {}),
      ...(intensity !== undefined ? { intensity } : {}),
      ...(position !== undefined ? { position } : {}),
      ...(target !== undefined ? { target } : {}),
      ...(distance !== undefined ? { distance } : {}),
      ...(decay !== undefined ? { decay } : {}),
      ...(visible !== undefined ? { visible } : {}),
      ...(timeline !== undefined ? { timeline } : {}),
    });

    return () => {
      runtime.unregisterLight(id);
    };
  }, [
    runtime,
    id,
    sceneId,
    kind,
    color,
    intensity,
    position,
    target,
    distance,
    decay,
    visible,
    timeline,
  ]);

  return null;
}
