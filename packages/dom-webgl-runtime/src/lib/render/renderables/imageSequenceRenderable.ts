import type { WebGLFrameInput, WebGLProgressSignalSource } from "../../types";
import type { DOMViewportSize } from "../../renderer/domProjection";
import type { ElementMeasurement } from "../../renderer/layoutPass";
import type { WebGLSceneAdapter } from "../../renderer/sceneObject";
import type { WebGLImageSequenceSourceDescriptor } from "../../source/sourceDescriptor";
import {
  createRenderable,
  type Renderable,
  type RenderableContext,
} from "../renderable";
import { toSceneObjectOrdering } from "../renderPolicy";
import {
  createImageSequenceFrameCache,
  type ImageSequenceFrameCache,
  type ImageSequenceTextureSource,
  formatImageSequenceFrameSrc,
} from "./imageSequenceFrameCache";
import type { SceneRenderableController } from "./sceneRenderableController";
import { createTexturePlaneSceneRenderableController } from "./sceneRenderableObject";

type ImageSequenceRenderableOptions = {
  readonly sceneAdapter: WebGLSceneAdapter;
  measureElement(element: HTMLElement): ElementMeasurement;
  getViewportSize?(): DOMViewportSize;
  readonly progressSignals?: WebGLProgressSignalSource;
  readonly createFrameCache?: (
    source: WebGLImageSequenceSourceDescriptor,
  ) => ImageSequenceFrameCache;
  readonly createSceneController?: (options: {
    readonly source: WebGLImageSequenceSourceDescriptor;
    readonly textureSource: ImageSequenceTextureSource;
  }) => SceneRenderableController;
};

export function createImageSequenceRenderable(
  context: RenderableContext,
  options: ImageSequenceRenderableOptions,
): Renderable {
  const source = readImageSequenceSource(context.source);
  const cache =
    options.createFrameCache?.(source) ??
    createImageSequenceFrameCache({
      frameCount: source.frameCount + source.startFrame - 1,
      frameSrc: source.frameSrc,
      preloadBefore: source.preloadBefore,
      preloadAfter: source.preloadAfter,
      maxCachedFrames: source.maxCachedFrames,
    });
  const state = {
    frame: 0,
    scene: undefined as SceneRenderableController | undefined,
    src: "",
  };

  const createScene =
    options.createSceneController ??
    ((sceneOptions: {
      readonly source: WebGLImageSequenceSourceDescriptor;
      readonly textureSource: ImageSequenceTextureSource;
    }) =>
      createTexturePlaneSceneRenderableController({
        key: context.descriptor.key,
        sceneAdapter: options.sceneAdapter,
        measureElement: options.measureElement,
        getViewportSize: options.getViewportSize,
        element: sceneOptions.source.anchor,
        ordering: toSceneObjectOrdering(context.policy),
        textureKind: "image",
        textureSource: sceneOptions.textureSource,
      }));

  return createRenderable(context, {
    async update(_context, _lifecycle, input) {
      const frame = selectFrame(source, input, options.progressSignals);
      const decodedFrame = await cache.read(frame);
      await cache.preloadAround(frame);

      state.scene ??= createScene({
        source,
        textureSource: decodedFrame.image,
      });
      state.scene.attach();
      state.scene.object.updateTextureSource?.(decodedFrame.image);
      state.frame = frame;
      state.src = formatImageSequenceFrameSrc(source.frameSrc, frame);
    },
    updateLayout(_context, _lifecycle, measurement) {
      state.scene?.updateLayout(measurement);
    },
    invalidateContent() {
      state.scene?.object.invalidateContent?.();
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
      return {
        kind: "image-sequence",
        element: source.anchor,
        frame: state.frame,
        src: state.src,
        image: state.scene?.object.textureLayerCapability,
      };
    },
    dispose() {
      state.scene?.controller.dispose();
      cache.dispose();
    },
  });
}

function readImageSequenceSource(
  source: RenderableContext["source"],
): WebGLImageSequenceSourceDescriptor {
  if (source.kind !== "image-sequence") {
    throw new Error(`Expected image-sequence source descriptor, received ${source.kind}`);
  }

  return source;
}

function selectFrame(
  source: WebGLImageSequenceSourceDescriptor,
  input: WebGLFrameInput,
  progressSignals?: WebGLProgressSignalSource,
): number {
  const progress = source.progressKey
    ? progressSignals?.get(source.progressKey) ?? 0
    : readScrollProgress(input);

  return source.startFrame + Math.round(clampProgress(progress) * (source.frameCount - 1));
}

function readScrollProgress(input: WebGLFrameInput): number {
  switch (input.scroll.mode) {
    case "gate":
      return input.scroll.sceneProgress;
    case "page":
      return input.scroll.pageProgress;
  }
}

function clampProgress(progress: number): number {
  return Math.max(0, Math.min(1, progress));
}
