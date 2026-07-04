import { useContext, useEffect } from "react";

import type { WebGLStageBoxDeclaration } from "../types";

import { WebGLSceneContext } from "./sceneContext";
import { useWebGLRuntime } from "./useWebGLRuntime";

export type WebGLStageBoxProps = Omit<
  WebGLStageBoxDeclaration,
  "kind" | "sceneId"
> & {
  scene?: string;
};

export function WebGLStageBox({
  id,
  scene,
  size,
  position,
  rotation,
  scale,
  visible,
  material,
  timeline,
}: WebGLStageBoxProps) {
  const runtime = useWebGLRuntime();
  const inheritedSceneId = useContext(WebGLSceneContext);
  const sceneId = scene ?? inheritedSceneId;

  if (!sceneId) {
    throw new Error(
      `WebGL stage box "${id}" requires a scene prop or a parent WebGLScene.`,
    );
  }

  useEffect(() => {
    runtime.registerStagePrimitive({
      id,
      sceneId,
      kind: "box",
      ...(size !== undefined ? { size } : {}),
      ...(position !== undefined ? { position } : {}),
      ...(rotation !== undefined ? { rotation } : {}),
      ...(scale !== undefined ? { scale } : {}),
      ...(visible !== undefined ? { visible } : {}),
      ...(material !== undefined ? { material } : {}),
      ...(timeline !== undefined ? { timeline } : {}),
    });

    return () => {
      runtime.unregisterStagePrimitive(id);
    };
  }, [
    runtime,
    id,
    sceneId,
    size,
    position,
    rotation,
    scale,
    visible,
    material,
    timeline,
  ]);

  return null;
}
