import type { ElementLayoutSnapshot } from "../renderer/layoutPass";
import type { WebGLSourceDescriptor } from "../source/sourceDescriptor";
import type { WebGLEffectsDeclaration, WebGLFrameInput } from "../types";
import { assertMaterialSourceCompatibility } from "./effectCompatibility";
import { normalizeWebGLEffectsDeclaration } from "./effectNormalization";
import type { NormalizedWebGLMotionDeclaration } from "./effectNormalization";

export type WebGLEffectTarget = {
  applySolidMaterial?(material: { color: number; opacity: number }): void;
  setRotation?(x: number, y: number): void;
  disposeEffects?(): void;
};

export type WebGLEffectController = {
  readonly hasEffects: boolean;
  update(input: WebGLFrameInput, layout: ElementLayoutSnapshot): void;
  dispose(): void;
};

export type WebGLEffectControllerOptions = {
  key: string;
  declaration?: WebGLEffectsDeclaration;
  source: WebGLSourceDescriptor;
  target?: WebGLEffectTarget;
  getTarget?(): WebGLEffectTarget | undefined;
};

export function createWebGLEffectController(
  options: WebGLEffectControllerOptions,
): WebGLEffectController {
  const effects = normalizeWebGLEffectsDeclaration(options.declaration);
  let disposed = false;
  let materialApplied = false;

  if (effects.material) {
    assertMaterialSourceCompatibility(
      options.key,
      effects.material,
      options.source,
    );
  }

  return {
    get hasEffects() {
      return !!effects.material || !!effects.motion;
    },
    update(input): void {
      if (disposed) {
        return;
      }

      const target = readEffectTarget(options);

      if (effects.material && !materialApplied) {
        if (!target?.applySolidMaterial) {
          return;
        }

        target.applySolidMaterial({
          color: effects.material.color,
          opacity: effects.material.opacity,
        });
        materialApplied = true;
      }

      if (effects.motion) {
        applyPointerTilt(target, input, effects.motion);
      }
    },
    dispose(): void {
      if (disposed) {
        return;
      }

      disposed = true;
      readEffectTarget(options)?.disposeEffects?.();
    },
  };
}

function readEffectTarget(
  options: WebGLEffectControllerOptions,
): WebGLEffectTarget | undefined {
  return options.getTarget?.() ?? options.target;
}

function applyPointerTilt(
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

  const maxRadians = degreesToRadians(motion.maxDegrees * motion.strength);

  target.setRotation(
    input.pointer.normalizedY * maxRadians,
    input.pointer.normalizedX * maxRadians,
  );
}

function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}
