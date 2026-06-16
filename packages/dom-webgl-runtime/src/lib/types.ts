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

export type WebGLScrollBehavior = {
  type?: "page";
};

export type WebGLPointerDeclaration = {
  move?: boolean;
  click?: boolean;
  drag?: boolean;
};

export type WebGLLifecycleDeclaration = {
  hideWhenReady?: boolean;
};

export type WebGLDeclaration = {
  key: string;
  source?: WebGLSourceDeclaration;
  renderRole?: WebGLRenderRole;
  scroll?: WebGLScrollBehavior;
  pointer?: WebGLPointerDeclaration;
  lifecycle?: WebGLLifecycleDeclaration;
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
  scroll: {
    mode: "page";
    pageProgress: number;
    direction: -1 | 0 | 1;
    velocity: number;
  };
  pointer: WebGLPointerState;
};

export type WebGLResourceStatus = "idle" | "loading" | "ready" | "error";

export type WebGLDebugState = {
  targetCount: number;
  renderableCount: number;
  currentScrollMode: "page";
  pointer: WebGLPointerState;
  targets: Array<{
    key: string;
    sourceKind: string;
    renderRole: WebGLRenderRole;
    resourceStatus: WebGLResourceStatus;
    visible: boolean;
    error?: string;
  }>;
};
