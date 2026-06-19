import type { WebGLEffectResourceScope } from "./effectAuthoring";

export function createWebGLEffectResourceScope(): WebGLEffectResourceScope {
  const disposables: Array<() => void> = [];
  let disposed = false;

  return {
    addDisposable(dispose) {
      if (disposed) {
        dispose();
        return;
      }

      disposables.push(dispose);
    },
    createObject3D(factory, dispose) {
      const object = factory();

      if (dispose) {
        this.addDisposable(() => dispose(object));
      }

      return object;
    },
    dispose() {
      if (disposed) {
        return;
      }

      disposed = true;
      for (const dispose of disposables.splice(0).reverse()) {
        dispose();
      }
    },
  };
}
