import {
  createRenderable,
  readManagedObjectOrdering,
  readRenderableOrdering,
  type Renderable,
  type RenderableContext,
} from "../renderable";
import {
  createElementPlaneSceneRenderableController,
  type SceneRenderableController,
} from "./sceneRenderableObject";
import type { DOMViewportSize } from "../../renderer/domProjection";
import type { ElementMeasurement } from "../../renderer/layoutPass";
import type { WebGLSceneAdapter } from "../../renderer/sceneObject";

type ElementSnapshotRenderableOptions = {
  sceneAdapter: WebGLSceneAdapter;
  measureElement(element: HTMLElement): ElementMeasurement;
  getViewportSize?(): DOMViewportSize;
};

export function createElementSnapshotRenderable(
  context: RenderableContext,
  options: ElementSnapshotRenderableOptions,
): Renderable {
  const state: {
    visible: boolean;
    measurement?: ElementMeasurement;
    scene?: SceneRenderableController;
  } = {
    visible: true,
  };

  return createRenderable(context, {
    update() {
      state.scene ??= createElementPlaneSceneRenderableController({
        key: context.descriptor.key,
        sceneAdapter: options.sceneAdapter,
        measureElement: options.measureElement,
        getViewportSize: options.getViewportSize,
        element: context.descriptor.element,
        ordering: readRenderableOrdering(context),
        getManagedObjectOrdering: () => readManagedObjectOrdering(context),
      });
      state.scene.attach();
    },
    updateLayout(_context, _lifecycle, measurement) {
      state.measurement = measurement;
      state.scene?.updateLayout(state.measurement);
    },
    setVisible(nextVisible) {
      state.visible = nextVisible;
      state.scene?.controller.setVisible(nextVisible);
    },
    invalidateContent() {
      state.scene?.object.invalidateContent?.();
    },
    sceneObjectController() {
      return state.scene?.controller;
    },
    effectTarget() {
      return state.scene?.object.effectTarget;
    },
      effectSource() {
        return {
          kind: "dom",
          type: "element",
          element: context.descriptor.element,
          surface: state.scene?.object.surfaceCapability,
        };
    },
    dispose() {
      state.visible = false;
      state.measurement = undefined;
      state.scene?.controller.dispose();
    },
  });
}
