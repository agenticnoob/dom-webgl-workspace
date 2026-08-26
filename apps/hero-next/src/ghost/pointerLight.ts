import type { WebGLEffectLightsFacade } from "@viselora/dom-webgl";

export type HeroPointerLightState = {
  readonly reducedMotion: boolean;
  x: number;
  y: number;
  z: number;
  intensity: number;
};

type HeroPointerLightTargetInput = {
  readonly localX: number;
  readonly localY: number;
  readonly width: number;
  readonly height: number;
};

type HeroPointerLightInput = HeroPointerLightTargetInput & {
  readonly active: boolean;
  readonly delta: number;
};

export const heroPointerLightKey = "hero.pointer-light";

const heroPointerLightPosition = [0, 0.365, 0.8] satisfies readonly [
  number,
  number,
  number,
];
const heroPointerLightIntensity = 10;
const heroPointerLightReducedMotionIntensity = 0.45;

export function createHeroPointerLightState(
  reducedMotion: boolean,
): HeroPointerLightState {
  return {
    reducedMotion,
    x: heroPointerLightPosition[0],
    y: heroPointerLightPosition[1],
    z: heroPointerLightPosition[2],
    intensity: reducedMotion ? heroPointerLightReducedMotionIntensity : 0,
  };
}

export function resolveHeroPointerLightTarget({
  localX,
  localY,
  width,
  height,
}: HeroPointerLightTargetInput): [number, number, number] {
  const normalizedX = width > 0 ? clamp((localX / width) * 2 - 1, -1, 1) : 0;
  const normalizedY = height > 0 ? clamp(1 - (localY / height) * 2, -1, 1) : 0;

  return [
    normalizedX * 1.05,
    heroPointerLightPosition[1] + normalizedY * 0.72,
    heroPointerLightPosition[2],
  ];
}

export function updateHeroPointerLight(
  lights: WebGLEffectLightsFacade | undefined,
  state: HeroPointerLightState,
  input: HeroPointerLightInput,
): void {
  if (state.reducedMotion) {
    state.x = heroPointerLightPosition[0];
    state.y = heroPointerLightPosition[1];
    state.z = heroPointerLightPosition[2];
    state.intensity = heroPointerLightReducedMotionIntensity;
  } else {
    const delta = clamp(input.delta, 0, 64);

    if (input.active) {
      const [targetX, targetY, targetZ] = resolveHeroPointerLightTarget(input);
      const positionDamping = 1 - Math.exp(-delta / 90);
      state.x += (targetX - state.x) * positionDamping;
      state.y += (targetY - state.y) * positionDamping;
      state.z += (targetZ - state.z) * positionDamping;
    }

    const targetIntensity = input.active ? heroPointerLightIntensity : 0;
    const intensityDamping = 1 - Math.exp(-delta / (input.active ? 120 : 180));
    state.intensity += (targetIntensity - state.intensity) * intensityDamping;
    if (state.intensity < 0.0001) {
      state.intensity = 0;
    }
  }

  lights?.point(heroPointerLightKey, {
    color: "#f0f0f0",
    intensity: state.intensity,
    distance: 1.8,
    decay: 3,
    position: [state.x, state.y, state.z],
    follow: "none",
  });
}

export function disposeHeroPointerLight(
  lights: WebGLEffectLightsFacade | undefined,
): void {
  lights?.remove(heroPointerLightKey);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
