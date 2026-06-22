import { PlaneGeometry } from "three/src/geometries/PlaneGeometry.js";
import { MeshBasicMaterial } from "three/src/materials/MeshBasicMaterial.js";
import { Mesh } from "three/src/objects/Mesh.js";
import { CanvasTexture } from "three/src/textures/CanvasTexture.js";

import { createElementPlaneEffectTarget } from "./effectTargets/elementPlaneEffectTarget";
import { createCanvasSurfaceCapabilityHandle } from "./sourceCapabilityHandles";
import {
  createManagedObject3DFactory,
  createSceneRenderableController,
  readCanvasContext,
  readSurfaceSize,
  resizeCanvasToMeasurement,
  type ElementMeasurement,
  type SceneRenderableController,
  type SceneRenderableControllerOptions,
} from "./sceneRenderableController";

export function createElementPlaneSceneRenderableController(
  options: Omit<SceneRenderableControllerOptions, "object3D" | "disposeResources">,
): SceneRenderableController {
  const canvas = options.element.ownerDocument.createElement("canvas");
  const context = readCanvasContext(canvas);
  const texture = new CanvasTexture(canvas);
  const geometry = new PlaneGeometry(1, 1);
  const material = new MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: 0,
  });
  material.transparent = true;
  const mesh = new Mesh(geometry, material);
  let lastMeasurement: ElementMeasurement | undefined;

  mesh.visible = false;

  const controller = createSceneRenderableController({
    ...options,
    object3D: mesh,
    effectTarget: createElementPlaneEffectTarget(
      mesh,
      material,
      createManagedObject3DFactory(options),
    ),
    disposeResources() {
      texture.dispose();
      geometry.dispose();
      material.dispose();
    },
  });
  controller.object.surfaceCapability = createCanvasSurfaceCapabilityHandle({
    object3D: mesh,
    mesh,
    material,
    canvas,
    context,
    texture,
    getSize() {
      return readSurfaceSize(lastMeasurement);
    },
    invalidate() {
      texture.needsUpdate = true;
    },
  });
  controller.object.updateTextLayout = (measurement) => {
    lastMeasurement = measurement;
    resizeCanvasToMeasurement(canvas, texture, measurement);
  };

  return controller;
}
