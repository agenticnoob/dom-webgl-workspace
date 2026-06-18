import {
  createRenderable,
  type Renderable,
  type RenderableContext,
} from "../renderable";
import { toSceneObjectOrdering } from "../renderPolicy";
import type { WebGLSceneAdapter } from "../../renderer/sceneObject";
import {
  createTextPlaneSceneRenderableController,
  type SceneRenderableController,
} from "./sceneRenderableObject";
import type { DOMViewportSize } from "../../renderer/domProjection";
import type { ElementMeasurement } from "../../renderer/layoutPass";

export type TextSnapshotRenderable = Renderable & {
  readonly textContent: string;
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
    contentDirty: true,
    scene: undefined as SceneRenderableController | undefined,
  };
  const renderable = createRenderable(
    context,
    {
      update() {
        if (state.contentDirty) {
          state.textContent = context.descriptor.element.textContent ?? "";
          state.contentDirty = false;
        }

        state.scene ??= createTextPlaneSceneRenderableController({
          key: context.descriptor.key,
          sceneAdapter: options.sceneAdapter,
          measureElement: options.measureElement,
          getViewportSize: options.getViewportSize,
          element: context.descriptor.element,
          ordering: toSceneObjectOrdering(context.policy),
          textContent: state.textContent,
        });
        if (state.scene.object.textContent !== state.textContent) {
          state.scene.updateTextContent(state.textContent);
        }
        state.scene.attach();
      },
      updateLayout(_context, _lifecycle, measurement) {
        state.scene?.updateLayout(measurement);
      },
      invalidateContent() {
        state.contentDirty = true;
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
