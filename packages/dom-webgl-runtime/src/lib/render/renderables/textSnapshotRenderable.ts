import {
  createRenderable,
  type Renderable,
  type RenderableContext,
} from "../renderable";
import type { WebGLSceneAdapter } from "../../renderer/sceneObject";
import {
  createTextPlaneSceneRenderableController,
  type SceneRenderableController,
} from "./sceneRenderableObject";
import type { DOMViewportSize } from "../../renderer/domProjection";

export type TextSnapshotRenderable = Renderable & {
  readonly textContent: string;
};

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

type TextSnapshotRenderableOptions = {
  sceneAdapter: WebGLSceneAdapter;
  measureElement(element: HTMLElement): ElementMeasurement;
  getViewportSize?(): DOMViewportSize;
};

export function createTextSnapshotRenderable(
  context: RenderableContext,
  options: TextSnapshotRenderableOptions,
): TextSnapshotRenderable {
  const state = {
    textContent: "",
    scene: undefined as SceneRenderableController | undefined,
  };
  const renderable = createRenderable(
    context,
    {
      update() {
        state.textContent = context.descriptor.element.textContent ?? "";
        state.scene ??= createTextPlaneSceneRenderableController({
          key: context.descriptor.key,
          sceneAdapter: options.sceneAdapter,
          measureElement: options.measureElement,
          getViewportSize: options.getViewportSize,
          element: context.descriptor.element,
          textContent: state.textContent,
        });
        state.scene.updateTextContent(state.textContent);
        state.scene.updateLayout();
        state.scene.attach();
      },
      setVisible(visible) {
        state.scene?.controller.setVisible(visible);
      },
      sceneObjectController() {
        return state.scene?.controller;
      },
      dispose() {
        state.textContent = "";
        state.scene?.controller.dispose();
      },
    },
  );

  return Object.defineProperty(renderable, "textContent", {
    get() {
      return state.textContent;
    },
  }) as TextSnapshotRenderable;
}
