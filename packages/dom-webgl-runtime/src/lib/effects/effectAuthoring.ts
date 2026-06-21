import type { ElementLayoutSnapshot } from "../renderer/layoutPass";
import type {
  WebGLEffectDeclaration,
  WebGLFrameInput,
} from "../types";
import type { WebGLEffectSourceKind } from "./effectPlugin";

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

export function defineWebGLEffect<
  TParams extends WebGLEffectDeclaration,
  TState = void,
>(
  definition: WebGLEffectDefinition<TParams, TState>,
): WebGLEffectDefinition<TParams, TState> {
  return definition;
}
