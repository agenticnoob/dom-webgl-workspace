import type { ResourceManager } from "../../resources/resourceManager";
import type { Object3D } from "three/src/core/Object3D.js";
import { Group } from "three/src/objects/Group.js";
import type { DOMViewportSize } from "../../renderer/domProjection";
import type { ElementMeasurement } from "../../renderer/layoutPass";
import type { WebGLSceneAdapter } from "../../renderer/sceneObject";
import type { WebGLModelSourceDescriptor } from "../../source/sourceDescriptor";
import type { WebGLModelEffectHandle } from "../../effects/effectAuthoring";
import {
  createRenderable,
  readManagedObjectOrdering,
  readRenderableOrdering,
  type Renderable,
  type RenderableContext,
} from "../renderable";
import {
  createModelSceneRenderableController,
  type SceneRenderableController,
} from "./sceneRenderableObject";
import { createModelEffectHandle } from "./modelEffectHandle";

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
    modelHandle: undefined as WebGLModelEffectHandle | undefined,
  };
  const renderable = createRenderable(
    context,
    {
      async update() {
        const model = await resource.load(async () => loadModel(source));

        if (!state.scene) {
          const modelObject3D = instantiateModelSceneObject(model);
          const targetRoot = createModelTargetRoot(modelObject3D);
          state.modelHandle = createModelEffectHandle(modelObject3D);
          state.scene = createModelSceneRenderableController({
            key: context.descriptor.key,
            sceneAdapter: options.sceneAdapter,
            measureElement: options.measureElement,
            getViewportSize: options.getViewportSize,
            element: source.anchor,
            object3D: targetRoot,
            ordering: readRenderableOrdering(context),
            getManagedObjectOrdering: () => readManagedObjectOrdering(context),
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
      effectTarget() {
        return state.scene?.object.effectTarget;
      },
      effectSource() {
        if (!state.modelHandle) {
          return undefined;
        }

        return {
          kind: "model",
          type: "glb",
          anchor: source.anchor,
          src: source.src,
          model: state.modelHandle,
        };
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

function createModelTargetRoot(modelScene: unknown): unknown {
  const group = new Group() as Group & { dispose?: () => void };

  if (isObject3D(modelScene)) {
    group.add(modelScene);
  }
  group.dispose = () => {
    disposeModelSceneObject(modelScene);
  };

  return group;
}

function disposeModelSceneObject(modelScene: unknown): void {
  if (!modelScene || typeof modelScene !== "object") {
    return;
  }

  const dispose = (modelScene as { dispose?: unknown }).dispose;
  if (typeof dispose === "function") {
    dispose.call(modelScene);
  }
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

function isObject3D(object: unknown): object is Object3D {
  return (
    !!object &&
    typeof object === "object" &&
    "isObject3D" in object &&
    (object as { isObject3D?: unknown }).isObject3D === true
  );
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
    throw new Error(
      `Expected model/glb source descriptor, received ${readSourceKind(source)}`,
    );
  }

  if (readSourceType(source) !== "glb") {
    throw new Error(
      `Expected model/glb source descriptor, received ${readSourceKind(source)}`,
    );
  }

  return source;
}

function readSourceKind(source: RenderableContext["source"]): string {
  return `${source.kind}/${readSourceType(source)}`;
}

function readSourceType(source: RenderableContext["source"]): string {
  if (source && typeof source === "object" && "type" in source) {
    return String(source.type);
  }

  return String(source);
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
