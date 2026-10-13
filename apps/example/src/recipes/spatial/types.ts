import type { Vector3 } from "./math";

export type FaceIndex = 0 | 1 | 2 | 3;
export type FourFaces<T> = readonly [T, T, T, T];

export type SpatialPalette = {
  readonly background: string;
  readonly foreground: string;
};

export type PortalPanelContent = {
  readonly label: string;
  readonly title: string;
  readonly description: string;
};

export type PortalChapter = {
  readonly id: string;
  readonly entry: PortalPanelContent;
  readonly paragraphs?: readonly string[];
  readonly exit?: PortalPanelContent;
  readonly link?: { readonly href: string; readonly label: string };
};

export type ReliefModel = {
  readonly src: string;
  readonly dracoPath?: string;
  /** Center and largest dimension in the asset's original coordinate system. */
  readonly center?: Vector3;
  readonly size?: number;
  readonly face?: FaceIndex;
  readonly bodyScale?: number;
};

export type SpatialMotion = {
  readonly breathing?: number;
  readonly floating?: number;
  readonly parallax?: number;
  readonly dampingMs?: number;
  readonly rimStrength?: number;
  readonly pointerLight?: number;
  /** Multiplier for the tremor during a pointer hold; 0 disables it. */
  readonly holdShake?: number;
};

export type SpatialViewport = {
  readonly width: number;
  readonly height: number;
  readonly left: number;
  readonly top: number;
  readonly windowHeight: number;
  readonly windowWidth: number;
};
