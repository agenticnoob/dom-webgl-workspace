import { useContext, useEffect } from "react";

import type { WebGLModelDeclaration } from "../types";

import { WebGLSceneContext } from "./sceneContext";
import { useWebGLRuntime } from "./useWebGLRuntime";

export type WebGLModelProps = Omit<WebGLModelDeclaration, "sceneId"> & {
  scene?: string;
};

export function WebGLModel({
  id,
  scene,
  src,
  loader,
  position,
  rotation,
  scale,
  visible,
  timeline,
  animation,
}: WebGLModelProps) {
  const runtime = useWebGLRuntime();
  const inheritedSceneId = useContext(WebGLSceneContext);
  const sceneId = scene ?? inheritedSceneId;

  if (!sceneId) {
    throw new Error(
      `WebGL model "${id}" requires a scene prop or a parent WebGLScene.`,
    );
  }

  useEffect(() => {
    runtime.registerModel({
      id,
      sceneId,
      src,
      ...(loader !== undefined ? { loader } : {}),
      ...(position !== undefined ? { position } : {}),
      ...(rotation !== undefined ? { rotation } : {}),
      ...(scale !== undefined ? { scale } : {}),
      ...(visible !== undefined ? { visible } : {}),
      ...(timeline !== undefined ? { timeline } : {}),
      ...(animation !== undefined ? { animation } : {}),
    });

    return () => {
      runtime.unregisterModel(id);
    };
  }, [
    runtime,
    id,
    sceneId,
    src,
    loader,
    position,
    rotation,
    scale,
    visible,
    timeline,
    animation,
  ]);

  return null;
}
