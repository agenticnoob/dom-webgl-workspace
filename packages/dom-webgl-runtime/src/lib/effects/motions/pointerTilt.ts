import type { WebGLEffectTarget } from "../effectTarget";
import type { NormalizedWebGLMotionDeclaration } from "../effectNormalization";
import type { WebGLFrameInput } from "../../types";

export function applyPointerTilt(
  target: WebGLEffectTarget | undefined,
  input: WebGLFrameInput,
  motion: NormalizedWebGLMotionDeclaration,
): void {
  if (!target?.setRotation) {
    return;
  }

  if (!input.pointer.isInside) {
    target.setRotation(0, 0);
    return;
  }

  const maxRadians = (motion.maxDegrees * motion.strength * Math.PI) / 180;

  target.setRotation(
    input.pointer.normalizedY * maxRadians,
    input.pointer.normalizedX * maxRadians,
  );
}
