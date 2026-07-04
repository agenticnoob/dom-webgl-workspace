import type { WebGLEffectDefinition } from "./effects/effectAuthoring";

export type WebGLRenderRole =
  | "surface"
  | "content"
  | "media"
  | "model"
  | "overlay";

export type WebGLSourceDeclaration =
  | WebGLDOMSourceDeclaration
  | WebGLMediaSourceDeclaration
  | WebGLModelSourceDeclaration;

export type WebGLDOMSourceDeclaration = {
  kind: "dom";
  type?: "element" | "text";
};

export type WebGLMediaSourceDeclaration =
  | WebGLMediaImageSourceDeclaration
  | WebGLMediaVideoSourceDeclaration
  | WebGLMediaImageSequenceSourceDeclaration;

export type WebGLMediaImageSourceDeclaration = {
  kind: "media";
  type: "image";
  src?: string;
};

export type WebGLMediaVideoPlaybackDeclaration = {
  muted?: boolean;
  loop?: boolean;
  autoplay?: boolean;
  playsInline?: boolean;
  playbackRate?: number;
  visibility?: "pause-resume" | "continue";
};

export type WebGLMediaVideoSourceDeclaration = {
  kind: "media";
  type: "video";
  src?: string;
  playback?: WebGLMediaVideoPlaybackDeclaration;
};

export type WebGLImageSequenceFrame =
  | HTMLImageElement
  | HTMLCanvasElement
  | ImageBitmap;

export type WebGLMediaImageSequenceSourceDeclaration = {
  kind: "media";
  type: "image-sequence";
  frameCount: number;
  frames: readonly WebGLImageSequenceFrame[];
  progressKey?: string;
  startFrame?: number;
};

export type WebGLModelLoaderDeclaration = {
  draco?: {
    decoderPath: string;
    preload?: boolean;
  };
};

export type WebGLModelSourceDeclaration = {
  kind: "model";
  type: "glb";
  src: string;
  loader?: WebGLModelLoaderDeclaration;
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
  hover?: boolean;
  press?: boolean;
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

export type WebGLTransformScope = "self" | "subtree";

export type WebGLProgressSignalSource = {
  get(key: string): number;
  subscribe?(listener: () => void): () => void;
};

export type WebGLTuple2 = readonly [number, number];

export type WebGLTuple3 = readonly [number, number, number];

export type WebGLSceneProjection =
  | "dom-aligned"
  | "screen"
  | "perspective-stage";

export type WebGLCameraType = "orthographic" | "perspective";

export type WebGLCameraMode =
  | "dom-aligned"
  | "screen"
  | "perspective-stage";

export type WebGLScreenAnchor =
  | "top-left"
  | "top"
  | "top-right"
  | "right"
  | "bottom-right"
  | "bottom"
  | "bottom-left"
  | "left"
  | "center";

export type WebGLPlacementMode =
  | "dom-anchored"
  | "screen-anchored"
  | "screen-depth"
  | "stage-local";

export type WebGLCameraFramingDeclaration = {
  fov?: number;
  near?: number;
  far?: number;
  position?: WebGLTuple3;
  target?: WebGLTuple3;
  zoom?: number;
};

export type WebGLDOMAnchoredPlacementDeclaration = {
  mode?: "dom-anchored";
};

export type WebGLScreenAnchoredPlacementDeclaration = {
  mode: "screen-anchored";
  anchor?: WebGLScreenAnchor;
  offset?: WebGLTuple2;
  size?: "dom" | WebGLTuple2;
};

export type WebGLScreenDepthPlacementDeclaration = {
  mode: "screen-depth";
  depth?: number;
  size?: "dom" | WebGLTuple2;
};

export type WebGLStageLocalPlacementDeclaration = {
  mode: "stage-local";
  position?: WebGLTuple3;
  rotation?: WebGLTuple3;
  scale?: number | WebGLTuple3;
  size?: WebGLTuple2;
};

export type WebGLPlacementDeclaration =
  | WebGLDOMAnchoredPlacementDeclaration
  | WebGLScreenAnchoredPlacementDeclaration
  | WebGLScreenDepthPlacementDeclaration
  | WebGLStageLocalPlacementDeclaration;

export type WebGLSceneDeclaration = {
  id: string;
  projection?: WebGLSceneProjection;
  defaultCameraId?: string;
  defaultPass?: boolean;
};

export type WebGLCameraDeclaration = WebGLCameraFramingDeclaration & {
  id: string;
  sceneId: string;
  type?: WebGLCameraType;
  mode?: WebGLCameraMode;
  default?: boolean;
};

export type WebGLRenderPassDeclaration = {
  id?: string;
  sceneId: string;
  cameraId?: string;
  order?: number;
  clear?: boolean;
  clearDepth?: boolean;
};

export type WebGLColorValue =
  | string
  | number
  | readonly [number, number, number];

export type WebGLStagePrimitiveKind = "plane" | "box";

export type WebGLStagePlaneRole = "floor" | "wall" | "backdrop";

export type WebGLStageMaterialDeclaration =
  | {
      kind?: "standard";
      isMaterial?: never;
      color?: WebGLColorValue;
      emissive?: WebGLColorValue;
      emissiveIntensity?: number;
      opacity?: number;
      metalness?: number;
      roughness?: number;
    }
  | {
      kind: "basic";
      isMaterial?: never;
      color?: WebGLColorValue;
      opacity?: number;
    };

export type WebGLStagePrimitiveBaseDeclaration = {
  id: string;
  sceneId: string;
  position?: WebGLTuple3;
  rotation?: WebGLTuple3;
  scale?: number | WebGLTuple3;
  visible?: boolean;
  material?: WebGLStageMaterialDeclaration;
};

export type WebGLStagePlaneDeclaration =
  WebGLStagePrimitiveBaseDeclaration & {
    kind: "plane";
    role?: WebGLStagePlaneRole;
    size?: WebGLTuple2;
  };

export type WebGLStageBoxDeclaration = WebGLStagePrimitiveBaseDeclaration & {
  kind: "box";
  size?: WebGLTuple3;
};

export type WebGLStagePrimitiveDeclaration =
  | WebGLStagePlaneDeclaration
  | WebGLStageBoxDeclaration;

export type WebGLLightKind = "ambient" | "directional" | "point";

export type WebGLLightDeclaration = {
  id: string;
  sceneId: string;
  kind: WebGLLightKind;
  color?: WebGLColorValue;
  intensity?: number;
  position?: WebGLTuple3;
  target?: WebGLTuple3;
  distance?: number;
  decay?: number;
  visible?: boolean;
};

export type WebGLDeclaration = {
  key: string;
  sceneId?: string;
  placement?: WebGLPlacementDeclaration;
  source?: WebGLSourceDeclaration;
  renderRole?: WebGLRenderRole;
  scroll?: WebGLScrollBehavior;
  pointer?: WebGLPointerDeclaration;
  lifecycle?: WebGLLifecycleDeclaration;
  effects?: WebGLEffectsDeclaration;
  transformScope?: WebGLTransformScope;
};

export type WebGLPerformanceBudget = {
  maxActiveTargets?: number;
  maxActiveSnapshots?: number;
  maxActiveVideos?: number;
  maxActiveModels?: number;
  maxTextureSize?: number;
  maxConcurrentResourceLoads?: number;
  maxDrawCalls?: number;
  maxTextureCount?: number;
  maxRenderTargetSize?: number;
  maxPostprocessRequests?: number;
};

export type WebGLPerformanceWarning = {
  code: "performance-budget-exceeded";
  target:
    | "activeTargets"
    | "activeSnapshots"
    | "activeVideos"
    | "activeModels"
    | "textureSize"
    | "concurrentResourceLoads"
    | "drawCalls"
    | "textureCount"
    | "renderTargetSize"
    | "postprocessRequests";
  count: number;
  limit: number;
};

export type WebGLRuntimeOptions = {
  container: HTMLElement;
  effects?: readonly WebGLEffectDefinition[];
  progressSignals?: WebGLProgressSignalSource;
  scrollAdapter?: WebGLScrollAdapter;
  modelLoader?: WebGLModelLoaderDeclaration;
  performanceBudget?: WebGLPerformanceBudget;
  onDebugStateChange?: (state: WebGLDebugState) => void;
};

export type WebGLRuntime = {
  readonly container: HTMLElement;
  registerScene(declaration: WebGLSceneDeclaration): void;
  unregisterScene(id: string): void;
  registerCamera(declaration: WebGLCameraDeclaration): void;
  unregisterCamera(id: string): void;
  registerRenderPass(declaration: WebGLRenderPassDeclaration): void;
  unregisterRenderPass(id: string): void;
  registerStagePrimitive(declaration: WebGLStagePrimitiveDeclaration): void;
  unregisterStagePrimitive(id: string): void;
  registerLight(declaration: WebGLLightDeclaration): void;
  unregisterLight(id: string): void;
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

export type WebGLTargetPointerState = {
  localX: number;
  localY: number;
  normalizedX: number;
  normalizedY: number;
  isInside: boolean;
  isPressed: boolean;
  pressDuration: number;
  isDragging: boolean;
  dragStartLocalX: number;
  dragStartLocalY: number;
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
  warnings?: WebGLPerformanceWarning[];
  targets: Array<{
    key: string;
    sceneId?: string;
    projection?: WebGLSceneProjection;
    placementMode?: WebGLPlacementMode;
    sourceKind: string;
    renderRole: WebGLRenderRole;
    resourceStatus: WebGLResourceStatus;
    lifecycleState: WebGLLifecycleState;
    visible: boolean;
    pointer?: WebGLTargetPointerState;
    parentKey?: string;
    layerDepth: number;
    siblingIndex: number;
    computedRenderOrder?: number;
    error?: string;
  }>;
};
