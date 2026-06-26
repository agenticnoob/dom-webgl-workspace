import type { ElementLayoutSnapshot } from "../renderer/layoutPass";
import type { WebGLFrameInput, WebGLProgressSignalSource } from "../types";
import type {
  WebGLEffectContext,
  WebGLEffectResourceScope,
  WebGLEffectSourceHandle,
  WebGLEffectSourceKind,
  WebGLEffectTargetHandle,
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
};

const emptyProgressSignals: WebGLProgressSignalSource = {
  get() {
    return 0;
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
    scroll: options.input.scroll,
    scrollProgress: readScrollProgress(options.input.scroll),
    progress: createProgressSignals(options.progressSignals),
    time: options.input.time,
    delta: options.input.delta,
    source: options.source,
    target: options.target,
    resources: options.resources,
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
