import type { ResourceManager } from "../../resources/resourceManager";
import { loadGLBModel } from "../../assets/modelLoader";
import type {
  DOMViewportSize,
  ProjectedDOMRect,
} from "../../renderer/domProjection";
import type { ElementMeasurement } from "../../renderer/layoutPass";
import type { WebGLSceneAdapter } from "../../renderer/sceneObject";
import type { WebGLModelSourceDescriptor } from "../../source/sourceDescriptor";
import type { WebGLModelEffectHandle } from "../../effects/effectAuthoring";
import type { WebGLModelLoaderDeclaration } from "../../types";
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
import {
  createModelAnimationController,
  type ModelAnimationController,
} from "./modelAnimationControls";
import { createModelEffectHandle } from "./modelEffectHandle";
import {
  createModelRuntimeRoot,
  instantiateModelSceneObject,
} from "./modelSceneObjects";

export type ModelRenderable = Renderable & {
  readonly fallbackVisible: boolean;
  readonly resourceReady: boolean;
};

type ModelRenderableOptions = {
  resourceManager: ResourceManager;
  sceneAdapter: WebGLSceneAdapter;
  measureElement(element: HTMLElement): ElementMeasurement;
  getViewportSize?(): DOMViewportSize;
  projectLayout?(
    measurement: ElementMeasurement,
    viewport: DOMViewportSize,
  ): ProjectedDOMRect;
  loadModel?(source: WebGLModelSourceDescriptor): Promise<unknown>;
  modelLoader?: WebGLModelLoaderDeclaration;
};

export function createModelRenderable(
  context: RenderableContext,
  options: ModelRenderableOptions,
): ModelRenderable {
  const source = readModelSource(context.source);
  const resource = options.resourceManager.acquire<unknown>(source);
  const loadModel =
    options.loadModel ??
    ((modelSource: WebGLModelSourceDescriptor) =>
      loadGLBModel(modelSource, { runtimeLoader: options.modelLoader }));
  const state = {
    fallbackVisible: true,
    resourceReady: false,
    scene: undefined as SceneRenderableController | undefined,
    modelHandle: undefined as WebGLModelEffectHandle | undefined,
    animation: undefined as ModelAnimationController | undefined,
    visible: true,
  };
  const renderable = createRenderable(
    context,
    {
      async update(_context, _lifecycle, input) {
        const model = await resource.load(async () => loadModel(source));

        if (!state.scene) {
          const modelObject3D = instantiateModelSceneObject(model);
          const targetRoot = createModelRuntimeRoot(modelObject3D);
          state.animation = createModelAnimationController(model);
          state.modelHandle = createModelEffectHandle(modelObject3D, {
            animation: state.animation,
          });
          state.scene = createModelSceneRenderableController({
            key: context.descriptor.key,
            sceneAdapter: options.sceneAdapter,
            measureElement: options.measureElement,
            getViewportSize: options.getViewportSize,
            projectLayout: options.projectLayout,
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
        updateModelAnimation(input);
      },
      updateLayout(_context, _lifecycle, measurement) {
        state.scene?.updateLayout(measurement);
      },
      setVisible(visible) {
        state.visible = visible;
        state.scene?.controller.setVisible(visible);
      },
      shouldRenderContinuously() {
        return state.visible && state.animation !== undefined;
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
        state.animation?.dispose();
        state.scene?.controller.dispose();
        resource.dispose();
      },
    },
  );

  function updateModelAnimation(input: { delta: number }): void {
    if (!state.visible || !state.animation) {
      return;
    }

    state.animation.update(input.delta);
  }

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
