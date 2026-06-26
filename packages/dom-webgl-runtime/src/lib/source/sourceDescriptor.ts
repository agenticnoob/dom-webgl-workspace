export type WebGLSourceDescriptor =
  | WebGLSnapshotSourceDescriptor
  | WebGLImageSourceDescriptor
  | WebGLVideoSourceDescriptor
  | WebGLModelSourceDescriptor
  | WebGLImageSequenceSourceDescriptor;

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

export type WebGLImageSequenceSourceDescriptor = {
  kind: "image-sequence";
  anchor: HTMLElement;
  frameCount: number;
  frameSrc: string | ((frame: number) => string);
  progressKey?: string;
  startFrame: number;
  preloadBefore: number;
  preloadAfter: number;
  maxCachedFrames: number;
};
