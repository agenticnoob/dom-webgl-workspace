import { defineWebGLSceneObjectEffect } from "@project/dom-webgl-runtime";

import { clampNumber } from "./effectMath";

type SceneObjectHoverPulseParams = {
  kind: "example.sceneObjectHoverPulse";
  baseOpacity?: number;
  hoverOpacity?: number;
  clickOpacity?: number;
};

type PhysicsKinematicSweepParams = {
  kind: "example.physicsKinematicSweep";
  baseX?: number;
  amplitude?: number;
  y?: number;
  z?: number;
  speed?: number;
};

type ClickPulseState = {
  clickUntil: number;
};

const clickPulseDurationMs = 260;

export const exampleSceneObjectHoverPulseEffect =
  defineWebGLSceneObjectEffect<SceneObjectHoverPulseParams, ClickPulseState>({
    kind: "example.sceneObjectHoverPulse",
    source: ["stage/plane", "stage/box", "model/glb"],
    setup() {
      return { clickUntil: 0 };
    },
    update(ctx, state, params) {
      const baseOpacity = clampNumber(params.baseOpacity, 0, 1, 0.72);
      const hoverOpacity = clampNumber(params.hoverOpacity, 0, 1, 0.9);
      const clickOpacity = clampNumber(params.clickOpacity, 0, 1, 1);
      const clickPulse = readClickPulse(ctx.objectPointer.wasClicked, ctx.time, state);

      ctx.object.opacity =
        clickPulse > 0
          ? clickOpacity
          : ctx.objectPointer.isHovered
            ? hoverOpacity
            : baseOpacity;
    },
  });

export const examplePhysicsKinematicSweepEffect =
  defineWebGLSceneObjectEffect<PhysicsKinematicSweepParams>({
    kind: "example.physicsKinematicSweep",
    source: "model/glb",
    schedule: "frame",
    update(ctx, _state, params) {
      const baseX = params.baseX ?? 252;
      const amplitude = clampNumber(params.amplitude, 0, 220, 68);
      const speed = clampNumber(params.speed, 0, 8, 0.0012);
      const y = params.y ?? -132;
      const z = params.z ?? -70;
      const x = baseX + Math.sin(ctx.time * speed) * amplitude;

      ctx.object.position.set(x, y, z);
    },
  });

function readClickPulse(
  wasClicked: boolean,
  time: number,
  state: ClickPulseState,
): number {
  if (wasClicked) {
    state.clickUntil = time + clickPulseDurationMs;
  }

  return clampNumber(
    (state.clickUntil - time) / clickPulseDurationMs,
    0,
    1,
    0,
  );
}
