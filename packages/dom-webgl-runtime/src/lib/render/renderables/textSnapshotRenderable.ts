import {
  createRenderable,
  type Renderable,
  type RenderableContext,
} from "../renderable";

export type TextSnapshotRenderable = Renderable & {
  readonly textContent: string;
};

export function createTextSnapshotRenderable(
  context: RenderableContext,
): TextSnapshotRenderable {
  const state = {
    textContent: "",
  };
  const renderable = createRenderable(
    context,
    {
      update() {
        state.textContent = context.descriptor.element.textContent ?? "";
      },
      dispose() {
        state.textContent = "";
      },
    },
  );

  return Object.defineProperty(renderable, "textContent", {
    get() {
      return state.textContent;
    },
  }) as TextSnapshotRenderable;
}
