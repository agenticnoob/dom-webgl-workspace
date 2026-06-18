import type { ElementLayoutSnapshot } from "../renderer/layoutPass";
import type { WebGLSourceDescriptor } from "../source/sourceDescriptor";
import type {
  WebGLEffectsDeclaration,
  WebGLFrameInput,
  WebGLMaterialDeclaration,
  WebGLMotionDeclaration,
} from "../types";

export type NormalizedWebGLMaterialDeclaration = {
  kind: "solid";
  color: number;
  opacity: number;
};

export type NormalizedWebGLMotionDeclaration = {
  kind: "pointer-tilt";
  strength: number;
  maxDegrees: number;
};

export type NormalizedWebGLEffectsDeclaration = {
  material?: NormalizedWebGLMaterialDeclaration;
  motion?: NormalizedWebGLMotionDeclaration;
};

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

const defaultMaterial = {
  color: 0xffffff,
  opacity: 1,
};

const defaultMotion = {
  strength: 1,
  maxDegrees: 8,
};

export function normalizeWebGLEffectsDeclaration(
  declaration: WebGLEffectsDeclaration | undefined,
): NormalizedWebGLEffectsDeclaration {
  if (!declaration) {
    return {};
  }

  return {
    material: declaration.material
      ? normalizeMaterialDeclaration(declaration.material)
      : undefined,
    motion: declaration.motion
      ? normalizeMotionDeclaration(declaration.motion)
      : undefined,
  };
}

export function createWebGLEffectController(
  options: WebGLEffectControllerOptions,
): WebGLEffectController {
  const effects = normalizeWebGLEffectsDeclaration(options.declaration);
  let disposed = false;
  let materialApplied = false;

  if (effects.material) {
    assertSolidMaterialSource(options.key, options.source);
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

function normalizeMaterialDeclaration(
  material: WebGLMaterialDeclaration,
): NormalizedWebGLMaterialDeclaration {
  return {
    kind: "solid",
    color: clampInteger(material.color, 0, 0xffffff, defaultMaterial.color),
    opacity: clampNumber(material.opacity, 0, 1, defaultMaterial.opacity),
  };
}

function normalizeMotionDeclaration(
  motion: WebGLMotionDeclaration,
): NormalizedWebGLMotionDeclaration {
  return {
    kind: "pointer-tilt",
    strength: clampNumber(motion.strength, 0, 1, defaultMotion.strength),
    maxDegrees: clampNumber(motion.maxDegrees, 0, 30, defaultMotion.maxDegrees),
  };
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

function assertSolidMaterialSource(
  key: string,
  source: WebGLSourceDescriptor,
): void {
  if (source.kind === "snapshot" && source.mode === "element") {
    return;
  }

  throw new Error(
    `WebGL target "${key}" uses solid material on unsupported source "${readSourceKind(
      source,
    )}". Solid material effects support only snapshot/element targets.`,
  );
}

function readSourceKind(source: WebGLSourceDescriptor): string {
  if (source.kind === "snapshot") {
    return `snapshot/${source.mode}`;
  }

  if (source.kind === "model") {
    return `model/${source.format}`;
  }

  return source.kind;
}

function clampInteger(
  value: number | undefined,
  min: number,
  max: number,
  fallback: number,
): number {
  return Math.round(clampNumber(value, min, max, fallback));
}

function clampNumber(
  value: number | undefined,
  min: number,
  max: number,
  fallback: number,
): number {
  if (value === undefined || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, value));
}

function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}
