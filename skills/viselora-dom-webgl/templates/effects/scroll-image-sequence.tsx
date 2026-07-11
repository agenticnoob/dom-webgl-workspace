// Experimental recipe for 0.1.0-alpha.0. Read capability-status.md before use.
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

type ImageSequenceParams = {
  kind: "viselora.imageSequence";
  progressKey: string;
};

export const imageSequenceEffect = defineWebGLEffect<ImageSequenceParams>({
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

export type ScrollImageSequenceProps = {
  frames: readonly WebGLImageSequenceFrame[];
  fallbackSrc: string;
};

gsap.registerPlugin(ScrollTrigger);

export function ScrollImageSequence({ frames, fallbackSrc }: ScrollImageSequenceProps) {
  const progressKey = "sequence-progress";
  const sequenceDeclaration = useMemo<WebGLDeclaration>(
    () => ({
      key: "viselora.image-sequence",
      source: {
        kind: "media",
        type: "image-sequence",
        frameCount: frames.length,
        frames,
        progressKey,
      },
      lifecycle: {
        hideWhenReady: true,
        hideMode: "self",
        offscreen: { strategy: "restore-dom" },
      },
      effects: [{ kind: "viselora.imageSequence", progressKey }],
    }),
    [frames],
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
        <img alt="Product rotation preview" src={fallbackSrc} />
      </WebGLTarget>
    </WebGLScrollTimeline>
  );
}
