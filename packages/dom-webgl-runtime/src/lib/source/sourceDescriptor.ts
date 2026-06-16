export type WebGLSourceDescriptor =
  | WebGLSnapshotSourceDescriptor
  | WebGLImageSourceDescriptor
  | WebGLVideoSourceDescriptor
  | WebGLModelSourceDescriptor;

export type WebGLSnapshotSourceDescriptor = {
  kind: "snapshot";
  mode: "element" | "text";
  element: HTMLElement;
};

export type WebGLImageSourceDescriptor = {
  kind: "image";
  element: HTMLImageElement;
  src: string;
};

export type WebGLVideoSourceDescriptor = {
  kind: "video";
  element: HTMLVideoElement;
  src: string;
};

export type WebGLModelSourceDescriptor = {
  kind: "model";
  format: "glb";
  anchor: HTMLElement;
  src: string;
};
