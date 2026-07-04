import { createElement, useLayoutEffect, type ReactNode } from "react";

import type { WebGLSceneDeclaration } from "../types";

import { WebGLSceneProvider } from "./sceneContext";
import { useWebGLRuntime } from "./useWebGLRuntime";

export type WebGLSceneRenderOptions = {
  id?: string;
  camera?: string;
  order?: number;
  clear?: boolean;
  clearDepth?: boolean;
};

export type WebGLSceneProps = WebGLSceneDeclaration & {
  render?: boolean | WebGLSceneRenderOptions;
  children?: ReactNode;
};

export function WebGLScene({
  id,
  projection,
  defaultCameraId,
  defaultPass,
  timeline,
  render,
  children,
}: WebGLSceneProps) {
  const runtime = useWebGLRuntime();
  const renderOptions =
    typeof render === "object" && render !== null ? render : undefined;
  const sceneDefaultPass =
    render === undefined ? defaultPass : render === true;

  useLayoutEffect(() => {
    runtime.registerScene({
      id,
      projection,
      defaultCameraId,
      defaultPass: sceneDefaultPass,
      timeline,
    });

    if (renderOptions) {
      runtime.registerRenderPass({
        id: renderOptions.id,
        sceneId: id,
        cameraId: renderOptions.camera,
        order: renderOptions.order,
        clear: renderOptions.clear,
        clearDepth: renderOptions.clearDepth,
      });
    }

    return () => {
      if (renderOptions) {
        runtime.unregisterRenderPass(
          renderOptions.id?.trim() ??
            `${id.trim()}:${renderOptions.camera?.trim() ?? "default"}:pass`,
        );
      }
      runtime.unregisterScene(id);
    };
  }, [
    runtime,
    id,
    projection,
    defaultCameraId,
    sceneDefaultPass,
    timeline,
    renderOptions?.id,
    renderOptions?.camera,
    renderOptions?.order,
    renderOptions?.clear,
    renderOptions?.clearDepth,
  ]);

  return createElement(WebGLSceneProvider, { sceneId: id }, children);
}
