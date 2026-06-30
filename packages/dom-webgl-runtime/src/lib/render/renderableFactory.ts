import type { TargetDescriptor } from "../dom/targetDescriptor";
import type { ResourceManager } from "../resources/resourceManager";
import type { DOMViewportSize } from "../renderer/domProjection";
import type { WebGLSceneAdapter } from "../renderer/sceneObject";
import type {
  WebGLMediaVideoSourceDescriptor,
  WebGLModelSourceDescriptor,
  WebGLSourceDescriptor,
} from "../source/sourceDescriptor";
import type { WebGLProgressSignalSource, WebGLRenderRole } from "../types";
import type { Renderable } from "./renderable";
import {
  compileRenderPolicy,
  type RenderPolicy,
  type SceneObjectOrdering,
  toSceneObjectOrdering,
} from "./renderPolicy";
import { createElementSnapshotRenderable } from "./renderables/elementSnapshotRenderable";
import { createImageRenderable } from "./renderables/imageRenderable";
import { createImageSequenceRenderable } from "./renderables/imageSequenceRenderable";
import { createModelRenderable } from "./renderables/modelRenderable";
import { createTextSnapshotRenderable } from "./renderables/textSnapshotRenderable";
import { createVideoRenderable } from "./renderables/videoRenderable";

type ElementMeasurement = {
  x: number;
  y: number;
  width: number;
  height: number;
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type RenderableFactoryContext = {
  resourceManager: ResourceManager;
  sceneAdapter: WebGLSceneAdapter;
  measureElement(element: HTMLElement): ElementMeasurement;
  getViewportSize?(): DOMViewportSize;
  loadVideo?(source: WebGLMediaVideoSourceDescriptor): Promise<HTMLVideoElement>;
  loadModel?(source: WebGLModelSourceDescriptor): Promise<unknown>;
  progressSignals?: WebGLProgressSignalSource;
  requestTextureFrame?(): void;
  getOrdering?(
    descriptor: TargetDescriptor,
    policy: RenderPolicy,
  ): SceneObjectOrdering;
  getManagedObjectOrdering?(
    descriptor: TargetDescriptor,
  ): SceneObjectOrdering;
};

export function createRenderable(
  targetDescriptor: TargetDescriptor,
  sourceDescriptor: WebGLSourceDescriptor,
  role: WebGLRenderRole,
  policy: RenderPolicy,
  context: RenderableFactoryContext,
): Renderable {
  const renderableContext = {
    descriptor: targetDescriptor,
    source: sourceDescriptor,
    role,
    policy,
    getOrdering: () =>
      context.getOrdering?.(targetDescriptor, policy) ??
      toSceneObjectOrdering(policy),
    getManagedObjectOrdering: () =>
      context.getManagedObjectOrdering?.(targetDescriptor) ??
      toSceneObjectOrdering(compileRenderPolicy("overlay")),
  };

  switch (sourceDescriptor.kind) {
    case "dom":
      if (sourceDescriptor.type === "element") {
        return createElementSnapshotRenderable(renderableContext, {
          sceneAdapter: context.sceneAdapter,
          measureElement: context.measureElement,
          getViewportSize: context.getViewportSize,
          requestTextureFrame: context.requestTextureFrame,
        });
      }

      return createTextSnapshotRenderable(renderableContext, {
        sceneAdapter: context.sceneAdapter,
        measureElement: context.measureElement,
        getViewportSize: context.getViewportSize,
        requestTextureFrame: context.requestTextureFrame,
      });
    case "media":
      if (sourceDescriptor.type === "image") {
        return createImageRenderable(renderableContext, {
          resourceManager: context.resourceManager,
          sceneAdapter: context.sceneAdapter,
          measureElement: context.measureElement,
          getViewportSize: context.getViewportSize,
          requestTextureFrame: context.requestTextureFrame,
        });
      }

      if (sourceDescriptor.type === "video") {
        return createVideoRenderable(renderableContext, {
          resourceManager: context.resourceManager,
          sceneAdapter: context.sceneAdapter,
          measureElement: context.measureElement,
          getViewportSize: context.getViewportSize,
          loadVideo: context.loadVideo,
          requestTextureFrame: context.requestTextureFrame,
        });
      }

      return createImageSequenceRenderable(renderableContext, {
        sceneAdapter: context.sceneAdapter,
        measureElement: context.measureElement,
        getViewportSize: context.getViewportSize,
        progressSignals: context.progressSignals,
        requestTextureFrame: context.requestTextureFrame,
      });
    case "model":
      return createModelRenderable(renderableContext, {
        resourceManager: context.resourceManager,
        sceneAdapter: context.sceneAdapter,
        measureElement: context.measureElement,
        getViewportSize: context.getViewportSize,
        loadModel: context.loadModel,
      });
  }

  throwUnsupportedSourceDescriptor(sourceDescriptor);
}

function throwUnsupportedSourceDescriptor(
  sourceDescriptor: WebGLSourceDescriptor,
): never {
  throw new Error(
    `Unsupported WebGL source descriptor kind: ${readSourceDescriptorKind(
      sourceDescriptor,
    )}`,
  );
}

function readSourceDescriptorKind(sourceDescriptor: WebGLSourceDescriptor): string {
  return `${sourceDescriptor.kind}/${sourceDescriptor.type}`;
}
