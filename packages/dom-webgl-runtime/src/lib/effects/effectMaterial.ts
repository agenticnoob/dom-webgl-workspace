import type {
  WebGLEffectMaterialLayerHandle,
  WebGLEffectMaterialProgram,
  WebGLEffectUniformValue,
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

export type WebGLEffectPhysicalMaterialFacade = {
  transmission: number;
  thickness: number;
  ior: number;
};

export type WebGLEffectMaterialKind = "basic" | "standard" | "physical";

export type WebGLEffectMaterialShaderDraft = {
  readonly materialKind: WebGLEffectMaterialKind;
  vertexShader: string;
  fragmentShader: string;
  uniforms: Record<string, WebGLEffectUniformValue>;
  defines: Record<string, string | number | boolean>;
};

export type WebGLEffectMaterialShaderDefinition = {
  readonly key: string;
  readonly uniforms?: Record<string, WebGLEffectUniformValue>;
  readonly defines?: Record<string, string | number | boolean>;
  compile(draft: WebGLEffectMaterialShaderDraft): void;
};

export type WebGLEffectMaterialShaderFacade = {
  onBeforeCompile(definition: WebGLEffectMaterialShaderDefinition): void;
  setUniforms(
    key: string,
    values: Record<string, WebGLEffectUniformValue>,
  ): void;
  remove(key: string): void;
};

export type WebGLEffectMaterialFacade = {
  color: WebGLEffectColorLike;
  emissive: WebGLEffectEmissiveLike;
  opacity: number;
  metalness: number;
  roughness: number;
  physical?: WebGLEffectPhysicalMaterialFacade;
  readonly shader?: WebGLEffectMaterialShaderFacade;
  createLayer(
    options: WebGLEffectMaterialLayerOptions,
  ): WebGLEffectMaterialLayerHandle;
  restore(): void;
};
