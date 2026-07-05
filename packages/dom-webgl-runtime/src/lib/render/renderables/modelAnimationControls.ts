import { AnimationMixer } from "three/src/animation/AnimationMixer.js";
import { LoopOnce, LoopRepeat } from "three/src/constants.js";
import type { Object3D } from "three/src/core/Object3D.js";

import type {
  WebGLEffectAnimationBlendOptions,
  WebGLEffectAnimationCrossfadeOptions,
  WebGLEffectAnimationFacade,
  WebGLEffectAnimationPlayOptions,
  WebGLEffectAnimationScrubOptions,
} from "../../effects/effectObject";

type AnimationClipLike = {
  name?: string;
};

type AnimationActionLike = {
  reset(): AnimationActionLike;
  play(): AnimationActionLike;
  stop(): AnimationActionLike;
  fadeIn?(durationSeconds: number): AnimationActionLike;
  fadeOut?(durationSeconds: number): AnimationActionLike;
  setLoop?(mode: number, repetitions: number): AnimationActionLike;
  setEffectiveWeight?(weight: number): AnimationActionLike;
  crossFadeTo?(
    action: AnimationActionLike,
    durationSeconds: number,
    warp: boolean,
  ): AnimationActionLike;
  clampWhenFinished?: boolean;
  time?: number;
  timeScale?: number;
  weight?: number;
};

export type ModelAnimationDiagnostic = {
  readonly kind: "missing-clip";
  readonly name: string;
};

export type ModelAnimationInspection = {
  readonly activeClips: readonly string[];
  readonly diagnostics: readonly ModelAnimationDiagnostic[];
};

export type ModelAnimationController = WebGLEffectAnimationFacade & {
  update(deltaMilliseconds: number): void;
  inspect(): ModelAnimationInspection;
  dispose(): void;
};

export function createModelAnimationController(
  model: unknown,
): ModelAnimationController | undefined {
  const scene = readModelScene(model);
  const clips = readAnimationClips(model);

  if (!scene || clips.length === 0) {
    return undefined;
  }

  const mixer = new AnimationMixer(scene as Object3D);
  const actionsByName = new Map<string, AnimationActionLike>();
  const diagnostics: ModelAnimationDiagnostic[] = [];
  let disposed = false;

  return {
    clips() {
      return clips.map((clip, index) => readClipName(clip, index));
    },
    play(name, options = {}) {
      const action = readOrCreateAction(name);
      if (!action) {
        return;
      }

      applyPlayOptions(action, options);
      action.reset().play();
      actionsByName.set(name, action);
    },
    scrub(name, options) {
      const action = readOrCreateAction(name);
      if (!action) {
        return;
      }

      action.time = readScrubTime(options);
      action.play();
      actionsByName.set(name, action);
    },
    blend(from, to, options) {
      const fromAction = readOrCreateAction(from);
      const toAction = readOrCreateAction(to);

      if (!fromAction || !toAction) {
        return;
      }

      applyBlendOptions(fromAction, options);
      applyBlendOptions(toAction, options);
      fromAction.play();
      toAction.play();
      const weight = clamp01(options.weight);
      setActionWeight(fromAction, 1 - weight);
      setActionWeight(toAction, weight);
      actionsByName.set(from, fromAction);
      actionsByName.set(to, toAction);
    },
    crossFade(from, to, options = {}) {
      const fromAction = readOrCreateAction(from);
      const toAction = readOrCreateAction(to);

      if (!fromAction || !toAction) {
        return;
      }

      applyCrossfadeOptions(fromAction, options);
      applyCrossfadeOptions(toAction, options);
      fromAction.play();
      toAction.play();
      const durationSeconds = Math.max(0, options.fadeMs ?? 0) / 1000;

      if (fromAction.crossFadeTo) {
        fromAction.crossFadeTo(toAction, durationSeconds, false);
      } else {
        setActionWeight(fromAction, 0);
        setActionWeight(toAction, 1);
      }

      actionsByName.set(from, fromAction);
      actionsByName.set(to, toAction);
    },
    stop(name) {
      if (disposed) {
        return;
      }

      actionsByName.get(name)?.stop();
      actionsByName.delete(name);
    },
    stopAll() {
      if (disposed) {
        return;
      }

      for (const action of actionsByName.values()) {
        action.stop();
      }
      actionsByName.clear();
    },
    setTime(seconds) {
      if (disposed) {
        return;
      }

      if (
        "setTime" in mixer &&
        typeof (mixer as { setTime?: unknown }).setTime === "function"
      ) {
        (mixer as { setTime: (time: number) => void }).setTime(
          Math.max(0, seconds),
        );
      }
    },
    update(deltaMilliseconds) {
      if (disposed) {
        return;
      }

      mixer.update(Math.max(0, deltaMilliseconds) / 1000);
    },
    inspect() {
      return {
        activeClips: Array.from(actionsByName.keys()),
        diagnostics: diagnostics.slice(),
      };
    },
    dispose() {
      if (disposed) {
        return;
      }

      disposed = true;
      for (const action of actionsByName.values()) {
        action.stop();
      }
      actionsByName.clear();
      if (
        "uncacheRoot" in mixer &&
        typeof (mixer as { uncacheRoot?: unknown }).uncacheRoot === "function"
      ) {
        (mixer as { uncacheRoot: (root: object) => void }).uncacheRoot(
          scene as object,
        );
      }
    },
  };

  function readOrCreateAction(name: string): AnimationActionLike | undefined {
    if (disposed) {
      return undefined;
    }

    const existing = actionsByName.get(name);
    if (existing) {
      return existing;
    }

    const clip = readClip(name);
    if (!clip) {
      return undefined;
    }

    const action = readAction(mixer, clip);
    actionsByName.set(name, action);
    return action;
  }

  function readClip(name: string): AnimationClipLike | undefined {
    const clip = clips.find(
      (candidate, index) => readClipName(candidate, index) === name,
    );

    if (!clip) {
      diagnostics.push({ kind: "missing-clip", name });
    }

    return clip;
  }
}

function applyPlayOptions(
  action: AnimationActionLike,
  options: WebGLEffectAnimationPlayOptions,
): void {
  applyLoopAndTimeScale(action, options);
  if (options.fadeInMs) {
    action.fadeIn?.(Math.max(0, options.fadeInMs) / 1000);
  }
  if (options.fadeOutMs) {
    action.fadeOut?.(Math.max(0, options.fadeOutMs) / 1000);
  }
  if (options.clampWhenFinished !== undefined) {
    action.clampWhenFinished = options.clampWhenFinished;
  }
}

function applyBlendOptions(
  action: AnimationActionLike,
  options: WebGLEffectAnimationBlendOptions,
): void {
  applyLoopAndTimeScale(action, options);
}

function applyCrossfadeOptions(
  action: AnimationActionLike,
  options: WebGLEffectAnimationCrossfadeOptions,
): void {
  applyLoopAndTimeScale(action, options);
}

function applyLoopAndTimeScale(
  action: AnimationActionLike,
  options: { readonly loop?: "once" | "repeat"; readonly timeScale?: number },
): void {
  if (options.loop) {
    action.setLoop?.(
      options.loop === "once" ? LoopOnce : LoopRepeat,
      options.loop === "once" ? 1 : Infinity,
    );
  }
  if (options.timeScale !== undefined) {
    action.timeScale = options.timeScale;
  }
}

function readScrubTime(options: WebGLEffectAnimationScrubOptions): number {
  if ("timeSeconds" in options) {
    return Math.max(0, options.timeSeconds);
  }

  const durationSeconds = Number.isFinite(options.durationSeconds)
    ? Math.max(0, options.durationSeconds)
    : 0;

  return clamp01(options.progress) * durationSeconds;
}

function setActionWeight(action: AnimationActionLike, weight: number): void {
  const clamped = clamp01(weight);
  if (action.setEffectiveWeight) {
    action.setEffectiveWeight(clamped);
    return;
  }

  action.weight = clamped;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(1, Math.max(0, value));
}

function readAction(
  mixer: AnimationMixer,
  clip: AnimationClipLike,
): AnimationActionLike {
  return (mixer.clipAction as unknown as (
    candidate: AnimationClipLike,
  ) => AnimationActionLike)(clip);
}

function readModelScene(model: unknown): unknown {
  return model && typeof model === "object"
    ? (model as { scene?: unknown }).scene
    : undefined;
}

function readAnimationClips(model: unknown): readonly AnimationClipLike[] {
  const animations =
    model && typeof model === "object"
      ? (model as { animations?: unknown }).animations
      : undefined;
  return Array.isArray(animations) ? animations : [];
}

function readClipName(clip: AnimationClipLike, index: number): string {
  return clip.name && clip.name.trim() ? clip.name : `clip-${index}`;
}
