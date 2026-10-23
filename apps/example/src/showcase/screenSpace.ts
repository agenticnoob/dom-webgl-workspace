import { PerspectiveCamera, Vector3, type Camera, type Object3D } from "three";

export type CSSRect = {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
};

export type CSSViewport = { readonly width: number; readonly height: number };

const local = new Vector3();

/**
 * Places a 1×1 plane `distance` in front of a perspective camera so it covers
 * `rect` (CSS pixels of the canvas viewport). Works while the camera moves and
 * turns; call it after the camera's matrices are updated for this frame.
 * Returns false for non-perspective cameras.
 */
export function coverRect(
  object: Object3D,
  camera: Camera,
  rect: CSSRect,
  viewport: CSSViewport,
  distance = 1,
) {
  if (!(camera instanceof PerspectiveCamera)) return false;
  const height = 2 * distance * Math.tan((camera.fov * Math.PI) / 360);
  const width = height * camera.aspect;
  const w = Math.max(1, viewport.width);
  const h = Math.max(1, viewport.height);
  local.set(
    ((rect.left + rect.width / 2) / w - 0.5) * width,
    (0.5 - (rect.top + rect.height / 2) / h) * height,
    -distance,
  );
  object.position.copy(local.applyMatrix4(camera.matrixWorld));
  object.quaternion.copy(camera.quaternion);
  object.scale.set((rect.width / w) * width, (rect.height / h) * height, 1);
  return true;
}

/** Covers the whole viewport, slightly oversized so edges never show. */
export function coverViewport(
  object: Object3D,
  camera: Camera,
  viewport: CSSViewport,
  distance: number,
) {
  const margin = 0.02;
  return coverRect(
    object,
    camera,
    {
      left: -viewport.width * margin,
      top: -viewport.height * margin,
      width: viewport.width * (1 + 2 * margin),
      height: viewport.height * (1 + 2 * margin),
    },
    viewport,
    distance,
  );
}

/** Frame-rate independent exponential approach; `smoothing` in seconds. */
export function damp(
  current: number,
  goal: number,
  smoothing: number,
  delta: number,
) {
  if (smoothing <= 0) return goal;
  return current + (goal - current) * (1 - Math.exp(-delta / smoothing));
}

export function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

/** Hash for per-cell randomness shared by the veil shaders. */
export const cellHash = /* glsl */ `
float cellHash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}`;
