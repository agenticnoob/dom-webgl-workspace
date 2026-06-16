import type { ResourceManager } from "../../resources/resourceManager";
import type { WebGLImageSourceDescriptor } from "../../source/sourceDescriptor";
import {
  createRenderable,
  type Renderable,
  type RenderableContext,
} from "../renderable";

export type ImageRenderable = Renderable & {
  readonly fallbackVisible: boolean;
};

type ImageRenderableOptions = {
  resourceManager: ResourceManager;
};

export function createImageRenderable(
  context: RenderableContext,
  options: ImageRenderableOptions,
): ImageRenderable {
  const source = readImageSource(context.source);
  const resource = options.resourceManager.acquire<HTMLImageElement>(source);
  const state = {
    fallbackVisible: true,
  };
  const renderable = createRenderable(
    context,
    {
      async update() {
        await resource.load(async () => loadDomImage(source));
        state.fallbackVisible = false;
      },
      dispose() {
        resource.dispose();
      },
    },
  );

  return Object.defineProperty(renderable, "fallbackVisible", {
    get() {
      return state.fallbackVisible;
    },
  }) as ImageRenderable;
}

function readImageSource(
  source: RenderableContext["source"],
): WebGLImageSourceDescriptor {
  if (source.kind !== "image") {
    throw new Error(`Expected image source descriptor, received ${source.kind}`);
  }

  return source;
}

async function loadDomImage(
  source: WebGLImageSourceDescriptor,
): Promise<HTMLImageElement> {
  if (typeof source.element.decode === "function") {
    await source.element.decode();
  }

  return source.element;
}
