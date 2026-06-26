import { createEffectDeclarations } from "@project/dom-webgl-runtime";

export type ExampleEffectParams = {
  "example.surfaceFill": { imageSrc?: string; opacity?: number };
  "example.surfacePulse": { scale?: number; opacity?: number };
  "example.textWave": { amplitude?: number };
  "example.textReveal": { color?: string };
  "example.pinnedReveal": { progressKey: string; color?: string };
  "example.imagePan": { distance?: number };
  "example.imageZoom": { maxScale?: number };
  "example.videoPlayback": { playbackRate?: number };
  "example.videoDrift": { distance?: number };
  "example.modelSpin": { speed?: number };
  "example.modelFloat": { amplitude?: number };
};

export const typeSafeDeclarations = createEffectDeclarations<ExampleEffectParams>()([
  { kind: "example.surfaceFill", imageSrc: "/example/bg.png", opacity: 0.72 },
  { kind: "example.surfacePulse", scale: 1.36, opacity: 0.92 },
  { kind: "example.textWave", amplitude: 7 },
  { kind: "example.textReveal", color: "#d95f42" },
  { kind: "example.pinnedReveal", progressKey: "example.pinned.reveal", color: "#172124" },
  { kind: "example.imagePan", distance: 0.2 },
  { kind: "example.imageZoom", maxScale: 1.36 },
  { kind: "example.videoPlayback", playbackRate: 0.8 },
  { kind: "example.videoDrift", distance: 0.12 },
  { kind: "example.modelSpin", speed: 0.25 },
  { kind: "example.modelFloat", amplitude: 24 },
]);
