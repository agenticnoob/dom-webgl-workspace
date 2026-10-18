/** Keyed progress values (scroll adapters clamp them to 0..1); unknown keys read 0. */
export type WebGLProgressSignalSource = {
  get(key: string): number;
  subscribe?(listener: () => void): () => void;
};

export type WebGLScrollMetrics = {
  scrollY: number;
  scrollHeight: number;
  viewportHeight: number;
};

export type WebGLScrollDeltaRouter = (deltaY: number) => boolean;
export type WebGLScrollGateState =
  { active: false } | { active: true; key: string; progress: number };

/** External adapters remain owned by the component that creates them. */
export type WebGLScrollAdapter = {
  readonly kind?: string;
  readMetrics(): WebGLScrollMetrics;
  connectDeltaRouter?(router: WebGLScrollDeltaRouter): () => void;
  subscribe?(listener: () => void): () => void;
  onGateStateChange?(state: WebGLScrollGateState): void;
  dispose?(): void;
};
