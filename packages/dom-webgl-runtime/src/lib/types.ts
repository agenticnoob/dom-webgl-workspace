import type { WebGLEffectDefinition } from "./effects/effectAuthoring";

export type WebGLRenderRole =
  | "surface"
  | "content"
  | "media"
  | "model"
  | "overlay";

export type WebGLSourceDeclaration =
  | WebGLSnapshotSourceDeclaration
  | WebGLImageSourceDeclaration
  | WebGLVideoSourceDeclaration
  | WebGLModelSourceDeclaration
  | WebGLImageSequenceSourceDeclaration;

export type WebGLSnapshotSourceDeclaration = {
  kind: "snapshot";
  mode?: "element" | "text";
};

export type WebGLImageSourceDeclaration = {
  kind: "image";
  src?: string;
};

export type WebGLVideoSourceDeclaration = {
  kind: "video";
  src?: string;
};

export type WebGLModelSourceDeclaration = {
  kind: "model";
  format: "glb";
  src: string;
};

export type WebGLImageSequenceFrame =
  | HTMLImageElement
  | HTMLCanvasElement
  | ImageBitmap;

export type WebGLImageSequenceSourceDeclaration = {
  kind: "image-sequence";
  frameCount: number;
  frames: readonly WebGLImageSequenceFrame[];
  progressKey?: string;
  startFrame?: number;
};

export type WebGLPageScrollBehavior = {
  type?: "page";
};

export type WebGLGateScrollBehavior = {
  type: "gate";
  start: string;
  duration: number;
  release?: "forward-complete" | "both-directions-complete";
};

export type WebGLScrollBehavior =
  | WebGLPageScrollBehavior
  | WebGLGateScrollBehavior;

export type WebGLPointerDeclaration = {
  move?: boolean;
  click?: boolean;
  drag?: boolean;
};

export type WebGLLifecycleDeclaration = {
  hideWhenReady?: boolean;
  hideMode?: "subtree" | "self";
  offscreen?: WebGLOffscreenLifecycleDeclaration;
};

export type WebGLOffscreenStrategy = "restore-dom" | "park";

export type WebGLOffscreenLifecycleDeclaration = {
  strategy?: WebGLOffscreenStrategy;
  warmTtlMs?: number;
};

export type WebGLCustomEffectDeclaration = {
  kind: string;
  [property: string]: unknown;
};

export type WebGLEffectDeclaration = WebGLCustomEffectDeclaration;

export type WebGLEffectsDeclaration = readonly WebGLEffectDeclaration[];

export type WebGLProgressSignalSource = {
  get(key: string): number;
};

export type WebGLDeclaration = {
  key: string;
  source?: WebGLSourceDeclaration;
  renderRole?: WebGLRenderRole;
  scroll?: WebGLScrollBehavior;
  pointer?: WebGLPointerDeclaration;
  lifecycle?: WebGLLifecycleDeclaration;
  effects?: WebGLEffectsDeclaration;
};

export type WebGLRuntimeOptions = {
  container: HTMLElement;
  effects?: readonly WebGLEffectDefinition[];
  progressSignals?: WebGLProgressSignalSource;
  scrollAdapter?: WebGLScrollAdapter;
  onDebugStateChange?: (state: WebGLDebugState) => void;
};

export type WebGLRuntime = {
  readonly container: HTMLElement;
  registerTarget(element: HTMLElement, declaration: WebGLDeclaration): void;
  unregisterTarget(key: string): void;
  sync(): void | Promise<void>;
  getDebugState(): WebGLDebugState;
  dispose(): void;
};

export type WebGLPointerState = {
  x: number;
  y: number;
  normalizedX: number;
  normalizedY: number;
  isInside: boolean;
  isDown: boolean;
  downTime: number;
  pressDuration: number;
  isDragging: boolean;
  dragStartX: number;
  dragStartY: number;
  dragDeltaX: number;
  dragDeltaY: number;
  lastClickTime?: number;
  clickCount: number;
};

export type WebGLFrameInput = {
  time: number;
  delta: number;
  scroll:
    | {
        mode: "page";
        pageProgress: number;
        direction: -1 | 0 | 1;
        velocity: number;
      }
    | {
        mode: "gate";
        sceneProgress: number;
        activeGateKey: string;
        direction: -1 | 0 | 1;
        velocity: number;
      };
  pointer: WebGLPointerState;
};

export type WebGLScrollMetrics = {
  scrollY: number;
  scrollHeight: number;
  viewportHeight: number;
};

export type WebGLScrollDeltaRouter = (deltaY: number) => boolean;

export type WebGLScrollGateState =
  | { active: false }
  | { active: true; key: string; progress: number };

export type WebGLScrollAdapter = {
  readonly kind?: string;
  readMetrics(): WebGLScrollMetrics;
  connectDeltaRouter?(router: WebGLScrollDeltaRouter): () => void;
  subscribe?(listener: () => void): () => void;
  onGateStateChange?(state: WebGLScrollGateState): void;
  dispose?(): void;
};

export type WebGLResourceStatus = "idle" | "loading" | "ready" | "error";

export type WebGLLifecycleState =
  | "declared"
  | "preloading"
  | "loaded"
  | "mounted"
  | "active"
  | "inactive"
  | "paused"
  | "disposed"
  | "error";

export type WebGLDebugState = {
  targetCount: number;
  renderableCount: number;
  currentScrollMode: "page" | "gate";
  activeGateKey?: string;
  sceneProgress?: number;
  pointer: WebGLPointerState;
  targets: Array<{
    key: string;
    sourceKind: string;
    renderRole: WebGLRenderRole;
    resourceStatus: WebGLResourceStatus;
    lifecycleState: WebGLLifecycleState;
    visible: boolean;
    error?: string;
  }>;
};
