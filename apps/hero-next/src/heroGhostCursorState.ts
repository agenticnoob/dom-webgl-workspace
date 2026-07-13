import {
  heroGhostTrailLengths,
  type HeroGhostLayer,
} from "./heroGhostCursorProgram";

export type HeroGhostCursorState = {
  readonly layer: HeroGhostLayer;
  readonly reducedMotion: boolean;
  intensity: number;
  pointerX: number;
  pointerY: number;
  trail: readonly [number, number][];
};

export type HeroGhostPointerInput = {
  readonly active: boolean;
  readonly x: number;
  readonly y: number;
};

export function createHeroGhostCursorState(
  layer: HeroGhostLayer,
  width: number,
  height: number,
  reducedMotion: boolean,
): HeroGhostCursorState {
  const pointerX = width * 0.5;
  const pointerY = height * 0.5;
  return {
    layer,
    reducedMotion,
    intensity: reducedMotion && layer === "background" ? 0.22 : 0,
    pointerX,
    pointerY,
    trail: Array.from(
      { length: heroGhostTrailLengths[layer] },
      () => [pointerX, pointerY] satisfies [number, number],
    ),
  };
}

export function stepHeroGhostCursorState(
  state: HeroGhostCursorState,
  input: HeroGhostPointerInput,
): void {
  if (state.reducedMotion) {
    state.intensity = state.layer === "background" ? 0.22 : 0;
    return;
  }

  if (input.active) {
    state.pointerX += (input.x - state.pointerX) * 0.44;
    state.pointerY += (input.y - state.pointerY) * 0.44;
    state.intensity += (1 - state.intensity) * 0.36;
  } else {
    state.intensity *= state.layer === "background" ? 0.82 : 0.68;
    if (state.intensity < 0.0001) {
      state.intensity = 0;
    }
  }

  state.trail = [
    [state.pointerX, state.pointerY] satisfies [number, number],
    ...state.trail,
  ].slice(0, heroGhostTrailLengths[state.layer]);
}
