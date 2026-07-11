// GLB lifecycle is verified, but DOM-anchored visible output is blocked in 0.1.0-alpha.0.
// Read capability-status.md before using this retained reproduction.
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  defineWebGLEffect,
  type WebGLDeclaration,
} from "@viselora/dom-webgl";
import { WebGLTarget } from "@viselora/dom-webgl/react";
import { WebGLScrollTimeline } from "@viselora/scroll-adapters/react";

type ModelGlowParams = {
  kind: "viselora.modelGlow";
  progressKey: string;
  clip: string;
  durationSeconds: number;
  color?: string;
};

type ModelGlowState = { lightRegistered: boolean };

export const modelGlowEffect = defineWebGLEffect<ModelGlowParams, ModelGlowState>({
  kind: "viselora.modelGlow",
  source: "model/glb",
  setup() {
    return { lightRegistered: false };
  },
  update(ctx, state, params) {
    const progress = Math.min(1, Math.max(0, ctx.progress.get(params.progressKey)));
    const color = params.color ?? "#f6c453";

    ctx.object.visible = true;
    ctx.object.animation?.scrub(params.clip, {
      progress,
      durationSeconds: params.durationSeconds,
    });
    ctx.object.material?.emissive.set(color, 0.4 + progress * 1.6);
    ctx.object.model?.meshes.forEach((mesh) => {
      mesh.material.emissive.set(color, 0.3 + progress * 1.2);
    });
    const glowLight = ctx.object.lights?.point(`${ctx.key}.glow`, {
      color,
      intensity: 0.8 + progress * 2.2,
      distance: 420,
      position: [0, 80, 140],
      follow: "object",
    });
    if (glowLight && !state.lightRegistered) {
      ctx.resources.addDisposable(() => glowLight.dispose());
      state.lightRegistered = true;
    }
    ctx.object.rotation.set(0, (progress - 0.5) * 0.7, 0);
  },
  dispose(ctx) {
    ctx.object.lights?.remove(`${ctx.key}.glow`);
  },
});

const progressKey = "model-glow-progress";

const pinnedModelDeclaration = {
  key: "viselora.pinned-model",
  timeline: { id: progressKey, progressKey },
  source: { kind: "model", type: "glb", src: "/models/product.glb" },
  lifecycle: {
    hideWhenReady: true,
    hideMode: "self",
    offscreen: { strategy: "park", warmTtlMs: 20_000 },
  },
  effects: [
    {
      kind: "viselora.modelGlow",
      progressKey,
      clip: "Reveal",
      durationSeconds: 2,
    },
  ],
} satisfies WebGLDeclaration;

gsap.registerPlugin(ScrollTrigger);

export function PinnedModelGlow() {
  return (
    <WebGLScrollTimeline
      id={progressKey}
      pin
      scrub
      ScrollTrigger={ScrollTrigger}
    >
      <WebGLTarget
        as="section"
        webgl={pinnedModelDeclaration}
      >
        <p>Interactive product model loading…</p>
      </WebGLTarget>
    </WebGLScrollTimeline>
  );
}
