import type { WebGLEffectUpdateContext } from "@project/dom-webgl-runtime";

import type { TargetLocalPointer } from "./surfacePointer";

export type SurfaceGhostCursorState = {
  intensity: number;
  pointerX: number;
  pointerY: number;
};

export function createSurfaceGhostCursorState(
  ctx: WebGLEffectUpdateContext,
): SurfaceGhostCursorState {
  return {
    intensity: 0,
    pointerX: ctx.layout.width * 0.5,
    pointerY: ctx.layout.height * 0.5,
  };
}

export function updateSurfaceGhostCursorState(
  state: SurfaceGhostCursorState,
  pointer: TargetLocalPointer,
): void {
  if (pointer.active) {
    state.pointerX += (pointer.x - state.pointerX) * 0.44;
    state.pointerY += (pointer.y - state.pointerY) * 0.44;
    state.intensity += (1 - state.intensity) * 0.36;
    return;
  }

  state.intensity *= 0.82;
}
