import type { ProjectedDOMRect } from "./domProjection";

export type WebGLSceneObject = {
  readonly key: string;
  readonly object3D?: unknown;
  ordering?: WebGLSceneObjectOrdering;
  setVisible(visible: boolean): void;
  updateLayout(layout: ProjectedDOMRect): void;
  dispose(): void;
};

export type WebGLSceneObjectOrdering = {
  renderOrder: number;
  transparent: boolean;
  depthWrite: boolean;
};

export type WebGLSceneAdapter = {
  addObject(object: WebGLSceneObject): void;
  removeObject(object: WebGLSceneObject): void;
  render(): void;
};

export type WebGLSceneObjectController = {
  readonly attached: boolean;
  readonly disposed: boolean;
  readonly visible: boolean;
  attach(): void;
  setVisible(visible: boolean): void;
  updateLayout(layout: ProjectedDOMRect): void;
  render(): void;
  dispose(): void;
};

export function createSceneObjectController(
  adapter: WebGLSceneAdapter,
  object: WebGLSceneObject,
  ordering?: WebGLSceneObjectOrdering,
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
    get visible() {
      return visible;
    },
    attach(): void {
      if (attached || disposed) {
        return;
      }

      applySceneObjectOrdering(object, ordering);
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

function applySceneObjectOrdering(
  object: WebGLSceneObject,
  ordering: WebGLSceneObjectOrdering | undefined,
): void {
  if (!ordering) {
    return;
  }

  object.ordering = ordering;
  applyObject3DOrdering(object.object3D, ordering);
}

function applyObject3DOrdering(
  object3D: unknown,
  ordering: WebGLSceneObjectOrdering,
): void {
  if (!object3D || typeof object3D !== "object") {
    return;
  }

  (object3D as { renderOrder?: number }).renderOrder = ordering.renderOrder;
  applyMaterialOrdering(
    (object3D as { material?: unknown }).material,
    ordering,
  );
}

function applyMaterialOrdering(
  material: unknown,
  ordering: WebGLSceneObjectOrdering,
): void {
  if (Array.isArray(material)) {
    for (const entry of material) {
      applyMaterialOrdering(entry, ordering);
    }

    return;
  }

  if (!material || typeof material !== "object") {
    return;
  }

  Object.assign(material, {
    transparent: ordering.transparent,
    depthWrite: ordering.depthWrite,
  });
}
