import type { ElementLayoutSnapshot } from "../renderer/layoutPass";
import { createTargetPointerState } from "../input/targetPointer";
import type { WebGLFrameInput, WebGLProgressSignalSource } from "../types";
import type {
  WebGLEffectContext,
  WebGLEffectRuntimeScope,
  WebGLRuntimePostprocessRequest,
  WebGLEffectResourceScope,
  WebGLEffectScopeSnapshot,
  WebGLEffectSourceHandle,
  WebGLEffectSourceKind,
  WebGLEffectTargetHandle,
  WebGLEffectVisualContext,
} from "./effectAuthoring";
import type { WebGLEffectObjectHandle } from "./effectObject";
import { createWebGLEffectObject } from "./effectObjectContext";

export type WebGLEffectContextOptions = {
  key: string;
  sourceKind: WebGLEffectSourceKind;
  layout: ElementLayoutSnapshot;
  input: WebGLFrameInput;
  source: WebGLEffectSourceHandle;
  target?: WebGLEffectTargetHandle;
  resources: WebGLEffectResourceScope;
  progressSignals?: WebGLProgressSignalSource;
  scopes?: WebGLEffectScopeSnapshot;
  visual?: WebGLEffectVisualContext;
  managedVisual?: WebGLEffectVisualContext;
  lights?: WebGLEffectObjectHandle["lights"];
};

const emptyProgressSignals: WebGLProgressSignalSource = {
  get() {
    return 0;
  },
};

const emptyVisualContext: WebGLEffectVisualContext = {
  requestPostprocess(_request: WebGLRuntimePostprocessRequest) {
    return {
      update() {},
      dispose() {},
    };
  },
};

export function createWebGLEffectContext(
  options: WebGLEffectContextOptions,
): WebGLEffectContext {
  const visual =
    options.managedVisual ??
    createResourceManagedVisualContext(options.visual, options.resources);

  const progress = createProgressSignals(options.progressSignals);
  const scopes = completeEffectScopes(
    options.scopes ?? { runtime: { progress } },
    visual,
  );

  return {
    key: options.key,
    sourceKind: options.sourceKind,
    layout: options.layout,
    input: options.input,
    pointer: options.input.pointer,
    targetPointer: createTargetPointerState(options.input, options.layout),
    scroll: options.input.scroll,
    scrollProgress: readScrollProgress(options.input.scroll),
    progress,
    runtime: scopes.runtime,
    ...(scopes.scene ? { scene: scopes.scene } : {}),
    time: options.input.time,
    delta: options.input.delta,
    object: createWebGLEffectObject({
      sourceKind: options.sourceKind,
      source: options.source,
      target: options.target,
      lights: options.lights,
    }),
    resources: options.resources,
  };
}

export function completeEffectScopes(
  scopes: WebGLEffectScopeSnapshot,
  visual: WebGLEffectVisualContext,
): WebGLEffectScopeSnapshot & { runtime: WebGLEffectRuntimeScope } {
  return {
    ...scopes,
    runtime: {
      ...scopes.runtime,
      postprocess: {
        request(request) {
          return visual.requestPostprocess(request);
        },
      },
    },
  };
}

export function createResourceManagedVisualContext(
  visual: WebGLEffectVisualContext | undefined,
  resources: WebGLEffectResourceScope,
): WebGLEffectVisualContext {
  const sourceVisual = visual ?? emptyVisualContext;

  return {
    requestPostprocess(request) {
      const handle = sourceVisual.requestPostprocess(request);
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
