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
