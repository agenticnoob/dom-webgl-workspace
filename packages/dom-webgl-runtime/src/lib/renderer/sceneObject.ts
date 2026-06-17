import type { ProjectedDOMRect } from "./domProjection";

export type WebGLSceneObject = {
  readonly key: string;
  readonly object3D?: unknown;
  setVisible(visible: boolean): void;
  updateLayout(layout: ProjectedDOMRect): void;
  dispose(): void;
};

export type WebGLSceneAdapter = {
  addObject(object: WebGLSceneObject): void;
  removeObject(object: WebGLSceneObject): void;
  render(): void;
};

export type WebGLSceneObjectController = {
  readonly attached: boolean;
  readonly disposed: boolean;
  attach(): void;
  setVisible(visible: boolean): void;
  updateLayout(layout: ProjectedDOMRect): void;
  render(): void;
  dispose(): void;
};

export function createSceneObjectController(
  adapter: WebGLSceneAdapter,
  object: WebGLSceneObject,
): WebGLSceneObjectController {
  let attached = false;
  let disposed = false;
  let visible = true;

  return {
    get attached() {
      return attached;
    },
    get disposed() {
      return disposed;
    },
    attach(): void {
      if (attached || disposed) {
        return;
      }

      adapter.addObject(object);
      attached = true;
    },
    setVisible(nextVisible): void {
      if (disposed || visible === nextVisible) {
        return;
      }

      visible = nextVisible;
      object.setVisible(nextVisible);
    },
    updateLayout(layout): void {
      if (disposed) {
        return;
      }

      object.updateLayout(layout);
    },
    render(): void {
      if (disposed) {
        return;
      }

      adapter.render();
    },
    dispose(): void {
      if (disposed) {
        return;
      }

      disposed = true;

      if (attached) {
        adapter.removeObject(object);
      }

      object.dispose();
      attached = false;
    },
  };
}
