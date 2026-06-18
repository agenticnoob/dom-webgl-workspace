import type { ResourceManager } from "../../resources/resourceManager";
import type { DOMViewportSize } from "../../renderer/domProjection";
import type { ElementMeasurement } from "../../renderer/layoutPass";
import type { WebGLSceneAdapter } from "../../renderer/sceneObject";
import type { WebGLImageSourceDescriptor } from "../../source/sourceDescriptor";
import {
  createRenderable,
  type Renderable,
  type RenderableContext,
} from "../renderable";
import { toSceneObjectOrdering } from "../renderPolicy";
import {
  createTexturePlaneSceneRenderableController,
  type SceneRenderableController,
} from "./sceneRenderableObject";

export type ImageRenderable = Renderable & {
  readonly fallbackVisible: boolean;
};

type ImageRenderableOptions = {
  resourceManager: ResourceManager;
  sceneAdapter: WebGLSceneAdapter;
  measureElement(element: HTMLElement): ElementMeasurement;
  getViewportSize?(): DOMViewportSize;
};

export function createImageRenderable(
  context: RenderableContext,
  options: ImageRenderableOptions,
): ImageRenderable {
  const source = readImageSource(context.source);
  const resource = options.resourceManager.acquire<HTMLImageElement>(source);
  const state = {
    fallbackVisible: true,
    scene: undefined as SceneRenderableController | undefined,
  };
  const renderable = createRenderable(
    context,
    {
      async update() {
        const image = await resource.load(async () => loadDomImage(source));
        state.scene ??= createTexturePlaneSceneRenderableController({
          key: context.descriptor.key,
          sceneAdapter: options.sceneAdapter,
          measureElement: options.measureElement,
          getViewportSize: options.getViewportSize,
          element: source.element,
          ordering: toSceneObjectOrdering(context.policy),
          textureKind: "image",
          textureSource: image,
        });
        state.scene.attach();
        state.fallbackVisible = false;
      },
      updateLayout(_context, _lifecycle, measurement) {
        state.scene?.updateLayout(measurement);
      },
      setVisible(visible) {
        state.scene?.controller.setVisible(visible);
      },
      sceneObjectController() {
        return state.scene?.controller;
      },
      dispose() {
        state.scene?.controller.dispose();
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
