export type WavesConfig = {
  readonly cursorForce: number;
  readonly cursorStep: number;
  readonly friction: number;
  readonly maxCursorMove: number;
  readonly minHoverVelocity: number;
  readonly pointerFollow: number;
  readonly tension: number;
  readonly velocityFollow: number;
  readonly waveAmpX: number;
  readonly waveAmpY: number;
  readonly waveSpeedX: number;
  readonly waveSpeedY: number;
  readonly xGap: number;
  readonly yGap: number;
};

export const defaultWavesConfig = {
  cursorForce: 0.00115,
  cursorStep: 3.4,
  friction: 0.82,
  maxCursorMove: 100,
  minHoverVelocity: 38,
  pointerFollow: 0.82,
  tension: 0.018,
  velocityFollow: 0.68,
  waveAmpX: 32,
  waveAmpY: 16,
  waveSpeedX: 0.08,
  waveSpeedY: 0.032,
  xGap: 10,
  yGap: 32,
} satisfies WavesConfig;
