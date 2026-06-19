export type WebGLSolidMaterialTargetState = {
  color: number;
  opacity: number;
};

export type WebGLSurfaceMaterialTargetState = {
  color: number;
  opacity: number;
  radius: number;
};

export type WebGLEffectTarget = {
  applySolidMaterial?(material: WebGLSolidMaterialTargetState): void;
  applySurfaceMaterial?(
    material: WebGLSurfaceMaterialTargetState,
    layout: { width: number; height: number; devicePixelRatio: number },
  ): void;
  setRotation?(x: number, y: number): void;
  disposeEffects?(): void;
};
