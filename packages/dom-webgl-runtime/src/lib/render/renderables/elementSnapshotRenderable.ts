import {
  createRenderable,
  type Renderable,
  type RenderableContext,
} from "../renderable";
import { toSceneObjectOrdering } from "../renderPolicy";
import {
  createElementPlaneSceneRenderableController,
  type SceneRenderableController,
} from "./sceneRenderableObject";
import type { DOMViewportSize } from "../../renderer/domProjection";
import type { WebGLSceneAdapter } from "../../renderer/sceneObject";

type ElementMeasurement = {
  x: number;
  y: number;
  width: number;
  height: number;
  top: number;
  right: number;
  bottom: number;
  left: number;
};

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
      state.measurement = options.measureElement(context.descriptor.element);
      state.scene ??= createElementPlaneSceneRenderableController({
        key: context.descriptor.key,
        sceneAdapter: options.sceneAdapter,
        measureElement: options.measureElement,
        getViewportSize: options.getViewportSize,
        element: context.descriptor.element,
        ordering: toSceneObjectOrdering(context.policy),
      });
      state.scene.updateLayout(state.measurement);
      state.scene.attach();
    },
    setVisible(nextVisible) {
      state.visible = nextVisible;
      state.scene?.controller.setVisible(nextVisible);
    },
    sceneObjectController() {
      return state.scene?.controller;
    },
    dispose() {
      state.visible = false;
      state.measurement = undefined;
      state.scene?.controller.dispose();
    },
  });
}
