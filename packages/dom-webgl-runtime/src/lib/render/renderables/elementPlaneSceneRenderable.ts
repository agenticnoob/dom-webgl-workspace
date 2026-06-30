import { PlaneGeometry } from "three/src/geometries/PlaneGeometry.js";
import { MeshBasicMaterial } from "three/src/materials/MeshBasicMaterial.js";
import { Group } from "three/src/objects/Group.js";
import { Mesh } from "three/src/objects/Mesh.js";
import { CanvasTexture } from "three/src/textures/CanvasTexture.js";

import { createElementPlaneEffectTarget } from "./effectTargets/elementPlaneEffectTarget";
import { createCanvasSurfaceCapabilityHandle } from "./sourceCapabilityHandles";
import { createTextureUploadState } from "./textureUploadState";
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
  const textureUpload = createTextureUploadState({
    key: options.key,
    texture,
    source: canvas,
    requestFrame: options.requestTextureFrame,
  });
  const geometry = new PlaneGeometry(1, 1);
  const material = new MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: 0,
  });
  material.transparent = true;
  const mesh = new Mesh(geometry, material);
  const group = new Group();
  let lastMeasurement: ElementMeasurement | undefined;

  group.add(mesh);
  group.visible = false;
  textureUpload.markUploadDirty("initial");

  const controller = createSceneRenderableController({
    ...options,
    object3D: group,
    effectTarget: createElementPlaneEffectTarget(
      group,
      material,
      createManagedObject3DFactory(options),
    ),
    disposeResources() {
      textureUpload.dispose();
      texture.dispose();
      geometry.dispose();
      material.dispose();
    },
  });
  controller.object.surfaceCapability = createCanvasSurfaceCapabilityHandle({
    object3D: group,
    mesh,
    material,
    canvas,
    context,
    texture,
    markTextureDirty(reason) {
      textureUpload.markUploadDirty(reason);
    },
    getSize() {
      return readSurfaceSize(lastMeasurement);
    },
    invalidate() {
      return;
    },
  });
  controller.object.inspectTextureTelemetry = () => [textureUpload.inspect()];
  controller.object.updateTextLayout = (measurement) => {
    lastMeasurement = measurement;
    textureUpload.updateSize(readSurfaceSize(measurement));
    resizeCanvasToMeasurement(canvas, texture, measurement, () => {
      textureUpload.markUploadDirty("canvas-raster");
    });
  };

  return controller;
}
