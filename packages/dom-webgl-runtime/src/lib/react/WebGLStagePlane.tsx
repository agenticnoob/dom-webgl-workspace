import { useContext, useEffect } from "react";

import type { WebGLStagePlaneDeclaration } from "../types";

import { WebGLSceneContext } from "./sceneContext";
import { useWebGLRuntime } from "./useWebGLRuntime";

export type WebGLStagePlaneProps = Omit<
  WebGLStagePlaneDeclaration,
  "kind" | "sceneId"
> & {
  scene?: string;
};

export function WebGLStagePlane({
  id,
  scene,
  role,
  size,
  position,
  rotation,
  scale,
  visible,
  material,
  timeline,
}: WebGLStagePlaneProps) {
  const runtime = useWebGLRuntime();
  const inheritedSceneId = useContext(WebGLSceneContext);
  const sceneId = scene ?? inheritedSceneId;

  if (!sceneId) {
    throw new Error(
      `WebGL stage plane "${id}" requires a scene prop or a parent WebGLScene.`,
    );
  }

  useEffect(() => {
    runtime.registerStagePrimitive({
      id,
      sceneId,
      kind: "plane",
      ...(role !== undefined ? { role } : {}),
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
    role,
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
