import type { TargetDescriptor } from "../dom/targetDescriptor";
import type { ResourceManager } from "../resources/resourceManager";
import type { DOMViewportSize } from "../renderer/domProjection";
import type { WebGLSceneAdapter } from "../renderer/sceneObject";
import type {
  WebGLModelSourceDescriptor,
  WebGLSourceDescriptor,
  WebGLVideoSourceDescriptor,
} from "../source/sourceDescriptor";
import type { WebGLProgressSignalSource, WebGLRenderRole } from "../types";
import type { Renderable } from "./renderable";
import type { RenderPolicy } from "./renderPolicy";
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
  loadVideo?(source: WebGLVideoSourceDescriptor): Promise<HTMLVideoElement>;
  loadModel?(source: WebGLModelSourceDescriptor): Promise<unknown>;
  progressSignals?: WebGLProgressSignalSource;
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
  };

  switch (sourceDescriptor.kind) {
    case "snapshot":
      if (sourceDescriptor.mode === "element") {
        return createElementSnapshotRenderable(renderableContext, {
          sceneAdapter: context.sceneAdapter,
          measureElement: context.measureElement,
          getViewportSize: context.getViewportSize,
        });
      }

      if (sourceDescriptor.mode === "text") {
        return createTextSnapshotRenderable(renderableContext, {
          sceneAdapter: context.sceneAdapter,
          measureElement: context.measureElement,
          getViewportSize: context.getViewportSize,
        });
      }

      throwUnsupportedSourceDescriptor(sourceDescriptor);
    case "image":
      return createImageRenderable(renderableContext, {
        resourceManager: context.resourceManager,
        sceneAdapter: context.sceneAdapter,
        measureElement: context.measureElement,
        getViewportSize: context.getViewportSize,
      });
    case "video":
      return createVideoRenderable(renderableContext, {
        resourceManager: context.resourceManager,
        sceneAdapter: context.sceneAdapter,
        measureElement: context.measureElement,
        getViewportSize: context.getViewportSize,
        loadVideo: context.loadVideo,
      });
    case "image-sequence":
      return createImageSequenceRenderable(renderableContext, {
        sceneAdapter: context.sceneAdapter,
        measureElement: context.measureElement,
        getViewportSize: context.getViewportSize,
        progressSignals: context.progressSignals,
      });
    case "model":
      if (sourceDescriptor.format === "glb") {
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
  if (sourceDescriptor.kind === "snapshot") {
    return `snapshot/${sourceDescriptor.mode}`;
  }

  if (sourceDescriptor.kind === "model") {
    return `model/${sourceDescriptor.format}`;
  }

  return sourceDescriptor.kind;
}
