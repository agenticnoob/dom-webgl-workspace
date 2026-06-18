import type { ResourceManager } from "../../resources/resourceManager";
import type { DOMViewportSize } from "../../renderer/domProjection";
import type { ElementMeasurement } from "../../renderer/layoutPass";
import type { WebGLSceneAdapter } from "../../renderer/sceneObject";
import type { WebGLVideoSourceDescriptor } from "../../source/sourceDescriptor";
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

export type VideoRenderable = Renderable & {
  readonly fallbackVisible: boolean;
  readonly resourceReady: boolean;
};

type VideoRenderableOptions = {
  resourceManager: ResourceManager;
  sceneAdapter: WebGLSceneAdapter;
  measureElement(element: HTMLElement): ElementMeasurement;
  getViewportSize?(): DOMViewportSize;
  loadVideo?(source: WebGLVideoSourceDescriptor): Promise<HTMLVideoElement>;
};

export function createVideoRenderable(
  context: RenderableContext,
  options: VideoRenderableOptions,
): VideoRenderable {
  const source = readVideoSource(context.source);
  const resource = options.resourceManager.acquire<HTMLVideoElement>(source);
  const loadVideo = options.loadVideo ?? loadDomVideo;
  const state = {
    fallbackVisible: true,
    resourceReady: false,
    scene: undefined as SceneRenderableController | undefined,
  };
  const renderable = createRenderable(
    context,
    {
      async update() {
        const video = await resource.load(async () => loadVideo(source));
        state.scene ??= createTexturePlaneSceneRenderableController({
          key: context.descriptor.key,
          sceneAdapter: options.sceneAdapter,
          measureElement: options.measureElement,
          getViewportSize: options.getViewportSize,
          element: source.element,
          ordering: toSceneObjectOrdering(context.policy),
          textureKind: "video",
          textureSource: video,
        });
        state.scene.attach();
        state.fallbackVisible = false;
        state.resourceReady = true;
      },
      updateLayout(_context, _lifecycle, measurement) {
        state.scene?.updateLayout(measurement);
      },
      invalidateContent() {
        state.scene?.object.invalidateContent?.();
      },
      setVisible(visible) {
        if (!visible) {
          source.element.pause();
        }
        state.scene?.controller.setVisible(visible);
      },
      sceneObjectController() {
        return state.scene?.controller;
      },
      effectTarget() {
        return state.scene?.object.effectTarget;
      },
      dispose() {
        source.element.pause();
        state.scene?.controller.dispose();
        resource.dispose();
      },
    },
  );

  return Object.defineProperties(renderable, {
    fallbackVisible: {
      get() {
        return state.fallbackVisible;
      },
    },
    resourceReady: {
      get() {
        return state.resourceReady;
      },
    },
  }) as VideoRenderable;
}

function readVideoSource(
  source: RenderableContext["source"],
): WebGLVideoSourceDescriptor {
  if (source.kind !== "video") {
    throw new Error(`Expected video source descriptor, received ${source.kind}`);
  }

  return source;
}

async function loadDomVideo(
  source: WebGLVideoSourceDescriptor,
): Promise<HTMLVideoElement> {
  if (source.element.error) {
    throw new Error(readVideoErrorMessage(source.element.error));
  }

  if (source.element.readyState >= 2) {
    return source.element;
  }

  return new Promise<HTMLVideoElement>((resolve, reject) => {
    const cleanup = () => {
      source.element.removeEventListener("loadeddata", handleReady);
      source.element.removeEventListener("canplay", handleReady);
      source.element.removeEventListener("error", handleError);
    };
    const handleReady = () => {
      cleanup();
      resolve(source.element);
    };
    const handleError = () => {
      cleanup();
      reject(
        new Error(
          source.element.error
            ? readVideoErrorMessage(source.element.error)
            : "Video resource failed",
        ),
      );
    };

    source.element.addEventListener("loadeddata", handleReady, { once: true });
    source.element.addEventListener("canplay", handleReady, { once: true });
    source.element.addEventListener("error", handleError, { once: true });
  });
}

function readVideoErrorMessage(error: MediaError): string {
  if (error.message) {
    return error.message;
  }

  return `Video resource failed with code ${error.code}`;
}
