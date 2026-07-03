import { createElement, useLayoutEffect, type ReactNode } from "react";

import type { WebGLSceneDeclaration } from "../types";

import { WebGLSceneProvider } from "./sceneContext";
import { useWebGLRuntime } from "./useWebGLRuntime";

export type WebGLSceneProps = WebGLSceneDeclaration & {
  children?: ReactNode;
};

export function WebGLScene({
  id,
  projection,
  defaultCameraId,
  defaultPass,
  children,
}: WebGLSceneProps) {
  const runtime = useWebGLRuntime();

  useLayoutEffect(() => {
    runtime.registerScene({
      id,
      projection,
      defaultCameraId,
      defaultPass,
    });

    return () => {
      runtime.unregisterScene(id);
    };
  }, [runtime, id, projection, defaultCameraId, defaultPass]);

  return createElement(WebGLSceneProvider, { sceneId: id }, children);
}
