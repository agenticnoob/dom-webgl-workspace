# Effect recipes

Compatible package version: 0.1.0-alpha.0

## Contents

- [Surface pulse](#surface-pulse)
- [Video background texture](#video-background-texture)
- [Image hover overlay](#image-hover-overlay)
- [Pinned model glow](#pinned-model-glow)
- [Scroll image sequence](#scroll-image-sequence)

Register every exported effect in one module-scope `runtimeEffects` array. Copy the standalone source from `templates/effects/` when possible.

## Surface pulse

Use a DOM element as layout and fallback, draw through `ctx.object.surface`, and tune its managed material with frame time:

```ts
import { defineWebGLEffect } from "@viselora/dom-webgl";

type Params = { kind: "viselora.surfacePulse"; color?: string };

export const surfacePulseEffect = defineWebGLEffect<Params>({
  kind: "viselora.surfacePulse",
  source: "dom/element",
  schedule: "frame",
  update(ctx, _state, params) {
    const surface = ctx.object.surface;
    if (!surface) return;
    const pulse = 0.5 + Math.sin(ctx.time / 420) * 0.5;
    const color = params.color ?? "#7dd3fc";
    ctx.object.material?.color.set(color);
    surface.draw(({ context, width, height }) => {
      context.clearRect(0, 0, width, height);
      context.globalAlpha = 0.3 + pulse * 0.5;
      context.fillStyle = color;
      context.beginPath();
      context.arc(width / 2, height / 2, Math.min(width, height) * (0.2 + pulse * 0.08), 0, Math.PI * 2);
      context.fill();
    });
    ctx.object.visible = true;
  },
});

export const surfacePulseWebgl = {
  key: "app.surface-pulse",
  source: { kind: "dom", type: "element" },
  lifecycle: {
    hideWhenReady: true,
    hideMode: "self",
    offscreen: { strategy: "restore-dom" },
  },
  effects: [{ kind: "viselora.surfacePulse", color: "#7dd3fc" }],
} as const;
```

Render `surfacePulseWebgl` on a semantic `WebGLTarget` containing the readable fallback heading or copy.

## Video background texture

Keep a real DOM video fallback and control only the managed texture/video handles:

```ts
import { defineWebGLEffect } from "@viselora/dom-webgl";

type Params = { kind: "viselora.videoBackground"; playbackRate?: number };
type State = { configured: boolean };

export const videoBackgroundEffect = defineWebGLEffect<Params, State>({
  kind: "viselora.videoBackground",
  source: "media/video",
  schedule: "frame",
  setup() {
    return { configured: false };
  },
  update(ctx, state, params) {
    const video = ctx.object.video;
    const texture = ctx.object.texture;
    if (!video || !texture) return;
    if (!state.configured) {
      video.setMuted(true);
      video.setPlaybackRate(params.playbackRate ?? 1);
      void video.play();
      state.configured = true;
    }
    const drift = (Math.sin(ctx.time / 1800) + 1) * 0.015;
    texture.setTransform({
      repeatX: 1.06,
      repeatY: 1.06,
      offsetX: drift,
      offsetY: 0.03 - drift,
    });
    ctx.object.visible = true;
  },
});

export const videoBackgroundWebgl = {
  key: "app.video-background",
  source: {
    kind: "media",
    type: "video",
    src: "/media/background.mp4",
    playback: { muted: true, loop: true, playsInline: true },
  },
  lifecycle: {
    hideWhenReady: true,
    hideMode: "self",
    offscreen: { strategy: "park", warmTtlMs: 15_000 },
  },
  effects: [{ kind: "viselora.videoBackground", playbackRate: 0.9 }],
} as const;
```

Render it with `<WebGLTarget as="video" src="/media/background.mp4" muted loop playsInline ... />` so loading/error retains native fallback.

## Image hover overlay

Request managed hover input and create an effect-owned material layer. Dispose the layer with the effect:

```ts
import {
  defineWebGLEffect,
  type WebGLEffectMaterialLayerHandle,
} from "@viselora/dom-webgl";

type Params = { kind: "viselora.imageHoverOverlay" };
type State = { layer: WebGLEffectMaterialLayerHandle | undefined };

const fragmentShader = `
  uniform float uHover;
  varying vec2 vUv;
  void main() {
    float edge = 1.0 - smoothstep(0.2, 0.8, distance(vUv, vec2(0.5)));
    gl_FragColor = vec4(0.49, 0.83, 0.98, uHover * edge * 0.5);
  }
`;

export const imageHoverOverlayEffect = defineWebGLEffect<Params, State>({
  kind: "viselora.imageHoverOverlay",
  source: "media/image",
  setup() {
    return { layer: undefined };
  },
  update(ctx, state) {
    const material = ctx.object.texture?.material;
    if (!material) return;
    if (!state.layer) {
      const layer = material.createMaterialLayer({
        key: `${ctx.key}.hover-overlay`,
        mode: "overlay",
        program: { fragmentShader, uniforms: { uHover: 0 } },
      });
      ctx.resources.addDisposable(() => layer.dispose());
      state.layer = layer;
    }
    state.layer.setUniforms({ uHover: ctx.targetPointer.isInside ? 1 : 0 });
    ctx.object.visible = true;
  },
  dispose(_ctx, state) {
    state.layer?.dispose();
  },
});

export const imageHoverWebgl = {
  key: "app.image-hover",
  source: { kind: "media", type: "image", src: "/media/product.webp" },
  pointer: { hover: true },
  lifecycle: {
    hideWhenReady: true,
    hideMode: "self",
    offscreen: { strategy: "restore-dom" },
  },
  effects: [{ kind: "viselora.imageHoverOverlay" }],
} as const;
```

Render it on `<WebGLTarget as="img" src="/media/product.webp" alt="..." />`; do not add DOM pointer listeners.

## Pinned model glow

Share a named timeline between the pinned section and effect. Scrub a real clip and use emissive plus a runtime-owned point light:

```tsx
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { defineWebGLEffect, type WebGLDeclaration } from "@viselora/dom-webgl";
import { WebGLTarget } from "@viselora/dom-webgl/react";
import { WebGLScrollTimeline } from "@viselora/scroll-adapters/react";

type Params = {
  kind: "viselora.modelGlow";
  progressKey: string;
  clip: string;
  durationSeconds: number;
};

type State = { lightRegistered: boolean };

export const modelGlowEffect = defineWebGLEffect<Params, State>({
  kind: "viselora.modelGlow",
  source: "model/glb",
  setup() {
    return { lightRegistered: false };
  },
  update(ctx, state, params) {
    const progress = Math.min(1, Math.max(0, ctx.progress.get(params.progressKey)));
    ctx.object.animation?.scrub(params.clip, {
      progress,
      durationSeconds: params.durationSeconds,
    });
    ctx.object.material?.emissive.set("#f6c453", 0.4 + progress * 1.6);
    ctx.object.model?.meshes.forEach((mesh) => {
      mesh.material.emissive.set("#f6c453", 0.3 + progress * 1.2);
    });
    const glowLight = ctx.object.lights?.point(`${ctx.key}.glow`, {
      color: "#f6c453",
      intensity: 0.8 + progress * 2.2,
      distance: 420,
      follow: "object",
    });
    if (glowLight && !state.lightRegistered) {
      ctx.resources.addDisposable(() => glowLight.dispose());
      state.lightRegistered = true;
    }
    ctx.object.visible = true;
  },
  dispose(ctx) {
    ctx.object.lights?.remove(`${ctx.key}.glow`);
  },
});

const progressKey = "model-glow-progress";

const pinnedModelDeclaration = {
  key: "app.pinned-model",
  timeline: { id: progressKey, progressKey },
  source: { kind: "model", type: "glb", src: "/models/product.glb" },
  lifecycle: {
    hideWhenReady: true,
    hideMode: "self",
    offscreen: { strategy: "park", warmTtlMs: 20_000 },
  },
  effects: [{
    kind: "viselora.modelGlow",
    progressKey,
    clip: "Reveal",
    durationSeconds: 2,
  }],
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
```

Replace `Reveal` with a clip name exported by the GLB. Avoid canvas-wide bloom for a single model.

## Scroll image sequence

Preload frames before mounting. Keep one stable progress key in the timeline, source, and effect:

```tsx
import { useMemo } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  defineWebGLEffect,
  type WebGLDeclaration,
  type WebGLImageSequenceFrame,
} from "@viselora/dom-webgl";
import { WebGLTarget } from "@viselora/dom-webgl/react";
import { WebGLScrollTimeline } from "@viselora/scroll-adapters/react";

type Params = { kind: "viselora.imageSequence"; progressKey: string };

export const imageSequenceEffect = defineWebGLEffect<Params>({
  kind: "viselora.imageSequence",
  source: "media/image-sequence",
  update(ctx, _state, params) {
    const progress = Math.min(1, Math.max(0, ctx.progress.get(params.progressKey)));
    ctx.object.texture?.setTransform({
      repeatX: 1.02,
      repeatY: 1.02,
      offsetX: progress * 0.02,
    });
    ctx.object.visible = true;
  },
});

gsap.registerPlugin(ScrollTrigger);

export function ScrollImageSequence(props: {
  frames: readonly WebGLImageSequenceFrame[];
  fallbackSrc: string;
}) {
  const progressKey = "sequence-progress";
  const sequenceDeclaration = useMemo<WebGLDeclaration>(
    () => ({
      key: "app.image-sequence",
      source: {
        kind: "media",
        type: "image-sequence",
        frameCount: props.frames.length,
        frames: props.frames,
        progressKey,
      },
      lifecycle: {
        hideWhenReady: true,
        hideMode: "self",
        offscreen: { strategy: "restore-dom" },
      },
      effects: [{ kind: "viselora.imageSequence", progressKey }],
    }),
    [props.frames],
  );

  return (
    <WebGLScrollTimeline
      id={progressKey}
      pin
      scrub
      ScrollTrigger={ScrollTrigger}
    >
      <WebGLTarget
        as="section"
        webgl={sequenceDeclaration}
      >
        <img alt="Product rotation preview" src={props.fallbackSrc} />
      </WebGLTarget>
    </WebGLScrollTimeline>
  );
}
```

Do not update `frames` on an already mounted target. Wait for the complete array or remount with a new key.
