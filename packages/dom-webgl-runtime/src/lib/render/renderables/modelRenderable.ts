import type { ResourceManager } from "../../resources/resourceManager";
import type { Object3D } from "three/src/core/Object3D.js";
import { Group } from "three/src/objects/Group.js";
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
  projectLayout?(
    measurement: ElementMeasurement,
    viewport: DOMViewportSize,
  ): ProjectedDOMRect;
  loadModel?(source: WebGLModelSourceDescriptor): Promise<unknown>;
  modelLoader?: WebGLModelLoaderDeclaration;
};

type ModelAnimationMixer = {
  update(deltaSeconds: number): void;
};

type ModelAnimationDriver = {
  update(deltaMilliseconds: number): void;
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
    animation: undefined as ModelAnimationDriver | undefined,
    visible: true,
  };
  const renderable = createRenderable(
    context,
    {
      async update(_context, _lifecycle, input) {
        const model = await resource.load(async () => loadModel(source));

        if (!state.scene) {
          const modelObject3D = instantiateModelSceneObject(model);
          const targetRoot = createModelTargetRoot(modelObject3D);
          state.modelHandle = createModelEffectHandle(modelObject3D);
          state.animation = createModelAnimationDriver(model);
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

function createModelAnimationDriver(
  model: unknown,
): ModelAnimationDriver | undefined {
  const mixer = readModelAnimationMixer(model);

  if (!mixer || !hasModelAnimationClips(model)) {
    return undefined;
  }

  return {
    update(deltaMilliseconds) {
      mixer.update(Math.max(0, deltaMilliseconds) / 1000);
    },
  };
}

function readModelAnimationMixer(
  model: unknown,
): ModelAnimationMixer | undefined {
  if (!model || typeof model !== "object") {
    return undefined;
  }

  const mixer = (model as { mixer?: unknown }).mixer;
  if (!mixer || typeof mixer !== "object") {
    return undefined;
  }

  const update = (mixer as { update?: unknown }).update;
  if (typeof update !== "function") {
    return undefined;
  }

  return {
    update(deltaSeconds) {
      update.call(mixer, deltaSeconds);
    },
  };
}

function hasModelAnimationClips(model: unknown): boolean {
  if (!model || typeof model !== "object") {
    return false;
  }

  const animations = (model as { animations?: unknown }).animations;

  return Array.isArray(animations) && animations.length > 0;
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
