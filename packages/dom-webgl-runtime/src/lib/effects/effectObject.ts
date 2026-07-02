import type {
  WebGLEffectCanvasSurfaceHandle,
  WebGLEffectMaterialLayerHost,
  WebGLEffectMediaShaderInputs,
  WebGLEffectManagedObjectHandle,
  WebGLEffectPointLayerOptions,
  WebGLEffectPostprocessHandle,
  WebGLEffectPostprocessRequest,
  WebGLEffectSourceKind,
  WebGLEffectTextShaderInputs,
  WebGLEffectTextureTransform,
  WebGLModelMeshHandle,
  WebGLTextGlyph,
  WebGLTextGlyphRenderCommand,
  WebGLTextLayerStyle,
} from "./effectAuthoring";

export type WebGLEffectVector3Like = {
  x: number;
  y: number;
  z: number;
  set(x: number, y: number, z?: number): void;
};

export type WebGLEffectScaleLike = WebGLEffectVector3Like & {
  setScalar(value: number): void;
};

export type WebGLEffectPostprocessFacade = {
  request(request: WebGLEffectPostprocessRequest): WebGLEffectPostprocessHandle;
};

export type WebGLEffectTextureFacade = {
  readonly src?: string;
  readonly frame?: number;
  readonly shaderInputs: WebGLEffectMediaShaderInputs;
  setTransform(transform: WebGLEffectTextureTransform): void;
  invalidate(): void;
  material: WebGLEffectMaterialLayerHost;
};

export type WebGLEffectVideoFacade = {
  play(): Promise<void> | void;
  pause(): void;
  setMuted(muted: boolean): void;
  setPlaybackRate(rate: number): void;
};

export type WebGLEffectTextFacade = {
  readonly text: string;
  readonly style: WebGLTextLayerStyle;
  readonly shaderInputs: WebGLEffectTextShaderInputs;
  getGlyphs(): readonly WebGLTextGlyph[];
  setText(text: string): void;
  setGlyphs(
    transform: (
      glyphs: readonly WebGLTextGlyph[],
    ) => readonly WebGLTextGlyphRenderCommand[],
  ): void;
  material: WebGLEffectMaterialLayerHost;
};

export type WebGLEffectModelMeshesFacade = {
  all(): readonly WebGLModelMeshHandle[];
  forEach(visitor: (mesh: WebGLModelMeshHandle) => void): void;
};

export type WebGLEffectModelSamplingFacade = {
  vertices(options?: { maxPoints?: number }): Float32Array;
};

export type WebGLEffectModelPointsFacade = {
  create(options: WebGLEffectPointLayerOptions): WebGLEffectManagedObjectHandle;
};

export type WebGLEffectModelFacade = {
  readonly src: string;
  meshes: WebGLEffectModelMeshesFacade;
  sampling: WebGLEffectModelSamplingFacade;
  points: WebGLEffectModelPointsFacade;
};

export type WebGLEffectObjectHandle = {
  readonly sourceKind: WebGLEffectSourceKind;
  position: WebGLEffectVector3Like;
  rotation: WebGLEffectVector3Like;
  scale: WebGLEffectScaleLike;
  visible: boolean;
  opacity: number;
  surface?: WebGLEffectCanvasSurfaceHandle;
  text?: WebGLEffectTextFacade;
  texture?: WebGLEffectTextureFacade;
  video?: WebGLEffectVideoFacade;
  model?: WebGLEffectModelFacade;
  postprocess: WebGLEffectPostprocessFacade;
};
