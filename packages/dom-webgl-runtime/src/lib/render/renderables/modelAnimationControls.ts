import { AnimationMixer } from "three/src/animation/AnimationMixer.js";
import { LoopOnce, LoopRepeat } from "three/src/constants.js";
import type { Object3D } from "three/src/core/Object3D.js";

import type {
  WebGLEffectAnimationFacade,
  WebGLEffectAnimationPlayOptions,
} from "../../effects/effectObject";

type AnimationClipLike = {
  name?: string;
};

type AnimationActionLike = {
  reset(): AnimationActionLike;
  play(): AnimationActionLike;
  stop(): AnimationActionLike;
  fadeIn?(durationSeconds: number): AnimationActionLike;
  setLoop?(mode: number, repetitions: number): AnimationActionLike;
  timeScale?: number;
};

export type ModelAnimationController = WebGLEffectAnimationFacade & {
  update(deltaMilliseconds: number): void;
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

  return {
    clips() {
      return clips.map((clip, index) => readClipName(clip, index));
    },
    play(name, options = {}) {
      const clip = clips.find(
        (candidate, index) => readClipName(candidate, index) === name,
      );
      if (!clip) {
        return;
      }
      const action = readAction(mixer, clip);
      applyPlayOptions(action, options);
      action.reset().play();
      actionsByName.set(name, action);
    },
    stop(name) {
      actionsByName.get(name)?.stop();
      actionsByName.delete(name);
    },
    stopAll() {
      for (const action of actionsByName.values()) {
        action.stop();
      }
      actionsByName.clear();
    },
    setTime(seconds) {
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
      mixer.update(Math.max(0, deltaMilliseconds) / 1000);
    },
    dispose() {
      this.stopAll();
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
}

function applyPlayOptions(
  action: AnimationActionLike,
  options: WebGLEffectAnimationPlayOptions,
): void {
  if (options.loop) {
    action.setLoop?.(
      options.loop === "once" ? LoopOnce : LoopRepeat,
      options.loop === "once" ? 1 : Infinity,
    );
  }
  if (options.fadeInMs) {
    action.fadeIn?.(Math.max(0, options.fadeInMs) / 1000);
  }
  if (options.timeScale !== undefined) {
    action.timeScale = options.timeScale;
  }
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
