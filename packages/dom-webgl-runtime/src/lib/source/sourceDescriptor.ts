import type {
  WebGLImageSequenceFrame,
  WebGLMediaVideoPlaybackDeclaration,
} from "../types";

export type WebGLSourceDescriptor =
  | WebGLDOMSourceDescriptor
  | WebGLMediaSourceDescriptor
  | WebGLModelSourceDescriptor;

export type WebGLDOMSourceDescriptor = {
  kind: "dom";
  type: "element" | "text";
  element: HTMLElement;
};

export type WebGLMediaSourceDescriptor =
  | WebGLMediaImageSourceDescriptor
  | WebGLMediaVideoSourceDescriptor
  | WebGLMediaImageSequenceSourceDescriptor;

export type WebGLMediaImageSourceDescriptor = {
  kind: "media";
  type: "image";
  anchor: HTMLElement;
  element?: HTMLImageElement;
  src: string;
};

export type WebGLMediaVideoSourceDescriptor = {
  kind: "media";
  type: "video";
  anchor: HTMLElement;
  element?: HTMLVideoElement;
  src: string;
  playback?: WebGLMediaVideoPlaybackDeclaration;
};

export type WebGLMediaImageSequenceSourceDescriptor = {
  kind: "media";
  type: "image-sequence";
  anchor: HTMLElement;
  frameCount: number;
  frames: readonly WebGLImageSequenceFrame[];
  progressKey?: string;
  startFrame: number;
};

export type WebGLModelSourceDescriptor = {
  kind: "model";
  type: "glb";
  anchor: HTMLElement;
  src: string;
};
