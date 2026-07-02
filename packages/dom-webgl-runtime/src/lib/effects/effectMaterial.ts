import type {
  WebGLEffectMaterialLayerHandle,
  WebGLEffectMaterialProgram,
} from "./effectAuthoring";
import type {
  WebGLEffectColorLike,
  WebGLEffectEmissiveLike,
} from "./effectColor";

export type WebGLEffectMaterialLayerOptions = {
  key: string;
  program: WebGLEffectMaterialProgram;
  sourceTextureUniform?: string;
  mode?: "replace-source" | "overlay";
};

export type WebGLEffectMaterialFacade = {
  color: WebGLEffectColorLike;
  emissive: WebGLEffectEmissiveLike;
  opacity: number;
  metalness: number;
  roughness: number;
  createLayer(
    options: WebGLEffectMaterialLayerOptions,
  ): WebGLEffectMaterialLayerHandle;
  restore(): void;
};
