import type { ResourceManager } from "../../resources/resourceManager";
import type { DOMViewportSize } from "../../renderer/domProjection";
import type { ElementMeasurement } from "../../renderer/layoutPass";
import type { WebGLSceneAdapter } from "../../renderer/sceneObject";
import type { WebGLModelSourceDescriptor } from "../../source/sourceDescriptor";
import {
  createRenderable,
  type Renderable,
  type RenderableContext,
} from "../renderable";
import { toSceneObjectOrdering } from "../renderPolicy";
import {
  createSceneRenderableController,
  type SceneRenderableController,
} from "./sceneRenderableObject";

export type ModelRenderable = Renderable & {
  readonly fallbackVisible: boolean;
  readonly resourceReady: boolean;
};

type ModelRenderableOptions = {
  resourceManager: ResourceManager;
  sceneAdapter: WebGLSceneAdapter;
  measureElement(element: HTMLElement): ElementMeasurement;
  getViewportSize?(): DOMViewportSize;
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
    scene: undefined as SceneRenderableController | undefined,
  };
  const renderable = createRenderable(
    context,
    {
      async update() {
        const model = await resource.load(async () => loadModel(source));

        if (!state.scene) {
          state.scene = createSceneRenderableController({
            key: context.descriptor.key,
            sceneAdapter: options.sceneAdapter,
            measureElement: options.measureElement,
            getViewportSize: options.getViewportSize,
            element: source.anchor,
            object3D: instantiateModelSceneObject(model),
            ordering: toSceneObjectOrdering(context.policy),
            disposeObject3D: true,
          });
        }

        state.scene.attach();
        state.fallbackVisible = false;
        state.resourceReady = true;
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

function instantiateModelSceneObject(model: unknown): unknown {
  const sceneObject = readModelSceneObject(model);

  if (
    sceneObject &&
    typeof sceneObject === "object" &&
    "clone" in sceneObject &&
    typeof (sceneObject as { clone?: unknown }).clone === "function"
  ) {
    return (sceneObject as { clone: () => unknown }).clone();
  }

  return sceneObject;
}

function readModelSceneObject(model: unknown): unknown {
  if (
    model &&
    typeof model === "object" &&
    "scene" in model &&
    (model as { scene?: unknown }).scene
  ) {
    return (model as { scene: unknown }).scene;
  }

  return model;
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
