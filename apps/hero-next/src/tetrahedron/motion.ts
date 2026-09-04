import { heroTransitionConfig } from "../transition/transitionConfig";

export type HeroMotionState = {
  readonly reducedMotion: boolean;
  previousPointerX: number;
  previousPointerY: number;
  lastSignificantMoveTime: number;
  tiltX: number;
  tiltY: number;
  targetTiltX: number;
  targetTiltY: number;
};

export type HeroMotionInput = {
  readonly time: number;
  readonly delta: number;
  readonly pointerInside: boolean;
  readonly pointerX: number;
  readonly pointerY: number;
};

export function createHeroMotionState(reducedMotion: boolean): HeroMotionState {
  return {
    reducedMotion,
    previousPointerX: 0,
    previousPointerY: 0,
    lastSignificantMoveTime: 0,
    tiltX: 0,
    tiltY: 0,
    targetTiltX: 0,
    targetTiltY: 0,
  };
}

export function stepHeroMotionState(
  state: HeroMotionState,
  input: HeroMotionInput,
): void {
  if (state.reducedMotion) {
    state.tiltX = 0;
    state.tiltY = 0;
    state.targetTiltX = 0;
    state.targetTiltY = 0;
    return;
  }

  const movement = Math.hypot(
    input.pointerX - state.previousPointerX,
    input.pointerY - state.previousPointerY,
  );
  const nearCenter = Math.hypot(input.pointerX, input.pointerY) <= 0.75;
  const moving = input.pointerInside && nearCenter && movement >= 0.0025;

  if (moving) {
    state.lastSignificantMoveTime = input.time;
    state.targetTiltX = clamp(
      -input.pointerY * heroTransitionConfig.motion.pointerPitch,
      -heroTransitionConfig.motion.pointerPitch,
      heroTransitionConfig.motion.pointerPitch,
    );
    state.targetTiltY = clamp(
      input.pointerX * heroTransitionConfig.motion.pointerYaw,
      -heroTransitionConfig.motion.pointerYaw,
      heroTransitionConfig.motion.pointerYaw,
    );
  } else if (input.time - state.lastSignificantMoveTime >= 120) {
    state.targetTiltX = 0;
    state.targetTiltY = 0;
  }

  const damping =
    1 -
    Math.exp(
      -Math.max(0, input.delta) / heroTransitionConfig.motion.pointerDampingMs,
    );
  state.tiltX += (state.targetTiltX - state.tiltX) * damping;
  state.tiltY += (state.targetTiltY - state.tiltY) * damping;
  state.previousPointerX = input.pointerX;
  state.previousPointerY = input.pointerY;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
