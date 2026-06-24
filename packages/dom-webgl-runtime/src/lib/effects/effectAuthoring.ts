import type { ElementLayoutSnapshot } from "../renderer/layoutPass";
import type {
  WebGLEffectDeclaration,
  WebGLFrameInput,
} from "../types";

// Maps to public source declarations:
//   "snapshot/element" ← { kind: "snapshot", mode: "element" }
//   "snapshot/text"    ← { kind: "snapshot", mode: "text" }
//   "image"            ← { kind: "image" }
//   "video"            ← { kind: "video" }
//   "model/glb"        ← { kind: "model", format: "glb" }
export type WebGLEffectSourceKind =
  | "snapshot/element"
  | "snapshot/text"
  | "image"
  | "video"
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
  readonly object3D: unknown;
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

export type WebGLEffectCanvasSurfaceHandle = WebGLEffectRenderableHandle & {
  readonly canvas: HTMLCanvasElement;
  readonly context: CanvasRenderingContext2D | null;
  readonly texture: unknown;
  readonly mesh: unknown;
  readonly material: unknown;
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

export type WebGLEffectTextLayerHandle = WebGLEffectCanvasSurfaceHandle & {
  readonly text: string;
  readonly style: WebGLTextLayerStyle;
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

export type WebGLEffectTextureLayerHandle<
  TSource extends HTMLImageElement | HTMLVideoElement =
    | HTMLImageElement
    | HTMLVideoElement,
> = WebGLEffectRenderableHandle & {
  readonly source: TSource;
  readonly texture: unknown;
  readonly mesh: unknown;
  readonly material: unknown;
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

export type WebGLEffectTargetHandle = {
  setVisible(visible: boolean): void;
  setPosition(x: number, y: number, z?: number): void;
  setRotation(x: number, y: number, z?: number): void;
  setScale(x: number, y?: number, z?: number): void;
  setOpacity(opacity: number): void;
  addObject3D?(
    object3D: unknown,
    options?: { dispose?: (object3D: unknown) => void },
  ): WebGLEffectManagedObjectHandle;
};

export type WebGLEffectManagedObjectHandle = {
  setVisible(visible: boolean): void;
  remove(): void;
  dispose(): void;
  setProgress?(progress: number): void;
  setPointer?(x: number, y: number): void;
};

export type WebGLModelEffectHandle = WebGLEffectRenderableHandle & {
  readonly object3D: unknown;
  traverseMeshes(visitor: (mesh: unknown) => void): void;
  sampleVertices(options?: { maxPoints?: number }): Float32Array;
  createPointCloud(options: {
    density?: number;
    color?: number | string;
    size?: number;
  }): unknown;
};

export type WebGLEffectSourceHandle =
  | {
      kind: "snapshot/element";
      element: HTMLElement;
      surface?: WebGLEffectCanvasSurfaceHandle;
    }
  | {
      kind: "snapshot/text";
      element: HTMLElement;
      text: string;
      textLayer?: WebGLEffectTextLayerHandle;
    }
  | {
      kind: "image";
      element: HTMLImageElement;
      src: string;
      image?: WebGLEffectTextureLayerHandle<HTMLImageElement>;
    }
  | {
      kind: "video";
      element: HTMLVideoElement;
      src: string;
      video?: WebGLEffectVideoLayerHandle;
    }
  | {
      kind: "model/glb";
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
  scroll: WebGLFrameInput["scroll"];
  scrollProgress: number;
  time: number;
  delta: number;
  source: WebGLEffectSourceHandle;
  target: WebGLEffectTargetHandle | undefined;
  resources: WebGLEffectResourceScope;
};

export type WebGLEffectSetupContext = WebGLEffectContext;
export type WebGLEffectUpdateContext = WebGLEffectContext;

export type WebGLEffectDefinition<
  TParams extends WebGLEffectDeclaration = WebGLEffectDeclaration,
  TState = unknown,
> = {
  readonly kind: TParams["kind"];
  readonly source?: WebGLEffectSourceKind | readonly WebGLEffectSourceKind[];
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
