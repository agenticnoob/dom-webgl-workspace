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

export type WebGLModelAnimationLoop = "once" | "repeat";

export type WebGLModelClipPlaybackDeclaration =
  | string
  | {
      readonly clip: string;
      readonly loop?: WebGLModelAnimationLoop;
      readonly timeScale?: number;
      readonly fadeInMs?: number;
      readonly fadeOutMs?: number;
      readonly clampWhenFinished?: boolean;
    };

export type WebGLModelClipScrubDeclaration = {
  readonly clip: string;
  readonly timeline: WebGLTimelineBindingDeclaration;
  readonly durationSeconds?: number;
  readonly range?: WebGLTimelineActiveRangeDeclaration;
};

export type WebGLModelClipBlendDeclaration = {
  readonly from: string;
  readonly to: string;
  readonly timeline: WebGLTimelineBindingDeclaration;
  readonly fadeMs?: number;
  readonly range?: WebGLTimelineActiveRangeDeclaration;
};

export type WebGLModelMorphWeightDeclaration = {
  readonly name: string;
  readonly weight?: number;
  readonly timeline?: WebGLTimelineBindingDeclaration;
  readonly from?: number;
  readonly to?: number;
};

export type WebGLModelAnimationDeclaration = {
  readonly defaultClip?: WebGLModelClipPlaybackDeclaration;
  readonly scrub?: WebGLModelClipScrubDeclaration;
  readonly blend?: WebGLModelClipBlendDeclaration;
  readonly morphs?: readonly WebGLModelMorphWeightDeclaration[];
};

export type WebGLModelPrepareDeclaration = {
  readonly renderWarmup?: "idle";
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

export type WebGLTimelineActiveRangeDeclaration = {
  readonly from?: number;
  readonly to?: number;
};

export type WebGLTimelineBindingDeclaration =
  | string
  | {
      readonly id: string;
      readonly progressKey?: string;
      readonly active?: WebGLTimelineActiveRangeDeclaration;
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

export type WebGLCameraControllerFrameDeclaration = {
  readonly position?: WebGLTuple3;
  readonly target?: WebGLTuple3;
  readonly fov?: number;
};

export type WebGLCameraControllerTimelineDeclaration =
  | string
  | {
      readonly id: string;
      readonly progressKey?: string;
      readonly range?: WebGLTimelineActiveRangeDeclaration;
    };

export type WebGLCameraControllerEasing = "linear" | "smoothstep";

export type WebGLCameraControllerDeclaration = {
  readonly timeline: WebGLCameraControllerTimelineDeclaration;
  readonly from?: WebGLCameraControllerFrameDeclaration;
  readonly to: WebGLCameraControllerFrameDeclaration;
  readonly easing?: WebGLCameraControllerEasing;
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
  timeline?: WebGLTimelineBindingDeclaration;
};

export type WebGLCameraDeclaration = WebGLCameraFramingDeclaration & {
  id: string;
  sceneId: string;
  type?: WebGLCameraType;
  mode?: WebGLCameraMode;
  default?: boolean;
  controller?: WebGLCameraControllerDeclaration;
};

export type WebGLPassViewportDeclaration =
  | {
      mode?: "canvas";
    }
  | {
      mode: "dom-rect";
      anchorId?: string;
      scissor?: boolean;
    };

export type WebGLPostprocessDeclaration = {
  bloom?: { strength?: number; radius?: number; threshold?: number };
  grain?: { amount?: number };
  blur?: { radius?: number };
};

export type WebGLPostprocessScopeDeclaration =
  | { canvas: true; passId?: never }
  | { passId: string; canvas?: never };

export type WebGLRenderPassDeclaration = {
  id?: string;
  sceneId: string;
  cameraId?: string;
  order?: number;
  clear?: boolean;
  clearDepth?: boolean;
  viewport?: WebGLPassViewportDeclaration;
  postprocess?: WebGLPostprocessDeclaration;
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
  timeline?: WebGLTimelineBindingDeclaration;
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
  timeline?: WebGLTimelineBindingDeclaration;
};

export type WebGLModelDeclaration = {
  readonly id: string;
  readonly sceneId: string;
  readonly src: string;
  readonly loader?: WebGLModelLoaderDeclaration;
  readonly position?: WebGLTuple3;
  readonly rotation?: WebGLTuple3;
  readonly scale?: number | WebGLTuple3;
  readonly visible?: boolean;
  readonly timeline?: WebGLTimelineBindingDeclaration;
  readonly animation?: WebGLModelAnimationDeclaration;
  readonly prepare?: WebGLModelPrepareDeclaration;
};

export type WebGLDeclaration = {
  key: string;
  sceneId?: string;
  timeline?: WebGLTimelineBindingDeclaration;
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
  registerPassViewport(declaration: { id: string; element: HTMLElement }): void;
  unregisterPassViewport(id: string): void;
  registerStagePrimitive(declaration: WebGLStagePrimitiveDeclaration): void;
  unregisterStagePrimitive(id: string): void;
  registerLight(declaration: WebGLLightDeclaration): void;
  unregisterLight(id: string): void;
  registerModel(declaration: WebGLModelDeclaration): void;
  unregisterModel(id: string): void;
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

export type WebGLDebugTimelineSummary = {
  id: string;
  progressKey: string;
  active?: boolean;
};

export type WebGLDebugStagePrimitiveSummary = {
  id: string;
  sceneId: string;
  kind: WebGLStagePrimitiveKind;
  timeline?: WebGLDebugTimelineSummary;
};

export type WebGLDebugLightSummary = {
  id: string;
  sceneId: string;
  kind: WebGLLightKind;
  timeline?: WebGLDebugTimelineSummary;
};

export type WebGLDebugModelDiagnostic = {
  kind: "missing-clip" | "missing-morph" | "missing-bone";
  name: string;
};

export type WebGLDebugModelSummary = {
  id: string;
  sceneId: string;
  src: string;
  resourceStatus: WebGLResourceStatus;
  visible: boolean;
  timeline?: WebGLDebugTimelineSummary;
  prepare?: {
    readonly renderWarmup?: "pending" | "complete";
  };
  clips: readonly string[];
  activeClips: readonly string[];
  morphs?: readonly string[];
  bones?: readonly string[];
  diagnostics?: readonly WebGLDebugModelDiagnostic[];
};

export type WebGLDebugPostprocessRequestSummary = {
  key: string;
  scope: WebGLPostprocessScopeDeclaration;
};

export type WebGLDebugCameraControllerSummary = {
  cameraId: string;
  sceneId: string;
  timelineId: string;
  progressKey: string;
  progress: number;
  applied: boolean;
};

export type WebGLDebugRenderPassSummary = {
  id: string;
  sceneId: string;
  cameraId?: string;
  viewportMode: "canvas" | "dom-rect";
  viewportAnchorId?: string;
  postprocess: boolean;
};

export type WebGLDebugState = {
  targetCount: number;
  renderableCount: number;
  currentScrollMode: "page" | "gate";
  activeGateKey?: string;
  sceneProgress?: number;
  pointer: WebGLPointerState;
  warnings?: WebGLPerformanceWarning[];
  stagePrimitiveCount?: number;
  lightCount?: number;
  modelCount?: number;
  stagePrimitives?: WebGLDebugStagePrimitiveSummary[];
  lights?: WebGLDebugLightSummary[];
  models?: WebGLDebugModelSummary[];
  cameraControllers?: WebGLDebugCameraControllerSummary[];
  renderPasses?: WebGLDebugRenderPassSummary[];
  postprocessRequests?: WebGLDebugPostprocessRequestSummary[];
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
