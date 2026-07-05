import type {
  WebGLEffectCanvasSurfaceHandle,
  WebGLEffectMaterialLayerHost,
  WebGLEffectMediaShaderInputs,
  WebGLEffectManagedObjectHandle,
  WebGLEffectPointLayerOptions,
  WebGLEffectSourceKind,
  WebGLEffectTextShaderInputs,
  WebGLEffectTextureTransform,
  WebGLModelMeshHandle,
  WebGLTextGlyph,
  WebGLTextGlyphRenderCommand,
  WebGLTextLayerStyle,
} from "./effectAuthoring";
import type { WebGLEffectLightsFacade } from "./effectLights";
import type { WebGLEffectMaterialFacade } from "./effectMaterial";

export type WebGLEffectVector3Like = {
  x: number;
  y: number;
  z: number;
  set(x: number, y: number, z?: number): void;
};

export type WebGLEffectScaleLike = WebGLEffectVector3Like & {
  setScalar(value: number): void;
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

export type WebGLEffectModelMorphsFacade = {
  names(): readonly string[];
  get(name: string): number | undefined;
  set(name: string, weight: number): void;
};

export type WebGLEffectModelRigFacade = {
  bones(): readonly string[];
};

export type WebGLEffectModelFacade = {
  readonly src: string;
  meshes: WebGLEffectModelMeshesFacade;
  sampling: WebGLEffectModelSamplingFacade;
  points: WebGLEffectModelPointsFacade;
  morphs?: WebGLEffectModelMorphsFacade;
  rig?: WebGLEffectModelRigFacade;
};

export type WebGLEffectAnimationPlayOptions = {
  loop?: "once" | "repeat";
  fadeInMs?: number;
  fadeOutMs?: number;
  clampWhenFinished?: boolean;
  timeScale?: number;
};

export type WebGLEffectAnimationScrubOptions =
  | { readonly timeSeconds: number }
  | { readonly progress: number; readonly durationSeconds: number };

export type WebGLEffectAnimationBlendOptions = {
  readonly weight: number;
  readonly loop?: "once" | "repeat";
  readonly timeScale?: number;
};

export type WebGLEffectAnimationCrossfadeOptions = {
  readonly fadeMs?: number;
  readonly loop?: "once" | "repeat";
  readonly timeScale?: number;
};

export type WebGLEffectAnimationFacade = {
  clips(): readonly string[];
  play(name: string, options?: WebGLEffectAnimationPlayOptions): void;
  scrub(name: string, options: WebGLEffectAnimationScrubOptions): void;
  blend(
    from: string,
    to: string,
    options: WebGLEffectAnimationBlendOptions,
  ): void;
  crossFade(
    from: string,
    to: string,
    options?: WebGLEffectAnimationCrossfadeOptions,
  ): void;
  stop(name: string): void;
  stopAll(): void;
  setTime(seconds: number): void;
};

export type WebGLEffectObjectHandle = {
  readonly sourceKind: WebGLEffectSourceKind;
  position: WebGLEffectVector3Like;
  rotation: WebGLEffectVector3Like;
  scale: WebGLEffectScaleLike;
  visible: boolean;
  opacity: number;
  material?: WebGLEffectMaterialFacade;
  lights?: WebGLEffectLightsFacade;
  animation?: WebGLEffectAnimationFacade;
  surface?: WebGLEffectCanvasSurfaceHandle;
  text?: WebGLEffectTextFacade;
  texture?: WebGLEffectTextureFacade;
  video?: WebGLEffectVideoFacade;
  model?: WebGLEffectModelFacade;
};
