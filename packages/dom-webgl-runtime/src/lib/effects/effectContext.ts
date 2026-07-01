import type { ElementLayoutSnapshot } from "../renderer/layoutPass";
import { createTargetPointerState } from "../input/targetPointer";
import type { WebGLFrameInput, WebGLProgressSignalSource } from "../types";
import type {
  WebGLEffectContext,
  WebGLEffectPostprocessRequest,
  WebGLEffectResourceScope,
  WebGLEffectSourceHandle,
  WebGLEffectSourceKind,
  WebGLEffectTargetHandle,
  WebGLEffectVisualContext,
} from "./effectAuthoring";

export type WebGLEffectContextOptions = {
  key: string;
  sourceKind: WebGLEffectSourceKind;
  layout: ElementLayoutSnapshot;
  input: WebGLFrameInput;
  source: WebGLEffectSourceHandle;
  target?: WebGLEffectTargetHandle;
  resources: WebGLEffectResourceScope;
  progressSignals?: WebGLProgressSignalSource;
  visual?: WebGLEffectVisualContext;
};

const emptyProgressSignals: WebGLProgressSignalSource = {
  get() {
    return 0;
  },
};

const emptyVisualContext: WebGLEffectVisualContext = {
  requestPostprocess(_request: WebGLEffectPostprocessRequest) {
    return {
      update() {},
      dispose() {},
    };
  },
};

export function createWebGLEffectContext(
  options: WebGLEffectContextOptions,
): WebGLEffectContext {
  return {
    key: options.key,
    sourceKind: options.sourceKind,
    layout: options.layout,
    input: options.input,
    pointer: options.input.pointer,
    targetPointer: createTargetPointerState(options.input, options.layout),
    scroll: options.input.scroll,
    scrollProgress: readScrollProgress(options.input.scroll),
    progress: createProgressSignals(options.progressSignals),
    visual: createResourceManagedVisualContext(
      options.visual ?? emptyVisualContext,
      options.resources,
    ),
    time: options.input.time,
    delta: options.input.delta,
    source: options.source,
    target: options.target,
    resources: options.resources,
  };
}

function createResourceManagedVisualContext(
  visual: WebGLEffectVisualContext,
  resources: WebGLEffectResourceScope,
): WebGLEffectVisualContext {
  return {
    requestPostprocess(request) {
      const handle = visual.requestPostprocess(request);
      resources.addDisposable(() => {
        handle.dispose();
      });
      return handle;
    },
  };
}

export function readScrollProgress(input: WebGLFrameInput["scroll"]): number {
  return input.mode === "gate" ? input.sceneProgress : input.pageProgress;
}

function createProgressSignals(
  progressSignals: WebGLProgressSignalSource | undefined,
): WebGLProgressSignalSource {
  if (!progressSignals) {
    return emptyProgressSignals;
  }

  return {
    get(key) {
      return progressSignals.get(key);
    },
  };
}
