export type WebGLSolidMaterialTargetState = {
  color: number;
  opacity: number;
};

export type WebGLEffectTarget = {
  applySolidMaterial?(material: WebGLSolidMaterialTargetState): void;
  setRotation?(x: number, y: number): void;
  disposeEffects?(): void;
};
