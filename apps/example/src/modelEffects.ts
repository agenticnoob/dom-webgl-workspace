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

type ModelFloatGlowParams = {
  kind: "example.modelFloatGlow";
  amplitude?: number;
  speed?: number;
  emissive?: string;
  lightIntensity?: number;
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

export const exampleModelFloatGlowEffect = defineWebGLEffect<ModelFloatGlowParams>({
  kind: "example.modelFloatGlow",
  source: "model/glb",
  setup(ctx, params) {
    const bloom = ctx.object.postprocess.request({
      key: `${ctx.key}.bloom`,
      bloom: { strength: 0.42, radius: 0.24, threshold: 0.62 },
    });
    ctx.resources.addDisposable(() => bloom.dispose());

    const emissive = params.emissive ?? "#7dd3fc";
    ctx.object.material?.emissive.set(emissive, 1.4);
    const light = ctx.object.lights?.point(`${ctx.key}.glow`, {
      color: emissive,
      intensity: params.lightIntensity ?? 2.2,
      distance: 460,
      follow: "object",
    });
    if (light) {
      ctx.resources.addDisposable(() => light.dispose());
    }

    return undefined;
  },
  update(ctx, _state, params) {
    if (!ctx.object.model) {
      return;
    }

    const amplitude = clampNumber(params.amplitude, 0, 96, 32);
    const speed = clampNumber(params.speed, 0, 3, 0.42);
    const centerX = ctx.layout.left + ctx.layout.width / 2;
    const centerY = ctx.layout.top + ctx.layout.height / 2;
    const floatY = centerY + Math.sin(ctx.time / 760) * amplitude;

    ctx.object.visible = true;
    ctx.object.position.set(centerX, floatY, 0);
    ctx.object.rotation.set(
      Math.sin(ctx.time / 1100) * 0.18,
      (ctx.time / 1000) * speed,
      0,
    );
    ctx.object.scale.setScalar(1 + Math.sin(ctx.time / 900) * 0.025);
  },
});
