import type { WebGLEffectMaterialFacade } from "./effectMaterial";

const managedMaterialFacades = new WeakMap<object, WebGLEffectMaterialFacade>();

export function rememberManagedMaterialFacade(
  handle: object,
  material: WebGLEffectMaterialFacade,
): void {
  managedMaterialFacades.set(handle, material);
}

export function readManagedMaterialFacade(
  handle: unknown,
): WebGLEffectMaterialFacade | undefined {
  if (!handle || typeof handle !== "object") {
    return undefined;
  }

  return managedMaterialFacades.get(handle);
}
