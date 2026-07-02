import type {
  WebGLEffectCanvasSurfaceHandle,
  WebGLEffectMaterialLayerHost,
  WebGLEffectManagedObjectHandle,
  WebGLEffectPointLayerOptions,
  WebGLEffectPostprocessHandle,
  WebGLEffectPostprocessRequest,
  WebGLEffectSourceKind,
  WebGLEffectTextureTransform,
  WebGLEffectVideoLayerHandle,
  WebGLModelMeshHandle,
  WebGLTextGlyph,
  WebGLTextGlyphRenderCommand,
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
  setTransform(transform: WebGLEffectTextureTransform): void;
  invalidate(): void;
  material: WebGLEffectMaterialLayerHost;
};

export type WebGLEffectTextFacade = {
  readonly text: string;
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
  video?: WebGLEffectVideoLayerHandle;
  model?: WebGLEffectModelFacade;
  postprocess: WebGLEffectPostprocessFacade;
};
