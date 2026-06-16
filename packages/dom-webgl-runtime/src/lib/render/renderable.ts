import type { TargetDescriptor } from "../dom/targetDescriptor";
import type { WebGLSourceDescriptor } from "../source/sourceDescriptor";
import type { WebGLRenderRole } from "../types";
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
  update(): void | Promise<void>;
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
  ): void | Promise<void>;
  setVisible?(visible: boolean): void;
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
    update(): void | Promise<void> {
      if (disposed) {
        return;
      }

      try {
        const result = hooks.update?.(context, lifecycle);

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
