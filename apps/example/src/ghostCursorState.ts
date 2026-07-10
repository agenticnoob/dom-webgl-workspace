import type {
  WebGLEffectMaterialLayerHandle,
  WebGLEffectUpdateContext,
} from "@viselora/dom-webgl";

import type { TargetLocalPointer } from "./surfacePointer";

export type SurfaceGhostCursorState = {
  intensity: number;
  layer: WebGLEffectMaterialLayerHandle | undefined;
  pointerX: number;
  pointerY: number;
  trail: readonly [number, number][];
};

export function createSurfaceGhostCursorState(
  ctx: WebGLEffectUpdateContext,
): SurfaceGhostCursorState {
  return {
    intensity: 0,
    layer: undefined,
    pointerX: ctx.layout.width * 0.5,
    pointerY: ctx.layout.height * 0.5,
    trail: createInitialTrail(ctx.layout.width * 0.5, ctx.layout.height * 0.5),
  };
}

export function updateSurfaceGhostCursorState(
  state: SurfaceGhostCursorState,
  pointer: TargetLocalPointer,
): boolean {
  if (pointer.active) {
    state.pointerX += (pointer.x - state.pointerX) * 0.44;
    state.pointerY += (pointer.y - state.pointerY) * 0.44;
    state.intensity += (1 - state.intensity) * 0.36;
    state.trail = pushTrailPoint(state.trail, state.pointerX, state.pointerY);
    return true;
  }

  if (state.intensity < ghostCursorIdleThreshold) {
    state.intensity = 0;
    return false;
  }

  state.intensity *= 0.82;
  state.trail = pushTrailPoint(state.trail, state.pointerX, state.pointerY);
  return true;
}

function createInitialTrail(x: number, y: number): readonly [number, number][] {
  return Array.from(
    { length: maxGhostCursorTrailLength },
    () => [x, y] satisfies [number, number],
  );
}

function pushTrailPoint(
  trail: readonly [number, number][],
  x: number,
  y: number,
): readonly [number, number][] {
  const point = [x, y] satisfies [number, number];

  return [point, ...trail].slice(0, maxGhostCursorTrailLength);
}

const maxGhostCursorTrailLength = 50;
const ghostCursorIdleThreshold = 0.0001;
