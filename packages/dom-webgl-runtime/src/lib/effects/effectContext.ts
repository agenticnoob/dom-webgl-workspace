import type { ElementLayoutSnapshot } from "../renderer/layoutPass";
import type { WebGLFrameInput } from "../types";
import type {
  WebGLEffectContext,
  WebGLEffectResourceScope,
  WebGLEffectSourceHandle,
  WebGLEffectTargetHandle,
} from "./effectAuthoring";
import type { WebGLEffectSourceKind } from "./effectPlugin";

export type WebGLEffectContextOptions = {
  key: string;
  sourceKind: WebGLEffectSourceKind;
  layout: ElementLayoutSnapshot;
  input: WebGLFrameInput;
  source: WebGLEffectSourceHandle;
  target?: WebGLEffectTargetHandle;
  resources: WebGLEffectResourceScope;
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
    time: options.input.time,
    delta: options.input.delta,
    source: options.source,
    target: options.target,
    resources: options.resources,
  };
}

function readScrollProgress(input: WebGLFrameInput["scroll"]): number {
  return input.mode === "gate" ? input.sceneProgress : input.pageProgress;
}
