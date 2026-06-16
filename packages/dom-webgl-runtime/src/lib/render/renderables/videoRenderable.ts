import type { ResourceManager } from "../../resources/resourceManager";
import type { WebGLVideoSourceDescriptor } from "../../source/sourceDescriptor";
import {
  createRenderable,
  type Renderable,
  type RenderableContext,
} from "../renderable";

export type VideoRenderable = Renderable & {
  readonly fallbackVisible: boolean;
  readonly resourceReady: boolean;
};

type VideoRenderableOptions = {
  resourceManager: ResourceManager;
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
  };
  const renderable = createRenderable(
    context,
    {
      async update() {
        await resource.load(async () => loadVideo(source));
        state.fallbackVisible = false;
        state.resourceReady = true;
      },
      setVisible(visible) {
        if (!visible) {
          source.element.pause();
        }
      },
      dispose() {
        source.element.pause();
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
