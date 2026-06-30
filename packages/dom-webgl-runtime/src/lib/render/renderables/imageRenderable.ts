import type { ResourceManager } from "../../resources/resourceManager";
import type { DOMViewportSize } from "../../renderer/domProjection";
import type { ElementMeasurement } from "../../renderer/layoutPass";
import type { WebGLSceneAdapter } from "../../renderer/sceneObject";
import type { WebGLMediaImageSourceDescriptor } from "../../source/sourceDescriptor";
import {
  createRenderable,
  readManagedObjectOrdering,
  readRenderableOrdering,
  type Renderable,
  type RenderableContext,
} from "../renderable";
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
  requestTextureFrame?(): void;
};

export function createImageRenderable(
  context: RenderableContext,
  options: ImageRenderableOptions,
): ImageRenderable {
  const source = readImageSource(context.source);
  const resource = options.resourceManager.acquire<HTMLImageElement>(source);
  const state = {
    fallbackVisible: true,
    resourceFailed: false,
    scene: undefined as SceneRenderableController | undefined,
  };
  const renderable = createRenderable(
    context,
    {
      async update() {
        if (state.resourceFailed) {
          return;
        }

        let image: HTMLImageElement;

        try {
          image = await resource.load(async () => loadDomImage(source));
        } catch (error: unknown) {
          state.resourceFailed = true;
          throw error;
        }

        state.scene ??= createTexturePlaneSceneRenderableController({
          key: context.descriptor.key,
          sceneAdapter: options.sceneAdapter,
          measureElement: options.measureElement,
          getViewportSize: options.getViewportSize,
          element: source.anchor,
          ordering: readRenderableOrdering(context),
          getManagedObjectOrdering: () => readManagedObjectOrdering(context),
          textureKind: "image",
          textureSource: image,
          requestTextureFrame: options.requestTextureFrame,
        });
        state.scene.attach();
        state.fallbackVisible = false;
      },
      updateLayout(_context, _lifecycle, measurement) {
        state.scene?.updateLayout(measurement);
      },
      invalidateContent() {
        state.resourceFailed = false;
        state.scene?.object.invalidateContent?.();
      },
      setVisible(visible) {
        state.scene?.controller.setVisible(visible);
      },
      sceneObjectController() {
        return state.scene?.controller;
      },
      effectTarget() {
        return state.scene?.object.effectTarget;
      },
      effectSource() {
        return {
          kind: "media",
          type: "image",
          element: source.anchor,
          src: source.src,
          image: state.scene?.object.textureLayerCapability,
        };
      },
      inspectTextureTelemetry() {
        return state.scene?.object.inspectTextureTelemetry?.() ?? [];
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
): WebGLMediaImageSourceDescriptor {
  if (source.kind !== "media" || source.type !== "image") {
    throw new Error(
      `Expected media/image source descriptor, received ${readSourceKind(source)}`,
    );
  }

  return source;
}

function readSourceKind(source: RenderableContext["source"]): string {
  return `${source.kind}/${source.type}`;
}

async function loadDomImage(
  source: WebGLMediaImageSourceDescriptor,
): Promise<HTMLImageElement> {
  const image = source.element ?? new Image();

  if (!source.element) {
    image.decoding = "async";
    image.src = source.src;
  }

  if (typeof image.decode === "function") {
    await image.decode();
  }

  return image;
}
