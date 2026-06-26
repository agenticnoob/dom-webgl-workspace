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
    if (ctx.source.kind !== "model/glb") {
      return;
    }

    const speed = clampNumber(params.speed, 0, 2, 0.18);
    ctx.target?.setVisible(true);
    ctx.target?.setRotation(0, (ctx.time / 1000) * speed, 0);
  },
});

export const exampleModelFloatEffect = defineWebGLEffect<ModelFloatParams>({
  kind: "example.modelFloat",
  source: "model/glb",
  update(ctx, _state, params) {
    if (ctx.source.kind !== "model/glb") {
      return;
    }

    const amplitude = clampNumber(params.amplitude, 0, 80, 28);
    const y = ctx.layout.top + ctx.layout.height / 2 + Math.sin(ctx.time / 700) * amplitude;

    ctx.target?.setVisible(true);
    ctx.target?.setPosition(ctx.layout.left + ctx.layout.width / 2, y, 0);
    ctx.target?.setRotation(Math.sin(ctx.time / 1000) * 0.18, ctx.time / 1800, 0);
  },
});
