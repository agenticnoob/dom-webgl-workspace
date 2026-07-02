export type WebGLEffectColorValue =
  | string
  | number
  | readonly [number, number, number];

export type WebGLEffectColorLike = {
  readonly value: string;
  set(value: WebGLEffectColorValue): void;
};

export type WebGLEffectEmissiveLike = WebGLEffectColorLike & {
  readonly intensity: number;
  set(value: WebGLEffectColorValue, intensity?: number): void;
};
