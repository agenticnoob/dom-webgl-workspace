import type { ElementLayoutSnapshot } from "../renderer/layoutPass";
import type { WebGLSourceDescriptor } from "../source/sourceDescriptor";
import type { WebGLEffectsDeclaration, WebGLFrameInput } from "../types";
import { assertMaterialSourceCompatibility } from "./effectCompatibility";
import type { WebGLEffectTarget } from "./effectTarget";
import { normalizeWebGLEffectsDeclaration } from "./effectNormalization";
import type { NormalizedWebGLMaterialDeclaration } from "./effectNormalization";
import { applyPointerTilt } from "./motions/pointerTilt";

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
    update(input, layout): void {
      if (disposed) {
        return;
      }

      const target = readEffectTarget(options);

      if (effects.material && !materialApplied) {
        if (!applyMaterialEffect(target, effects.material, layout)) {
          return;
        }
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

function applyMaterialEffect(
  target: WebGLEffectTarget | undefined,
  material: NormalizedWebGLMaterialDeclaration,
  layout: ElementLayoutSnapshot,
): boolean {
  if (material.kind === "solid") {
    if (!target?.applySolidMaterial) {
      return false;
    }

    target.applySolidMaterial({
      color: material.color,
      opacity: material.opacity,
    });
    return true;
  }

  if (!target?.applySurfaceMaterial) {
    return false;
  }

  target.applySurfaceMaterial(material, {
    width: layout.width,
    height: layout.height,
    devicePixelRatio: layout.devicePixelRatio,
  });
  return true;
}
