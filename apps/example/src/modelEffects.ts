import { defineWebGLEffect } from "@project/dom-webgl-runtime";

import { clampNumber } from "./effectMath";

type ModelSpinParams = {
  kind: "example.modelSpin";
  speed?: number;
};

type ModelFloatParams = {
  kind: "example.modelFloat";
  amplitude?: number;
};

export const exampleModelSpinEffect = defineWebGLEffect<ModelSpinParams>({
  kind: "example.modelSpin",
  source: "model/glb",
  update(ctx, _state, params) {
    if (!ctx.object.model) {
      return;
    }

    const speed = clampNumber(params.speed, 0, 2, 0.18);
    ctx.object.visible = true;
    ctx.object.rotation.set(0, (ctx.time / 1000) * speed, 0);
  },
});

export const exampleModelFloatEffect = defineWebGLEffect<ModelFloatParams>({
  kind: "example.modelFloat",
  source: "model/glb",
  update(ctx, _state, params) {
    if (!ctx.object.model) {
      return;
    }

    const amplitude = clampNumber(params.amplitude, 0, 80, 28);
    const y = ctx.layout.top + ctx.layout.height / 2 + Math.sin(ctx.time / 700) * amplitude;

    ctx.object.visible = true;
    ctx.object.position.set(ctx.layout.left + ctx.layout.width / 2, y, 0);
    ctx.object.rotation.set(Math.sin(ctx.time / 1000) * 0.18, ctx.time / 1800, 0);
  },
});
