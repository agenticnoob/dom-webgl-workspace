import {
  createRenderable,
  type Renderable,
  type RenderableContext,
} from "../renderable";

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
  measureElement(element: HTMLElement): ElementMeasurement;
};

export function createElementSnapshotRenderable(
  context: RenderableContext,
  options: ElementSnapshotRenderableOptions,
): Renderable {
  const state: {
    visible: boolean;
    measurement?: ElementMeasurement;
  } = {
    visible: true,
  };

  return createRenderable(context, {
    update() {
      state.measurement = options.measureElement(context.descriptor.element);
    },
    setVisible(nextVisible) {
      state.visible = nextVisible;
    },
    dispose() {
      state.visible = false;
      state.measurement = undefined;
    },
  });
}
