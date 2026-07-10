import { useEffect, useMemo, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { WebGLDeclaration, WebGLImageSequenceFrame } from "@viselora/dom-webgl";
import { WebGLTarget } from "@viselora/dom-webgl/react";
import {
  WebGLScrollRuntime,
  WebGLScrollTimeline,
} from "@viselora/scroll-adapters/react";

import { runtimeEffects } from "./effects";

gsap.registerPlugin(ScrollTrigger);

const sharedProgressKey = "shared-progress";
const frameUrls = Array.from(
  { length: 48 },
  (_, index) => `/sequence/frame_${String(index + 1).padStart(4, "0")}.webp`,
);

const surfaceDeclaration = {
  key: "demo.surface-pulse",
  source: { kind: "dom", type: "element" },
  lifecycle: {
    hideWhenReady: true,
    hideMode: "self",
    offscreen: { strategy: "restore-dom" },
  },
  effects: [{ kind: "viselora.surfacePulse", color: "#7dd3fc" }],
} satisfies WebGLDeclaration;

const videoDeclaration = {
  key: "demo.video-background",
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
  effects: [{ kind: "viselora.videoBackground" }],
} satisfies WebGLDeclaration;

const imageDeclaration = {
  key: "demo.image-hover",
  source: { kind: "media", type: "image", src: "/media/product.webp" },
  pointer: { hover: true },
  lifecycle: {
    hideWhenReady: true,
    hideMode: "self",
    offscreen: { strategy: "restore-dom" },
  },
  effects: [{ kind: "viselora.imageHoverOverlay" }],
} satisfies WebGLDeclaration;

const modelDeclaration = {
  key: "demo.pinned-model",
  timeline: { id: sharedProgressKey, progressKey: sharedProgressKey },
  source: { kind: "model", type: "glb", src: "/models/product.glb" },
  lifecycle: {
    hideWhenReady: true,
    hideMode: "self",
    offscreen: { strategy: "park", warmTtlMs: 20_000 },
  },
  effects: [
    {
      kind: "viselora.modelGlow",
      progressKey: sharedProgressKey,
      clip: "Reveal",
      durationSeconds: 2,
    },
  ],
} satisfies WebGLDeclaration;

export function App() {
  const frames = useImageSequenceFrames(frameUrls);
  const sequenceDeclaration = useMemo<WebGLDeclaration | undefined>(() => {
    if (!frames) return undefined;
    return {
      key: "demo.image-sequence",
      source: {
        kind: "media",
        type: "image-sequence",
        frameCount: frames.length,
        frames,
        progressKey: sharedProgressKey,
      },
      lifecycle: {
        hideWhenReady: true,
        hideMode: "self",
        offscreen: { strategy: "restore-dom" },
      },
      effects: [{ kind: "viselora.imageSequence", progressKey: sharedProgressKey }],
    };
  }, [frames]);

  return (
    <WebGLScrollRuntime effects={runtimeEffects}>
      <main>
        <WebGLScrollTimeline
          id={sharedProgressKey}
          pin
          scrub
          ScrollTrigger={ScrollTrigger}
        >
          <WebGLTarget as="section" webgl={surfaceDeclaration}>
            <h1>DOM-first WebGL</h1>
          </WebGLTarget>

          <WebGLTarget
            as="video"
            src="/media/background.mp4"
            muted
            loop
            playsInline
            webgl={videoDeclaration}
          />

          <WebGLTarget
            as="img"
            src="/media/product.webp"
            alt="Product detail"
            webgl={imageDeclaration}
          />

          <WebGLTarget as="section" webgl={modelDeclaration}>
            <p>Interactive product model loading…</p>
          </WebGLTarget>

          {sequenceDeclaration ? (
            <WebGLTarget as="section" webgl={sequenceDeclaration}>
              <img alt="Product rotation preview" src={frameUrls[0]} />
            </WebGLTarget>
          ) : (
            <section aria-busy="true">
              <img alt="Product rotation preview" src={frameUrls[0]} />
            </section>
          )}
        </WebGLScrollTimeline>
      </main>
    </WebGLScrollRuntime>
  );
}

function useImageSequenceFrames(urls: readonly string[]) {
  const [frames, setFrames] = useState<readonly WebGLImageSequenceFrame[]>();

  useEffect(() => {
    let disposed = false;
    Promise.all(
      urls.map(
        (src) =>
          new Promise<HTMLImageElement>((resolve, reject) => {
            const image = new Image();
            image.onload = () => resolve(image);
            image.onerror = () => reject(new Error(`Failed to load ${src}`));
            image.src = src;
          }),
      ),
    ).then(
      (loadedFrames) => {
        if (!disposed) setFrames(loadedFrames);
      },
      () => {
        if (!disposed) setFrames(undefined);
      },
    );
    return () => {
      disposed = true;
    };
  }, [urls]);

  return frames;
}
