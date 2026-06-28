import type { ResourceManager } from "../../resources/resourceManager";
import type { DOMViewportSize } from "../../renderer/domProjection";
import type { ElementMeasurement } from "../../renderer/layoutPass";
import type { WebGLSceneAdapter } from "../../renderer/sceneObject";
import type { WebGLMediaVideoSourceDescriptor } from "../../source/sourceDescriptor";
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

export type VideoRenderable = Renderable & {
  readonly fallbackVisible: boolean;
  readonly resourceReady: boolean;
};

type VideoRenderableOptions = {
  resourceManager: ResourceManager;
  sceneAdapter: WebGLSceneAdapter;
  measureElement(element: HTMLElement): ElementMeasurement;
  getViewportSize?(): DOMViewportSize;
  loadVideo?(source: WebGLMediaVideoSourceDescriptor): Promise<HTMLVideoElement>;
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
    video: undefined as HTMLVideoElement | undefined,
  };
  const renderable = createRenderable(
    context,
    {
      async update() {
        const video = await resource.load(async () => loadVideo(source));
        state.video = video;
        state.scene ??= createTexturePlaneSceneRenderableController({
          key: context.descriptor.key,
          sceneAdapter: options.sceneAdapter,
          measureElement: options.measureElement,
          getViewportSize: options.getViewportSize,
          element: source.anchor,
          ordering: readRenderableOrdering(context),
          getManagedObjectOrdering: () => readManagedObjectOrdering(context),
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
          state.video?.pause();
        }
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
          type: "video",
          element: source.anchor,
          src: source.src,
          video: state.scene?.object.videoLayerCapability,
        };
      },
      dispose() {
        state.video?.pause();
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
): WebGLMediaVideoSourceDescriptor {
  if (source.kind !== "media" || source.type !== "video") {
    throw new Error(
      `Expected media/video source descriptor, received ${readSourceKind(source)}`,
    );
  }

  return source;
}

function readSourceKind(source: RenderableContext["source"]): string {
  return `${source.kind}/${source.type}`;
}

function createVideoElement(source: WebGLMediaVideoSourceDescriptor): HTMLVideoElement {
  const video = source.element ?? document.createElement("video");

  if (!source.element) {
    video.src = source.src;
  }

  const playback = source.playback;
  if (playback) {
    if (typeof playback.muted === "boolean") {
      video.muted = playback.muted;
    }
    if (typeof playback.loop === "boolean") {
      video.loop = playback.loop;
    }
    if (typeof playback.autoplay === "boolean") {
      video.autoplay = playback.autoplay;
    }
    if (typeof playback.playsInline === "boolean") {
      video.playsInline = playback.playsInline;
    }
    if (typeof playback.playbackRate === "number") {
      video.playbackRate = playback.playbackRate;
    }
  }

  return video;
}

async function loadDomVideo(
  source: WebGLMediaVideoSourceDescriptor,
): Promise<HTMLVideoElement> {
  const video = createVideoElement(source);

  if (video.error) {
    throw new Error(readVideoErrorMessage(video.error));
  }

  if (video.readyState >= 2) {
    return video;
  }

  return new Promise<HTMLVideoElement>((resolve, reject) => {
    const cleanup = () => {
      video.removeEventListener("loadeddata", handleReady);
      video.removeEventListener("canplay", handleReady);
      video.removeEventListener("error", handleError);
    };
    const handleReady = () => {
      cleanup();
      resolve(video);
    };
    const handleError = () => {
      cleanup();
      reject(
        new Error(
          video.error
            ? readVideoErrorMessage(video.error)
            : "Video resource failed",
        ),
      );
    };

    video.addEventListener("loadeddata", handleReady, { once: true });
    video.addEventListener("canplay", handleReady, { once: true });
    video.addEventListener("error", handleError, { once: true });
    if (!source.element) {
      video.load();
    }
  });
}

function readVideoErrorMessage(error: MediaError): string {
  if (error.message) {
    return error.message;
  }

  return `Video resource failed with code ${error.code}`;
}
