import type {
  WebGLEffectResourceScope,
  WebGLEffectSourceHandle,
  WebGLEffectSourceKind,
  WebGLEffectTargetHandle,
  WebGLEffectVisualContext,
} from "./effectAuthoring";
import type { WebGLEffectObjectHandle } from "./effectObject";
import { createEffectObjectCapabilities } from "./effectObjectCapabilities";
import { createEffectObjectTransform } from "./effectObjectTransform";
import { createManagedLightsFacade } from "../render/renderables/managedLights";

export type WebGLEffectObjectOptions = {
  sourceKind: WebGLEffectSourceKind;
  source: WebGLEffectSourceHandle;
  target?: WebGLEffectTargetHandle;
  visual: WebGLEffectVisualContext;
  resources: WebGLEffectResourceScope;
};

export function createWebGLEffectObject(
  options: WebGLEffectObjectOptions,
): WebGLEffectObjectHandle {
  const transform = createEffectObjectTransform(options.target);
  const capabilities = createEffectObjectCapabilities(options.source);

  return {
    sourceKind: options.sourceKind,
    position: transform.position,
    rotation: transform.rotation,
    scale: transform.scale,
    get visible() {
      return transform.visible;
    },
    set visible(value) {
      transform.visible = value;
    },
    get opacity() {
      return transform.opacity;
    },
    set opacity(value) {
      transform.opacity = value;
    },
    postprocess: {
      request(request) {
        return options.visual.requestPostprocess(request);
      },
    },
    lights: createManagedLightsFacade({
      target: options.target,
      resources: options.resources,
      readObjectPosition() {
        return transform.position;
      },
    }),
    ...capabilities,
  };
}
