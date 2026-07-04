import { useContext, useEffect } from "react";

import type { WebGLRenderPassDeclaration } from "../types";

import { WebGLPassViewportContext } from "./passViewportContext";
import { WebGLSceneContext } from "./sceneContext";
import { useWebGLRuntime } from "./useWebGLRuntime";

export type WebGLRenderPassProps = {
  id?: string;
  scene?: string;
  camera?: string;
  order?: number;
  clear?: boolean;
  clearDepth?: boolean;
  viewport?: WebGLRenderPassDeclaration["viewport"];
  postprocess?: WebGLRenderPassDeclaration["postprocess"];
};

export function WebGLRenderPass({
  id,
  scene,
  camera,
  order,
  clear,
  clearDepth,
  viewport,
  postprocess,
}: WebGLRenderPassProps) {
  const runtime = useWebGLRuntime();
  const inheritedSceneId = useContext(WebGLSceneContext);
  const inheritedPassViewportId = useContext(WebGLPassViewportContext);
  const sceneId = scene ?? inheritedSceneId;

  useEffect(() => {
    if (!sceneId) {
      throw new Error(
        "WebGL render pass requires a scene prop or a parent WebGLScene.",
      );
    }

    const normalizedViewport = resolveReactPassViewport(
      viewport,
      inheritedPassViewportId,
    );
    const declaration: WebGLRenderPassDeclaration = {
      id,
      sceneId,
      cameraId: camera,
      order,
      clear,
      clearDepth,
      viewport: normalizedViewport,
      postprocess,
    };

    runtime.registerRenderPass(declaration);

    return () => {
      runtime.unregisterRenderPass(
        id?.trim() ?? `${sceneId.trim()}:${camera?.trim() ?? "default"}:pass`,
      );
    };
  }, [
    runtime,
    id,
    sceneId,
    camera,
    order,
    clear,
    clearDepth,
    viewport,
    postprocess,
    inheritedPassViewportId,
  ]);

  return null;
}

export function resolveReactPassViewport(
  viewport: WebGLRenderPassDeclaration["viewport"],
  inheritedAnchorId: string | undefined,
): WebGLRenderPassDeclaration["viewport"] {
  if (!viewport || viewport.mode !== "dom-rect" || viewport.anchorId) {
    return viewport;
  }

  return inheritedAnchorId
    ? { ...viewport, anchorId: inheritedAnchorId }
    : viewport;
}
