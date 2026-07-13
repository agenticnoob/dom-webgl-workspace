import { useContext, useEffect } from "react";

import type { WebGLMeshDeclaration } from "../types";

import { WebGLSceneContext } from "./sceneContext";
import { useWebGLRuntime } from "./useWebGLRuntime";

export type WebGLMeshProps = Omit<WebGLMeshDeclaration, "sceneId"> & {
  scene?: string;
};

/**
 * Declares runtime-owned procedural geometry. Reuse a stable geometry descriptor;
 * module constants or memoization avoid unnecessary unregister/register cycles.
 */
export function WebGLMesh({
  id,
  scene,
  geometry,
  position,
  rotation,
  scale,
  visible,
  material,
  timeline,
  effects,
  interaction,
  physics,
}: WebGLMeshProps) {
  const runtime = useWebGLRuntime();
  const inheritedSceneId = useContext(WebGLSceneContext);
  const sceneId = scene ?? inheritedSceneId;

  if (!sceneId) {
    throw new Error(
      `WebGL mesh "${id}" requires a scene prop or a parent WebGLScene.`,
    );
  }

  useEffect(() => {
    runtime.registerMesh({
      id,
      sceneId,
      geometry,
      ...(position !== undefined ? { position } : {}),
      ...(rotation !== undefined ? { rotation } : {}),
      ...(scale !== undefined ? { scale } : {}),
      ...(visible !== undefined ? { visible } : {}),
      ...(material !== undefined ? { material } : {}),
      ...(timeline !== undefined ? { timeline } : {}),
      ...(effects !== undefined ? { effects } : {}),
      ...(interaction !== undefined ? { interaction } : {}),
      ...(physics !== undefined ? { physics } : {}),
    });

    return () => {
      runtime.unregisterMesh(id);
    };
  }, [
    runtime,
    id,
    sceneId,
    geometry,
    position,
    rotation,
    scale,
    visible,
    material,
    timeline,
    effects,
    interaction,
    physics,
  ]);

  return null;
}
