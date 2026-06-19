import type { WebGLEffectRegistry } from "./effects/effectRegistry";

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
  | WebGLModelSourceDeclaration;

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
};

export type WebGLSolidMaterialDeclaration = {
  kind: "solid";
  color?: number;
  opacity?: number;
};

export type WebGLSurfaceMaterialDeclaration = {
  kind: "surface";
  color?: number;
  opacity?: number;
  radius?: number;
};

export type WebGLMaterialDeclaration =
  | WebGLSolidMaterialDeclaration
  | WebGLSurfaceMaterialDeclaration;

export type WebGLMotionDeclaration = {
  kind: "pointer-tilt";
  strength?: number;
  maxDegrees?: number;
};

export type WebGLSurfaceBasicEffectDeclaration = {
  kind: "surface.basic";
  color?: number;
  opacity?: number;
  radius?: number;
};

export type WebGLSolidMaterialEffectDeclaration = {
  kind: "material.solid";
  color?: number;
  opacity?: number;
};

export type WebGLPointerTiltEffectDeclaration = {
  kind: "motion.pointerTilt";
  strength?: number;
  maxDegrees?: number;
};

export type WebGLBuiltInEffectDeclaration =
  | WebGLSurfaceBasicEffectDeclaration
  | WebGLSolidMaterialEffectDeclaration
  | WebGLPointerTiltEffectDeclaration;

export type WebGLCustomEffectDeclaration = {
  kind: string;
  [property: string]: unknown;
};

export type WebGLEffectDeclaration =
  | WebGLBuiltInEffectDeclaration
  | WebGLCustomEffectDeclaration;

export type WebGLLegacyEffectsDeclaration = {
  material?: WebGLMaterialDeclaration;
  motion?: WebGLMotionDeclaration;
};

export type WebGLEffectsDeclaration =
  | readonly WebGLEffectDeclaration[]
  | WebGLLegacyEffectsDeclaration;

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
  effectRegistry?: WebGLEffectRegistry;
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
