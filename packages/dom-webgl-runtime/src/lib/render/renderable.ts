import type { TargetDescriptor } from "../dom/targetDescriptor";
import type { WebGLEffectTarget } from "../effects/effectController";
import type { ElementLayoutSnapshot } from "../renderer/layoutPass";
import type { WebGLSceneObjectController } from "../renderer/sceneObject";
import type { WebGLSourceDescriptor } from "../source/sourceDescriptor";
import type { WebGLFrameInput, WebGLRenderRole } from "../types";
import type { RenderPolicy } from "./renderPolicy";

export type RenderableStatus = "idle" | "ready" | "error" | "disposed";

export type RenderableContext = {
  descriptor: TargetDescriptor;
  source: WebGLSourceDescriptor;
  role: WebGLRenderRole;
  policy: RenderPolicy;
};

export type Renderable = {
  key: string;
  descriptor: TargetDescriptor;
  role: WebGLRenderRole;
  policy: RenderPolicy;
  status: RenderableStatus;
  readonly sceneObjectController?: WebGLSceneObjectController;
  readonly effectTarget?: WebGLEffectTarget;
  readonly hasSceneObject: boolean;
  update(input?: WebGLFrameInput): void | Promise<void>;
  updateLayout?(measurement: ElementLayoutSnapshot): void;
  invalidateContent?(): void;
  setVisible(visible: boolean): void;
  dispose(): void;
};

export type RenderableLifecycleController = {
  readonly status: RenderableStatus;
  readonly error?: unknown;
  markReady(): void;
  markError(error: unknown): void;
  markDisposed(): void;
};

type RenderableHooks = {
  update?(
    context: RenderableContext,
    lifecycle: RenderableLifecycleController,
    input: WebGLFrameInput,
  ): void | Promise<void>;
  updateLayout?(
    context: RenderableContext,
    lifecycle: RenderableLifecycleController,
    measurement: ElementLayoutSnapshot,
  ): void;
  invalidateContent?(
    context: RenderableContext,
    lifecycle: RenderableLifecycleController,
  ): void;
  setVisible?(visible: boolean): void;
  sceneObjectController?(): WebGLSceneObjectController | undefined;
  effectTarget?(): WebGLEffectTarget | undefined;
  dispose?(): void;
};

export function createRenderableLifecycleController(): RenderableLifecycleController {
  let status: RenderableStatus = "idle";
  let error: unknown;

  return {
    get status() {
      return status;
    },
    get error() {
      return error;
    },
    markReady(): void {
      if (status === "disposed") {
        return;
      }

      status = "ready";
      error = undefined;
    },
    markError(nextError: unknown): void {
      if (status === "disposed") {
        return;
      }

      status = "error";
      error = nextError;
    },
    markDisposed(): void {
      status = "disposed";
    },
  };
}

export function createRenderable(
  context: RenderableContext,
  hooks: RenderableHooks = {},
): Renderable {
  const lifecycle = createRenderableLifecycleController();
  let disposed = false;

  const finalizeSuccessfulUpdate = () => {
    if (lifecycle.status === "idle") {
      lifecycle.markReady();
    }
  };

  return {
    key: context.descriptor.key,
    descriptor: context.descriptor,
    role: context.role,
    policy: context.policy,
    get status() {
      return lifecycle.status;
    },
    get sceneObjectController() {
      return hooks.sceneObjectController?.();
    },
    get effectTarget() {
      return hooks.effectTarget?.();
    },
    get hasSceneObject() {
      return this.sceneObjectController?.attached === true;
    },
    update(input?: WebGLFrameInput): void | Promise<void> {
      if (disposed) {
        return;
      }

      try {
        const result = hooks.update?.(
          context,
          lifecycle,
          input ?? createEmptyFrameInput(),
        );

        if (result && typeof result === "object" && "then" in result) {
          return result
            .then(() => {
              finalizeSuccessfulUpdate();
            })
            .catch((error: unknown) => {
              lifecycle.markError(error);
              throw error;
            });
        }

        finalizeSuccessfulUpdate();
      } catch (error: unknown) {
        lifecycle.markError(error);
        throw error;
      }
    },
    setVisible(visible: boolean): void {
      if (disposed) {
        return;
      }

      hooks.setVisible?.(visible);
    },
    updateLayout(measurement): void {
      if (disposed) {
        return;
      }

      hooks.updateLayout?.(context, lifecycle, measurement);
    },
    invalidateContent(): void {
      if (disposed) {
        return;
      }

      hooks.invalidateContent?.(context, lifecycle);
    },
    dispose(): void {
      if (disposed) {
        return;
      }

      disposed = true;
      lifecycle.markDisposed();
      hooks.dispose?.();
    },
  };
}

export function isRenderableVisuallyReady(renderable: Renderable): boolean {
  return (
    renderable.status === "ready" &&
    renderable.sceneObjectController?.attached === true
  );
}

function createEmptyFrameInput(): WebGLFrameInput {
  return {
    time: 0,
    delta: 0,
    scroll: {
      mode: "page",
      pageProgress: 0,
      direction: 0,
      velocity: 0,
    },
    pointer: {
      x: 0,
      y: 0,
      normalizedX: 0,
      normalizedY: 0,
      isInside: false,
      isDown: false,
      downTime: 0,
      pressDuration: 0,
      isDragging: false,
      dragStartX: 0,
      dragStartY: 0,
      dragDeltaX: 0,
      dragDeltaY: 0,
      clickCount: 0,
    },
  };
}
