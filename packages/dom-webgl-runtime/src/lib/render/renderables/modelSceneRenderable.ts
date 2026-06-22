import type { Object3D } from "three/src/core/Object3D.js";
import { Box3 } from "three/src/math/Box3.js";
import { Vector3 } from "three/src/math/Vector3.js";

import type { ProjectedDOMRect } from "../../renderer/domProjection";
import {
  createSceneRenderableController,
  setVector3,
  updateObject3DLayout,
  type SceneRenderableController,
  type SceneRenderableControllerOptions,
} from "./sceneRenderableController";

export function createModelSceneRenderableController(
  options: Omit<SceneRenderableControllerOptions, "layoutObject3D"> & {
    object3D: unknown;
  },
): SceneRenderableController {
  const fit = readModelObjectFit(options.object3D);

  return createSceneRenderableController({
    ...options,
    layoutObject3D(object3D, layout) {
      updateModelObject3DLayout(object3D, layout, fit);
    },
  });
}

type ModelObjectFit = {
  center: Vector3;
  width: number;
  height: number;
  depth: number;
};

function readModelObjectFit(object3D: unknown): ModelObjectFit | undefined {
  if (!isObject3D(object3D)) {
    return undefined;
  }

  const bounds = new Box3().setFromObject(object3D);

  if (
    !Number.isFinite(bounds.min.x) ||
    !Number.isFinite(bounds.min.y) ||
    !Number.isFinite(bounds.min.z) ||
    !Number.isFinite(bounds.max.x) ||
    !Number.isFinite(bounds.max.y) ||
    !Number.isFinite(bounds.max.z) ||
    bounds.isEmpty()
  ) {
    return undefined;
  }

  const size = new Vector3();
  const center = new Vector3();

  bounds.getSize(size);
  bounds.getCenter(center);

  return {
    center,
    width: size.x,
    height: size.y,
    depth: size.z,
  };
}

function updateModelObject3DLayout(
  object3D: unknown,
  layout: ProjectedDOMRect,
  fit: ModelObjectFit | undefined,
): void {
  if (!fit || fit.width <= 0 || fit.height <= 0) {
    updateObject3DLayout(object3D, layout);
    return;
  }

  const scale = Math.min(layout.width / fit.width, layout.height / fit.height);

  if (!Number.isFinite(scale) || scale <= 0) {
    updateObject3DLayout(object3D, layout);
    return;
  }

  setVector3(
    (object3D as { position?: unknown }).position,
    normalizeSignedZero(layout.x - fit.center.x * scale),
    normalizeSignedZero(layout.y - fit.center.y * scale),
    normalizeSignedZero(-fit.center.z * scale),
  );
  setVector3((object3D as { scale?: unknown }).scale, scale, scale, scale);
}

function normalizeSignedZero(value: number): number {
  return Object.is(value, -0) ? 0 : value;
}

function isObject3D(object3D: unknown): object3D is Object3D {
  return (
    !!object3D &&
    typeof object3D === "object" &&
    "isObject3D" in object3D &&
    (object3D as { isObject3D?: unknown }).isObject3D === true
  );
}
