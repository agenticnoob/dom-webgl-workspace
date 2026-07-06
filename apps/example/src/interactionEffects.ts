import { defineWebGLSceneObjectEffect } from "@project/dom-webgl-runtime";

import { clampNumber } from "./effectMath";

type SceneObjectHoverPulseParams = {
  kind: "example.sceneObjectHoverPulse";
  baseOpacity?: number;
  hoverOpacity?: number;
  dragOpacity?: number;
};

type SceneObjectDragPoseParams = {
  kind: "example.sceneObjectDragPose";
  baseScale?: number;
  hoverScale?: number;
  dragScale?: number;
  baseRotationY?: number;
};

export const exampleSceneObjectHoverPulseEffect =
  defineWebGLSceneObjectEffect<SceneObjectHoverPulseParams>({
    kind: "example.sceneObjectHoverPulse",
    source: "stage/plane",
    update(ctx, _state, params) {
      const baseOpacity = clampNumber(params.baseOpacity, 0, 1, 0.72);
      const hoverOpacity = clampNumber(params.hoverOpacity, 0, 1, 0.9);
      const dragOpacity = clampNumber(params.dragOpacity, 0, 1, 1);

      ctx.object.opacity = ctx.objectPointer.isDragging
        ? dragOpacity
        : ctx.objectPointer.isHovered
          ? hoverOpacity
          : baseOpacity;
    },
  });

export const exampleSceneObjectDragPoseEffect =
  defineWebGLSceneObjectEffect<SceneObjectDragPoseParams>({
    kind: "example.sceneObjectDragPose",
    source: "model/glb",
    update(ctx, _state, params) {
      const baseScale = clampNumber(params.baseScale, 0.01, 20, 7.8);
      const hoverScale = clampNumber(params.hoverScale, 1, 1.5, 1.04);
      const dragScale = clampNumber(params.dragScale, 1, 1.8, 1.1);
      const baseRotationY = clampNumber(params.baseRotationY, -Math.PI, Math.PI, -0.42);
      const pointerScale = ctx.objectPointer.isDragging
        ? dragScale
        : ctx.objectPointer.isHovered
          ? hoverScale
          : 1;
      const dragYaw = ctx.objectPointer.isDragging
        ? ctx.objectPointer.dragDeltaX * 0.008
        : Math.sin(ctx.time / 1400) * 0.06;

      ctx.object.visible = true;
      ctx.object.scale.setScalar(baseScale * pointerScale);
      ctx.object.rotation.set(0, baseRotationY + dragYaw, 0);
    },
  });
