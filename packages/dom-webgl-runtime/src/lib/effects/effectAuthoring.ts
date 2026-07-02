import type { ElementLayoutSnapshot } from "../renderer/layoutPass";
import type {
  WebGLEffectDeclaration,
  WebGLFrameInput,
  WebGLProgressSignalSource,
  WebGLTargetPointerState,
} from "../types";
import type { WebGLEffectObjectHandle } from "./effectObject";

export type WebGLEffectSourceKind =
  | "dom/element"
  | "dom/text"
  | "media/image"
  | "media/video"
  | "media/image-sequence"
  | "model/glb";

export type WebGLEffectResourceScope = {
  addDisposable(dispose: () => void): void;
  createObject3D<TObject>(
    factory: () => TObject,
    dispose?: (object: TObject) => void,
  ): TObject;
  dispose(): void;
};

export type WebGLEffectRenderableHandle = {
  setVisible?(visible: boolean): void;
  setPosition?(x: number, y: number, z?: number): void;
  setRotation?(x: number, y: number, z?: number): void;
  setScale?(x: number, y?: number, z?: number): void;
  setOpacity?(opacity: number): void;
};

export type WebGLEffectCanvasDrawer = (context: {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  width: number;
  height: number;
  devicePixelRatio: number;
}) => void;

export type WebGLEffectTextureUniform =
  | { kind: "source-texture" }
  | { kind: "canvas-texture"; source: HTMLCanvasElement }
  | { kind: "image-texture"; source: HTMLImageElement }
  | { kind: "video-texture"; source: HTMLVideoElement };

export type WebGLEffectUniformValue =
  | number
  | boolean
  | string
  | readonly [number, number]
  | readonly [number, number, number]
  | readonly [number, number, number, number]
  | readonly (readonly [number, number])[]
  | WebGLEffectTextureUniform;

export type WebGLEffectBlendMode =
  | "normal"
  | "additive"
  | "multiply"
  | "screen";

export type WebGLEffectMaterialProgram = {
  vertexShader?: string;
  fragmentShader: string;
  uniforms?: Record<string, WebGLEffectUniformValue>;
  defines?: Record<string, string | number | boolean>;
  blend?: WebGLEffectBlendMode;
};

export type WebGLEffectMaterialLayerHandle = {
  setProgram(program: WebGLEffectMaterialProgram): void;
  setUniforms(uniforms: Record<string, WebGLEffectUniformValue>): void;
  clear(): void;
  dispose(): void;
};

export type WebGLEffectMaterialLayerHost = {
  createMaterialLayer(options: {
    key: string;
    program: WebGLEffectMaterialProgram;
    sourceTextureUniform?: string;
    mode?: "replace-source" | "overlay";
  }): WebGLEffectMaterialLayerHandle;
};

export type WebGLEffectCanvasSurfaceHandle = WebGLEffectRenderableHandle &
  WebGLEffectMaterialLayerHost & {
  readonly canvas: HTMLCanvasElement;
  readonly context: CanvasRenderingContext2D | null;
  readonly shaderInputs: WebGLEffectSurfaceShaderInputs;
  clear(): void;
  draw(drawer: WebGLEffectCanvasDrawer): void;
  invalidate(): void;
  getSize(): { width: number; height: number; devicePixelRatio: number };
};

export type WebGLTextGlyph = {
  index: number;
  char: string;
  line: number;
  x: number;
  y: number;
  width: number;
  height: number;
  baseline: number;
};

export type WebGLTextGlyphRenderCommand = Partial<WebGLTextGlyph> & {
  index: number;
  char?: string;
  opacity?: number;
  scaleX?: number;
  scaleY?: number;
  rotation?: number;
  color?: string;
};

export type WebGLTextLayerStyle = {
  font: string;
  lineHeight: number;
  letterSpacing: number;
  wordSpacing: number;
  textAlign: CanvasTextAlign;
  color: string;
};

export type WebGLEffectTextLayerHandle = Omit<
  WebGLEffectCanvasSurfaceHandle,
  "shaderInputs"
> & {
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
};

export type WebGLEffectTextureTransform = {
  repeatX?: number;
  repeatY?: number;
  offsetX?: number;
  offsetY?: number;
};

export type WebGLEffectContentBoxShaderInput = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type WebGLEffectObjectFitShaderInput = {
  repeatX: number;
  repeatY: number;
  offsetX: number;
  offsetY: number;
};

export type WebGLEffectSourceTextureShaderInput = {
  available: boolean;
  uniform: "source-texture";
  width: number;
  height: number;
  devicePixelRatio?: number;
};

export type WebGLEffectSurfaceShaderInputs = {
  size: { width: number; height: number; devicePixelRatio: number };
  contentBox: WebGLEffectContentBoxShaderInput;
  sourceTexture: WebGLEffectSourceTextureShaderInput;
};

export type WebGLEffectTextShaderInputs = WebGLEffectSurfaceShaderInputs & {
  text: string;
  style: WebGLTextLayerStyle;
  glyphs: readonly WebGLTextGlyph[];
};

export type WebGLEffectMediaShaderInputs = {
  naturalSize: { width: number; height: number };
  contentBox: WebGLEffectContentBoxShaderInput;
  uvTransform: WebGLEffectObjectFitShaderInput;
  objectFit: string;
  objectPosition: string;
  sourceTexture: WebGLEffectSourceTextureShaderInput;
};

export type WebGLEffectTextureLayerHandle<
  TSource extends HTMLImageElement | HTMLVideoElement =
    | HTMLImageElement
    | HTMLVideoElement,
> = WebGLEffectRenderableHandle &
  WebGLEffectMaterialLayerHost & {
  readonly source: TSource;
  readonly shaderInputs: WebGLEffectMediaShaderInputs;
  setTextureTransform(transform: WebGLEffectTextureTransform): void;
  invalidate(): void;
};

export type WebGLEffectVideoLayerHandle =
  WebGLEffectTextureLayerHandle<HTMLVideoElement> & {
    play(): Promise<void> | void;
    pause(): void;
    setMuted(muted: boolean): void;
    setPlaybackRate(rate: number): void;
  };

export type WebGLEffectImageSequenceLayerHandle = Omit<
  WebGLEffectTextureLayerHandle,
  "source"
> & {
  readonly source: HTMLImageElement | HTMLCanvasElement | ImageBitmap;
};

export type WebGLEffectTargetHandle = {
  setVisible(visible: boolean): void;
  setPosition(x: number, y: number, z?: number): void;
  setRotation(x: number, y: number, z?: number): void;
  setScale(x: number, y?: number, z?: number): void;
  setOpacity(opacity: number): void;
};

export type WebGLEffectManagedObjectHandle = {
  setVisible(visible: boolean): void;
  remove(): void;
  dispose(): void;
  setProgress?(progress: number): void;
  setPointer?(x: number, y: number): void;
};

export type WebGLModelMeshHandle = WebGLEffectRenderableHandle &
  WebGLEffectMaterialLayerHost & {
    readonly index: number;
    readonly name?: string;
    readonly materialName?: string;
    restoreMaterial(): void;
  };

export type WebGLEffectPointLayerOptions = {
  positions: Float32Array;
  color?: number | string;
  size?: number;
  material?: WebGLEffectMaterialProgram;
};

export type WebGLModelEffectHandle = WebGLEffectRenderableHandle & {
  getMeshes(): readonly WebGLModelMeshHandle[];
  forEachMesh(visitor: (mesh: WebGLModelMeshHandle) => void): void;
  sampleVertices(options?: { maxPoints?: number }): Float32Array;
  createPointLayer(
    options: WebGLEffectPointLayerOptions,
  ): WebGLEffectManagedObjectHandle;
};

export type WebGLEffectPostprocessRequest = {
  key: string;
  bloom?: { strength?: number; radius?: number; threshold?: number };
  grain?: { amount?: number };
  blur?: { radius?: number };
};

export type WebGLEffectPostprocessHandle = {
  update(request: WebGLEffectPostprocessRequest): void;
  dispose(): void;
};

export type WebGLEffectVisualContext = {
  requestPostprocess(
    request: WebGLEffectPostprocessRequest,
  ): WebGLEffectPostprocessHandle;
};

export type WebGLEffectSourceHandle =
  | {
      kind: "dom";
      type: "element";
      element: HTMLElement;
      surface?: WebGLEffectCanvasSurfaceHandle;
    }
  | {
      kind: "dom";
      type: "text";
      element: HTMLElement;
      text: string;
      textLayer?: WebGLEffectTextLayerHandle;
    }
  | {
      kind: "media";
      type: "image";
      element: HTMLElement;
      src: string;
      image?: WebGLEffectTextureLayerHandle<HTMLImageElement>;
    }
  | {
      kind: "media";
      type: "video";
      element: HTMLElement;
      src: string;
      video?: WebGLEffectVideoLayerHandle;
    }
  | {
      kind: "media";
      type: "image-sequence";
      element: HTMLElement;
      frame: number;
      src: string;
      image?: WebGLEffectImageSequenceLayerHandle;
    }
  | {
      kind: "model";
      type: "glb";
      anchor: HTMLElement;
      src: string;
      model: WebGLModelEffectHandle;
    };

export type WebGLEffectContext = {
  key: string;
  sourceKind: WebGLEffectSourceKind;
  layout: ElementLayoutSnapshot;
  input: WebGLFrameInput;
  pointer: WebGLFrameInput["pointer"];
  targetPointer: WebGLTargetPointerState;
  scroll: WebGLFrameInput["scroll"];
  scrollProgress: number;
  progress: WebGLProgressSignalSource;
  visual: WebGLEffectVisualContext;
  time: number;
  delta: number;
  object: WebGLEffectObjectHandle;
  source: WebGLEffectSourceHandle;
  target: WebGLEffectTargetHandle | undefined;
  resources: WebGLEffectResourceScope;
};

export type WebGLEffectSetupContext = WebGLEffectContext;
export type WebGLEffectUpdateContext = WebGLEffectContext;

export type WebGLEffectSchedule = "static" | "reactive" | "frame";

export type WebGLEffectDefinition<
  TParams extends WebGLEffectDeclaration = WebGLEffectDeclaration,
  TState = unknown,
> = {
  readonly kind: TParams["kind"];
  readonly source?: WebGLEffectSourceKind | readonly WebGLEffectSourceKind[];
  readonly schedule?: WebGLEffectSchedule;
  setup?(context: WebGLEffectSetupContext, params: TParams): TState;
  update(
    context: WebGLEffectUpdateContext,
    state: TState,
    params: TParams,
  ): void;
  dispose?(
    context: WebGLEffectContext,
    state: TState,
    params: TParams,
  ): void;
};

/**
 * Consumer-maintained mapping of effect kind string → params shape.
 *
 * @example
 * ```ts
 * interface AppEffectParams {
 *   "app.surface": { opacity?: number };
 *   "app.pointerTilt": { strength?: number; maxDegrees?: number };
 * }
 * ```
 */
export type EffectDeclarationMap = Record<string, Record<string, unknown>>;

/**
 * Given a `EffectDeclarationMap` and a specific kind key,
 * produce the typed effect declaration for that kind.
 */
export type TypedEffectDeclaration<
  TMap,
  TKind extends keyof TMap,
> = { kind: TKind } & TMap[TKind];

/**
 * A `WebGLEffectsDeclaration` constrained by a `EffectDeclarationMap`.
 * Use this in JSX with `satisfies`:
 *
 * ```tsx
 * const effects = [
 *   { kind: "app.surface", opacity: 0.82 },
 * ] satisfies WebGLEffectsDeclarationOf<AppEffectParams>;
 *
 * <WebGLTarget webgl={{ key: "x", effects }} />
 * ```
 */
export type WebGLEffectsDeclarationOf<TMap> = Array<
  { [K in keyof TMap]: { kind: K } & TMap[K] }[keyof TMap]
>;

/**
 * Zero-cost compile-time guard for effect declaration arrays.
 *
 * Returns the input array unchanged — the runtime behavior is identical
 * to a plain array literal.
 *
 * @example
 * ```ts
 * interface MyEffects {
 *   "app.surface": { opacity?: number };
 * }
 *
 * const effects = createEffectDeclarations<MyEffects>()([
 *   { kind: "app.surface", opacity: 0.82 },  // ✅ type-safe
 *   { kind: "app.surface", opcity: 0.82 },    // ❌ TS error
 * ]);
 * ```
 */
export function createEffectDeclarations<TMap>(): <
  TDeclarations extends Array<{
    [K in keyof TMap]: { kind: K } & TMap[K];
  }[keyof TMap]>,
>(
  declarations: TDeclarations,
) => TDeclarations {
  return (declarations) => declarations;
}

export function defineWebGLEffect<
  TParams extends WebGLEffectDeclaration,
  TState = void,
>(
  definition: WebGLEffectDefinition<TParams, TState>,
): WebGLEffectDefinition<TParams, TState> {
  return definition;
}
