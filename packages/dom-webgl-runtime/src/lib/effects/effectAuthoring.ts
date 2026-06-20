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

export type WebGLEffectTargetHandle = {
  setVisible(visible: boolean): void;
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

export type WebGLModelEffectHandle = {
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
  | { kind: "snapshot/element"; element: HTMLElement }
  | { kind: "snapshot/text"; element: HTMLElement; text: string }
  | { kind: "image"; element: HTMLImageElement; src: string }
  | { kind: "video"; element: HTMLVideoElement; src: string }
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
