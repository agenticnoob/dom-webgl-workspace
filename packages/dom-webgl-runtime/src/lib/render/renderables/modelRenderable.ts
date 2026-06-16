import type { ResourceManager } from "../../resources/resourceManager";
import type { WebGLModelSourceDescriptor } from "../../source/sourceDescriptor";
import {
  createRenderable,
  type Renderable,
  type RenderableContext,
} from "../renderable";

export type ModelRenderable = Renderable & {
  readonly fallbackVisible: boolean;
  readonly resourceReady: boolean;
};

type ModelRenderableOptions = {
  resourceManager: ResourceManager;
  loadModel?(source: WebGLModelSourceDescriptor): Promise<unknown>;
};

type GLTFLoaderConstructor = new () => {
  loadAsync(src: string): Promise<unknown>;
};

export function createModelRenderable(
  context: RenderableContext,
  options: ModelRenderableOptions,
): ModelRenderable {
  const source = readModelSource(context.source);
  const resource = options.resourceManager.acquire<unknown>(source);
  const loadModel = options.loadModel ?? loadModelWithDefaultAdapter;
  const state = {
    fallbackVisible: true,
    resourceReady: false,
  };
  const renderable = createRenderable(
    context,
    {
      async update() {
        await resource.load(async () => loadModel(source));
        state.fallbackVisible = false;
        state.resourceReady = true;
      },
      dispose() {
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
  }) as ModelRenderable;
}

function readModelSource(
  source: RenderableContext["source"],
): WebGLModelSourceDescriptor {
  if (source.kind !== "model") {
    throw new Error(`Expected model source descriptor, received ${source.kind}`);
  }

  if (source.format !== "glb") {
    throw new Error(`Expected GLB model source descriptor, received ${source.format}`);
  }

  return source;
}

async function loadModelWithDefaultAdapter(
  source: WebGLModelSourceDescriptor,
): Promise<unknown> {
  const { GLTFLoader } = (await import(
    "three/addons/loaders/GLTFLoader.js"
  )) as { GLTFLoader: GLTFLoaderConstructor };
  const loader = new GLTFLoader();

  return loader.loadAsync(source.src);
}
