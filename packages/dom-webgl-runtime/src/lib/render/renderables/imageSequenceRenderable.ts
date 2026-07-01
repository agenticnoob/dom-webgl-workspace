import type { WebGLFrameInput, WebGLProgressSignalSource } from "../../types";
import type {
  DOMViewportSize,
  ProjectedDOMRect,
} from "../../renderer/domProjection";
import type { ElementMeasurement } from "../../renderer/layoutPass";
import type { WebGLSceneAdapter } from "../../renderer/sceneObject";
import type { WebGLMediaImageSequenceSourceDescriptor } from "../../source/sourceDescriptor";
import {
  createRenderable,
  readManagedObjectOrdering,
  readRenderableOrdering,
  type Renderable,
  type RenderableContext,
} from "../renderable";
import type { SceneRenderableController } from "./sceneRenderableController";
import { createTexturePlaneSceneRenderableController } from "./sceneRenderableObject";
import type { WebGLImageSequenceFrame } from "../../types";

type ImageSequenceRenderableOptions = {
  readonly sceneAdapter: WebGLSceneAdapter;
  measureElement(element: HTMLElement): ElementMeasurement;
  getViewportSize?(): DOMViewportSize;
  projectLayout?(
    measurement: ElementMeasurement,
    viewport: DOMViewportSize,
  ): ProjectedDOMRect;
  readonly progressSignals?: WebGLProgressSignalSource;
  requestTextureFrame?(): void;
  readonly createSceneController?: (options: {
    readonly source: WebGLMediaImageSequenceSourceDescriptor;
    readonly textureSource: WebGLImageSequenceFrame;
  }) => SceneRenderableController;
};

export function createImageSequenceRenderable(
  context: RenderableContext,
  options: ImageSequenceRenderableOptions,
): Renderable {
  const source = readImageSequenceSource(context.source);
  const state = {
    frame: 0,
    scene: undefined as SceneRenderableController | undefined,
    src: "",
  };

  const createScene =
    options.createSceneController ??
    ((sceneOptions: {
      readonly source: WebGLMediaImageSequenceSourceDescriptor;
      readonly textureSource: WebGLImageSequenceFrame;
    }) =>
      createTexturePlaneSceneRenderableController({
        key: context.descriptor.key,
        sceneAdapter: options.sceneAdapter,
        measureElement: options.measureElement,
        getViewportSize: options.getViewportSize,
        projectLayout: options.projectLayout,
        element: sceneOptions.source.anchor,
        ordering: readRenderableOrdering(context),
        getManagedObjectOrdering: () => readManagedObjectOrdering(context),
        textureKind: "image",
        textureSource: sceneOptions.textureSource,
        requestTextureFrame: options.requestTextureFrame,
      }));

  return createRenderable(context, {
    update(_context, _lifecycle, input) {
      const frame = selectFrame(source, input, options.progressSignals);
      const textureSource = readFrame(source, frame);

      if (!state.scene) {
        applyFrame(frame, textureSource);
        return;
      }

      if (frame !== state.frame) {
        applyFrame(frame, textureSource);
      }
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
        kind: "media",
        type: "image-sequence",
        element: source.anchor,
        frame: state.frame,
        src: state.src,
        image: state.scene?.object.textureLayerCapability,
      };
    },
    inspectTextureTelemetry() {
      return state.scene?.object.inspectTextureTelemetry?.() ?? [];
    },
    dispose() {
      state.scene?.controller.dispose();
    },
  });

  function applyFrame(frame: number, image: WebGLImageSequenceFrame): void {
    state.scene ??= createScene({
      source,
      textureSource: image,
    });
    state.scene.attach();
    state.scene.object.updateTextureSource?.(image);
    state.frame = frame;
    state.src = readFrameSrc(image);
  }
}

function readImageSequenceSource(
  source: RenderableContext["source"],
): WebGLMediaImageSequenceSourceDescriptor {
  if (source.kind !== "media" || source.type !== "image-sequence") {
    throw new Error(
      `Expected media/image-sequence source descriptor, received ${source.kind}/${source.type}`,
    );
  }

  return source;
}

function selectFrame(
  source: WebGLMediaImageSequenceSourceDescriptor,
  input: WebGLFrameInput,
  progressSignals?: WebGLProgressSignalSource,
): number {
  const progress = source.progressKey
    ? progressSignals?.get(source.progressKey) ?? 0
    : readScrollProgress(input);

  return source.startFrame + Math.round(clampProgress(progress) * (source.frameCount - 1));
}

function readFrame(
  source: WebGLMediaImageSequenceSourceDescriptor,
  frame: number,
): WebGLImageSequenceFrame {
  return source.frames[frame - source.startFrame] ?? source.frames[0];
}

function readFrameSrc(frame: WebGLImageSequenceFrame): string {
  if (frame instanceof HTMLImageElement) {
    return frame.currentSrc || frame.src;
  }

  return "";
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
